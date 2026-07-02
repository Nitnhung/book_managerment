
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
import ExportReport from '../views/ExportReport.vue'
import MyBorrowRequests from '../views/MyBorrowRequests.vue'

const routes = [
  { path: '/login',            name: 'Login',              component: Login },
  { path: '/register',         name: 'StudentRegister',    component: StudentRegister },
  { path: '/',                 name: 'Dashboard',          component: Dashboard },
  { path: '/books',            name: 'Books',              component: BookManagement },
  { path: '/borrows',          name: 'Borrows',            component: BorrowManagement },
  { path: '/borrows/history',  name: 'BorrowHistory',      component: BorrowHistory },
  { path: '/borrow-requests',  name: 'BorrowRequests',     component: BorrowRequests },
  { path: '/students',         name: 'StudentManagement',  component: StudentManagement },
  { path: '/my-borrows',       name: 'StudentBorrowHistory', component: StudentBorrowHistory },
  { path: '/my-borrow-requests', name: 'MyBorrowRequests', component: MyBorrowRequests },
  { path: '/profile',          name: 'UpdateProfile',      component: UpdateProfile },
  { path: '/emails',           name: 'EmailManagement',    component: EmailManagement },
  { path: '/export',           name: 'ExportReport',       component: ExportReport },
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// Navigation Guard
router.beforeEach((to, from, next) => {
  const publicPages  = ['/login', '/register', '/', '/books']
  const authRequired = !publicPages.includes(to.path)
  const loggedIn     = !!localStorage.getItem('token')

  // 1. Chưa đăng nhập mà vào trang cần auth → về Login
  if (authRequired && !loggedIn) {
    return next('/login')
  }

  // 2. Đã đăng nhập mà vào Login/Register → về trang chủ
  if ((to.path === '/login' || to.path === '/register') && loggedIn) {
    return next('/')
  }

  // 3. Phân quyền theo vai trò
  let role = null
  try {
    const user = JSON.parse(localStorage.getItem('user') || 'null')
    role = user?.role || null
  } catch {
    role = null
  }

  // Trang chỉ admin/librarian được vào
  const adminOnlyPages = [
    '/borrows', '/students', '/borrow-requests',
    '/borrows/history', '/emails', '/export'
  ]

  // Student vào trang admin → về trang chủ
  if (loggedIn && role === 'student' && adminOnlyPages.includes(to.path)) {
    return next('/')
  }

  // Admin/librarian vào trang student → về trang chủ
  if (loggedIn && (role === 'admin' || role === 'librarian') && to.path === '/my-borrows') {
    return next('/')
  }

  next()
})

export default router
