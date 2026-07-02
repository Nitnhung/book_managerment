<template>
  <div class="student-history">
    <div class="page-header">
      <h2>🕒 Lịch sử mượn sách của tôi</h2>
      <p v-if="student" class="student-info">
        👤 <strong>{{ student.fullName }}</strong>
        <span v-if="student.MSV"> · MSV: {{ student.MSV }}</span>
        <span v-if="student.class"> · Lớp: {{ student.class }}</span>
      </p>
    </div>

    <div class="summary-cards">
      <div class="card">
        <span class="card-number">{{ totalCount }}</span>
        <span class="card-label">Tổng lượt mượn</span>
      </div>
      <div class="card borrowing">
        <span class="card-number">{{ borrowingCount }}</span>
        <span class="card-label">Đang mượn</span>
      </div>
      <div class="card returned">
        <span class="card-number">{{ returnedCount }}</span>
        <span class="card-label">Đã trả</span>
      </div>
    </div>

    <div class="filter-section">
      <input
        v-model="searchQuery"
        type="text"
        placeholder="🔍 Tìm theo tên sách hoặc tác giả..."
        class="search-input"
      />
    </div>

    <div v-if="loading" class="state-msg">Đang tải dữ liệu...</div>
    <div v-else-if="errorMsg" class="state-msg error">{{ errorMsg }}</div>
    <div v-else-if="filteredRecords.length === 0" class="state-msg">
      Bạn chưa có lịch sử mượn sách nào.
    </div>

    <div v-else class="table-container">
      <table class="history-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Tên Sách</th>
            <th>Tác Giả</th>
            <th>Ngày Mượn</th>
            <th>Hạn Trả</th>
            <th>Ngày Trả Thực Tế</th>
            <th>Trạng Thái</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in filteredRecords" :key="record.IdRent">
            <td>{{ record.IdRent }}</td>
            <td>{{ record.nameBook }}</td>
            <td>{{ record.author }}</td>
            <td>{{ formatDate(record.timeStart) }}</td>
            <td>{{ formatDate(record.timeEnd) }}</td>
            <td>{{ record.returnActualDate ? formatDate(record.returnActualDate) : '—' }}</td>
            <td>
              <span v-if="isReturned(record)" class="badge returned">Đã trả</span>
              <span v-else-if="isOverdue(record)" class="badge overdue">Quá hạn</span>
              <span v-else class="badge borrowing">Đang mượn</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import api from '../api/axios.js'
import { useSearch } from '../composables/useSearch.js'

const records = ref([])
const loading = ref(true)
const errorMsg = ref('')
const student = ref(null)

const { searchQuery, filteredData: filteredRecords } = useSearch(records, ['nameBook', 'author'])

function isReturned(record) {
  return record.status === 0 || record.status === '0' || record.returnActualDate
}

function isOverdue(record) {
  return !isReturned(record) && record.timeEnd && new Date(record.timeEnd) < new Date()
}

const totalCount = computed(() => records.value.length)
const borrowingCount = computed(() => records.value.filter(r => !isReturned(r)).length)
const returnedCount = computed(() => records.value.filter(r => isReturned(r)).length)

function loadStudent() {
  try {
    const raw = localStorage.getItem('user')
    if (raw) {
      student.value = JSON.parse(raw)
    }
  } catch (e) {
    student.value = null
  }
}

async function fetchHistory() {
  loading.value = true
  errorMsg.value = ''
  try {
    const response = await api.get('/my-borrows')
    records.value = response.data?.data || []
  } catch (error) {
    errorMsg.value = error.response?.data?.error || 'Không thể tải lịch sử mượn sách.'
  } finally {
    loading.value = false
  }
}

function formatDate(dateStr) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getFullYear()}`
}

onMounted(() => {
  loadStudent()
  fetchHistory()
})
</script>

<style scoped>
.student-history {
  max-width: 1100px;
  margin: 0 auto;
}
.page-header {
  margin-bottom: 1.5rem;
}
.page-header h2 {
  margin: 0 0 0.5rem;
  color: #2c3e50;
}
.student-info {
  margin: 0;
  color: #555;
}
.summary-cards {
  display: flex;
  gap: 1rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}
.card {
  flex: 1;
  min-width: 150px;
  background: white;
  border-radius: 10px;
  padding: 1.2rem;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  border-left: 5px solid #4caf50;
}
.card.borrowing { border-left-color: #ff9800; }
.card.returned { border-left-color: #2196f3; }
.card-number {
  display: block;
  font-size: 2rem;
  font-weight: 700;
  color: #2c3e50;
}
.card-label {
  color: #777;
  font-size: 0.9rem;
}
.filter-section {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 1rem;
}
.search-input {
  padding: 0.75rem 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  width: 100%;
  max-width: 400px;
}
.state-msg {
  background: white;
  padding: 2rem;
  border-radius: 10px;
  text-align: center;
  color: #777;
}
.state-msg.error { color: #e74c3c; }
.table-container {
  background: white;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
}
.history-table {
  width: 100%;
  border-collapse: collapse;
}
.history-table th,
.history-table td {
  padding: 0.9rem 1rem;
  text-align: left;
  border-bottom: 1px solid #eee;
}
.history-table thead th {
  background: #2c3e50;
  color: white;
  font-weight: 600;
}
.history-table tbody tr:hover {
  background: #f9fafb;
}
.badge {
  display: inline-block;
  padding: 0.25rem 0.7rem;
  border-radius: 999px;
  font-size: 0.8rem;
  font-weight: 600;
  color: white;
}
.badge.borrowing { background: #ff9800; }
.badge.returned { background: #2196f3; }
.badge.overdue { background: #e74c3c; }
</style>
