<template>
  <div class="container export-page">
    <h2>📊 Xuất Báo Cáo Excel</h2>

    <!-- Danh sách các loại báo cáo -->
    <div class="report-grid">
      <div
        v-for="report in reports" :key="report.id"
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

    <!-- Panel lọc + preview + xuất -->
    <div v-if="selectedReport" class="export-panel card-section">
      <div class="panel-header">
        <h3>{{ selectedReport.icon }} {{ selectedReport.title }}</h3>
        <p class="panel-desc">{{ selectedReport.desc }}</p>
      </div>

      <!-- Bộ lọc -->
      <div v-if="selectedReport.filters?.length" class="filter-row">
        <template v-for="f in selectedReport.filters" :key="f.key">
          <div v-if="f.type === 'select'" class="filter-item">
            <label>{{ f.label }}</label>
            <select v-model="filterValues[f.key]" @change="loadPreview">
              <option v-for="opt in f.options" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
            </select>
          </div>
          <div v-if="f.type === 'dateRange'" class="filter-item">
            <label>{{ f.label }} từ</label>
            <input type="date" v-model="filterValues[f.key + '_from']" @change="loadPreview" />
            <label>đến</label>
            <input type="date" v-model="filterValues[f.key + '_to']"   @change="loadPreview" />
          </div>
        </template>
      </div>

      <!-- Số lượng bản ghi -->
      <div class="preview-info">
        <span v-if="loading">⏳ Đang tải dữ liệu...</span>
        <span v-else>
          📋 Tìm thấy <strong>{{ previewRows.length }}</strong> bản ghi
          <em v-if="previewRows.length === 0" class="warn-text"> — không có dữ liệu để xuất</em>
        </span>
      </div>

      <!-- Preview bảng (10 dòng đầu) -->
      <div v-if="!loading && previewRows.length > 0" class="preview-table-wrap">
        <p class="preview-label">
          Xem trước {{ Math.min(10, previewRows.length) }} / {{ previewRows.length }} dòng:
        </p>
        <div class="table-container">
          <table class="preview-table">
            <thead>
              <tr>
                <th v-for="col in selectedReport.columns" :key="col.key">{{ col.label }}</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(row, i) in previewRows.slice(0, 10)" :key="i">
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
          :disabled="exporting || loading || previewRows.length === 0"
          @click="doExport"
        >
          <span v-if="exporting">⏳ Đang tạo file...</span>
          <span v-else>⬇️ Xuất Excel ({{ previewRows.length }} dòng)</span>
        </button>
      </div>
    </div>

    <!-- Hướng dẫn khi chưa chọn -->
    <div v-if="!selectedReport" class="empty-guide">
      <p>👆 Chọn loại báo cáo phía trên để xem và xuất dữ liệu.</p>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { useExport } from '../composables/useExport.js'
import api from '../api/axios.js'

const { exportToExcel } = useExport()
const selectedId   = ref(null)
const filterValues = ref({})
const exporting    = ref(false)
const loading      = ref(false)
const previewRows  = ref([])

// =====================================================
// CẤU HÌNH BÁO CÁO — thêm columns và fetchFn để preview
// =====================================================
const reports = [
  {
    id: 'books', icon: '📚',
    title: 'Danh sách sách',
    desc:  'Tên, tác giả, thể loại, số lượng, trạng thái',
    tag:   'Quản lý sách',
    fileName: 'DanhSachSach',
    columns: [
      { key: 'title',           label: 'Tên sách' },
      { key: 'author',          label: 'Tác giả' },
      { key: 'category',        label: 'Thể loại' },
      { key: 'year',            label: 'Năm XB' },
      { key: 'totalCopies',     label: 'Tổng SL' },
      { key: 'availableCopies', label: 'Còn sẵn' },
      { key: 'isAvailable',     label: 'Trạng thái' },
    ],
    filters: [
      {
        key: 'status', type: 'select', label: 'Trạng thái',
        options: [
          { value: '', label: 'Tất cả' },
          { value: 'available',   label: 'Còn sách' },
          { value: 'unavailable', label: 'Hết sách' },
        ]
      }
    ],
    fetchFn: async (fv) => {
      const res = await api.get('/books/grouped')
      let rows = res.data.map(b => ({
        title: b.title, author: b.author, category: b.category, year: b.year,
        totalCopies: b.totalCopies, availableCopies: b.availableCopies,
        isAvailable: b.isAvailable ? 'Còn sách' : 'Hết sách',
      }))
      if (fv.status === 'available')   rows = rows.filter(r => r.isAvailable === 'Còn sách')
      if (fv.status === 'unavailable') rows = rows.filter(r => r.isAvailable === 'Hết sách')
      return rows
    },
  },
  {
    id: 'students', icon: '👨‍🎓',
    title: 'Danh sách sinh viên',
    desc:  'MSV, họ tên, lớp, email',
    tag:   'Quản lý sinh viên',
    fileName: 'DanhSachSinhVien',
    columns: [
      { key: 'MSV',      label: 'Mã sinh viên' },
      { key: 'fullName', label: 'Họ và tên' },
      { key: 'class',    label: 'Lớp' },
      { key: 'email',    label: 'Email' },
    ],
    filters: [],
    fetchFn: async () => {
      const res = await api.get('/students')
      return res.data
    },
  },
  {
    id: 'borrows_active', icon: '📋',
    title: 'Sách đang được mượn',
    desc:  'Các thẻ mượn đang hoạt động (chưa trả)',
    tag:   'Quản lý mượn trả',
    fileName: 'SachDangMuon',
    columns: [
      { key: 'MSV',       label: 'Mã sinh viên' },
      { key: 'fullName',  label: 'Họ và tên' },
      { key: 'class',     label: 'Lớp' },
      { key: 'nameBook',  label: 'Tên sách' },
      { key: 'timeStart', label: 'Ngày mượn' },
      { key: 'timeEnd',   label: 'Hạn trả' },
    ],
    filters: [],
    fetchFn: async () => {
      const res = await api.get('/borrows')
      return res.data
    },
  },
  {
    id: 'borrows_history', icon: '📜',
    title: 'Lịch sử mượn sách',
    desc:  'Toàn bộ lịch sử mượn trả, có thể lọc theo thời gian',
    tag:   'Lịch sử',
    fileName: 'LichSuMuonSach',
    columns: [
      { key: 'MSV',        label: 'Mã sinh viên' },
      { key: 'fullName',   label: 'Họ và tên' },
      { key: 'class',      label: 'Lớp' },
      { key: 'nameBook',   label: 'Tên sách' },
      { key: 'timeStart',  label: 'Ngày mượn' },
      { key: 'timeEnd',    label: 'Hạn trả' },
      { key: 'returnDate', label: 'Ngày trả thực' },
      { key: 'status',     label: 'Trạng thái' },
    ],
    filters: [
      { key: 'borrow_date', type: 'dateRange', label: 'Ngày mượn' },
      {
        key: 'status', type: 'select', label: 'Trạng thái',
        options: [
          { value: '', label: 'Tất cả' },
          { value: '1', label: 'Đang mượn' },
          { value: '0', label: 'Đã trả' },
        ]
      }
    ],
    fetchFn: async (fv) => {
      const res = await api.get('/borrows/history')
      let rows = res.data.map(r => ({
        ...r, status: r.status === 1 ? 'Đang mượn' : 'Đã trả',
      }))
      if (fv.status === '1') rows = rows.filter(r => r.status === 'Đang mượn')
      if (fv.status === '0') rows = rows.filter(r => r.status === 'Đã trả')
      if (fv.borrow_date_from) rows = rows.filter(r => r.timeStart >= fv.borrow_date_from)
      if (fv.borrow_date_to)   rows = rows.filter(r => r.timeStart <= fv.borrow_date_to)
      return rows
    },
  },
]

const selectedReport = computed(() => reports.find(r => r.id === selectedId.value) ?? null)

// Fetch dữ liệu preview mỗi khi chọn report hoặc thay đổi filter
async function loadPreview() {
  if (!selectedReport.value?.fetchFn) return
  loading.value = true
  try {
    previewRows.value = await selectedReport.value.fetchFn(filterValues.value)
  } catch (e) {
    console.error('Lỗi tải preview:', e)
    previewRows.value = []
  } finally {
    loading.value = false
  }
}

function selectReport(report) {
  selectedId.value   = report.id
  filterValues.value = {}
  loadPreview()
}

async function doExport() {
  if (!selectedReport.value) return
  exporting.value = true
  try {
    const params = {}
    const fv = filterValues.value
    if (fv.status)           params.status = fv.status
    if (fv.borrow_date_from) params.from   = fv.borrow_date_from
    if (fv.borrow_date_to)   params.to     = fv.borrow_date_to

    await exportToExcel({
      type:     selectedReport.value.id,
      fileName: selectedReport.value.fileName,
      params,
    })
  } catch (e) {
    console.error('Export thất bại:', e)
    alert('Xuất file thất bại. Vui lòng thử lại!')
  } finally {
    exporting.value = false
  }
}
</script>

<style scoped>
.export-page { max-width: 1400px; margin: 0 auto; padding: 1.5rem; }
.export-page h2 { margin: 0 0 1.5rem; color: #2c3e50; }

.report-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 1rem; margin-bottom: 1.5rem;
}
.report-card {
  display: flex; align-items: flex-start; gap: 1rem;
  padding: 1.1rem 1.2rem; border: 2px solid #e2e8f0;
  border-radius: 12px; background: white; cursor: pointer; transition: all 0.2s;
}
.report-card:hover { border-color: #42b983; box-shadow: 0 4px 12px rgba(66,185,131,0.12); transform: translateY(-2px); }
.report-card.selected { border-color: #42b983; background: #f0faf5; }
.card-icon { font-size: 2rem; flex-shrink: 0; margin-top: 2px; }
.card-body { flex: 1; }
.card-body h3 { margin: 0 0 0.3rem; font-size: 0.95rem; color: #2c3e50; }
.card-body p  { margin: 0 0 0.5rem; font-size: 0.82rem; color: #7f8c8d; line-height: 1.4; }
.card-tag { display: inline-block; padding: 0.15rem 0.5rem; background: #e0f2fe; color: #0369a1; border-radius: 4px; font-size: 0.75rem; font-weight: 600; }
.card-check { font-size: 1.1rem; flex-shrink: 0; }

.export-panel { display: flex; flex-direction: column; gap: 1.25rem; }
.panel-header h3 { margin: 0 0 0.3rem; color: #2c3e50; }
.panel-desc { margin: 0; color: #7f8c8d; font-size: 0.9rem; }

.filter-row {
  display: flex; flex-wrap: wrap; gap: 1rem;
  padding: 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;
}
.filter-item { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }
.filter-item label { font-weight: 600; font-size: 0.88rem; color: #34495e; white-space: nowrap; }
.filter-item select, .filter-item input[type="date"] {
  padding: 0.45rem 0.75rem; border: 1px solid #dcdfe6;
  border-radius: 6px; font-size: 0.88rem; background: white; transition: border-color 0.2s;
}
.filter-item select:focus, .filter-item input[type="date"]:focus { outline: none; border-color: #42b983; }

.preview-info {
  padding: 0.65rem 1rem; background: #f8fafc;
  border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.9rem; color: #555;
}
.warn-text { color: #e67e22; }

.preview-table-wrap { overflow: hidden; }
.preview-label { margin: 0 0 0.6rem; font-size: 0.85rem; color: #7f8c8d; }
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
.preview-table tbody tr:nth-child(even) { background: #f8fafc; }
.preview-table tbody tr:hover { background: #f0faf5; }

.export-actions { display: flex; justify-content: flex-end; }
.btn-export {
  padding: 0.8rem 2rem; background: #27ae60; color: white;
  border: none; border-radius: 8px; cursor: pointer;
  font-size: 1rem; font-weight: 700; transition: background 0.2s, transform 0.1s;
}
.btn-export:hover:not(:disabled) { background: #219a52; transform: translateY(-1px); }
.btn-export:disabled { background: #a8d5ba; cursor: not-allowed; transform: none; }

.empty-guide {
  text-align: center; padding: 3rem 2rem; color: #94a3b8;
  background: #f8fafc; border: 2px dashed #e2e8f0; border-radius: 12px;
}
</style>
