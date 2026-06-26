import * as XLSX from 'xlsx'

/**
 * Composable tái sử dụng để xuất dữ liệu ra file Excel.
 * @returns { exportToExcel }
 */
export function useExport() {
  /**
   * Xuất mảng dữ liệu ra file .xlsx
   * @param {Array}  rows       - Mảng object dữ liệu cần xuất
   * @param {Array}  columns    - Cấu hình cột: [{ key, label, width? }]
   * @param {string} sheetName  - Tên sheet trong file Excel
   * @param {string} fileName   - Tên file xuất (không cần đuôi .xlsx)
   */
  function exportToExcel({ rows, columns, sheetName = 'Sheet1', fileName = 'export' }) {
    // 1. Tạo header row từ columns config
    const header = columns.map(c => c.label)

    // 2. Map từng row data theo thứ tự columns
    const data = rows.map(row =>
      columns.map(c => {
        const val = row[c.key]
        return val !== null && val !== undefined ? val : ''
      })
    )

    // 3. Tạo worksheet từ [header, ...data]
    const ws = XLSX.utils.aoa_to_sheet([header, ...data])

    // 4. Đặt độ rộng cột (nếu có config)
    ws['!cols'] = columns.map(c => ({ wch: c.width || 20 }))

    // 5. Tạo workbook và thêm sheet
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, sheetName)

    // 6. Tải file về máy
    XLSX.writeFile(wb, `${fileName}_${_today()}.xlsx`)
  }

  function _today() {
    return new Date().toISOString().slice(0, 10).replace(/-/g, '')
  }

  return { exportToExcel }
}
