
import { createRouter, createWebHistory } from 'vue-router'
import BookManagement from '../views/BookManagement.vue'
import BorrowManagement from '../views/BorrowManagement.vue'
import StudentManagement from '../views/StudentManagement.vue'
import StudentHistory from '../views/StudentHistory.vue'
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
<<<<<<< Updated upstream
    // Trang dành cho sinh viên: xem lịch sử mượn sách của chính mình
    path: '/my-borrows',
    name: 'StudentHistory',
    component: StudentHistory,
    meta: { role: 'student' }
=======
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
>>>>>>> Stashed changes
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