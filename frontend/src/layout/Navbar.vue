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
        <li><RouterLink to="/students" active-class="active">Quản lý sinh viên</RouterLink></li>
      </ul>
    </div>
  </nav>
</template>
<style scoped src="./Navbar.css"></style>