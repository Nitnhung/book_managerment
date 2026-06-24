<<<<<<< Updated upstream
<template>
  <nav v-if="totalPages > 1" class="pagination">
    <button class="page-btn" :disabled="currentPage === 1" @click="goTo(currentPage - 1)">
      ‹ Trước
    </button>

    <button
      v-for="page in pages"
      :key="page"
      class="page-btn"
      :class="{ active: page === currentPage }"
      @click="goTo(page)"
    >
      {{ page }}
    </button>

    <button class="page-btn" :disabled="currentPage === totalPages" @click="goTo(currentPage + 1)">
      Sau ›
    </button>
  </nav>
</template>

=======
>>>>>>> Stashed changes
<script setup>
import { computed } from 'vue'

const props = defineProps({
<<<<<<< Updated upstream
  currentPage: { type: Number, required: true },
  totalPages: { type: Number, required: true }
})

const emit = defineEmits(['update:currentPage'])

// Hiển thị tối đa 5 nút trang quanh trang hiện tại
const pages = computed(() => {
  const total = props.totalPages
  const current = props.currentPage
  const maxButtons = 5
  let start = Math.max(1, current - Math.floor(maxButtons / 2))
  let end = Math.min(total, start + maxButtons - 1)
  start = Math.max(1, end - maxButtons + 1)
  const result = []
  for (let i = start; i <= end; i++) result.push(i)
  return result
})

function goTo(page) {
  if (page < 1 || page > props.totalPages || page === props.currentPage) return
  emit('update:currentPage', page)
}
</script>

<style scoped>
.pagination {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 0.4rem;
  margin: 1.5rem 0 0.5rem;
  flex-wrap: wrap;
}
.page-btn {
  min-width: 38px;
  padding: 0.5rem 0.75rem;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #334155;
  border-radius: 8px;
  cursor: pointer;
  font-weight: 600;
  transition: background-color 0.15s, border-color 0.15s, color 0.15s;
}
.page-btn:hover:not(:disabled):not(.active) {
  background: #f1f5f9;
  border-color: #94a3b8;
}
.page-btn.active {
  background: #2c3e50;
  border-color: #2c3e50;
  color: #ffffff;
  cursor: default;
}
.page-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
=======
  currentPage: {
    type: Number,
    required: true
  },
  totalPages: {
    type: Number,
    required: true
  },
  pageSize: {
    type: Number,
    default: 10
  }
})

const emit = defineEmits(['page-change', 'page-size-change'])

const goToPage = (page) => {
  if (page >= 1 && page <= props.totalPages && page !== '...') {
    emit('page-change', page)
  }
}

const nextPage = () => {
  if (props.currentPage < props.totalPages) {
    emit('page-change', props.currentPage + 1)
  }
}

const previousPage = () => {
  if (props.currentPage > 1) {
    emit('page-change', props.currentPage - 1)
  }
}

const firstPage = () => {
  emit('page-change', 1)
}

const lastPage = () => {
  emit('page-change', props.totalPages)
}

const changePageSize = (event) => {
  emit('page-size-change', parseInt(event.target.value))
}

// Tính toán các trang hiển thị
const displayedPages = computed(() => {
  const pages = []
  const current = props.currentPage
  const total = props.totalPages
  
  if (total <= 7) {
    for (let i = 1; i <= total; i++) {
      pages.push(i)
    }
  } else {
    if (current <= 4) {
      for (let i = 1; i <= 5; i++) pages.push(i)
      pages.push('...')
      pages.push(total)
    } else if (current >= total - 3) {
      pages.push(1)
      pages.push('...')
      for (let i = total - 4; i <= total; i++) pages.push(i)
    } else {
      pages.push(1)
      pages.push('...')
      for (let i = current - 1; i <= current + 1; i++) pages.push(i)
      pages.push('...')
      pages.push(total)
    }
  }
  
  return pages
})
</script>

<template>
  <div class="pagination">
    <div class="pagination-info">
      <span>Trang {{ currentPage }} / {{ totalPages }}</span>
      <select class="page-size-select" @change="changePageSize" :value="pageSize">
        <option value="5">5 / trang</option>
        <option value="10">10 / trang</option>
        <option value="20">20 / trang</option>
        <option value="50">50 / trang</option>
      </select>
    </div>
    
    <div class="pagination-controls" v-if="totalPages > 1">
      <button 
        @click="firstPage" 
        :disabled="currentPage === 1"
        class="pagination-btn"
        title="Trang đầu"
      >
        ««
      </button>
      
      <button 
        @click="previousPage" 
        :disabled="currentPage === 1"
        class="pagination-btn"
        title="Trang trước"
      >
        «
      </button>
      
      <button
        v-for="page in displayedPages"
        :key="page"
        @click="goToPage(page)"
        :disabled="page === '...'"
        :class="['pagination-btn', 'page-number', { active: page === currentPage }]"
      >
        {{ page }}
      </button>
      
      <button 
        @click="nextPage" 
        :disabled="currentPage === totalPages"
        class="pagination-btn"
        title="Trang tiếp"
      >
        »
      </button>
      
      <button 
        @click="lastPage" 
        :disabled="currentPage === totalPages"
        class="pagination-btn"
        title="Trang cuối"
      >
        »»
      </button>
    </div>
  </div>
</template>

<style scoped>
.pagination {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  margin-top: 1rem;
}

.pagination-info {
  display: flex;
  align-items: center;
  gap: 1rem;
  color: #666;
  font-size: 0.9rem;
}

.page-size-select {
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 0.9rem;
}

.page-size-select:hover {
  border-color: #42b983;
}

.pagination-controls {
  display: flex;
  gap: 0.25rem;
}

.pagination-btn {
  min-width: 36px;
  height: 36px;
  padding: 0 0.5rem;
  border: 1px solid #ddd;
  background: white;
  color: #333;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.pagination-btn:hover:not(:disabled) {
  background: #f0f0f0;
  border-color: #42b983;
  color: #42b983;
}

.pagination-btn.active {
  background: #42b983;
  color: white;
  border-color: #42b983;
}

.pagination-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  background: #f5f5f5;
}

.page-number {
  font-weight: 500;
}

@media (max-width: 768px) {
  .pagination {
    flex-direction: column;
    gap: 1rem;
  }
  
  .pagination-controls {
    flex-wrap: wrap;
    justify-content: center;
  }
>>>>>>> Stashed changes
}
</style>
