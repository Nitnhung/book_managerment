<template>
  <div class="dashboard-container">

    <!-- ADMIN / LIBRARIAN: Thống kê -->
    <template v-if="isAdminOrLibrarian">
      <h2 class="dashboard-title">📊 Tổng quan hệ thống</h2>
      <div class="stats-grid">
        <div class="stat-card blue">
          <div class="stat-icon">📚</div>
          <div class="stat-info">
            <h3>Tổng số sách</h3>
            <p class="stat-number">{{ stats.totalBooks }}</p>
          </div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon">✅</div>
          <div class="stat-info">
            <h3>Sách có sẵn</h3>
            <p class="stat-number">{{ stats.availableBooks }}</p>
          </div>
        </div>
        <div class="stat-card orange">
          <div class="stat-icon">📋</div>
          <div class="stat-info">
            <h3>Đang mượn</h3>
            <p class="stat-number">{{ stats.activeBorrows }}</p>
          </div>
        </div>
        <div class="stat-card purple">
          <div class="stat-icon">👤</div>
          <div class="stat-info">
            <h3>Sinh viên</h3>
            <p class="stat-number">{{ stats.totalStudents }}</p>
          </div>
        </div>
      </div>
    </template>

    <!-- STUDENT: Header chào mừng -->
    <template v-if="isStudent">
      <div class="student-header">
        <div>
          <h2 class="dashboard-title">
            👋 Xin chào, {{ loggedInUser?.fullName || loggedInUser?.username }}!
          </h2>
          <p class="student-subtitle">Khám phá sách tại thư viện FPT.</p>
        </div>
        <div class="header-actions">
          <RouterLink to="/books" class="btn-browse-books">📚 Xem danh sách sách</RouterLink>
          <RouterLink to="/my-borrows" class="btn-my-borrows">📜 Lịch sử mượn sách</RouterLink>
        </div>
      </div>
    </template>

    <!-- GUEST: Chưa đăng nhập -->
    <template v-if="!isLoggedIn">
      <div class="guest-header">
        <div>
          <h2 class="dashboard-title">📚 Chào mừng đến Thư Viện FPT</h2>
          <p class="guest-subtitle">Khám phá kho sách phong phú. Đăng nhập để mượn sách.</p>
        </div>
        <div class="header-actions">
          <RouterLink to="/login" class="btn-login">🔐 Đăng nhập</RouterLink>
          <RouterLink to="/books" class="btn-browse-books">📚 Xem danh sách sách</RouterLink>
        </div>
      </div>
    </template>

    <!-- DANH SÁCH SÁCH: Hiển thị cho tất cả -->
    <section class="recent-books-section">
      <div class="section-header">
        <h3>📖 Sách trong thư viện</h3>
        <RouterLink to="/books" class="see-more-link">Xem tất cả →</RouterLink>
      </div>

      <div v-if="recentBooks.length === 0" class="empty-books">
        Chưa có sách nào trong hệ thống.
      </div>

      <div v-else class="books-grid">
        <div v-for="book in recentBooks" :key="book.id" class="book-item">
          <div class="book-icon">📕</div>
          <div class="book-details">
            <h4>{{ book.title }}</h4>
            <p class="book-author">✍️ {{ book.author }}</p>
            <div class="book-meta">
              <span class="badge">{{ book.category }}</span>
              <span :class="['status', book.isAvailable ? 'available' : 'borrowed']">
                {{ book.isAvailable ? `Còn ${book.availableCopies} cuốn` : 'Hết sách' }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>

  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue'
import { RouterLink } from 'vue-router'
import api from '../api/axios.js'

const loggedInUser = ref(null)

const isLoggedIn = computed(() => !!localStorage.getItem('token'))
const isAdminOrLibrarian = computed(() =>
  loggedInUser.value?.role === 'admin' || loggedInUser.value?.role === 'librarian'
)
const isStudent = computed(() => loggedInUser.value?.role === 'student')

const stats = ref({ totalBooks: 0, availableBooks: 0, activeBorrows: 0, totalStudents: 0 })
const recentBooks = ref([])

async function fetchStats() {
  try {
    const res = await api.get('/stats')
    stats.value = res.data
  } catch (e) { console.error('Lỗi thống kê:', e) }
}

async function fetchRecentBooks() {
  try {
    const res = await api.get('/books/grouped')
    recentBooks.value = res.data.slice(0, 12).map(b => ({
      id:              `${b.title}-${b.author}-${b.year}`,
      sampleId:        b.sampleId,
      title:           b.title,
      author:          b.author,
      category:        b.category,
      isAvailable:     b.availableCopies > 0,
      totalCopies:     b.totalCopies,
      availableCopies: b.availableCopies
    }))
  } catch (e) { console.error('Lỗi danh sách sách:', e) }
}

onMounted(() => {
  const userStr = localStorage.getItem('user')
  if (userStr) {
    try { loggedInUser.value = JSON.parse(userStr) } catch {}
  }
  if (isAdminOrLibrarian.value) fetchStats()
  fetchRecentBooks()
})
</script>

<style scoped>
.dashboard-container { padding: 1.5rem; max-width: 1400px; margin: 0 auto; }
.dashboard-title { margin: 0 0 1rem; color: #2c3e50; }

.student-header, .guest-header {
  display: flex; justify-content: space-between; align-items: center;
  margin-bottom: 1.5rem; padding: 1.5rem; border-radius: 12px;
  color: white; flex-wrap: wrap; gap: 1rem;
}
.student-header { background: linear-gradient(135deg, #42b983 0%, #2d9467 100%); }
.guest-header   { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); }
.student-header .dashboard-title,
.guest-header .dashboard-title { color: white; margin-bottom: 0.25rem; }
.student-subtitle, .guest-subtitle { margin: 0; opacity: 0.9; font-size: 0.95rem; }

.header-actions { display: flex; gap: 0.75rem; flex-wrap: wrap; }
.btn-login, .btn-browse-books, .btn-my-borrows {
  padding: 0.6rem 1.2rem; color: white;
  border: 2px solid rgba(255,255,255,0.6); border-radius: 8px;
  text-decoration: none; font-weight: 600; font-size: 0.9rem;
  transition: all 0.2s; white-space: nowrap;
  background: rgba(255,255,255,0.2);
}
.btn-login:hover, .btn-browse-books:hover, .btn-my-borrows:hover {
  background: rgba(255,255,255,0.35); border-color: white;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 1.5rem; margin-bottom: 2rem;
}
.stat-card {
  display: flex; align-items: center; padding: 1.5rem;
  border-radius: 12px; background: white;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05); transition: transform 0.2s;
}
.stat-card:hover { transform: translateY(-4px); }
.stat-icon { font-size: 2.5rem; margin-right: 1.25rem; }
.stat-info h3 { margin: 0; font-size: 0.85rem; color: #7f8c8d; text-transform: uppercase; }
.stat-info .stat-number { margin: 0.2rem 0 0; font-size: 1.8rem; font-weight: bold; color: #2c3e50; }
.blue   { border-left: 5px solid #3498db; }
.green  { border-left: 5px solid #2ecc71; }
.orange { border-left: 5px solid #f39c12; }
.purple { border-left: 5px solid #9b59b6; }

.recent-books-section {
  background: white; border-radius: 12px; padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
}
.section-header {
  display: flex; justify-content: space-between;
  align-items: center; margin-bottom: 1.25rem;
}
.section-header h3 { margin: 0; color: #2c3e50; font-size: 1.2rem; }
.see-more-link { color: #42b983; text-decoration: none; font-weight: 600; font-size: 0.9rem; }
.see-more-link:hover { color: #3aa876; text-decoration: underline; }

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
}
.book-item {
  display: flex; gap: 1rem; padding: 1rem;
  border: 1px solid #e2e8f0; border-radius: 10px;
  background: #f8fafc; transition: box-shadow 0.2s, transform 0.2s;
}
.book-item:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); transform: translateY(-2px); }
.book-icon { font-size: 2rem; flex-shrink: 0; margin-top: 2px; }
.book-details { display: flex; flex-direction: column; gap: 0.3rem; flex: 1; }
.book-details h4 { margin: 0; color: #2c3e50; font-size: 0.95rem; line-height: 1.4; }
.book-author { margin: 0; color: #7f8c8d; font-size: 0.82rem; }
.book-meta { display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center; margin-top: 0.2rem; }
.badge { background: #e8f4fd; color: #2980b9; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.72rem; font-weight: 500; }
.status { font-size: 0.72rem; font-weight: 600; padding: 0.15rem 0.5rem; border-radius: 4px; }
.status.available { background: #d4edda; color: #155724; }
.status.borrowed  { background: #f8d7da; color: #721c24; }
.empty-books { text-align: center; padding: 2rem; color: #94a3b8; background: #f8fafc; border-radius: 8px; }
</style>
