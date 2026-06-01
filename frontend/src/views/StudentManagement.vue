<template>
  <div class="container">
    <section class="card-section form-section">
      <h3>👤 Quản lý Thông tin Sinh viên</h3>
      <form @submit.prevent="addStudent" class="book-form">
        <input v-model="newStudent.MSV" type="text" placeholder="Mã sinh viên (MSV)" required />
        <input v-model="newStudent.fullName" type="text" placeholder="Họ và tên" required />
        <input v-model="newStudent.class" type="text" placeholder="Lớp (Ví dụ: IT1801)" required />
        <input v-model="newStudent.email" type="email" placeholder="Email liên lạc" required />
        <button type="submit" class="btn-submit">Thêm sinh viên</button>
      </form>
    </section>

    <section class="list-section">
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
          <tr v-for="student in students" :key="student.MSV">
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
import { ref, onMounted } from 'vue'

const students = ref([])
const isEditModalOpen = ref(false)
const newStudent = ref({ MSV: '', fullName: '', class: '', email: '' })
const editingStudent = ref({ MSV: '', fullName: '', class: '', email: '', oldMsv: '' })

async function fetchStudents() {
  const res = await fetch('http://localhost:3000/api/students')
  students.value = await res.json()
}

async function addStudent() {
  const res = await fetch('http://localhost:3000/api/students', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(newStudent.value)
  })
  if (res.ok) {
    alert('🎉 Thêm sinh viên thành công!')
    fetchStudents()
    newStudent.value = { MSV: '', fullName: '', class: '', email: '' }
  } else {
    const err = await res.json()
    alert('❌ Lỗi: ' + (err.error || 'Không thể thêm sinh viên. Có thể MSV đã tồn tại.'))
  }
}

function openEditModal(student) {
  editingStudent.value = { ...student, oldMsv: student.MSV }
  isEditModalOpen.value = true
}

async function updateStudent() {
  const res = await fetch(`http://localhost:3000/api/students/${editingStudent.value.oldMsv}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(editingStudent.value)
  })
  if (res.ok) {
    alert('✅ Cập nhật thông tin thành công!')
    isEditModalOpen.value = false
    fetchStudents()
  }
}

async function deleteStudent(msv) {
  if (!confirm('Xác nhận xóa sinh viên này?')) return
  const res = await fetch(`http://localhost:3000/api/students/${msv}`, { method: 'DELETE' })
  if (res.ok) {
    fetchStudents()
  } else {
    const err = await res.json()
    alert(err.error)
  }
}

onMounted(fetchStudents)
</script>

<style scoped src="../assets/style/StudentManagement.css"></style>
