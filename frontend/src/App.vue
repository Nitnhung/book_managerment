<template>
  <div class="app-layout">
    <Navbar />
    
    <main class="main-content">
      <RouterView />
    </main>
    
    <Footer />
  </div>
</template>

<script setup>
import { RouterView } from 'vue-router';
import Navbar from './layout/Navbar.vue' // Đảm bảo đường dẫn này đúng với thư mục layouts của bạn
import Footer from './layout/Footer.vue'
</script>

<style>
/* Reset style cơ bản và thiết lập layout chung cho toàn bộ ứng dụng */
body {
  margin: 0;
  font-family: 'Segoe UI', Roboto, sans-serif;
  background-color: #f8fafc;
  color: #334155;
}

.app-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh; /* Đảm bảo giao diện luôn chiếm hết chiều cao màn hình */
}

.main-content {
  flex: 1; /* Đẩy footer xuống đáy nếu nội dung trang ngắn */
  padding: 20px 0;
}
</style>