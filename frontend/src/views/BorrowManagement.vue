<template>
  <div class="borrow-management">
    <h2>📋 Quản lý Thẻ Mượn / Trả Sách</h2>
    
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
            <th>Tên Sách</th>
            <th>Ngày Mượn</th>
            <th>Hạn Trả / Ngày Trả</th>
            <th>Hành Động</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="record in borrowRecords" :key="record.IdRent">
            <td>{{ record.IdRent }}</td>
            <td>{{ record.MSV }}</td>
            <td>{{ record.nameBook }}</td>
            <td>{{ formatDate(record.timeStart) }}</td>
            <td>{{ formatDate(record.timeEnd) }}</td>
            <td>
              <button @click="returnBook(record.IdRent)" class="btn-return">Trả Sách</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'

const borrowRecords = ref([])  // Danh sách thẻ mượn hiển thị trong bảng
const availableBooks = ref([])  // Danh sách sách đang có sẵn trong kho để chọn
const studentName = ref('')     // Hiển thị tên sinh viên khi tìm thấy

// Dữ liệu cho form lập thẻ mượn
const newRecord = ref({
  MSV: '',
  IdBook: ''
})

// 1. Lấy danh sách sách và lọc chỉ lấy những cuốn có sẵn (isAvailable) để mượn
async function fetchAvailableBooks() {
  try {
    const response = await fetch('http://localhost:3000/api/books')
    const data = await response.json()
    
    // Chuyển đổi và lọc sách có sẵn
    availableBooks.value = data
      .map(b => ({
        IdBook: b.IdBook,
        nameBook: b.nameBook,
        isAvailable: b.status === 1 || b.status === true || b.status === '1'
      }))
      .filter(book => book.isAvailable)
  } catch (error) {
    console.error('Lỗi lấy danh sách sách:', error)
  }
}


// 2. Lấy danh sách các thẻ mượn đang có trong hệ thống
async function fetchBorrowRecords() {
  try {
    const response = await fetch('http://localhost:3000/api/borrows')
    const data = await response.json()
    borrowRecords.value = data
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
    const response = await fetch(`http://localhost:3000/api/students/${newRecord.value.MSV}`)
    if (response.ok) {
      const data = await response.json()
      studentName.value = data.fullName
    } else {
      studentName.value = '❌ Không tìm thấy sinh viên này!'
    }
  } catch (error) {
    console.error('Lỗi kiểm tra sinh viên:', error)
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
  if (!newRecord.value.MSV || !newRecord.value.IdBook) {
    alert('Vui lòng điền đầy đủ Mã sinh viên và chọn Sách!')
    return
  }

  if (studentName.value.includes('Không tìm thấy')) {
    alert('Không thể lập thẻ cho sinh viên không tồn tại!')
    return
  }

  try {
    // Gửi MSV và ID sách lên Backend để xử lý mượn
    const response = await fetch('http://localhost:3000/api/borrows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        MSV: newRecord.value.MSV,
        IdBook: parseInt(newRecord.value.IdBook)
      })
    })

    if (response.ok) {
      alert('🎉 Lập thẻ mượn sách thành công!')
      // Reset lại form nhập
      newRecord.value.MSV = ''
      newRecord.value.IdBook = ''
      
      // Cập nhật lại UI: Thêm record mới vào bảng và xóa sách vừa mượn khỏi dropdown
      await fetchAvailableBooks()
      await fetchBorrowRecords()
    } else {
      alert('Có lỗi xảy ra khi tạo thẻ mượn.')
    }
  } catch (error) {
    console.error('Lỗi khi lập thẻ mượn:', error)
  }
}

// 4. Chuyển đổi định dạng ngày ISO từ server sang dạng DD/MM/YYYY cho người dùng
function formatDate(dateStr) {
  if (!dateStr) return 'Chưa xác định'
  const d = new Date(dateStr)
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`
}

// 5. Trả sách: Gửi yêu cầu xóa record mượn và khôi phục trạng thái sách
async function returnBook(id) {
  if (!confirm('Bạn có chắc chắn muốn xác nhận sinh viên này đã trả sách không?')) return

  try {
    const response = await fetch(`http://localhost:3000/api/borrows/${id}`, {
      method: 'DELETE' // Gửi yêu cầu DELETE lên API vừa viết ở Bước 1
    })

    if (response.ok) {
      alert('🎉 Đã trả sách thành công! Cuốn sách đã được hoàn lại vào kho.')
      
      // Đồng bộ lại dữ liệu: sách vừa trả sẽ xuất hiện lại trong danh sách mượn
      await fetchBorrowRecords()
      await fetchAvailableBooks()
    } else {
      alert('Có lỗi xảy ra trong quá trình xử lý trả sách.')
    }
  } catch (error) {
    console.error('Lỗi khi trả sách:', error)
  }
}
</script>
<style scoped src="../assets/style/BorrowManagement.css"></style>