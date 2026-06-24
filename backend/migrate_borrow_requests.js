const mysql = require('mysql2');

// Kết nối đến MySQL Server
const connection = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '@Nhung19012006',
  multipleStatements: true
});

connection.connect((err) => {
  if (err) {
    console.error('❌ Lỗi kết nối MySQL:', err.message);
    return;
  }

  console.log('Connected to MySQL server.');

  // Chuyển sang database fpt_library
  connection.query('USE fpt_library', (err) => {
    if (err) {
      console.error('❌ Lỗi chuyển database:', err.message);
      connection.end();
      return;
    }

    console.log('Using fpt_library database.');

    // Kiểm tra và thêm các cột còn thiếu
    const alterTableQuery = `
      -- Thêm cột borrow_date nếu chưa có
      ALTER TABLE borrow_requests ADD COLUMN IF NOT EXISTS borrow_date DATETIME AFTER request_date;
      
      -- Thêm cột due_date nếu chưa có
      ALTER TABLE borrow_requests ADD COLUMN IF NOT EXISTS due_date DATETIME AFTER borrow_date;
    `;

    connection.query(alterTableQuery, (err) => {
      if (err) {
        console.error('❌ Lỗi khi thêm cột:', err.message);
        connection.end();
        return;
      }

      console.log('✅ Đã thêm thành công các cột borrow_date và due_date vào bảng borrow_requests!');
      connection.end();
    });
  });
});
