const mysql = require('mysql2');

const connection = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '@Nhung19012006',
  database: 'fpt_library'
});

connection.connect((err) => {
  if (err) {
    console.error('❌ Lỗi kết nối:', err.message);
    return;
  }

  console.log('✅ Đã kết nối database');

  // Disable foreign key check
  connection.query('SET FOREIGN_KEY_CHECKS = 0', (err) => {
    if (err) {
      console.error('❌ Lỗi DISABLE FK:', err.message);
      connection.end();
      return;
    }

    console.log('🔓 Đã disable foreign key check');

    // Xóa bảng cũ
    connection.query('DROP TABLE IF EXISTS categories', (err2) => {
      if (err2) {
        console.error('❌ Lỗi DROP TABLE:', err2.message);
        connection.query('SET FOREIGN_KEY_CHECKS = 1');
        connection.end();
        return;
      }
      console.log('🗑️ Đã xóa bảng categories cũ');

      // Tạo lại đúng cấu trúc
      const createTable = `
        CREATE TABLE categories (
            id INT AUTO_INCREMENT PRIMARY KEY,
            category_name VARCHAR(100) NOT NULL
        )
      `;

      connection.query(createTable, (err3) => {
        if (err3) {
          console.error('❌ Lỗi CREATE TABLE:', err3.message);
        } else {
          console.log('✅ Đã tạo lại bảng categories đúng cấu trúc');

          // Insert lại dữ liệu
          connection.query('INSERT INTO categories (id, category_name) VALUES (1, "Công nghệ thông tin"), (2, "Văn học"), (3, "Khoa học")', (err4) => {
            if (err4) {
              console.error('❌ Lỗi INSERT:', err4.message);
            } else {
              console.log('✅ Đã insert lại dữ liệu mẫu');
            }
          });
        }

        // Enable lại foreign key check
        connection.query('SET FOREIGN_KEY_CHECKS = 1', () => {
          console.log('🔒 Đã enable lại foreign key check');
          connection.end();
        });
      });
    });
  });
});
