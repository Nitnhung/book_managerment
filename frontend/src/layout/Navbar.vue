<template>
  <nav class="navbar">
    <div class="nav-container">
      <div class="logo">
        <span class="icon">📚</span>
        <span class="title">FPT Library</span>
      </div>
      <ul class="nav-links">
        <!-- Admin/Librarian Links -->
        <template v-if="isAdmin || isLibrarian">
          <li><RouterLink to="/" active-class="active">📚 Quản lý sách</RouterLink></li>
          <li><RouterLink to="/borrows" active-class="active">📋 Quản lý mượn trả</RouterLink></li>
          <li><RouterLink to="/students" active-class="active">👨‍🎓 Quản lý sinh viên</RouterLink></li>
          <li><RouterLink to="/borrow-requests" active-class="active">📝 Yêu cầu mượn</RouterLink></li>
          <li><RouterLink to="/borrows/history" active-class="active">📜 Lịch sử mượn</RouterLink></li>
          <li v-if="isAdmin"><RouterLink to="/emails" active-class="active">📧 Quản lý Email</RouterLink></li>
        </template>

        <!-- Student Links -->
        <template v-if="isStudent">
          <li><RouterLink to="/" active-class="active">📚 Danh sách sách</RouterLink></li>
          <li><RouterLink to="/my-borrows" active-class="active">📜 Lịch sử mượn</RouterLink></li>
          <li><RouterLink to="/profile" active-class="active">👤 Hồ sơ của tôi</RouterLink></li>
        </template>

        <!-- Logout -->
        <li><button @click="handleLogout" class="btn-logout">🚪 Đăng xuất</button></li>
      </ul>
    </div>
  </nav>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const user = ref(null)
const userRole = ref('')

onMounted(() => {
  const userData = localStorage.getItem('user')
  if (userData) {
    user.value = JSON.parse(userData)
    userRole.value = user.value?.role || ''
  }
})

const isAdmin = computed(() => userRole.value === 'admin')
const isLibrarian = computed(() => userRole.value === 'librarian')
const isStudent = computed(() => userRole.value === 'student')

function handleLogout() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  router.push('/login')
}
</script>

<style scoped src="./Navbar.css"></style>