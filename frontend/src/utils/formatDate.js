/**
 * Format ngày từ MySQL/API, tránh lệch múi giờ khi hiển thị.
 */
export function formatDate(dateStr, fallback = '-') {
  if (!dateStr) return fallback

  const str = String(dateStr)
  const datePart = str.includes('T') ? str.split('T')[0] : str.split(' ')[0]
  const parts = datePart.split('-')

  if (parts.length === 3) {
    const [year, month, day] = parts
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`
  }

  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return fallback

  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getFullYear()}`
}

export function formatDateTime(dateStr, fallback = '-') {
  if (!dateStr) return fallback

  const str = String(dateStr)
  if (str.includes('T')) {
    const [datePart, timePart] = str.split('T')
    const [year, month, day] = datePart.split('-')
    const time = timePart.slice(0, 5)
    return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year} ${time}`
  }

  return formatDate(dateStr, fallback)
}
