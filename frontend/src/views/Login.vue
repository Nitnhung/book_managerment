<script setup>
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useValidation } from '../composables/useValidation.js' // Thêm .js
import api from '../api/axios.js' // Thêm .js

const router = useRouter()
const { validate } = useValidation()

const credentials = ref({
  username: '',
  password: ''
})

const formErrors = ref({})
const loginError = ref('')

const loginRules = {
  username: [{ type: 'required', message: 'Vui lòng nhập tài khoản!' }],
  password: [{ type: 'required', message: 'Vui lòng nhập mật khẩu!' }]
}

async function handleLogin() {
  const errors = validate(credentials.value, loginRules)
  formErrors.value = errors
  if (Object.keys(errors).length > 0) return

  try {
    const response = await api.post('/login', credentials.value)
    const data = response.data

    // Lưu token và thông tin user vào localStorage
    localStorage.setItem('token', data.accessToken)
    localStorage.setItem('user', JSON.stringify(data.user))
    
    alert('🎉 Đăng nhập thành công!')
    router.push('/') // Chuyển hướng về trang chủ hoặc trang quản lý sách
  } catch (error) {
    console.error('Lỗi đăng nhập:', error)
    loginError.value = error.response?.data?.error || 'Không thể kết nối đến máy chủ.'
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="card-header">
        <h2>👋 Chào mừng trở lại!</h2>
        <p class="subtitle">Đăng nhập để truy cập hệ thống thư viện</p>
      </div>
      
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label>Tài khoản</label>
          <div class="input-wrapper">
            <span class="icon">👤</span>
            <input v-model="credentials.username" type="text" placeholder="Nhập mã sinh viên hoặc username" />
          </div>
          <span v-if="formErrors.username" class="error-text">{{ formErrors.username }}</span>
        </div>
        
        <div class="form-group">
          <label>Mật khẩu</label>
          <div class="input-wrapper">
            <span class="icon">🔒</span>
            <input v-model="credentials.password" type="password" placeholder="Nhập mật khẩu" />
          </div>
          <span v-if="formErrors.password" class="error-text">{{ formErrors.password }}</span>
        </div>

        <p v-if="loginError" class="error-text global-error">{{ loginError }}</p>
        
        <button type="submit" class="btn-login">Đăng nhập</button>
      </form>

      <p class="register-link">
        Chưa có tài khoản? <RouterLink to="/register">Đăng ký ngay</RouterLink>
      </p>
    </div>
  </div>
</template>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  /* Modern mesh gradient background */
  background: radial-gradient(circle at 0% 0%, #e0c3fc 0%, #8ec5fc 100%);
  font-family: 'Inter', sans-serif;
  padding: 2rem;
  box-sizing: border-box;
}

.login-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid rgba(255, 255, 255, 0.5);
  padding: 3rem 2.5rem;
  border-radius: 24px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 420px;
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
  margin-bottom: 2.5rem;
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

.form-group {
  margin-bottom: 1.25rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
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

.btn-login {
  width: 100%;
  padding: 0.9rem;
  background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
  color: white;
  border: none;
  border-radius: 12px;
  cursor: pointer;
  font-size: 1.05rem;
  font-weight: 600;
  margin-top: 1.5rem;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.btn-login:hover {
  transform: translateY(-2px);
  box-shadow: 0 8px 20px rgba(99, 102, 241, 0.3);
}

.btn-login:active {
  transform: translateY(1px);
  box-shadow: 0 4px 10px rgba(99, 102, 241, 0.2);
}

.error-text {
  color: #ef4444;
  font-size: 0.85rem;
  margin-top: 0.4rem;
  display: block;
}

.global-error {
  text-align: center;
  border: 1px solid #fca5a5;
  padding: 0.75rem;
  border-radius: 8px;
  background: #fef2f2;
  color: #b91c1c;
  font-weight: 500;
}

.register-link {
  text-align: center;
  margin-top: 2rem;
  color: #64748b;
  font-size: 0.95rem;
}

.register-link a {
  color: #8b5cf6;
  text-decoration: none;
  font-weight: 600;
  transition: color 0.2s ease;
}

.register-link a:hover {
  color: #6366f1;
  text-decoration: underline;
}
</style>