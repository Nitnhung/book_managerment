<template>
  <div class="container student-borrow-history">
    <h2>📚 Lịch Sử Mượn Sách Của Tôi</h2>

    <div class="stats-cards">
      <div class="stat-card">
        <div class="stat-icon">📋</div>
        <div class="stat-info">
          <h3>Tổng số lần mượn</h3>
          <p class="stat-number">{{ stats.totalBorrows }}</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">📖</div>
        <div class="stat-info">
          <h3>Đang mượn</h3>
          <p class="stat-number">{{ stats.activeBorrows }}</p>
        </div>
      </div>

      <div class="stat-card">
        <div class="stat-icon">⚠️</div>
        <div class="stat-info">
          <h3>Quá hạn</h3>
          <p class="stat-number">{{ stats.overdueBorrows }}</p>
        </div>
      </div>
    </div>

    <div class="filter-section">
      <select v-model="statusFilter" class="status-filter">
        <option value="">Tất cả</option>
        <option value="active">Đang mượn</option>
        <option value="returned">Đã trả</option>
        <option value="overdue">Quá hạn</option>
      </select>
    </div>

    <div class="table-container">
      <table class="history-table">
        <thead>
          <tr>
            <th>Tên Sách</th>
            <th>Ngày Mượn</th>
            <th>Hạn Trả</th>
            <th>Ngày Trả</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in filteredHistory" :key="record.IdRent">
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
    </div>

    <div v-if="filteredHistory.length === 0" class="empty-list">
      Bạn chưa mượn sách nào.
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import api from '../api/axios.js'
import { formatDate } from '../utils/formatDate.js'

const statusFilter = ref('')
const borrowHistory = ref([])
const stats = ref({
  totalBorrows: 0,
  activeBorrows: 0,
  overdueBorrows: 0
})

const filteredHistory = computed(() => {
  let result = borrowHistory.value

  if (statusFilter.value === 'active') {
    result = result.filter(record => !record.returnDate)
  } else if (statusFilter.value === 'returned') {
    result = result.filter(record => record.returnDate)
  } else if (statusFilter.value === 'overdue') {
    const today = new Date()
    result = result.filter(record => !record.returnDate && new Date(record.timeEnd) < today)
  }

  return result
})

async function fetchBorrowHistory() {
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    if (!user || !user.username) {
      alert('Vui lòng đăng nhập để xem lịch sử mượn sách!')
      return
    }

    const response = await api.get(`/students/${user.username}/borrows`)
    borrowHistory.value = response.data

    // Calculate stats
    stats.value.totalBorrows = borrowHistory.value.length
    stats.value.activeBorrows = borrowHistory.value.filter(record => !record.returnDate).length

    const today = new Date()
    stats.value.overdueBorrows = borrowHistory.value.filter(
      record => !record.returnDate && new Date(record.timeEnd) < today
    ).length
  } catch (error) {
    console.error('Lỗi lấy lịch sử mượn sách:', error)
  }
}

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

onMounted(fetchBorrowHistory)
</script>

<style scoped>
.student-borrow-history {
  width: 100%;
  box-sizing: border-box;
  padding: 2rem;
}

.stats-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.stat-card {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  align-items: center;
  gap: 1rem;
}

.stat-icon {
  font-size: 2.5rem;
}

.stat-info h3 {
  margin: 0;
  font-size: 0.9rem;
  color: #7f8c8d;
  text-transform: uppercase;
}

.stat-info .stat-number {
  margin: 0.25rem 0 0;
  font-size: 1.8rem;
  font-weight: bold;
  color: #2c3e50;
}

.filter-section {
  margin-bottom: 1.5rem;
}

.status-filter {
  padding: 0.75rem 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 1rem;
  min-width: 150px;
}

.table-container {
  border: 1px solid #eee;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  overflow-x: auto;
}

.history-table {
  width: 100%;
  border-collapse: collapse;
}

.history-table th,
.history-table td {
  border: 1px solid #eee;
  padding: 0.75rem;
  text-align: left;
}

.history-table th {
  background-color: #f8f8f8;
  font-weight: bold;
}

.history-table tbody tr:nth-child(even) {
  background-color: #f9f9f9;
}

.history-table tbody tr:hover {
  background-color: #f1f1f1;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
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
  padding: 2rem;
  color: #666;
  background-color: #f9f9f9;
  border-radius: 8px;
}
</style>
