
import { createRouter, createWebHistory } from 'vue-router'
import BookManagement from '../views/BookManagement.vue'
import BorrowManagement from '../views/BorrowManagement.vue'
import StudentManagement from '../views/StudentManagement.vue'

const routes = [
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

export default router