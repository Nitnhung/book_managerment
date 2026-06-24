<template>
  <div v-if="isOpen" class="modal-overlay" @click.self="$emit('close')">
    <div class="modal-content">
      <div class="modal-header">
        <h3>{{ mode === 'request' ? '📝 Yêu Cầu Mượn Sách' : '📋 Tạo Thẻ Mượn Mới' }}</h3>
        <button @click="$emit('close')" class="btn-close">×</button>
      </div>
      <form @submit.prevent="handleSubmit" class="edit-form">
        <div class="form-group">
          <label>Mã sinh viên (MSV) *</label>
          <input 
            v-if="mode === 'direct'"
            list="msvList" 
            v-model="formData.MSV" 
            @change="checkStudent" 
            type="text" 
            placeholder="Tìm hoặc nhập MSV (Ví dụ: BH02443)" 
            required 
          />
          <input 
            v-else
            type="text" 
            :value="studentInfo?.MSV || ''" 
            disabled 
            class="disabled-input"
          />
          <datalist v-if="mode === 'direct'" id="msvList">
            <option v-for="student in allStudents" :key="student.MSV" :value="student.MSV">{{ student.fullName }} - {{ student.class }}</option>
          </datalist>
          <span v-if="formErrors.MSV" class="error-text">{{ formErrors.MSV }}</span>
          <small v-if="studentName && !studentName.includes('Không tìm thấy')" class="student-found">👤 Sinh viên: <strong>{{ studentName }}</strong></small>
        </div>
        
        <div class="form-group">
          <label>Chọn sách mượn *</label>
          <input 
            v-if="mode === 'direct'"
            list="bookList" 
            v-model="formData.IdBook" 
            type="text" 
            placeholder="Tìm tên sách hoặc ID..." 
            required 
          />
          <input 
            v-else
            type="text" 
            :value="bookInfo?.nameBook || ''" 
            disabled 
            class="disabled-input"
          />
          <datalist v-if="mode === 'direct'" id="bookList">
            <option v-for="book in availableBooks" :key="book.IdBook" :value="book.IdBook + ' - ' + book.nameBook"></option>
          </datalist>
          <span v-if="formErrors.IdBook" class="error-text">{{ formErrors.IdBook }}</span>
        </div>

        <div class="form-group">
          <label>Ngày bắt đầu mượn *</label>
          <input v-model="formData.borrow_date" type="date" required />
          <span v-if="formErrors.borrow_date" class="error-text">{{ formErrors.borrow_date }}</span>
        </div>

        <div class="form-group">
          <label>Ngày hạn trả *</label>
          <input v-model="formData.due_date" type="date" required />
          <span v-if="formErrors.due_date" class="error-text">{{ formErrors.due_date }}</span>
        </div>

        <div class="modal-actions">
          <button type="button" class="btn-cancel" @click="$emit('close')">Hủy</button>
          <button type="submit" class="btn-submit">{{ mode === 'request' ? 'Gửi Yêu Cầu' : 'Lập Thẻ Mượn' }}</button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, watch } from 'vue'
import { useValidation } from '../composables/useValidation.js'
import api from '../api/axios.js'

const props = defineProps({
  isOpen: Boolean,
  mode: {
    type: String,
    default: 'direct' // 'direct' for librarian, 'request' for student
  },
  availableBooks: Array,
  allStudents: Array,
  bookInfo: Object, // For request mode: { IdBook, nameBook }
  studentInfo: Object // For request mode: { MSV, fullName }
})

const emit = defineEmits(['close', 'submit'])

const { validate } = useValidation()

const formData = ref({
  MSV: '',
  IdBook: '',
  borrow_date: '',
  due_date: ''
})

const formErrors = ref({})
const studentName = ref('')

const validationRules = {
  MSV: [
    { type: 'required', message: 'Vui lòng nhập Mã sinh viên!' },
    { type: 'maxLength', value: 50, message: 'Mã sinh viên không được vượt quá 50 ký tự.' }
  ],
  IdBook: [
    { type: 'required', message: 'Vui lòng chọn Sách!' }
  ],
  borrow_date: [
    { type: 'required', message: 'Vui lòng chọn ngày bắt đầu mượn!' }
  ],
  due_date: [
    { type: 'required', message: 'Vui lòng chọn ngày hạn trả!' }
  ]
}

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    // Reset form when modal opens
    formData.value = {
      MSV: props.studentInfo?.MSV || '',
      IdBook: props.bookInfo ? (props.bookInfo.IdBook + ' - ' + props.bookInfo.nameBook) : '',
      borrow_date: '',
      due_date: ''
    }
    formErrors.value = {}
    studentName.value = props.studentInfo?.fullName || ''
  }
})

watch(() => props.bookInfo, (newVal) => {
  if (newVal && props.mode === 'request') {
    formData.value.IdBook = newVal.IdBook + ' - ' + newVal.nameBook
  }
})

watch(() => props.studentInfo, (newVal) => {
  if (newVal && props.mode === 'request') {
    formData.value.MSV = newVal.MSV
    studentName.value = newVal.fullName
  }
})

async function checkStudent() {
  if (!formData.value.MSV) {
    studentName.value = ''
    return
  }

  try {
    const response = await api.get(`/students/${formData.value.MSV}`)
    studentName.value = response.data.fullName
    formErrors.value.MSV = ''
  } catch (error) {
    studentName.value = '❌ Không tìm thấy sinh viên này!'
    formErrors.value.MSV = 'Không tìm thấy sinh viên này!'
  }
}

watch(() => formData.value.MSV, (newVal) => {
  if (!newVal) {
    studentName.value = ''
  }
})

function handleSubmit() {
  const errors = validate(formData.value, validationRules)
  formErrors.value = errors
  if (Object.keys(errors).length > 0) return

  if (props.mode === 'direct' && studentName.value.includes('Không tìm thấy')) {
    alert('Không thể lập thẻ cho sinh viên không tồn tại!')
    return
  }

  // Validate ngày: due_date phải sau borrow_date
  if (new Date(formData.value.due_date) <= new Date(formData.value.borrow_date)) {
    alert('Ngày hạn trả phải sau ngày bắt đầu mượn!')
    formErrors.value.due_date = 'Ngày hạn trả phải sau ngày bắt đầu mượn!'
    return
  }

  // Phân tích ID sách từ chuỗi "ID - Tên"
  let actualIdBook
  if (props.mode === 'direct') {
    const selectedBookStr = formData.value.IdBook.toString()
    const bookIdMatch = selectedBookStr.match(/^(\d+)/)
    if (!bookIdMatch) {
      alert('Vui lòng chọn sách hợp lệ từ danh sách!')
      formErrors.value.IdBook = 'Vui lòng chọn sách hợp lệ'
      return
    }
    actualIdBook = parseInt(bookIdMatch[1])
  } else {
    actualIdBook = props.bookInfo?.IdBook
  }

  const submitData = {
    MSV: props.mode === 'request' ? props.studentInfo?.MSV : formData.value.MSV,
    IdBook: actualIdBook,
    borrow_date: formData.value.borrow_date,
    due_date: formData.value.due_date
  }

  emit('submit', submitData)
}
</script>

<style scoped>
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

.form-group input,
.form-group select {
  padding: 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s, box-shadow 0.2s;
}

.form-group input:focus,
.form-group select:focus {
  outline: none;
  border-color: #42b983;
  box-shadow: 0 0 0 3px rgba(66, 185, 131, 0.1);
}

.disabled-input {
  background-color: #f1f5f9;
  cursor: not-allowed;
}

.student-found {
  color: #42b983;
  font-size: 0.85rem;
  margin-top: 0.25rem;
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
