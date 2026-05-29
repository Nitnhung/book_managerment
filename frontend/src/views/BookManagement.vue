<script setup>
import { ref, computed, onMounted } from 'vue'
import BookCard from '../components/BookCard.vue'

const books = ref([]) // Lưu danh sách sách từ API
const searchQuery = ref('') // Lưu từ khóa tìm kiếm người dùng nhập
const selectedCategory = ref('Tất cả') // Lưu bộ lọc thể loại

// Chứa thông tin cho form tạo sách mới
const newBook = ref({
  title: '',
  author: '',
  category: 1, // Để mặc định là số 1 tương ứng CNTT
  year: new Date().getFullYear()
})

const isEditModalOpen = ref(false)
// Chứa thông tin của cuốn sách đang được chỉnh sửa trong Modal
const editingBook = ref({
  id: null,
  title: '',
  author: '',
  category: 1,
  year: new Date().getFullYear()
})

// 1. Tải danh sách sách và "Map" lại dữ liệu để phù hợp với giao diện
async function fetchBooks() {
  try {
    const response = await fetch('http://localhost:3000/api/books')
    const data = await response.json()
    
    // Chuyển đổi dữ liệu thô từ DB thành các thuộc tính dễ hiểu cho Frontend
    books.value = data.map(b => ({
      id: b.IdBook, // Khớp với trường khóa chính trong DB của bạn
      title: b.nameBook,
      author: b.author,
      category: b.category === 1 ? 'Công nghệ thông tin' : b.category === 2 ? 'Văn học' : 'Khoa học',
      categoryId: b.category,
      year: b.year,
      isAvailable: b.status === 1 || b.status === true || b.status === '1'
    }))
  } catch (error) {
    console.error('Lỗi khi lấy danh sách sách:', error)
  }
}

// Gọi hàm lấy dữ liệu ngay khi component được nạp vào trình duyệt
onMounted(() => {
  fetchBooks()
})

// 2. Gửi yêu cầu POST để thêm sách mới
async function addBook() {
  // Kiểm tra dữ liệu đầu vào cơ bản ở Frontend
  if (!newBook.value.title || !newBook.value.author) {
    alert('Vui lòng nhập đầy đủ thông tin!')
    return
  }

  try {
    const bookData = {
      nameBook: newBook.value.title,
      author: newBook.value.author,
      year: newBook.value.year,
      category: parseInt(newBook.value.category)
    }

    const response = await fetch('http://localhost:3000/api/books', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookData)
    })

    if (response.ok) {
      await fetchBooks() // Làm mới danh sách sau khi thêm thành công
      newBook.value.title = ''
      newBook.value.author = ''
      newBook.value.category = 1
    }
  } catch (error) {
    console.error('Lỗi khi thêm sách:', error)
  }
}

// 2.1 Gán dữ liệu sách cần sửa vào biến tạm và mở Modal
function openEditModal(book) {
  editingBook.value = { 
    id: book.id,
    title: book.title,
    author: book.author,
    category: book.categoryId,
    year: book.year
  }
  isEditModalOpen.value = true
}

// 2.2 Lưu thông tin sách đã sửa
async function updateBook() {
  try {
    // Gửi yêu cầu PUT kèm ID sách để cập nhật dữ liệu vào DB
    const response = await fetch(`http://localhost:3000/api/books/${editingBook.value.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nameBook: editingBook.value.title,
        author: editingBook.value.author,
        year: editingBook.value.year,
        category: parseInt(editingBook.value.category)
      })
    })

    if (response.ok) {
      alert('🎉 Cập nhật thông tin sách thành công!')
      isEditModalOpen.value = false
      await fetchBooks() // Reload dữ liệu để hiển thị thông tin mới nhất
    } else {
      alert('Có lỗi xảy ra khi cập nhật sách.')
    }
  } catch (error) {
    console.error('Lỗi khi cập nhật sách:', error)
  }
}

// 3. Xóa sách khỏi MySQL dựa vào ID chuẩn
async function deleteBook(id) {
  if (!id) {
    alert('Lỗi: Không tìm thấy ID của cuốn sách này!')
    return
  }
  
  // Hiển thị hộp thoại xác nhận trước khi thực hiện hành động nguy hiểm
  if (!confirm('Bạn có chắc chắn muốn xóa cuốn sách này không?')) return

  try {
    // Gửi phương thức DELETE chuẩn RESTful
    const response = await fetch(`http://localhost:3000/api/books/${id}`, {
      method: 'DELETE'
    })

    if (response.ok) {
      alert('🎉 Đã xóa cuốn sách thành công!')
      await fetchBooks() // Reload lại danh sách sau khi xóa
    } else {
      const errData = await response.json()
      // Hiển thị lỗi từ Backend (ví dụ: sách đang được mượn)
      alert('Không thể xóa: ' + (errData.error || 'Lỗi từ hệ thống Backend.'))
    }
  } catch (error) {
    console.error('Lỗi kết nối API xóa:', error)
    alert('Không thể kết nối đến Backend!')
  }
}

// 4. Logic lọc sách (Tìm kiếm + Thể loại) mà không cần tải lại trang
// Computed sẽ tự động tính toán lại mỗi khi searchQuery hoặc selectedCategory thay đổi
const filteredBooks = computed(() => {
  return books.value.filter(book => {
    // Chuyển về chữ thường để tìm kiếm không phân biệt hoa thường
    const matchesSearch = book.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
                          book.author.toLowerCase().includes(searchQuery.value.toLowerCase())
    // Kiểm tra thể loại có khớp với lựa chọn không
    const matchesCategory = selectedCategory.value === 'Tất cả' || book.category === selectedCategory.value
    return matchesSearch && matchesCategory
  })
})
</script>

<template>
  <div class="container">
    
    <section class="card-section form-section">
      <h3>➕ Thêm Sách Mới</h3>
      <form @submit.prevent="addBook" class="book-form">
        <input v-model="newBook.title" type="text" placeholder="Tên sách" required />
        <input v-model="newBook.author" type="text" placeholder="Tác giả" required />
        <select v-model="newBook.category">
          <option :value="1">Công nghệ thông tin</option>
          <option :value="2">Văn học</option>
          <option :value="3">Khoa học</option>
        </select>
        <input v-model.number="newBook.year" type="number" placeholder="Năm xuất bản" required />
        <button type="submit" class="btn-submit">Thêm sách</button>
      </form>
    </section>

    <section class="card-section filter-section">
      <input v-model="searchQuery" type="text" placeholder="🔍 Tìm kiếm theo tên hoặc tác giả..." class="search-input" />
      <select v-model="selectedCategory" class="filter-select">
        <option value="Tất cả">🎨 Tất cả thể loại</option>
        <option value="Công nghệ thông tin">Công nghệ thông tin</option>
        <option value="Văn học">Văn học</option>
        <option value="Khoa học">Khoa học</option>
      </select>
    </section>

    <section class="list-section">
      <h3 class="list-title">Danh mục sách hiện có ({{ filteredBooks.length }} cuốn)</h3>
      
      <div v-if="filteredBooks.length === 0" class="empty-list">
        Không tìm thấy cuốn sách nào phù hợp.
      </div>

      <div class="book-grid" v-else>
        <BookCard 
          v-for="book in filteredBooks" 
          :key="book.id" 
          :book="book"
          @delete-book="deleteBook"
          @edit-book="openEditModal"
        />
      </div>
    </section>

    <!-- Modal Sửa Sách -->
    <div v-if="isEditModalOpen" class="modal-overlay" @click.self="isEditModalOpen = false">
      <div class="modal-content">
        <h3>📝 Chỉnh sửa thông tin sách</h3>
        <form @submit.prevent="updateBook" class="edit-form">
          <label>Tên sách</label>
          <input v-model="editingBook.title" type="text" required />
          <label>Tác giả</label>
          <input v-model="editingBook.author" type="text" required />
          <label>Thể loại</label>
          <select v-model="editingBook.category">
            <option :value="1">Công nghệ thông tin</option>
            <option :value="2">Văn học</option>
            <option :value="3">Khoa học</option>
          </select>
          <label>Năm xuất bản</label>
          <input v-model.number="editingBook.year" type="number" required />
          <div class="modal-actions">
            <button type="button" class="btn-cancel" @click="isEditModalOpen = false">Hủy</button>
            <button type="submit" class="btn-submit">Lưu thay đổi</button>
          </div>
        </form>
      </div>
    </div>

  </div>
</template>

<style scoped src="../assets/style/BookManagement.css"></style>