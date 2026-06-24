
import { createRouter, createWebHistory } from 'vue-router'
import BookManagement from '../views/BookManagement.vue'
import BorrowManagement from '../views/BorrowManagement.vue'
import StudentManagement from '../views/StudentManagement.vue'
import Login from '../views/Login.vue'
import Dashboard from '../views/Dashboard.vue'
import BorrowHistory from '../views/BorrowHistory.vue'
import StudentRegister from '../views/StudentRegister.vue'
import UpdateProfile from '../views/UpdateProfile.vue'
import BorrowRequests from '../views/BorrowRequests.vue'
import StudentBorrowHistory from '../views/StudentBorrowHistory.vue'
import EmailManagement from '../views/EmailManagement.vue'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: Login
  },
  {
    path: '/register',
    name: 'StudentRegister',
    component: StudentRegister
  },
  {
    path: '/',
    name: 'Dashboard',
    component: Dashboard
  },
  {
    path: '/books',
    name: 'Books',
    component: BookManagement
  },
  {
    path: '/borrows',
    name: 'Borrows',
    component: BorrowManagement
  },
  {
    path: '/borrows/history',
    name: 'BorrowHistory',
    component: BorrowHistory
  },
  {
    path: '/borrow-requests',
    name: 'BorrowRequests',
    component: BorrowRequests
  },
  {
    path: '/students',
    name: 'StudentManagement',
    component: StudentManagement
  },
  {
    path: '/my-borrows',
    name: 'StudentBorrowHistory',
    component: StudentBorrowHistory
  },
  {
    path: '/profile',
    name: 'UpdateProfile',
    component: UpdateProfile
  },
  {
    path: '/emails',
    name: 'EmailManagement',
    component: EmailManagement
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation Guard: "Người gác cổng" kiểm tra quyền truy cập
router.beforeEach((to, from, next) => {
  const publicPages = ['/login', '/register', '/'] // Các trang không cần đăng nhập
  const authRequired = !publicPages.includes(to.path)
  const loggedIn = localStorage.getItem('token') // Kiểm tra token trong bộ nhớ trình duyệt

  // 1. Nếu trang yêu cầu đăng nhập mà chưa có token -> Đẩy về trang Login
  if (authRequired && !loggedIn) {
    return next('/login')
  }

  // 2. Nếu đã đăng nhập rồi mà cố tình quay lại trang Login hoặc Register -> Đẩy về trang chủ
  if ((to.path === '/login' || to.path === '/register') && loggedIn) {
    return next('/')
  }

  next() // Cho phép đi tiếp
})

export default router