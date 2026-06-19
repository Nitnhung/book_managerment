const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

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
          email VARCHAR(100),
          password VARCHAR(255)
      );

      CREATE TABLE IF NOT EXISTS books (
          IdBook INT AUTO_INCREMENT PRIMARY KEY,
          nameBook VARCHAR(255) NOT NULL,
          isbn VARCHAR(50),
          author VARCHAR(255) NOT NULL,
          year INT,
          category INT,
          status TINYINT(1) DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS librarians (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          fullName VARCHAR(255),
          role VARCHAR(20) NOT NULL DEFAULT 'librarian'
      );

      CREATE TABLE IF NOT EXISTS borrow_records (
          IdRent INT AUTO_INCREMENT PRIMARY KEY,
          IdBook INT NOT NULL,
          IdUser INT NOT NULL,
          MSV VARCHAR(50) NOT NULL,
          timeStart DATETIME NOT NULL,
          timeEnd DATETIME NOT NULL,
          returnActualDate DATETIME NULL,
          status TINYINT(1) NOT NULL DEFAULT 1
      );
    `;

    connection.query(createTablesQuery, (err) => {
        if (err) console.error('❌ Lỗi tạo bảng:', err.message);
      else {
        console.log('🎉 Các bảng đã sẵn sàng!');
        // Thêm một vài sinh viên mẫu
        const adminPasswordHash = bcrypt.hashSync('123', 8);
        // Mật khẩu mặc định cho sinh viên mẫu là '123'
        const studentPasswordHash = bcrypt.hashSync('123', 8);

        const seedStudents = `
          INSERT IGNORE INTO students (MSV, fullName, class, email, password) VALUES 
          ('BH02443', 'Nguyen Van A', 'IT1801', 'anv@fpt.edu.vn', '${studentPasswordHash}'),
          ('BH02550', 'Tran Thi B', 'IT1802', 'btt@fpt.edu.vn', '${studentPasswordHash}');

          -- Thêm một thủ thư mẫu để test login (Mật khẩu là 123)
          -- Sử dụng REPLACE để đảm bảo mật khẩu được cập nhật nếu user đã tồn tại
          REPLACE INTO librarians (username, password, fullName, role) VALUES
          ('admin', '${adminPasswordHash}', 'Quản trị viên', 'admin');
        `;
        connection.query(seedStudents, () => connection.end());
      }
      });
    });
  });
});