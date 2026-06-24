import { ref, computed } from 'vue'

export function usePagination(items, itemsPerPage = 10) {
  const currentPage = ref(1)
  const pageSize = ref(itemsPerPage)

  // Tính tổng số trang - xử lý cả ref và computed
  const totalPages = computed(() => {
    const itemsValue = items.value !== undefined ? items.value : items
    return Math.ceil(itemsValue.length / pageSize.value)
  })

  // Lấy dữ liệu trang hiện tại - xử lý cả ref và computed
  const paginatedItems = computed(() => {
    const itemsValue = items.value !== undefined ? items.value : items
    const start = (currentPage.value - 1) * pageSize.value
    const end = start + pageSize.value
    return itemsValue.slice(start, end)
  })

  // Chuyển đến trang cụ thể
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages.value) {
      currentPage.value = page
    }
  }

  // Trang tiếp theo
  const nextPage = () => {
    if (currentPage.value < totalPages.value) {
      currentPage.value++
    }
  }

  // Trang trước
  const previousPage = () => {
    if (currentPage.value > 1) {
      currentPage.value--
    }
  }

  // Trang đầu tiên
  const firstPage = () => {
    currentPage.value = 1
  }

  // Trang cuối cùng
  const lastPage = () => {
    currentPage.value = totalPages.value
  }

  // Đặt lại trang đầu tiên khi thay đổi dữ liệu
  const resetPagination = () => {
    currentPage.value = 1
  }

  // Thay đổi số lượng item mỗi trang
  const changePageSize = ( newSize) => {
    pageSize.value = newSize
    currentPage.value = 1 // Reset về trang 1 khi thay đổi pageSize
  }

  return {
    currentPage,
    pageSize,
    totalPages,
    paginatedItems,
    goToPage,
    nextPage,
    previousPage,
    firstPage,
    lastPage,
    resetPagination,
    changePageSize
  }
}
