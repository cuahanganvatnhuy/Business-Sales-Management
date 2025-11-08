import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../../services/firebase.service';
import { ref, onValue, push, set } from 'firebase/database';
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
  PrinterOutlined
} from '@ant-design/icons';
import { formatCurrency } from '../../utils/format';
import { printRetailInvoice } from '../../utils/printInvoice';
import dayjs from 'dayjs';
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
  const [mainForm] = Form.useForm();

  // State
  const [sellingProducts, setSellingProducts] = useState([]);
  const [loading, setLoading] = useState(false);

  // Customer & Order info
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

    try {
      setLoading(true);

      const { subtotal, totalProfit, finalAmount } = calculateTotals();

      // Prepare order items
      const items = productForms.map(form => ({
        productId: form.productId,
        productName: form.productName,
        sku: form.sku,
        quantity: form.quantity,
        sellingPrice: form.sellingPrice,
        importPrice: form.importPrice,
        totalAmount: form.total,
        totalProfit: form.profit,
        profitPerUnit: form.sellingPrice - form.importPrice
      }));

      // Create order object
      const retailOrder = {
        orderId: `RETAIL-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
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
        itemCount: items.length,
        source: 'retail_sales',
        orderType: salesChannel === 'tmdt' ? 'tmdt' : 'retail',
        salesChannel: salesChannel,
        platform: selectedPlatform || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'completed'
      };

      // Save to Firebase
      const ordersRef = ref(database, 'retailSalesOrders');
      await push(ordersRef, retailOrder);

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

  return (
    <div style={{ padding: '24px' }}>
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
              <h1 style={{ margin: 0, fontSize: 24, color: '#007A33' }}>Tạo Đơn Hàng Bán Lẻ</h1>
              <p style={{ margin: 0, color: '#666' }}>Tạo đơn hàng bán lẻ trực tiếp hoặc từ sàn TMĐT</p>
            </div>
          </div>
        </Card>

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
            {/* Customer Info */}
            <Divider orientation="left">Thông Tin Khách Hàng</Divider>
            <Row gutter={16}>
              <Col xs={24} md={12}>
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
              <Col xs={24} md={12}>
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
            </Row>

            {/* Order Info */}
            <Divider orientation="left">Thông Tin Bán Hàng</Divider>
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

            {/* Product Count */}
            <Divider orientation="left">Thông Tin Sản Phẩm</Divider>
            <Row gutter={16}>
              <Col xs={24} md={12}>
                <Form.Item label="Số Lượng Sản Phẩm">
                  <Space.Compact style={{ width: '100%' }}>
                    <InputNumber
                      placeholder="Nhập số lượng sản phẩm"
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
                  <div style={{ marginTop: 8, color: '#666', fontSize: 13 }}>
                    Nhập số lượng sản phẩm bạn muốn thêm vào đơn hàng (tối đa 50)
                  </div>
                </Form.Item>
              </Col>
            </Row>
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
                  suffix="₫"
                  valueStyle={{ color: '#666' }}
                  formatter={(value) => formatCurrency(value)}
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title="Tổng Cộng"
                  value={finalAmount}
                  precision={0}
                  suffix="₫"
                  valueStyle={{ color: '#007A33', fontWeight: 'bold' }}
                  formatter={(value) => formatCurrency(value)}
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title="Lợi Nhuận"
                  value={totalProfit}
                  precision={0}
                  suffix="₫"
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
                  onClick={() => navigate('/orders/manage')}
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
