import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../../services/firebase.service';
import { useStore } from '../../contexts/StoreContext';
import { ref, onValue, push, set, get } from 'firebase/database';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  Select,
  DatePicker,
  TimePicker,
  message,
  Modal,
  Table,
  Spin,
  Space,
  Divider,
  Statistic,
  Row,
  Col,
  Radio
} from 'antd';
import {
  ShoppingOutlined,
  UserOutlined,
  PhoneOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  ReloadOutlined,
  ShopOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  PrinterOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { formatCurrency } from '../../utils/format';
import { printRetailInvoice } from '../../utils/printInvoice';
import { validateStock, deductStock, checkStockAvailability } from '../../utils/inventoryHelpers';
import dayjs from 'dayjs';
import { useAuth } from '../../contexts/AuthContext';
import './Orders.css';

const { Option } = Select;

// Platforms list
const platforms = [
  { value: 'shopee', label: '🛒 Shopee' },
  { value: 'lazada', label: '🛍️ Lazada' },
  { value: 'tiktok', label: '🎵 TikTok Shop' },
  { value: 'sendo', label: '📦 Sendo' },
  { value: 'tiki', label: '🎁 Tiki' },
  { value: 'facebook', label: '👥 Facebook' },
  { value: 'zalo', label: '💬 Zalo' },
  { value: 'other', label: '🔧 Khác' }
];

const CreateOrderRetail = () => {
  const navigate = useNavigate();
  const { selectedStore } = useStore();
  const { user, isAdmin } = useAuth();
  const hasPermission = isAdmin || (user?.permissions || []).includes('orders.create.retail');
  const [mainForm] = Form.useForm();
  const [products, setProducts] = useState([]); // Products with stock info
  const [loading, setLoading] = useState(false);

  // State
  const [sellingProducts, setSellingProducts] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [selectedTime, setSelectedTime] = useState(dayjs());
  const [salesChannel, setSalesChannel] = useState('offline');
  const [selectedPlatform, setSelectedPlatform] = useState(null);

  // Product forms
  const [productCount, setProductCount] = useState('');
  const [productForms, setProductForms] = useState([]);
  const [showForms, setShowForms] = useState(false);

  // Order totals
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);

  // Success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdProductCount, setCreatedProductCount] = useState(0);
  const [lastCreatedOrder, setLastCreatedOrder] = useState(null);

  // Load selling products
  useEffect(() => {
    const productsRef = ref(database, 'sellingProducts');
    
    const unsubscribe = onValue(productsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const productsArray = Object.keys(data)
          .filter(key => data[key].status === 'active')
          .map(key => ({
            id: key,
            ...data[key]
          }));
        setSellingProducts(productsArray);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load products for stock validation
  useEffect(() => {
    const productsRef = ref(database, 'products');
    const unsubscribe = onValue(productsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const productsList = Object.entries(data).map(([id, product]) => ({
          id,
          ...product
        }));
        setProducts(productsList);
      } else {
        setProducts([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Generate product forms
  const handleGenerateForms = () => {
    const count = parseInt(productCount);
    if (!count || count < 1 || count > 50) {
      Modal.warning({
        title: 'Số lượng không hợp lệ',
        content: 'Vui lòng nhập số lượng sản phẩm từ 1 đến 50!',
        okText: 'Đã hiểu',
        centered: true
      });
      return;
    }

    const forms = [];
    for (let i = 1; i <= count; i++) {
      forms.push({
        id: i,
        productId: null,
        productName: '',
        sku: '',
        quantity: 1,
        sellingPrice: 0,
        importPrice: 0,
        total: 0,
        profit: 0
      });
    }

    setProductForms(forms);
    setShowForms(true);
    message.success(`Đã tạo ${count} form sản phẩm!`);
  };

  // Update product selection
  const handleProductChange = (formId, productId) => {
    const product = sellingProducts.find(p => p.id === productId);
    if (!product) return;

    // Kiểm tra stock ngay khi chọn sản phẩm
    const form = productForms.find(f => f.id === formId);
    const quantity = form?.quantity || 1;
    const stockCheck = checkStockAvailability(productId, quantity, products, sellingProducts);
    
    // Cảnh báo nếu stock = 0 hoặc không đủ
    if (stockCheck.stock === 0) {
      message.error(`🚨 CẢNH BÁO: Sản phẩm "${product.productName}" (SKU: ${product.sku || 'N/A'}) ĐÃ HẾT HÀNG! Tồn kho: 0. Không thể tạo đơn hàng với sản phẩm này!`, 5);
    } else if (!stockCheck.available) {
      message.warning(`⚠️ Sản phẩm "${product.productName}" không đủ hàng! ${stockCheck.message}`, 4);
    }

    setProductForms(prevForms =>
      prevForms.map(form => {
        if (form.id === formId) {
          const total = product.sellingPrice * form.quantity;
          const profit = (product.sellingPrice - product.importPrice) * form.quantity;
          
          return {
            ...form,
            productId: product.id,
            productName: product.productName,
            sku: product.sku,
            unit: product.unit || 'kg',
            sellingPrice: product.sellingPrice,
            importPrice: product.importPrice,
            total: total,
            profit: profit
          };
        }
        return form;
      })
    );
  };

  // Update quantity
  const handleQuantityChange = (formId, quantity) => {
    // Kiểm tra stock khi thay đổi số lượng
    const form = productForms.find(f => f.id === formId);
    if (form && form.productId) {
      const stockCheck = checkStockAvailability(form.productId, quantity, products, sellingProducts);
      
      if (stockCheck.stock === 0) {
        message.error(`🚨 Sản phẩm "${form.productName}" (SKU: ${form.sku || 'N/A'}) ĐÃ HẾT HÀNG! Tồn kho: 0. Không thể tạo đơn hàng!`, 5);
      } else if (!stockCheck.available) {
        message.warning(`⚠️ ${stockCheck.message}`, 4);
      }
    }
    
    setProductForms(prevForms =>
      prevForms.map(form => {
        if (form.id === formId) {
          const total = form.sellingPrice * quantity;
          const profit = (form.sellingPrice - form.importPrice) * quantity;
          
          return {
            ...form,
            quantity: quantity,
            total: total,
            profit: profit
          };
        }
        return form;
      })
    );
  };

  // Delete product form
  const handleDeleteForm = (formId) => {
    setProductForms(prevForms => prevForms.filter(form => form.id !== formId));
    message.success('Đã xóa sản phẩm!');
  };

  // Generate Order ID
  const generateOrderId = async (orderType) => {
    const today = dayjs();
    const dateStr = today.format('DDMMYY'); // 091125
    const prefix = orderType === 'retail' ? 'RETAIL' : 'WHOLESALE';
    
    try {
      // Get all orders from salesOrders
      const ordersRef = ref(database, 'salesOrders');
      const snapshot = await get(ordersRef);
      const ordersData = snapshot.val();
      
      // Count orders with same prefix and date
      let maxSequence = 0;
      if (ordersData) {
        const searchPrefix = `${prefix}-${dateStr}-`;
        Object.values(ordersData).forEach(order => {
          if (order.orderId && order.orderId.startsWith(searchPrefix)) {
            // Extract sequence number from orderId
            const sequenceStr = order.orderId.substring(searchPrefix.length);
            const sequence = parseInt(sequenceStr, 10);
            if (!isNaN(sequence) && sequence > maxSequence) {
              maxSequence = sequence;
            }
          }
        });
      }
      
      // Next sequence number
      const nextSequence = maxSequence + 1;
      
      // Pad to 15 digits
      const sequenceStr = nextSequence.toString().padStart(15, '0');
      
      return `${prefix}-${dateStr}-${sequenceStr}`;
    } catch (error) {
      console.error('Error generating order ID:', error);
      // Fallback to timestamp-based ID
      return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  };

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = productForms.reduce((sum, form) => sum + form.total, 0);
    const totalProfit = productForms.reduce((sum, form) => sum + form.profit, 0);
    const finalAmount = subtotal - discount + shipping;

    return { subtotal, totalProfit, finalAmount };
  };

  // Create order
  const handleCreateOrder = async () => {
    // Validation
    if (!customerName || !customerName.trim()) {
      Modal.warning({
        title: 'Chưa nhập tên khách hàng',
        content: 'Vui lòng nhập tên khách hàng!',
        okText: 'Đã hiểu',
        centered: true
      });
      return;
    }

    if (productForms.length === 0) {
      Modal.warning({
        title: 'Chưa có sản phẩm',
        content: 'Vui lòng thêm ít nhất một sản phẩm!',
        okText: 'Đã hiểu',
        centered: true
      });
      return;
    }

    const invalidForms = productForms.filter(form => !form.productId || form.quantity <= 0);
    if (invalidForms.length > 0) {
      Modal.warning({
        title: 'Thông tin chưa đầy đủ',
        content: 'Vui lòng chọn sản phẩm và nhập số lượng cho tất cả các dòng!',
        okText: 'Đã hiểu',
        centered: true
      });
      return;
    }

    if (salesChannel === 'tmdt' && !selectedPlatform) {
      Modal.warning({
        title: 'Chưa chọn sàn TMĐT',
        content: 'Vui lòng chọn sàn thương mại điện tử!',
        okText: 'Đã hiểu',
        centered: true
      });
      return;
    }

    // Validate store selection
    if (!selectedStore || selectedStore.id === 'all') {
      Modal.warning({
        title: 'Chưa chọn cửa hàng',
        content: 'Vui lòng chọn một cửa hàng cụ thể để tạo đơn hàng! Không thể tạo đơn cho "Toàn Bộ Cửa Hàng".',
        okText: 'Đã hiểu',
        centered: true
      });
      return;
    }

    // Validate stock for all items
    const allItems = productForms.map(form => ({
      productId: form.productId,
      productName: form.productName,
      quantity: form.quantity,
      sku: form.sku
    }));
    
    console.log('🔍 [Retail] Validating stock...', { 
      allItemsCount: allItems.length, 
      productsCount: products.length 
    });
    
    // Check if products are loaded
    if (products.length === 0) {
      Modal.warning({
        title: 'Đang tải dữ liệu kho',
        content: 'Vui lòng đợi dữ liệu kho hàng tải xong rồi thử lại!',
        okText: 'Đã hiểu',
        centered: true
      });
      return;
    }
    
    const stockValidation = validateStock(allItems, products, sellingProducts);
    
    console.log('📊 [Retail] Validation result:', stockValidation);
    console.log('📊 [Retail] Errors:', stockValidation.errors);
    
    if (!stockValidation.valid) {
      // Kiểm tra xem có sản phẩm hết hàng không
      const hasOutOfStock = stockValidation.errors.some(err => err.includes('HẾT HÀNG') || err.includes('ĐÃ HẾT HÀNG'));
      
      // Thông báo ngay bằng message.error
      const errorMessage = hasOutOfStock 
        ? '🚨 KHÔNG THỂ TẠO ĐƠN HÀNG! Có sản phẩm ĐÃ HẾT HÀNG trong kho!'
        : '⚠️ Không thể tạo đơn hàng! Có sản phẩm không đủ hàng trong kho!';
      
      message.error(errorMessage, 5);
      
      // Hiển thị Modal.error ngay lập tức
      const modalTitle = hasOutOfStock 
        ? '🚨 KHÔNG THỂ TẠO ĐƠN HÀNG - KHO HẾT HÀNG!'
        : '⚠️ KHÔNG THỂ TẠO ĐƠN HÀNG - KHO KHÔNG ĐỦ HÀNG!';
      
      Modal.error({
        title: modalTitle,
        content: (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <div style={{ 
              marginBottom: 16, 
              padding: 12, 
              background: hasOutOfStock ? '#fff2f0' : '#fffbe6',
              border: hasOutOfStock ? '1px solid #ffccc7' : '1px solid #ffe58f',
              borderRadius: 6
            }}>
              <strong style={{ color: hasOutOfStock ? '#ff4d4f' : '#faad14', fontSize: 16 }}>
                {hasOutOfStock ? '🚨' : '⚠️'} Có {stockValidation.errors.length} sản phẩm gặp vấn đề về tồn kho:
              </strong>
            </div>
            {stockValidation.errors.map((error, index) => {
              const isOutOfStock = error.includes('HẾT HÀNG') || error.includes('ĐÃ HẾT HÀNG');
              return (
                <div 
                  key={index} 
                  style={{ 
                    marginBottom: 12, 
                    padding: 12,
                    background: isOutOfStock ? '#fff1f0' : '#fff',
                    border: isOutOfStock ? '2px solid #ff4d4f' : '1px solid #ffccc7',
                    borderRadius: 6,
                    color: isOutOfStock ? '#ff4d4f' : '#fa8c16',
                    fontSize: 14,
                    lineHeight: 1.6,
                    fontWeight: isOutOfStock ? 'bold' : 'normal'
                  }}
                >
                  <strong>• {error}</strong>
                </div>
              );
            })}
            <div style={{ 
              marginTop: 16, 
              padding: 12, 
              background: '#f6ffed', 
              border: '1px solid #b7eb8f',
              borderRadius: 6,
              fontSize: 13,
              color: '#52c41a'
            }}>
              💡 <strong>Giải pháp:</strong> Vui lòng kiểm tra tồn kho và nhập thêm hàng trước khi tạo đơn hàng!
            </div>
          </div>
        ),
        okText: 'Đã hiểu',
        centered: true,
        width: 750,
        okButtonProps: {
          style: {
            background: hasOutOfStock ? '#ff4d4f' : '#faad14',
            borderColor: hasOutOfStock ? '#ff4d4f' : '#faad14',
            height: 40,
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        maskClosable: false,
        closable: true,
        zIndex: 10000
      });
      
      return;
    }
    
    console.log('✅ [Retail] Stock validation passed, creating order...');

    try {
      setLoading(true);

      const { subtotal, totalProfit, finalAmount } = calculateTotals();

      // Prepare order items
      const items = productForms.map(form => ({
        productId: form.productId,
        productName: form.productName,
        sku: form.sku,
        unit: form.unit || 'kg',
        quantity: form.quantity,
        sellingPrice: form.sellingPrice,
        importPrice: form.importPrice,
        subtotal: form.total,
        profit: form.profit,
        profitPerUnit: form.sellingPrice - form.importPrice
      }));

      // Generate orderId
      const orderId = await generateOrderId('retail');

      // Calculate total quantity
      const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
      
      // Create order object
      const retailOrder = {
        orderId: orderId,
        items: items,
        orderDate: selectedDate.format('YYYY-MM-DD'),
        orderTime: selectedTime.format('HH:mm'),
        customerName: customerName.trim(),
        customerPhone: customerPhone ? customerPhone.trim() : '',
        subtotal: subtotal,
        discount: discount,
        shipping: shipping,
        totalAmount: finalAmount,
        totalProfit: totalProfit,
        totalQuantity: totalQuantity,
        totalItems: items.length,
        itemCount: items.length,
        source: 'retail_sales',
        orderType: salesChannel === 'tmdt' ? 'tmdt' : 'retail',
        salesChannel: salesChannel,
        platform: selectedPlatform || null,
        storeName: selectedStore?.name || 'N/A',
        storeId: selectedStore?.id || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'completed'
      };

      // Save to Firebase
      const ordersRef = ref(database, 'salesOrders');
      await push(ordersRef, retailOrder);

      // Deduct stock for all items
      await deductStock(items, products, orderId, 'retail', sellingProducts, selectedStore);
      console.log('✅ Stock deducted successfully for retail order');

      // Save order data and product count before reset
      setCreatedProductCount(items.length);
      setLastCreatedOrder(retailOrder);

      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setSelectedDate(dayjs());
      setSelectedTime(dayjs());
      setSalesChannel('offline');
      setSelectedPlatform(null);
      setProductForms([]);
      setShowForms(false);
      setProductCount('');
      setDiscount(0);
      setShipping(0);
      mainForm.resetFields();

      // Show success modal and ask for print
      setShowSuccessModal(true);
      
      // Ask if user wants to print invoice
      setTimeout(() => {
        Modal.confirm({
          title: '🖨️ In Hóa Đơn',
          content: 'Bạn có muốn in hóa đơn cho đơn hàng này không?',
          okText: 'In Hóa Đơn',
          cancelText: 'Không, Cảm Ơn',
          centered: true,
          onOk() {
            printRetailInvoice(retailOrder);
            message.success('Đang mở cửa sổ in hóa đơn...');
          },
          onCancel() {
            console.log('User declined to print invoice');
          }
        });
      }, 500);
    } catch (error) {
      console.error('Error creating order:', error);
      message.error('Lỗi tạo đơn hàng: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, totalProfit, finalAmount } = calculateTotals();

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Tạo Đơn Hàng Bán Lẻ. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '5px' }}>
      <Spin spinning={loading} tip="Đang xử lý...">
        {/* Header */}
        <Card 
          style={{ 
            marginBottom: 24,
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ShoppingOutlined style={{ fontSize: 32, color: '#007A33' }} />
            <div>
              <h1 className="page-title" style={{ margin: 0, color: '#007A33' }}>Tạo Đơn Hàng Bán Lẻ</h1>
              <p style={{ margin: 0, color: '#666' }}>Tạo đơn hàng bán lẻ trực tiếp hoặc từ sàn TMĐT</p>
            </div>
          </div>
        </Card>

        {/* Order Type Tabs */}
        <div style={{ marginBottom: 24 }}>
          <Space size="middle">
            <Button
              icon={<ShoppingOutlined />}
              size="large"
              onClick={() => navigate('/orders/create/ecommerce')}
              style={{
                borderColor: '#d9d9d9',
                background: 'white',
                color: '#666'
              }}
            >
              Đơn TMĐT
            </Button>
            <Button
              icon={<ShopOutlined />}
              size="large"
              type="primary"
              style={{
                background: '#007A33',
                borderColor: '#007A33'
              }}
            >
              Đơn Bán Lẻ
            </Button>
            <Button
              icon={<TeamOutlined />}
              size="large"
              onClick={() => navigate('/orders/create/wholesale')}
              style={{
                borderColor: '#d9d9d9',
                background: 'white',
                color: '#666'
              }}
            >
              Đơn Bán Sỉ
            </Button>
          </Space>
        </div>

        {/* Main Form */}
        <Card 
          title={<><UserOutlined /> Thông Tin Đơn Hàng</>}
          style={{ 
            marginBottom: 24,
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          <Form form={mainForm} layout="vertical">
            {/* Row 1: Customer Name, Phone, Sales Channel */}
            <Divider orientation="left">Thông Tin Đơn Hàng</Divider>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item label="Tên Khách Hàng" required>
                  <Input
                    prefix={<UserOutlined />}
                    placeholder="Nhập tên khách hàng"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    size="large"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="Số Điện Thoại">
                  <Input
                    prefix={<PhoneOutlined />}
                    placeholder="Nhập số điện thoại"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    size="large"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="Kênh Bán" required>
                  <Select
                    value={salesChannel}
                    onChange={setSalesChannel}
                    size="large"
                  >
                    <Option value="offline">🏪 Bán Lẻ Trực Tiếp</Option>
                    <Option value="tmdt">🛒 Sàn TMĐT</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>

            {/* Row 2: Date, Time, Product Count */}
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item label="Ngày Bán" required>
                  <DatePicker
                    value={selectedDate}
                    onChange={setSelectedDate}
                    format="DD/MM/YYYY"
                    style={{ width: '100%' }}
                    size="large"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="Giờ Bán" required>
                  <TimePicker
                    value={selectedTime}
                    onChange={setSelectedTime}
                    format="HH:mm"
                    style={{ width: '100%' }}
                    size="large"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="Số Lượng Sản Phẩm">
                  <Space.Compact style={{ width: '100%' }}>
                    <InputNumber
                      placeholder="Nhập SL sản phẩm"
                      value={productCount}
                      onChange={setProductCount}
                      min={1}
                      max={50}
                      style={{ width: '100%' }}
                      size="large"
                    />
                    <Button
                      type="primary"
                      icon={<CheckCircleOutlined />}
                      onClick={handleGenerateForms}
                      size="large"
                      style={{ background: '#007A33' }}
                    >
                      Xác Nhận
                    </Button>
                  </Space.Compact>
                </Form.Item>
              </Col>
            </Row>

            {/* Platform Selection (if TMDT) */}
            {salesChannel === 'tmdt' && (
              <Row gutter={16}>
                <Col xs={24} md={12}>
                  <Form.Item label="Chọn Sàn TMĐT" required>
                    <Select
                      placeholder="🛒 Chọn sàn thương mại điện tử"
                      value={selectedPlatform}
                      onChange={setSelectedPlatform}
                      size="large"
                      allowClear
                      showSearch
                    >
                      {platforms.map(p => (
                        <Option key={p.value} value={p.value}>{p.label}</Option>
                      ))}
                    </Select>
                  </Form.Item>
                </Col>
              </Row>
            )}
          </Form>
        </Card>

        {/* Product Forms */}
        {showForms && productForms.length > 0 && (
          <Card 
            title={<><ShopOutlined /> Danh Sách Sản Phẩm ({productForms.length})</>}
            style={{ 
              marginBottom: 24,
              borderRadius: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            {productForms.map((form, index) => (
              <Card
                key={form.id}
                type="inner"
                title={`Sản Phẩm ${form.id}`}
                extra={
                  productForms.length > 1 && (
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => handleDeleteForm(form.id)}
                    >
                      Xóa
                    </Button>
                  )
                }
                style={{ marginBottom: 16 }}
              >
                <Row gutter={16}>
                  <Col xs={24} md={6}>
                    <Form.Item label="Sản Phẩm" required>
                      <Select
                        placeholder="Chọn sản phẩm"
                        value={form.productId}
                        onChange={(value) => handleProductChange(form.id, value)}
                        showSearch
                        filterOption={(input, option) =>
                          option.children.toLowerCase().includes(input.toLowerCase())
                        }
                        size="large"
                      >
                        {sellingProducts.map(product => (
                          <Option key={product.id} value={product.id}>
                            {product.productName}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={4}>
                    <Form.Item label="SKU">
                      <Input value={form.sku} disabled size="large" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={4}>
                    <Form.Item label="Số Lượng" required>
                      <InputNumber
                        value={form.quantity}
                        onChange={(value) => handleQuantityChange(form.id, value)}
                        min={0.1}
                        step={0.1}
                        style={{ width: '100%' }}
                        size="large"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={5}>
                    <Form.Item label="Giá Bán">
                      <Input
                        value={formatCurrency(form.sellingPrice)}
                        disabled
                        size="large"
                        style={{ color: '#007A33', fontWeight: 600 }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={5}>
                    <Form.Item label="Tổng Tiền">
                      <Input
                        value={formatCurrency(form.total)}
                        disabled
                        size="large"
                        style={{ color: '#007A33', fontWeight: 600 }}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            ))}
          </Card>
        )}

        {/* Order Summary */}
        {showForms && productForms.length > 0 && (
          <Card 
            title={<><DollarOutlined /> Tổng Kết Đơn Hàng</>}
            style={{ 
              marginBottom: 24,
              borderRadius: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={24} md={8}>
                <Statistic
                  title="Tạm Tính"
                  value={subtotal}
                  precision={0}
                  valueStyle={{ color: '#666' }}
                  formatter={(value) => formatCurrency(value)}
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title="Tổng Cộng"
                  value={finalAmount}
                  precision={0}
                  valueStyle={{ color: '#007A33', fontWeight: 'bold' }}
                  formatter={(value) => formatCurrency(value)}
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title="Lợi Nhuận"
                  value={totalProfit}
                  precision={0}
                  valueStyle={{ color: totalProfit >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 'bold' }}
                  formatter={(value) => formatCurrency(value)}
                />
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Giảm Giá">
                  <InputNumber
                    value={discount}
                    onChange={setDiscount}
                    min={0}
                    formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                    style={{ width: '100%' }}
                    size="large"
                    placeholder="Nhập số tiền giảm giá"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={12}>
                <Form.Item label="Phí Vận Chuyển">
                  <InputNumber
                    value={shipping}
                    onChange={setShipping}
                    min={0}
                    formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                    style={{ width: '100%' }}
                    size="large"
                    placeholder="Nhập phí vận chuyển"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Divider />

            <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
              <Button
                icon={<ReloadOutlined />}
                size="large"
                onClick={() => {
                  setCustomerName('');
                  setCustomerPhone('');
                  setProductForms([]);
                  setShowForms(false);
                  setProductCount('');
                  setDiscount(0);
                  setShipping(0);
                  mainForm.resetFields();
                }}
              >
                Làm Mới
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                size="large"
                onClick={handleCreateOrder}
                style={{ 
                  background: '#007A33',
                  minWidth: 200
                }}
              >
                Tạo Đơn Hàng Bán Lẻ
              </Button>
            </div>
          </Card>
        )}

        {/* Success Modal */}
        <Modal
          open={showSuccessModal}
          onCancel={() => setShowSuccessModal(false)}
          footer={null}
          centered
          width={500}
        >
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 16 }} />
            <h2 style={{ color: '#007A33', marginBottom: 8 }}>Tạo Đơn Hàng Thành Công!</h2>
            <p style={{ fontSize: 16, color: '#666', marginBottom: 24 }}>
              Đơn hàng bán lẻ với <strong>{createdProductCount} sản phẩm</strong> đã được tạo thành công.
            </p>
            <Space size="middle" direction="vertical" style={{ width: '100%' }}>
              <Space size="middle">
                <Button
                  size="large"
                  onClick={() => setShowSuccessModal(false)}
                >
                  Ở Lại Trang Này
                </Button>
                <Button
                  type="primary"
                  size="large"
                  onClick={() => navigate('/orders/manage/retail')}
                  style={{ background: '#007A33' }}
                >
                  Quản Lý Đơn Hàng
                </Button>
              </Space>
              {lastCreatedOrder && (
                <Button
                  size="large"
                  icon={<PrinterOutlined />}
                  onClick={() => {
                    printRetailInvoice(lastCreatedOrder);
                    message.success('Đang mở cửa sổ in hóa đơn...');
                  }}
                  style={{ 
                    borderColor: '#007A33',
                    color: '#007A33'
                  }}
                >
                  In Hóa Đơn
                </Button>
              )}
            </Space>
          </div>
        </Modal>
      </Spin>
    </div>
  );
};

export default CreateOrderRetail;
