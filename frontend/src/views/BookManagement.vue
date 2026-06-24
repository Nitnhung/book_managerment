<script setup>
import { ref, computed, onMounted } from 'vue'
import { useValidation } from '../composables/useValidation.js'
import { usePagination } from '../composables/usePagination.js'
import { useSearch } from '../composables/useSearch.js'
import BookCard from '../components/BookCard.vue'
import Pagination from '../components/Pagination.vue'
import BorrowModal from '../components/BorrowModal.vue'
import api from '../api/axios.js'

const books = ref([])
const selectedCategory = ref('Tất cả')
const isAddModalOpen = ref(false)
const isEditModalOpen = ref(false)
const isDetailModalOpen = ref(false)
const isBorrowRequestModalOpen = ref(false)
const bookCopies = ref([])
const detailBook = ref(null)
const loadingCopies = ref(false)
const isRequesting = ref(false)
const userRole = ref('')
const selectedBookForRequest = ref(null)

onMounted(() => {
  const userData = localStorage.getItem('user')
  if (userData) {
    const user = JSON.parse(userData)
    userRole.value = user?.role || ''
  }
})

const isAdmin = computed(() => userRole.value === 'admin')
const isLibrarian = computed(() => userRole.value === 'librarian')
const isStudent = computed(() => userRole.value === 'student')
const canManageBooks = computed(() => isAdmin.value || isLibrarian.value)

const newBook = ref({
  title: '',
  author: '',
  category: 'Công nghệ thông tin',
  year: new Date().getFullYear(),
  quantity: 1
})

const editingBook = ref({
  oldTitle: '',
  oldAuthor: '',
  oldYear: null,
  oldCategory: null,
  title: '',
  author: '',
  category: 'Công nghệ thông tin',
  year: new Date().getFullYear()
})

const formErrors = ref({})

const { validate } = useValidation()
const { searchQuery, filteredData: searchedBooks } = useSearch(books, ['title', 'author'])

const filteredBooks = computed(() => {
  return searchedBooks.value.filter(book => {
    return selectedCategory.value === 'Tất cả' || book.category === selectedCategory.value
  })
})

const { currentPage, pageSize, paginatedItems, goToPage, changePageSize } = usePagination(filteredBooks, 10)

const getBookValidationRules = (currentYear) => ({
  title: [
    { type: 'required', message: 'Vui lòng nhập Tên sách!' },
    { type: 'maxLength', value: 255, message: 'Tên sách không được vượt quá 255 ký tự.' }
  ],
  author: [
    { type: 'required', message: 'Vui lòng nhập Tác giả!' },
    { type: 'maxLength', value: 255, message: 'Tên tác giả không được vượt quá 255 ký tự.' }
  ],
  year: [
    { type: 'required', message: 'Vui lòng nhập Năm xuất bản!' },
    { type: 'isInteger', message: 'Năm xuất bản phải là một số nguyên.' },
    { type: 'minYear', value: 1000, message: 'Năm xuất bản phải lớn hơn hoặc bằng 1000.' },
    { type: 'maxYear', value: currentYear + 1, message: `Năm xuất bản không được vượt quá ${currentYear + 1}.` }
  ],
  quantity: [
    { type: 'required', message: 'Vui lòng nhập Số lượng!' },
    { type: 'isInteger', message: 'Số lượng phải là số nguyên.' }
  ]
})

async function fetchBooks() {
  try {
    const response = await api.get('/books/grouped')
    books.value = response.data.map(b => ({
      title: b.title,
      author: b.author,
      category: b.category,
      categoryId: b.categoryId,
      year: b.year,
      totalCopies: b.totalCopies,
      availableCopies: b.availableCopies,
      isAvailable: b.availableCopies > 0
    }))
  } catch (error) {
    console.error('Lỗi khi lấy danh sách sách:', error)
  }
}

onMounted(fetchBooks)

function openAddModal() {
  isAddModalOpen.value = true
  newBook.value = {
    title: '',
    author: '',
    category: 'Công nghệ thông tin',
    year: new Date().getFullYear(),
    quantity: 1
  }
  formErrors.value = {}
}

async function addBook() {
  const currentYear = new Date().getFullYear()
  const errors = validate(newBook.value, getBookValidationRules(currentYear))
  formErrors.value = errors
  if (Object.keys(errors).length > 0) return

  const quantity = parseInt(newBook.value.quantity)
  if (quantity < 1 || quantity > 100) {
    formErrors.value.quantity = 'Số lượng phải từ 1 đến 100!'
    return
  }

  try {
    await api.post('/books', {
      nameBook: newBook.value.title,
      author: newBook.value.author,
      year: newBook.value.year,
      category: newBook.value.category,
      quantity
    })
    alert(`🎉 Đã thêm thành công ${quantity} quyển sách!`)
    isAddModalOpen.value = false
    fetchBooks()
  } catch (error) {
    alert('❌ Lỗi: ' + (error.response?.data?.error || 'Không thể thêm sách.'))
  }
}

function openEditModal(book) {
  editingBook.value = {
    oldTitle: book.title,
    oldAuthor: book.author,
    oldYear: book.year,
    oldCategory: book.categoryId,
    title: book.title,
    author: book.author,
    category: book.categoryId,
    year: book.year
  }
  isEditModalOpen.value = true
  formErrors.value = {}
}

async function updateBook() {
  const currentYear = new Date().getFullYear()
  const errors = validate(editingBook.value, getBookValidationRules(currentYear))
  formErrors.value = errors
  if (Object.keys(errors).length > 0) return

  try {
    await api.put('/books/group', {
      oldTitle: editingBook.value.oldTitle,
      oldAuthor: editingBook.value.oldAuthor,
      oldYear: editingBook.value.oldYear,
      oldCategory: editingBook.value.oldCategory,
      nameBook: editingBook.value.title,
      author: editingBook.value.author,
      year: editingBook.value.year,
      category: editingBook.value.category
    })

    alert('🎉 Cập nhật đầu sách thành công!')
    isEditModalOpen.value = false
    fetchBooks()
  } catch (error) {
    alert('❌ Lỗi: ' + (error.response?.data?.error || 'Cập nhật thất bại.'))
  }
}

async function openDetailModal(book) {
  detailBook.value = book
  isDetailModalOpen.value = true
  loadingCopies.value = true
  bookCopies.value = []

  try {
    const response = await api.get('/books/copies-by-title', {
      params: {
        title: book.title,
        author: book.author,
        year: book.year,
        category: book.categoryId
      }
    })
    bookCopies.value = response.data
  } catch (error) {
    console.error('Lỗi lấy chi tiết bản sao:', error)
  } finally {
    loadingCopies.value = false
  }
}

async function deleteCopy(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa quyển sách này không?')) return

  try {
    await api.delete(`/books/${id}`)
    alert('🎉 Đã xóa quyển sách thành công!')
    await openDetailModal(detailBook.value)
    fetchBooks()
  } catch (error) {
    alert('❌ Lỗi: ' + (error.response?.data?.error || 'Xóa thất bại.'))
  }
}

async function requestBorrow(book) {
  const user = JSON.parse(localStorage.getItem('user'))
  if (!user) {
    alert('Vui lòng đăng nhập để yêu cầu mượn sách!')
    return
  }

  try {
    // Get a specific copy ID from the grouped book
    const response = await api.get('/books/copies-by-title', {
      params: {
        title: book.title,
        author: book.author,
        year: book.year,
        category: book.categoryId
      }
    })

    const availableCopies = response.data.filter(copy => copy.status === 1)
    if (availableCopies.length === 0) {
      alert('❌ Hiện không có bản sao nào có sẵn!')
      return
    }

    // Use the first available copy
    const copyId = availableCopies[0].IdBook

    selectedBookForRequest.value = {
      IdBook: copyId,
      nameBook: book.title
    }
    isBorrowRequestModalOpen.value = true
  } catch (error) {
    alert('❌ Lỗi: ' + (error.response?.data?.error || 'Không thể lấy thông tin sách.'))
  }
}

async function handleBorrowRequestSubmit(data) {
  try {
    await api.post('/borrow-requests', {
      IdBook: data.IdBook,
      borrow_date: data.borrow_date,
      due_date: data.due_date
    })

    alert('🎉 Gửi yêu cầu mượn sách thành công! Vui lòng chờ quản lý duyệt.')
    isBorrowRequestModalOpen.value = false
    selectedBookForRequest.value = null
    fetchBooks()
  } catch (error) {
    alert('❌ Lỗi: ' + (error.response?.data?.error || 'Không thể gửi yêu cầu.'))
  }
}

const handlePageChange = (page) => goToPage(page)
const handlePageSizeChange = (newSize) => changePageSize(newSize)
</script>

<template>
  <div class="container">
    <div class="page-header">
      <h2>📚 Quản Lý Sách</h2>
      <button v-if="canManageBooks" @click="openAddModal" class="btn-add">➕ Thêm Sách Mới</button>
    </div>

    <section class="card-section filter-section">
      <div class="filter-controls">
        <input v-model="searchQuery" type="text" placeholder="🔍 Tìm kiếm theo tên hoặc tác giả..." class="search-input" />
        <select v-model="selectedCategory" class="filter-select">
          <option value="Tất cả">🎨 Tất cả thể loại</option>
          <option value="Công nghệ thông tin">Công nghệ thông tin</option>
          <option value="Văn học">Văn học</option>
          <option value="Khoa học">Khoa học</option>
        </select>
      </div>
    </section>

    <section class="list-section">
      <div class="list-header">
        <h3 class="list-title">Danh mục đầu sách ({{ filteredBooks.length }} đầu sách)</h3>
      </div>

      <div v-if="filteredBooks.length === 0" class="empty-list">
        Không tìm thấy đầu sách nào phù hợp.
      </div>

      <div v-else>
        <div class="book-grid">
          <BookCard
            v-for="book in paginatedItems"
            :key="`${book.title}-${book.author}-${book.year}`"
            :book="book"
            @edit-book="openEditModal"
            @view-details="openDetailModal"
            @request-borrow="requestBorrow"
          />
        </div>

        <Pagination
          :current-page="currentPage"
          :total-pages="Math.ceil(filteredBooks.length / pageSize) || 1"
          :page-size="pageSize"
          @page-change="handlePageChange"
          @page-size-change="handlePageSizeChange"
        />
      </div>
    </section>

    <!-- Modal Thêm Sách -->
    <div v-if="isAddModalOpen" class="modal-overlay" @click.self="isAddModalOpen = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>➕ Thêm Sách Mới</h3>
          <button @click="isAddModalOpen = false" class="btn-close">×</button>
        </div>
        <form @submit.prevent="addBook" class="edit-form">
          <div class="form-group">
            <label>Tên đầu sách *</label>
            <input v-model="newBook.title" type="text" placeholder="Nhập tên sách" required />
            <span v-if="formErrors.title" class="error-text">{{ formErrors.title }}</span>
          </div>

          <div class="form-group">
            <label>Tác giả *</label>
            <input v-model="newBook.author" type="text" placeholder="Nhập tác giả" required />
            <span v-if="formErrors.author" class="error-text">{{ formErrors.author }}</span>
          </div>

          <div class="form-group">
            <label>Thể loại *</label>
            <input list="categoryList" v-model="newBook.category" placeholder="Chọn hoặc nhập thể loại mới..." required />
            <datalist id="categoryList">
              <option value="Công nghệ thông tin"></option>
              <option value="Văn học"></option>
              <option value="Khoa học"></option>
            </datalist>
          </div>

          <div class="form-group">
            <label>Năm xuất bản *</label>
            <input v-model.number="newBook.year" type="number" placeholder="Năm xuất bản" required />
            <span v-if="formErrors.year" class="error-text">{{ formErrors.year }}</span>
          </div>

          <div class="form-group">
            <label>Số lượng *</label>
            <input v-model.number="newBook.quantity" type="number" min="1" max="100" placeholder="Số quyển cần thêm" required />
            <small class="hint-text">Mỗi quyển sẽ có ID riêng trong hệ thống</small>
            <span v-if="formErrors.quantity" class="error-text">{{ formErrors.quantity }}</span>
          </div>

          <div class="modal-actions">
            <button type="button" class="btn-cancel" @click="isAddModalOpen = false">Hủy</button>
            <button type="submit" class="btn-submit">Thêm sách</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Sửa Sách -->
    <div v-if="isEditModalOpen" class="modal-overlay" @click.self="isEditModalOpen = false">
      <div class="modal-content">
        <div class="modal-header">
          <h3>📝 Chỉnh sửa đầu sách</h3>
          <button @click="isEditModalOpen = false" class="btn-close">×</button>
        </div>
        <form @submit.prevent="updateBook" class="edit-form">
          <div class="form-group">
            <label>Tên đầu sách *</label>
            <input v-model="editingBook.title" type="text" required />
            <span v-if="formErrors.title" class="error-text">{{ formErrors.title }}</span>
          </div>

          <div class="form-group">
            <label>Tác giả *</label>
            <input v-model="editingBook.author" type="text" required />
            <span v-if="formErrors.author" class="error-text">{{ formErrors.author }}</span>
          </div>

          <div class="form-group">
            <label>Thể loại *</label>
            <input list="categoryList" v-model="editingBook.category" placeholder="Chọn hoặc nhập thể loại mới..." required />
          </div>

          <div class="form-group">
            <label>Năm xuất bản *</label>
            <input v-model.number="editingBook.year" type="number" required />
            <span v-if="formErrors.year" class="error-text">{{ formErrors.year }}</span>
          </div>

          <p class="hint-text">Thay đổi sẽ áp dụng cho tất cả bản sao của đầu sách này.</p>

          <div class="modal-actions">
            <button type="button" class="btn-cancel" @click="isEditModalOpen = false">Hủy</button>
            <button type="submit" class="btn-submit">Lưu thay đổi</button>
          </div>
        </form>
      </div>
    </div>

    <!-- Modal Chi tiết bản sao -->
    <div v-if="isDetailModalOpen" class="modal-overlay" @click.self="isDetailModalOpen = false">
      <div class="modal-content modal-wide">
        <div class="modal-header">
          <h3>📖 Chi tiết: {{ detailBook?.title }}</h3>
          <button @click="isDetailModalOpen = false" class="btn-close">×</button>
        </div>

        <p class="detail-subtitle">
          Tác giả: <strong>{{ detailBook?.author }}</strong> |
          {{ detailBook?.totalCopies }} quyển ({{ detailBook?.availableCopies }} còn sách)
        </p>

        <div v-if="loadingCopies" class="empty-list">Đang tải...</div>

        <table v-else-if="bookCopies.length" class="copies-table">
          <thead>
            <tr>
              <th>ID Sách</th>
              <th>Trạng thái</th>
              <th>Hành động</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="copy in bookCopies" :key="copy.IdBook">
              <td>#{{ copy.IdBook }}</td>
              <td>
                <span :class="copy.status === 1 ? 'text-green' : 'text-red'">
                  {{ copy.status === 1 ? 'Còn sách' : 'Đã mượn' }}
                </span>
              </td>
              <td>
                <button
                  @click="deleteCopy(copy.IdBook)"
                  class="btn-delete-copy"
                  :disabled="copy.status !== 1"
                >
                  Xóa
                </button>
              </td>
            </tr>
          </tbody>
        </table>

        <div v-else class="empty-list">Không có bản sao nào.</div>
      </div>
    </div>

    <!-- BorrowModal for Student Request -->
    <BorrowModal
      v-if="isStudent"
      :is-open="isBorrowRequestModalOpen"
      mode="request"
      :book-info="selectedBookForRequest"
      :student-info="{ MSV: JSON.parse(localStorage.getItem('user'))?.username, fullName: JSON.parse(localStorage.getItem('user'))?.fullName }"
      @close="isBorrowRequestModalOpen = false"
      @submit="handleBorrowRequestSubmit"
    />
  </div>
</template>

<style scoped>
.container {
  max-width: 1400px;
  margin: 0 auto;
  padding: 0 20px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2rem;
}

.page-header h2 {
  color: #2c3e50;
  font-size: 2rem;
  font-weight: 700;
}

.btn-add {
  background-color: #42b983;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  cursor: pointer;
  font-size: 1rem;
  font-weight: 600;
  transition: background-color 0.3s;
}

.btn-add:hover {
  background-color: #3aa876;
}

.card-section {
  background: #ffffff;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
  margin-bottom: 1.5rem;
}

.filter-controls {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.search-input {
  flex: 1;
  min-width: 200px;
  padding: 0.75rem 1rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 1rem;
}

.search-input:focus {
  outline: none;
  border-color: #42b983;
  box-shadow: 0 0 0 3px rgba(66, 185, 131, 0.1);
}

.filter-select {
  min-width: 150px;
  padding: 0.75rem 1rem;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 1rem;
  background: white;
  cursor: pointer;
}

.list-section {
  background: #ffffff;
  padding: 1.5rem;
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
}

.list-header {
  margin-bottom: 1.5rem;
}

.list-title {
  color: #1f2937;
  font-size: 1.25rem;
  font-weight: 700;
}

.book-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1.5rem;
  margin-bottom: 2rem;
}

.empty-list {
  text-align: center;
  padding: 3rem;
  color: #94a3b8;
  font-size: 1.1rem;
  background: #f8fafc;
  border-radius: 8px;
}

.modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
}

.modal-content {
  background: white;
  padding: 2rem;
  border-radius: 16px;
  width: 90%;
  max-width: 500px;
  max-height: 90vh;
  overflow-y: auto;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
}

.modal-wide {
  max-width: 640px;
}

.modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
  padding-bottom: 1rem;
  border-bottom: 2px solid #f0f0f0;
}

.modal-header h3 {
  margin: 0;
  color: #2c3e50;
  font-size: 1.5rem;
}

.btn-close {
  background: none;
  border: none;
  font-size: 2rem;
  color: #94a3b8;
  cursor: pointer;
}

.edit-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-group label {
  font-weight: 600;
  font-size: 0.9rem;
  color: #34495e;
}

.form-group input,
.form-group select {
  padding: 0.75rem;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  font-size: 1rem;
}

.hint-text {
  color: #64748b;
  font-size: 0.85rem;
}

.error-text {
  color: #ef4444;
  font-size: 0.85rem;
}

.modal-actions {
  display: flex;
  gap: 1rem;
  justify-content: flex-end;
  margin-top: 1rem;
  padding-top: 1rem;
  border-top: 2px solid #f0f0f0;
}

.btn-cancel {
  background-color: #94a3b8;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.btn-submit {
  background-color: #42b983;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  cursor: pointer;
  font-weight: 600;
}

.detail-subtitle {
  color: #64748b;
  margin: 0 0 1rem;
}

.copies-table {
  width: 100%;
  border-collapse: collapse;
}

.copies-table th,
.copies-table td {
  border: 1px solid #e2e8f0;
  padding: 10px 12px;
  text-align: left;
}

.copies-table th {
  background: #f8fafc;
  font-weight: 700;
}

.text-green {
  color: #22c55e;
  font-weight: bold;
}

.text-red {
  color: #ef4444;
  font-weight: bold;
}

.btn-delete-copy {
  background: #ef4444;
  color: white;
  border: none;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}

.btn-delete-copy:disabled {
  background: #fca5a5;
  cursor: not-allowed;
}
</style>
