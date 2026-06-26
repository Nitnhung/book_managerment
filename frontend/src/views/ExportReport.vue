<template>
  <div class="container export-page">
    <h2>📊 Xuất Báo Cáo Excel</h2>

    <!-- Danh sách các loại báo cáo -->
    <div class="report-grid">
      <div
        v-for="report in reports"
        :key="report.id"
        :class="['report-card', { selected: selectedId === report.id }]"
        @click="selectReport(report)"
      >
        <div class="card-icon">{{ report.icon }}</div>
        <div class="card-body">
          <h3>{{ report.title }}</h3>
          <p>{{ report.desc }}</p>
          <span class="card-tag">{{ report.tag }}</span>
        </div>
        <div class="card-check">
          <span v-if="selectedId === report.id">✅</span>
        </div>
      </div>
    </div>

    <!-- Panel lọc + xuất -->
    <div v-if="selectedReport" class="export-panel card-section">
      <div class="panel-header">
        <h3>{{ selectedReport.icon }} {{ selectedReport.title }}</h3>
        <p class="panel-desc">{{ selectedReport.desc }}</p>
      </div>

      <!-- Bộ lọc động theo từng loại báo cáo -->
      <div v-if="selectedReport.filters?.length" class="filter-row">
        <template v-for="f in selectedReport.filters" :key="f.key">

          <!-- Filter: select -->
          <div v-if="f.type === 'select'" class="filter-item">
            <label>{{ f.label }}</label>
            <select v-model="filterValues[f.key]">
              <option v-for="opt in f.options" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <!-- Filter: date range -->
          <div v-if="f.type === 'dateRange'" class="filter-item">
            <label>{{ f.label }} từ</label>
            <input type="date" v-model="filterValues[f.key + '_from']" />
            <label>đến</label>
            <input type="date" v-model="filterValues[f.key + '_to']" />
          </div>

        </template>
      </div>

      <!-- Preview số lượng bản ghi -->
      <div class="preview-info">
        <span v-if="loading">⏳ Đang tải dữ liệu...</span>
        <span v-else>
          📋 Tìm thấy <strong>{{ filteredRows.length }}</strong> bản ghi
          <em v-if="filteredRows.length === 0" class="warn-text"> — không có dữ liệu để xuất</em>
        </span>
      </div>

      <!-- Preview bảng (10 dòng đầu) -->
      <div v-if="filteredRows.length > 0" class="preview-table-wrap">
        <p class="preview-label">Xem trước ({{ Math.min(10, filteredRows.length) }} / {{ filteredRows.length }} dòng):</p>
        <div class="table-container">
          <table class="preview-table">
            <thead>
              <tr>
                <th v-for="col in selectedReport.columns" :key="col.key">{{ col.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in filteredRows.slice(0, 10)" :key="i">
                <td v-for="col in selectedReport.columns" :key="col.key">
                  {{ row[col.key] ?? '—' }}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Nút xuất -->
      <div class="export-actions">
        <button
          class="btn-export"
          :disabled="filteredRows.length === 0 || loading"
          @click="doExport"
        >
          ⬇️ Xuất Excel ({{ filteredRows.length }} dòng)
        </button>
      </div>
    </div>

    <!-- Hướng dẫn khi chưa chọn -->
    <div v-if="!selectedReport" class="empty-guide">
      <p>👆 Chọn loại báo cáo phía trên để xem tùy chọn và xuất file.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useExport } from '../composables/useExport.js'
import api from '../api/axios.js'

const { exportToExcel } = useExport()

// =====================================================
// CẤU HÌNH CÁC LOẠI BÁO CÁO
// =====================================================
const reports = [
  {
    id: 'books',
    icon: '📚',
    title: 'Danh sách sách',
    desc: 'Toàn bộ đầu sách trong thư viện (tên, tác giả, thể loại, số lượng, trạng thái)',
    tag: 'Quản lý sách',
    columns: [
      { key: 'title',           label: 'Tên sách',        width: 35 },
      { key: 'author',          label: 'Tác giả',         width: 25 },
      { key: 'category',        label: 'Thể loại',        width: 20 },
      { key: 'year',            label: 'Năm XB',          width: 10 },
      { key: 'totalCopies',     label: 'Tổng số lượng',   width: 15 },
      { key: 'availableCopies', label: 'Còn sẵn',         width: 12 },
      { key: 'isAvailable',     label: 'Trạng thái',      width: 15 },
    ],
    filters: [
      {
        key: 'category', type: 'select', label: 'Thể loại',
        options: [
          { value: '', label: 'Tất cả thể loại' },
          { value: 'Công nghệ thông tin', label: 'Công nghệ thông tin' },
          { value: 'Văn học',             label: 'Văn học' },
          { value: 'Khoa học',            label: 'Khoa học' },
        ]
      },
      {
        key: 'status', type: 'select', label: 'Trạng thái',
        options: [
          { value: '', label: 'Tất cả' },
          { value: 'available', label: 'Còn sách' },
          { value: 'unavailable', label: 'Hết sách' },
        ]
      }
    ],
    fetchFn: async () => {
      const res = await api.get('/books/grouped')
      return res.data.map(b => ({
        title:           b.title,
        author:          b.author,
        category:        b.category,
        year:            b.year,
        totalCopies:     b.totalCopies,
        availableCopies: b.availableCopies,
        isAvailable:     b.isAvailable ? 'Còn sách' : 'Hết sách',
      }))
    },
    filterFn: (rows, fv) => rows.filter(r => {
      if (fv.category && r.category !== fv.category) return false
      if (fv.status === 'available'   && r.isAvailable !== 'Còn sách') return false
      if (fv.status === 'unavailable' && r.isAvailable !== 'Hết sách') return false
      return true
    }),
    fileName: 'DanhSachSach',
    sheetName: 'Sách',
  },

  {
    id: 'students',
    icon: '👨‍🎓',
    title: 'Danh sách sinh viên',
    desc: 'Toàn bộ sinh viên trong hệ thống (MSV, họ tên, lớp, email)',
    tag: 'Quản lý sinh viên',
    columns: [
      { key: 'MSV',      label: 'Mã sinh viên', width: 15 },
      { key: 'fullName', label: 'Họ và tên',    width: 30 },
      { key: 'class',    label: 'Lớp',          width: 12 },
      { key: 'email',    label: 'Email',         width: 30 },
    ],
    filters: [],
    fetchFn: async () => {
      const res = await api.get('/students')
      return res.data
    },
    filterFn: (rows) => rows,
    fileName: 'DanhSachSinhVien',
    sheetName: 'Sinh viên',
  },

  {
    id: 'borrows_active',
    icon: '📋',
    title: 'Sách đang được mượn',
    desc: 'Danh sách các thẻ mượn đang hoạt động (chưa trả)',
    tag: 'Quản lý mượn trả',
    columns: [
      { key: 'MSV',       label: 'Mã sinh viên',  width: 15 },
      { key: 'fullName',  label: 'Họ và tên',     width: 28 },
      { key: 'class',     label: 'Lớp',           width: 12 },
      { key: 'nameBook',  label: 'Tên sách',      width: 35 },
      { key: 'timeStart', label: 'Ngày mượn',     width: 14 },
      { key: 'timeEnd',   label: 'Hạn trả',       width: 14 },
    ],
    filters: [],
    fetchFn: async () => {
      const res = await api.get('/borrows')
      return res.data
    },
    filterFn: (rows) => rows,
    fileName: 'SachDangMuon',
    sheetName: 'Đang mượn',
  },

  {
    id: 'borrows_history',
    icon: '📜',
    title: 'Lịch sử mượn sách',
    desc: 'Toàn bộ lịch sử mượn trả (có thể lọc theo khoảng thời gian)',
    tag: 'Lịch sử',
    columns: [
      { key: 'MSV',        label: 'Mã sinh viên',  width: 15 },
      { key: 'fullName',   label: 'Họ và tên',     width: 28 },
      { key: 'class',      label: 'Lớp',           width: 12 },
      { key: 'nameBook',   label: 'Tên sách',      width: 35 },
      { key: 'timeStart',  label: 'Ngày mượn',     width: 14 },
      { key: 'timeEnd',    label: 'Hạn trả',       width: 14 },
      { key: 'returnDate', label: 'Ngày trả thực', width: 15 },
      { key: 'status',     label: 'Trạng thái',    width: 14 },
    ],
    filters: [
      {
        key: 'borrow_date', type: 'dateRange', label: 'Ngày mượn',
      },
      {
        key: 'borrow_status', type: 'select', label: 'Trạng thái',
        options: [
          { value: '', label: 'Tất cả' },
          { value: '1', label: 'Đang mượn' },
          { value: '0', label: 'Đã trả' },
        ]
      }
    ],
    fetchFn: async () => {
      const res = await api.get('/borrows/history')
      return res.data.map(r => ({
        ...r,
        status: r.status === 1 ? 'Đang mượn' : 'Đã trả',
      }))
    },
    filterFn: (rows, fv) => rows.filter(r => {
      if (fv.borrow_date_from && r.timeStart < fv.borrow_date_from) return false
      if (fv.borrow_date_to   && r.timeStart > fv.borrow_date_to)   return false
      if (fv.borrow_status === '1' && r.status !== 'Đang mượn') return false
      if (fv.borrow_status === '0' && r.status !== 'Đã trả')    return false
      return true
    }),
    fileName: 'LichSuMuonSach',
    sheetName: 'Lịch sử mượn',
  },
]

// =====================================================
// STATE
// =====================================================
const selectedId   = ref(null)
const rawData      = ref([])
const loading      = ref(false)
const filterValues = ref({})

const selectedReport = computed(() => reports.find(r => r.id === selectedId.value) ?? null)

const filteredRows = computed(() => {
  if (!selectedReport.value) return []
  return selectedReport.value.filterFn(rawData.value, filterValues.value)
})

// =====================================================
// LOGIC
// =====================================================
async function selectReport(report) {
  selectedId.value   = report.id
  filterValues.value = {}
  rawData.value      = []
  loading.value      = true
  try {
    rawData.value = await report.fetchFn()
  } catch (e) {
    console.error('Lỗi tải dữ liệu:', e)
  } finally {
    loading.value = false
  }
}

function doExport() {
  if (!selectedReport.value || filteredRows.value.length === 0) return
  exportToExcel({
    rows:      filteredRows.value,
    columns:   selectedReport.value.columns,
    sheetName: selectedReport.value.sheetName,
    fileName:  selectedReport.value.fileName,
  })
}
</script>

<style scoped>
.export-page { max-width: 1400px; margin: 0 auto; padding: 1.5rem; }
.export-page h2 { margin: 0 0 1.5rem; color: #2c3e50; }

/* Grid các loại báo cáo */
.report-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.report-card {
  display: flex; align-items: flex-start; gap: 1rem;
  padding: 1.1rem 1.2rem;
  border: 2px solid #e2e8f0; border-radius: 12px;
  background: white; cursor: pointer;
  transition: all 0.2s;
}
.report-card:hover { border-color: #42b983; box-shadow: 0 4px 12px rgba(66,185,131,0.12); transform: translateY(-2px); }
.report-card.selected { border-color: #42b983; background: #f0faf5; }

.card-icon { font-size: 2rem; flex-shrink: 0; margin-top: 2px; }
.card-body { flex: 1; }
.card-body h3 { margin: 0 0 0.3rem; font-size: 0.95rem; color: #2c3e50; }
.card-body p  { margin: 0 0 0.5rem; font-size: 0.82rem; color: #7f8c8d; line-height: 1.4; }
.card-tag {
  display: inline-block; padding: 0.15rem 0.5rem;
  background: #e0f2fe; color: #0369a1;
  border-radius: 4px; font-size: 0.75rem; font-weight: 600;
}
.card-check { font-size: 1.1rem; flex-shrink: 0; }

/* Panel xuất */
.export-panel { display: flex; flex-direction: column; gap: 1.25rem; }
.panel-header h3 { margin: 0 0 0.3rem; color: #2c3e50; }
.panel-desc { margin: 0; color: #7f8c8d; font-size: 0.9rem; }

/* Bộ lọc */
.filter-row {
  display: flex; flex-wrap: wrap; gap: 1rem;
  padding: 1rem; background: #f8fafc;
  border: 1px solid #e2e8f0; border-radius: 8px;
}
.filter-item { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.filter-item label { font-weight: 600; font-size: 0.88rem; color: #34495e; white-space: nowrap; }
.filter-item select,
.filter-item input[type="date"] {
  padding: 0.45rem 0.75rem; border: 1px solid #dcdfe6;
  border-radius: 6px; font-size: 0.88rem;
  background: white; cursor: pointer; transition: border-color 0.2s;
}
.filter-item select:focus,
.filter-item input[type="date"]:focus {
  outline: none; border-color: #42b983;
}

/* Preview */
.preview-info {
  padding: 0.65rem 1rem; background: #f8fafc;
  border: 1px solid #e2e8f0; border-radius: 8px;
  font-size: 0.9rem; color: #555;
}
.warn-text { color: #e67e22; }
.preview-label { margin: 0 0 0.6rem; font-size: 0.85rem; color: #7f8c8d; }

.preview-table-wrap { overflow: hidden; }
.table-container { border: 1px solid #e2e8f0; border-radius: 8px; overflow-x: auto; }
.preview-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
.preview-table th {
  background: #f1f5f9; padding: 0.6rem 0.85rem;
  text-align: left; font-weight: 600; color: #2c3e50;
  white-space: nowrap; border-bottom: 2px solid #e2e8f0;
}
.preview-table td {
  padding: 0.55rem 0.85rem; border-bottom: 1px solid #f0f0f0;
  color: #444; white-space: nowrap; max-width: 220px;
  overflow: hidden; text-overflow: ellipsis;
}
.preview-table tbody tr:hover { background: #f8fafc; }

/* Nút xuất */
.export-actions { display: flex; justify-content: flex-end; }
.btn-export {
  padding: 0.8rem 2rem; background: #27ae60; color: white;
  border: none; border-radius: 8px; cursor: pointer;
  font-size: 1rem; font-weight: 700;
  transition: background 0.2s, transform 0.1s;
  display: flex; align-items: center; gap: 0.5rem;
}
.btn-export:hover:not(:disabled) { background: #219a52; transform: translateY(-1px); }
.btn-export:disabled { background: #a8d5ba; cursor: not-allowed; transform: none; }

/* Hướng dẫn */
.empty-guide {
  text-align: center; padding: 3rem 2rem;
  color: #94a3b8; background: #f8fafc;
  border: 2px dashed #e2e8f0; border-radius: 12px;
  font-size: 1rem;
}
</style>
