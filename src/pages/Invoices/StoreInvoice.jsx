import React, { useState, useEffect } from 'react';
import { database } from '../../services/firebase.service';
import { ref, onValue, push, set } from 'firebase/database';
import { 
  Card, 
  DatePicker, 
  Button, 
  Typography, 
  Space, 
  Statistic, 
  Row, 
  Col,
  message,
  Select,
  Modal,
  Form,
  Input,
  InputNumber
} from 'antd';
import {
  FileTextOutlined,
  CalendarOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  PrinterOutlined,
  ReloadOutlined,
  ShopOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

dayjs.locale('vi');

const StoreInvoice = () => {
  const { user, isAdmin } = useAuth();
  const hasPermission = isAdmin || (user?.permissions || []).includes('invoices.store.view');

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Hóa Đơn Từng Cửa Hàng. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'days'), dayjs()]);
  const [selectedStore, setSelectedStore] = useState('');
  const [orders, setOrders] = useState([]);
  const [stores, setStores] = useState([]);
  const [invoiceData, setInvoiceData] = useState(null);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentForm] = Form.useForm();

  // Load stores
  useEffect(() => {
    const storesRef = ref(database, 'stores');
    const unsubscribe = onValue(storesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const storesArray = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(store => store.status === 'active');
        setStores(storesArray);
        if (storesArray.length > 0 && !selectedStore) {
          setSelectedStore(storesArray[0].name);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Load orders when store or date changes
  useEffect(() => {
    if (selectedStore) {
      loadOrders();
    }
  }, [selectedStore, dateRange]);

  const loadOrders = () => {
    if (!selectedStore) {
      message.warning('Vui lòng chọn cửa hàng!');
      return;
    }

    setLoading(true);
    // Reset invoice data when manually reloading
    if (invoiceData) {
      setInvoiceData(null);
      message.info('Đã reset hóa đơn. Vui lòng bấm "Tạo Hóa Đơn" để tạo lại.');
    }
    const ordersRef = ref(database, 'salesOrders');
    
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const allOrders = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        
        const ordersArray = allOrders.filter(order => {
            // Try multiple date formats
            let orderDate = dayjs(order.orderDate, 'YYYY-MM-DD');
            if (!orderDate.isValid()) {
              orderDate = dayjs(order.orderDate, 'DD/MM/YYYY');
            }
            if (!orderDate.isValid()) {
              orderDate = dayjs(order.orderDate);
            }
            
            const storeMatch = order.storeName === selectedStore;
            const dateValid = orderDate.isValid() && 
                   (orderDate.isAfter(dateRange[0].subtract(1, 'day')) || orderDate.isSame(dateRange[0], 'day')) && 
                   (orderDate.isBefore(dateRange[1].add(1, 'day')) || orderDate.isSame(dateRange[1], 'day'));
            
            
            return storeMatch && dateValid;
          })
          .sort((a, b) => {
            let dateA = dayjs(a.orderDate, 'YYYY-MM-DD');
            if (!dateA.isValid()) dateA = dayjs(a.orderDate, 'DD/MM/YYYY');
            if (!dateA.isValid()) dateA = dayjs(a.orderDate);
            
            let dateB = dayjs(b.orderDate, 'YYYY-MM-DD');
            if (!dateB.isValid()) dateB = dayjs(b.orderDate, 'DD/MM/YYYY');
            if (!dateB.isValid()) dateB = dayjs(b.orderDate);
            
            return dateB.valueOf() - dateA.valueOf();
          });
        
        setOrders(ordersArray);
      } else {
        setOrders([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  };

  // Generate invoice data
  const generateInvoice = () => {
    if (!selectedStore) {
      message.warning('Vui lòng chọn cửa hàng!');
      return;
    }

    // Allow creating invoice even with 0 orders


    // Group products from all orders
    const productSummary = {};
    let totalRevenue = 0;
    let totalImportCost = 0;
    let totalOrders = orders.length;

    orders.forEach(order => {
      totalRevenue += parseFloat(order.totalAmount) || 0;
      
      if (order.items && Array.isArray(order.items)) {
        order.items.forEach(item => {
          const key = `${item.productName}_${item.sku}`;
          
          if (!productSummary[key]) {
            productSummary[key] = {
              productName: item.productName,
              sku: item.sku,
              unit: item.unit || 'kg',
              sellingPrice: parseFloat(item.sellingPrice) || 0,
              importPrice: parseFloat(item.importPrice) || 0,
              totalQuantity: 0,
              totalAmount: 0,
              totalImportCost: 0
            };
          }
          
          const quantity = parseFloat(item.quantity) || 0;
          const sellingPrice = parseFloat(item.sellingPrice) || 0;
          const importPrice = parseFloat(item.importPrice) || 0;
          
          productSummary[key].totalQuantity += quantity;
          productSummary[key].totalAmount += quantity * sellingPrice;
          productSummary[key].totalImportCost += quantity * importPrice;
        });
      }
    });

    // Calculate totals
    const productList = Object.values(productSummary);
    totalImportCost = productList.reduce((sum, product) => sum + product.totalImportCost, 0);
    const totalProfit = totalRevenue - totalImportCost;

    // Group by order type
    const typeStats = {};
    orders.forEach(order => {
      const type = order.orderType || 'unknown';
      
      // Calculate import cost for this order
      let orderImportCost = 0;
      if (order.items && Array.isArray(order.items)) {
        orderImportCost = order.items.reduce((sum, item) => 
          sum + ((parseFloat(item.importPrice) || 0) * (parseFloat(item.quantity) || 0)), 0
        );
      }
      
      if (!typeStats[type]) {
        typeStats[type] = { count: 0, revenue: 0, importCost: 0, profit: 0 };
      }
      typeStats[type].count += 1;
      typeStats[type].revenue += parseFloat(order.totalAmount) || 0;
      typeStats[type].importCost += orderImportCost;
      typeStats[type].profit += parseFloat(order.totalProfit || order.profit) || 0;
    });


    setInvoiceData({
      storeName: selectedStore,
      totalRevenue,
      totalImportCost,
      totalProfit,
      totalOrders,
      productList,
      typeStats,
      dateRange: {
        start: dateRange[0].format('DD/MM/YYYY'),
        end: dateRange[1].format('DD/MM/YYYY')
      }
    });

    message.success('Đã tạo hóa đơn cửa hàng thành công!');
  };

  // Show payment modal before printing
  const showPaymentModal = () => {
    if (!invoiceData) {
      message.warning('Vui lòng tạo hóa đơn trước khi in!');
      return;
    }
    
    // Set default values
    paymentForm.setFieldsValue({
      paymentStatus: 'paid',
      paymentMethod: 'cash',
      paymentAmount: invoiceData.totalImportCost,
      paymentDate: dayjs().format('YYYY-MM-DD'),
      notes: `Hóa đơn cửa hàng ${invoiceData.storeName} từ ${invoiceData.dateRange.start} đến ${invoiceData.dateRange.end}`
    });
    
    setPaymentModalVisible(true);
  };

  // Handle payment confirmation
  const handlePaymentConfirm = async () => {
    try {
      const values = await paymentForm.validateFields();
      
      // Generate unique invoice ID
      const invoiceId = `INV-STORE-${Date.now()}`;
      
      // Create payment invoice data
      const paymentInvoiceData = {
        invoiceId,
        invoiceType: 'store_summary',
        customerName: `Cửa hàng ${invoiceData.storeName}`,
        storeName: invoiceData.storeName,
        paymentDate: values.paymentDate,
        paymentMethod: values.paymentMethod,
        paymentStatus: values.paymentStatus,
        totalAmount: invoiceData.totalImportCost,
        paidAmount: values.paymentAmount || 0,
        remainingAmount: invoiceData.totalImportCost - (values.paymentAmount || 0),
        notes: values.notes,
        dateRange: invoiceData.dateRange,
        productList: invoiceData.productList || [],
        orderStats: {
          totalOrders: invoiceData.totalOrders,
          ecommerce: invoiceData.typeStats?.ecommerce || {},
          wholesale: invoiceData.typeStats?.wholesale || {},
          retail: invoiceData.typeStats?.retail || {}
        },
        paymentHistory: [{
          amount: values.paymentAmount || 0,
          date: values.paymentDate,
          method: values.paymentMethod,
          notes: values.notes || '',
          timestamp: new Date().toISOString()
        }],
        createdAt: new Date().toISOString(),
        createdBy: 'System'
      };
      
      // Save to Firebase
      const paymentInvoicesRef = ref(database, 'paymentInvoices');
      const newInvoiceRef = push(paymentInvoicesRef);
      await set(newInvoiceRef, paymentInvoiceData);
      
      message.success('Đã lưu hóa đơn thanh toán thành công!');
      
      // Close modal and print
      setPaymentModalVisible(false);
      printInvoice();
      
    } catch (error) {
      console.error('Error saving payment invoice:', error);
      message.error('Lỗi khi lưu hóa đơn thanh toán!');
    }
  };

  // Print invoice after payment confirmation
  const printInvoice = () => {
    if (!invoiceData) {
      message.warning('Vui lòng tạo hóa đơn trước khi in!');
      return;
    }

    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
      }).format(amount || 0);
    };

    const getOrderTypeLabel = (type) => {
      switch(type) {
        case 'ecommerce': return 'TMĐT';
        case 'retail': return 'Bán Lẻ';
        case 'wholesale': return 'Bán Sỉ';
        default: return 'Không xác định';
      }
    };

    let invoiceHTML = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <title>Hóa Đơn Cửa Hàng - ${invoiceData.storeName}</title>
          <style>
              body {
                  font-family: Arial, sans-serif;
                  margin: 0;
                  padding: 20px;
                  background: white;
              }
              .invoice-container {
                  max-width: 800px;
                  margin: 0 auto;
                  background: white;
                  padding: 20px;
                  border: 1px solid #ddd;
              }
              .header {
                  text-align: center;
                  margin-bottom: 30px;
                  border-bottom: 2px solid #333;
                  padding-bottom: 15px;
              }
              .invoice-icon {
                  font-size: 24px;
                  margin-right: 10px;
                  color: #007A33;
              }
              .invoice-title {
                  font-size: 20px;
                  font-weight: bold;
                  margin: 10px 0;
                  color: #333;
              }
              .subtitle {
                  font-size: 14px;
                  color: #666;
                  margin-bottom: 20px;
                  text-align: center;
              }
              .info-section {
                  display: flex;
                  justify-content: space-between;
                  margin-bottom: 20px;
                  font-size: 13px;
              }
              .info-left, .info-right {
                  width: 48%;
              }
              .info-row {
                  display: flex;
                  margin-bottom: 5px;
              }
              .info-label {
                  font-weight: bold;
                  width: 120px;
              }
              .date-range {
                  text-align: center;
                  font-size: 14px;
                  font-weight: bold;
                  margin: 20px 0;
                  color: #333;
              }
              .summary-section {
                  display: grid;
                  grid-template-columns: repeat(4, 1fr);
                  gap: 20px;
                  margin-bottom: 40px;
              }
              .summary-card {
                  background: #f5f5f5;
                  padding: 20px;
                  border-radius: 8px;
                  text-align: center;
                  border: 2px solid #007A33;
              }
              .summary-label {
                  font-size: 14px;
                  color: #666;
                  margin-bottom: 8px;
              }
              .summary-value {
                  font-size: 24px;
                  font-weight: bold;
                  color: #007A33;
              }
              .section-title {
                  font-size: 18px;
                  font-weight: bold;
                  color: #333;
                  margin: 30px 0 15px 0;
                  padding-bottom: 10px;
                  border-bottom: 2px solid #007A33;
              }
              table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-bottom: 30px;
              }
              th, td {
                  border: 1px solid #ddd;
                  padding: 12px;
                  text-align: left;
              }
              th {
                  background-color: #007A33;
                  color: white;
                  font-weight: bold;
              }
              .text-right {
                  text-align: right;
              }
              .text-center {
                  text-align: center;
              }
              .footer {
                  margin-top: 60px;
                  text-align: center;
                  color: #666;
                  font-size: 14px;
                  border-top: 2px solid #eee;
                  padding-top: 20px;
              }
              @media print {
                  body { margin: 0; }
                  .invoice-container { padding: 20px; }
              }
          </style>
      </head>
      <body>
          <div class="invoice-container">
              <div class="header">
                  <span class="invoice-icon">📋</span>
                  <div class="invoice-title">HÓA ĐƠN Cửa Hàng</div>
                  <div class="invoice-id">Mã hóa đơn: <strong>${invoiceData.invoiceId}</strong> - <span style="color: #ff4d4f; font-weight: bold;">CHƯA THANH TOÁN</span></div>
              </div>
              
              <div class="subtitle">CỬA HÀNG: ${invoiceData.storeName}</div>
              
              <div class="info-section">
                  <div class="info-left">
                      <div class="info-row">
                          <span class="info-label">Loại báo cáo:</span>
                          <span>Cửa hàng ${invoiceData.storeName}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Tổng đơn hàng:</span>
                          <span>${invoiceData.totalOrders} đơn</span>
                      </div>
                  </div>
                  <div class="info-right">
                      <div class="info-row">
                          <span class="info-label">Ngày tạo:</span>
                          <span>${new Date().toLocaleDateString('vi-VN')}</span>
                      </div>
                      <div class="info-row">
                          <span class="info-label">Tổng sản phẩm:</span>
                          <span>${invoiceData.productList.length} loại</span>
                      </div>
                  </div>
              </div>
              
              <div class="date-range">
                  Từ ${invoiceData.dateRange.start} đến ${invoiceData.dateRange.end}
              </div>
              
              <!-- Order Type Summary -->
              <div style="margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 4px;">
                  <div style="display: grid; justify-content: start; font-size: 14px; font-weight: 500;">
                      <span style="color: #007A33">Tổng Đơn TMĐT: ${formatCurrency(invoiceData.typeStats?.ecommerce?.importCost || 0)}</span>
                      <span style="color: #007A33">Tổng Đơn Sỉ: ${formatCurrency(invoiceData.typeStats?.wholesale?.importCost || 0)}</span>
                      <span style="color: #007A33">Tổng Đơn Lẻ: ${formatCurrency(invoiceData.typeStats?.retail?.importCost || 0)}</span>
                  </div>
              </div>
              
              <div style="margin: 20px 0; padding: 10px; background: #f0f8ff; border-left: 4px solid #007A33;">
                  <span style="font-size: 16px; font-weight: bold; color: #007A33;">📊 Tổng hợp chung</span>
              </div>
              
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                  <thead>
                      <tr style="background-color: #4a4a4a; color: white;">
                          <th style="padding: 12px; text-align: center; font-weight: bold;">STT</th>
                          <th style="padding: 12px; text-align: left; font-weight: bold;">TÊN SẢN PHẨM</th>
                          <th style="padding: 12px; text-align: center; font-weight: bold;">SỐ LƯỢNG</th>
                          <th style="padding: 12px; text-align: center; font-weight: bold;">ĐƠN GIÁ</th>
                          <th style="padding: 12px; text-align: center; font-weight: bold;">THÀNH TIỀN</th>
                      </tr>
                  </thead>
                  <tbody>`;

    // Add products to table
    if (invoiceData.productList.length > 0) {
      invoiceData.productList.forEach((product, index) => {
        const unitDisplay = product.unit === 'kg' ? 'kg' : 'gói';
        invoiceHTML += `
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 10px; text-align: center;">${index + 1}</td>
                            <td style="padding: 10px;">${product.productName}</td>
                            <td style="padding: 10px; text-align: center;">${product.totalQuantity} ${unitDisplay}</td>
                            <td style="padding: 10px; text-align: right;">${formatCurrency(product.importPrice)}</td>
                            <td style="padding: 10px; text-align: right;">${formatCurrency(product.totalImportCost)}</td>
                        </tr>`;
      });
    } else {
      invoiceHTML += `
                      <tr>
                          <td colspan="5" style="padding: 20px; text-align: center; color: #666; font-style: italic;">
                              Không có sản phẩm nào trong khoảng thời gian này
                          </td>
                      </tr>`;
    }

    invoiceHTML += `
                  </tbody>
              </table>
              
              <div style="text-align: right; margin-top: 20px; padding: 10px; background-color: #e8f5e8;">
                  <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: bold;">
                      <span>TỔNG TIỀN: <span style="color: #007A33;">${formatCurrency(invoiceData.totalImportCost)}</span></span>
                      <span>ĐÃ THANH TOÁN: <span style="color: #1890ff;">0 đ</span></span>
                      <span>CÒN LẠI: <span style="color: #ff4d4f;">${formatCurrency(invoiceData.totalImportCost)}</span></span>
                  </div>
              </div>
              
              <div style="margin-top: 40px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #ddd; padding-top: 20px;">
                  <strong>Hệ Thống Quản Lý Kinh Doanh - Phúc Hoàng Technology</strong><br>
                  Ngày in: ${new Date().toLocaleString('vi-VN')}
              </div>
          </div>
      </body>
      </html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error('Không thể mở cửa sổ in. Vui lòng kiểm tra popup blocker!');
      return;
    }

    printWindow.document.write(invoiceHTML);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };

    message.success('Đã mở cửa sổ in hóa đơn!');
  };


  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <div
        style={{
          background: '#fff',
          padding: '16px 24px',
          borderRadius: 12,
          boxShadow: '0 12px 30px rgba(5, 153, 0, 0.08)',
          marginBottom: 24
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#e6f7e6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <ShopOutlined style={{ fontSize: 20, color: '#0f9d58' }} />
          </div>
          <div>
            <Title level={2} style={{ margin: 0, color: 'rgb(8 125 68)', fontWeight: 'bold', fontSize: 23 }}>
              Hóa Đơn Từng Cửa Hàng
            </Title>
            <Text type="secondary">Xem và in hóa đơn theo từng cửa hàng</Text>
          </div>
        </div>
      </div>

      <Card
        style={{ borderRadius: 12, boxShadow: '0 10px 30px rgba(15, 157, 88, 0.08)' }}
        bodyStyle={{ padding: 0 }}
      >
        <div style={{ padding: 24 }}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>

          {/* Store & Date Selection */}
          <Card size="small" style={{ background: '#f5f7fa' }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Title level={5}>
                <CalendarOutlined style={{ marginRight: 8 }} />
                Chọn Cửa Hàng & Khoảng Thời Gian
              </Title>
              <Space size="large" wrap>
                <Select
                  style={{ width: 200 }}
                  placeholder="Chọn cửa hàng"
                  value={selectedStore}
                  onChange={(store) => {
                    setSelectedStore(store);
                    setInvoiceData(null); // Reset invoice when store changes
                    message.info('Đã đổi cửa hàng. Vui lòng bấm "Tải Lại" và "Tạo Hóa Đơn" để tạo lại.');
                  }}
                  showSearch
                  optionFilterProp="children"
                >
                  {stores.map(store => (
                    <Option key={store.id} value={store.name}>
                      {store.name}
                    </Option>
                  ))}
                </Select>
                <RangePicker
                  value={dateRange}
                  onChange={(dates) => {
                    setDateRange(dates);
                    if (invoiceData) {
                      setInvoiceData(null); // Reset invoice when date changes
                      message.info('Đã thay đổi thời gian. Vui lòng bấm "Tải Lại" và "Tạo Hóa Đơn" để tạo lại.');
                    }
                  }}
                  format="DD/MM/YYYY"
                  placeholder={['Từ ngày', 'Đến ngày']}
                  style={{ width: 300 }}
                />
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  onClick={loadOrders}
                >
                  Tải Lại
                </Button>
                <Button
                  type="primary"
                  icon={<FileTextOutlined />}
                  onClick={generateInvoice}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                >
                  Tạo Hóa Đơn
                </Button>
                {invoiceData && (
                  <Button
                    icon={<PrinterOutlined />}
                    onClick={showPaymentModal}
                  >
                    In Hóa Đơn
                  </Button>
                )}
              </Space>
            </Space>
          </Card>

          {/* Statistics */}
          {invoiceData && (
            <Card>
              <Title level={5} style={{ marginBottom: 16 }}>Tổng Quan - {invoiceData.storeName}</Title>
              <Row gutter={16}>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="Tổng Đơn Hàng"
                      value={invoiceData.totalOrders}
                      prefix={<ShoppingCartOutlined />}
                      valueStyle={{ color: '#007A33' }}
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="Chi Phí Nhập Đơn Sỉ"
                      value={invoiceData.typeStats?.wholesale?.importCost || 0}
                      prefix={<DollarOutlined />}
                      valueStyle={{ color: '#048a21ff' }}
                      formatter={(value) => 
                        new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
                      }
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="Chi Phí Nhập Đơn Lẻ"
                      value={invoiceData.typeStats?.retail?.importCost || 0}
                      prefix={<DollarOutlined />}
                      valueStyle={{ color: '#048a21ff' }}
                      formatter={(value) => 
                        new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
                      }
                    />
                  </Card>
                </Col>
                <Col span={6}>
                  <Card>
                    <Statistic
                      title="Chi Phí Nhập Đơn TMĐT"
                      value={invoiceData.typeStats?.ecommerce?.importCost || 0}
                      prefix={<DollarOutlined />}
                      valueStyle={{ color: '#048a21ff' }}
                      formatter={(value) => 
                        new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
                      }
                    />
                  </Card>
                </Col>
              </Row>
            </Card>
          )}

          {/* Invoice Preview */}
          {invoiceData && (
            <Card>
              <Title level={5} style={{ marginBottom: 16 }}>
                📋 Hóa Đơn  Cửa Hàng - {invoiceData.storeName} ({invoiceData.dateRange.start} đến {invoiceData.dateRange.end})
              </Title>
              
              <div style={{ 
                border: '1px solid #d9d9d9', 
                borderRadius: '6px', 
                padding: '24px',
                background: '#fafafa',
                marginBottom: '16px'
              }}>
                {/* Header */}
                <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #333', paddingBottom: '15px' }}>
                  <span style={{ fontSize: '24px', marginRight: '10px', color: '#007A33' }}>📋</span>
                  <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>Hóa Đơn Cửa Hàng</span>
                </div>
                
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '20px', textAlign: 'center' }}>
                  CỬA HÀNG: {invoiceData.storeName}
                </div>
                
                {/* Info Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '13px' }}>
                  <div style={{ width: '48%' }}>
                    <div style={{ display: 'flex', marginBottom: '5px' }}>
                      <span style={{ fontWeight: 'bold', width: '120px' }}>Loại báo cáo:</span>
                      <span>Cửa hàng {invoiceData.storeName}</span>
                    </div>
                    <div style={{ display: 'flex', marginBottom: '5px' }}>
                      <span style={{ fontWeight: 'bold', width: '120px' }}>Tổng đơn hàng:</span>
                      <span>{invoiceData.totalOrders} đơn</span>
                    </div>
                  </div>
                  <div style={{ width: '48%' }}>
                    <div style={{ display: 'flex', marginBottom: '5px' }}>
                      <span style={{ fontWeight: 'bold', width: '120px' }}>Ngày tạo:</span>
                      <span>{new Date().toLocaleDateString('vi-VN')}</span>
                    </div>
                    <div style={{ display: 'flex', marginBottom: '5px' }}>
                      <span style={{ fontWeight: 'bold', width: '120px' }}>Tổng sản phẩm:</span>
                      <span>{invoiceData.productList.length} loại</span>
                    </div>
                  </div>
                </div>
                
                <div style={{ textAlign: 'center', fontSize: '14px', fontWeight: 'bold', margin: '20px 0', color: '#333' }}>
                  Từ {invoiceData.dateRange.start} đến {invoiceData.dateRange.end}
                </div>
                
                {/* Order Type Summary */}
                <div style={{ margin: '20px 0', padding: '15px', background: '#f9f9f9', border: '1px solid #ddd', borderRadius: '4px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-around', fontSize: '14px', fontWeight: 'bold' }}>
                    <span>Tổng Đơn TMĐT: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(invoiceData.typeStats?.ecommerce?.importCost || 0)}</span>
                    <span>Tổng Đơn Sỉ: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(invoiceData.typeStats?.wholesale?.importCost || 0)}</span>
                    <span>Tổng Đơn Lẻ: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(invoiceData.typeStats?.retail?.importCost || 0)}</span>
                  </div>
                </div>
                
                {/* Product Summary Section */}
                <div style={{ margin: '20px 0', padding: '10px', background: '#f0f8ff', borderLeft: '4px solid #007A33' }}>
                  <span style={{ fontSize: '16px', fontWeight: 'bold', color: '#007A33' }}>📊 Tổng hợp chung</span>
                </div>
                
                {/* Products Table */}
                <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#4a4a4a', color: 'white' }}>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>STT</th>
                      <th style={{ padding: '12px', textAlign: 'left', fontWeight: 'bold' }}>TÊN SẢN PHẨM</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>SỐ LƯỢNG</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>ĐƠN GIÁ</th>
                      <th style={{ padding: '12px', textAlign: 'center', fontWeight: 'bold' }}>THÀNH TIỀN</th>
                    </tr>
                  </thead>
                  <tbody>
                    {invoiceData.productList.length > 0 ? (
                      invoiceData.productList.map((product, index) => {
                        const unitDisplay = product.unit === 'kg' ? 'kg' : 'gói';
                        return (
                          <tr key={index} style={{ borderBottom: '1px solid #ddd' }}>
                            <td style={{ padding: '10px', textAlign: 'center' }}>{index + 1}</td>
                            <td style={{ padding: '10px' }}>{product.productName}</td>
                            <td style={{ padding: '10px', textAlign: 'center' }}>{product.totalQuantity} {unitDisplay}</td>
                            <td style={{ padding: '10px', textAlign: 'right' }}>
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.importPrice)}
                            </td>
                            <td style={{ padding: '10px', textAlign: 'right' }}>
                              {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(product.totalImportCost)}
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="5" style={{ padding: '20px', textAlign: 'center', color: '#666', fontStyle: 'italic' }}>
                          Không có sản phẩm nào trong khoảng thời gian này
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                
                {/* Total */}
                <div style={{ marginTop: '20px', padding: '10px', backgroundColor: '#e8f5e8' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', fontWeight: 'bold' }}>
                    <span>TỔNG TIỀN: <span style={{ color: '#007A33' }}>
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(invoiceData.totalImportCost)}
                    </span></span>
                    <span>ĐÃ THANH TOÁN: <span style={{ color: '#1890ff' }}>0 đ</span></span>
                    <span>CÒN LẠI: <span style={{ color: '#ff4d4f' }}>
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(invoiceData.totalImportCost)}
                    </span></span>
                  </div>
                </div>
              </div>
            </Card>
          )}
          </Space>
        </div>
      </Card>

      {/* Payment Modal */}
      <Modal
        title="Xác Nhận Thanh Toán"
        open={paymentModalVisible}
        onOk={handlePaymentConfirm}
        onCancel={() => {
          setPaymentModalVisible(false);
          paymentForm.resetFields();
        }}
        okText="Xác Nhận & In"
        cancelText="Hủy"
        width={600}
      >
        <Form
          form={paymentForm}
          layout="vertical"
          initialValues={{
            paymentStatus: 'paid',
            paymentMethod: 'cash'
          }}
        >
          <Form.Item
            name="paymentStatus"
            label="Trạng Thái Thanh Toán"
            rules={[{ required: true, message: 'Vui lòng chọn trạng thái thanh toán!' }]}
          >
            <Select 
              placeholder="Chọn trạng thái"
              onChange={(value) => {
                if (value === 'partial') {
                  // Clear payment amount when selecting partial payment
                  paymentForm.setFieldsValue({ paymentAmount: null });
                  message.info('Vui lòng nhập số tiền thanh toán 1 phần');
                } else if (value === 'paid') {
                  // Set full amount when selecting paid
                  paymentForm.setFieldsValue({ paymentAmount: invoiceData.totalImportCost });
                } else if (value === 'unpaid') {
                  // Set 0 when selecting unpaid
                  paymentForm.setFieldsValue({ paymentAmount: 0 });
                }
              }}
            >
              <Select.Option value="paid">Đã Thanh Toán</Select.Option>
              <Select.Option value="partial">Thanh Toán 1 Phần</Select.Option>
              <Select.Option value="unpaid">Chưa Thanh Toán</Select.Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="paymentMethod"
            label="Phương Thức Thanh Toán"
            rules={[{ required: true, message: 'Vui lòng chọn phương thức thanh toán!' }]}
          >
            <Select placeholder="Chọn phương thức">
              <Select.Option value="cash">Tiền Mặt</Select.Option>
              <Select.Option value="bank_transfer">Chuyển Khoản</Select.Option>
              <Select.Option value="credit_card">Thẻ Tín Dụng</Select.Option>
              <Select.Option value="other">Khác</Select.Option>
            </Select>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="paymentAmount"
                label="Số Tiền Thanh Toán"
                rules={[{ required: true, message: 'Vui lòng nhập số tiền!' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                  placeholder="Nhập số tiền"
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="paymentDate"
                label="Ngày Thanh Toán"
                rules={[{ required: true, message: 'Vui lòng chọn ngày!' }]}
              >
                <Input type="date" />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="notes"
            label="Ghi Chú"
          >
            <Input.TextArea rows={3} placeholder="Nhập ghi chú (tùy chọn)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StoreInvoice;
