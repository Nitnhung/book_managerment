const mysql = require('mysql2');
const bcrypt = require('bcryptjs');

// Bước 1: Kết nối đến MySQL Server mà chưa chỉ định database
const connection = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '@Nhung19012006',
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

    // Bước 4: Tạo các bảng cần thiết (khớp với database thực tế)
    const createTablesQuery = `
      CREATE TABLE IF NOT EXISTS roles (
          id INT AUTO_INCREMENT PRIMARY KEY,
          role_name VARCHAR(20) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          full_name VARCHAR(255) NOT NULL,
          email VARCHAR(100) UNIQUE,
          role_id INT NOT NULL,
          FOREIGN KEY (role_id) REFERENCES roles(id)
      );

      CREATE TABLE IF NOT EXISTS user_details (
          user_id INT PRIMARY KEY,
          class_name VARCHAR(50),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS librarians (
          id INT AUTO_INCREMENT PRIMARY KEY,
          username VARCHAR(50) UNIQUE NOT NULL,
          password VARCHAR(255) NOT NULL,
          fullName VARCHAR(255),
          role VARCHAR(50) DEFAULT 'librarian'
      );

      CREATE TABLE IF NOT EXISTS students (
          MSV VARCHAR(50) PRIMARY KEY,
          fullName VARCHAR(255) NOT NULL,
          class VARCHAR(50),
          email VARCHAR(100),
          password VARCHAR(255)
      );

      CREATE TABLE IF NOT EXISTS categories (
          id INT AUTO_INCREMENT PRIMARY KEY,
          category_name VARCHAR(100) NOT NULL
      );

      CREATE TABLE IF NOT EXISTS books (
          id INT AUTO_INCREMENT PRIMARY KEY,
          title VARCHAR(255) NOT NULL,
          author VARCHAR(255) NOT NULL,
          published_year INT,
          category_id INT,
          isbn VARCHAR(50),
          status TINYINT(1) DEFAULT 1,
          FOREIGN KEY (category_id) REFERENCES categories(id)
      );

      CREATE TABLE IF NOT EXISTS borrow_books (
          id INT AUTO_INCREMENT PRIMARY KEY,
          book_id INT NOT NULL,
          user_id INT NOT NULL,
          librarian_id INT,
          borrow_date DATETIME NOT NULL,
          due_date DATETIME NOT NULL,
          return_date DATETIME,
          status TINYINT(1) DEFAULT 1,
          FOREIGN KEY (book_id) REFERENCES books(id),
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (librarian_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS borrow_requests (
          id INT AUTO_INCREMENT PRIMARY KEY,
          book_id INT NOT NULL,
          user_id INT NOT NULL,
          request_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
          borrow_date DATETIME,
          due_date DATETIME,
          status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
          approved_by INT,
          approved_date DATETIME,
          rejection_reason TEXT,
          FOREIGN KEY (book_id) REFERENCES books(id),
          FOREIGN KEY (user_id) REFERENCES users(id),
          FOREIGN KEY (approved_by) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS borrow_records (
          IdRent INT AUTO_INCREMENT PRIMARY KEY,
          book_id INT NOT NULL,
          IdUser INT NOT NULL,
          MSV VARCHAR(50) NOT NULL,
          timeStart DATETIME NOT NULL,
          timeEnd DATETIME NOT NULL,
          status TINYINT(1) DEFAULT 1,
          returnActualDate DATETIME
      );
    `;

    connection.query(createTablesQuery, (err) => {
        if (err) console.error('❌ Lỗi tạo bảng:', err.message);
      else {
        console.log('🎉 Các bảng đã sẵn sàng!');
        // Seed dữ liệu mẫu
        const adminPasswordHash = bcrypt.hashSync('123456', 8);
        const librarianPasswordHash = bcrypt.hashSync('123456', 8);
        const studentPasswordHash = bcrypt.hashSync('123456', 8);

        const seedData = `
          -- Insert roles
          INSERT IGNORE INTO roles (id, role_name) VALUES 
          (1, 'admin'),
          (2, 'librarian'),
          (3, 'student');

          -- Insert categories
          INSERT IGNORE INTO categories (id, category_name) VALUES 
          (1, 'Công nghệ thông tin'),
          (2, 'Văn học'),
          (3, 'Khoa học');

          -- Insert admin user
          INSERT IGNORE INTO users (id, username, password, full_name, email, role_id) VALUES 
          (1, 'admin', '${adminPasswordHash}', 'Hệ thống Quản trị', 'admin@fpt.edu.vn', 1);

          -- Insert librarian user
          INSERT IGNORE INTO users (username, password, full_name, email, role_id) VALUES 
          ('librarian1', '${librarianPasswordHash}', 'Thủ thư Nguyễn Minh', 'minh.librarian@fpt.edu.vn', 2);

          -- Insert student users
          INSERT IGNORE INTO users (username, password, full_name, email, role_id) VALUES 
          ('BH00001', '${studentPasswordHash}', 'Sinh viên 001', 'botkay74@gmail.com', 3);

          -- Insert user_details for students
          INSERT IGNORE INTO user_details (user_id, class_name) VALUES 
          (3, 'IT1801'),
          (4, 'IT1801'),
          (5, 'IT1802');

          -- Insert librarians (legacy table)
          REPLACE INTO librarians (id, username, password, fullName, role) VALUES
          (3, 'admin', '${adminPasswordHash}', 'Quản trị viên', 'admin');

          -- Insert students (legacy table)
          INSERT IGNORE INTO students (MSV, fullName, class, email, password) VALUES 
          ('BH02443', 'Nguyen Van A', 'IT1801', 'anv@fpt.edu.vn', '${studentPasswordHash}'),
          ('BH02550', 'Tran Thi B', 'IT1802', 'btt@fpt.edu.vn', '${studentPasswordHash}');

          -- Insert sample books
          INSERT IGNORE INTO books (id, title, author, published_year, category_id, isbn, status) VALUES 
          (1, 'Lập trình Java', 'James Gosling', 2020, 1, '978-1234567890', 1),
          (2, 'Cấu trúc dữ liệu và giải thuật', 'Thomas Cormen', 2019, 1, '978-1234567891', 1),
          (3, 'Truyện Kiều', 'Nguyễn Du', 1820, 2, '978-1234567892', 1),
          (4, 'Vật lý đại cương', 'Albert Einstein', 2018, 3, '978-1234567893', 1);

          -- Insert sample borrow records
          INSERT IGNORE INTO borrow_books (book_id, user_id, librarian_id, borrow_date, due_date, status) VALUES
          (1, 4, 2, CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 7 DAY), 1),
          (2, 5, 2, CURRENT_TIMESTAMP, DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 7 DAY), 1);
        `;
        connection.query(seedData, (err) => {
          if (err) console.error('❌ Lỗi seed dữ liệu:', err.message);
          else console.log('🎉 Dữ liệu mẫu đã được thêm!');
          connection.end();
        });
      }
      });
    });
  });
});