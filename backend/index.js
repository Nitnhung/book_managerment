require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2'); // Đảm bảo bạn đã cài: npm install mysql2
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const cookieParser = require('cookie-parser');
const nodemailer = require('nodemailer');
const cron = require('node-cron');

const app = express();
const PORT = process.env.PORT || 5000; // Đảm bảo luôn ưu tiên 5000 nếu .env trống
const SECRET_KEY = process.env.JWT_SECRET;
const REFRESH_SECRET_KEY = process.env.JWT_REFRESH_SECRET || 'your_refresh_secret_key';

app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use(cookieParser());
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

// 📧 Cấu hình Email Service (Nodemailer)
// 📧 Nodemailer: cấu hình Gmail an toàn hơn + validate env
// Lưu ý: với Gmail nên dùng EMAIL_PASS là Gmail App Password.
const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: Number(process.env.EMAIL_PORT || 465),
  secure: (process.env.EMAIL_SECURE || 'true').toLowerCase() === 'true',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  },
  connectionTimeout: 15000,
  greetingTimeout: 15000
});



// Hàm gửi email nhắc nhở trả sách
async function sendReminderEmail(studentEmail, studentName, bookTitle, dueDate) {
  // validate để tránh lỗi to rỗng/sai định dạng
  if (!studentEmail || typeof studentEmail !== 'string' || !studentEmail.includes('@')) {
    return { ok: false, error: 'Invalid recipient email' };
  }
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    return { ok: false, error: 'Missing EMAIL_USER/EMAIL_PASS env' };
  }

  try {
    const mailOptions = {
      from: process.env.EMAIL_USER,
      to: studentEmail,
      subject: '📚 Nhắc nhở: Sách sắp đến hạn trả',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Nhắc nhở trả sách</h2>
          <p>Chào <strong>${studentName}</strong>,</p>
          <p>Sách <strong>"${bookTitle}"</strong> mà bạn đang mượn sẽ đến hạn trả vào ngày <strong>${dueDate}</strong>.</p>
          <p>Vui lòng trả sách đúng hạn để tránh bị phạt trễ.</p>
          <p>Trân trọng,<br>Thư viện FPT</p>
        </div>
      `
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Đã gửi email nhắc nhở đến ${studentEmail}`);
    return { ok: true };
  } catch (error) {
    const errPayload = {
      message: error?.message,
      code: error?.code,
      response: error?.response
    };
    console.error(`❌ Lỗi gửi email đến ${studentEmail}:`, errPayload);
    return { ok: false, error: errPayload };
  }
}


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
    req.user = decoded; // Lưu toàn bộ thông tin người dùng đã giải mã vào request
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

  const sql = `
    SELECT u.*, r.role_name 
    FROM users u 
    JOIN roles r ON u.role_id = r.id 
    WHERE u.username = ? OR u.email = ?`;
  
  db.query(sql, [username, username], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(401).json({ error: 'Tài khoản không tồn tại!' });

    const user = results[0];
    const passwordIsValid = bcrypt.compareSync(password, user.password);
    if (!passwordIsValid) return res.status(401).json({ error: 'Mật khẩu không chính xác!' });

    // Tạo Access Token (hết hạn nhanh - ví dụ 15 phút)
    const accessToken = jwt.sign({ 
      id: user.id, username: user.username, fullName: user.full_name, role: user.role_name 
    }, SECRET_KEY, { expiresIn: '15m' });

    // Tạo Refresh Token (hết hạn lâu - ví dụ 7 ngày)
    const refreshToken = jwt.sign({ 
      id: user.id 
    }, REFRESH_SECRET_KEY, { expiresIn: '7d' });

    // Lưu Refresh Token vào HttpOnly Cookie
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: false, // Đặt thành true nếu chạy trên HTTPS (production)
      sameSite: 'Lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
    });

    res.json({
      message: 'Đăng nhập thành công!',
      accessToken: accessToken,
      // Không trả về refreshToken trong JSON body nữa
      user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role_name }
    });
  });
});

// API đổi Refresh Token lấy Access Token mới
app.post('/api/token/refresh', (req, res) => {
  const refreshToken = req.cookies.refreshToken; // Lấy từ cookie thay vì body

  if (!refreshToken) return res.status(403).json({ error: 'Refresh Token là bắt buộc!' });

  jwt.verify(refreshToken, REFRESH_SECRET_KEY, (err, decoded) => {
    if (err) return res.status(403).json({ error: 'Refresh Token không hợp lệ hoặc đã hết hạn.' });

    // Lấy lại thông tin user từ DB để tạo Access Token mới (đảm bảo quyền lợi mới nhất)
    const sql = `SELECT u.*, r.role_name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`;
    db.query(sql, [decoded.id], (err, results) => {
      if (err || results.length === 0) return res.status(500).json({ error: 'Lỗi server' });
      
      const user = results[0];
      const newAccessToken = jwt.sign({ id: user.id, username: user.username, fullName: user.full_name, role: user.role_name }, SECRET_KEY, { expiresIn: '15m' });
      res.json({ accessToken: newAccessToken });
    });
  });
});

// 1.2 Middleware phân quyền (Kiểm tra vai trò)
const authorize = (roles = []) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) { // Corrected from req.userRole to req.user.role
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

  const { username, password, fullName, role_id = 2 } = req.body; // Mặc định là librarian (2)
  const hashedPassword = bcrypt.hashSync(password, 8); // Mã hóa mật khẩu

  const sql = 'INSERT INTO users (username, password, full_name, role_id) VALUES (?, ?, ?, ?)';
  db.query(sql, [username, hashedPassword, fullName, role_id], (err) => {
    if (err) return res.status(500).json({ error: 'Tên tài khoản đã tồn tại hoặc lỗi DB.' });
    res.json({ message: 'Đăng ký thủ thư thành công!' });
  });
});

// 1.3 API Đăng ký Sinh viên (Không cần xác thực token)
app.post('/api/register/student', (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Dữ liệu đăng ký sinh viên không hợp lệ!' });
  }

  const MSV = sanitizeInput(req.body.MSV || '');
  const fullName = sanitizeInput(req.body.fullName || '');
  const className = sanitizeInput(req.body.class || '');
  const email = sanitizeInput(req.body.email || '');
  const password = req.body.password; // New: password for student

  if (!password) return res.status(400).json({ error: 'Mật khẩu không được để trống!' });
  const hashedPassword = bcrypt.hashSync(password, 8);

  // Kiểm tra trùng lặp MSV hoặc Email trước khi thêm
  const checkSql = 'SELECT COUNT(*) as count FROM users WHERE username = ? OR email = ?';
  db.query(checkSql, [MSV, email], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results[0].count > 0) {
      return res.status(409).json({ error: 'Mã sinh viên hoặc Email đã tồn tại trong hệ thống!' });
    }

    const insertSql = 'INSERT INTO users (username, password, full_name, email, role_id) VALUES (?, ?, ?, ?, 3)';
    db.query(insertSql, [MSV, hashedPassword, fullName, email], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      
      const userId = result.insertId;
      const detailSql = 'INSERT INTO user_details (user_id, class_name) VALUES (?, ?)';
      db.query(detailSql, [userId, className], () => {
        // Tạo token để hỗ trợ tự động đăng nhập ngay sau khi đăng ký
        const token = jwt.sign({ 
          id: userId, username: MSV, fullName: fullName, role: 'student' 
        }, SECRET_KEY, { expiresIn: 7200 });

        res.status(201).json({ 
          message: 'Đăng ký tài khoản sinh viên thành công!',
          accessToken: token,
          user: { id: userId, username: MSV, fullName: fullName, role: 'student' }
        });
      });
    });
  });
});
// 1. Lấy toàn bộ danh sách sách từ database
app.get('/api/books', (req, res) => { // Cho phép khách xem danh sách sách
  const page = parseInt(req.query.page) || 1; // Mặc định trang 1
  const limit = parseInt(req.query.limit) || 10; // Mặc định 10 mục mỗi trang
  const search = req.query.search || '';
  const category = req.query.category || 'Tất cả';
  const offset = (page - 1) * limit;

  // Xây dựng điều kiện WHERE động
  let whereClause = 'WHERE 1=1';
  const queryParams = [];

  if (search) {
    whereClause += ' AND (title LIKE ? OR author LIKE ? OR isbn LIKE ?)';
    queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`);
  }

  if (category !== 'Tất cả') {
    whereClause += ' AND category_id = ?';
    queryParams.push(category === 'Công nghệ thông tin' ? 1 : category === 'Văn học' ? 2 : 3);
  }

  // Truy vấn để lấy tổng số sách
  const countSql = `SELECT COUNT(DISTINCT isbn, title, author, published_year, category_id) as total FROM books ${whereClause}`;
  db.query(countSql, queryParams, (err, countResults) => {
    if (err) {
      console.error('Lỗi khi lấy tổng số sách:', err);
      return res.status(500).json({ error: err.message });
    }
    const totalItems = countResults[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / limit);

    // Truy vấn để lấy sách cho trang hiện tại
    const booksSql = `
      SELECT 
        MIN(id) as IdBook, 
        title as nameBook, 
        isbn, 
        author, 
        published_year as year, 
        category_id as category, 
        COUNT(*) as totalQuantity, 
        SUM(IF(status = 1, 1, 0)) as availableQuantity 
      FROM books ${whereClause} 
      GROUP BY isbn, title, author, published_year, category_id
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
    SELECT id as IdBook, status 
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
    values.push([nameBook, isbn, author, year, category, 1]);
  }

  const sql = 'INSERT INTO books (title, isbn, author, published_year, category_id, status) VALUES ?';
  
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

  const sql = 'UPDATE books SET title = ?, author = ?, published_year = ?, category_id = ? WHERE id = ?';
  
  db.query(sql, [nameBook, author, year, category, id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Không tìm thấy sách' });
    res.json({ message: 'Cập nhật thông tin sách thành công!' });
  });
});

// 2.3 API Quản lý Danh mục Sách (Categories)
// Lấy danh sách tất cả danh mục
app.get('/api/categories', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const sql = 'SELECT * FROM categories ORDER BY category_name';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Thêm danh mục mới
app.post('/api/categories', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const { category_name } = req.body;
  if (!category_name) {
    return res.status(400).json({ error: 'Tên danh mục không được để trống!' });
  }

  const sql = 'INSERT INTO categories (category_name) VALUES (?)';
  db.query(sql, [category_name], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Thêm danh mục thành công!', id: result.insertId });
  });
});

// Cập nhật danh mục
app.put('/api/categories/:id', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const id = req.params.id;
  const { category_name } = req.body;
  if (!category_name) {
    return res.status(400).json({ error: 'Tên danh mục không được để trống!' });
  }

  const sql = 'UPDATE categories SET category_name = ? WHERE id = ?';
  db.query(sql, [category_name, id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Không tìm thấy danh mục' });
    res.json({ message: 'Cập nhật danh mục thành công!' });
  });
});

// Xóa danh mục
app.delete('/api/categories/:id', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const id = req.params.id;

  // Kiểm tra xem có sách nào thuộc danh mục này không
  const checkSql = 'SELECT COUNT(*) as count FROM books WHERE category_id = ?';
  db.query(checkSql, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results[0].count > 0) {
      return res.status(400).json({ error: 'Không thể xóa danh mục vì có sách thuộc danh mục này!' });
    }

    const deleteSql = 'DELETE FROM categories WHERE id = ?';
    db.query(deleteSql, [id], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Không tìm thấy danh mục' });
      res.json({ message: 'Xóa danh mục thành công!' });
    });
  });
});

// 2.4 Lấy toàn bộ danh sách sinh viên
app.get('/api/students', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const queryParams = [];

  if (search) {
    whereClause += ' AND (u.username LIKE ? OR u.full_name LIKE ? OR ud.class_name LIKE ? OR u.email LIKE ?)';
    const searchPattern = `%${search}%`;
    queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  const countSql = `SELECT COUNT(*) as total FROM users u LEFT JOIN user_details ud ON u.id = ud.user_id WHERE u.role_id = 3 ${search ? 'AND ' + whereClause.slice(6) : ''}`;
  db.query(countSql, queryParams, (err, countResults) => {
    if (err) return res.status(500).json({ error: err.message });

    const totalItems = countResults[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / limit);

    const sql = `
      SELECT u.username as MSV, u.full_name as fullName, ud.class_name as class, u.email 
      FROM users u 
      LEFT JOIN user_details ud ON u.id = ud.user_id 
      WHERE u.role_id = 3 
      ${search ? 'AND ' + whereClause.slice(6) : ''}
      LIMIT ? OFFSET ?`;
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

  const passHash = bcrypt.hashSync('123456', 8); // Mật khẩu mặc định
  const sql = 'INSERT INTO users (username, password, full_name, email, role_id) VALUES (?, ?, ?, ?, 3)';
  
  db.query(sql, [MSV, passHash, fullName, email], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    
    const detailSql = 'INSERT INTO user_details (user_id, class_name) VALUES (?, ?)';
    db.query(detailSql, [result.insertId, className], () => {
      res.json({ message: 'Thêm sinh viên thành công!' });
    });
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

  const sql = 'UPDATE users SET username = ?, full_name = ?, email = ? WHERE username = ?';
  
  db.query(sql, [MSV, fullName, email, oldMsv], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    const detailSql = 'UPDATE user_details ud JOIN users u ON u.id = ud.user_id SET ud.class_name = ? WHERE u.username = ?';
    db.query(detailSql, [className, MSV], () => {
      res.json({ message: 'Cập nhật sinh viên thành công!' });
    });
  });
});

// 2.6 Xóa sinh viên (có kiểm tra ràng buộc mượn sách)
// Thêm verifyToken
app.delete('/api/students/:msv', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const msv = req.params.msv;
  
  // Kiểm tra xem sinh viên có đang mượn sách không
  const checkSql = 'SELECT COUNT(*) as count FROM borrow_books bb JOIN users u ON bb.user_id = u.id WHERE u.username = ? AND bb.status = 1';
  db.query(checkSql, [msv], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    
    if (results[0].count > 0) {
      return res.status(400).json({ error: 'Không thể xóa sinh viên này vì đang có thẻ mượn sách chưa trả!' });
    }
    
    const deleteSql = 'DELETE FROM users WHERE username = ?';
    db.query(deleteSql, [msv], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Xóa sinh viên thành công!' });
    });
  });
});

// 2.2 Lấy thông tin sinh viên theo MSV
app.get('/api/students/:msv', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const msv = req.params.msv;
  const sql = `
    SELECT u.username as MSV, u.full_name as fullName, ud.class_name as class, u.email 
    FROM users u 
    LEFT JOIN user_details ud ON u.id = ud.user_id 
    WHERE u.username = ? AND u.role_id = 3`;
  
  db.query(sql, [msv], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Không tìm thấy sinh viên' });
    res.json(results[0]);
  });
});

// 3. Đảo ngược trạng thái mượn/trả (Sử dụng cho các thao tác nhanh)
app.patch('/api/books/:id/toggle', verifyToken, authorize(['admin', 'librarian']), (req, res) => { // Bảo vệ API
  const id = req.params.id;
  const getStatusSql = 'SELECT status FROM books WHERE id = ?';
  
  db.query(getStatusSql, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Không tìm thấy sách' });

    // Lấy trạng thái hiện tại (0 hoặc 1 trong MySQL) và đảo ngược lại
    const currentStatus = results[0].status;
    const newStatus = currentStatus === 1 || currentStatus === true ? 0 : 1; 

    const updateSql = 'UPDATE books SET status = ? WHERE id = ?';

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
  const checkStatusSql = 'SELECT status FROM books WHERE id = ?';
  db.query(checkStatusSql, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Không tìm thấy sách' });

    // Bước 2: Nếu status = 0 (đang mượn), chặn hành động xóa để tránh lỗi dữ liệu mồ côi
    if (results[0].status === 0 || results[0].status === false) {
      return res.status(400).json({ error: 'Không thể xóa sách khi đang có sinh viên mượn!' });
    }

    // Bước 3: Thực hiện xóa nếu sách đang ở trong kho (status = 1)
    const deleteSql = 'DELETE FROM books WHERE id = ?';
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

  let whereClause = 'WHERE bb.status = ?'; // Lọc theo status
  const queryParams = [];
  // Sửa lỗi logic: Nếu status là 0 (falsy), toán tử || sẽ lấy 1. Cần kiểm tra undefined.
  queryParams.push(req.query.status !== undefined ? req.query.status : 1);

  if (search) {
    whereClause += ' AND (u.username LIKE ? OR u.full_name LIKE ? OR b.title LIKE ?)';
    const searchPattern = `%${search}%`;
    queryParams.push(searchPattern, searchPattern, searchPattern);
  }

  if (req.user.role === 'student') {
    whereClause += ' AND u.id = ?';
    queryParams.push(req.user.id);
  }

  const countSql = `
    SELECT COUNT(*) as total 
    FROM borrow_books bb
    JOIN books b ON bb.book_id = b.id
    JOIN users u ON bb.user_id = u.id
    ${whereClause}
  `;

  db.query(countSql, queryParams, (err, countResults) => {
    if (err) return res.status(500).json({ error: err.message });

    const totalItems = countResults[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / limit);

    const sql = `
      SELECT 
        bb.id as IdRent, 
        u.username as MSV, 
        u.full_name as fullName, 
        ud.class_name as class, 
        b.title as nameBook, 
        bb.borrow_date as timeStart, 
        bb.due_date as timeEnd, 
        bb.return_date as returnActualDate, 
        bb.status 
      FROM borrow_books bb
      JOIN books b ON bb.book_id = b.id
      JOIN users u ON bb.user_id = u.id
      LEFT JOIN user_details ud ON u.id = ud.user_id
      ${whereClause}
      ORDER BY bb.status DESC, bb.borrow_date DESC
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
app.post('/api/borrows', verifyToken, authorize(['admin', 'librarian']), (req, res) => { //
  const { IdBook, MSV, timeEnd: requestedTimeEnd } = req.body; //
  const timeStart = new Date();

  // Nếu có ngày trả được gửi lên thì dùng ngày đó, nếu không mặc định 14 ngày kể từ hôm nay
  const timeEnd = requestedTimeEnd ? new Date(requestedTimeEnd) : new Date(timeStart.getTime() + 14 * 24 * 60 * 60 * 1000);

  // Lấy ID thủ thư từ token đã xác thực
  const IdUser = req.user.id; 

  // Tìm user_id của sinh viên từ MSV
  db.query('SELECT id FROM users WHERE username = ?', [MSV], (err, userRes) => {
    if (err || userRes.length === 0) return res.status(404).json({ error: 'Không tìm thấy sinh viên!' });
    const studentId = userRes[0].id;

    const sql = 'INSERT INTO borrow_books (book_id, librarian_id, user_id, borrow_date, due_date, status) VALUES (?, ?, ?, ?, ?, 1)';
    db.query(sql, [IdBook, IdUser, studentId, timeStart, timeEnd], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });

      db.query('UPDATE books SET status = 0 WHERE id = ?', [IdBook]);
      res.json({ message: 'Tạo thẻ mượn thành công!', IdRent: result.insertId });
    });
  });
});

// 5. API: Xử lý trả sách (Xóa thẻ mượn và mở lại trạng thái sách thành Có sẵn)
// Thêm verifyToken để bảo vệ API trả sách
app.patch('/api/borrows/:id/return', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const idRent = req.params.id;
  const returnDate = new Date();

  db.query('SELECT book_id FROM borrow_books WHERE id = ?', [idRent], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Không tìm thấy thẻ mượn' });
    const idBook = results[0].book_id;

    // Cập nhật trạng thái thẻ mượn thay vì xóa
    const updateBorrowSql = 'UPDATE borrow_books SET status = 0, return_date = ? WHERE id = ?';
    db.query(updateBorrowSql, [returnDate, idRent], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      db.query('UPDATE books SET status = 1 WHERE id = ?', [idBook], (err) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ message: 'Trả sách và cập nhật trạng thái kho thành công!' });
      });
    });
  });
});

// 7. API quản lý User (Admin/Librarian)
// Lưu ý: Với bảng hiện tại, user_details chỉ áp dụng cho student (role_id=3).
app.get('/api/users', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const search = req.query.search || '';
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const queryParams = [];

  if (search) {
    whereClause += ' AND (u.username LIKE ? OR u.full_name LIKE ? OR u.email LIKE ?)';
    const sp = `%${search}%`;
    queryParams.push(sp, sp, sp);
  }

  const countSql = `SELECT COUNT(*) as total FROM users u JOIN roles r ON u.role_id = r.id ${whereClause}`;
  db.query(countSql, queryParams, (err, countResults) => {
    if (err) return res.status(500).json({ error: err.message });
    const totalItems = countResults[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / limit);

    const sql = `
      SELECT u.id,
             u.username,
             u.full_name as fullName,
             u.email,
             r.role_name as role,
             u.role_id as roleId
      FROM users u
      JOIN roles r ON u.role_id = r.id
      ${whereClause}
      LIMIT ? OFFSET ?
    `;

    const finalParams = [...queryParams, Number(limit), Number(offset)];
    db.query(sql, finalParams, (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ data: results, totalItems, totalPages, currentPage: page });
    });
  });
});

// API lấy thông tin user theo ID (cho phép user xem thông tin của chính mình)
app.get('/api/users/:id', verifyToken, (req, res) => {
  const id = req.params.id;
  
  // Kiểm tra quyền: chỉ admin, librarian hoặc user chính mình được xem
  if (req.user.role !== 'admin' && req.user.role !== 'librarian' && req.user.id !== parseInt(id)) {
    return res.status(403).json({ error: 'Bạn không có quyền xem thông tin user này!' });
  }

  const sql = `
    SELECT u.id, u.username, u.full_name as fullName, u.email, r.role_name as role, u.role_id as roleId
    FROM users u
    JOIN roles r ON u.role_id = r.id
    WHERE u.id = ?
  `;
  
  db.query(sql, [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'Không tìm thấy user' });
    
    // Nếu là student, lấy thêm thông tin từ user_details
    if (results[0].role === 'student') {
      const detailSql = 'SELECT class_name as class FROM user_details WHERE user_id = ?';
      db.query(detailSql, [id], (err, detailResults) => {
        if (err) return res.status(500).json({ error: err.message });
        results[0].class = detailResults[0]?.class || '';
        res.json(results[0]);
      });
    } else {
      res.json(results[0]);
    }
  });
});

app.post('/api/users', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Dữ liệu user không hợp lệ!' });
  }

  const { username, fullName, email = null, role_id, password } = req.body;
  if (!username || !fullName || !role_id) {
    return res.status(400).json({ error: 'Thiếu username/fullName/role_id!' });
  }

  const pass = password && password.length ? password : '123456';
  const hashedPassword = bcrypt.hashSync(pass, 8);

  const sql = 'INSERT INTO users (username, password, full_name, email, role_id) VALUES (?, ?, ?, ?, ?)';
  db.query(sql, [username, hashedPassword, fullName, email, role_id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Thêm user thành công!', id: result.insertId });
  });
});

app.put('/api/users/:id', verifyToken, (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Dữ liệu user không hợp lệ!' });
  }

  const id = req.params.id;
  const { username, fullName, email = null, role_id, currentPassword, newPassword } = req.body;

  // Debug: Log thông tin để kiểm tra
  console.log('[DEBUG] Update User - req.user.id:', req.user.id, 'type:', typeof req.user.id);
  console.log('[DEBUG] Update User - id from params:', id, 'type:', typeof id);
  console.log('[DEBUG] Update User - parseInt(id):', parseInt(id), 'type:', typeof parseInt(id));

  // Kiểm tra quyền: admin/librarian có thể cập nhật user khác, user thường chỉ có thể cập nhật chính mình
  const isSelfUpdate = req.user.id === parseInt(id);
  const isAdminOrLibrarian = req.user.role === 'admin' || req.user.role === 'librarian';

  console.log('[DEBUG] Update User - isSelfUpdate:', isSelfUpdate, 'isAdminOrLibrarian:', isAdminOrLibrarian);

  if (!isAdminOrLibrarian && !isSelfUpdate) {
    return res.status(403).json({ error: 'Bạn không có quyền cập nhật user này!' });
  }

  // Nếu user thường tự cập nhật, không cho phép thay đổi role_id
  if (isSelfUpdate && !isAdminOrLibrarian && role_id && role_id !== req.user.role_id) {
    return res.status(403).json({ error: 'Bạn không có quyền thay đổi role của mình!' });
  }

  // Xử lý đổi mật khẩu
  if (newPassword) {
    if (!currentPassword) {
      return res.status(400).json({ error: 'Vui lòng nhập mật khẩu hiện tại để đổi mật khẩu!' });
    }

    // Kiểm tra mật khẩu hiện tại
    const checkPasswordSql = 'SELECT password FROM users WHERE id = ?';
    db.query(checkPasswordSql, [id], (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) return res.status(404).json({ error: 'Không tìm thấy user' });

      const passwordIsValid = bcrypt.compareSync(currentPassword, results[0].password);
      if (!passwordIsValid) {
        return res.status(401).json({ error: 'Mật khẩu hiện tại không chính xác!' });
      }

      // Mã hóa mật khẩu mới
      const hashedPassword = bcrypt.hashSync(newPassword, 8);

      // Cập nhật thông tin user bao gồm mật khẩu mới
      const updateSql = isAdminOrLibrarian 
        ? 'UPDATE users SET username = ?, full_name = ?, email = ?, role_id = ?, password = ? WHERE id = ?'
        : 'UPDATE users SET full_name = ?, email = ?, password = ? WHERE id = ?';

      const params = isAdminOrLibrarian
        ? [username, fullName, email, role_id, hashedPassword, id]
        : [fullName, email, hashedPassword, id];

      db.query(updateSql, params, (err, result) => {
        if (err) return res.status(500).json({ error: err.message });
        if (result.affectedRows === 0) return res.status(404).json({ error: 'Không tìm thấy user' });
        res.json({ message: 'Cập nhật user thành công!' });
      });
    });
  } else {
    // Không đổi mật khẩu, chỉ cập nhật thông tin cơ bản
    const updateSql = isAdminOrLibrarian
      ? 'UPDATE users SET username = ?, full_name = ?, email = ?, role_id = ? WHERE id = ?'
      : 'UPDATE users SET full_name = ?, email = ? WHERE id = ?';

    const params = isAdminOrLibrarian
      ? [username, fullName, email, role_id, id]
      : [fullName, email, id];

    db.query(updateSql, params, (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ error: 'Không tìm thấy user' });
      res.json({ message: 'Cập nhật user thành công!' });
    });
  }
});

app.delete('/api/users/:id', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const id = req.params.id;

  const sql = 'DELETE FROM users WHERE id = ?';
  db.query(sql, [id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Xóa user thành công!' });
  });
});

// 8. API Thống kê cho Dashboard
app.get('/api/stats', verifyToken, (req, res) => { // Yêu cầu xác thực token để xem thống kê
  const sql = `
    SELECT
      (SELECT COUNT(*) FROM books) as totalBooks,
      (SELECT COUNT(*) FROM users WHERE role_id = 3) as totalStudents,
      (SELECT COUNT(*) FROM borrow_books WHERE status = 1) as activeBorrows,
      (SELECT COUNT(*) FROM books WHERE status = 1) as availableBooks
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results[0] || { totalBooks: 0, totalStudents: 0, activeBorrows: 0, availableBooks: 0 });
  });
});

// 9. API Yêu cầu mượn sách (Borrow Requests)
// Student tạo yêu cầu mượn sách
app.post('/api/borrow-requests', verifyToken, authorize(['student']), (req, res) => {
  const { bookId } = req.body;
  const userId = req.user.id;

  if (!bookId) {
    return res.status(400).json({ error: 'Vui lòng chọn sách muốn mượn!' });
  }

  // Kiểm tra xem sách có tồn tại và có sẵn không
  const checkBookSql = 'SELECT id, title, status FROM books WHERE id = ?';
  db.query(checkBookSql, [bookId], (err, bookResults) => {
    if (err) return res.status(500).json({ error: err.message });
    if (bookResults.length === 0) return res.status(404).json({ error: 'Không tìm thấy sách!' });
    if (bookResults[0].status === 0) return res.status(400).json({ error: 'Sách này hiện không có sẵn!' });

    // Kiểm tra xem student đã có yêu cầu mượn sách này chưa (chỉ kiểm tra pending)
    const checkRequestSql = 'SELECT id FROM borrow_requests WHERE user_id = ? AND book_id = ? AND status = "pending"';
    db.query(checkRequestSql, [userId, bookId], (err, requestResults) => {
      if (err) return res.status(500).json({ error: err.message });
      if (requestResults.length > 0) return res.status(400).json({ error: 'Bạn đã có yêu cầu mượn sách này đang chờ duyệt!' });

      // Kiểm tra xem student đang mượn sách này chưa
      const checkBorrowSql = `
        SELECT bb.id FROM borrow_books bb 
        JOIN books b ON bb.book_id = b.id 
        WHERE bb.user_id = ? AND b.isbn = (SELECT isbn FROM books WHERE id = ?) AND bb.status = 1
      `;
      db.query(checkBorrowSql, [userId, bookId], (err, borrowResults) => {
        if (err) return res.status(500).json({ error: err.message });
        if (borrowResults.length > 0) return res.status(400).json({ error: 'Bạn đang mượn cuốn sách này!' });

        // Tạo yêu cầu mượn sách mới
        const insertSql = 'INSERT INTO borrow_requests (book_id, user_id, status) VALUES (?, ?, "pending")';
        db.query(insertSql, [bookId, userId], (err, result) => {
          if (err) return res.status(500).json({ error: err.message });
          res.json({ 
            message: 'Gửi yêu cầu mượn sách thành công!', 
            requestId: result.insertId 
          });
        });
      });
    });
  });
});

// Admin/Librarian xem danh sách yêu cầu mượn sách
app.get('/api/borrow-requests', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const status = req.query.status || 'pending'; // pending, approved, rejected, all
  const search = req.query.search || '';
  const offset = (page - 1) * limit;

  let whereClause = 'WHERE 1=1';
  const queryParams = [];

  if (status !== 'all') {
    whereClause += ' AND br.status = ?';
    queryParams.push(status);
  }

  if (search) {
    whereClause += ' AND (u.username LIKE ? OR u.full_name LIKE ? OR b.title LIKE ?)';
    const searchPattern = `%${search}%`;
    queryParams.push(searchPattern, searchPattern, searchPattern);
  }

  const countSql = `
    SELECT COUNT(*) as total 
    FROM borrow_requests br
    JOIN books b ON br.book_id = b.id
    JOIN users u ON br.user_id = u.id
    ${whereClause}
  `;

  db.query(countSql, queryParams, (err, countResults) => {
    if (err) return res.status(500).json({ error: err.message });
    const totalItems = countResults[0]?.total || 0;
    const totalPages = Math.ceil(totalItems / limit);

    const sql = `
      SELECT 
        br.id as requestId,
        br.book_id as bookId,
        br.user_id as userId,
        br.request_date as requestDate,
        br.status,
        br.approved_by as approvedBy,
        br.approved_date as approvedDate,
        br.rejection_reason as rejectionReason,
        b.title as bookTitle,
        b.author as bookAuthor,
        b.isbn as bookIsbn,
        u.username as studentUsername,
        u.full_name as studentFullName,
        ud.class_name as studentClass,
        admin.full_name as approvedByName
      FROM borrow_requests br
      JOIN books b ON br.book_id = b.id
      JOIN users u ON br.user_id = u.id
      LEFT JOIN user_details ud ON u.id = ud.user_id
      LEFT JOIN users admin ON br.approved_by = admin.id
      ${whereClause}
      ORDER BY br.request_date DESC
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

// Student xem danh sách yêu cầu mượn sách của mình
app.get('/api/borrow-requests/my-requests', verifyToken, authorize(['student']), (req, res) => {
  const userId = req.user.id;
  const status = req.query.status || 'all'; // pending, approved, rejected, all

  let whereClause = 'WHERE br.user_id = ?';
  const queryParams = [userId];

  if (status !== 'all') {
    whereClause += ' AND br.status = ?';
    queryParams.push(status);
  }

  const sql = `
    SELECT 
      br.id as requestId,
      br.book_id as bookId,
      br.user_id as userId,
      br.request_date as requestDate,
      br.status,
      br.approved_by as approvedBy,
      br.approved_date as approvedDate,
      br.rejection_reason as rejectionReason,
      b.title as bookTitle,
      b.author as bookAuthor,
      b.isbn as bookIsbn,
      admin.full_name as approvedByName
    FROM borrow_requests br
    JOIN books b ON br.book_id = b.id
    LEFT JOIN users admin ON br.approved_by = admin.id
    ${whereClause}
    ORDER BY br.request_date DESC
  `;

  db.query(sql, queryParams, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// Admin/Librarian duyệt yêu cầu mượn sách
app.put('/api/borrow-requests/:id/approve', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const requestId = req.params.id;
  const librarianId = req.user.id;

  // Lấy thông tin yêu cầu
  const getRequestSql = `
    SELECT br.*, b.title, b.status as bookStatus 
    FROM borrow_requests br 
    JOIN books b ON br.book_id = b.id 
    WHERE br.id = ?
  `;

  db.query(getRequestSql, [requestId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'Không tìm thấy yêu cầu!' });
    
    const request = results[0];
    if (request.status !== 'pending') return res.status(400).json({ error: 'Yêu cầu này đã được xử lý!' });
    if (request.bookStatus === 0) return res.status(400).json({ error: 'Sách này hiện không có sẵn!' });

    // Kiểm tra xem student đang mượn sách này chưa
    const checkBorrowSql = `
      SELECT bb.id FROM borrow_books bb 
      JOIN books b ON bb.book_id = b.id 
      WHERE bb.user_id = ? AND b.isbn = (SELECT isbn FROM books WHERE id = ?) AND bb.status = 1
    `;
    db.query(checkBorrowSql, [request.user_id, request.book_id], (err, borrowResults) => {
      if (err) return res.status(500).json({ error: err.message });
      if (borrowResults.length > 0) return res.status(400).json({ error: 'Student đang mượn cuốn sách này!' });

      // Cập nhật trạng thái yêu cầu
      const updateRequestSql = `
        UPDATE borrow_requests 
        SET status = 'approved', approved_by = ?, approved_date = NOW() 
        WHERE id = ?
      `;
      db.query(updateRequestSql, [librarianId, requestId], (err) => {
        if (err) return res.status(500).json({ error: err.message });

        // Tạo bản ghi mượn sách
        const borrowDate = new Date();
        const dueDate = new Date(borrowDate.getTime() + 14 * 24 * 60 * 60 * 1000); // 14 ngày

        const insertBorrowSql = `
          INSERT INTO borrow_books (book_id, user_id, librarian_id, borrow_date, due_date, status) 
          VALUES (?, ?, ?, ?, ?, 1)
        `;
        db.query(insertBorrowSql, [request.book_id, request.user_id, librarianId, borrowDate, dueDate], (err) => {
          if (err) return res.status(500).json({ error: err.message });

          // Cập nhật trạng thái sách
          const updateBookSql = 'UPDATE books SET status = 0 WHERE id = ?';
          db.query(updateBookSql, [request.book_id], (err) => {
            if (err) return res.status(500).json({ error: err.message });
            res.json({ message: 'Duyệt yêu cầu mượn sách thành công!' });
          });
        });
      });
    });
  });
});

// Admin/Librarian từ chối yêu cầu mượn sách
app.put('/api/borrow-requests/:id/reject', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const requestId = req.params.id;
  const librarianId = req.user.id;
  const { rejectionReason } = req.body;

  // Lấy thông tin yêu cầu
  const getRequestSql = 'SELECT * FROM borrow_requests WHERE id = ?';
  db.query(getRequestSql, [requestId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'Không tìm thấy yêu cầu!' });
    
    const request = results[0];
    if (request.status !== 'pending') return res.status(400).json({ error: 'Yêu cầu này đã được xử lý!' });

    // Cập nhật trạng thái yêu cầu
    const updateSql = `
      UPDATE borrow_requests 
      SET status = 'rejected', approved_by = ?, approved_date = NOW(), rejection_reason = ? 
      WHERE id = ?
    `;
    db.query(updateSql, [librarianId, rejectionReason || 'Không có lý do', requestId], (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Từ chối yêu cầu mượn sách thành công!' });
    });
  });
});

// 10. API Gửi Email Nhắc Nhở Trả Sách
// API thủ công gửi email nhắc nhở (cho admin/librarian test)
app.post('/api/send-reminder-emails', verifyToken, authorize(['admin', 'librarian']), async (req, res) => {
  try {
    // Tìm các bản ghi mượn sách đang mượn và đến hạn trả trong 1 ngày
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const sql = `
      SELECT bb.id, bb.user_id, bb.book_id, bb.due_date,
             u.full_name, u.email,
             b.title
      FROM borrow_books bb
      JOIN users u ON bb.user_id = u.id
      JOIN books b ON bb.book_id = b.id
      WHERE bb.status = 1
      AND DATE(bb.due_date) = ?
    `;

    db.query(sql, [tomorrowStr], async (err, results) => {
      if (err) return res.status(500).json({ error: err.message });

      if (results.length === 0) {
        return res.json({ message: 'Không có sinh viên nào cần gửi email nhắc nhở hôm nay.' });
      }

      let successCount = 0;
      let failCount = 0;
      const failures = [];

      for (const record of results) {
        const dueDate = new Date(record.due_date).toLocaleDateString('vi-VN');
        const result = await sendReminderEmail(
          record.email,
          record.full_name,
          record.title,
          dueDate
        );

        if (result?.ok) {
          successCount++;
        } else {
          failCount++;
          failures.push({
            studentEmail: record.email,
            fullName: record.full_name,
            bookTitle: record.title,
            dueDate,
            error: result?.error || 'Unknown error'
          });
        }
      }

      res.json({
        message: `Đã gửi ${successCount} email nhắc nhở thành công, ${failCount} email thất bại.`,
        total: results.length,
        success: successCount,
        failed: failCount,
        failures
      });
    });
  } catch (error) {
    console.error('Lỗi gửi email nhắc nhở:', error);
    res.status(500).json({ error: 'Lỗi khi gửi email nhắc nhở' });
  }
});

// Cron Job: Tự động gửi email nhắc nhở hàng ngày vào lúc 8:00 sáng
cron.schedule('0 8 * * *', async () => {
  console.log('🕗 [CRON] Bắt đầu gửi email nhắc nhở trả sách...');

  try {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    const sql = `
      SELECT bb.id, bb.user_id, bb.book_id, bb.due_date,
             u.full_name, u.email,
             b.title
      FROM borrow_books bb
      JOIN users u ON bb.user_id = u.id
      JOIN books b ON bb.book_id = b.id
      WHERE bb.status = 1
      AND DATE(bb.due_date) = ?
    `;

    db.query(sql, [tomorrowStr], async (err, results) => {
      if (err) {
        console.error('[CRON] Lỗi truy vấn database:', err);
        return;
      }

      if (results.length === 0) {
        console.log('[CRON] Không có sinh viên nào cần gửi email nhắc nhở hôm nay.');
        return;
      }

      let successCount = 0;
      let failCount = 0;
      const failures = [];

      for (const record of results) {
        const dueDate = new Date(record.due_date).toLocaleDateString('vi-VN');
        const result = await sendReminderEmail(
          record.email,
          record.full_name,
          record.title,
          dueDate
        );

        if (result?.ok) {
          successCount++;
        } else {
          failCount++;
        }
      }

      console.log(`[CRON] Hoàn thành: ${successCount} email thành công, ${failCount} email thất bại.`);
    });
  } catch (error) {
    console.error('[CRON] Lỗi gửi email nhắc nhở:', error);
  }
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