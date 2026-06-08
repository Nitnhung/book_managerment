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
      <h2>🔐 Đăng nhập Thủ thư</h2>
      <form @submit.prevent="handleLogin">
        <div class="form-group">
          <label>Tài khoản</label>
          <input v-model="credentials.username" type="text" placeholder="Nhập username" />
          <span v-if="formErrors.username" class="error-text">{{ formErrors.username }}</span>
        </div>
        
        <div class="form-group">
          <label>Mật khẩu</label>
          <input v-model="credentials.password" type="password" placeholder="Nhập mật khẩu" />
          <span v-if="formErrors.password" class="error-text">{{ formErrors.password }}</span>
        </div>

        <p v-if="loginError" class="error-text global-error">{{ loginError }}</p>
        
        <button type="submit" class="btn-login">Đăng nhập</button>
      </form>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 80vh;
}
.login-card {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
  width: 100%;
  max-width: 400px;
}
.form-group { margin-bottom: 1rem; }
.form-group label { display: block; margin-bottom: 0.5rem; font-weight: bold; }
.form-group input { width: 100%; padding: 0.7rem; border: 1px solid #ddd; border-radius: 4px; box-sizing: border-box; }
.btn-login { width: 100%; padding: 0.8rem; background-color: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; margin-top: 1rem; }
.btn-login:hover { background-color: #45a049; }
.error-text { color: #ff4d4d; font-size: 0.85rem; margin-top: 0.3rem; display: block; }
.global-error { text-align: center; border: 1px solid #ff4d4d; padding: 0.5rem; border-radius: 4px; background: #fff5f5; }
</style>