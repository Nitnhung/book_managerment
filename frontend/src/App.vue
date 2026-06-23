<script setup>
import { RouterLink, RouterView, useRouter } from 'vue-router'
import { ref, watch } from 'vue'

const router = useRouter()
const loggedInUser = ref(null)
const isSidebarCollapsed = ref(false) // Trạng thái thu gọn sidebar

// Hàm kiểm tra trạng thái đăng nhập và lấy thông tin người dùng
const checkLoginStatus = () => {
  const user = localStorage.getItem('user')
  try {
    if (user) {
      loggedInUser.value = JSON.parse(user)
    } else {
      loggedInUser.value = null
    }
  } catch (e) {
    console.error("Lỗi phân tích JSON từ localStorage 'user':", e);
    loggedInUser.value = null; // Đảm bảo không có lỗi nếu JSON bị hỏng
  }
}

// Kiểm tra trạng thái đăng nhập khi component được tạo
checkLoginStatus()

// Theo dõi thay đổi route để cập nhật trạng thái đăng nhập (ví dụ: sau khi login/logout)
watch(
  () => router.currentRoute.value,
  () => {
    checkLoginStatus()
  }
)

const handleLogout = () => {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  loggedInUser.value = null
  alert('Đã đăng xuất!')
  router.push('/login') // Chuyển hướng về trang đăng nhập
}

const toggleSidebar = () => {
  isSidebarCollapsed.value = !isSidebarCollapsed.value
}
</script>

<template>
  <div :class="['app-layout', { 'logged-in': loggedInUser, 'collapsed': isSidebarCollapsed }]">
    <!-- Sidebar bên trái: Chỉ hiển thị khi đã đăng nhập -->
    <aside v-if="loggedInUser" class="sidebar">
      <div class="sidebar-logo">
        <h2 v-if="!isSidebarCollapsed">📚 Lib Manager</h2>
        <h2 v-else>📚</h2>
      </div>
      <nav class="sidebar-nav">
        <template v-if="loggedInUser.role === 'admin' || loggedInUser.role === 'librarian'">
          <RouterLink to="/" class="nav-item" title="Dashboard">📊 <span v-if="!isSidebarCollapsed">Dashboard</span></RouterLink>

          <RouterLink to="/" class="nav-item" title="Quản lý Sách">📖 <span v-if="!isSidebarCollapsed">Quản lý Sách</span></RouterLink>
          <RouterLink to="/borrows" class="nav-item" title="Mượn / Trả Sách">📋 <span v-if="!isSidebarCollapsed">Mượn / Trả Sách</span></RouterLink>
          <RouterLink v-if="loggedInUser.role === 'admin'" to="/borrows?history=true" class="nav-item" title="Lịch sử mượn">🕒 <span v-if="!isSidebarCollapsed">Lịch sử mượn</span></RouterLink>
          <RouterLink to="/students" class="nav-item" title="Quản lý Sinh viên">👤 <span v-if="!isSidebarCollapsed">Quản lý Sinh viên</span></RouterLink>
        </template>

        <RouterLink v-if="loggedInUser.role === 'student'" to="/my-borrows" class="nav-item" title="Lịch sử mượn sách">🕒 <span v-if="!isSidebarCollapsed">Lịch sử mượn sách</span></RouterLink>
      </nav>
    </aside>

    <!-- Khối nội dung bên phải -->
    <div class="main-container">
      <header v-if="loggedInUser" class="top-header">
        <div class="header-content">
          <button @click="toggleSidebar" class="btn-toggle">☰</button>
          <span class="user-info">Xin chào, <strong>{{ loggedInUser.fullName || loggedInUser.username }}</strong></span>
          <button @click="handleLogout" class="btn-logout">Đăng xuất</button>
        </div>
      </header>

      <main class="content-area">
        <RouterView />
      </main>

      <footer v-if="loggedInUser" class="app-footer">
        <p>&copy; 2024 Hệ thống Quản lý Thư viện - Developed with Vue 3</p>
      </footer>
    </div>
  </div>
</template>

<style scoped>
/* Reset CSS toàn cục: Đảm bảo trang web không có lề thừa và phủ kín màn hình */
:global(html), :global(body), :global(#app) {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    min-height: 100vh;
    box-sizing: border-box;
    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    background-color: #f4f7f6;
}

/* Thiết lập khung layout tổng thể */
.app-layout {
  display: flex;
  width: 100%;
  height: 100%;
  min-height: 100vh; /* Quan trọng: Đảm bảo layout luôn cao ít nhất bằng màn hình */
  background-color: #f4f7f6;
  transition: all 0.3s ease;
}

/* Sidebar định dạng khối bên trái */
.sidebar {
  width: 260px; 
  background-color: #2c3e50;
  color: white;
  display: flex;
  flex-direction: column;
  position: fixed; /* Đặt sidebar cố định trên màn hình */
  left: 0; /* Cố định vào cạnh trái */
  top: 0; /* Cố định vào cạnh trên */
  height: 100vh;
  box-shadow: 2px 0 5px rgba(0,0,0,0.1);
  z-index: 1000; /* Đảm bảo sidebar luôn nằm trên các nội dung khác */
  transition: width 0.3s ease, transform 0.3s ease;
}

/* Khi sidebar bị thu gọn */
.app-layout.collapsed .sidebar {
  width: 80px;
}
.app-layout.collapsed .sidebar-logo h2 {
  font-size: 1.2rem;
}

.sidebar-logo {
  padding: 2rem 1rem;
  text-align: center;
  border-bottom: 1px solid #34495e;
}

.sidebar-nav {
  padding: 1rem 0;
  flex-grow: 1;
}

.nav-item {
  display: block;
  padding: 1rem 1.5rem;
  color: #bdc3c7;
  text-decoration: none;
  transition: all 0.3s;
}

.nav-item:hover, .router-link-active {
  background-color: #34495e;
  color: #fff;
  border-left: 4px solid #42b983;
}

/* Khối nội dung bên phải */
.main-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
  min-width: 0;
}

.top-header {
  background-color: #fff;
  padding: 1rem;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.app-layout.logged-in .main-container {
  margin-left: 260px; /* Tạo khoảng trống cho sidebar khi đã đăng nhập */
  width: calc(100% - 260px); /* Sử dụng 100% thay vì 100vw để tránh tràn màn hình khi có thanh cuộn */
  transition: margin-left 0.3s ease, width 0.3s ease;
}

.app-layout.collapsed .main-container {
  margin-left: 80px;
  width: calc(100% - 80px);
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.btn-toggle {
  background: none;
  border: 1px solid #ddd;
  padding: 5px 12px;
  cursor: pointer;
  font-size: 1.2rem;
  border-radius: 4px;
  flex-shrink: 0; /* Đảm bảo nút không bị co lại */
}

.user-info {
  flex: 1;
  text-align: center;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis; /* Hiển thị dấu ... nếu tên quá dài */
  min-width: 0;
  padding: 0 1rem; /* Tạo khoảng cách để không đè lên nút hai bên */
  color: #2c3e50;
}

.content-area {
  flex: 1;
  padding: 2rem;
  min-height: 0; /* Cho phép nội dung cuộn nếu quá dài */
  width: 100%;
  box-sizing: border-box;
}

.app-footer {
  padding: 1rem;
  text-align: center;
  background-color: #fff;
  border-top: 1px solid #eee;
  color: #7f8c8d;
  font-size: 0.9rem;
}

.btn-logout { 
  background-color: #dc3545; 
  color: white; 
  border: none; 
  padding: 0.5rem 1rem; 
  border-radius: 4px; 
  cursor: pointer; 
  flex-shrink: 0; /* Đảm bảo nút đăng xuất luôn giữ nguyên kích thước */
}

.btn-logout:hover { background-color: #c82333; }
.error-text {
  color: #ff4d4d;
  font-size: 0.85rem;
  margin-top: 0.3rem;
  display: block;
}

/* --- Cấu hình Responsive (Giao diện thích ứng) --- */

/* Cho máy tính bảng (Dưới 1024px) */
@media (max-width: 1024px) {
  .sidebar { width: 220px; }
  .app-layout.logged-in .main-container { margin-left: 220px; width: calc(100% - 220px); }
  .app-layout.collapsed .sidebar { width: 70px; }
  .app-layout.collapsed .main-container { margin-left: 70px; width: calc(100% - 70px); }
}

/* Cho điện thoại di động (Dưới 768px) */
@media (max-width: 768px) {
  .sidebar {
    transform: translateX(-100%); /* Mặc định ẩn sidebar ra ngoài màn hình bên trái */
    width: 260px;
  }

  /* Trên mobile, khi bấm nút Toggle (nút ☰), sidebar sẽ trượt vào */
  .app-layout.collapsed .sidebar {
    transform: translateX(0);
  }

  .app-layout.logged-in .main-container {
    margin-left: 0; /* Nội dung chính chiếm toàn bộ chiều rộng màn hình */
    width: 100%;
  }

  .content-area {
    padding: 1rem; /* Giảm bớt padding để nội dung to hơn trên điện thoại */
  }
}
</style>
