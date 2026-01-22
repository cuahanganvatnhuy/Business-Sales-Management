// Trạng thái đơn hàng
export const ORDER_STATUS = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  PROCESSING: 'processing',
  SHIPPING: 'shipping',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  RETURNED: 'returned'
};

export const ORDER_STATUS_LABELS = {
  [ORDER_STATUS.PENDING]: 'Chờ xác nhận',
  [ORDER_STATUS.CONFIRMED]: 'Đã xác nhận',
  [ORDER_STATUS.PROCESSING]: 'Đang xử lý',
  [ORDER_STATUS.SHIPPING]: 'Đang giao',
  [ORDER_STATUS.COMPLETED]: 'Hoàn thành',
  [ORDER_STATUS.CANCELLED]: 'Đã hủy',
  [ORDER_STATUS.RETURNED]: 'Trả hàng'
};

export const ORDER_STATUS_COLORS = {
  [ORDER_STATUS.PENDING]: 'orange',
  [ORDER_STATUS.CONFIRMED]: 'blue',
  [ORDER_STATUS.PROCESSING]: 'cyan',
  [ORDER_STATUS.SHIPPING]: 'geekblue',
  [ORDER_STATUS.COMPLETED]: 'green',
  [ORDER_STATUS.CANCELLED]: 'red',
  [ORDER_STATUS.RETURNED]: 'volcano'
};

// Loại đơn hàng
export const ORDER_TYPE = {
  ECOMMERCE: 'ecommerce',
  RETAIL: 'retail',
  WHOLESALE: 'wholesale'
};

export const ORDER_TYPE_LABELS = {
  [ORDER_TYPE.ECOMMERCE]: 'TMĐT',
  [ORDER_TYPE.RETAIL]: 'Bán lẻ',
  [ORDER_TYPE.WHOLESALE]: 'Bán sỉ'
};

// Trạng thái sản phẩm
export const PRODUCT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  OUT_OF_STOCK: 'out_of_stock'
};

export const PRODUCT_STATUS_LABELS = {
  [PRODUCT_STATUS.ACTIVE]: 'Đang bán',
  [PRODUCT_STATUS.INACTIVE]: 'Ngừng bán',
  [PRODUCT_STATUS.OUT_OF_STOCK]: 'Hết hàng'
};

export const PRODUCT_STATUS_COLORS = {
  [PRODUCT_STATUS.ACTIVE]: 'green',
  [PRODUCT_STATUS.INACTIVE]: 'default',
  [PRODUCT_STATUS.OUT_OF_STOCK]: 'red'
};

// Vai trò người dùng
export const USER_ROLE = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  STAFF: 'staff'
};

export const USER_ROLE_LABELS = {
  [USER_ROLE.ADMIN]: 'Quản trị viên',
  [USER_ROLE.MANAGER]: 'Quản lý',
  [USER_ROLE.STAFF]: 'Nhân viên'
};

export const USER_ROLE_COLORS = {
  [USER_ROLE.ADMIN]: 'red',
  [USER_ROLE.MANAGER]: 'blue',
  [USER_ROLE.STAFF]: 'default'
};

// Trạng thái thanh toán
export const PAYMENT_STATUS = {
  UNPAID: 'unpaid',
  PARTIAL: 'partial',
  PAID: 'paid',
  REFUNDED: 'refunded'
};

export const PAYMENT_STATUS_LABELS = {
  [PAYMENT_STATUS.UNPAID]: 'Chưa thanh toán',
  [PAYMENT_STATUS.PARTIAL]: 'Thanh toán một phần',
  [PAYMENT_STATUS.PAID]: 'Đã thanh toán',
  [PAYMENT_STATUS.REFUNDED]: 'Đã hoàn tiền'
};

export const PAYMENT_STATUS_COLORS = {
  [PAYMENT_STATUS.UNPAID]: 'red',
  [PAYMENT_STATUS.PARTIAL]: 'orange',
  [PAYMENT_STATUS.PAID]: 'green',
  [PAYMENT_STATUS.REFUNDED]: 'purple'
};

// Phương thức thanh toán
export const PAYMENT_METHOD = {
  CASH: 'cash',
  BANK_TRANSFER: 'bank_transfer',
  CREDIT_CARD: 'credit_card',
  E_WALLET: 'e_wallet',
  COD: 'cod'
};

export const PAYMENT_METHOD_LABELS = {
  [PAYMENT_METHOD.CASH]: 'Tiền mặt',
  [PAYMENT_METHOD.BANK_TRANSFER]: 'Chuyển khoản',
  [PAYMENT_METHOD.CREDIT_CARD]: 'Thẻ tín dụng',
  [PAYMENT_METHOD.E_WALLET]: 'Ví điện tử',
  [PAYMENT_METHOD.COD]: 'COD'
};

// Pagination
export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = ['10', '20', '50', '100'];

// Stock threshold
export const LOW_STOCK_THRESHOLD = 10;
export const OUT_OF_STOCK_THRESHOLD = 0;
