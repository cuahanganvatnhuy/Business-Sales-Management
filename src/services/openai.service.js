import axios from 'axios';

// Lấy API key từ environment variable
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

// Debug: Log để kiểm tra (chỉ log khi dev mode)
if (import.meta.env.DEV) {
  console.log('🔍 OpenAI API Key check:', {
    hasKey: !!OPENAI_API_KEY,
    keyLength: OPENAI_API_KEY?.length || 0,
    keyPrefix: OPENAI_API_KEY?.substring(0, 7) || 'none'
  });
}

// Base URL cho OpenAI API
const OPENAI_API_URL = 'https://api.openai.com/v1/chat/completions';

/**
 * Gọi ChatGPT API để lấy phản hồi
 * @param {string} message - Tin nhắn của user
 * @param {Array} conversationHistory - Lịch sử cuộc trò chuyện
 * @returns {Promise<string>} - Phản hồi từ AI
 */
export const getChatGPTResponse = async (message, conversationHistory = []) => {
  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key chưa được cấu hình. Vui lòng thêm VITE_OPENAI_API_KEY vào file .env');
  }

  try {
    // Tạo messages array với system prompt và lịch sử hội thoại
    const messages = [
      {
        role: 'system',
        content: 'Bạn là AI hỗ trợ của Hệ thống Quản lý Kinh doanh. Nhiệm vụ của bạn là hướng dẫn người dùng sử dụng phần mềm một cách thân thiện và chi tiết. Hệ thống có các chức năng chính: Dashboard, Quản lý đơn hàng, Quản lý sản phẩm, Quản lý kho, Quản lý tài chính, Báo cáo, Phân quyền, Quản lý nhân sự, Quản lý cửa hàng, Quản lý hóa đơn. Hãy trả lời bằng tiếng Việt một cách tự nhiên và dễ hiểu.'
      },
      ...conversationHistory,
      {
        role: 'user',
        content: message
      }
    ];

    const response = await axios.post(
      OPENAI_API_URL,
      {
        model: 'gpt-3.5-turbo',
        messages: messages,
        temperature: 0.7,
        max_tokens: 500
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`
        },
        timeout: 30000 // 30 seconds timeout
      }
    );

    return response.data.choices[0].message.content.trim();
  } catch (error) {
    console.error('OpenAI API Error:', error);
    
    if (error.response) {
      // API trả về lỗi
      if (error.response.status === 401) {
        throw new Error('API key không hợp lệ. Vui lòng kiểm tra lại VITE_OPENAI_API_KEY trong file .env');
      } else if (error.response.status === 429) {
        throw new Error('Đã vượt quá giới hạn API. Vui lòng thử lại sau.');
      } else if (error.response.status === 500) {
        throw new Error('Lỗi server của OpenAI. Vui lòng thử lại sau.');
      } else {
        throw new Error(`Lỗi API: ${error.response.data?.error?.message || error.message}`);
      }
    } else if (error.request) {
      // Không nhận được phản hồi
      throw new Error('Không thể kết nối đến OpenAI API. Vui lòng kiểm tra kết nối internet.');
    } else {
      // Lỗi khác
      throw new Error(`Lỗi: ${error.message}`);
    }
  }
};

/**
 * Kiểm tra xem API key đã được cấu hình chưa
 * @returns {boolean}
 */
export const isOpenAIConfigured = () => {
  // Kiểm tra lại từ biến môi trường mỗi lần gọi
  const apiKey = import.meta.env.VITE_OPENAI_API_KEY || '';
  const isConfigured = !!apiKey && apiKey.trim() !== '' && apiKey.length > 10;
  
  // Debug log
  if (import.meta.env.DEV) {
    console.log('🔍 isOpenAIConfigured check:', {
      hasKey: !!apiKey,
      keyLength: apiKey?.length || 0,
      trimmed: apiKey?.trim() !== '',
      isConfigured: isConfigured
    });
  }
  
  return isConfigured;
};

