<template>
  <nav class="navbar">
    <div class="nav-container">
      <div class="logo">
        <span class="icon">📚</span>
        <span class="title">FPT Library</span>
      </div>
      <ul class="nav-links">
        <li><RouterLink to="/" active-class="active">Quản lý sách</RouterLink></li>
        <li><RouterLink to="/borrows" active-class="active">Quản lý mượn trả</RouterLink></li>
        <li><a href="#">Cài đặt</a></li>
      </ul>
    </div>
  </nav>
</template>
<style scoped src="./Navbar.css"></style>