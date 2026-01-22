import React, { useState, useEffect, useRef } from 'react';
import { Button, Card, Input, Space, Typography, message } from 'antd';
import { MessageOutlined, CloseOutlined, SendOutlined, RobotOutlined } from '@ant-design/icons';
import { getChatGPTResponse, isOpenAIConfigured } from '../../services/openai.service';
import './ChatBot.css';

const { Text } = Typography;

// Câu trả lời định sẵn về hướng dẫn sử dụng phần mềm
const HELP_RESPONSES = {
  'chào': 'Xin chào! 👋 Tôi là AI hỗ trợ của Hệ thống Quản lý Kinh doanh. Tôi có thể giúp bạn hướng dẫn sử dụng phần mềm. Bạn cần hỗ trợ gì?',
  'hello': 'Xin chào! 👋 Tôi là AI hỗ trợ của Hệ thống Quản lý Kinh doanh. Tôi có thể giúp bạn hướng dẫn sử dụng phần mềm. Bạn cần hỗ trợ gì?',
  'hi': 'Xin chào! 👋 Tôi là AI hỗ trợ của Hệ thống Quản lý Kinh doanh. Tôi có thể giúp bạn hướng dẫn sử dụng phần mềm. Bạn cần hỗ trợ gì?',
  'dashboard': 'Dashboard là trang tổng quan hiển thị thống kê tổng hợp về đơn hàng, sản phẩm, doanh thu và các chỉ số quan trọng khác. Bạn có thể xem nhanh tình hình kinh doanh tại đây.',
  'đơn hàng': 'Bạn có thể tạo đơn hàng tại menu "Tạo Đơn Hàng" với 3 loại: TMĐT, Bán Lẻ, Bán Sỉ. Quản lý đơn hàng tại menu "Quản Lý Đơn Hàng Bán".',
  'sản phẩm': 'Quản lý sản phẩm tại menu "Sản Phẩm": Thêm sản phẩm, Quản lý sản phẩm, Danh mục sản phẩm. Bạn có thể thêm, sửa, xóa sản phẩm và phân loại theo danh mục.',
  'kho hàng': 'Quản lý kho tại menu "Quản Lý Kho": Kho Hàng (xem tồn kho), Quản Lý Giao Dịch (nhập/xuất kho), Báo Cáo Sử Dụng và Báo Cáo Đơn Hàng.',
  'tài chính': 'Quản lý tài chính tại menu "Quản Lý Tài Chính": Giao Dịch Tài Chính, Tổng Quan Lợi Nhuận, và các báo cáo lợi nhuận theo từng loại đơn hàng.',
  'báo cáo': 'Báo cáo tổng hợp tại menu "Báo Cáo". Bạn có thể xem các báo cáo thống kê về đơn hàng, doanh thu, sản phẩm...',
  'quyền': 'Quản lý phân quyền tại menu "Cài Đặt" > "Cài Đặt Phân Quyền". Admin có thể tạo role, gán quyền cho từng role, và phân quyền cho nhân viên.',
  'nhân sự': 'Quản lý nhân sự tại menu "Quản Lý Nhân Sự": Tài khoản nhân sự (thêm/sửa/xóa tài khoản), Cài đặt phân quyền (quản lý roles và permissions).',
  'cửa hàng': 'Quản lý cửa hàng tại menu "Quản Lý Cửa Hàng". Bạn có thể thêm, sửa, xóa cửa hàng và chọn cửa hàng để xem dữ liệu theo cửa hàng.',
  'hóa đơn': 'Quản lý hóa đơn tại menu "Quản Lý Hóa Đơn": Hóa Đơn Toàn Bộ, Hóa Đơn Từng Cửa Hàng TMĐT, Hóa Đơn Thanh Toán.',
  'hướng dẫn': 'Tôi có thể hướng dẫn bạn về: Dashboard, Đơn hàng, Sản phẩm, Kho hàng, Tài chính, Báo cáo, Phân quyền, Nhân sự, Cửa hàng, Hóa đơn. Bạn muốn biết về phần nào?',
  'help': 'Tôi có thể hướng dẫn bạn về: Dashboard, Đơn hàng, Sản phẩm, Kho hàng, Tài chính, Báo cáo, Phân quyền, Nhân sự, Cửa hàng, Hóa đơn. Bạn muốn biết về phần nào?',
  'giúp': 'Tôi có thể hướng dẫn bạn về: Dashboard, Đơn hàng, Sản phẩm, Kho hàng, Tài chính, Báo cáo, Phân quyền, Nhân sự, Cửa hàng, Hóa đơn. Bạn muốn biết về phần nào?'
};

const DEFAULT_RESPONSES = [
  'Cảm ơn bạn đã hỏi! Tôi có thể giúp bạn về các chức năng: Dashboard, Đơn hàng, Sản phẩm, Kho hàng, Tài chính, Báo cáo, Phân quyền, Nhân sự, Cửa hàng, Hóa đơn. Bạn muốn biết về phần nào?',
  'Xin lỗi, tôi chưa hiểu rõ câu hỏi của bạn. Bạn có thể hỏi về các chức năng: Dashboard, Đơn hàng, Sản phẩm, Kho hàng, Tài chính, Báo cáo, Phân quyền, Nhân sự, Cửa hàng, Hóa đơn.',
  'Tôi là AI hỗ trợ của Hệ thống Quản lý Kinh doanh. Tôi có thể hướng dẫn bạn sử dụng các chức năng của phần mềm. Vui lòng hỏi về: Dashboard, Đơn hàng, Sản phẩm, Kho hàng, Tài chính, Báo cáo, Phân quyền, Nhân sự, Cửa hàng, Hóa đơn.'
];

const ChatBot = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      text: 'Xin chào! 👋 Tôi là AI hỗ trợ của Hệ thống Quản lý Kinh doanh. Tôi có thể giúp bạn hướng dẫn sử dụng phần mềm. Bạn cần hỗ trợ gì?',
      sender: 'bot',
      timestamp: Date.now()
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [useChatGPT, setUseChatGPT] = useState(false);
  const messagesEndRef = useRef(null);

  // Kiểm tra xem ChatGPT đã được cấu hình chưa khi component mount
  useEffect(() => {
    setUseChatGPT(isOpenAIConfigured());
    if (isOpenAIConfigured()) {
      console.log('✅ ChatGPT API đã được cấu hình');
    } else {
      console.warn('⚠️ ChatGPT API chưa được cấu hình. Sử dụng chế độ keyword responses.');
    }
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getBotResponse = (userMessage) => {
    const lowerMessage = userMessage.toLowerCase().trim();
    
    // Tìm câu trả lời phù hợp
    for (const [keyword, response] of Object.entries(HELP_RESPONSES)) {
      if (lowerMessage.includes(keyword)) {
        return response;
      }
    }
    
    // Nếu không tìm thấy, trả về câu trả lời mặc định
    return DEFAULT_RESPONSES[Math.floor(Math.random() * DEFAULT_RESPONSES.length)];
  };

  const handleSendMessage = async () => {
    if (!inputValue.trim()) return;

    const userMessage = {
      id: Date.now(),
      text: inputValue.trim(),
      sender: 'user',
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    const currentMessage = inputValue.trim();
    setInputValue('');
    setLoading(true);

    try {
      let botResponseText;

      // Sử dụng ChatGPT nếu đã được cấu hình
      if (useChatGPT) {
        try {
          // Tạo conversation history từ messages hiện tại (chỉ lấy 10 tin nhắn gần nhất để tiết kiệm token)
          const recentMessages = messages.slice(-10);
          const conversationHistory = recentMessages
            .filter(msg => msg.id !== 1) // Bỏ tin nhắn chào đầu tiên
            .map(msg => ({
              role: msg.sender === 'user' ? 'user' : 'assistant',
              content: msg.text
            }));

          botResponseText = await getChatGPTResponse(currentMessage, conversationHistory);
        } catch (error) {
          console.error('ChatGPT API Error:', error);
          // Fallback về keyword responses nếu API lỗi
          botResponseText = getBotResponse(currentMessage);
          
          // Hiển thị thông báo lỗi nhẹ (không làm gián đoạn trải nghiệm)
          if (error.message.includes('API key')) {
            console.warn('⚠️ ' + error.message);
          } else {
            message.warning('Đang sử dụng chế độ phản hồi cơ bản do lỗi kết nối ChatGPT.');
          }
        }
      } else {
        // Sử dụng keyword responses
        botResponseText = getBotResponse(currentMessage);
      }

      const botResponse = {
        id: Date.now() + 1,
        text: botResponseText,
        sender: 'bot',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, botResponse]);
    } catch (error) {
      console.error('Error handling message:', error);
      message.error('Có lỗi xảy ra. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="chatbot-container">
      {open ? (
        <Card
          className="chatbot-window"
          title={
            <Space>
              <RobotOutlined style={{ color: '#0f9d58' }} />
              <span>Hỗ trợ sử dụng phần mềm</span>
            </Space>
          }
          extra={
            <Button
              type="text"
              icon={<CloseOutlined />}
              onClick={() => setOpen(false)}
              size="small"
            />
          }
          style={{
            width: 380,
            height: 600,
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 1000,
            display: 'flex',
            flexDirection: 'column',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)'
          }}
          bodyStyle={{
            display: 'flex',
            flexDirection: 'column',
            padding: 0,
            height: '100%',
            overflow: 'hidden'
          }}
        >
          <div className="chatbot-messages" style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px'
          }}>
            {messages.map(message => (
              <div
                key={message.id}
                className={`chatbot-message ${message.sender === 'user' ? 'user-message' : 'bot-message'}`}
                style={{
                  alignSelf: message.sender === 'user' ? 'flex-end' : 'flex-start',
                  maxWidth: '80%'
                }}
              >
                {message.sender === 'bot' && (
                  <div className="bot-avatar">
                    <RobotOutlined />
                  </div>
                )}
                <div className="message-bubble" style={{
                  background: message.sender === 'user' ? '#0f9d58' : '#f0f0f0',
                  color: message.sender === 'user' ? 'white' : '#333',
                  padding: '8px 12px',
                  borderRadius: '12px',
                  wordWrap: 'break-word'
                }}>
                  {message.text}
                </div>
              </div>
            ))}
            {loading && (
              <div className="chatbot-message bot-message" style={{ alignSelf: 'flex-start' }}>
                <div className="bot-avatar">
                  <RobotOutlined />
                </div>
                <div className="message-bubble" style={{
                  background: '#f0f0f0',
                  padding: '8px 12px',
                  borderRadius: '12px'
                }}>
                  <span className="typing-indicator">
                    <span></span>
                    <span></span>
                    <span></span>
                  </span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatbot-input" style={{
            borderTop: '1px solid #f0f0f0',
            padding: '12px',
            display: 'flex',
            gap: '8px'
          }}>
            <Input
              placeholder="Nhập câu hỏi của bạn..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyPress={handleKeyPress}
              disabled={loading}
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSendMessage}
              disabled={!inputValue.trim() || loading}
              style={{ background: '#0f9d58', borderColor: '#0f9d58' }}
            />
          </div>
        </Card>
      ) : (
        <Button
          type="primary"
          shape="circle"
          icon={<MessageOutlined />}
          size="large"
          onClick={() => setOpen(true)}
          className="chatbot-toggle"
          style={{
            position: 'fixed',
            bottom: 20,
            right: 20,
            zIndex: 1000,
            width: 60,
            height: 60,
            background: '#0f9d58',
            borderColor: '#0f9d58',
            boxShadow: '0 4px 12px rgba(15, 157, 88, 0.4)'
          }}
        />
      )}
    </div>
  );
};

export default ChatBot;

