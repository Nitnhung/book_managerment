<template>
  <div class="borrow-management">
    <!-- Header với nút lập thẻ mượn -->
    <div class="page-header">
      <h2>📋 Quản lý Thẻ Mượn / Trả Sách</h2>
      <button @click="openBorrowModal" class="btn-add">➕ Lập Thẻ Mượn Mới</button>
    </div>

    <!-- Bộ lọc -->
    <div class="filter-section">
      <input v-model="searchQuery" type="text" placeholder="🔍 Tìm kiếm theo MSV, tên sinh viên hoặc tên sách..." class="search-input" />
    </div>

    <!-- Danh sách thẻ mượn -->
    <div class="table-container">
      <h3>Danh Sách Sinh Viên Đang Mượn Sách</h3>
      <table class="borrow-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Mã Sinh Viên</th>
            <th>Tên Sinh Viên</th>
            <th>Lớp</th>
            <th>Tên Sách</th>
            <th>Ngày Mượn</th>
            <th>Hạn Trả / Ngày Trả</th>
            <th>Hành Động</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in paginatedItems" :key="record.IdRent">
            <td>{{ record.IdRent }}</td>
            <td>{{ record.MSV }}</td>
            <td>{{ record.fullName }}</td>
            <td>{{ record.class }}</td>
            <td>{{ record.nameBook }}</td>
            <td>{{ formatDate(record.timeStart) }}</td>
            <td>{{ formatDate(record.timeEnd) }}</td>
            <td>
              <button @click="returnBook(record.IdRent)" class="btn-return">Trả Sách</button>
            </td>
          </tr>
        </tbody>
      </table>

      <!-- Phân trang -->
      <Pagination
        :current-page="currentPage"
        :total-pages="Math.ceil(filteredBorrowRecords.length / pageSize) || 1"
        :page-size="pageSize"
        @page-change="handlePageChange"
        @page-size-change="handlePageSizeChange"
      />
    </div>

    <!-- BorrowModal Component -->
    <BorrowModal
      :is-open="isBorrowModalOpen"
      mode="direct"
      :available-books="availableBooks"
      :all-students="allStudents"
      @close="isBorrowModalOpen = false"
      @submit="handleBorrowSubmit"
    />
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue';
import { useValidation } from '../composables/useValidation.js';
import api from '../api/axios.js';
import { useSearch } from '../composables/useSearch.js'
import { usePagination } from '../composables/usePagination.js'
import Pagination from '../components/Pagination.vue'
import BorrowModal from '../components/BorrowModal.vue'

const { validate } = useValidation(); // Sử dụng composable

// Định nghĩa các quy tắc kiểm tra cho thẻ mượn
const borrowValidationRules = {
  MSV: [
    { type: 'required', message: 'Vui lòng nhập Mã sinh viên!' },
    { type: 'maxLength', value: 50, message: 'Mã sinh viên không được vượt quá 50 ký tự.' }
  ],
  IdBook: [
    { type: 'required', message: 'Vui lòng chọn Sách!' }
  ]
};

const borrowRecords = ref([])
const availableBooks = ref([])
const allStudents = ref([])
const isBorrowModalOpen = ref(false)

const { searchQuery, filteredData: filteredBorrowRecords } = useSearch(borrowRecords, ['MSV', 'fullName', 'nameBook'])

const { currentPage, pageSize, paginatedItems, goToPage, changePageSize } = usePagination(filteredBorrowRecords, 10)

function formatDate(dateStr) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  return d.toLocaleDateString('vi-VN')
}

// 1. Lấy danh sách sách và lọc chỉ lấy những cuốn có sẵn (isAvailable) để mượn
async function fetchAvailableBooks() {
  try {
    const response = await api.get('/books', { params: { limit: 1000 } })
    const data = response.data || []
    
    // Chuyển đổi và lọc sách còn sẵn trong kho
    availableBooks.value = data
      .map(b => ({
        IdBook: b.IdBook,
        nameBook: b.nameBook,
        isAvailable: b.availableQuantity !== undefined
          ? Number(b.availableQuantity) > 0
          : (b.status === 1 || b.status === true || b.status === '1')
      }))
      .filter(book => book.isAvailable)
  } catch (error) {
    console.error('Lỗi lấy danh sách sách:', error)
  }
}


// 2. Lấy danh sách các thẻ mượn đang có trong hệ thống
async function fetchBorrowRecords() {
  try {
    const response = await api.get('/borrows', { params: { limit: 1000 } })
    borrowRecords.value = response.data || []
  } catch (error) {
    console.error('Lỗi lấy danh sách thẻ mượn:', error)
  }
}

// 3. Lấy danh sách sinh viên
async function fetchAllStudents() {
  try {
    const response = await api.get('/students')
    allStudents.value = response.data
  } catch (error) {
    console.error('Lỗi lấy danh sách sinh viên:', error)
  }
}

onMounted(() => {
  fetchAvailableBooks()
  fetchBorrowRecords()
  fetchAllStudents()
})

function openBorrowModal() {
  isBorrowModalOpen.value = true
}

async function handleBorrowSubmit(data) {
  try {
    await api.post('/borrows', {
      MSV: data.MSV,
      IdBook: data.IdBook,
      borrow_date: data.borrow_date,
      due_date: data.due_date
    })

    alert('🎉 Lập thẻ mượn sách thành công!')
    isBorrowModalOpen.value = false
    fetchAvailableBooks()
    fetchBorrowRecords()
  } catch (error) {
    alert('❌ Lỗi: ' + (error.response?.data?.error || 'Không thể lập thẻ mượn.'))
  }
}


async function returnBook(id) {
  if (!confirm('Bạn có chắc chắn muốn xác nhận sinh viên này đã trả sách không?')) return

  try {
    await api.delete(`/borrows/${id}`)
    alert('🎉 Đã trả sách thành công!')
    fetchBorrowRecords()
    fetchAvailableBooks()
  } catch (error) {
    alert('❌ Lỗi: ' + (error.response?.data?.error || 'Xử lý trả sách thất bại.'))
  }
}

const handlePageChange = (page) => {
  goToPage(page)
}

const handlePageSizeChange = (newSize) => {
  changePageSize(newSize)
}
</script>
<style scoped>
.borrow-management {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.page-header h2 {
  color: #2c3e50;
  font-size: 2rem;
  font-weight: 700;
}

.btn-add {
  background-color: #42b983;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: background-color 0.3s;
}

.btn-add:hover {
  background-color: #3aa876;
}

.filter-section {
  margin-bottom: 1.5rem;
}

.search-input {
  width: 100%;
  padding: 0.75rem 1rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 1rem;
  max-width: 400px;
}

.search-input:focus {
  outline: none;
  border-color: #42b983;
  box-shadow: 0 0 0 3px rgba(66, 185, 131, 0.1);
}

.table-container {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

.table-container h3 {
  margin: 0 0 1rem 0;
  color: #1f2937;
  font-size: 1.25rem;
  font-weight: 700;
}

.borrow-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 2rem;
}

.borrow-table th,
.borrow-table td {
  border: 1px solid #e2e8f0;
  padding: 12px;
  text-align: left;
}

.borrow-table th {
  background-color: #f8fafc;
  color: #334155;
  font-weight: 700;
}

.borrow-table tbody tr:nth-child(even) {
  background-color: #f8fafc;
}

.borrow-table tbody tr:hover {
  background-color: #f1f5f9;
}

.btn-return {
  background-color: #ef4444;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.btn-return:hover {
  background-color: #dc2626;
}

.empty-list {
  text-align: center;
  padding: 3rem;
  color: #94a3b8;
  font-size: 1.1rem;
  background: #f8fafc;
  border-radius: 8px;
}

</style>