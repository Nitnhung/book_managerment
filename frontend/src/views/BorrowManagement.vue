<template>
  <div class="borrow-management">
    <h2>📋 Quản lý Thẻ Mượn / Trả Sách</h2>

    <div class="filter-section">
      <input v-model="searchQuery" type="text" placeholder="🔍 Tìm kiếm theo MSV, tên sinh viên hoặc tên sách..." class="search-input" />
    </div>

    
    <div class="form-container">
      <h3>Tạo Thẻ Mượn Mới</h3>
      <form @submit.prevent="createBorrowRecord">
        <div class="form-group">
          <label>Mã sinh viên (MSV):</label>
          <input v-model="newRecord.MSV" @blur="checkStudent" type="text" placeholder="Ví dụ: BH02443" required />
          <small v-if="studentName" class="student-found">👤 Sinh viên: <strong>{{ studentName }}</strong></small>
        </div>
        <div class="form-group">
          <label>Chọn Sách Mượn:</label>
          <select v-model="newRecord.IdBook" required>
            <option value="" disabled>-- Chọn cuốn sách --</option>
            <option v-for="book in availableBooks" :key="book.IdBook" :value="book.IdBook">
              {{ book.nameBook }}
            </option>
          </select>
        </div>
        <button type="submit" class="btn-submit">Lập Thẻ Mượn</button>
      </form>
    </div>

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
          <tr v-for="record in paginatedBorrowRecords" :key="record.IdRent">
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

      <Pagination v-model:currentPage="currentPage" :total-pages="totalPages" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useValidation } from '../composables/useValidation.js'; // Thêm .js
import api from '../api/axios.js'; // Thêm .js
import { useSearch } from '../composables/useSearch.js'
import Pagination from '../components/Pagination.vue'

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

const borrowRecords = ref([])  // Danh sách thẻ mượn hiển thị trong bảng
const availableBooks = ref([])  // Danh sách sách đang có sẵn trong kho để chọn
const studentName = ref('')     // Hiển thị tên sinh viên khi tìm thấy

// Dữ liệu cho form lập thẻ mượn
const newRecord = ref({
  MSV: '',
  IdBook: ''
})

const { searchQuery, filteredData: filteredBorrowRecords } = useSearch(borrowRecords, ['MSV', 'fullName', 'nameBook'])

// Phân trang (client-side) đồng bộ với các trang khác
const currentPage = ref(1)
const pageSize = 8
const totalPages = computed(() => Math.max(1, Math.ceil(filteredBorrowRecords.value.length / pageSize)))
const paginatedBorrowRecords = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredBorrowRecords.value.slice(start, start + pageSize)
})
watch(filteredBorrowRecords, () => {
  if (currentPage.value > totalPages.value) currentPage.value = 1
})

// 1. Lấy danh sách sách và lọc chỉ lấy những cuốn có sẵn (isAvailable) để mượn
async function fetchAvailableBooks() {
  try {
    const response = await api.get('/books', { params: { limit: 1000 } })
    const data = response.data?.data || []
    
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
    borrowRecords.value = response.data?.data || []
  } catch (error) {
    console.error('Lỗi lấy danh sách thẻ mượn:', error)
  }
}

// Chạy tự động tải dữ liệu khi người dùng vừa truy cập vào trang này
onMounted(() => {
  fetchAvailableBooks()
  fetchBorrowRecords()
})

// 2.1 Hàm kiểm tra thông tin sinh viên khi nhập MSV
async function checkStudent() {
  if (!newRecord.value.MSV) {
    studentName.value = ''
    return
  }

  try {
    const response = await api.get(`/students/${newRecord.value.MSV}`)
    studentName.value = response.data.fullName
  } catch (error) {
    studentName.value = '❌ Không tìm thấy sinh viên này!'
  }
}

// Xóa thông báo tên sinh viên nếu người dùng xóa sạch ô nhập MSV
watch(() => newRecord.value.MSV, (newVal) => {
  if (!newVal) {
    studentName.value = ''
  }
})

// 3. Hàm xử lý gửi dữ liệu lên API tạo thẻ mượn mới
async function createBorrowRecord() {
  const errors = validate(newRecord.value, borrowValidationRules);
  if (Object.keys(errors).length > 0) {
    alert(Object.values(errors).join('\n'));
    return;
  }

  if (studentName.value.includes('Không tìm thấy')) {
    alert('Không thể lập thẻ cho sinh viên không tồn tại!')
    return
  }

  try {
    await api.post('/borrows', {
      MSV: newRecord.value.MSV,
      IdBook: parseInt(newRecord.value.IdBook)
    })

    alert('🎉 Lập thẻ mượn sách thành công!')
    newRecord.value.MSV = ''
    newRecord.value.IdBook = ''
    
    fetchAvailableBooks()
    fetchBorrowRecords()
  } catch (error) {
    alert('Lỗi: ' + (error.response?.data?.error || 'Không thể lập thẻ mượn.'))
  }
}

// 4. Chuyển đổi định dạng ngày ISO từ server sang dạng DD/MM/YYYY cho người dùng
function formatDate(dateStr) {
  if (!dateStr) return 'Chưa xác định'
  const d = new Date(dateStr)
  const day = String(d.getDate()).padStart(2, '0')
  const month = String(d.getMonth() + 1).padStart(2, '0')
  return `${day}/${month}/${d.getFullYear()}`
}

// 5. Trả sách: Gửi yêu cầu xóa record mượn và khôi phục trạng thái sách
async function returnBook(id) {
  if (!confirm('Bạn có chắc chắn muốn xác nhận sinh viên này đã trả sách không?')) return

  try {
    await api.delete(`/borrows/${id}`)
    alert('🎉 Đã trả sách thành công!')
    fetchBorrowRecords()
    fetchAvailableBooks()
  } catch (error) {
    alert('Lỗi: ' + (error.response?.data?.error || 'Xử lý trả sách thất bại.'))
  }
}
</script>
<style scoped>
@import '../assets/style/BorrowManagement.css';

.filter-section {
  margin-bottom: 1.5rem;
  display: flex;
  justify-content: flex-end;
}
.search-input {
  padding: 0.75rem 1rem;
  border: 1px solid #ddd;
  border-radius: 8px;
  width: 100%;
  max-width: 400px;
}
</style>