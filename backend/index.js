require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2'); // Đảm bảo bạn đã cài: npm install mysql2
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 5000; // Đảm bảo luôn ưu tiên 5000 nếu .env trống
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


// 🛠️ Cấu hình kết nối đến MySQL
const db = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'fpt_library',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

console.log('✅ MySQL Pool đã được khởi tạo thành công!');

// Lưu ý: Với mysql2 pool, bạn không cần gọi .connect() thủ công, 
// nó sẽ tự động kết nối khi bạn thực hiện truy vấn đầu tiên.

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
    req.userRole = decoded.role; // Lưu role để phân quyền
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

    // Tạo JWT Token bao gồm role (hết hạn trong 2 giờ)
    const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, {
      expiresIn: 7200 
    });

    res.json({
      message: 'Đăng nhập thành công!',
      accessToken: token,
      user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role }
    });
  });
});

// 1.2 Middleware phân quyền (Kiểm tra vai trò)
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.userRole)) {
      return res.status(403).json({ error: 'Bạn không có quyền thực hiện hành động này!' });
    }
    next();
  };
};

// 1.1 API Đăng ký Thủ thư (Dùng để tạo tài khoản ban đầu)
app.post('/api/register', (req, res) => {
  // Bảo vệ: Kiểm tra nếu req.body không tồn tại
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Dữ liệu đăng ký không hợp lệ!' });
  }

  const { username, password, fullName, role = 'librarian' } = req.body;
  const hashedPassword = bcrypt.hashSync(password, 8); // Mã hóa mật khẩu

  const sql = 'INSERT INTO librarians (username, password, fullName, role) VALUES (?, ?, ?, ?)';
  db.query(sql, [username, hashedPassword, fullName, role], (err) => {
    if (err) return res.status(500).json({ error: 'Tên tài khoản đã tồn tại hoặc lỗi DB.' });
    res.json({ message: 'Đăng ký thủ thư thành công!' });
  });
});

// 1. Lấy toàn bộ danh sách sách từ database
app.get('/api/books', verifyToken, (req, res) => { // Thêm verifyToken để bảo vệ API sách
  const page = parseInt(req.query.page) || 1; // Mặc định trang 1
  const limit = parseInt(req.query.limit) || 10; // Mặc định 10 mục mỗi trang
  const search = req.query.search || '';
  const category = req.query.category || 'Tất cả';
  const offset = (page - 1) * limit;

  // Xây dựng điều kiện WHERE động
  let whereClause = 'WHERE 1=1';
  const queryParams = [];

  if (search) {
    whereClause += ' AND (nameBook LIKE ? OR author LIKE ? OR isbn LIKE ?)';
    queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (category !== 'Tất cả') {
    whereClause += ' AND category = ?';
    queryParams.push(category === 'Công nghệ thông tin' ? 1 : category === 'Văn học' ? 2 : 3);
  }

  // Truy vấn để lấy tổng số sách
  const countSql = `SELECT COUNT(DISTINCT isbn, nameBook, author, year, category) as total FROM books ${whereClause}`;
  db.query(countSql, queryParams, (err, countResults) => {
    if (err) {
      console.error('Lỗi khi lấy tổng số sách:', err);
      return res.status(500).json({ error: err.message });
    }
    const totalItems = countResults[0].total;
    const totalPages = Math.ceil(totalItems / limit);

    // Truy vấn để lấy sách cho trang hiện tại
    const booksSql = `
      SELECT 
        MIN(IdBook) as IdBook, 
        nameBook, 
        isbn, 
        author, 
        year, 
        category, 
        COUNT(*) as totalQuantity, 
        SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) as availableQuantity 
      FROM books ${whereClause} 
      GROUP BY isbn, nameBook, author, year, category 
      LIMIT ? OFFSET ?`;
    const finalParams = [...queryParams, Number(limit), Number(offset)];

    db.query(booksSql, finalParams, (err, booksResults) => {
      if (err) {
        console.error('Lỗi khi lấy danh sách sách phân trang:', err);
        return res.status(500).json({ error: err.message });
      }
      res.json({ data: booksResults, totalItems, totalPages, currentPage: page });
    });
  });
});

// 1.2 API Lấy chi tiết các bản sao của một đầu sách dựa trên ISBN
app.get('/api/books/copies/:isbn', verifyToken, (req, res) => {
  const isbn = req.params.isbn;
  
  const sql = `
    SELECT IdBook, status 
    FROM books 
    WHERE isbn = ?
  `;
  
  db.query(sql, [isbn], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 2. Thêm một cuốn sách mới (mặc định status sẽ là 1 - có sẵn)
// Thêm verifyToken để chỉ thủ thư mới được thêm sách
app.post('/api/books', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const nameBook = sanitizeInput(req.body.nameBook);
  const author = sanitizeInput(req.body.author);
  const isbn = sanitizeInput(req.body.isbn || '');
  const { year, category, quantity = 1 } = req.body;

  // Tạo mảng dữ liệu để insert hàng loạt (bulk insert)
  const values = [];
  for (let i = 0; i < quantity; i++) {
    values.push([nameBook, isbn, author, year, category, 1]); // Thêm '1' cho status (Sẵn sàng)
  }

  const sql = 'INSERT INTO books (nameBook, isbn, author, year, category, status) VALUES ?';
  
  db.query(sql, [values], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: `Đã thêm thành công ${quantity} quyển sách!`, count: result.affectedRows });
  });
});

// 2.1 Cập nhật thông tin chi tiết của một cuốn sách dựa trên ID
// Thêm verifyToken để bảo vệ thao tác sửa sách
app.put('/api/books/:id', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
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
app.get('/api/students', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const queryParams = [];

  if (search) {
    whereClause += ' AND (MSV LIKE ? OR fullName LIKE ? OR class LIKE ? OR email LIKE ?)';
    const searchPattern = `%${search}%`;
    queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  const countSql = `SELECT COUNT(*) as total FROM students ${whereClause}`;
  db.query(countSql, queryParams, (err, countResults) => {
    if (err) return res.status(500).json({ error: err.message });

    const totalItems = countResults[0].total;
    const totalPages = Math.ceil(totalItems / limit);

    const sql = `SELECT * FROM students ${whereClause} LIMIT ? OFFSET ?`;
    const finalParams = [...queryParams, Number(limit), Number(offset)];

    db.query(sql, finalParams, (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        data: results,
        totalItems,
        totalPages,
        currentPage: page
      });
    });
  });
});

// 2.4 Thêm sinh viên mới
// Thêm verifyToken bảo vệ dữ liệu sinh viên
app.post('/api/students', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
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
app.put('/api/students/:msv', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
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
app.delete('/api/students/:msv', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
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
app.patch('/api/books/:id/toggle', verifyToken, authorize(['admin', 'librarian']), (req, res) => { // Bảo vệ API
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
app.delete('/api/books/:id', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
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
app.get('/api/borrows', verifyToken, authorize(['admin', 'librarian', 'student']), (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE br.status = ?'; // Lọc theo status
  const queryParams = [];
  queryParams.push(req.query.status || 1); // Mặc định lấy các bản ghi đang mượn (status = 1)

  if (search) {
    whereClause += ' AND (br.MSV LIKE ? OR s.fullName LIKE ? OR b.nameBook LIKE ?)';
    const searchPattern = `%${search}%`;
    queryParams.push(searchPattern, searchPattern, searchPattern);
  }

    // Nếu là sinh viên, chỉ cho xem lịch sử mượn của chính mình.
    // Lưu ý: hiện token đang chỉ chứa username (từ bảng librarians), KHÔNG chắc chắn username đó chính là MSV.
    // Để tránh trả sai dữ liệu rỗng/sai, ta lọc theo MSV lấy từ bảng students nếu có match.
  if (req.userRole === 'student') {
    whereClause += ' AND br.MSV IN (SELECT MSV FROM students WHERE email = ? OR fullName = ? OR class = ? OR MSV = ?)';
    // Trả về dữ liệu phù hợp nếu username trùng MSV hoặc trùng một trường trong students.
    queryParams.push(req.user.username, req.user.username, req.user.username, req.user.username);
  }

  const countSql = `
    SELECT COUNT(*) as total 
    FROM borrow_records br
    JOIN books b ON br.IdBook = b.IdBook
    JOIN students s ON br.MSV = s.MSV
    ${whereClause}
  `;

  db.query(countSql, queryParams, (err, countResults) => {

    if (err) return res.status(500).json({ error: err.message });

    const totalItems = countResults[0].total;
    const totalPages = Math.ceil(totalItems / limit);

    const sql = `
      SELECT br.*, b.nameBook, s.fullName, s.class 
      FROM borrow_records br
      JOIN books b ON br.IdBook = b.IdBook
      JOIN students s ON br.MSV = s.MSV
      ${whereClause}
      ORDER BY br.status DESC, br.timeStart DESC
      LIMIT ? OFFSET ?
    `;
    const finalParams = [...queryParams, Number(limit), Number(offset)];

    db.query(sql, finalParams, (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({
        data: results,
        totalItems,
        totalPages,
        currentPage: page
      });
    });
  });
});

// 6. Lập thẻ mượn mới: Tạo record mượn và cập nhật status sách sang 0
// Thêm verifyToken và sử dụng req.userId
app.post('/api/borrows', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const { IdBook, MSV } = req.body;
  const timeStart = new Date();

  // Mặc định cho mượn 14 ngày (Hạn trả)
  const timeEnd = new Date();
  timeEnd.setDate(timeStart.getDate() + 14); 

  // Lấy ID thủ thư từ token đã xác thực
  const IdUser = req.userId; 

  const sql = 'INSERT INTO borrow_records (IdBook, IdUser, MSV, timeStart, timeEnd, status) VALUES (?, ?, ?, ?, ?, 1)'; // Thêm status = 1
  db.query(sql, [IdBook, IdUser, MSV, timeStart, timeEnd], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });

    // Cập nhật luôn trạng thái cuốn sách thành ĐÃ MƯỢN (status = 0)
    db.query('UPDATE books SET status = 0 WHERE IdBook = ?', [IdBook]);

    res.json({ message: 'Tạo thẻ mượn thành công!', IdRent: result.insertId });
  });
});

// 5. API: Xử lý trả sách (Xóa thẻ mượn và mở lại trạng thái sách thành Có sẵn)
// Thêm verifyToken để bảo vệ API trả sách
app.patch('/api/borrows/:id/return', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const idRent = req.params.id;
  const returnDate = new Date();

  db.query('SELECT IdBook FROM borrow_records WHERE IdRent = ?', [idRent], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Không tìm thấy thẻ mượn' });
    const idBook = results[0].IdBook;

    // Cập nhật trạng thái thẻ mượn thay vì xóa
    const updateBorrowSql = 'UPDATE borrow_records SET status = 0, returnActualDate = ? WHERE IdRent = ?';
    db.query(updateBorrowSql, [returnDate, idRent], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.query('UPDATE books SET status = 1 WHERE IdBook = ?', [idBook], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Trả sách và cập nhật trạng thái kho thành công!' });
      });
    });
  });
});

// 7. API Thống kê cho Dashboard
app.get('/api/stats', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
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