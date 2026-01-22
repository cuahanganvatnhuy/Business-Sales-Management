import React, { useState, useEffect } from 'react';
import { database } from '../../services/firebase.service';
import { ref, onValue, query, orderByChild } from 'firebase/database';
import { 
  DatePicker, 
  Button, 
  Typography, 
  Space, 
  Statistic, 
  Row, 
  Col,
  message,
  Card
} from 'antd';
import {
  FileTextOutlined,
  CalendarOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  PrinterOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;

dayjs.locale('vi');

const GlobalInvoice = () => {
  const { user, isAdmin } = useAuth();
  const hasPermission = isAdmin || (user?.permissions || []).includes('invoices.global.view');

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Hóa Đơn Toàn Bộ. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'days'), dayjs()]);
  const [orders, setOrders] = useState([]);
  const [stores, setStores] = useState({});
  const [invoiceData, setInvoiceData] = useState(null);

  // Load stores
  useEffect(() => {
    const storesRef = ref(database, 'stores');
    const unsubscribe = onValue(storesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        setStores(data);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load orders when date range changes
  useEffect(() => {
    // Reset invoice data when date range changes
    setInvoiceData(null);
    loadOrders();
  }, [dateRange]);

  // Reset everything function
  const resetAll = () => {
    setInvoiceData(null);
    setDateRange([dayjs().subtract(30, 'days'), dayjs()]); // Reset to default date range
    setOrders([]);
    message.info('Đã reset tất cả. Vui lòng chọn lại khoảng thời gian.');
  };

  const loadOrders = () => {
    setLoading(true);
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
            
            // Simple date comparison
            const startDate = dateRange[0].startOf('day');
            const endDate = dateRange[1].endOf('day');
            const orderDateStart = orderDate.startOf('day');
            
            const inRange = orderDate.isValid() && 
                   orderDateStart.valueOf() >= startDate.valueOf() && 
                   orderDateStart.valueOf() <= endDate.valueOf();
                   
            return inRange;
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
    if (orders.length === 0) {
      message.warning('Không có đơn hàng trong khoảng thời gian này!');
      return;
    }

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

    // Group by store
    const storeStats = {};
    orders.forEach(order => {
      const storeName = order.storeName || 'Không xác định';
      
      // Calculate import cost for this order
      let orderImportCost = 0;
      if (order.items && Array.isArray(order.items)) {
        orderImportCost = order.items.reduce((sum, item) => 
          sum + ((parseFloat(item.importPrice) || 0) * (parseFloat(item.quantity) || 0)), 0
        );
      }
      
      if (!storeStats[storeName]) {
        storeStats[storeName] = {
          orderCount: 0,
          revenue: 0,
          importCost: 0,
          profit: 0,
          orders: []
        };
      }
      storeStats[storeName].orderCount += 1;
      storeStats[storeName].revenue += parseFloat(order.totalAmount) || 0;
      storeStats[storeName].importCost += orderImportCost;
      storeStats[storeName].profit += parseFloat(order.totalProfit || order.profit) || 0;
      storeStats[storeName].orders.push(order);
    });

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
        typeStats[type] = { count: 0, revenue: 0, importCost: 0 };
      }
      typeStats[type].count += 1;
      typeStats[type].revenue += parseFloat(order.totalAmount) || 0;
      typeStats[type].importCost += orderImportCost;
    });

    setInvoiceData({
      totalRevenue,
      totalImportCost,
      totalProfit,
      totalOrders,
      productList,
      storeStats,
      typeStats,
      dateRange: {
        start: dateRange[0].format('DD/MM/YYYY'),
        end: dateRange[1].format('DD/MM/YYYY')
      }
    });

    message.success('Đã tạo hóa đơn toàn bộ thành công!');
  };

  // Print invoice
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
          <title>Hóa Đơn Tổng Hợp - ${invoiceData.dateRange.start} đến ${invoiceData.dateRange.end}</title>
          <style>
              body {
                  font-family: Arial, sans-serif;
                  margin: 0;
                  padding: 20px;
                  background: white;
                  font-size: 14px;
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
                  <span class="invoice-title">HÓA ĐƠN TỔNG HỢP</span>
              </div>
              
              <div class="subtitle">TẤT CẢ CỬA HÀNG</div>
              
              <div class="info-section">
                  <div class="info-left">
                      <div class="info-row">
                          <span class="info-label">Loại báo cáo:</span>
                          <span>Toàn bộ cửa hàng</span>
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

    invoiceHTML += `
                  </tbody>
              </table>
              
              <div style="text-align: right; margin-top: 20px; padding: 15px; background-color: #e8f5e8;">
                  <div style="font-size: 18px; font-weight: bold; color: #333;">
                      TỔNG CỘNG: ${formatCurrency(invoiceData.totalImportCost)}
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
            <FileTextOutlined style={{ fontSize: 18, color: '#0f9d58',fontWeight: 600}} />
          </div>
          <div>
            <Title level={2} style={{ margin: 0, color: 'rgb(8 125 68)', fontWeight: 'bold', fontSize: 23 }}>
              Hóa Đơn Toàn Bộ
            </Title>
            <Text type="secondary">Xem và in hóa đơn tổng hợp cho tất cả cửa hàng</Text>
          </div>
        </div>
      </div>

      <div
        style={{
          background: '#fff',
          padding: '24px',
          borderRadius: 12,
          boxShadow: '0 10px 30px rgba(15, 157, 88, 0.08)'
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>

          {/* Date Range Selection */}
          <Card size="small" style={{ background: '#f5f7fa' }}>
            <Space direction="vertical" size="middle" style={{ width: '100%' }}>
              <Title level={5}>
                <CalendarOutlined style={{ marginRight: 8 }} />
                Chọn Khoảng Thời Gian
              </Title>
              <Space size="large">
                <RangePicker
                  value={dateRange}
                  onChange={(dates) => {
                    setDateRange(dates);
                    if (invoiceData) {
                      setInvoiceData(null); // Reset invoice when date changes
                      message.info('Đã reset hóa đơn. Vui lòng bấm "Tạo Hóa Đơn" để tạo lại.');
                    }
                  }}
                  format="DD/MM/YYYY"
                  placeholder={['Từ ngày', 'Đến ngày']}
                  style={{ width: 300 }}
                />
                <Button
                  type="primary"
                  icon={<ReloadOutlined />}
                  onClick={resetAll}
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
                    // Create payment invoice data
                    onClick={() => {
                      const paymentInvoiceData = {
                        invoiceId,
                        invoiceType: 'global_summary',
                        customerName: 'Tất cả cửa hàng',
                        storeName: 'Tất cả cửa hàng',
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
                          date: dayjs(values.paymentDate).format('DD/MM/YYYY'),
                          method: values.paymentMethod,
                          notes: values.notes || '',
                          timestamp: new Date().toISOString()
                        }],
                        createdAt: new Date().toISOString(),
                        createdBy: 'System'
                      };
                    }}
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
              <Title level={5} style={{ marginBottom: 16 }}>Tổng Quan</Title>
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
                      valueStyle={{ color: '#048023ff' }}
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
                      valueStyle={{ color: '#048023ff' }}
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
                      valueStyle={{ color: '#048023ff' }}
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
                📋 Hóa Đơn Tổng Hợp - {invoiceData.dateRange.start} đến {invoiceData.dateRange.end}
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
                  <span style={{ fontSize: '20px', fontWeight: 'bold', color: '#333' }}>HÓA ĐƠN TỔNG HỢP</span>
                </div>
                
                <div style={{ fontSize: '14px', color: '#666', marginBottom: '20px', textAlign: 'center' }}>
                  TẤT CẢ CỬA HÀNG
                </div>
                
                {/* Info Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px', fontSize: '13px' }}>
                  <div style={{ width: '48%' }}>
                    <div style={{ display: 'flex', marginBottom: '5px' }}>
                      <span style={{ fontWeight: 'bold', width: '120px' }}>Loại báo cáo:</span>
                      <span>Toàn bộ cửa hàng</span>
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
                    {invoiceData.productList.map((product, index) => {
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
                    })}
                  </tbody>
                </table>
                  
                {/* Order Type Summary */}
                <div style={{ margin: '20px 0', padding: '15px', background: '#f9f9f9', borderRadius: '4px' }}>
                  <div style={{ display: 'grid', justifyContent: 'start', fontSize: '14px',  }}>
                    <span style={{color:'#007A33'}}>Tổng Đơn TMĐT: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(invoiceData.typeStats?.ecommerce?.importCost || 0)}</span>
                    <span style={{color:'#007A33'}}>Tổng Đơn Sỉ: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(invoiceData.typeStats?.wholesale?.importCost || 0)}</span>
                    <span style={{color:'#007A33'}}>Tổng Đơn Lẻ: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(invoiceData.typeStats?.retail?.importCost || 0)}</span>
                  </div>
                </div>
                {/* Total */}
                <div style={{ textAlign: 'right', marginTop: '20px', padding: '15px', backgroundColor: '#e8f5e8' }}>
                  <div style={{ fontSize: '18px', fontWeight: 'bold', color: '#333' }}>
                    TỔNG CỘNG: {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(invoiceData.totalImportCost)}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </Space>
      </div>
    </div>
  );
};

export default GlobalInvoice;
