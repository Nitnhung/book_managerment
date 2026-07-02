<template>
  <div class="container update-profile">
    <h2>👤 Cập Nhật Thông Tin Cá Nhân</h2>

    <div class="profile-card">
      <form @submit.prevent="handleUpdate" class="profile-form">
        <div class="form-group" v-if="isStudent">
          <label>Mã sinh viên (MSV)</label>
          <input v-model="profileData.MSV" type="text" disabled />
          <small>Không thể thay đổi MSV</small>
        </div>

        <div class="form-group" v-if="isAdmin">
          <label>Tên đăng nhập</label>
          <input v-model="profileData.username" type="text" disabled />
          <small>Không thể thay đổi tên đăng nhập</small>
        </div>

        <div class="form-group">
          <label>Họ và tên</label>
          <input v-model="profileData.fullName" type="text" placeholder="Nhập tên đầy đủ" required />
          <span v-if="formErrors.fullName" class="error-text">{{ formErrors.fullName }}</span>
        </div>

        <div class="form-group" v-if="isStudent">
          <label>Lớp học</label>
          <input v-model="profileData.class" type="text" placeholder="Ví dụ: IT1801" required />
          <span v-if="formErrors.class" class="error-text">{{ formErrors.class }}</span>
        </div>

        <div class="form-group" v-if="isStudent">
          <label>Địa chỉ Email</label>
          <input v-model="profileData.email" type="email" placeholder="student@fpt.edu.vn" required />
          <span v-if="formErrors.email" class="error-text">{{ formErrors.email }}</span>
        </div>

        <div class="password-section">
          <h3>Đổi Mật Khẩu (Tùy chọn)</h3>
          <div class="form-group">
            <label>Mật khẩu hiện tại</label>
            <input v-model="passwordData.currentPassword" type="password" placeholder="Nhập mật khẩu hiện tại" />
          </div>

          <div class="form-group">
            <label>Mật khẩu mới</label>
            <input v-model="passwordData.newPassword" type="password" placeholder="Tạo mật khẩu mới" />
            <span v-if="formErrors.newPassword" class="error-text">{{ formErrors.newPassword }}</span>
          </div>

          <div class="form-group">
            <label>Xác nhận mật khẩu mới</label>
            <input v-model="passwordData.confirmPassword" type="password" placeholder="Nhập lại mật khẩu mới" />
            <span v-if="formErrors.confirmPassword" class="error-text">{{ formErrors.confirmPassword }}</span>
          </div>
        </div>

        <p v-if="updateError" class="error-text global-error">{{ updateError }}</p>
        <p v-if="updateSuccess" class="success-text">{{ updateSuccess }}</p>

        <div class="form-actions">
          <button type="submit" class="btn-update" :disabled="isUpdating">
            {{ isUpdating ? 'Đang cập nhật...' : 'Lưu Thay Đổi' }}
          </button>
        </div>
      </form>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { useValidation } from '../composables/useValidation.js'
import api from '../api/axios.js'

const { validate } = useValidation()

const isUpdating = ref(false)
const updateError = ref('')
const updateSuccess = ref('')
const formErrors = ref({})
const userRole = ref('')

const profileData = ref({
  MSV: '',
  username: '',
  fullName: '',
  class: '',
  email: ''
})

const isStudent = computed(() => userRole.value === 'student')
const isAdmin = computed(() => userRole.value === 'admin' || userRole.value === 'librarian')

const passwordData = ref({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
})

const profileRules = computed(() => {
  const rules = {
    fullName: [
      { type: 'required', message: 'Vui lòng nhập Họ và tên!' },
      { type: 'maxLength', value: 255, message: 'Họ và tên không được vượt quá 255 ký tự.' }
    ]
  }

  // Chỉ validate class và email cho sinh viên
  if (isStudent.value) {
    rules.class = [
      { type: 'required', message: 'Vui lòng nhập Lớp!' },
      { type: 'maxLength', value: 50, message: 'Lớp không được vượt quá 50 ký tự.' }
    ]
    rules.email = [
      { type: 'required', message: 'Vui lòng nhập Email!' },
      { type: 'isEmail', message: 'Email không hợp lệ.' },
      { type: 'maxLength', value: 100, message: 'Email không được vượt quá 100 ký tự.' }
    ]
  }

  return rules
})

async function fetchProfile() {
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    if (!user) {
      alert('Vui lòng đăng nhập để cập nhật hồ sơ!')
      return
    }

    userRole.value = user.role || ''

    const response = await api.get('/profile')

    if (isStudent.value) {
      profileData.value = {
        MSV:      response.data.MSV || response.data.username || '',
        username: response.data.username || '',
        fullName: response.data.fullName || '',
        class:    response.data.class || '',
        email:    response.data.email || ''
      }
    } else {
      profileData.value = {
        MSV:      response.data.username || '',
        username: response.data.username || '',
        fullName: response.data.fullName || '',
        class:    '',
        email:    response.data.email || ''
      }
    }
  } catch (error) {
    console.error('Lỗi lấy thông tin profile:', error)
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    if (user) {
      profileData.value = {
        MSV:      user.username || user.MSV || '',
        username: user.username || '',
        fullName: user.fullName || '',
        class:    user.class || '',
        email:    user.email || ''
      }
    } else {
      updateError.value = 'Không thể tải thông tin hồ sơ. Vui lòng đăng nhập lại!'
    }
  }
}

async function handleUpdate() {
  const errors = validate(profileData.value, profileRules.value)
  formErrors.value = errors

  if (Object.keys(errors).length > 0) return

  // Validate password if trying to change it
  if (passwordData.value.newPassword || passwordData.value.currentPassword) {
    if (!passwordData.value.currentPassword) {
      formErrors.value.currentPassword = 'Vui lòng nhập mật khẩu hiện tại!'
      return
    }

    if (passwordData.value.newPassword.length < 6) {
      formErrors.value.newPassword = 'Mật khẩu mới phải có ít nhất 6 ký tự!'
      return
    }

    if (passwordData.value.newPassword !== passwordData.value.confirmPassword) {
      formErrors.value.confirmPassword = 'Mật khẩu xác nhận không khớp!'
      return
    }
  }

  isUpdating.value = true
  updateError.value = ''
  updateSuccess.value = ''

  try {
    // Chuẩn bị dữ liệu cập nhật
    const updateData = {
      fullName: profileData.value.fullName,
      currentPassword: passwordData.value.currentPassword,
      newPassword: passwordData.value.newPassword
    }

    // Chỉ gửi email và class nếu là sinh viên
    if (isStudent.value) {
      updateData.email = profileData.value.email
      updateData.class = profileData.value.class
    }

    // Sử dụng API /api/profile cho cả admin và student
    await api.put('/profile', updateData)

    updateSuccess.value = '✅ Cập nhật thông tin thành công!'

    // Cập nhật localStorage
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    if (user) {
      user.fullName = profileData.value.fullName
      user.email    = profileData.value.email
      if (isStudent.value) user.class = profileData.value.class
      localStorage.setItem('user', JSON.stringify(user))
    }

    // Reset password fields
    passwordData.value = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    }

    setTimeout(() => {
      updateSuccess.value = ''
    }, 3000)
  } catch (error) {
    updateError.value = error.response?.data?.error || 'Cập nhật thất bại. Vui lòng thử lại.'
  } finally {
    isUpdating.value = false
  }
}

onMounted(fetchProfile)
</script>

<style scoped>
.update-profile {
  width: 100%;
  box-sizing: border-box;
  padding: 2rem;
}

.profile-card {
  background: white;
  padding: 2.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  max-width: 600px;
  margin: 0 auto;
}

.profile-form {
  display: flex;
  flex-direction: column;
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

.form-group input:disabled {
  background-color: #f5f5f5;
  cursor: not-allowed;
}

.form-group small {
  color: #7f8c8d;
  font-size: 0.85rem;
  margin-top: 0.3rem;
}

.password-section {
  border-top: 1px solid #eee;
  padding-top: 1.5rem;
}

.password-section h3 {
  margin: 0 0 1.5rem;
  color: #2c3e50;
  font-size: 1.2rem;
}

.form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 1rem;
}

.btn-update {
  padding: 1rem 2rem;
  background-color: #42b983;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: bold;
  transition: background-color 0.3s;
}

.btn-update:hover:not(:disabled) {
  background-color: #3aa876;
}

.btn-update:disabled {
  background-color: #a8d5ba;
  cursor: not-allowed;
}

.error-text {
  color: #ff4d4d;
  font-size: 0.85rem;
  margin-top: 0.3rem;
}

.global-error {
  text-align: center;
  padding: 0.75rem;
  border-radius: 4px;
  background: #fff5f5;
  border: 1px solid #ff4d4d;
}

.success-text {
  text-align: center;
  padding: 0.75rem;
  border-radius: 4px;
  background: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
  font-weight: bold;
}
</style>
