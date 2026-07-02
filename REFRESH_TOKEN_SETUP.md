# Hướng dẫn cài đặt Refresh Token

## Tổng quan
Đã chuyển đổi cơ chế xác thực từ chỉ dùng Access Token (localStorage) sang cơ chế bảo mật hơn:
- **Access Token**: Lưu trong RAM (Vue state) - hết hạn sau 15 phút
- **Refresh Token**: Lưu trong Http-only Cookie - hết hạn sau 7 ngày

## Các thay đổi

### Backend
1. **Cấu hình CORS**: Đã cập nhật để cho phép gửi credentials (cookies)
2. **API Login**: Tạo access token (15 phút) và refresh token (7 ngày), set refresh token vào http-only cookie
3. **API /refresh-token**: Lấy access token mới từ refresh token
4. **API /logout**: Xóa refresh token khỏi database và cookie
5. **Hàm helper**: createRefreshToken, revokeRefreshToken, verifyRefreshToken

### Frontend
1. **useAuth composable**: Quản lý access token và user trong RAM (state)
2. **Axios interceptor**: Tự động refresh token khi nhận 401
3. **Login.vue**: Lưu access token vào state thay vì localStorage
4. **App.vue**: Sử dụng auth state và gọi API logout
5. **Các component khác**: Đã cập nhật để đọc từ auth state thay vì localStorage

## Các bước để chạy

### 1. Tạo bảng refresh_tokens trong database
Chạy file SQL sau trong MySQL:

```bash
mysql -u root -p fpt_library < backend/create_refresh_tokens_table.sql
```

Hoặc chạy trực tiếp trong MySQL Workbench/phpMyAdmin nội dung file:
`backend/create_refresh_tokens_table.sql`

### 2. Khởi động lại backend
```bash
cd backend
node index.js
```

### 3. Khởi động lại frontend
```bash
cd frontend
npm run dev
```

## Cơ chế hoạt động

### Đăng nhập
1. User đăng nhập → Backend tạo access token (15 phút) và refresh token (7 ngày)
2. Access token trả về trong response body
3. Refresh token set vào http-only cookie (không thể đọc bằng JavaScript)

### Gửi request
1. Frontend gửi access token trong Authorization header
2. Refresh token tự động gửi trong cookie (do http-only)

### Khi access token hết hạn (401)
1. Axios interceptor nhận lỗi 401
2. Tự động gọi API /refresh-token
3. Backend kiểm tra refresh token từ cookie
4. Nếu hợp lệ → trả về access token mới
5. Frontend lưu access token mới vào state
6. Thử lại request cũ với token mới

### Đăng xuất
1. Frontend gọi API /logout
2. Backend xóa refresh token khỏi database
3. Backend xóa cookie
4. Frontend clear auth state

## Lợi ích bảo mật

### Trước đây (chỉ Access Token trong localStorage)
- ❌ Dễ bị XSS tấn công (JavaScript có thể đọc localStorage)
- ❌ Token hết hạn 2 giờ → user phải đăng nhập lại thường xuyên
- ❌ Không thể revoke token nếu bị đánh cắp

### Hiện tại (Access Token RAM + Refresh Token Http-only Cookie)
- ✅ Access token trong RAM → mất khi đóng tab, không thể XSS
- ✅ Refresh token trong http-only cookie → JavaScript không thể đọc
- ✅ Access token ngắn hạn (15 phút) → giảm thiểu rủi ro nếu bị đánh cắp
- ✅ Refresh token có thể revoke trên server
- ✅ Auto refresh token → user không phải đăng nhập lại thường xuyên

## Trade-off
- User phải đăng nhập lại khi đóng tab (do access token trong RAM mất)
- Đây là trade-off chấp nhận được để tăng bảo mật

## Lưu ý quan trọng
- Access token giờ chỉ tồn tại trong RAM (state) → sẽ mất khi reload trang
- Refresh token vẫn tồn tại trong cookie → có thể lấy access token mới sau khi reload
- Nếu reload trang, user vẫn có thể tiếp tục sử dụng nhờ refresh token
- Chỉ khi đóng tab hoàn toàn mới cần đăng nhập lại

## Testing
1. Đăng nhập vào hệ thống
2. Đợi 15 phút hoặc xóa access token thủ công
3. Thực hiện một action bất kỳ → hệ thống sẽ tự refresh token
4. Đóng tab và mở lại → vẫn có thể sử dụng (nhờ refresh token)
5. Đăng xuất → refresh token bị xóa
