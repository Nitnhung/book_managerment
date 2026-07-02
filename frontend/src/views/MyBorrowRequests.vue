<template>
  <div class="container my-requests">
    <div class="page-header">
      <h2>📝 Lịch Sử Yêu Cầu Mượn Sách</h2>
    </div>

    <!-- Thống kê nhanh -->
    <div class="stats-row">
      <div class="stat-card total">
        <span class="stat-num">{{ stats.total }}</span>
        <span class="stat-label">Tổng yêu cầu</span>
      </div>
      <div class="stat-card pending">
        <span class="stat-num">{{ stats.pending }}</span>
        <span class="stat-label">Đang chờ duyệt</span>
      </div>
      <div class="stat-card approved">
        <span class="stat-num">{{ stats.approved }}</span>
        <span class="stat-label">Đã duyệt</span>
      </div>
      <div class="stat-card rejected">
        <span class="stat-num">{{ stats.rejected }}</span>
        <span class="stat-label">Bị từ chối</span>
      </div>
    </div>

    <!-- Bộ lọc -->
    <div class="filter-bar card-section">
      <select v-model="statusFilter" class="filter-select">
        <option value="">📋 Tất cả trạng thái</option>
        <option value="pending">⏳ Đang chờ duyệt</option>
        <option value="approved">✅ Đã duyệt</option>
        <option value="rejected">❌ Bị từ chối</option>
      </select>
      <input
        v-model="searchQuery"
        type="text"
        placeholder="🔎 Tìm theo tên sách..."
        class="search-input"
      />
      <span class="result-count">{{ filteredRequests.length }} yêu cầu</span>
    </div>

    <!-- Loading -->
    <div v-if="loading" class="empty-list">⏳ Đang tải dữ liệu...</div>

    <!-- Empty -->
    <div v-else-if="filteredRequests.length === 0" class="empty-list">
      <p>{{ statusFilter || searchQuery ? 'Không tìm thấy yêu cầu nào phù hợp.' : 'Bạn chưa gửi yêu cầu mượn sách nào.' }}</p>
      <RouterLink to="/books" class="btn-browse">📚 Xem danh sách sách</RouterLink>
    </div>

    <!-- Bảng dữ liệu -->
    <div v-else class="card-section">
      <div class="table-container">
        <table class="request-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Tên sách</th>
              <th>Tác giả</th>
              <th>Ngày yêu cầu</th>
              <th>Ngày mượn</th>
              <th>Hạn trả</th>
              <th>Trạng thái</th>
              <th>Ngày xử lý</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="req in paginatedItems" :key="req.id" :class="['row', req.status]">
              <td class="id-cell">{{ req.id }}</td>
              <td class="book-title">{{ req.bookTitle }}</td>
              <td>{{ req.bookAuthor }}</td>
              <td>{{ req.requestDate }}</td>
              <td>{{ req.borrowDate || '—' }}</td>
              <td>{{ req.dueDate || '—' }}</td>
              <td>
                <span :class="['status-badge', req.status]">
                  {{ statusLabel(req.status) }}
                </span>
              </td>
              <td>{{ req.approvedDate || '—' }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Pagination
        :current-page="currentPage"
        :total-pages="Math.max(1, totalPages)"
        :page-size="pageSize"
        @page-change="goToPage"
        @page-size-change="changePageSize"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { RouterLink } from 'vue-router'
import { useSearch }     from '../composables/useSearch.js'
import { usePagination } from '../composables/usePagination.js'
import Pagination from '../components/Pagination.vue'
import api from '../api/axios.js'

const loading  = ref(true)
const allData  = ref([])
const statusFilter = ref('')

// Tái sử dụng useSearch — tìm theo tên sách
const { searchQuery, filteredData: searchedData } = useSearch(allData, ['bookTitle', 'bookAuthor'])

// Lọc thêm theo status sau khi search
const filteredRequests = computed(() => {
  if (!statusFilter.value) return searchedData.value
  return searchedData.value.filter(r => r.status === statusFilter.value)
})

// Tái sử dụng usePagination
const { currentPage, pageSize, totalPages, paginatedItems, goToPage, changePageSize, resetPagination } = usePagination(filteredRequests, 10)

// Reset trang khi filter thay đổi
watch([statusFilter, searchQuery], () => resetPagination())

// Thống kê
const stats = computed(() => ({
  total:    allData.value.length,
  pending:  allData.value.filter(r => r.status === 'pending').length,
  approved: allData.value.filter(r => r.status === 'approved').length,
  rejected: allData.value.filter(r => r.status === 'rejected').length,
}))

function statusLabel(status) {
  return { pending: '⏳ Đang chờ', approved: '✅ Đã duyệt', rejected: '❌ Từ chối' }[status] ?? status
}

onMounted(async () => {
  try {
    const res = await api.get('/my-borrow-requests')
    allData.value = res.data
  } catch (e) {
    console.error('Lỗi tải yêu cầu:', e)
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.my-requests { max-width: 1400px; margin: 0 auto; }

.page-header { margin-bottom: 1.25rem; }
.page-header h2 { margin: 0; color: #2c3e50; }

/* Thống kê */
.stats-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 1rem; margin-bottom: 1.25rem;
}
@media (max-width: 640px) { .stats-row { grid-template-columns: repeat(2, 1fr); } }

.stat-card {
  display: flex; flex-direction: column; align-items: center;
  padding: 1rem; border-radius: 10px; background: white;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  border-top: 4px solid transparent;
}
.stat-card.total    { border-color: #3498db; }
.stat-card.pending  { border-color: #f59e0b; }
.stat-card.approved { border-color: #22c55e; }
.stat-card.rejected { border-color: #ef4444; }

.stat-num   { font-size: 1.8rem; font-weight: 700; color: #2c3e50; }
.stat-label { font-size: 0.82rem; color: #7f8c8d; margin-top: 0.2rem; }

/* Filter bar */
.filter-bar {
  display: flex; align-items: center; gap: 1rem;
  flex-wrap: wrap;
}
.filter-select, .search-input {
  padding: 0.6rem 0.9rem; border: 1px solid #dcdfe6;
  border-radius: 8px; font-size: 0.9rem;
  background: white; transition: border-color 0.2s;
}
.filter-select:focus, .search-input:focus {
  outline: none; border-color: #42b983;
}
.search-input { flex: 1; min-width: 200px; }
.result-count { font-size: 0.85rem; color: #7f8c8d; white-space: nowrap; }

/* Table */
.table-container { overflow-x: auto; }
.request-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
.request-table th {
  background: #f8f9fa; padding: 0.7rem 1rem;
  text-align: left; font-weight: 600; color: #2c3e50;
  border-bottom: 2px solid #e2e8f0; white-space: nowrap;
}
.request-table td {
  padding: 0.7rem 1rem; border-bottom: 1px solid #f0f0f0;
  color: #444; vertical-align: middle;
}
.request-table tbody tr:hover { background: #f8fafc; }

/* Màu nền row theo trạng thái */
.request-table tr.approved td { background: rgba(34,197,94,0.04); }
.request-table tr.rejected td { background: rgba(239,68,68,0.04); }

.id-cell    { color: #94a3b8; font-size: 0.8rem; }
.book-title { font-weight: 600; color: #2c3e50; max-width: 200px; }

/* Status badge */
.status-badge {
  padding: 0.3rem 0.7rem; border-radius: 20px;
  font-size: 0.8rem; font-weight: 600; white-space: nowrap;
}
.status-badge.pending  { background: #fef3c7; color: #92400e; }
.status-badge.approved { background: #dcfce7; color: #166534; }
.status-badge.rejected { background: #fee2e2; color: #991b1b; }

/* Empty */
.empty-list {
  text-align: center; padding: 3rem;
  color: #94a3b8; background: #f8fafc;
  border: 2px dashed #e2e8f0; border-radius: 12px;
}
.btn-browse {
  display: inline-block; margin-top: 1rem;
  padding: 0.6rem 1.5rem; background: #42b983;
  color: white; border-radius: 8px; text-decoration: none;
  font-weight: 600; transition: background 0.2s;
}
.btn-browse:hover { background: #3aa876; }
</style>
