<template>
  <div class="container">
    <section class="card-section form-section">
      <div class="form-header">
        <h3>✨ Thêm Sinh Viên Mới</h3>
        <p>Điền đầy đủ các thông tin bên dưới để đăng ký sinh viên vào hệ thống thư viện.</p>
      </div>
      <form @submit.prevent="addStudent" class="student-form-grid">
        <div class="form-group">
          <label>Mã số sinh viên (MSV)</label>
          <input v-model="newStudent.MSV" type="text" placeholder="Ví dụ: BH01234" required />
          <span v-if="formErrors.MSV" class="error-text">{{ formErrors.MSV }}</span>
        </div>
        <div class="form-group">
          <label>Họ và tên</label>
          <input v-model="newStudent.fullName" type="text" placeholder="Nhập tên đầy đủ" required />
          <span v-if="formErrors.fullName" class="error-text">{{ formErrors.fullName }}</span>
        </div>
        <div class="form-group">
          <label>Lớp học</label>
          <input v-model="newStudent.class" type="text" placeholder="Ví dụ: IT1801" required />
          <span v-if="formErrors.class" class="error-text">{{ formErrors.class }}</span>
        </div>
        <div class="form-group">
          <label>Địa chỉ Email</label>
          <input v-model="newStudent.email" type="email" placeholder="student@fpt.edu.vn" required />
          <span v-if="formErrors.email" class="error-text">{{ formErrors.email }}</span>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn-add-student">
            <span>➕</span> Xác nhận thêm sinh viên
          </button>
        </div>
      </form>
    </section>

    <div class="filter-section">
      <input v-model="searchQuery" type="text" placeholder="🔍 Tìm kiếm sinh viên theo MSV, tên, lớp hoặc email..." class="search-input" />
    </div>

    <section class="list-section">
      <h3 class="list-title">Danh sách sinh viên ({{ filteredStudents.length }})</h3>

      <div v-if="filteredStudents.length === 0" class="empty-list">
        Không tìm thấy sinh viên nào phù hợp.
      </div>

      <template v-else>
        <table class="student-table">
          <thead>
            <tr>
              <th>MSV</th>
              <th>Họ và Tên</th>
              <th>Lớp</th>
              <th>Email</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="student in paginatedStudents" :key="student.MSV">
              <td>{{ student.MSV }}</td>
              <td>{{ student.fullName }}</td>
              <td>{{ student.class }}</td>
              <td>{{ student.email }}</td>
              <td>
                <button @click="openEditModal(student)" class="btn-edit">Sửa</button>
                <button @click="deleteStudent(student.MSV)" class="btn-delete">Xóa</button>
              </td>
            </tr>
          </tbody>
        </table>

        <Pagination v-model:currentPage="currentPage" :total-pages="totalPages" />
      </template>
    </section>

    <!-- Modal Sửa Sinh viên -->
    <div v-if="isEditModalOpen" class="modal-overlay" @click.self="isEditModalOpen = false">
      <div class="modal-content">
        <h3>📝 Chỉnh sửa thông tin sinh viên</h3>
        <form @submit.prevent="updateStudent" class="edit-form">
          <label>MSV</label>
          <input v-model="editingStudent.MSV" type="text" required />
          <label>Họ và tên</label>
          <input v-model="editingStudent.fullName" type="text" required />
          <label>Lớp</label>
          <input v-model="editingStudent.class" type="text" required />
          <label>Email</label>
          <input v-model="editingStudent.email" type="email" required />
          <div class="modal-actions">
            <button type="button" class="btn-cancel" @click="isEditModalOpen = false">Hủy</button>
            <button type="submit" class="btn-submit">Lưu thay đổi</button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue';
import { useValidation } from '../composables/useValidation.js'; // Thêm .js
import api from '../api/axios.js'; // Thêm .js
import { useSearch } from '../composables/useSearch.js'
import Pagination from '../components/Pagination.vue'

const { validate } = useValidation(); // Sử dụng composable

// Định nghĩa các quy tắc kiểm tra cho sinh viên
const studentValidationRules = {
  MSV: [
    { type: 'required', message: 'Vui lòng nhập Mã sinh viên!' },
    { type: 'maxLength', value: 50, message: 'Mã sinh viên không được vượt quá 50 ký tự.' }
  ],
  fullName: [
    { type: 'required', message: 'Vui lòng nhập Họ và tên!' },
    { type: 'maxLength', value: 255, message: 'Họ và tên không được vượt quá 255 ký tự.' }
  ],
  class: [
    { type: 'required', message: 'Vui lòng nhập Lớp!' },
    { type: 'maxLength', value: 50, message: 'Lớp không được vượt quá 50 ký tự.' }
  ],
  email: [
    { type: 'required', message: 'Vui lòng nhập Email!' },
    { type: 'isEmail', message: 'Email không hợp lệ.' },
    { type: 'maxLength', value: 100, message: 'Email không được vượt quá 100 ký tự.' }
  ]
};



const students = ref([])
const isEditModalOpen = ref(false)
const newStudent = ref({ MSV: '', fullName: '', class: '', email: '' })
const formErrors = ref({})
const editingStudent = ref({ MSV: '', fullName: '', class: '', email: '', oldMsv: '' })

const { searchQuery, filteredData: filteredStudents } = useSearch(students, ['MSV', 'fullName', 'class', 'email'])

// Phân trang (client-side) đồng bộ với các trang khác
const currentPage = ref(1)
const pageSize = 8
const totalPages = computed(() => Math.max(1, Math.ceil(filteredStudents.value.length / pageSize)))
const paginatedStudents = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  return filteredStudents.value.slice(start, start + pageSize)
})

// Khi tìm kiếm hoặc dữ liệu đổi, đưa về trang 1 nếu trang hiện tại vượt quá
watch([filteredStudents], () => {
  if (currentPage.value > totalPages.value) currentPage.value = 1
})

async function fetchStudents() {
  // Lấy toàn bộ sinh viên rồi phân trang phía client
  const res = await api.get('/students', { params: { limit: 1000 } })
  students.value = res.data?.data || []
}

async function addStudent() {
  const errors = validate(newStudent.value, studentValidationRules);
  formErrors.value = errors;
  if (Object.keys(errors).length > 0) {
    return;
  }

  try {
    await api.post('/students', newStudent.value)
    alert('🎉 Thêm sinh viên thành công!')
    fetchStudents()
    newStudent.value = { MSV: '', fullName: '', class: '', email: '' }
    formErrors.value = {}
  } catch (error) {
    alert('❌ Lỗi: ' + (error.response?.data?.error || 'Không thể thêm sinh viên.'))
  }
}

function openEditModal(student) {
  editingStudent.value = { ...student, oldMsv: student.MSV }
  isEditModalOpen.value = true
}

async function updateStudent() {
  const errors = validate(editingStudent.value, studentValidationRules);
  if (Object.keys(errors).length > 0) {
    return;
  }

  try {
    await api.put(`/students/${editingStudent.value.oldMsv}`, editingStudent.value)
    alert('✅ Cập nhật thông tin thành công!')
    isEditModalOpen.value = false
    fetchStudents()
  } catch (error) {
    alert('❌ Lỗi: ' + (error.response?.data?.error || 'Cập nhật thất bại.'))
  }
}

async function deleteStudent(msv) {
  if (!confirm('Xác nhận xóa sinh viên này?')) return
  try {
    await api.delete(`/students/${msv}`)
    fetchStudents()
  } catch (error) {
    alert('❌ Lỗi: ' + (error.response?.data?.error || 'Xóa thất bại.'))
  }
}

onMounted(fetchStudents)
</script>

<style scoped>
@import '../assets/style/StudentManagement.css';
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

/* Định dạng mới cho Form Thêm Sinh Viên */
.form-header {
  margin-bottom: 2rem;
  border-bottom: 2px solid #f0f2f5;
  padding-bottom: 1rem;
}

.form-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.5rem;
}

.form-header p {
  margin: 0.5rem 0 0;
  color: #7f8c8d;
  font-size: 0.9rem;
}

.student-form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 1.5rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #34495e;
  font-size: 0.9rem;
}

.form-group input {
  padding: 0.8rem;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus {
  border-color: #42b983;
  outline: none;
  box-shadow: 0 0 0 3px rgba(66, 185, 131, 0.1);
}

.form-actions {
  grid-column: span 2;
  display: flex;
  justify-content: flex-end;
  margin-top: 1rem;
}

.btn-add-student {
  background-color: #42b983;
  color: white;
  border: none;
  padding: 0.8rem 2rem;
  border-radius: 6px;
  font-weight: bold;
  cursor: pointer;
  transition: background-color 0.2s;
}

.btn-add-student:hover {
  background-color: #3aa876;
}
</style>
