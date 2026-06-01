const mysql = require('mysql2');

// Bước 1: Kết nối đến MySQL Server mà chưa chỉ định database
const connection = mysql.createConnection({
  host: 'localhost',
  port: 3307,
  user: 'root',
  password: '',
  multipleStatements: true // Cho phép chạy nhiều câu lệnh SQL cùng lúc
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

    // Bước 4: Tạo các bảng cần thiết
    const createTablesQuery = `
      CREATE TABLE IF NOT EXISTS students (
          MSV VARCHAR(50) PRIMARY KEY,
          fullName VARCHAR(255) NOT NULL,
          class VARCHAR(50),
          email VARCHAR(100)
      );

      CREATE TABLE IF NOT EXISTS borrow_records (
          IdRent INT AUTO_INCREMENT PRIMARY KEY,
          IdBook INT NOT NULL,
          IdUser INT NOT NULL,
          MSV VARCHAR(50) NOT NULL,
          timeStart DATETIME NOT NULL,
          timeEnd DATETIME NOT NULL
      );
    `;

    connection.query(createTablesQuery, (err) => {
        if (err) console.error('❌ Lỗi tạo bảng:', err.message);
      else {
        console.log('🎉 Các bảng đã sẵn sàng!');
        // Thêm một vài sinh viên mẫu
        const seedStudents = `
          INSERT IGNORE INTO students (MSV, fullName, class, email) VALUES 
          ('BH02443', 'Nguyen Van A', 'IT1801', 'anv@fpt.edu.vn'),
          ('BH02550', 'Tran Thi B', 'IT1802', 'btt@fpt.edu.vn');
        `;
        connection.query(seedStudents, () => connection.end());
      }
      });
    });
  });
});