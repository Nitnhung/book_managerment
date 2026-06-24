<script setup>
import { ref, computed, onMounted } from 'vue'

defineProps({
  book: {
    type: Object,
    required: true
  }
})

defineEmits(['delete-book', 'edit-book', 'view-details', 'request-borrow'])

const userRole = ref('')

onMounted(() => {
  const userData = localStorage.getItem('user')
  if (userData) {
    const user = JSON.parse(userData)
    userRole.value = user?.role || ''
  }
})

const isAdmin = computed(() => userRole.value === 'admin')
const isLibrarian = computed(() => userRole.value === 'librarian')
const canManageBooks = computed(() => isAdmin.value || isLibrarian.value)
</script>

<template>
  <div class="book-card" :class="{ 'not-available': !book.isAvailable }">
    <div class="book-info">
      <h4>{{ book.title }}</h4>
      <p><strong>Tác giả:</strong> {{ book.author }}</p>
      <p><strong>Thể loại:</strong> <span class="badge">{{ book.category }}</span> ({{ book.year }})</p>
      <p><strong>Số lượng:</strong> {{ book.totalCopies }} quyển ({{ book.availableCopies }} còn sách)</p>
      <p>
        <strong>Trạng thái:</strong>
        <span :class="book.isAvailable ? 'text-green' : 'text-red'">
          {{ book.isAvailable ? 'Còn sách' : 'Hết sách' }}
        </span>
      </p>
    </div>

    <div class="actions">
      <button v-if="canManageBooks" @click="$emit('view-details', book)" class="btn-detail">Xem chi tiết</button>
      <button v-if="canManageBooks" @click="$emit('edit-book', book)" class="btn-edit">Sửa</button>
      <button
        v-if="book.isAvailable"
        @click="$emit('request-borrow', book)"
        class="btn-request"
      >
        Yêu cầu mượn
      </button>
    </div>
  </div>
</template>

<style scoped src="../assets/style/BookCard.css"></style>
