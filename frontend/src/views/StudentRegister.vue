<template>
  <div class="student-register">
    <div class="register-card">
      <div class="card-header">
        <h2>✨ Tạo tài khoản mới</h2>
        <p class="subtitle">Đăng ký để mượn sách từ thư viện trường</p>
      </div>

      <form @submit.prevent="handleRegister" class="register-form">
        <div class="form-group">
          <label>Mã số sinh viên (MSV)</label>
          <div class="input-wrapper">
            <span class="icon">🎓</span>
            <input v-model="formData.MSV" type="text" placeholder="Ví dụ: BH01234" required />
          </div>
          <span v-if="formErrors.MSV" class="error-text">{{ formErrors.MSV }}</span>
        </div>

        <div class="form-group">
          <label>Họ và tên</label>
          <div class="input-wrapper">
            <span class="icon">👤</span>
            <input v-model="formData.fullName" type="text" placeholder="Nhập tên đầy đủ" required />
          </div>
          <span v-if="formErrors.fullName" class="error-text">{{ formErrors.fullName }}</span>
        </div>

        <div class="form-group">
          <label>Lớp học</label>
          <div class="input-wrapper">
            <span class="icon">🏫</span>
            <input v-model="formData.class" type="text" placeholder="Ví dụ: IT1801" required />
          </div>
          <span v-if="formErrors.class" class="error-text">{{ formErrors.class }}</span>
        </div>

        <div class="form-group">
          <label>Địa chỉ Email</label>
          <div class="input-wrapper">
            <span class="icon">✉️</span>
            <input v-model="formData.email" type="email" placeholder="student@fpt.edu.vn" required />
          </div>
          <span v-if="formErrors.email" class="error-text">{{ formErrors.email }}</span>
        </div>

        <div class="form-group">
          <label>Mật khẩu</label>
          <div class="input-wrapper">
            <span class="icon">🔒</span>
            <input v-model="formData.password" type="password" placeholder="Tạo mật khẩu" required />
          </div>
          <span v-if="formErrors.password" class="error-text">{{ formErrors.password }}</span>
        </div>

        <div class="form-group">
          <label>Xác nhận mật khẩu</label>
          <div class="input-wrapper">
            <span class="icon">🔐</span>
            <input v-model="formData.confirmPassword" type="password" placeholder="Nhập lại mật khẩu" required />
          </div>
          <span v-if="formErrors.confirmPassword" class="error-text">{{ formErrors.confirmPassword }}</span>
        </div>

        <p v-if="registerError" class="error-text global-error">{{ registerError }}</p>

        <button type="submit" class="btn-register" :disabled="isRegistering">
          {{ isRegistering ? 'Đang đăng ký...' : 'Đăng Ký Tài Khoản' }}
        </button>
      </form>

      <p class="login-link">
        Đã có tài khoản? <RouterLink to="/login">Đăng nhập ngay</RouterLink>
      </p>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useValidation } from '../composables/useValidation.js'
import api from '../api/axios.js'

const router = useRouter()
const { validate } = useValidation()

const isRegistering = ref(false)
const registerError = ref('')
const formErrors = ref({})

const formData = ref({
  MSV: '',
  fullName: '',
  class: '',
  email: '',
  password: '',
  confirmPassword: ''
})

const registerRules = {
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
  ],
  password: [
    { type: 'required', message: 'Vui lòng nhập Mật khẩu!' },
    { type: 'minLength', value: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự.' }
  ]
}

async function handleRegister() {
  const errors = validate(formData.value, registerRules)
  formErrors.value = errors

  if (Object.keys(errors).length > 0) return

  if (formData.value.password !== formData.value.confirmPassword) {
    formErrors.value.confirmPassword = 'Mật khẩu xác nhận không khớp!'
    return
  }

  isRegistering.value = true
  registerError.value = ''

  try {
    await api.post('/students/register', {
      MSV: formData.value.MSV,
      fullName: formData.value.fullName,
      class: formData.value.class,
      email: formData.value.email,
      password: formData.value.password
    })

    // Tự động đăng nhập sau khi đăng ký thành công
    const loginResponse = await api.post('/login', {
      username: formData.value.MSV,
      password: formData.value.password
    })

    // Lưu token và user vào localStorage
    localStorage.setItem('token', loginResponse.data.accessToken)
    localStorage.setItem('user', JSON.stringify(loginResponse.data.user))

    alert('🎉 Đăng ký thành công! Đã tự động đăng nhập.')
    router.push('/')
  } catch (error) {
    registerError.value = error.response?.data?.error || 'Không thể đăng ký. Vui lòng thử lại.'
  } finally {
    isRegistering.value = false
  }
}
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.student-register {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  background: radial-gradient(circle at 0% 0%, #e0c3fc 0%, #8ec5fc 100%);
  font-family: 'Inter', sans-serif;
  padding: 2rem;
  box-sizing: border-box;
}

.register-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  padding: 2.5rem;
  border-radius: 24px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 500px;
  animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
  opacity: 0;
  transform: translateY(30px);
}

@keyframes slideUp {
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.card-header {
  text-align: center;
  margin-bottom: 2rem;
}

.card-header h2 {
  margin: 0 0 0.5rem 0;
  color: #1e293b;
  font-size: 1.8rem;
  font-weight: 700;
  letter-spacing: -0.025em;
}

.subtitle {
  color: #64748b;
  font-size: 0.95rem;
  margin: 0;
}

.register-form {
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  font-weight: 600;
  margin-bottom: 0.5rem;
  color: #475569;
  font-size: 0.9rem;
}

.input-wrapper {
  position: relative;
  display: flex;
  align-items: center;
}

.input-wrapper .icon {
  position: absolute;
  left: 1rem;
  font-size: 1.1rem;
  color: #94a3b8;
  pointer-events: none;
}

.input-wrapper input {
  width: 100%;
  padding: 0.85rem 1rem 0.85rem 2.8rem;
  border: 2px solid #e2e8f0;
  border-radius: 12px;
  font-size: 1rem;
  color: #334155;
  background-color: #f8fafc;
  transition: all 0.3s ease;
  box-sizing: border-box;
}

.input-wrapper input:focus {
  outline: none;
  border-color: #8b5cf6;
  background-color: #ffffff;
  box-shadow: 0 0 0 4px rgba(139, 92, 246, 0.15);
}

.btn-register {
  padding: 1rem;
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  color: white;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 1.05rem;
  font-weight: 600;
  margin-top: 0.5rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.btn-register:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
}

.btn-register:active:not(:disabled) {
  transform: translateY(1px);
  box-shadow: 0 4px 10px rgba(99, 102, 241, 0.2);
}

.btn-register:disabled {
  background: #cbd5e1;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

.error-text {
  color: #ef4444;
  font-size: 0.85rem;
  margin-top: 0.4rem;
}

.global-error {
  text-align: center;
  padding: 0.75rem;
  border-radius: 8px;
  background: #fef2f2;
  border: 1px solid #fca5a5;
  color: #b91c1c;
  font-weight: 500;
}

.login-link {
  text-align: center;
  margin-top: 2rem;
  color: #64748b;
  font-size: 0.95rem;
}

.login-link a {
  color: #8b5cf6;
  text-decoration: none;
  font-weight: 600;
  transition: color 0.2s ease;
}

.login-link a:hover {
  color: #6366f1;
  text-decoration: underline;
}
</style>
