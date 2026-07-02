import api from '../api/axios.js'

/**
 * Composable xuất Excel — gọi backend (ExcelJS) để có file đẹp với style đầy đủ.
 */
export function useExport() {
  /**
   * @param {string} type       - Loại báo cáo: 'books' | 'students' | 'borrows_active' | 'borrows_history'
   * @param {string} fileName   - Tên file tải về (không cần đuôi .xlsx)
   * @param {Object} params     - Query params filter (status, from, to)
   */
  async function exportToExcel({ type, fileName, params = {} }) {
    // Gọi API backend — nhận về binary stream
    const response = await api.get(`/export/${type}`, {
      params,
      responseType: 'blob',   // ← quan trọng: nhận binary data
    })

    // Tạo URL tạm từ blob và trigger download
    const url  = URL.createObjectURL(new Blob([response.data]))
    const link = document.createElement('a')
    const date = new Date().toISOString().slice(0, 10).replace(/-/g, '')

    link.href     = url
    link.download = `${fileName}_${date}.xlsx`
    link.click()

    URL.revokeObjectURL(url)
  }

  return { exportToExcel }
}
