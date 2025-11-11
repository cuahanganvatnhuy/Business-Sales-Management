// Format tiền tệ VND
export const formatCurrency = (amount) => {
  if (!amount && amount !== 0) return '0 ₫';
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount);
};

// Format số
export const formatNumber = (num) => {
  if (!num && num !== 0) return '0';
  return new Intl.NumberFormat('vi-VN').format(num);
};

// Format ngày giờ
export const formatDate = (date, options = {}) => {
  if (!date) return '';
  
  const defaultOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    ...options
  };
  
  return new Date(date).toLocaleDateString('vi-VN', defaultOptions);
};

// Format ngày giờ đầy đủ
export const formatDateTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
};

// Parse số từ string (loại bỏ dấu phân cách)
export const parseNumber = (str) => {
  if (!str) return 0;
  return parseFloat(str.toString().replace(/[^\d.-]/g, ''));
};

// Truncate text
export const truncateText = (text, maxLength = 50) => {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// Format phone number
export const formatPhone = (phone) => {
  if (!phone) return '';
  // Format: 0123 456 789
  return phone.replace(/(\d{4})(\d{3})(\d{3})/, '$1 $2 $3');
};
