<template>
  <div class="container borrow-history">
    <h2>🕒 Lịch sử Mượn / Trả Sách</h2>

    <div class="filter-section">
      <input v-model="searchQuery" type="text" placeholder="🔍 Tìm kiếm theo MSV, tên sinh viên hoặc tên sách..." class="search-input" />
      <select v-model="statusFilter" class="status-filter">
        <option value="">Tất cả trạng thái</option>
        <option value="returned">Đã trả</option>
        <option value="overdue">Quá hạn</option>
      </select>
    </div>

    <div class="table-container">
      <div v-if="filteredHistory.length === 0" class="empty-list">
        Không có dữ liệu lịch sử mượn sách.
      </div>

      <div v-else>
        <table class="history-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Mã Sinh Viên</th>
              <th>Tên Sinh Viên</th>
              <th>Lớp</th>
              <th>Tên Sách</th>
              <th>Ngày bắt đầu</th>
              <th>Ngày kết thúc</th>
              <th>Ngày Trả</th>
              <th>Trạng thái</th>
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
              <td>{{ record.returnDate ? formatDate(record.returnDate) : '-' }}</td>
              <td>
                <span :class="['status-badge', getStatusClass(record)]">
                  {{ getStatusText(record) }}
                </span>
              </td>
            </tr>
          </tbody>
        </table>

        <!-- Phân trang -->
        <Pagination
          :current-page="currentPage"
          :total-pages="Math.max(1, Math.ceil(filteredHistory.length / pageSize))"
          :page-size="pageSize"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { usePagination } from '../composables/usePagination.js'
import { useSearch } from '../composables/useSearch.js'
import Pagination from '../components/Pagination.vue'
import api from '../api/axios.js'
import { formatDate } from '../utils/formatDate.js'

const statusFilter = ref('')
const borrowHistory = ref([])

const { searchQuery, filteredData: searchedHistory } = useSearch(borrowHistory, ['MSV', 'fullName', 'nameBook'])

const filteredHistory = computed(() => {
  let result = searchedHistory.value

  if (statusFilter.value === 'returned') {
    result = result.filter(record => record.returnDate)
  } else if (statusFilter.value === 'overdue') {
    const today = new Date()
    result = result.filter(record => !record.returnDate && new Date(record.timeEnd) < today)
  }

  return result
})

// Sử dụng phân trang
const { currentPage, pageSize, paginatedItems, goToPage, changePageSize } = usePagination(filteredHistory, 10)

async function fetchBorrowHistory() {
  try {
    const response = await api.get('/borrows/history')
    borrowHistory.value = response.data
  } catch (error) {
    console.error('Lỗi lấy lịch sử mượn sách:', error)
  }
}

onMounted(fetchBorrowHistory)

function getStatusText(record) {
  if (record.returnDate) return 'Đã trả'
  const today = new Date()
  const dueDate = new Date(record.timeEnd)
  if (dueDate < today) return 'Quá hạn'
  return 'Đang mượn'
}

function getStatusClass(record) {
  if (record.returnDate) return 'returned'
  const today = new Date()
  const dueDate = new Date(record.timeEnd)
  if (dueDate < today) return 'overdue'
  return 'active'
}

const handlePageChange = (page) => {
  goToPage(page)
}

const handlePageSizeChange = (newSize) => {
  changePageSize(newSize)
}
</script>

<style scoped>
.borrow-history {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
}

.borrow-history h2 {
  color: #2c3e50;
  font-size: 2rem;
  font-weight: 700;
  margin-bottom: 2rem;
}

.filter-section {
  margin-bottom: 1.5rem;
  display: flex;
  gap: 1rem;
  align-items: center;
}

.search-input {
  padding: 0.75rem 1rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  width: 100%;
  max-width: 400px;
  flex: 1;
  font-size: 1rem;
}

.search-input:focus {
  outline: none;
  border-color: #42b983;
  box-shadow: 0 0 0 3px rgba(66, 185, 131, 0.1);
}

.status-filter {
  padding: 0.75rem 1rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 1rem;
  min-width: 150px;
  background: white;
  cursor: pointer;
}

.table-container {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

.history-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 2rem;
}

.history-table th,
.history-table td {
  border: 1px solid #e2e8f0;
  padding: 12px;
  text-align: left;
}

.history-table th {
  background-color: #f8fafc;
  color: #334155;
  font-weight: 700;
}

.history-table tbody tr:nth-child(even) {
  background-color: #f8fafc;
}

.history-table tbody tr:hover {
  background-color: #f1f5f9;
}

.status-badge {
  padding: 0.25rem 0.75rem;
  border-radius: 12px;
  font-size: 0.85rem;
  font-weight: bold;
}

.status-badge.active {
  background-color: #d1ecf1;
  color: #0c5460;
}

.status-badge.returned {
  background-color: #d4edda;
  color: #155724;
}

.status-badge.overdue {
  background-color: #f8d7da;
  color: #721c24;
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
