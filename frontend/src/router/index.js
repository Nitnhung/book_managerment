
import { createRouter, createWebHistory } from 'vue-router'
import BookManagement from '../views/BookManagement.vue'
import BorrowManagement from '../views/BorrowManagement.vue'
import StudentManagement from '../views/StudentManagement.vue'
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

  next() // Cho phép đi tiếp
})

export default router