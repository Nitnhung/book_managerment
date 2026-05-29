const express = require('express');
const cors = require('cors');
const mysql = require('mysql2'); // Đảm bảo bạn đã cài: npm install mysql2

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

// 🛠️ Cấu hình kết nối đến MySQL đang chạy trong Docker Container
const db = mysql.createConnection({
  host: 'localhost',
  port: 3307,        // Cổng kết nối mặc định của MySQL
  user: 'root',
  password: '',      // Mật khẩu để trống theo cấu hình lệnh Docker
  database: 'fpt_library'
});

db.connect((err) => {
  if (err) {
    console.error('❌ Lỗi kết nối đến Docker MySQL:', err.message);
    return;
  }
  console.log('✅ Đã kết nối thành công vào Docker MySQL Database!');
});

// --- DƯỚI ĐÂY LÀ CÁC ĐƯỜNG DẪN API (ROUTES) ---

// 1. Lấy toàn bộ danh sách sách từ database
app.get('/api/books', (req, res) => {
  const sql = 'SELECT * FROM books';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 2. Thêm một cuốn sách mới (mặc định status sẽ là 1 - có sẵn)
app.post('/api/books', (req, res) => {
  const { nameBook, author, year, category } = req.body;
  const sql = 'INSERT INTO books (nameBook, author, year, category) VALUES (?, ?, ?, ?)';
  
  db.query(sql, [nameBook, author, year, category], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Thêm sách thành công!', id: result.insertId });
  });
});

// 2.1 Cập nhật thông tin chi tiết của một cuốn sách dựa trên ID
app.put('/api/books/:id', (req, res) => {
  const id = req.params.id;
  // Nhận dữ liệu mới từ Frontend để cập nhật vào Database
  const { nameBook, author, year, category } = req.body;
  const sql = 'UPDATE books SET nameBook = ?, author = ?, year = ?, category = ? WHERE IdBook = ?';
  
  db.query(sql, [nameBook, author, year, category, id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Không tìm thấy sách' });
    res.json({ message: 'Cập nhật thông tin sách thành công!' });
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server Backend đang chạy mượt mà tại: http://localhost:${PORT}`);
});

// 3. Đảo ngược trạng thái mượn/trả (Sử dụng cho các thao tác nhanh)
app.patch('/api/books/:id/toggle', (req, res) => {
  const id = req.params.id;
  const getStatusSql = 'SELECT status FROM books WHERE IdBook = ?';
  
  db.query(getStatusSql, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Không tìm thấy sách' });

    // Lấy trạng thái hiện tại (0 hoặc 1 trong MySQL) và đảo ngược lại
    const currentStatus = results[0].status;
    const newStatus = currentStatus === 1 || currentStatus === true ? 0 : 1; 

    const updateSql = 'UPDATE books SET status = ? WHERE IdBook = ?';

    // Truyền biến newStatus vào câu lệnh UPDATE
    db.query(updateSql, [newStatus, id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Cập nhật trạng thái thành công!', newStatus });
    });
  });
});

// 4. Xóa sách với cơ chế bảo vệ: Không cho xóa nếu sách đang bị mượn
app.delete('/api/books/:id', (req, res) => {
  const id = req.params.id;

  // Bước 1: Truy vấn trạng thái hiện tại của sách
  const checkStatusSql = 'SELECT status FROM books WHERE IdBook = ?';
  db.query(checkStatusSql, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Không tìm thấy sách' });

    // Bước 2: Nếu status = 0 (đang mượn), chặn hành động xóa để tránh lỗi dữ liệu mồ côi
    if (results[0].status === 0 || results[0].status === false) {
      return res.status(400).json({ error: 'Không thể xóa sách khi đang có sinh viên mượn!' });
    }

    // Bước 3: Thực hiện xóa nếu sách đang ở trong kho (status = 1)
    const deleteSql = 'DELETE FROM books WHERE IdBook = ?';
    db.query(deleteSql, [id], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Xóa sách thành công!' });
    });
  });
});

// 5. Lấy danh sách thẻ mượn kèm theo tên sách (sử dụng JOIN bảng)
app.get('/api/borrows', (req, res) => {
  const sql = `
    SELECT br.*, b.nameBook 
    FROM borrow_records br 
    JOIN books b ON br.IdBook = b.IdBook
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 6. Lập thẻ mượn mới: Tạo record mượn và cập nhật status sách sang 0
app.post('/api/borrows', (req, res) => {
  const { IdBook, MSV } = req.body;
  const timeStart = new Date();

  // Mặc định cho mượn 14 ngày (Hạn trả)
  const timeEnd = new Date();
  timeEnd.setDate(timeStart.getDate() + 14); 

  // Tạm thời gán IdUser cố định hoặc tìm kiếm từ bảng users dựa vào MSV ở bước nâng cao
  const IdUser = 1; 

  const sql = 'INSERT INTO borrow_records (IdBook, IdUser, MSV, timeStart, timeEnd) VALUES (?, ?, ?, ?, ?)';
  db.query(sql, [IdBook, IdUser, MSV, timeStart, timeEnd], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    // Cập nhật luôn trạng thái cuốn sách thành ĐÃ MƯỢN (status = 0)
    db.query('UPDATE books SET status = 0 WHERE IdBook = ?', [IdBook]);

    res.json({ message: 'Tạo thẻ mượn thành công!', IdRent: result.insertId });
  });
});

// 5. API: Xử lý trả sách (Xóa thẻ mượn và mở lại trạng thái sách thành Có sẵn)
app.delete('/api/borrows/:id', (req, res) => {
  const idRent = req.params.id;

  // Bước A: Tìm xem thẻ mượn này đang mượn cuốn sách nào (IdBook) trước khi xóa
  const findBookSql = 'SELECT IdBook FROM borrow_records WHERE IdRent = ?';
  
  db.query(findBookSql, [idRent], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Không tìm thấy thẻ mượn' });

    const idBook = results[0].IdBook;

    // Bước B: Xóa thẻ mượn khỏi bảng borrow_records
    const deleteBorrowSql = 'DELETE FROM borrow_records WHERE IdRent = ?';
    db.query(deleteBorrowSql, [idRent], (err) => {
      if (err) return res.status(500).json({ error: err.message });

      // Bước C: Cập nhật lại cột status của cuốn sách đó thành Có sẵn (1) trong bảng books
      const updateBookSql = 'UPDATE books SET status = 1 WHERE IdBook = ?';
      db.query(updateBookSql, [idBook], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        
        res.json({ message: 'Trả sách và cập nhật trạng thái kho thành công!' });
      });
    });
  });
});