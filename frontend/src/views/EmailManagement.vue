<template>
  <div class="container email-management">
    <h2>📧 Quản lý Email Thư Viện</h2>

    <!-- Tabs -->
    <div class="tabs">
      <button :class="['tab', { active: activeTab === 'reminder' }]" @click="activeTab = 'reminder'">
        ⏰ Nhắc nhở tự động
      </button>
      <button :class="['tab', { active: activeTab === 'custom' }]" @click="activeTab = 'custom'">
        ✉️ Gửi email tùy chỉnh
      </button>
      <button :class="['tab', { active: activeTab === 'history' }]" @click="activeTab = 'history'">
        📋 Lịch sử gửi
        <span v-if="emailHistory.length" class="tab-badge">{{ emailHistory.length }}</span>
      </button>
    </div>

    <!-- ===== TAB 1: NHẮC NHỞ TỰ ĐỘNG ===== -->
    <section v-if="activeTab === 'reminder'" class="card-section">
      <div class="send-panel">
        <div class="email-info">
          <h3>ℹ️ Thông tin hệ thống</h3>
          <p><span class="info-label">📨 Nền tảng:</span> <strong>Gmail</strong> (SMTP via Nodemailer)</p>
          <p><span class="info-label">📮 Tài khoản:</span> <strong>{{ senderEmail }}</strong></p>
          <p><span class="info-label">📅 Điều kiện:</span> Sinh viên có hạn trả sách <strong>vào ngày mai</strong></p>

          <!-- Trạng thái cron job -->
          <div class="cron-status-box">
            <div class="cron-status-header">
              <span class="cron-dot" :class="cronStatus ? 'dot-green' : 'dot-gray'"></span>
              <strong>Cron Job tự động</strong>
            </div>
            <div v-if="cronStatus" class="cron-info">
              <p><span class="info-label">🕐 Lịch chạy:</span> {{ cronStatus.schedule }}</p>
              <p><span class="info-label">🌏 Múi giờ:</span> {{ cronStatus.timezone }}</p>
              <p><span class="info-label">⏭️ Lần tiếp theo:</span> <strong>{{ cronStatus.nextRun }}</strong></p>
            </div>
            <div v-else class="cron-loading">Đang tải trạng thái...</div>
          </div>
        </div>

        <div class="send-controls">
          <h3>⚙️ Gửi thủ công ngay bây giờ</h3>
          <p class="hint-text">Cron job sẽ tự chạy theo lịch. Dùng nút này khi muốn gửi ngay.</p>
          <div class="limit-options">
            <label class="field-label">Số lượng người nhận:</label>
            <div class="limit-buttons">
              <button v-for="opt in limitOptions" :key="String(opt.value)"
                :class="['btn-limit', { active: selectedLimit === opt.value }]"
                @click="selectedLimit = opt.value">
                {{ opt.label }}
              </button>
            </div>
            <p class="hint-text">
              <span v-if="selectedLimit === null">📋 Gửi cho <strong>tất cả</strong> sinh viên sắp đến hạn trả</span>
              <span v-else>📋 Gửi thử cho <strong>{{ selectedLimit }} người</strong> đầu tiên</span>
            </p>
          </div>
          <button @click="sendReminderEmails" class="btn-send" :disabled="sending">
            {{ sending ? '⏳ Đang gửi...' : '📧 Gửi Email Nhắc Nhở Ngay' }}
          </button>
        </div>
      </div>
    </section>

    <!-- ===== TAB 2: GỬI EMAIL TÙY CHỈNH ===== -->
    <section v-if="activeTab === 'custom'" class="card-section custom-section">

      <!-- Bước 1: Chọn chế độ người nhận -->
      <div class="mode-selector">
        <label class="field-label">👥 Chế độ người nhận:</label>
        <div class="mode-buttons">
          <button :class="['btn-mode', { active: sendMode === 'all' }]" @click="setSendMode('all')">
            📋 Toàn bộ sinh viên
          </button>
          <button :class="['btn-mode', { active: sendMode === 'select' }]" @click="setSendMode('select')">
            ☑️ Tự chọn danh sách
          </button>
        </div>
      </div>

      <div class="custom-body">
        <!-- Cột trái: Danh sách người nhận -->
        <div class="recipients-col">

          <!-- Chế độ Tất cả -->
          <div v-if="sendMode === 'all'" class="all-mode-info">
            <div class="all-badge">
              <span class="all-icon">📋</span>
              <div>
                <p class="all-title">Gửi cho toàn bộ sinh viên</p>
                <p class="all-sub">{{ allStudents.length }} sinh viên trong hệ thống</p>
              </div>
            </div>
          </div>

          <!-- Chế độ Tự chọn -->
          <template v-else>
            <input
              v-model="searchQuery"
              type="text"
              placeholder="🔎 Tìm theo MSV, Email hoặc Tên..."
              class="search-input"
            />

            <!-- Kết quả tìm kiếm -->
            <div v-if="searchQuery" class="search-results">
              <div v-if="filteredStudents.length === 0" class="empty-hint">
                Không tìm thấy sinh viên phù hợp.
              </div>
              <div v-else
                v-for="s in filteredStudents.slice(0, 8)"
                :key="s.MSV"
                class="result-item"
                @click="toggleSelect(s)"
              >
                <input type="checkbox" :checked="isSelected(s.MSV)" @click.stop="toggleSelect(s)" />
                <div class="result-info">
                  <span class="result-name">{{ s.fullName }}</span>
                  <span class="result-meta">{{ s.MSV }} · {{ s.email }}</span>
                </div>
              </div>
            </div>

            <!-- Danh sách đã chọn -->
            <div class="selected-header">
              <span class="field-label">✅ Đã chọn ({{ selectedStudents.length }} người):</span>
              <button v-if="selectedStudents.length" @click="selectedStudents = []" class="btn-clear-sel">
                Bỏ chọn tất cả
              </button>
            </div>

            <div v-if="selectedStudents.length === 0" class="empty-hint">
              Chưa chọn sinh viên nào. Tìm và tích chọn ở trên.
            </div>
            <div v-else class="selected-list">
              <div v-for="s in selectedStudents" :key="s.MSV" class="selected-chip">
                <span>{{ s.fullName }} <em>({{ s.MSV }})</em></span>
                <button @click="toggleSelect(s)" class="chip-remove">×</button>
              </div>
            </div>
          </template>
        </div>

        <!-- Cột phải: Soạn email -->
        <div class="compose-col">
          <h3>✉️ Soạn email</h3>

          <div class="form-group">
            <label class="field-label">📝 Tiêu đề *</label>
            <input v-model="customEmail.subject" type="text" placeholder="Nhập tiêu đề email..." />
          </div>

          <div class="form-group">
            <label class="field-label">💬 Nội dung *</label>
            <div class="quill-wrap">
              <QuillEditor
                v-model:content="customEmail.html"
                content-type="html"
                :toolbar="quillToolbar"
                theme="snow"
                placeholder="Nhập nội dung email... Hệ thống sẽ tự thêm lời chào và ký tên."
              />
            </div>
          </div>

          <div class="recipient-summary">
            <span v-if="sendMode === 'all'">
              📬 Sẽ gửi tới <strong>toàn bộ {{ allStudents.length }} sinh viên</strong>
            </span>
            <span v-else-if="selectedStudents.length">
              📬 Sẽ gửi tới <strong>{{ selectedStudents.length }} sinh viên</strong> đã chọn
            </span>
            <span v-else class="warn-text">⚠️ Chưa chọn người nhận</span>
          </div>

          <button @click="sendCustomEmail" class="btn-send"
            :disabled="sendingCustom || !customEmail.subject || !customEmail.html || customEmail.html === '<p><br></p>' || (sendMode === 'select' && selectedStudents.length === 0)">
            {{ sendingCustom ? '⏳ Đang gửi...' : `📧 Gửi cho ${sendMode === 'all' ? 'tất cả' : selectedStudents.length + ' người'}` }}
          </button>
        </div>
      </div>
    </section>

    <!-- Thông báo kết quả -->
    <div v-if="message" :class="['result-message', messageType]">
      <span class="result-icon">{{ messageType === 'success' ? '✅' : messageType === 'warning' ? '⚠️' : '❌' }}</span>
      {{ message }}
    </div>

    <!-- ===== TAB 3: LỊCH SỬ GỬI EMAIL ===== -->
    <section v-if="activeTab === 'history'" class="card-section">
      <div class="list-header">
        <h3 class="list-title">
          📋 Lịch sử gửi email
          <span v-if="emailHistory.length" class="history-count">({{ emailHistory.length }} bản ghi)</span>
        </h3>
        <button v-if="emailHistory.length" @click="clearHistory" class="btn-clear">🗑️ Xóa lịch sử</button>
      </div>

      <div v-if="!emailHistory.length" class="empty-list">Chưa có email nào được gửi trong phiên này.</div>

      <div v-else>
        <div class="table-container">
          <table class="email-table">
            <thead>
              <tr>
                <th>Người nhận</th>
                <th>Tiêu đề</th>
                <th>Loại</th>
                <th>Trạng thái</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="email in pagedHistory" :key="email.id">
                <td>{{ email.studentEmail }}</td>
                <td>{{ email.subject }}</td>
                <td><span :class="['type-badge', email.type]">{{ email.type === 'reminder' ? '⏰ Nhắc nhở' : '✉️ Tùy chỉnh' }}</span></td>
                <td><span :class="['status-badge', email.status]">{{ email.status === 'success' ? '✅ Thành công' : '❌ Thất bại' }}</span></td>
                <td>{{ email.sentAt }}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <Pagination
          :current-page="currentPage"
          :total-pages="Math.max(1, totalPages)"
          :page-size="pageSize"
          @page-change="goToPage"
          @page-size-change="changePageSize"
        />
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, onMounted, watch } from 'vue'
import { useSearch } from '../composables/useSearch.js'
import { usePagination } from '../composables/usePagination.js'
import Pagination from '../components/Pagination.vue'
import { QuillEditor } from '@vueup/vue-quill'
import '@vueup/vue-quill/dist/vue-quill.snow.css'
import api from '../api/axios.js'

// ---- State chung ----
const activeTab     = ref('reminder')
const sending       = ref(false)
const sendingCustom = ref(false)
const message       = ref('')
const messageType   = ref('success')
const emailHistory  = ref([])
const cronStatus    = ref(null)

// ---- Tab 1: Nhắc nhở ----
const selectedLimit = ref(null)
const limitOptions  = [
  { label: '1 người', value: 1 },
  { label: '5 người', value: 5 },
  { label: 'Tất cả',  value: null },
]
const senderEmail = 'nhungthihongnguyen06@gmail.com'

// ---- Tab 2: Tùy chỉnh ----
const sendMode         = ref('all')   // 'all' | 'select'
const allStudents      = ref([])
const selectedStudents = ref([])      // danh sách sinh viên đã tích chọn
const customEmail = ref({ subject: '', html: '' })

// Cấu hình toolbar Quill: đầy đủ font/size/màu/bold/italic/link/list/...
const quillToolbar = [
  [{ font: [] }, { size: ['small', false, 'large', 'huge'] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: [] }, { background: [] }],
  [{ align: [] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['link'],
  ['clean']
]

// Tái sử dụng useSearch: tìm theo MSV, email, fullName
const { searchQuery, filteredData: filteredStudents } = useSearch(allStudents, ['MSV', 'email', 'fullName'])

// ---- Phân trang lịch sử gửi email ----
const {
  currentPage, pageSize, totalPages, paginatedItems: pagedHistory,
  goToPage, changePageSize, resetPagination
} = usePagination(emailHistory, 10)

// Reset về trang 1 mỗi khi history thay đổi
watch(emailHistory, () => resetPagination(), { deep: false })

// ---- Lifecycle ----
onMounted(async () => {
  const saved = localStorage.getItem('emailHistory')
  if (saved) {
    try { emailHistory.value = JSON.parse(saved) } catch {}
  }
  // Load danh sách sinh viên và trạng thái cron song song
  try {
    const [studentsRes, cronRes] = await Promise.all([
      api.get('/students'),
      api.get('/cron-status')
    ])
    allStudents.value = studentsRes.data
    cronStatus.value  = cronRes.data
  } catch (e) {
    console.error('Lỗi load dữ liệu:', e)
  }
})

// ---- Helpers ----
function setSendMode(mode) {
  sendMode.value = mode
  selectedStudents.value = []
  searchQuery.value = ''
}

function isSelected(msv) {
  return selectedStudents.value.some(s => s.MSV === msv)
}

function toggleSelect(student) {
  const idx = selectedStudents.value.findIndex(s => s.MSV === student.MSV)
  if (idx === -1) selectedStudents.value.push(student)
  else selectedStudents.value.splice(idx, 1)
}

function appendHistory(entries) {
  if (!entries.length) return
  const start = emailHistory.value.length
  emailHistory.value = [
    ...entries.map((e, i) => ({ ...e, id: start + i })),
    ...emailHistory.value
  ]
  localStorage.setItem('emailHistory', JSON.stringify(emailHistory.value))
}

function clearHistory() {
  if (!confirm('Xóa toàn bộ lịch sử gửi email?')) return
  emailHistory.value = []
  localStorage.removeItem('emailHistory')
}

// ---- Gửi nhắc nhở tự động ----
async function sendReminderEmails() {
  sending.value = true
  message.value = ''
  try {
    const payload = selectedLimit.value !== null ? { limit: selectedLimit.value } : {}
    const res = await api.post('/send-reminder-emails', payload)
    message.value = res.data.message
    messageType.value = res.data.failedCount > 0 ? 'warning' : 'success'
    appendHistory([
      ...(res.data.successes || []).map(s => ({ studentEmail: s.studentEmail, subject: `Nhắc nhở: ${s.bookTitle}`, type: 'reminder', status: 'success', sentAt: new Date().toLocaleString('vi-VN') })),
      ...(res.data.failures  || []).map(f => ({ studentEmail: f.studentEmail, subject: `Nhắc nhở: ${f.bookTitle}`, type: 'reminder', status: 'error',   sentAt: new Date().toLocaleString('vi-VN') })),
    ])
    if (res.data.successCount > 0 || res.data.failedCount > 0) activeTab.value = 'history'
  } catch (err) {
    message.value = err.response?.data?.error || 'Lỗi khi gửi email!'
    messageType.value = 'error'
  } finally { sending.value = false }
}

// ---- Gửi email tùy chỉnh (1 lần, nhiều người) ----
async function sendCustomEmail() {
  if (!customEmail.value.subject || !customEmail.value.html) return

  const payload = {
    subject: customEmail.value.subject,
    message: customEmail.value.html,   // gửi HTML lên backend
    studentMSVs: sendMode.value === 'all'
      ? 'all'
      : selectedStudents.value.map(s => s.MSV)
  }

  sendingCustom.value = true
  message.value = ''
  try {
    const res = await api.post('/send-custom-email', payload)
    message.value = res.data.message
    messageType.value = res.data.failedCount > 0 ? 'warning' : 'success'
    appendHistory([
      ...(res.data.successes || []).map(s => ({ studentEmail: s.studentEmail, subject: customEmail.value.subject, type: 'custom', status: 'success', sentAt: new Date().toLocaleString('vi-VN') })),
      ...(res.data.failures  || []).map(f => ({ studentEmail: f.studentEmail, subject: customEmail.value.subject, type: 'custom', status: 'error',   sentAt: new Date().toLocaleString('vi-VN') })),
    ])
    // Reset form và chuyển sang tab lịch sử
    customEmail.value = { subject: '', html: '' }
    selectedStudents.value = []
    activeTab.value = 'history'
  } catch (err) {
    message.value = err.response?.data?.error || 'Gửi email thất bại!'
    messageType.value = 'error'
  } finally { sendingCustom.value = false }
}
</script>

<style scoped>
.email-management { width: 100%; box-sizing: border-box; }

/* Tabs */
.tabs { display: flex; border-bottom: 2px solid #e2e8f0; margin-bottom: 0; }
.tab {
  padding: 0.75rem 1.5rem; border: none; background: none;
  cursor: pointer; font-size: 0.95rem; font-weight: 600; color: #7f8c8d;
  border-bottom: 3px solid transparent; margin-bottom: -2px; transition: all 0.2s;
}
.tab:hover { color: #42b983; }
.tab.active { color: #42b983; border-bottom-color: #42b983; }
.tab-badge {
  display: inline-flex; align-items: center; justify-content: center;
  min-width: 18px; height: 18px; padding: 0 5px;
  background: #42b983; color: white;
  border-radius: 10px; font-size: 0.72rem; font-weight: 700;
  margin-left: 6px;
}

/* Tab 1: Nhắc nhở */
.send-panel { display: grid; grid-template-columns: 1fr 1fr; gap: 2rem; }
@media (max-width: 768px) { .send-panel { grid-template-columns: 1fr; } }
.send-panel h3 { margin: 0 0 1rem; color: #2c3e50; font-size: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #f0f0f0; }
.email-info p { margin: 0.5rem 0; color: #555; font-size: 0.9rem; }
.info-label { display: inline-block; width: 130px; color: #7f8c8d; }

/* Cron status box */
.cron-status-box {
  margin-top: 1rem; padding: 1rem;
  background: #f8fafc; border: 1px solid #e2e8f0;
  border-radius: 8px;
}
.cron-status-header {
  display: flex; align-items: center; gap: 0.5rem;
  margin-bottom: 0.6rem;
}
.cron-dot {
  width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0;
}
.dot-green { background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,0.2); }
.dot-gray  { background: #94a3b8; }
.cron-info p { margin: 0.3rem 0; font-size: 0.85rem; color: #555; }
.cron-loading { font-size: 0.85rem; color: #94a3b8; }
.send-controls { display: flex; flex-direction: column; gap: 1rem; }
.limit-options { display: flex; flex-direction: column; gap: 0.5rem; }
.limit-buttons { display: flex; gap: 0.5rem; }
.btn-limit {
  flex: 1; padding: 0.55rem 0.5rem; border: 2px solid #dcdfe6;
  border-radius: 8px; background: white; color: #555;
  cursor: pointer; font-weight: 600; font-size: 0.9rem; transition: all 0.2s;
}
.btn-limit:hover { border-color: #42b983; color: #42b983; }
.btn-limit.active { border-color: #42b983; background: #42b983; color: white; }

/* Tab 2: Tùy chỉnh */
.custom-section { display: flex; flex-direction: column; gap: 1.25rem; }

.mode-selector { display: flex; align-items: center; gap: 1rem; flex-wrap: wrap; }
.mode-buttons { display: flex; gap: 0.5rem; }
.btn-mode {
  padding: 0.5rem 1.25rem; border: 2px solid #dcdfe6;
  border-radius: 8px; background: white; color: #555;
  cursor: pointer; font-weight: 600; font-size: 0.9rem; transition: all 0.2s;
}
.btn-mode:hover { border-color: #3498db; color: #3498db; }
.btn-mode.active { border-color: #3498db; background: #3498db; color: white; }

.custom-body { display: grid; grid-template-columns: 1fr 1.3fr; gap: 1.5rem; align-items: start; }
@media (max-width: 900px) { .custom-body { grid-template-columns: 1fr; } }

/* Cột trái: người nhận */
.recipients-col { display: flex; flex-direction: column; gap: 0.75rem; }

.all-mode-info { padding: 1.25rem; background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; }
.all-badge { display: flex; align-items: center; gap: 1rem; }
.all-icon { font-size: 2rem; }
.all-title { margin: 0 0 0.25rem; font-weight: 700; color: #0c4a6e; }
.all-sub { margin: 0; color: #0369a1; font-size: 0.85rem; }

.search-input {
  width: 100%; padding: 0.7rem 1rem; border: 1px solid #dcdfe6;
  border-radius: 8px; font-size: 0.9rem; box-sizing: border-box; transition: border-color 0.2s;
}
.search-input:focus { outline: none; border-color: #42b983; box-shadow: 0 0 0 3px rgba(66,185,131,0.1); }

.search-results {
  display: flex; flex-direction: column; gap: 0.4rem;
  max-height: 220px; overflow-y: auto;
  border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.5rem;
  background: white;
}
.result-item {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.5rem 0.6rem; border-radius: 6px;
  cursor: pointer; transition: background 0.15s;
}
.result-item:hover { background: #f0faf5; }
.result-item input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: #42b983; flex-shrink: 0; }
.result-info { display: flex; flex-direction: column; }
.result-name { font-weight: 600; color: #2c3e50; font-size: 0.88rem; }
.result-meta { color: #7f8c8d; font-size: 0.78rem; }

.selected-header { display: flex; justify-content: space-between; align-items: center; margin-top: 0.25rem; }
.btn-clear-sel {
  padding: 0.25rem 0.6rem; background: none; border: 1px solid #dcdfe6;
  border-radius: 5px; cursor: pointer; font-size: 0.8rem; color: #7f8c8d; transition: all 0.2s;
}
.btn-clear-sel:hover { border-color: #e53e3e; color: #e53e3e; }

.selected-list { display: flex; flex-direction: column; gap: 0.4rem; max-height: 180px; overflow-y: auto; }
.selected-chip {
  display: flex; justify-content: space-between; align-items: center;
  padding: 0.45rem 0.75rem; background: #e6f7f0;
  border: 1px solid #a8d5ba; border-radius: 20px; font-size: 0.85rem;
}
.selected-chip em { color: #3aa876; font-style: normal; }
.chip-remove {
  background: none; border: none; cursor: pointer; color: #7f8c8d;
  font-size: 1.1rem; line-height: 1; padding: 0 0 0 0.5rem; transition: color 0.2s;
}
.chip-remove:hover { color: #e53e3e; }

/* Cột phải: soạn email */
.compose-col { display: flex; flex-direction: column; gap: 0.85rem; }
.compose-col h3 { margin: 0 0 0.5rem; color: #2c3e50; font-size: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid #f0f0f0; }
.form-group { display: flex; flex-direction: column; gap: 0.4rem; }
.form-group input, .form-group textarea {
  padding: 0.7rem; border: 1px solid #dcdfe6; border-radius: 8px;
  font-size: 0.9rem; font-family: inherit; resize: vertical; transition: border-color 0.2s;
}
.form-group input:focus, .form-group textarea:focus {
  outline: none; border-color: #42b983; box-shadow: 0 0 0 3px rgba(66,185,131,0.1);
}

/* Quill Editor */
.quill-wrap {
  border: 1px solid #dcdfe6; border-radius: 8px;
  overflow: hidden; transition: border-color 0.2s;
}
.quill-wrap:focus-within { border-color: #42b983; box-shadow: 0 0 0 3px rgba(66,185,131,0.1); }

/* Ghi đè style Quill để phù hợp với design */
.quill-wrap :deep(.ql-toolbar) {
  border: none; border-bottom: 1px solid #e2e8f0;
  background: #f8fafc; border-radius: 0;
}
.quill-wrap :deep(.ql-container) {
  border: none; font-size: 0.9rem; min-height: 160px;
}
.quill-wrap :deep(.ql-editor) { min-height: 160px; }
.quill-wrap :deep(.ql-editor.ql-blank::before) {
  color: #94a3b8; font-style: normal;
}

/* HTML source preview */

.recipient-summary {
  padding: 0.6rem 0.85rem; background: #f8fafc;
  border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.88rem; color: #555;
}
.warn-text { color: #e67e22; }

/* Nút gửi chung */
.btn-send {
  width: 100%; padding: 0.85rem; background: #42b983; color: white;
  border: none; border-radius: 8px; cursor: pointer;
  font-size: 1rem; font-weight: 600; transition: background 0.2s;
}
.btn-send:hover:not(:disabled) { background: #3aa876; }
.btn-send:disabled { background: #a8d5ba; cursor: not-allowed; }

/* Các field label, hint dùng chung */
.field-label { font-weight: 600; color: #34495e; font-size: 0.9rem; }
.hint-text { margin: 0; font-size: 0.82rem; color: #7f8c8d; }
.empty-hint { padding: 0.75rem; text-align: center; color: #94a3b8; font-size: 0.85rem; background: #f8fafc; border-radius: 6px; }

/* Kết quả */
.result-message {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.9rem 1.2rem; border-radius: 8px; font-weight: 500;
}
.result-icon { font-size: 1.2rem; }
.result-message.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
.result-message.warning { background: #fff3cd; color: #856404; border: 1px solid #ffc107; }
.result-message.error   { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }

/* Lịch sử */
.list-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
.list-title { margin: 0; display: flex; align-items: center; gap: 0.5rem; }
.history-count { font-size: 0.85rem; color: #7f8c8d; font-weight: 400; }
.btn-clear {
  padding: 0.4rem 0.85rem; background: #fff5f5; color: #e53e3e;
  border: 1px solid #feb2b2; border-radius: 6px; cursor: pointer;
  font-size: 0.85rem; font-weight: 500; transition: all 0.2s;
}
.btn-clear:hover { background: #e53e3e; color: white; border-color: #e53e3e; }
.table-container { border: 1px solid #eee; border-radius: 8px; overflow-x: auto; }
.email-table { width: 100%; border-collapse: collapse; }
.email-table th, .email-table td { border: 1px solid #eee; padding: 0.75rem 1rem; text-align: left; white-space: nowrap; }
.email-table th { background: #f8f9fa; font-weight: 600; color: #2c3e50; }
.email-table tbody tr:nth-child(even) { background: #f9f9f9; }
.email-table tbody tr:hover { background: #f1f5f9; }
.status-badge, .type-badge { padding: 0.25rem 0.6rem; border-radius: 4px; font-size: 0.82rem; font-weight: 600; }
.status-badge.success { background: #d4edda; color: #155724; }
.status-badge.error   { background: #f8d7da; color: #721c24; }
.type-badge.reminder  { background: #e0f2fe; color: #0369a1; }
.type-badge.custom    { background: #f3e8ff; color: #7c3aed; }
.empty-list { text-align: center; padding: 2.5rem; color: #94a3b8; background: #f8fafc; border-radius: 8px; }
</style>
