<script setup>
// Định nghĩa Props nhận từ Component cha
defineProps({
  book: {
    type: Object,
    required: true
  }
})

// Định nghĩa các Event gửi ngược lại cho Component cha
const emit = defineEmits(['toggle-status', 'delete-book', 'edit-book'])
</script>

<template>
  <div class="book-card" :class="{ 'not-available': !book.isAvailable }">
    <div class="book-info">
      <h4>{{ book.title }}</h4>
      <p><strong>Tác giả:</strong> {{ book.author }}</p>
      <p><strong>Thể loại:</strong> <span class="badge">{{ book.category }}</span> ({{ book.year }})</p>
      <p>
        <strong>Trạng thái:</strong> 
        <span :class="book.isAvailable ? 'text-green' : 'text-red'">
          {{ book.isAvailable ? 'Còn sách' : 'Đã mượn' }}
        </span>
      </p>
    </div>
    
    <div class="actions">
      <button @click="$emit('edit-book', book)" class="btn-edit">sửa Sách</button>
      <button @click="$emit('delete-book', book.id)" class="btn-delete">Xóa Sách</button>
    </div>
  </div>
</template>

<style scoped src="../assets/style/BookCard.css"></style>