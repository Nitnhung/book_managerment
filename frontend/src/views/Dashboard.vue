<template>
  <div class="dashboard-container">
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

    <section class="recent-books-section">
      <div class="section-header">
        <h3>📖 Sách trong thư viện</h3>
        <RouterLink v-if="isAdminOrLibrarian" to="/books" class="see-more-link">Xem thêm →</RouterLink>
      </div>

      <div v-if="recentBooks.length === 0" class="empty-books">
        Chưa có sách nào trong hệ thống.
      </div>

      <div v-else class="books-grid">
        <div v-for="book in recentBooks" :key="book.id" class="book-item">
          <div class="book-icon">📕</div>
          <div class="book-details">
            <h4>{{ book.title }}</h4>
            <p class="book-author">{{ book.author }}</p>
            <div class="book-meta">
              <span class="badge">{{ book.category }}</span>
              <span :class="['status', book.isAvailable ? 'available' : 'borrowed']">
                {{ book.isAvailable ? 'Còn sách' : 'Đã mượn' }}
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

const isAdminOrLibrarian = computed(() => {
  return loggedInUser.value && (loggedInUser.value.role === 'admin' || loggedInUser.value.role === 'librarian')
})

const stats = ref({
  totalBooks: 0,
  availableBooks: 0,
  activeBorrows: 0,
  totalStudents: 0
})

const recentBooks = ref([])

async function fetchStats() {
  try {
    const response = await api.get('/stats')
    stats.value = response.data
  } catch (error) {
    console.error('Lỗi khi lấy thống kê:', error)
  }
}

async function fetchRecentBooks() {
  try {
    const response = await api.get('/books/grouped')
    const data = response.data.slice(0, 10)

    recentBooks.value = data.map(b => ({
      id: `${b.title}-${b.author}-${b.year}`,
      title: b.title,
      author: b.author,
      category: b.category,
      isAvailable: b.availableCopies > 0,
      totalCopies: b.totalCopies,
      availableCopies: b.availableCopies
    }))
  } catch (error) {
    console.error('Lỗi khi lấy danh sách sách:', error)
  }
}

onMounted(() => {
  const userStr = localStorage.getItem('user')
  if (userStr) {
    try {
      loggedInUser.value = JSON.parse(userStr)
    } catch (e) {
      console.error(e)
    }
  }

  if (isAdminOrLibrarian.value) {
    fetchStats()
  }
  fetchRecentBooks()
})
</script>

<style scoped>
.dashboard-container {
  padding: 1rem;
  max-width: 1400px;
  margin: 0 auto;
}

.dashboard-title {
  margin-bottom: 2rem;
  color: #2c3e50;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2.5rem;
}

.stat-card {
  display: flex;
  align-items: center;
  padding: 1.5rem;
  border-radius: 12px;
  background: white;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s;
}

.stat-card:hover {
  transform: translateY(-5px);
}

.stat-icon {
  font-size: 2.5rem;
  margin-right: 1.5rem;
}

.stat-info h3 {
  margin: 0;
  font-size: 0.9rem;
  color: #7f8c8d;
  text-transform: uppercase;
}

.stat-info .stat-number {
  margin: 0.2rem 0 0;
  font-size: 1.8rem;
  font-weight: bold;
  color: #2c3e50;
}

.blue { border-left: 5px solid #3498db; }
.green { border-left: 5px solid #2ecc71; }
.orange { border-left: 5px solid #f39c12; }
.purple { border-left: 5px solid #9b59b6; }

.recent-books-section {
  background: white;
  border-radius: 12px;
  padding: 1.5rem;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.section-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.25rem;
}

.see-more-link {
  color: #42b983;
  text-decoration: none;
  font-weight: 600;
  font-size: 0.95rem;
  transition: color 0.2s;
}

.see-more-link:hover {
  color: #3aa876;
  text-decoration: underline;
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.book-item {
  display: flex;
  gap: 1rem;
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 10px;
  background: #f8fafc;
  transition: box-shadow 0.2s, transform 0.2s;
}

.book-item:hover {
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transform: translateY(-2px);
}

.book-icon {
  font-size: 2rem;
  flex-shrink: 0;
}

.book-details h4 {
  margin: 0 0 0.25rem;
  color: #2c3e50;
  font-size: 1rem;
  line-height: 1.4;
}

.book-author {
  margin: 0 0 0.5rem;
  color: #7f8c8d;
  font-size: 0.85rem;
}

.book-meta {
  display: flex;
  gap: 0.5rem;
  flex-wrap: wrap;
  align-items: center;
}

.badge {
  background: #e8f4fd;
  color: #2980b9;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
  font-size: 0.75rem;
}

.status {
  font-size: 0.75rem;
  font-weight: 600;
  padding: 0.15rem 0.5rem;
  border-radius: 4px;
}

.status.available {
  background: #d4edda;
  color: #155724;
}

.status.borrowed {
  background: #f8d7da;
  color: #721c24;
}

.empty-books {
  text-align: center;
  padding: 2rem;
  color: #94a3b8;
  background: #f8fafc;
  border-radius: 8px;
}
</style>
