<template>
  <div class="container email-management">
    <h2>📧 Quản lý Thư Nhắc Nhở Trả Sách</h2>

    <section class="card-section filter-section">
      <div class="filter-toolbar">
        <div class="email-info">
          <p><strong>📅 Cron Job:</strong> Tự động chạy vào lúc 8:00 sáng hàng ngày</p>
          <p><strong>📨 Chức năng:</strong> Gửi email nhắc nhở trước 1 ngày khi đến hạn trả sách</p>
        </div>
        <button @click="sendReminderEmails" class="btn-send-email" :disabled="sending">
          {{ sending ? 'Đang gửi...' : '📧 Gửi Email Nhắc Nhở Ngay' }}
        </button>
      </div>
    </section>

    <section class="list-section">
      <h3 class="list-title">Lịch sử gửi email</h3>

      <div v-if="emailHistory.length === 0" class="empty-list">
        Chưa có email nào được gửi.
      </div>

      <div v-else class="table-container">
        <table class="email-table">
          <thead>
            <tr>
              <th>Người nhận</th>
              <th>Tên sách</th>
              <th>Hạn trả</th>
              <th>Trạng thái</th>
              <th>Thời gian gửi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="email in emailHistory" :key="email.id">
              <td>{{ email.studentEmail }}</td>
              <td>{{ email.bookTitle }}</td>
              <td>{{ email.dueDate }}</td>
              <td>
                <span :class="['status-badge', email.status]">
                  {{ email.status === 'success' ? '✅ Thành công' : '❌ Thất bại' }}
                </span>
              </td>
              <td>{{ email.sentAt }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <div v-if="message" class="message" :class="messageType">
      {{ message }}
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import api from '../api/axios.js'

const sending = ref(false)
const message = ref('')
const messageType = ref('success')
const emailHistory = ref([])

async function sendReminderEmails() {
  sending.value = true
  message.value = ''

  try {
    const res = await api.post('/send-reminder-emails')
    message.value = res.data.message
    messageType.value = res.data.failed && res.data.failed > 0 ? 'error' : 'success'

    if (Array.isArray(res.data.failures)) {
      emailHistory.value = res.data.failures.map((f, idx) => ({
        id: idx,
        studentEmail: f.studentEmail,
        bookTitle: f.bookTitle,
        dueDate: f.dueDate,
        status: 'error',
        sentAt: '-'
      }))
    } else {
      emailHistory.value = []
    }
  } catch (error) {
    message.value = error.response?.data?.error || 'Lỗi khi gửi email'
    messageType.value = 'error'
  } finally {
    sending.value = false
  }
}
</script>

<style scoped>
.email-management {
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
}

.filter-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1.5rem;
  width: 100%;
  margin-bottom: 2rem;
}

.email-info {
  flex: 1;
}

.email-info p {
  margin: 0.5rem 0;
  color: #555;
}

.btn-send-email {
  background-color: #007bff;
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 4px;
  cursor: pointer;
  font-size: 1rem;
  transition: background-color 0.3s ease;
}

.btn-send-email:hover:not(:disabled) {
  background-color: #0056b3;
}

.btn-send-email:disabled {
  background-color: #a8d5ba;
  cursor: not-allowed;
}

.table-container {
  margin-top: 1.5rem;
  border: 1px solid #eee;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
  overflow-x: auto;
  width: 100%;
}

.email-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 1rem;
}

.email-table th,
.email-table td {
  white-space: nowrap;
}

.email-table th,
.email-table td {
  border: 1px solid #eee;
  padding: 0.75rem;
  text-align: left;
}

.email-table tbody tr:nth-child(even) {
  background-color: #f9f9f9;
}

.email-table tbody tr:hover {
  background-color: #f1f1f1;
}

.email-table th {
  background-color: #f8f8f8;
}

.status-badge {
  padding: 0.25rem 0.5rem;
  border-radius: 4px;
  font-size: 0.85rem;
  font-weight: bold;
}

.status-badge.success {
  background-color: #d4edda;
  color: #155724;
}

.status-badge.error {
  background-color: #f8d7da;
  color: #721c24;
}

.message {
  margin-top: 1rem;
  padding: 1rem;
  border-radius: 4px;
  font-weight: bold;
}

.message.success {
  background-color: #d4edda;
  color: #155724;
  border: 1px solid #c3e6cb;
}

.message.error {
  background-color: #f8d7da;
  color: #721c24;
  border: 1px solid #f5c6cb;
}

.empty-list {
  text-align: center;
  padding: 2rem;
  color: #666;
  background-color: #f9f9f9;
  border-radius: 8px;
}
</style>

