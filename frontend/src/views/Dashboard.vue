<template>
  <div class="dashboard-container">
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
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import api from '../api/axios.js'

const stats = ref({
  totalBooks: 0,
  availableBooks: 0,
  activeBorrows: 0,
  totalStudents: 0
})

async function fetchStats() {
  try {
    const response = await api.get('/stats')
    stats.value = response.data
  } catch (error) {
    console.error('Lỗi khi lấy thống kê:', error)
  }
}

onMounted(fetchStats)
</script>

<style scoped>
.dashboard-container { padding: 1rem; }
.dashboard-title { margin-bottom: 2rem; color: #2c3e50; }
.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 1.5rem;
}
.stat-card {
  display: flex;
  align-items: center;
  padding: 1.5rem;
  border-radius: 12px;
  background: white;
  box-shadow: 0 4px 6px rgba(0,0,0,0.05);
  transition: transform 0.2s;
}
.stat-card:hover { transform: translateY(-5px); }
.stat-icon { font-size: 2.5rem; margin-right: 1.5rem; }
.stat-info h3 { margin: 0; font-size: 0.9rem; color: #7f8c8d; text-transform: uppercase; }
.stat-info .stat-number { margin: 0.2rem 0 0; font-size: 1.8rem; font-weight: bold; color: #2c3e50; }

/* Colors */
.blue { border-left: 5px solid #3498db; }
.green { border-left: 5px solid #2ecc71; }
.orange { border-left: 5px solid #f39c12; }
.purple { border-left: 5px solid #9b59b6; }
</style>