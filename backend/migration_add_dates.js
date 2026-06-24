const mysql = require('mysql2');

// Kết nối đến database
const connection = mysql.createConnection({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: '@Nhung19012006',
  database: 'fpt_library'
});

connection.connect((err) => {
  if (err) {
    console.error('❌ Lỗi kết nối MySQL:', err.message);
    return;
  }

  console.log('Connected to fpt_library database.');

  // Kiểm tra xem cột đã tồn tại chưa
  connection.query('SHOW COLUMNS FROM borrow_requests LIKE "borrow_date"', (err, results) => {
    if (err) {
      console.error('❌ Lỗi kiểm tra cột:', err.message);
      connection.end();
      return;
    }

    if (results.length > 0) {
      console.log('✅ Cột borrow_date đã tồn tại!');
    } else {
      // Thêm cột borrow_date
      connection.query('ALTER TABLE borrow_requests ADD COLUMN borrow_date DATETIME', (err) => {
        if (err) {
          console.error('❌ Lỗi thêm cột borrow_date:', err.message);
        } else {
          console.log('✅ Đã thêm cột borrow_date!');
        }
      });
    }

    // Kiểm tra và thêm cột due_date
    connection.query('SHOW COLUMNS FROM borrow_requests LIKE "due_date"', (err, results) => {
      if (err) {
        console.error('❌ Lỗi kiểm tra cột due_date:', err.message);
        connection.end();
        return;
      }

      if (results.length > 0) {
        console.log('✅ Cột due_date đã tồn tại!');
      } else {
        connection.query('ALTER TABLE borrow_requests ADD COLUMN due_date DATETIME', (err) => {
          if (err) {
            console.error('❌ Lỗi thêm cột due_date:', err.message);
          } else {
            console.log('✅ Đã thêm cột due_date!');
          }
        });
      }

      connection.end();
    });
  });
});
