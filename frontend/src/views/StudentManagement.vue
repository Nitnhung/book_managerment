<template>
  <div class="container">
    <!-- Header với nút thêm sinh viên -->
    <div class="page-header">
      <h2>👨‍🎓 Quản Lý Sinh Viên</h2>
      <button @click="openAddModal" class="btn-add">➕ Thêm Sinh Viên</button>
    </div>

    <!-- Bộ lọc -->
    <div class="filter-section">
      <input v-model="searchQuery" type="text" placeholder="🔍 Tìm kiếm sinh viên theo MSV, tên, lớp hoặc email..." class="search-input" />
    </div>

    <!-- Danh sách sinh viên -->
    <section class="list-section">
      <div v-if="searchedStudents.length === 0" class="empty-list">
        Không tìm thấy sinh viên nào.
      </div>

      <div v-else>
        <table class="borrow-table">
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
            <tr v-for="student in paginatedItems" :key="student.MSV">
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

        <!-- Phân trang -->
        <Pagination
          :current-page="currentPage"
          :total-pages="Math.ceil(searchedStudents.length / pageSize) || 1"
          :page-size="pageSize"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        />
      </div>
    </section>

    <!-- Modal Thêm Sinh Viên -->
    <div v-if="isAddModalOpen" class="modal-overlay" @click.self="isAddModalOpen = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>➕ Thêm Sinh Viên Mới</h3>
          <button @click="isAddModalOpen = false" class="btn-close">×</button>
        </div>
        <form @submit.prevent="addStudent" class="edit-form">
          <div class="form-group">
            <label>Mã số sinh viên (MSV) *</label>
            <input v-model="newStudent.MSV" type="text" placeholder="Ví dụ: BH01234" required />
            <span v-if="formErrors.MSV" class="error-text">{{ formErrors.MSV }}</span>
          </div>
          
          <div class="form-group">
            <label>Họ và tên *</label>
            <input v-model="newStudent.fullName" type="text" placeholder="Nhập tên đầy đủ" required />
            <span v-if="formErrors.fullName" class="error-text">{{ formErrors.fullName }}</span>
          </div>
          
          <div class="form-group">
            <label>Lớp học *</label>
            <input list="classList" v-model="newStudent.class" type="text" placeholder="Chọn hoặc nhập lớp (Ví dụ: IT1801)" required />
            <datalist id="classList">
              <option v-for="c in uniqueClasses" :key="c" :value="c"></option>
            </datalist>
            <span v-if="formErrors.class" class="error-text">{{ formErrors.class }}</span>
          </div>
          
          <div class="form-group">
            <label>Địa chỉ Email *</label>
            <input v-model="newStudent.email" type="email" placeholder="student@fpt.edu.vn" required />
            <span v-if="formErrors.email" class="error-text">{{ formErrors.email }}</span>
          </div>
          
          <div class="modal-actions">
            <button type="button" class="btn-cancel" @click="isAddModalOpen = false">Hủy</button>
            <button type="submit" class="btn-submit">Thêm sinh viên</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Sửa Sinh Viên -->
    <div v-if="isEditModalOpen" class="modal-overlay" @click.self="isEditModalOpen = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>📝 Chỉnh sửa thông tin sinh viên</h3>
          <button @click="isEditModalOpen = false" class="btn-close">×</button>
        </div>
        <form @submit.prevent="updateStudent" class="edit-form">
          <div class="form-group">
            <label>MSV</label>
            <input v-model="editingStudent.MSV" type="text" disabled />
            <small>Không thể thay đổi MSV</small>
          </div>
          
          <div class="form-group">
            <label>Họ và tên *</label>
            <input v-model="editingStudent.fullName" type="text" required />
            <span v-if="formErrors.fullName" class="error-text">{{ formErrors.fullName }}</span>
          </div>
          
          <div class="form-group">
            <label>Lớp *</label>
            <input list="classList" v-model="editingStudent.class" type="text" required />
            <span v-if="formErrors.class" class="error-text">{{ formErrors.class }}</span>
          </div>
          
          <div class="form-group">
            <label>Email *</label>
            <input v-model="editingStudent.email" type="email" required />
            <span v-if="formErrors.email" class="error-text">{{ formErrors.email }}</span>
          </div>
          
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
import { ref, onMounted, computed } from 'vue'
import { useValidation } from '../composables/useValidation.js'
import { usePagination } from '../composables/usePagination.js'
import { useSearch } from '../composables/useSearch.js'
import Pagination from '../components/Pagination.vue'
import api from '../api/axios.js'

const { validate } = useValidation()

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
}

const students = ref([])
const isAddModalOpen = ref(false)
const isEditModalOpen = ref(false)
const newStudent = ref({ MSV: '', fullName: '', class: '', email: '' })
const editingStudent = ref({ MSV: '', fullName: '', class: '', email: '', oldMsv: '' })
const formErrors = ref({})

const { searchQuery, filteredData: searchedStudents } = useSearch(students, ['MSV', 'fullName', 'class', 'email'])

// Sử dụng phân trang
const { currentPage, pageSize, paginatedItems, goToPage, changePageSize } = usePagination(searchedStudents, 10)

const uniqueClasses = computed(() => {
  return [...new Set(students.value.map(s => s.class))].filter(Boolean).sort()
})



async function fetchStudents() {
  // Lấy toàn bộ sinh viên rồi phân trang phía client
  const res = await api.get('/students', { params: { limit: 1000 } })
  students.value = res.data || []
}

function openAddModal() {
  isAddModalOpen.value = true
  newStudent.value = { MSV: '', fullName: '', class: '', email: '' }
  formErrors.value = {}
}

async function addStudent() {
  const errors = validate(newStudent.value, studentValidationRules)
  formErrors.value = errors
  if (Object.keys(errors).length > 0) return

  try {
    await api.post('/students', newStudent.value)
    alert('🎉 Thêm sinh viên thành công!')
    isAddModalOpen.value = false
    fetchStudents()
  } catch (error) {
    alert('❌ Lỗi: ' + (error.response?.data?.error || 'Không thể thêm sinh viên.'))
  }
}

function openEditModal(student) {
  editingStudent.value = { ...student, oldMsv: student.MSV }
  isEditModalOpen.value = true
  formErrors.value = {}
}

async function updateStudent() {
  const errors = validate(editingStudent.value, studentValidationRules)
  formErrors.value = errors
  if (Object.keys(errors).length > 0) return

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
    alert('🎉 Đã xóa sinh viên thành công!')
    fetchStudents()
  } catch (error) {
    alert('❌ Lỗi: ' + (error.response?.data?.error || 'Xóa thất bại.'))
  }
}

const handlePageChange = (page) => {
  goToPage(page)
}

const handlePageSizeChange = (newSize) => {
  changePageSize(newSize)
}

onMounted(fetchStudents)
</script>

<style scoped>
.container {
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

.list-section {
  background: white;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
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

.btn-edit {
  background: #3b82f6;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  margin-right: 0.5rem;
}

.btn-edit:hover {
  background: #2563eb;
}

.btn-delete {
  background: #ef4444;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.btn-delete:hover {
  background: #dc2626;
}

.empty-list {
  text-align: center;
  padding: 3rem;
  color: #94a3b8;
  font-size: 1.1rem;
  background: #f8fafc;
  border-radius: 8px;
}

/* Modal Styles */
.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f0f0f0;
}

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.5rem;
}

.btn-close {
  background: none;
  border: none;
  font-size: 2rem;
  color: #94a3b8;
  cursor: pointer;
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s;
}

.btn-close:hover {
  background: #f1f5f9;
  color: #ef4444;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  font-size: 0.9rem;
  color: #34495e;
}

.form-group input {
  padding: 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus {
  outline: none;
  border-color: #42b983;
  box-shadow: 0 0 0 3px rgba(66, 185, 131, 0.1);
}

.form-group input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.form-group small {
  color: #7f8c8d;
  font-size: 0.85rem;
  margin-top: -0.25rem;
}

.error-text {
  color: #ef4444;
  font-size: 0.85rem;
  margin-top: -0.25rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 2px solid #f0f0f0;
}

.btn-cancel {
  background-color: #94a3b8;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.3s;
}

.btn-cancel:hover {
  background-color: #64748b;
}

.btn-submit {
  background-color: #42b983;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.3s;
}

.btn-submit:hover {
  background-color: #3aa876;
}
</style>
