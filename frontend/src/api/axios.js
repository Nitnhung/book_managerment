import axios from 'axios'; // Đảm bảo đã chạy npm install axios

// Tạo một instance của axios với cấu hình cơ bản
const api = axios.create({
  baseURL: 'http://localhost:3000/api',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Interceptor cho Request: Tự động đính kèm Token vào Header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Interceptor cho Response: Xử lý lỗi tập trung
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Nếu nhận được lỗi 401 (Unauthorized), tự động đăng xuất
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login'; // Chuyển hướng trực tiếp
    }
    return Promise.reject(error);
  }
);

export default api;