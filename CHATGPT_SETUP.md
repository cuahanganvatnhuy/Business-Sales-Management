# Hướng dẫn cấu hình ChatGPT API

## Bước 1: Lấy OpenAI API Key

1. Truy cập: https://platform.openai.com/api-keys
2. Đăng nhập hoặc tạo tài khoản OpenAI
3. Click "Create new secret key"
4. Copy API key (bắt đầu với `sk-`)

## Bước 2: Tạo file .env

Tạo file `.env` ở thư mục root của project với nội dung:

```env
VITE_OPENAI_API_KEY=sk-your-openai-api-key-here
```

Thay `sk-your-openai-api-key-here` bằng API key bạn đã copy.

**Ví dụ:**
```env
VITE_OPENAI_API_KEY=sk-proj-abc123xyz789...
```

## Bước 3: Khởi động lại server

Sau khi thêm API key, khởi động lại dev server:

```bash
npm run dev
```

## Kiểm tra

- Nếu đã cấu hình đúng, chatbot sẽ sử dụng ChatGPT API
- Nếu chưa cấu hình hoặc API key không hợp lệ, chatbot sẽ tự động fallback về chế độ keyword responses
- Kiểm tra console để xem trạng thái: `✅ ChatGPT API đã được cấu hình` hoặc `⚠️ ChatGPT API chưa được cấu hình`

## Lưu ý

- **Bảo mật**: File `.env` đã được thêm vào `.gitignore`, không commit lên git
- **Chi phí**: Sử dụng ChatGPT API sẽ có chi phí (theo usage của OpenAI)
- **Fallback**: Nếu API lỗi, hệ thống sẽ tự động chuyển sang chế độ keyword responses

## Model được sử dụng

- **Model**: `gpt-3.5-turbo` (nhanh và tiết kiệm chi phí)
- **Temperature**: 0.7 (cân bằng giữa sáng tạo và chính xác)
- **Max tokens**: 500 (giới hạn độ dài phản hồi)

Bạn có thể thay đổi model trong file `src/services/openai.service.js` nếu muốn sử dụng model khác (ví dụ: `gpt-4`).

