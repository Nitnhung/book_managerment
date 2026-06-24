require('dotenv').config();
const mysql = require('mysql2');

console.log('🔍 Kiểm tra kết nối database...');
console.log('Cấu hình:', {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  database: process.env.DB_NAME,
  serverPort: process.env.PORT
});

const connection = mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASS || '',
  database: process.env.DB_NAME || 'fpt_library'
});

connection.connect((err) => {
  if (err) {
    console.error('❌ Lỗi kết nối database:', err.message);
    console.error('Chi tiết lỗi:', err);
    process.exit(1);
  }

  console.log('✅ Kết nối database thành công!');

  // Kiểm tra các bảng
  const checkTables = `
    SHOW TABLES
  `;

  connection.query(checkTables, (err, results) => {
    if (err) {
      console.error('❌ Lỗi kiểm tra bảng:', err.message);
      connection.end();
      process.exit(1);
    }

    console.log('📋 Các bảng trong database:', results.map(r => Object.values(r)[0]));

    // Kiểm tra số lượng records trong mỗi bảng
    const tables = ['students', 'books', 'librarians', 'borrow_records', 'borrow_requests'];
    
    tables.forEach(table => {
      connection.query(`SELECT COUNT(*) as count FROM ${table}`, (err, countResults) => {
        if (err) {
          console.log(`⚠️  Bảng ${table}: Không thể truy vấn (${err.message})`);
        } else {
          console.log(`📊 Bảng ${table}: ${countResults[0].count} records`);
        }
        
        if (table === tables[tables.length - 1]) {
          // Kiểm tra cấu trúc bảng books
          connection.query('DESCRIBE books', (err, columns) => {
            if (err) {
              console.error('❌ Lỗi kiểm tra cấu trúc books:', err.message);
            } else {
              console.log('📋 Cấu trúc bảng books:');
              columns.forEach(col => {
                console.log(`   - ${col.Field} (${col.Type})`);
              });
            }
            
            // Kiểm tra cấu trúc bảng borrow_records
            connection.query('DESCRIBE borrow_records', (err, borrowColumns) => {
              if (err) {
                console.error('❌ Lỗi kiểm tra cấu trúc borrow_records:', err.message);
              } else {
                console.log('📋 Cấu trúc bảng borrow_records:');
                borrowColumns.forEach(col => {
                  console.log(`   - ${col.Field} (${col.Type})`);
                });
              }
              connection.end();
              console.log('✅ Kiểm tra hoàn tất!');
            });
          });
        }
      });
    });
  });
});
