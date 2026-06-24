<template>
  <div class="container borrow-requests">
    <h2>📋 Quản Lý Yêu Cầu Mượn Sách</h2>

    <div class="filter-section">
      <input v-model="searchQuery" type="text" placeholder="🔍 Tìm kiếm theo MSV, tên sinh viên hoặc tên sách..." class="search-input" />
      <select v-model="statusFilter" class="status-filter">
        <option value="">Tất cả trạng thái</option>
        <option value="pending">Chờ duyệt</option>
        <option value="approved">Đã duyệt</option>
        <option value="rejected">Đã từ chối</option>
      </select>
    </div>

    <div class="table-container">
      <div v-if="filteredRequests.length === 0" class="empty-list">
        Không có yêu cầu mượn sách nào.
      </div>

      <div v-else>
        <table class="requests-table">
          <thead>
            <tr>
              <th>ID</th>
              <th>Mã Sinh Viên</th>
              <th>Tên Sinh Viên</th>
              <th>Tên Sách</th>
              <th>Ngày Yêu Cầu</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="request in paginatedItems" :key="request.id">
              <td>{{ request.id }}</td>
              <td>{{ request.MSV }}</td>
              <td>{{ request.fullName }}</td>
              <td>{{ request.bookTitle }}</td>
              <td>{{ formatDate(request.requestDate) }}</td>
              <td>
                <span :class="['status-badge', request.status]">
                  {{ getStatusText(request.status) }}
                </span>
              </td>
              <td>
                <button v-if="request.status === 'pending'" @click="approveRequest(request.id)" class="btn-approve">Duyệt</button>
                <button v-if="request.status === 'pending'" @click="rejectRequest(request.id)" class="btn-reject">Từ chối</button>
                <span v-else class="no-action">-</span>
              </td>
            </tr>
          </tbody>
        </table>

        <Pagination
          :current-page="currentPage"
          :total-pages="Math.max(1, Math.ceil(filteredRequests.length / pageSize))"
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
import api from '../api/axios.js'
import { useSearch } from '../composables/useSearch.js'
import { usePagination } from '../composables/usePagination.js'
import Pagination from '../components/Pagination.vue'
import { formatDate } from '../utils/formatDate.js'

const statusFilter = ref('')
const borrowRequests = ref([])

const { searchQuery, filteredData: searchedRequests } = useSearch(borrowRequests, ['MSV', 'fullName', 'bookTitle'])

const filteredRequests = computed(() => {
  let result = searchedRequests.value

  if (statusFilter.value) {
    result = result.filter(request => request.status === statusFilter.value)
  }

  return result
})

const { currentPage, pageSize, paginatedItems, goToPage, changePageSize } = usePagination(filteredRequests, 10)

async function fetchBorrowRequests() {
  try {
    const response = await api.get('/borrow-requests')
    borrowRequests.value = response.data
  } catch (error) {
    console.error('Lỗi lấy danh sách yêu cầu mượn:', error)
  }
}

async function approveRequest(id) {
  if (!confirm('Bạn có chắc chắn muốn duyệt yêu cầu này?')) return

  try {
    await api.put(`/borrow-requests/${id}/approve`)
    alert('✅ Đã duyệt yêu cầu mượn sách!')
    fetchBorrowRequests()
  } catch (error) {
    alert('❌ Lỗi: ' + (error.response?.data?.error || 'Không thể duyệt yêu cầu.'))
  }
}

async function rejectRequest(id) {
  if (!confirm('Bạn có chắc chắn muốn từ chối yêu cầu này?')) return

  try {
    await api.put(`/borrow-requests/${id}/reject`)
    alert('✅ Đã từ chối yêu cầu mượn sách!')
    fetchBorrowRequests()
  } catch (error) {
    alert('❌ Lỗi: ' + (error.response?.data?.error || 'Không thể từ chối yêu cầu.'))
  }
}

function getStatusText(status) {
  const statusMap = {
    pending: 'Chờ duyệt',
    approved: 'Đã duyệt',
    rejected: 'Đã từ chối'
  }
  return statusMap[status] || status
}

onMounted(fetchBorrowRequests)

const handlePageChange = (page) => goToPage(page)
const handlePageSizeChange = (newSize) => changePageSize(newSize)
</script>

<style scoped>
.borrow-requests {
  width: 100%;
  box-sizing: border-box;
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
}

.filter-section {
  margin-bottom: 1.5rem;
  display: flex;
  gap: 1rem;
  align-items: center;
}

.search-input {
  padding: 0.75rem 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  width: 100%;
  max-width: 400px;
  flex: 1;
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
  background: white;
  padding-bottom: 0.5rem;
}

.requests-table {
  width: 100%;
  border-collapse: collapse;
}

.requests-table th,
.requests-table td {
  border: 1px solid #eee;
  padding: 0.75rem;
  text-align: left;
}

.requests-table th {
  background-color: #f8f8f8;
  font-weight: bold;
}

.requests-table tbody tr:nth-child(even) {
  background-color: #f9f9f9;
}

.requests-table tbody tr:hover {
  background-color: #f1f1f1;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: bold;
}

.status-badge.pending {
  background-color: #fff3cd;
  color: #856404;
}

.status-badge.approved {
  background-color: #d4edda;
  color: #155724;
}

.status-badge.rejected {
  background-color: #f8d7da;
  color: #721c24;
}

.btn-approve {
  padding: 0.5rem 1rem;
  background-color: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 0.5rem;
}

.btn-reject {
  padding: 0.5rem 1rem;
  background-color: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.no-action {
  color: #999;
}

.empty-list {
  text-align: center;
  padding: 2rem;
  color: #666;
  background-color: #f9f9f9;
  border-radius: 8px;
}
</style>
