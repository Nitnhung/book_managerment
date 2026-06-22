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

<script setup>
import { computed } from 'vue'

const props = defineProps({
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
}
</style>
