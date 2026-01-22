# Hướng dẫn khởi động lại server

## Cách 1: Dừng và khởi động lại trong terminal

1. Tìm terminal đang chạy `yarn dev` hoặc `npm run dev`
2. Nhấn `Ctrl + C` để dừng server
3. Chạy lại: `yarn dev`

## Cách 2: Dừng process trực tiếp (nếu không tìm thấy terminal)

Mở PowerShell và chạy:
```powershell
# Tìm process đang chạy trên port 5173
netstat -ano | findstr :5173

# Dừng process (thay PID bằng số từ lệnh trên)
taskkill /PID 7448 /F

# Khởi động lại server
yarn dev
```

## Sau khi khởi động lại

1. Đợi server khởi động xong (thấy message "Local: http://localhost:5173")
2. Refresh trang web (F5)
3. Mở Console (F12) và kiểm tra:
   - ✅ Nếu thấy `hasKey: true` → Thành công!
   - ❌ Nếu vẫn thấy `hasKey: false` → Kiểm tra lại file .env

