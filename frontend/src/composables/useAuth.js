import { ref, computed } from 'vue'
import api from '../api/axios.js'

// State lưu access token trong RAM (memory)
const accessToken = ref(null)
const user = ref(null)
const isRefreshing = ref(false)

export function useAuth() {
  // Setter cho access token
  const setAccessToken = (token) => {
    accessToken.value = token
  }

  // Setter cho user
  const setUser = (userData) => {
    user.value = userData
  }

  // Getter cho access token
  const getAccessToken = () => {
    return accessToken.value
  }

  // Getter cho user
  const getUser = () => {
    return user.value
  }

  // Check xem user đã đăng nhập chưa
  const isAuthenticated = computed(() => {
    return !!accessToken.value && !!user.value
  })

  // Hàm refresh access token
  const refreshAccessToken = async () => {
    if (isRefreshing.value) {
      // Nếu đang refresh, chờ xong
      return new Promise((resolve) => {
        const checkInterval = setInterval(() => {
          if (!isRefreshing.value) {
            clearInterval(checkInterval)
            resolve(accessToken.value)
          }
        }, 100)
      })
    }

    isRefreshing.value = true

    try {
      const response = await api.post('/refresh-token')
      const newAccessToken = response.data.accessToken
      setAccessToken(newAccessToken)
      return newAccessToken
    } catch (error) {
      console.error('Lỗi refresh token:', error)
      // Nếu refresh token thất bại, clear state
      clearAuth()
      throw error
    } finally {
      isRefreshing.value = false
    }
  }

  // Hàm logout
  const logout = async () => {
    try {
      await api.post('/logout')
    } catch (error) {
      console.error('Lỗi logout:', error)
    } finally {
      clearAuth()
    }
  }

  // Clear auth state
  const clearAuth = () => {
    accessToken.value = null
    user.value = null
    // Xóa localStorage cũ (để migration)
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return {
    accessToken,
    user,
    isAuthenticated,
    setAccessToken,
    setUser,
    getAccessToken,
    getUser,
    refreshAccessToken,
    logout,
    clearAuth
  }
}
