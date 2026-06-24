require('dotenv').config();
const mysql = require('mysql2');

console.log('🔍 KIỂM TRA CHI TIẾT DATABASE SCHEMA');
console.log('='.repeat(60));

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
    process.exit(1);
  }

  console.log('✅ Kết nối database thành công!');
  console.log('Database:', process.env.DB_NAME || 'fpt_library');
  console.log('');

  // 1. Liệt kê tất cả các bảng
  connection.query('SHOW TABLES', (err, tables) => {
    if (err) {
      console.error('❌ Lỗi lấy danh sách bảng:', err.message);
      connection.end();
      process.exit(1);
    }

    const tableNames = tables.map(t => Object.values(t)[0]);
    console.log('📋 TẤT CẢ CÁC BẢNG TRONG DATABASE:');
    console.log(tableNames.join(', '));
    console.log('');

    // 2. Kiểm tra chi tiết từng bảng
    let currentTableIndex = 0;
    
    function checkNextTable() {
      if (currentTableIndex >= tableNames.length) {
        console.log('='.repeat(60));
        console.log('✅ KIỂM TRA HOÀN TẤT!');
        connection.end();
        return;
      }

      const tableName = tableNames[currentTableIndex];
      
      // Lấy cấu trúc bảng
      connection.query(`DESCRIBE ${tableName}`, (err, columns) => {
        if (err) {
          console.error(`❌ Lỗi kiểm tra bảng ${tableName}:`, err.message);
        } else {
          console.log(`📊 BẢNG: ${tableName}`);
          console.log('-'.repeat(50));
          
          columns.forEach(col => {
            console.log(`   ${col.Field.padEnd(20)} | ${col.Type.padEnd(20)} | ${col.Null.padEnd(5)} | ${col.Key.padEnd(5)} | ${col.Default || 'NULL'}`);
          });
          
          // Lấy dữ liệu mẫu (max 3 records)
          connection.query(`SELECT * FROM ${tableName} LIMIT 3`, (err, sampleData) => {
            if (err) {
              console.error(`   ⚠️  Không thể lấy dữ liệu mẫu: ${err.message}`);
            } else {
              if (sampleData.length > 0) {
                console.log('');
                console.log('   📝 DỮ LIỆU MẪU:');
                sampleData.forEach((row, idx) => {
                  console.log(`   Record ${idx + 1}:`, JSON.stringify(row, null, 2).split('\n').join('\n      '));
                });
              } else {
                console.log('');
                console.log('   ℹ️  Bảng này không có dữ liệu');
              }
              
              // Đếm tổng số records
              connection.query(`SELECT COUNT(*) as total FROM ${tableName}`, (err, countResult) => {
                if (!err) {
                  console.log(`   📈 Tổng số records: ${countResult[0].total}`);
                }
              });
            }
            
            console.log('');
            console.log('');
            
            currentTableIndex++;
            checkNextTable();
          });
        }
      });
    }

    checkNextTable();
  });
});