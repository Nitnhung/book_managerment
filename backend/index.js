require('dotenv').config();
const express = require('express');
const cors = require('cors');
const mysql = require('mysql2');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const cron = require('node-cron');
const ExcelJS = require('exceljs');

const app = express();
const PORT = process.env.PORT || 5000; // Đảm bảo luôn ưu tiên 5000 nếu .env trống
const SECRET_KEY = process.env.JWT_SECRET;

app.use(cors({
  origin: 'http://localhost:5173', // Frontend URL
  credentials: true // Cho phép gửi cookies
}));
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

const STUDENT_ROLE_ID = 3;

// Tra MSV (username) sang user_id trong bảng users
function resolveUserIdFromMSV(msv, callback) {
  db.query(
    'SELECT id FROM users WHERE username = ? AND role_id = ?',
    [msv, STUDENT_ROLE_ID],
    (err, results) => {
      if (err) return callback(err);
      if (results.length > 0) return callback(null, results[0].id);

      db.query('SELECT email FROM students WHERE MSV = ?', [msv], (err2, students) => {
        if (err2) return callback(err2);
        if (students.length === 0 || !students[0].email) return callback(null, null);

        db.query(
          'SELECT id FROM users WHERE email = ? AND role_id = ?',
          [students[0].email, STUDENT_ROLE_ID],
          (err3, users) => {
            if (err3) return callback(err3);
            callback(null, users.length ? users[0].id : null);
          }
        );
      });
    }
  );
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
    req.userMSV = decoded.MSV; // Mã sinh viên (chỉ có với tài khoản sinh viên)
    next();
  });
};

// Hàm tạo refresh token và lưu vào database
function createRefreshToken(userId, userType = 'user', callback) {
  const refreshToken = jwt.sign({ id: userId, type: 'refresh' }, SECRET_KEY, {
    expiresIn: '7d' // Refresh token hết hạn sau 7 ngày
  });

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 ngày

  if (userType === 'librarian') {
    const sql = 'INSERT INTO librarian_refresh_tokens (librarian_id, token, expires_at) VALUES (?, ?, ?)';
    db.query(sql, [userId, refreshToken, expiresAt], (err, result) => {
      if (err) return callback(err);
      callback(null, refreshToken);
    });
  } else {
    const sql = 'INSERT INTO refresh_tokens (user_id, token, expires_at) VALUES (?, ?, ?)';
    db.query(sql, [userId, refreshToken, expiresAt], (err, result) => {
      if (err) return callback(err);
      callback(null, refreshToken);
    });
  }
}

// Hàm xóa refresh token khỏi database
function revokeRefreshToken(token, userType = 'user', callback) {
  if (userType === 'librarian') {
    const sql = 'UPDATE librarian_refresh_tokens SET revoked_at = NOW() WHERE token = ? AND revoked_at IS NULL';
    db.query(sql, [token], callback);
  } else {
    const sql = 'UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = ? AND revoked_at IS NULL';
    db.query(sql, [token], callback);
  }
}

// Hàm kiểm tra refresh token hợp lệ
function verifyRefreshToken(token, callback) {
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) return callback(err);

    // Kiểm tra trong database
    const checkUserSql = 'SELECT * FROM refresh_tokens WHERE token = ? AND revoked_at IS NULL AND expires_at > NOW()';
    db.query(checkUserSql, [token], (err, results) => {
      if (err) return callback(err);
      if (results.length > 0) {
        return callback(null, { userId: results[0].user_id, userType: 'user' });
      }

      // Kiểm tra cho librarian
      const checkLibrarianSql = 'SELECT * FROM librarian_refresh_tokens WHERE token = ? AND revoked_at IS NULL AND expires_at > NOW()';
      db.query(checkLibrarianSql, [token], (err2, results2) => {
        if (err2) return callback(err2);
        if (results2.length > 0) {
          return callback(null, { userId: results2[0].librarian_id, userType: 'librarian' });
        }
        callback(new Error('Refresh token không hợp lệ hoặc đã hết hạn'));
      });
    });
  });
}

// 1. API Đăng nhập - Hỗ trợ cả Librarian và Student
app.post('/api/login', (req, res) => {
  console.log('--- [DEBUG] Yêu cầu Đăng nhập ---');
  console.log('Content-Type Header:', req.headers['content-type']);
  console.log('Dữ liệu Body:', req.body);

  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Vui lòng cung cấp tài khoản và mật khẩu!' });
  }

  const { username, password } = req.body;

  // Thử đăng nhập với Librarian trước
  const librarianSql = 'SELECT * FROM librarians WHERE username = ?';
  db.query(librarianSql, [username], (err, librarianResults) => {
    if (err) return res.status(500).json({ error: err.message });

    // Nếu tìm thấy librarian
    if (librarianResults.length > 0) {
      const user = librarianResults[0];
      const passwordIsValid = bcrypt.compareSync(password, user.password);
      if (!passwordIsValid) return res.status(401).json({ error: 'Mật khẩu không chính xác!' });

      // Tạo access token (ngắn hạn: 15 phút)
      const accessToken = jwt.sign({ id: user.id, username: user.username, role: user.role }, SECRET_KEY, {
        expiresIn: '15m'
      });

      // Tạo refresh token và lưu vào database
      createRefreshToken(user.id, 'librarian', (err, refreshToken) => {
        if (err) return res.status(500).json({ error: 'Lỗi tạo refresh token' });

        // Set refresh token vào http-only cookie
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production', // Chỉ gửi qua HTTPS ở production
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
        });

        return res.json({
          message: 'Đăng nhập thành công!',
          accessToken: accessToken,
          user: { id: user.id, username: user.username, fullName: user.fullName, role: user.role }
        });
      });
    }

    // Nếu không phải librarian, thử đăng nhập với Student (users table)
    const studentSql = `
      SELECT u.*, ud.class_name, r.role_name
      FROM users u
      LEFT JOIN user_details ud ON u.id = ud.user_id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.username = ? AND u.role_id = ?
    `;
    db.query(studentSql, [username, STUDENT_ROLE_ID], (err2, studentResults) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (studentResults.length === 0) return res.status(401).json({ error: 'Tài khoản không tồn tại!' });

      const user = studentResults[0];
      const passwordIsValid = bcrypt.compareSync(password, user.password);
      if (!passwordIsValid) return res.status(401).json({ error: 'Mật khẩu không chính xác!' });

      // Tạo access token (ngắn hạn: 15 phút)
      const accessToken = jwt.sign({ id: user.id, username: user.username, role: 'student' }, SECRET_KEY, {
        expiresIn: '15m'
      });

      // Tạo refresh token và lưu vào database
      createRefreshToken(user.id, 'user', (err, refreshToken) => {
        if (err) return res.status(500).json({ error: 'Lỗi tạo refresh token' });

        // Set refresh token vào http-only cookie
        res.cookie('refreshToken', refreshToken, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 ngày
        });

        return res.json({
          message: 'Đăng nhập thành công!',
          accessToken: accessToken,
          user: {
            id: user.id,
            username: user.username,
            fullName: user.full_name,
            role: 'student',
            email: user.email,
            class: user.class_name
          }
        });
      });
    });
  });
});

// API Refresh Token - Lấy access token mới từ refresh token
app.post('/api/refresh-token', (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (!refreshToken) {
    return res.status(401).json({ error: 'Không tìm thấy refresh token' });
  }

  verifyRefreshToken(refreshToken, (err, tokenData) => {
    if (err) {
      // Xóa cookie nếu refresh token không hợp lệ
      res.clearCookie('refreshToken');
      return res.status(401).json({ error: 'Refresh token không hợp lệ hoặc đã hết hạn' });
    }

    const { userId, userType } = tokenData;

    // Lấy thông tin user để tạo access token mới
    if (userType === 'librarian') {
      const sql = 'SELECT * FROM librarians WHERE id = ?';
      db.query(sql, [userId], (err, results) => {
        if (err || results.length === 0) {
          res.clearCookie('refreshToken');
          return res.status(401).json({ error: 'Không tìm thấy người dùng' });
        }

        const user = results[0];
        const newAccessToken = jwt.sign(
          { id: user.id, username: user.username, role: user.role },
          SECRET_KEY,
          { expiresIn: '15m' }
        );

        res.json({ accessToken: newAccessToken });
      });
    } else {
      const sql = `
        SELECT u.*, ud.class_name
        FROM users u
        LEFT JOIN user_details ud ON u.id = ud.user_id
        WHERE u.id = ?
      `;
      db.query(sql, [userId], (err, results) => {
        if (err || results.length === 0) {
          res.clearCookie('refreshToken');
          return res.status(401).json({ error: 'Không tìm thấy người dùng' });
        }

        const user = results[0];
        const newAccessToken = jwt.sign(
          { id: user.id, username: user.username, role: 'student' },
          SECRET_KEY,
          { expiresIn: '15m' }
        );

        res.json({ accessToken: newAccessToken });
      });
    }
  });
});

// API Logout - Xóa refresh token
app.post('/api/logout', (req, res) => {
  const refreshToken = req.cookies.refreshToken;

  if (refreshToken) {
    // Xóa refresh token khỏi database
    revokeRefreshToken(refreshToken, 'user', (err) => {
      if (err) {
        // Nếu lỗi với user, thử với librarian
        revokeRefreshToken(refreshToken, 'librarian', () => {});
      }
    });

    // Xóa cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
  }

  res.json({ message: 'Đăng xuất thành công!' });
});

// 1.0 Hàm hỗ trợ: Đăng nhập với vai trò Sinh viên (username chính là MSV)
function loginAsStudent(username, password, res) {
  const sql = 'SELECT * FROM students WHERE MSV = ?';
  db.query(sql, [username], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(401).json({ error: 'Tài khoản không tồn tại!' });

    const student = results[0];

    // Sinh viên đăng nhập bằng mật khẩu đã được cấp.
    // Nếu chưa có mật khẩu (null), mặc định dùng chính MSV làm mật khẩu.
    const passwordIsValid = student.password
      ? bcrypt.compareSync(password, student.password)
      : password === student.MSV;
    if (!passwordIsValid) return res.status(401).json({ error: 'Mật khẩu không chính xác!' });

    const token = jwt.sign(
      { id: student.MSV, MSV: student.MSV, role: 'student' },
      SECRET_KEY,
      { expiresIn: 7200 }
    );

    res.json({
      message: 'Đăng nhập thành công!',
      accessToken: token,
      user: { id: student.MSV, MSV: student.MSV, username: student.MSV, fullName: student.fullName, class: student.class, email: student.email, role: 'student' }
    });
  });
}

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
app.get('/api/books', (req, res) => {
  console.log('--- [DEBUG] GET /api/books ---');
  console.log('Query params:', req.query);

  // Sử dụng tên column đúng theo database schema
  const sql = 'SELECT id, title, isbn, author, published_year, category_id, status FROM books LIMIT 100';
  
  console.log('SQL:', sql);

  db.query(sql, (err, results) => {
    if (err) {
      console.error('❌ Lỗi books:', err.message);
      return res.status(500).json({ error: err.message });
    }
    
    console.log('✅ Trả về', results.length, 'sách');
    if (results.length > 0) {
      console.log('Sample book:', results[0]);
    }
    
    // Map column names để khớp với frontend
    const mappedResults = results.map(book => ({
      IdBook: book.id,
      nameBook: book.title,
      isbn: book.isbn,
      author: book.author,
      year: book.published_year,
      category: book.category_id,
      status: book.status
    }));
    
    res.json(mappedResults);
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

// 1.2b API Lấy các bản sao theo thông tin đầu sách (title + author + year + category)
app.get('/api/books/copies-by-title', (req, res) => {
  const { title, author, year, category } = req.query;

  if (!title || !author) {
    return res.status(400).json({ error: 'Thiếu thông tin title hoặc author!' });
  }

  const sql = `
    SELECT id AS IdBook, title AS nameBook, author, published_year AS year,
           category_id AS category, status, isbn
    FROM books
    WHERE title = ? AND author = ? AND published_year = ? AND category_id = ?
    ORDER BY id ASC
  `;

  db.query(sql, [title, author, parseInt(year), parseInt(category)], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 1.2b API Lấy danh sách thể loại
app.get('/api/categories', (req, res) => {
  const sql = 'SELECT id, category_name FROM categories ORDER BY category_name ASC';
  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 1.2c API Danh sách đầu sách (gom theo title + author + year + category)
app.get('/api/books/grouped', (req, res) => {
  const sql = `
    SELECT
      title,
      author,
      published_year,
      category_id,
      COUNT(*) AS totalCopies,
      SUM(CASE WHEN status = 1 THEN 1 ELSE 0 END) AS availableCopies,
      MIN(CASE WHEN status = 1 THEN id END) AS availableBookId,
      MIN(id) AS sampleId
    FROM books
    GROUP BY title, author, published_year, category_id
    ORDER BY title ASC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });

    // Lấy tên thể loại từ bảng categories
    const categoryIds = [...new Set(results.map(r => r.category_id))];
    const placeholders = categoryIds.map(() => '?').join(',');

    db.query(`SELECT id, category_name FROM categories WHERE id IN (${placeholders})`, categoryIds, (err2, categories) => {
      if (err2) return res.status(500).json({ error: err2.message });

      const categoryMap = {};
      categories.forEach(c => categoryMap[c.id] = c.category_name);

      const mapped = results.map(row => ({
        title: row.title,
        author: row.author,
        year: row.published_year,
        categoryId: row.category_id,
        category: categoryMap[row.category_id] || 'Khác',
        totalCopies: row.totalCopies,
        availableCopies: row.availableCopies,
        isAvailable: row.availableCopies > 0,
        sampleId: row.availableBookId || row.sampleId
      }));

      res.json(mapped);
    });
  });
});

// 1.2d Cập nhật thông tin đầu sách (tất cả bản sao cùng nhóm)
app.put('/api/books/group', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const {
    oldTitle, oldAuthor, oldYear, oldCategory,
    nameBook, author, year, category
  } = req.body;

  const newTitle = sanitizeInput(nameBook);
  const newAuthor = sanitizeInput(author);
  const newYear = parseInt(year);
  const newCategory = parseInt(category);

  const sql = `
    UPDATE books
    SET title = ?, author = ?, published_year = ?, category_id = ?
    WHERE title = ? AND author = ? AND published_year = ? AND category_id = ?
  `;

  db.query(
    sql,
    [newTitle, newAuthor, newYear, newCategory, oldTitle, oldAuthor, parseInt(oldYear), parseInt(oldCategory)],
    (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      if (result.affectedRows === 0) return res.status(404).json({ message: 'Không tìm thấy đầu sách' });
      res.json({ message: 'Cập nhật đầu sách thành công!', count: result.affectedRows });
    }
  );
});

// 2. Thêm một cuốn sách mới (mặc định status sẽ là 1 - có sẵn)
// Thêm verifyToken để chỉ thủ thư mới được thêm sách
app.post('/api/books', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  // Map frontend field names to database column names
  const title = sanitizeInput(req.body.nameBook);
  const author = sanitizeInput(req.body.author);
  const isbn = sanitizeInput(req.body.isbn || '');
  const published_year = parseInt(req.body.year);
  const categoryInput = req.body.category; // Có thể là ID (số) hoặc tên thể loại (chuỗi)
  const quantity = parseInt(req.body.quantity) || 1;

  // Xử lý category: nếu là số thì lấy ID, nếu là chuỗi thì tìm hoặc tạo mới
  const handleCategory = (callback) => {
    // Nếu categoryInput là số, coi như category_id
    if (!isNaN(parseInt(categoryInput))) {
      return callback(null, parseInt(categoryInput));
    }

    // Nếu là chuỗi, tìm trong bảng categories
    const categoryName = sanitizeInput(categoryInput);
    db.query('SELECT id FROM categories WHERE category_name = ?', [categoryName], (err, results) => {
      if (err) return callback(err);

      if (results.length > 0) {
        // Đã tồn tại, trả về ID
        return callback(null, results[0].id);
      }

      // Chưa tồn tại, insert mới
      db.query('INSERT INTO categories (category_name) VALUES (?)', [categoryName], (err2, result) => {
        if (err2) return callback(err2);
        callback(null, result.insertId);
      });
    });
  };

  handleCategory((err, category_id) => {
    if (err) return res.status(500).json({ error: err.message });

    // Tạo mảng dữ liệu để insert hàng loạt (bulk insert)
    const values = [];
    for (let i = 0; i < quantity; i++) {
      values.push([title, isbn, author, published_year, category_id, 1]); // Thêm '1' cho status (Sẵn sàng)
    }

    const sql = 'INSERT INTO books (title, isbn, author, published_year, category_id, status) VALUES ?';
    
    db.query(sql, [values], (err, result) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: `Đã thêm thành công ${quantity} quyển sách!`, count: result.affectedRows });
    });
  });
});

// 2.1 Cập nhật thông tin chi tiết của một cuốn sách dựa trên ID
// Thêm verifyToken để bảo vệ thao tác sửa sách
app.put('/api/books/:id', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const id = req.params.id;
  // Map frontend field names to database column names
  const title = sanitizeInput(req.body.nameBook);
  const author = sanitizeInput(req.body.author);
  const published_year = parseInt(req.body.year);
  const category_id = parseInt(req.body.category);

  const sql = 'UPDATE books SET title = ?, author = ?, published_year = ?, category_id = ? WHERE id = ?';
  
  db.query(sql, [title, author, published_year, category_id, id], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    if (result.affectedRows === 0) return res.status(404).json({ message: 'Không tìm thấy sách' });
    res.json({ message: 'Cập nhật thông tin sách thành công!' });
  });
});

// 2.3 Lấy toàn bộ danh sách sinh viên (từ bảng users + user_details)
app.get('/api/students', (req, res) => {
  console.log('--- [DEBUG] GET /api/students ---');

  const sql = `
    SELECT u.username AS MSV, u.full_name AS fullName, ud.class_name AS class, u.email
    FROM users u
    LEFT JOIN user_details ud ON u.id = ud.user_id
    WHERE u.role_id = ?
    ORDER BY u.username
    LIMIT 100
  `;

  db.query(sql, [STUDENT_ROLE_ID], (err, results) => {
    if (err) {
      console.error('❌ Lỗi students:', err.message);
      return res.status(500).json({ error: err.message });
    }

    console.log('✅ Trả về', results.length, 'sinh viên');
    res.json(results);
  });
});

// 2.4 Thêm sinh viên mới (users + user_details)
app.post('/api/students', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  if (!req.body || Object.keys(req.body).length === 0) {
    return res.status(400).json({ error: 'Dữ liệu sinh viên không được để trống!' });
  }

  const MSV = sanitizeInput(req.body.MSV || '');
  const fullName = sanitizeInput(req.body.fullName || '');
  const className = sanitizeInput(req.body.class || '');
  const email = sanitizeInput(req.body.email || '');
  const defaultPassword = bcrypt.hashSync('123456', 8);

  const insertUserSql = `
    INSERT INTO users (username, password, full_name, email, role_id)
    VALUES (?, ?, ?, ?, ?)
  `;

  db.query(insertUserSql, [MSV, defaultPassword, fullName, email, STUDENT_ROLE_ID], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(400).json({ error: 'Mã sinh viên hoặc email đã tồn tại!' });
      }
      return res.status(500).json({ error: err.message });
    }

    const userId = result.insertId;
    db.query(
      'INSERT INTO user_details (user_id, class_name) VALUES (?, ?)',
      [userId, className],
      (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });
        res.json({ message: 'Thêm sinh viên thành công!' });
      }
    );
  });
});

// 2.5 Cập nhật thông tin sinh viên
app.put('/api/students/:msv', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const oldMsv = req.params.msv;
  const MSV = sanitizeInput(req.body.MSV);
  const fullName = sanitizeInput(req.body.fullName);
  const className = sanitizeInput(req.body.class);
  const email = sanitizeInput(req.body.email);

  db.query(
    'SELECT id FROM users WHERE username = ? AND role_id = ?',
    [oldMsv, STUDENT_ROLE_ID],
    (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) return res.status(404).json({ message: 'Không tìm thấy sinh viên' });

      const userId = results[0].id;
      const updateUserSql = 'UPDATE users SET username = ?, full_name = ?, email = ? WHERE id = ?';

      db.query(updateUserSql, [MSV, fullName, email, userId], (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });

        db.query(
          'INSERT INTO user_details (user_id, class_name) VALUES (?, ?) ON DUPLICATE KEY UPDATE class_name = ?',
          [userId, className, className],
          (err3) => {
            if (err3) return res.status(500).json({ error: err3.message });
            res.json({ message: 'Cập nhật sinh viên thành công!' });
          }
        );
      });
    }
  );
});

// 2.6 Xóa sinh viên (có kiểm tra ràng buộc mượn sách)
app.delete('/api/students/:msv', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const msv = req.params.msv;

  resolveUserIdFromMSV(msv, (err, userId) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!userId) return res.status(404).json({ error: 'Không tìm thấy sinh viên!' });

    const checkSql = 'SELECT COUNT(*) as count FROM borrow_books WHERE user_id = ? AND status = 1';
    db.query(checkSql, [userId], (err2, results) => {
      if (err2) return res.status(500).json({ error: err2.message });

      if (results[0].count > 0) {
        return res.status(400).json({ error: 'Không thể xóa sinh viên này vì đang có thẻ mượn sách chưa trả!' });
      }

      db.query('DELETE FROM user_details WHERE user_id = ?', [userId], () => {
        db.query('DELETE FROM users WHERE id = ?', [userId], (err3) => {
          if (err3) return res.status(500).json({ error: err3.message });
          res.json({ message: 'Xóa sinh viên thành công!' });
        });
      });
    });
  });
});

// 2.2 Lấy thông tin sinh viên theo MSV
app.get('/api/students/:msv', (req, res) => {
  const msv = req.params.msv;
  const sql = `
    SELECT u.username AS MSV, u.full_name AS fullName, ud.class_name AS class, u.email
    FROM users u
    LEFT JOIN user_details ud ON u.id = ud.user_id
    WHERE u.username = ? AND u.role_id = ?
  `;

  db.query(sql, [msv, STUDENT_ROLE_ID], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length > 0) return res.json(results[0]);

    db.query('SELECT MSV, fullName, class, email FROM students WHERE MSV = ?', [msv], (err2, legacy) => {
      if (err2) return res.status(500).json({ error: err2.message });
      if (legacy.length === 0) return res.status(404).json({ message: 'Không tìm thấy sinh viên' });
      res.json(legacy[0]);
    });
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

// 5. Lấy danh sách thẻ mượn kèm theo tên sách (bảng borrow_books)
app.get('/api/borrows', (req, res) => {
  console.log('--- [DEBUG] GET /api/borrows ---');

  const sql = `
    SELECT 
      bb.id AS IdRent,
      u.username AS MSV,
      bb.book_id AS IdBook,
      DATE_FORMAT(bb.borrow_date, '%Y-%m-%d') AS timeStart,
      DATE_FORMAT(bb.due_date, '%Y-%m-%d') AS timeEnd,
      DATE_FORMAT(bb.return_date, '%Y-%m-%d') AS returnActualDate,
      b.title AS nameBook,
      u.full_name AS fullName,
      ud.class_name AS class
    FROM borrow_books bb
    JOIN books b ON bb.book_id = b.id
    JOIN users u ON bb.user_id = u.id
    LEFT JOIN user_details ud ON u.id = ud.user_id
    WHERE bb.status = 1
    ORDER BY bb.borrow_date DESC
  `;

  db.query(sql, (err, results) => {
    if (err) {
      console.error('❌ Lỗi borrows:', err.message);
      return res.status(500).json({ error: err.message });
    }

    console.log('✅ Trả về', results.length, 'thẻ mượn');
    res.json(results);
  });
});

// 6. Lập thẻ mượn mới: Tạo record mượn và cập nhật status sách sang 0
app.post('/api/borrows', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const { IdBook, MSV, borrow_date, due_date } = req.body;
  const librarianId = req.userId;

  // Sử dụng ngày từ frontend nếu có, nếu không thì dùng mặc định
  const finalBorrowDate = borrow_date ? new Date(borrow_date) : new Date();
  const finalDueDate = due_date ? new Date(due_date) : new Date();
  
  // Nếu không có due_date từ frontend, set mặc định +14 ngày
  if (!due_date) {
    finalDueDate.setDate(finalBorrowDate.getDate() + 14);
  }

  resolveUserIdFromMSV(MSV, (err, userId) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!userId) return res.status(404).json({ error: 'Không tìm thấy sinh viên với MSV này!' });

    const sql = `
      INSERT INTO borrow_books (book_id, user_id, librarian_id, borrow_date, due_date, status)
      VALUES (?, ?, ?, ?, ?, 1)
    `;

    db.query(sql, [IdBook, userId, librarianId, finalBorrowDate, finalDueDate], (err2, result) => {
      if (err2) return res.status(500).json({ error: err2.message });

      db.query('UPDATE books SET status = 0 WHERE id = ?', [IdBook], (err3) => {
        if (err3) return res.status(500).json({ error: err3.message });
        res.json({ message: 'Tạo thẻ mượn thành công!', IdRent: result.insertId });
      });
    });
  });
});

// 5.1 API: Sinh viên xem lịch sử mượn sách của chính mình (cả đang mượn lẫn đã trả)
app.get('/api/my-borrows', verifyToken, authorize(['student']), (req, res) => {
  const userId = req.userId;
  if (!userId) return res.status(400).json({ error: 'Không xác định được người dùng từ tài khoản.' });

  const sql = `
    SELECT 
      bb.id AS IdRent,
      bb.book_id AS IdBook,
      DATE_FORMAT(bb.borrow_date, '%Y-%m-%d') AS timeStart,
      DATE_FORMAT(bb.due_date, '%Y-%m-%d') AS timeEnd,
      DATE_FORMAT(bb.return_date, '%Y-%m-%d') AS returnActualDate,
      bb.status,
      b.title AS nameBook,
      b.author
    FROM borrow_books bb
    JOIN books b ON bb.book_id = b.id
    WHERE bb.user_id = ?
    ORDER BY bb.status DESC, bb.borrow_date DESC
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ data: results, totalItems: results.length });
  });
});

// 5. API: Xử lý trả sách
app.patch('/api/borrows/:id/return', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const idRent = req.params.id;
  const returnDate = new Date();

  db.query('SELECT book_id FROM borrow_books WHERE id = ?', [idRent], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Không tìm thấy thẻ mượn' });
    const idBook = results[0].book_id;

    const updateBorrowSql = 'UPDATE borrow_books SET status = 0, return_date = ? WHERE id = ?';
    db.query(updateBorrowSql, [returnDate, idRent], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      db.query('UPDATE books SET status = 1 WHERE id = ?', [idBook], (err3) => {
        if (err3) return res.status(500).json({ error: err3.message });
        res.json({ message: 'Trả sách và cập nhật trạng thái kho thành công!' });
      });
    });
  });
});

// 5.1. API: Xóa thẻ mượn (DELETE) - thực chất là trả sách
app.delete('/api/borrows/:id', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const idRent = req.params.id;
  const returnDate = new Date();

  db.query('SELECT book_id FROM borrow_books WHERE id = ?', [idRent], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ message: 'Không tìm thấy thẻ mượn' });
    const idBook = results[0].book_id;

    const updateBorrowSql = 'UPDATE borrow_books SET status = 0, return_date = ? WHERE id = ?';
    db.query(updateBorrowSql, [returnDate, idRent], (err2) => {
      if (err2) return res.status(500).json({ error: err2.message });
      db.query('UPDATE books SET status = 1 WHERE id = ?', [idBook], (err3) => {
        if (err3) return res.status(500).json({ error: err3.message });
        res.json({ message: 'Trả sách thành công!' });
      });
    });
  });
});

// 6. API: Lịch sử mượn sách (tất cả records)
app.get('/api/borrows/history', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const sql = `
    SELECT 
      bb.id AS IdRent,
      u.username AS MSV,
      bb.book_id AS IdBook,
      DATE_FORMAT(bb.borrow_date, '%Y-%m-%d') AS timeStart,
      DATE_FORMAT(bb.due_date, '%Y-%m-%d') AS timeEnd,
      DATE_FORMAT(bb.return_date, '%Y-%m-%d') AS returnDate,
      bb.status,
      b.title AS nameBook,
      u.full_name AS fullName,
      ud.class_name AS class
    FROM borrow_books bb
    JOIN books b ON bb.book_id = b.id
    JOIN users u ON bb.user_id = u.id
    LEFT JOIN user_details ud ON u.id = ud.user_id
    ORDER BY bb.borrow_date DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 6.1 API: Lịch sử mượn sách của sinh viên cụ thể
app.get('/api/students/:msv/borrows', verifyToken, (req, res) => {
  const msv = req.params.msv;

  resolveUserIdFromMSV(msv, (err, userId) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!userId) return res.status(404).json({ error: 'Không tìm thấy sinh viên' });

    const sql = `
      SELECT 
        bb.id AS IdRent,
        DATE_FORMAT(bb.borrow_date, '%Y-%m-%d') AS timeStart,
        DATE_FORMAT(bb.due_date, '%Y-%m-%d') AS timeEnd,
        DATE_FORMAT(bb.return_date, '%Y-%m-%d') AS returnDate,
        bb.status,
        b.title AS nameBook,
        b.author
      FROM borrow_books bb
      JOIN books b ON bb.book_id = b.id
      WHERE bb.user_id = ?
      ORDER BY bb.borrow_date DESC
    `;

    db.query(sql, [userId], (err2, results) => {
      if (err2) return res.status(500).json({ error: err2.message });
      res.json(results);
    });
  });
});

// 6.2 API: Yêu cầu mượn sách (Borrow Requests)
app.get('/api/borrow-requests', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const sql = `
    SELECT 
      br.id,
      br.book_id,
      br.user_id,
      br.request_date AS requestDate,
      br.status,
      u.username AS MSV,
      u.full_name AS fullName,
      b.title AS bookTitle,
      u.email AS studentEmail
    FROM borrow_requests br
    JOIN books b ON br.book_id = b.id
    JOIN users u ON br.user_id = u.id
    ORDER BY br.request_date DESC
  `;

  db.query(sql, (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

app.post('/api/borrow-requests', verifyToken, (req, res) => {
  const { IdBook, borrow_date, due_date } = req.body;
  const userId = req.userId;

  const sql = 'INSERT INTO borrow_requests (book_id, user_id, borrow_date, due_date, status) VALUES (?, ?, ?, ?, "pending")';
  db.query(sql, [IdBook, userId, borrow_date, due_date], (err, result) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Gửi yêu cầu mượn sách thành công!', id: result.insertId });
  });
});

app.put('/api/borrow-requests/:id/approve', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const id = req.params.id;

  db.query('SELECT * FROM borrow_requests WHERE id = ?', [id], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length === 0) return res.status(404).json({ error: 'Không tìm thấy yêu cầu' });

    const request = results[0];
    
    // Use dates from request if available, otherwise use defaults
    const borrowDate = request.borrow_date ? new Date(request.borrow_date) : new Date();
    const dueDate = request.due_date ? new Date(request.due_date) : new Date();
    
    // If no due_date from request, set default +14 days
    if (!request.due_date) {
      dueDate.setDate(borrowDate.getDate() + 14);
    }

    db.query(
      'UPDATE borrow_requests SET status = "approved", approved_by = ?, approved_date = NOW() WHERE id = ?',
      [req.userId, id],
      (err2) => {
        if (err2) return res.status(500).json({ error: err2.message });

        const borrowSql = `
          INSERT INTO borrow_books (book_id, user_id, librarian_id, borrow_date, due_date, status)
          VALUES (?, ?, ?, ?, ?, 1)
        `;
        db.query(
          borrowSql,
          [request.book_id, request.user_id, req.userId, borrowDate, dueDate],
          (err3) => {
            if (err3) return res.status(500).json({ error: err3.message });

            db.query('UPDATE books SET status = 0 WHERE id = ?', [request.book_id], (err4) => {
              if (err4) return res.status(500).json({ error: err4.message });
              res.json({ message: 'Đã duyệt yêu cầu và tạo thẻ mượn!' });
            });
          }
        );
      }
    );
  });
});

app.put('/api/borrow-requests/:id/reject', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const id = req.params.id;
  
  db.query('UPDATE borrow_requests SET status = "rejected", approved_date = NOW() WHERE id = ?', [id], (err) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ message: 'Đã từ chối yêu cầu mượn sách!' });
  });
});

// 6.2b API: Sinh viên xem lịch sử yêu cầu mượn của chính mình
app.get('/api/my-borrow-requests', verifyToken, authorize(['student']), (req, res) => {
  const userId = req.userId;

  const sql = `
    SELECT
      br.id,
      br.status,
      DATE_FORMAT(br.request_date, '%Y-%m-%d %H:%i') AS requestDate,
      DATE_FORMAT(br.borrow_date,  '%Y-%m-%d')        AS borrowDate,
      DATE_FORMAT(br.due_date,     '%Y-%m-%d')        AS dueDate,
      DATE_FORMAT(br.approved_date,'%Y-%m-%d %H:%i') AS approvedDate,
      b.title  AS bookTitle,
      b.author AS bookAuthor
    FROM borrow_requests br
    JOIN books b ON br.book_id = b.id
    WHERE br.user_id = ?
    ORDER BY br.request_date DESC
  `;

  db.query(sql, [userId], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json(results);
  });
});

// 6.3 API: Đăng ký sinh viên (users + user_details)
app.post('/api/students/register', (req, res) => {
  const { MSV, fullName, class: studentClass, email, password } = req.body;

  db.query('SELECT id FROM users WHERE username = ?', [MSV], (err, results) => {
    if (err) return res.status(500).json({ error: err.message });
    if (results.length > 0) return res.status(400).json({ error: 'Mã sinh viên đã tồn tại!' });

    const hashedPassword = bcrypt.hashSync(password, 8);
    const insertUserSql = `
      INSERT INTO users (username, password, full_name, email, role_id)
      VALUES (?, ?, ?, ?, ?)
    `;

    db.query(insertUserSql, [MSV, hashedPassword, fullName, email, STUDENT_ROLE_ID], (err2, result) => {
      if (err2) return res.status(500).json({ error: err2.message });

      db.query(
        'INSERT INTO user_details (user_id, class_name) VALUES (?, ?)',
        [result.insertId, studentClass],
        (err3) => {
          if (err3) return res.status(500).json({ error: err3.message });
          res.json({ message: 'Đăng ký thành công!' });
        }
      );
    });
  });
});

// 6.3x API: Lấy thông tin profile của người dùng hiện tại
app.get('/api/profile', verifyToken, (req, res) => {
  const userId = req.userId;
  const userRole = req.userRole;

  // Nếu là admin hoặc librarian
  if (userRole === 'admin' || userRole === 'librarian') {
    const sql = 'SELECT id, username, fullName, role FROM librarians WHERE id = ?';
    db.query(sql, [userId], (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) return res.status(404).json({ error: 'Không tìm thấy thông tin người dùng!' });

      const librarian = results[0];
      return res.json({
        username: librarian.username,
        fullName: librarian.fullName,
        role: librarian.role,
        email: null // Librarians không có email trong schema hiện tại
      });
    });
  }
  // Nếu là sinh viên
  else if (userRole === 'student') {
    const sql = `
      SELECT u.username AS MSV, u.full_name AS fullName, ud.class_name AS class, u.email, u.role_id
      FROM users u
      LEFT JOIN user_details ud ON u.id = ud.user_id
      WHERE u.id = ? AND u.role_id = ?
    `;

    db.query(sql, [userId, STUDENT_ROLE_ID], (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) return res.status(404).json({ error: 'Không tìm thấy sinh viên!' });

      const student = results[0];
      return res.json({
        MSV: student.MSV,
        username: student.MSV,
        fullName: student.fullName,
        class: student.class,
        email: student.email,
        role: 'student'
      });
    });
  } else {
    return res.status(403).json({ error: 'Vai trò không hợp lệ!' });
  }
});

// 6.3y API: Cập nhật profile của người dùng hiện tại
app.put('/api/profile', verifyToken, (req, res) => {
  const userId = req.userId;
  const userRole = req.userRole;
  const { fullName, email, currentPassword, newPassword, class: studentClass } = req.body;

  // Hàm kiểm tra và đổi mật khẩu cho librarian
  function updateLibrarianProfile(hashedPassword = null) {
    let updateSql;
    let params;

    if (hashedPassword) {
      updateSql = 'UPDATE librarians SET fullName = ?, password = ? WHERE id = ?';
      params = [fullName, hashedPassword, userId];
    } else {
      updateSql = 'UPDATE librarians SET fullName = ? WHERE id = ?';
      params = [fullName, userId];
    }

    db.query(updateSql, params, (err) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ message: 'Cập nhật thông tin thành công!' });
    });
  }

  // Hàm kiểm tra và đổi mật khẩu cho student
  function updateStudentProfile(hashedPassword = null) {
    let updateSql;
    let params;

    if (hashedPassword) {
      updateSql = 'UPDATE users SET full_name = ?, email = ?, password = ? WHERE id = ?';
      params = [fullName, email, hashedPassword, userId];
    } else {
      updateSql = 'UPDATE users SET full_name = ?, email = ? WHERE id = ?';
      params = [fullName, email, userId];
    }

    db.query(updateSql, params, (err) => {
      if (err) return res.status(500).json({ error: err.message });

      // Cập nhật class nếu có
      const safeClass = studentClass !== undefined ? studentClass : null;
      db.query(
        'INSERT INTO user_details (user_id, class_name) VALUES (?, ?) ON DUPLICATE KEY UPDATE class_name = ?',
        [userId, safeClass, safeClass],
        (err2) => {
          if (err2) return res.status(500).json({ error: err2.message });
          res.json({ message: 'Cập nhật thông tin thành công!' });
        }
      );
    });
  }

  // Xử lý cho admin/librarian
  if (userRole === 'admin' || userRole === 'librarian') {
    if (currentPassword && newPassword) {
      // Kiểm tra mật khẩu hiện tại
      db.query('SELECT password FROM librarians WHERE id = ?', [userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'Không tìm thấy người dùng!' });

        const passwordIsValid = bcrypt.compareSync(currentPassword, results[0].password);
        if (!passwordIsValid) return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng!' });

        const hashedPassword = bcrypt.hashSync(newPassword, 8);
        updateLibrarianProfile(hashedPassword);
      });
    } else if (currentPassword || newPassword) {
      return res.status(400).json({ error: 'Vui lòng nhập cả mật khẩu hiện tại và mật khẩu mới!' });
    } else {
      updateLibrarianProfile();
    }
  }
  // Xử lý cho student
  else if (userRole === 'student') {
    if (currentPassword && newPassword) {
      // Kiểm tra mật khẩu hiện tại
      db.query('SELECT password FROM users WHERE id = ?', [userId], (err, results) => {
        if (err) return res.status(500).json({ error: err.message });
        if (results.length === 0) return res.status(404).json({ error: 'Không tìm thấy người dùng!' });

        const passwordIsValid = bcrypt.compareSync(currentPassword, results[0].password);
        if (!passwordIsValid) return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng!' });

        const hashedPassword = bcrypt.hashSync(newPassword, 8);
        updateStudentProfile(hashedPassword);
      });
    } else if (currentPassword || newPassword) {
      return res.status(400).json({ error: 'Vui lòng nhập cả mật khẩu hiện tại và mật khẩu mới!' });
    } else {
      updateStudentProfile();
    }
  } else {
    return res.status(403).json({ error: 'Vai trò không hợp lệ!' });
  }
});

// 6.3a API: Sinh viên tự cập nhật profile (không cần quyền admin)
app.put('/api/students/:msv/profile', verifyToken, (req, res) => {
  const msv = req.params.msv;
  const { fullName, class: studentClass, email, currentPassword, newPassword } = req.body;

  // Kiểm tra xem user có quyền cập nhật profile này không
  if (req.userRole !== 'student' && req.userRole !== 'admin' && req.userRole !== 'librarian') {
    return res.status(403).json({ error: 'Bạn không có quyền cập nhật profile!' });
  }

  // Nếu là sinh viên, chỉ cho phép cập nhật profile của chính mình
  if (req.userRole === 'student') {
    db.query('SELECT username FROM users WHERE id = ? AND role_id = ?', [req.userId, STUDENT_ROLE_ID], (err, results) => {
      if (err) return res.status(500).json({ error: err.message });
      if (results.length === 0) return res.status(403).json({ error: 'Không tìm thấy user!' });
      if (results[0].username !== msv) return res.status(403).json({ error: 'Bạn chỉ có thể cập nhật profile của chính mình!' });

      performUpdate(req.userId);
    });
  } else if (req.userRole === 'admin' || req.userRole === 'librarian') {
    // Admin/Librarian có thể cập nhật profile của sinh viên khác
    resolveUserIdFromMSV(msv, (err, userId) => {
      if (err) return res.status(500).json({ error: err.message });
      if (!userId) return res.status(404).json({ error: 'Không tìm thấy sinh viên!' });
      performUpdate(userId);
    });
  } else {
    return res.status(403).json({ error: 'Bạn không có quyền cập nhật profile!' });
  }

  function performUpdate(userId) {
    // Xử lý đổi mật khẩu nếu có
    if (currentPassword && newPassword) {
      db.query('SELECT password FROM users WHERE id = ?', [userId], (err2, userResults) => {
        if (err2) return res.status(500).json({ error: err2.message });
        if (userResults.length === 0) return res.status(404).json({ error: 'Không tìm thấy user!' });

        const passwordIsValid = bcrypt.compareSync(currentPassword, userResults[0].password);
        if (!passwordIsValid) return res.status(401).json({ error: 'Mật khẩu hiện tại không đúng!' });

        const hashedNewPassword = bcrypt.hashSync(newPassword, 8);
        updateProfileWithPassword(hashedNewPassword, userId);
      });
    } else if (currentPassword || newPassword) {
      return res.status(400).json({ error: 'Vui lòng nhập cả mật khẩu hiện tại và mật khẩu mới!' });
    } else {
      updateProfileWithoutPassword(userId);
    }
  }

  function updateProfileWithPassword(hashedNewPassword, userId) {
    const updateUserSql = 'UPDATE users SET full_name = ?, email = ?, password = ? WHERE id = ?';
    db.query(updateUserSql, [fullName, email, hashedNewPassword, userId], (err3) => {
      if (err3) return res.status(500).json({ error: err3.message });

      const safeClass = studentClass !== undefined ? studentClass : null;
      db.query(
        'INSERT INTO user_details (user_id, class_name) VALUES (?, ?) ON DUPLICATE KEY UPDATE class_name = ?',
        [userId, safeClass, safeClass],
        (err4) => {
          if (err4) return res.status(500).json({ error: err4.message });
          res.json({ message: 'Cập nhật profile thành công!' });
        }
      );
    });
  }

  function updateProfileWithoutPassword(userId) {
    const updateUserSql = 'UPDATE users SET full_name = ?, email = ? WHERE id = ?';
    db.query(updateUserSql, [fullName, email, userId], (err3) => {
      if (err3) return res.status(500).json({ error: err3.message });

      const safeClass = studentClass !== undefined ? studentClass : null;
      db.query(
        'INSERT INTO user_details (user_id, class_name) VALUES (?, ?) ON DUPLICATE KEY UPDATE class_name = ?',
        [userId, safeClass, safeClass],
        (err4) => {
          if (err4) return res.status(500).json({ error: err4.message });
          res.json({ message: 'Cập nhật profile thành công!' });
        }
      );
    });
  }
});

// Khởi tạo Nodemailer Transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// 6.4b API: Trạng thái cron job
app.get('/api/cron-status', verifyToken, authorize(['admin']), (req, res) => {
  res.json({
    isRunning: true,
    schedule: 'Mỗi ngày lúc 08:00 sáng',
    timezone: 'Asia/Ho_Chi_Minh',
    cronExpression: '0 8 * * *',
    nextRun: getNextRun()
  });
});

function getNextRun() {
  const now = new Date();
  const next = new Date();
  next.setHours(8, 0, 0, 0);
  if (now >= next) next.setDate(next.getDate() + 1); // nếu đã qua 8:00 hôm nay → ngày mai
  return next.toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
}

// 6.4 API: Gửi email nhắc nhở (thủ công - tái sử dụng sendReminderEmailsJob)
app.post('/api/send-reminder-emails', verifyToken, authorize(['admin']), async (req, res) => {
  const { limit } = req.body;
  try {
    const result = await sendReminderEmailsJob(limit || null);
    if (result.successCount === 0 && result.failedCount === 0) {
      return res.json({
        message: 'Không có sinh viên nào sắp đến hạn trả sách (trước 1 ngày).',
        successCount: 0, failedCount: 0, successes: [], failures: []
      });
    }
    res.json({
      message: `Hoàn tất. Thành công: ${result.successCount}, Thất bại: ${result.failedCount}`,
      successCount: result.successCount,
      failedCount:  result.failedCount,
      successes: result.successes.map(s => ({
        studentEmail: s.studentEmail,
        bookTitle:    s.bookTitle,
        dueDate:      '',
        status:       'success'
      })),
      failures: result.failures.map(f => ({
        studentEmail: f.studentEmail,
        bookTitle:    '',
        dueDate:      '',
        status:       'error',
        error:        f.error
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6.5 API: Gửi email tùy chỉnh cho sinh viên cụ thể
app.post('/api/send-custom-email', verifyToken, authorize(['admin', 'librarian']), async (req, res) => {
  const { studentMSVs, subject, message: emailMessage } = req.body;
  // studentMSVs có thể là string (1 MSV) hoặc array (nhiều MSV) hoặc 'all'

  if (!subject || !emailMessage) {
    return res.status(400).json({ error: 'Vui lòng điền đầy đủ Tiêu đề và Nội dung!' });
  }

  // Chuẩn hóa danh sách MSV
  let msvList = [];
  if (studentMSVs === 'all') {
    // Lấy tất cả sinh viên có email
    const allSql = `SELECT u.username AS MSV, u.full_name AS fullName, u.email FROM users u WHERE u.role_id = ? AND u.email IS NOT NULL AND u.email != ''`;
    const [allRows] = await new Promise((resolve, reject) => {
      db.query(allSql, [STUDENT_ROLE_ID], (err, results) => {
        if (err) reject(err);
        else resolve([results]);
      });
    });
    msvList = allRows;
  } else {
    const msvsArray = Array.isArray(studentMSVs) ? studentMSVs : [studentMSVs];
    if (msvsArray.length === 0) {
      return res.status(400).json({ error: 'Vui lòng chọn ít nhất 1 sinh viên!' });
    }
    // Lấy thông tin từng MSV
    const placeholders = msvsArray.map(() => '?').join(',');
    const sql = `SELECT u.username AS MSV, u.full_name AS fullName, u.email FROM users u WHERE u.username IN (${placeholders}) AND u.role_id = ?`;
    const [rows] = await new Promise((resolve, reject) => {
      db.query(sql, [...msvsArray, STUDENT_ROLE_ID], (err, results) => {
        if (err) reject(err);
        else resolve([results]);
      });
    });
    msvList = rows;
  }

  if (msvList.length === 0) {
    return res.status(404).json({ error: 'Không tìm thấy sinh viên nào có email hợp lệ!' });
  }

  // Tách riêng người có email và không có email
  const withEmail    = msvList.filter(s => s.email);
  const withoutEmail = msvList.filter(s => !s.email).map(s => ({
    studentEmail: '(không có email)', studentName: s.fullName, MSV: s.MSV, error: 'Chưa có email'
  }));

  // Gửi song song theo batch 5 — nhanh hơn tuần tự, an toàn với Gmail
  const { successes, failures } = await sendInBatches(withEmail, async (student) => {
    const mailOptions = {
      from: `"Thư Viện FPT" <${process.env.EMAIL_USER}>`,
      to:   student.email,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
          <h2 style="color: #42b983;">Xin chào ${student.fullName} (MSV: ${student.MSV}),</h2>
          <div style="margin: 20px 0; line-height: 1.6;">${emailMessage.replace(/\n/g, '<br/>')}</div>
          <br/><p>Trân trọng,</p>
          <p><strong>Ban Quản Trị Thư Viện FPT</strong></p>
        </div>
      `
    };
    await transporter.sendMail(mailOptions);
    return { studentEmail: student.email, studentName: student.fullName, MSV: student.MSV, status: 'success' };
  });

  const allFailures = [
    ...failures.map(f => ({ studentEmail: f.email || f.studentEmail, studentName: f.fullName, error: f.error, status: 'error' })),
    ...withoutEmail
  ];

  res.json({
    message: `Gửi email hoàn tất. Thành công: ${successes.length}, Thất bại: ${allFailures.length}`,
    successCount: successes.length,
    failedCount:  allFailures.length,
    successes,
    failures: allFailures
  });
});

// 7. API Thống kê cho Dashboard
app.get('/api/stats', verifyToken, authorize(['admin', 'librarian']), (req, res) => {
  const sql = `
    SELECT 
      (SELECT COUNT(*) FROM books) as totalBooks,
      (SELECT COUNT(*) FROM users WHERE role_id = ?) as totalStudents,
      (SELECT COUNT(*) FROM borrow_books WHERE status = 1) as activeBorrows,
      (SELECT COUNT(*) FROM books WHERE status = 1) as availableBooks
  `;

  db.query(sql, [STUDENT_ROLE_ID], (err, results) => {
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
    stack: process.env.NODE_ENV === 'development' ? err.stack : {}
  });
});

// ============================================================
// HELPER: Tạo file Excel đẹp với ExcelJS
// ============================================================
function buildExcelWorkbook(sheetName, columns, rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'FPT Library System';
  wb.created = new Date();

  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }]
  });

  ws.columns = columns.map(col => ({ key: col.key, width: col.width || 18 }));

  const headerRow = ws.addRow(columns.map(c => c.label));
  headerRow.height = 22;
  headerRow.eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border    = {
      top:    { style: 'thin', color: { argb: 'FF1A252F' } },
      bottom: { style: 'thin', color: { argb: 'FF1A252F' } },
      left:   { style: 'thin', color: { argb: 'FF1A252F' } },
      right:  { style: 'thin', color: { argb: 'FF1A252F' } },
    };
  });

  rows.forEach((row, rowIndex) => {
    const dataRow = ws.addRow(columns.map(c => row[c.key] ?? ''));
    const isEven  = rowIndex % 2 === 1;
    dataRow.height = 18;
    dataRow.eachCell(cell => {
      cell.font      = { size: 10 };
      cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: isEven ? 'FFF2F2F2' : 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', wrapText: false };
      cell.border    = {
        top:    { style: 'hair', color: { argb: 'FFDDDDDD' } },
        bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } },
        left:   { style: 'hair', color: { argb: 'FFDDDDDD' } },
        right:  { style: 'hair', color: { argb: 'FFDDDDDD' } },
      };
    });
  });

  ws.columns.forEach((col, colIdx) => {
    const configWidth = columns[colIdx]?.width || 18;
    let maxLen = columns[colIdx]?.label?.length || 10;
    rows.forEach(row => {
      const val = row[columns[colIdx]?.key];
      const len = val != null ? String(val).length : 0;
      if (len > maxLen) maxLen = len;
    });
    col.width = Math.min(Math.max(maxLen + 2, 10), configWidth + 10);
  });

  return wb;
}

// --- API Export: trả về file Excel đẹp ---
app.get('/api/export/:type', verifyToken, authorize(['admin', 'librarian']), async (req, res) => {
  const { type } = req.params;
  const { status, from, to } = req.query;

  try {
    let sheetName, fileName, columns, rows;

    if (type === 'books') {
      sheetName = 'Danh sách sách'; fileName = 'DanhSachSach';
      columns = [
        { key: 'title',           label: 'Tên sách',      width: 38 },
        { key: 'author',          label: 'Tác giả',       width: 28 },
        { key: 'category',        label: 'Thể loại',      width: 22 },
        { key: 'year',            label: 'Năm XB',        width: 10 },
        { key: 'totalCopies',     label: 'Tổng SL',       width: 12 },
        { key: 'availableCopies', label: 'Còn sẵn',       width: 12 },
        { key: 'isAvailable',     label: 'Trạng thái',    width: 15 },
      ];
      const [books] = await db.promise().query(`
        SELECT title, author, published_year AS year, category_id,
               COUNT(*) AS totalCopies,
               SUM(CASE WHEN status=1 THEN 1 ELSE 0 END) AS availableCopies
        FROM books GROUP BY title, author, published_year, category_id ORDER BY title
      `);
      const catMap = { 1:'Công nghệ thông tin', 2:'Văn học', 3:'Khoa học' };
      rows = books.map(b => ({
        ...b, category: catMap[b.category_id] || 'Khác',
        isAvailable: b.availableCopies > 0 ? 'Còn sách' : 'Hết sách',
      }));
      if (status === 'available')   rows = rows.filter(r => r.isAvailable === 'Còn sách');
      if (status === 'unavailable') rows = rows.filter(r => r.isAvailable === 'Hết sách');
    }

    else if (type === 'students') {
      sheetName = 'Danh sách sinh viên'; fileName = 'DanhSachSinhVien';
      columns = [
        { key: 'MSV',      label: 'Mã sinh viên', width: 16 },
        { key: 'fullName', label: 'Họ và tên',    width: 32 },
        { key: 'class',    label: 'Lớp',          width: 14 },
        { key: 'email',    label: 'Email',         width: 34 },
      ];
      const [students] = await db.promise().query(`
        SELECT u.username AS MSV, u.full_name AS fullName,
               ud.class_name AS class, u.email
        FROM users u LEFT JOIN user_details ud ON u.id = ud.user_id
        WHERE u.role_id = 3 ORDER BY u.username
      `);
      rows = students;
    }

    else if (type === 'borrows_active') {
      sheetName = 'Sách đang mượn'; fileName = 'SachDangMuon';
      columns = [
        { key: 'MSV',       label: 'Mã sinh viên', width: 16 },
        { key: 'fullName',  label: 'Họ và tên',    width: 30 },
        { key: 'class',     label: 'Lớp',          width: 14 },
        { key: 'nameBook',  label: 'Tên sách',     width: 38 },
        { key: 'timeStart', label: 'Ngày mượn',    width: 14 },
        { key: 'timeEnd',   label: 'Hạn trả',      width: 14 },
      ];
      const [borrows] = await db.promise().query(`
        SELECT u.username AS MSV, u.full_name AS fullName,
               ud.class_name AS class, b.title AS nameBook,
               DATE_FORMAT(bb.borrow_date,'%d/%m/%Y') AS timeStart,
               DATE_FORMAT(bb.due_date,'%d/%m/%Y')    AS timeEnd
        FROM borrow_books bb
        JOIN books b ON bb.book_id = b.id
        JOIN users u ON bb.user_id = u.id
        LEFT JOIN user_details ud ON u.id = ud.user_id
        WHERE bb.status = 1 ORDER BY bb.borrow_date DESC
      `);
      rows = borrows;
    }

    else if (type === 'borrows_history') {
      sheetName = 'Lịch sử mượn'; fileName = 'LichSuMuonSach';
      columns = [
        { key: 'MSV',        label: 'Mã sinh viên',  width: 16 },
        { key: 'fullName',   label: 'Họ và tên',     width: 30 },
        { key: 'class',      label: 'Lớp',           width: 14 },
        { key: 'nameBook',   label: 'Tên sách',      width: 38 },
        { key: 'timeStart',  label: 'Ngày mượn',     width: 14 },
        { key: 'timeEnd',    label: 'Hạn trả',       width: 14 },
        { key: 'returnDate', label: 'Ngày trả thực', width: 16 },
        { key: 'status',     label: 'Trạng thái',    width: 14 },
      ];
      let sql = `
        SELECT u.username AS MSV, u.full_name AS fullName,
               ud.class_name AS class, b.title AS nameBook,
               DATE_FORMAT(bb.borrow_date,'%d/%m/%Y')  AS timeStart,
               DATE_FORMAT(bb.due_date,'%d/%m/%Y')     AS timeEnd,
               DATE_FORMAT(bb.return_date,'%d/%m/%Y')  AS returnDate,
               bb.status
        FROM borrow_books bb
        JOIN books b ON bb.book_id = b.id
        JOIN users u ON bb.user_id = u.id
        LEFT JOIN user_details ud ON u.id = ud.user_id
        WHERE 1=1
      `;
      const params = [];
      if (status === '1') { sql += ' AND bb.status = 1'; }
      if (status === '0') { sql += ' AND bb.status = 0'; }
      if (from) { sql += ' AND bb.borrow_date >= ?'; params.push(from); }
      if (to)   { sql += ' AND bb.borrow_date <= ?'; params.push(to + ' 23:59:59'); }
      sql += ' ORDER BY bb.borrow_date DESC';
      const [history] = await db.promise().query(sql, params);
      rows = history.map(r => ({ ...r, status: r.status === 1 ? 'Đang mượn' : 'Đã trả' }));
    }

    else {
      return res.status(400).json({ error: 'Loại báo cáo không hợp lệ!' });
    }

    const wb   = buildExcelWorkbook(sheetName, columns, rows);
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '');

    res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}_${date}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Middleware xử lý khi người dùng gọi sai URL
// LUÔN ĐẶT Ở CUỐI CÙNG SAU TẤT CẢ CÁC ROUTE KHÁC
app.use((req, res) => {
  res.status(404).json({
    error: `Không tìm thấy đường dẫn ${req.method} ${req.originalUrl}. Vui lòng kiểm tra lại!`
  });
});

/**
 * Style chung cho toàn bộ file Excel xuất ra
 * Header: nền xanh đậm, chữ trắng, bold, border
 * Data:   border, zebra striping (dòng chẵn xám nhạt)
 * Cột:    auto-fit dựa trên nội dung thực tế
 */
function buildExcelWorkbook(sheetName, columns, rows) {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'FPT Library System';
  wb.created = new Date();

  const ws = wb.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }] // Freeze hàng header
  });

  // --- Định nghĩa cột ---
  ws.columns = columns.map(col => ({
    key:   col.key,
    width: col.width || 18,
  }));

  // --- Header row ---
  const headerRow = ws.addRow(columns.map(c => c.label));
  headerRow.height = 22;
  headerRow.eachCell(cell => {
    cell.font      = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill      = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2C3E50' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: false };
    cell.border    = {
      top:    { style: 'thin', color: { argb: 'FF1A252F' } },
      bottom: { style: 'thin', color: { argb: 'FF1A252F' } },
      left:   { style: 'thin', color: { argb: 'FF1A252F' } },
      right:  { style: 'thin', color: { argb: 'FF1A252F' } },
    };
  });

  // --- Data rows ---
  rows.forEach((row, rowIndex) => {
    const dataRow = ws.addRow(columns.map(c => row[c.key] ?? ''));
    const isEven  = rowIndex % 2 === 1; // zebra striping

    dataRow.height = 18;
    dataRow.eachCell(cell => {
      cell.font      = { size: 10 };
      cell.fill      = {
        type: 'pattern', pattern: 'solid',
        fgColor: { argb: isEven ? 'FFF2F2F2' : 'FFFFFFFF' }
      };
      cell.alignment = { vertical: 'middle', wrapText: false };
      cell.border    = {
        top:    { style: 'hair', color: { argb: 'FFDDDDDD' } },
        bottom: { style: 'hair', color: { argb: 'FFDDDDDD' } },
        left:   { style: 'hair', color: { argb: 'FFDDDDDD' } },
        right:  { style: 'hair', color: { argb: 'FFDDDDDD' } },
      };
    });
  });

  // --- Auto-fit độ rộng cột dựa trên nội dung thực ---
  ws.columns.forEach((col, colIdx) => {
    const configWidth = columns[colIdx]?.width || 18;
    let maxLen = columns[colIdx]?.label?.length || 10;

    rows.forEach(row => {
      const val = row[columns[colIdx]?.key];
      const len = val != null ? String(val).length : 0;
      if (len > maxLen) maxLen = len;
    });

    // Không để cột quá rộng hoặc quá hẹp
    col.width = Math.min(Math.max(maxLen + 2, 10), configWidth + 10);
  });

  return wb;
}

// --- API Export ---
// Dùng chung 1 endpoint, phân biệt loại báo cáo qua query param `type`
app.get('/api/export/:type', verifyToken, authorize(['admin', 'librarian']), async (req, res) => {
  const { type } = req.params;
  const { status, from, to } = req.query;  // filter params

  try {
    let sheetName, fileName, columns, rows;

    // ---- 1. Danh sách sách ----
    if (type === 'books') {
      sheetName = 'Danh sách sách';
      fileName  = 'DanhSachSach';
      columns = [
        { key: 'title',           label: 'Tên sách',         width: 38 },
        { key: 'author',          label: 'Tác giả',          width: 28 },
        { key: 'category',        label: 'Thể loại',         width: 22 },
        { key: 'year',            label: 'Năm XB',           width: 10 },
        { key: 'totalCopies',     label: 'Tổng số lượng',    width: 15 },
        { key: 'availableCopies', label: 'Còn sẵn',          width: 12 },
        { key: 'isAvailable',     label: 'Trạng thái',       width: 15 },
      ];
      const [books] = await db.promise().query(`
        SELECT title, author, published_year AS year, category_id,
               COUNT(*) AS totalCopies,
               SUM(CASE WHEN status=1 THEN 1 ELSE 0 END) AS availableCopies
        FROM books GROUP BY title, author, published_year, category_id ORDER BY title
      `);
      const catMap = { 1:'Công nghệ thông tin', 2:'Văn học', 3:'Khoa học' };
      rows = books.map(b => ({
        ...b,
        category:    catMap[b.category_id] || 'Khác',
        isAvailable: b.availableCopies > 0 ? 'Còn sách' : 'Hết sách',
      }));
    }

    // ---- 2. Danh sách sinh viên ----
    else if (type === 'students') {
      sheetName = 'Danh sách sinh viên';
      fileName  = 'DanhSachSinhVien';
      columns = [
        { key: 'MSV',      label: 'Mã sinh viên', width: 16 },
        { key: 'fullName', label: 'Họ và tên',    width: 32 },
        { key: 'class',    label: 'Lớp',          width: 14 },
        { key: 'email',    label: 'Email',         width: 34 },
      ];
      const [students] = await db.promise().query(`
        SELECT u.username AS MSV, u.full_name AS fullName,
               ud.class_name AS class, u.email
        FROM users u
        LEFT JOIN user_details ud ON u.id = ud.user_id
        WHERE u.role_id = 3 ORDER BY u.username
      `);
      rows = students;
    }

    // ---- 3. Sách đang mượn ----
    else if (type === 'borrows_active') {
      sheetName = 'Sách đang mượn';
      fileName  = 'SachDangMuon';
      columns = [
        { key: 'MSV',       label: 'Mã sinh viên', width: 16 },
        { key: 'fullName',  label: 'Họ và tên',    width: 30 },
        { key: 'class',     label: 'Lớp',          width: 14 },
        { key: 'nameBook',  label: 'Tên sách',     width: 38 },
        { key: 'timeStart', label: 'Ngày mượn',    width: 14 },
        { key: 'timeEnd',   label: 'Hạn trả',      width: 14 },
      ];
      const [borrows] = await db.promise().query(`
        SELECT u.username AS MSV, u.full_name AS fullName,
               ud.class_name AS class, b.title AS nameBook,
               DATE_FORMAT(bb.borrow_date,'%d/%m/%Y') AS timeStart,
               DATE_FORMAT(bb.due_date,'%d/%m/%Y')    AS timeEnd
        FROM borrow_books bb
        JOIN books b ON bb.book_id = b.id
        JOIN users u ON bb.user_id = u.id
        LEFT JOIN user_details ud ON u.id = ud.user_id
        WHERE bb.status = 1 ORDER BY bb.borrow_date DESC
      `);
      rows = borrows;
    }

    // ---- 4. Lịch sử mượn sách ----
    else if (type === 'borrows_history') {
      sheetName = 'Lịch sử mượn';
      fileName  = 'LichSuMuonSach';
      columns = [
        { key: 'MSV',        label: 'Mã sinh viên',   width: 16 },
        { key: 'fullName',   label: 'Họ và tên',      width: 30 },
        { key: 'class',      label: 'Lớp',            width: 14 },
        { key: 'nameBook',   label: 'Tên sách',       width: 38 },
        { key: 'timeStart',  label: 'Ngày mượn',      width: 14 },
        { key: 'timeEnd',    label: 'Hạn trả',        width: 14 },
        { key: 'returnDate', label: 'Ngày trả thực',  width: 16 },
        { key: 'status',     label: 'Trạng thái',     width: 14 },
      ];

      let sql = `
        SELECT u.username AS MSV, u.full_name AS fullName,
               ud.class_name AS class, b.title AS nameBook,
               DATE_FORMAT(bb.borrow_date,'%d/%m/%Y')   AS timeStart,
               DATE_FORMAT(bb.due_date,'%d/%m/%Y')      AS timeEnd,
               DATE_FORMAT(bb.return_date,'%d/%m/%Y')   AS returnDate,
               bb.status
        FROM borrow_books bb
        JOIN books b ON bb.book_id = b.id
        JOIN users u ON bb.user_id = u.id
        LEFT JOIN user_details ud ON u.id = ud.user_id
        WHERE 1=1
      `;
      const params = [];
      if (status === '1') { sql += ' AND bb.status = 1'; }
      if (status === '0') { sql += ' AND bb.status = 0'; }
      if (from) { sql += ' AND bb.borrow_date >= ?'; params.push(from); }
      if (to)   { sql += ' AND bb.borrow_date <= ?'; params.push(to + ' 23:59:59'); }
      sql += ' ORDER BY bb.borrow_date DESC';

      const [history] = await db.promise().query(sql, params);
      rows = history.map(r => ({ ...r, status: r.status === 1 ? 'Đang mượn' : 'Đã trả' }));
    }

    else {
      return res.status(400).json({ error: 'Loại báo cáo không hợp lệ!' });
    }

    // --- Tạo workbook và stream về client ---
    const wb = buildExcelWorkbook(sheetName, columns, rows);
    const date = new Date().toISOString().slice(0,10).replace(/-/g,'');

    res.setHeader('Content-Type',        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}_${date}.xlsx"`);

    await wb.xlsx.write(res);
    res.end();

  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ============================================================
// CRON JOB: Tự động gửi email nhắc nhở hàng ngày lúc 8:00 sáng
// ============================================================

/**
 * Helper: Gửi email theo batch để tối ưu tốc độ mà không bị Gmail chặn.
 *
 * Tại sao batch thay vì Promise.all toàn bộ?
 * - Promise.all(50 emails) → gửi 50 cái cùng lúc → Gmail rate limit → block
 * - Batch 5: gửi 5 song song, xong batch → gửi 5 tiếp theo
 * - Tốc độ: 10x nhanh hơn tuần tự, an toàn với Gmail free tier
 *
 * @param {Array}    items         - Mảng các object cần gửi
 * @param {Function} sendOneFn     - Async function nhận 1 item, trả về { success, data }
 * @param {number}   batchSize     - Số email gửi song song mỗi batch (mặc định 5)
 * @returns {{ successes, failures }}
 */
async function sendInBatches(items, sendOneFn, batchSize = 5) {
  const successes = [];
  const failures  = [];

  // Chia items thành các nhóm batchSize phần tử
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);

    // Gửi song song trong batch bằng Promise.allSettled
    // allSettled (không phải all): không throw ngay cả khi 1 cái fail
    const results = await Promise.allSettled(
      batch.map(item => sendOneFn(item))
    );

    results.forEach((result, idx) => {
      if (result.status === 'fulfilled') {
        successes.push(result.value);
      } else {
        failures.push({ ...batch[idx], error: result.reason?.message || 'Unknown error' });
      }
    });

    console.log(`  📦 Batch ${Math.floor(i / batchSize) + 1}: ${batch.length} email (✅${results.filter(r=>r.status==='fulfilled').length} ❌${results.filter(r=>r.status==='rejected').length})`);
  }

  return { successes, failures };
}

/**
 * Hàm gửi email nhắc nhở - dùng chung cho cả cron và API thủ công
 * @param {number|null} limit - Giới hạn số người nhận, null = tất cả
 * @returns {Promise<{successCount, failedCount, successes, failures}>}
 */
async function sendReminderEmailsJob(limit = null) {
  const sql = `
    SELECT u.username AS MSV, u.full_name AS fullName, u.email,
           b.title AS nameBook, bb.due_date AS timeEnd
    FROM borrow_books bb
    JOIN users u ON bb.user_id = u.id
    JOIN books b ON bb.book_id = b.id
    WHERE bb.status = 1
    AND DATEDIFF(bb.due_date, CURDATE()) = 1
    ${limit ? `LIMIT ${parseInt(limit)}` : ''}
  `;

  return new Promise((resolve) => {
    db.query(sql, async (err, results) => {
      if (err) {
        console.error('❌ [Cron] Lỗi query DB:', err.message);
        return resolve({ successCount: 0, failedCount: 0, successes: [], failures: [] });
      }

      if (results.length === 0) {
        console.log('ℹ️  [Cron] Không có sinh viên nào sắp đến hạn trả sách ngày mai.');
        return resolve({ successCount: 0, failedCount: 0, successes: [], failures: [] });
      }

      console.log(`📬 [Cron] Gửi email cho ${results.length} sinh viên (batch 5)...`);

      // Lọc bỏ record không có email trước
      const withEmail    = results.filter(r => r.email);
      const withoutEmail = results.filter(r => !r.email).map(r => ({
        studentEmail: '(không có email)', MSV: r.MSV, error: 'Chưa có email'
      }));

      const { successes, failures } = await sendInBatches(withEmail, async (record) => {
        const mailOptions = {
          from: `"Thư Viện FPT" <${process.env.EMAIL_USER}>`,
          to:   record.email,
          subject: '⏰ Nhắc Nhở Hạn Trả Sách - Thư Viện FPT',
          html: `
            <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
              <h2 style="color: #42b983;">Xin chào ${record.fullName} (MSV: ${record.MSV}),</h2>
              <p>Cuốn sách <strong>"${record.nameBook}"</strong> sắp đến hạn trả vào ngày
                 <strong>${new Date(record.timeEnd).toLocaleDateString('vi-VN')}</strong>.</p>
              <p>Vui lòng đến thư viện để trả sách đúng hạn!</p>
              <br/><p>Trân trọng,</p>
              <p><strong>Ban Quản Trị Thư Viện FPT</strong></p>
            </div>
          `
        };
        await transporter.sendMail(mailOptions);
        console.log(`    ✅ → ${record.email}`);
        return { studentEmail: record.email, bookTitle: record.nameBook };
      });

      const allFailures = [...failures.map(f => ({ studentEmail: f.email || f.studentEmail, error: f.error })), ...withoutEmail];

      console.log(`📊 [Cron] Hoàn tất: ✅ ${successes.length} thành công, ❌ ${allFailures.length} thất bại`);
      resolve({
        successCount: successes.length,
        failedCount:  allFailures.length,
        successes,
        failures: allFailures
      });
    });
  });
}

// Đăng ký cron job: chạy lúc 08:00 sáng mỗi ngày
// Cú pháp: '0 8 * * *' = phút 0, giờ 8, mọi ngày/tháng/tuần
cron.schedule('0 8 * * *', async () => {
  const now = new Date().toLocaleString('vi-VN');
  console.log(`\n⏰ [Cron] Bắt đầu job nhắc nhở lúc ${now}`);
  await sendReminderEmailsJob();
  console.log('⏰ [Cron] Job hoàn tất.\n');
}, {
  timezone: 'Asia/Ho_Chi_Minh'   // đúng múi giờ Việt Nam
});

console.log('✅ Cron job đã được đăng ký: gửi email nhắc nhở lúc 08:00 sáng mỗi ngày (Asia/Ho_Chi_Minh)');

app.listen(PORT, () => {
  console.log(`🚀 Server Backend đang chạy mượt mà tại: http://localhost:${PORT}`);
});