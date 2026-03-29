# Báo cáo sự cố Socket.IO (2026-03-22)

## Tóm tắt nhanh
Toast thời gian thực không hiện vì bắt tay WebSocket thất bại ở reverse proxy, không phải do logic phát (broadcast).

## Triệu chứng
- Console trình duyệt:
  - `WebSocket connection to wss://api.money.dovancuongadhp.top/socket.io/?EIO=4&transport=websocket failed`
  - `[Socket.IO] Connection error: websocket error`
- API vẫn nhận `POST /api/admin/broadcast` và trả 200.
- Người dùng không nhận toast thời gian thực.

## Nguyên nhân gốc
1. Nginx Proxy Manager chưa áp dụng header nâng cấp WebSocket đúng phạm vi `location /` của host API.
2. Header WebSocket đặt ở cấp `server` bị vô hiệu một phần vì `location /` đã có `proxy_set_header` riêng (nguyên tắc kế thừa của Nginx).
3. Có thêm sai lệch về origin khi thử qua localhost:
   - API chỉ cho phép origin production, trong khi thử bằng `http://localhost:3000`.

## Bằng chứng từ log
- Access log host API xuất hiện nhiều request:
  - `/socket.io/?EIO=4&transport=websocket` trả `400`.
- Console trình duyệt báo `websocket error`.
- Endpoint broadcast API vẫn thành công (`200`).

## Khắc phục đã áp dụng
### 1) CORS phía backend cho nhiều origin
- Đã sửa [apps/api/src/index.ts](apps/api/src/index.ts)
- Đã sửa [apps/api/src/realtime/socket.ts](apps/api/src/realtime/socket.ts)

Thay đổi:
- Hỗ trợ `WEB_URL` dạng danh sách phân tách bằng dấu phẩy.
- Ví dụ:
  - `WEB_URL="https://money.dovancuongadhp.top,http://localhost:3000"`

Đã cập nhật biến môi trường:
- [apps/api/.env.production](apps/api/.env.production)

### 2) Header WebSocket của Nginx đặt đúng vị trí
Đã thêm trực tiếp trong `location /` của proxy host API:
- `proxy_http_version 1.1;`
- `proxy_set_header Upgrade $http_upgrade;`
- `proxy_set_header Connection "upgrade";`
- `proxy_read_timeout 86400;`

Lưu ý:
- Đây là cấu hình tại runtime Nginx Proxy Manager (`/data/nginx/proxy_host/14.conf`).
- Nếu sửa proxy host bằng giao diện, cần kiểm tra lại vì có thể bị ghi đè.

### 3) Phương án dự phòng phía frontend để giảm ảnh hưởng
Đã đổi thứ tự ưu tiên transport:
- [apps/web/src/components/notifications/SystemBroadcastListener.tsx](apps/web/src/components/notifications/SystemBroadcastListener.tsx)
- Từ `['websocket', 'polling']` → `['polling', 'websocket']`

Mục đích:
- Vẫn nhận được thời gian thực qua polling nếu WebSocket gặp sự cố.

## Cách xác minh sau khi sửa
1. Hard refresh trình duyệt (Cmd+Shift+R).
2. Đăng nhập lại tài khoản nhận thông báo.
3. Gửi một broadcast thử từ trang quản trị.
4. Kiểm tra:
   - Console có dòng `[Socket.IO] Connected`.
   - Toast hiện trên máy khách nhận.
5. Kiểm tra access log proxy:
   - Request `/socket.io/...transport=websocket` nên là `101` (hoặc polling hoạt động ổn định, không lặp lỗi).

## Runbook nhanh nếu tái diễn
1. Kiểm tra biến môi trường web:
   - `NEXT_PUBLIC_API_URL` phải là URL công khai của API.
2. Kiểm tra biến môi trường API:
   - `WEB_URL` phải gồm đủ các origin cần dùng.
3. Kiểm tra host API trên NPM có header WebSocket trong `location /`.
4. Build lại / khởi động lại:
   - `docker compose -f docker-compose.prod.yml up -d --build api web`
5. Theo dõi log:
   - Log API + access/error log của NPM.

## Bài học rút ra
- Socket.IO production cần kiểm tra đồng thời:
  - Origin CORS
  - Nâng cấp WebSocket qua proxy
  - Bắt tay xác thực (auth handshake)
- Đặt header WebSocket sai phạm vi trong Nginx có thể gây lỗi âm thầm: API REST vẫn 200 nhưng realtime không hoạt động.
