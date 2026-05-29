const mysql = require('mysql2');

// Bước 1: Kết nối đến MySQL Server mà chưa chỉ định database
const connection = mysql.createConnection({
  host: 'localhost',
  port: 3307,
  user: 'root',
  password: ''
});

connection.connect((err) => {
  if (err) {
    console.error('❌ Lỗi kết nối MySQL:', err.message);
    return;
  }

  console.log('Connected to MySQL server.');

  // Bước 2: Tạo Database nếu chưa có
  connection.query('CREATE DATABASE IF NOT EXISTS fpt_library', (err) => {
    if (err) {
      console.error('❌ Lỗi tạo database:', err.message);
      connection.end();
      return;
    }
    console.log('🎉 Database fpt_library đã sẵn sàng!');

    // Bước 3: Chuyển sang sử dụng database fpt_library
    connection.query('USE fpt_library', (err) => {
      if (err) {
        console.error('❌ Lỗi chuyển database:', err.message);
        connection.end();
        return;
      }

      // Bước 4: Tạo bảng borrow_records
      const createBorrowTableQuery = `
      CREATE TABLE IF NOT EXISTS borrow_records (
          IdRent INT AUTO_INCREMENT PRIMARY KEY,
          IdBook INT NOT NULL,
          IdUser INT NOT NULL,
          MSV VARCHAR(50) NOT NULL,
          timeStart DATETIME NOT NULL,
          timeEnd DATETIME NOT NULL
      );`;

      connection.query(createBorrowTableQuery, (err) => {
        if (err) console.error('❌ Lỗi tạo bảng:', err.message);
        else console.log('🎉 Bảng borrow_records đã sẵn sàng!');
        connection.end();
      });
    });
  });
});