const mysql = require('mysql2');
require('dotenv').config();

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

const sql1 = `
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  token VARCHAR(500) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_token (token(255))
)
`;

const sql2 = `
CREATE TABLE IF NOT EXISTS librarian_refresh_tokens (
  id INT AUTO_INCREMENT PRIMARY KEY,
  librarian_id INT NOT NULL,
  token VARCHAR(500) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  revoked_at DATETIME NULL,
  FOREIGN KEY (librarian_id) REFERENCES librarians(id) ON DELETE CASCADE,
  INDEX idx_librarian_id (librarian_id),
  INDEX idx_token (token(255))
)
`;

console.log('Đang tạo bảng refresh_tokens...');

db.query(sql1, (err1, results1) => {
  if (err1) {
    console.error('❌ Lỗi tạo bảng refresh_tokens:', err1.message);
    db.end();
    process.exit(1);
  }
  
  console.log('✅ Đã tạo bảng refresh_tokens thành công!');
  
  console.log('Đang tạo bảng librarian_refresh_tokens...');
  
  db.query(sql2, (err2, results2) => {
    if (err2) {
      console.error('❌ Lỗi tạo bảng librarian_refresh_tokens:', err2.message);
      db.end();
      process.exit(1);
    }
    
    console.log('✅ Đã tạo bảng librarian_refresh_tokens thành công!');
    db.end();
    process.exit(0);
  });
});
