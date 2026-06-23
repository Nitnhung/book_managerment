
import { createRouter, createWebHistory } from 'vue-router'
import BookManagement from '../views/BookManagement.vue'
import BorrowManagement from '../views/BorrowManagement.vue'
import StudentManagement from '../views/StudentManagement.vue'
import StudentHistory from '../views/StudentHistory.vue'
import Login from '../views/Login.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/',
    name: 'Books',
    component: BookManagement
  },
  {
    path: '/borrows',
    name: 'Borrows',
    component: BorrowManagement
  },
  {
    path: '/students', 
    name: 'StudentManagement',
    component: StudentManagement
  },
  {
    // Trang dành cho sinh viên: xem lịch sử mượn sách của chính mình
    path: '/my-borrows',
    name: 'StudentHistory',
    component: StudentHistory,
    meta: { role: 'student' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation Guard: "Người gác cổng" kiểm tra quyền truy cập
router.beforeEach((to, from, next) => {
  const publicPages = ['/login'] // Các trang không cần đăng nhập
  const authRequired = !publicPages.includes(to.path)
  const loggedIn = localStorage.getItem('token') // Kiểm tra token trong bộ nhớ trình duyệt

  // 1. Nếu trang yêu cầu đăng nhập mà chưa có token -> Đẩy về trang Login
  if (authRequired && !loggedIn) {
    return next('/login')
  }

  // 2. Nếu đã đăng nhập rồi mà cố tình quay lại trang Login -> Đẩy về trang chủ
  if (to.path === '/login' && loggedIn) {
    return next('/')
  }

  // 3. Phân quyền theo vai trò
  let role = null
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    role = user?.role || null
  } catch (e) {
    role = null
  }

  // Sinh viên chỉ được phép truy cập trang lịch sử mượn của mình
  if (loggedIn && role === 'student' && to.path !== '/my-borrows') {
    return next('/my-borrows')
  }

  // Tài khoản thủ thư/admin không cần vào trang dành riêng cho sinh viên
  if (loggedIn && role !== 'student' && to.meta?.role === 'student') {
    return next('/')
  }

  next() // Cho phép đi tiếp
})

export default router