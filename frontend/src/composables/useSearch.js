import { ref, computed } from 'vue'

/**
 * Composable dùng chung cho chức năng tìm kiếm dữ liệu.
 * @param {Ref} dataRef - Ref chứa mảng dữ liệu gốc.
 * @param {Array} keys - Danh sách các thuộc tính muốn tìm kiếm (ví dụ: ['title', 'author']).
 * @returns {Object} - Trả về searchQuery (để v-model) và filteredData (dữ liệu đã lọc).
 */
export function useSearch(dataRef, keys) {
  const searchQuery = ref('')

  const filteredData = computed(() => {
    const query = searchQuery.value.trim().toLowerCase()
    if (!query) return dataRef.value

    return dataRef.value.filter(item => {
      return keys.some(key => {
        const value = item[key]
        return value !== null && value !== undefined && String(value).toLowerCase().includes(query)
      })
    })
  })

  return { searchQuery, filteredData }
}