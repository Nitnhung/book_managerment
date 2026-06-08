require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2'); // Đảm bảo bạn đã cài: npm install mysql2
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;
const SECRET_KEY = process.env.JWT_SECRET;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // Hỗ trợ thêm định dạng x-www-form-urlencoded (tab Form Data trong Postman)

// Middleware kiểm tra lỗi cú pháp JSON (Nếu bạn viết JSON sai, server sẽ báo lỗi cụ thể)
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    console.error('❌ Lỗi cú pháp JSON:', err.message);
    return res.status(400).json({ error: 'Dữ liệu JSON gửi lên bị sai cú pháp!' });
  }
  next();
});

// Hàm hỗ trợ làm sạch dữ liệu cơ bản để tránh XSS (loại bỏ các thẻ HTML)
// Trong thực tế, bạn nên dùng thư viện như 'xss' hoặc 'dompurify'
function sanitizeInput(data) {
  if (typeof data !== 'string') return data;
  // Loại bỏ các thẻ HTML đơn giản để ngăn chặn chèn script
  return data.replace(/<[^>]*>?/gm, '');
}


// 🛠️ Cấu hình kết nối đến MySQL đang chạy trong Docker Container
const db = mysql.createConnection({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME
});

db.connect((err) => {
  if (err) {
    console.error('❌ Lỗi kết nối đến Docker MySQL:', err.message);
    return;
  }
  console.log('✅ Đã kết nối thành công vào Docker MySQL Database!');
});

// --- DƯỚI ĐÂY LÀ CÁC ĐƯỜNG DẪN API (ROUTES) ---

// 0. Middleware xác thực Token
const verifyToken = (req, res, next) => {
  const authHeader = req.headers['authorization'] || '';
  if (!authHeader) return res.status(403).json({ error: 'Không tìm thấy Token. Vui lòng đăng nhập!' });

  // Tách chuỗi Bearer và làm sạch khoảng trắng/dấu xuống dòng thừa
  const parts = authHeader.trim().split(' ');
  const token = (parts.length === 2 && parts[0] === 'Bearer') ? parts[1] : parts[0];

  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return res.status(401).json({ error: 'Token không hợp lệ hoặc đã hết hạn.' });
    req.userId = decoded.id; // Lưu id người dùng vào request để dùng sau
    next();
  });
};

// 1. API Đăng nhập
app.post('/api/login', (req, res) => {
  console.log('--- [DEBUG] Yêu cầu Đăng nhập ---');
  console.log('Content-Type Header:', req.headers['content-type']);
  console.log('Dữ liệu Body:', req.body);

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Vui lòng cung cấp tài khoản và mật khẩu!' });
  }

  const { username, password } = req.body;

  const sql = 'SELECT * FROM librarians WHERE username = ?';
  db.query(sql, [username], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(401).json({ error: 'Tài khoản không tồn tại!' });

    const user = results[0];

    // So sánh mật khẩu đã mã hóa (Dùng bcrypt.compareSync)
    const passwordIsValid = bcrypt.compareSync(password, user.password);
    if (!passwordIsValid) return res.status(401).json({ error: 'Mật khẩu không chính xác!' });

    // Tạo JWT Token (hết hạn trong 2 giờ)
    const token = jwt.sign({ id: user.id, username: user.username }, SECRET_KEY, {
      expiresIn: 7200 
    });

    res.json({
      message: 'Đăng nhập thành công!',
      accessToken: token,
      user: { id: user.id, username: user.username, fullName: user.fullName }
    });
  });
});

// 1.1 API Đăng ký Thủ thư (Dùng để tạo tài khoản ban đầu)
app.post('/api/register', (req, res) => {
  // Bảo vệ: Kiểm tra nếu req.body không tồn tại
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Dữ liệu đăng ký không hợp lệ!' });
  }

  const { username, password, fullName } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 8); // Mã hóa mật khẩu

  const sql = 'INSERT INTO librarians (username, password, fullName) VALUES (?, ?, ?)';
  db.query(sql, [username, hashedPassword, fullName], (err) => {
    if (err) return res.status(500).json({ error: 'Tên tài khoản đã tồn tại hoặc lỗi DB.' });
    res.json({ message: 'Đăng ký thủ thư thành công!' });
  });
});

// 1. Lấy toàn bộ danh sách sách từ database
app.get('/api/books', (req, res) => {
  const sql = 'SELECT * FROM books';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 2. Thêm một cuốn sách mới (mặc định status sẽ là 1 - có sẵn)
// Thêm verifyToken để chỉ thủ thư mới được thêm sách
app.post('/api/books', verifyToken, (req, res) => {
  // Làm sạch dữ liệu đầu vào trước khi xử lý
  const nameBook = sanitizeInput(req.body.nameBook);
  const author = sanitizeInput(req.body.author);
  const { year, category } = req.body;

  const sql = 'INSERT INTO books (nameBook, author, year, category) VALUES (?, ?, ?, ?)';
  
  db.query(sql, [nameBook, author, year, category], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Thêm sách thành công!', id: result.insertId });
  });
});

// 2.1 Cập nhật thông tin chi tiết của một cuốn sách dựa trên ID
// Thêm verifyToken để bảo vệ thao tác sửa sách
app.put('/api/books/:id', verifyToken, (req, res) => {
  const id = req.params.id;
  // Nhận dữ liệu mới từ Frontend để cập nhật vào Database
  const nameBook = sanitizeInput(req.body.nameBook);
  const author = sanitizeInput(req.body.author);
  const { year, category } = req.body;

  const sql = 'UPDATE books SET nameBook = ?, author = ?, year = ?, category = ? WHERE IdBook = ?';
  
  db.query(sql, [nameBook, author, year, category, id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Không tìm thấy sách' });
    res.json({ message: 'Cập nhật thông tin sách thành công!' });
  });
});

// 2.3 Lấy toàn bộ danh sách sinh viên
app.get('/api/students', (req, res) => {
  const sql = 'SELECT * FROM students';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 2.4 Thêm sinh viên mới
// Thêm verifyToken bảo vệ dữ liệu sinh viên
app.post('/api/students', verifyToken, (req, res) => {
  // Kiểm tra dữ liệu đầu vào rỗng cho sinh viên
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Dữ liệu sinh viên không được để trống!' });
  }

  const MSV = sanitizeInput(req.body.MSV || '');
  const fullName = sanitizeInput(req.body.fullName || '');
  const className = sanitizeInput(req.body.class || '');
  const email = sanitizeInput(req.body.email || '');

  const sql = 'INSERT INTO students (MSV, fullName, class, email) VALUES (?, ?, ?, ?)';
  
  db.query(sql, [MSV, fullName, className, email], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Thêm sinh viên thành công!' });
  });
});

// 2.5 Cập nhật thông tin sinh viên
// Thêm verifyToken
app.put('/api/students/:msv', verifyToken, (req, res) => {
  const oldMsv = req.params.msv;
  const MSV = sanitizeInput(req.body.MSV);
  const fullName = sanitizeInput(req.body.fullName);
  const className = sanitizeInput(req.body.class);
  const email = sanitizeInput(req.body.email);

  const sql = 'UPDATE students SET MSV = ?, fullName = ?, class = ?, email = ? WHERE MSV = ?';
  
  db.query(sql, [MSV, fullName, className, email, oldMsv], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Cập nhật sinh viên thành công!' });
  });
});

// 2.6 Xóa sinh viên (có kiểm tra ràng buộc mượn sách)
// Thêm verifyToken
app.delete('/api/students/:msv', verifyToken, (req, res) => {
  const msv = req.params.msv;
  
  // Kiểm tra xem sinh viên có đang mượn sách không
  const checkSql = 'SELECT COUNT(*) as count FROM borrow_records WHERE MSV = ?';
  db.query(checkSql, [msv], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (results[0].count > 0) {
      return res.status(400).json({ error: 'Không thể xóa sinh viên này vì đang có thẻ mượn sách chưa trả!' });
    }
    
    const deleteSql = 'DELETE FROM students WHERE MSV = ?';
    db.query(deleteSql, [msv], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Xóa sinh viên thành công!' });
    });
  });
});

// 2.2 Lấy thông tin sinh viên theo MSV
app.get('/api/students/:msv', (req, res) => {
  const msv = req.params.msv;
  const sql = 'SELECT * FROM students WHERE MSV = ?';
  
  db.query(sql, [msv], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Không tìm thấy sinh viên' });
    res.json(results[0]);
  });
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
// Thêm middleware verifyToken để chỉ thủ thư đã đăng nhập mới được xóa
app.delete('/api/books/:id', verifyToken, (req, res) => {
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
    SELECT br.*, b.nameBook, s.fullName, s.class 
    FROM borrow_records br
    JOIN books b ON br.IdBook = b.IdBook
    JOIN students s ON br.MSV = s.MSV
    ORDER BY br.timeStart DESC
  `;
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 6. Lập thẻ mượn mới: Tạo record mượn và cập nhật status sách sang 0
// Thêm verifyToken và sử dụng req.userId
app.post('/api/borrows', verifyToken, (req, res) => {
  const { IdBook, MSV } = req.body;
  const timeStart = new Date();

  // Mặc định cho mượn 14 ngày (Hạn trả)
  const timeEnd = new Date();
  timeEnd.setDate(timeStart.getDate() + 14); 

  // Lấy ID thủ thư từ token đã xác thực
  const IdUser = req.userId; 

  const sql = 'INSERT INTO borrow_records (IdBook, IdUser, MSV, timeStart, timeEnd) VALUES (?, ?, ?, ?, ?)';
  db.query(sql, [IdBook, IdUser, MSV, timeStart, timeEnd], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    // Cập nhật luôn trạng thái cuốn sách thành ĐÃ MƯỢN (status = 0)
    db.query('UPDATE books SET status = 0 WHERE IdBook = ?', [IdBook]);

    res.json({ message: 'Tạo thẻ mượn thành công!', IdRent: result.insertId });
  });
});

// 5. API: Xử lý trả sách (Xóa thẻ mượn và mở lại trạng thái sách thành Có sẵn)
// Thêm verifyToken để bảo vệ API trả sách
app.delete('/api/borrows/:id', verifyToken, (req, res) => {
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

// 7. API Thống kê cho Dashboard
app.get('/api/stats', verifyToken, (req, res) => {
  const sql = `
    SELECT 
      (SELECT COUNT(*) FROM books) as totalBooks,
      (SELECT COUNT(*) FROM students) as totalStudents,
      (SELECT COUNT(*) FROM borrow_records) as activeBorrows,
      (SELECT COUNT(*) FROM books WHERE status = 1) as availableBooks
  `;
  
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results[0]);
  });
});

// Middleware xử lý lỗi toàn cục (Global Error Handler)
app.use((err, req, res, next) => {
  console.error('🔥 Lỗi hệ thống:', err.stack);
  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    error: err.message || 'Đã có lỗi xảy ra phía Server!',
    stack: process.env.NODE_ENV === 'development' ? err.stack : {} // Chỉ hiện lỗi chi tiết khi dev
  });
});

// Middleware xử lý khi người dùng gọi sai URL hoặc sai Phương thức (GET/POST/PUT/DELETE)
// LUÔN ĐẶT Ở CUỐI CÙNG SAU TẤT CẢ CÁC ROUTE KHÁC
app.use((req, res) => {
  res.status(404).json({
    error: `Không tìm thấy đường dẫn ${req.method} ${req.originalUrl}. Vui lòng kiểm tra lại!`
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Server Backend đang chạy mượt mà tại: http://localhost:${PORT}`);
});