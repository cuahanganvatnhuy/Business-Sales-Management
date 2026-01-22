import React, { useState, useEffect } from 'react';
import { database } from '../../services/firebase.service';
import { ref, onValue } from 'firebase/database';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  Card, Row, Col, Select, DatePicker, Button, Table, Statistic,
  Tag, Space, Radio, message
} from 'antd';
import {
  BarChartOutlined, GlobalOutlined, ShopOutlined, ShoppingCartOutlined,
  DollarOutlined, LineChartOutlined, TrophyOutlined, TeamOutlined,
  UserAddOutlined, UserOutlined, ShoppingOutlined, BoxPlotOutlined,
  FileExcelOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { RangePicker } = DatePicker;
const { Option } = Select;

const Reports = () => {
  const { user, isAdmin } = useAuth();
  const hasPermission = isAdmin || (user?.permissions || []).includes('reports.view');

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Báo Cáo. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  const { stores } = useStore();
  const [reportType, setReportType] = useState('global');
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [reportData, setReportData] = useState({
    totalOrders: 0, totalRevenue: 0, averageOrder: 0, totalStores: 0,
    topProducts: [], storePerformance: [],
    todayStats: { orders: 0, revenue: 0 },
    weekStats: { orders: 0, revenue: 0 },
    monthStats: { orders: 0, revenue: 0 },
    customerStats: { new: 0, returning: 0, avgValue: 0 },
    inventoryStats: []
  });

  useEffect(() => {
    const ordersRef = ref(database, 'salesOrders');
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      setOrders(data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : []);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const productsRef = ref(database, 'sellingProducts');
    const unsubscribe = onValue(productsRef, (snapshot) => {
      const data = snapshot.val();
      setProducts(data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : []);
    });
    return () => unsubscribe();
  }, []);

  const generateReport = () => {
    setLoading(true);
    try {
      let filteredOrders = [...orders];
      if (dateRange && dateRange[0] && dateRange[1]) {
        filteredOrders = filteredOrders.filter(order => {
          const orderDate = dayjs(order.orderDate || order.createdAt);
          return (orderDate.isAfter(dateRange[0].subtract(1, 'day')) && orderDate.isBefore(dateRange[1].add(1, 'day')));
        });
      }
      if (reportType === 'store' && selectedStoreId) {
        const store = stores.find(s => s.id === selectedStoreId);
        if (store) filteredOrders = filteredOrders.filter(order => order.storeName === store.name);
      }

      const totalOrders = filteredOrders.length;
      const totalRevenue = filteredOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
      const averageOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      const productSales = {};
      filteredOrders.forEach(order => {
        // Skip orders without product info
        if (!order.productName && !order.productId) return;
        
        const productId = order.productId || order.productName;
        if (!productSales[productId]) {
          productSales[productId] = { 
            productName: order.productName || 'N/A', 
            sku: order.sku || 'N/A', 
            quantity: 0, 
            revenue: 0 
          };
        }
        productSales[productId].quantity += order.quantity || 0;
        productSales[productId].revenue += order.subtotal || 0;
      });
      const topProducts = Object.values(productSales)
        .filter(p => p.productName && p.productName !== 'N/A') // Only valid products
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      const storePerformance = [];
      if (reportType === 'global') {
        const storeStats = {};
        filteredOrders.forEach(order => {
          const storeName = order.storeName || 'N/A';
          if (!storeStats[storeName]) storeStats[storeName] = { storeName, orders: 0, revenue: 0 };
          storeStats[storeName].orders += 1;
          storeStats[storeName].revenue += order.subtotal || 0;
        });
        Object.values(storeStats).forEach(stat => {
          storePerformance.push({ ...stat, averageOrder: stat.orders > 0 ? stat.revenue / stat.orders : 0 });
        });
        storePerformance.sort((a, b) => b.revenue - a.revenue);
      }

      const today = dayjs();
      const startOfWeek = dayjs().startOf('week');
      const startOfMonth = dayjs().startOf('month');
      const todayOrders = orders.filter(o => dayjs(o.orderDate || o.createdAt).isSame(today, 'day'));
      const weekOrders = orders.filter(o => dayjs(o.orderDate || o.createdAt).isAfter(startOfWeek));
      const monthOrders = orders.filter(o => dayjs(o.orderDate || o.createdAt).isAfter(startOfMonth));
      const todayStats = { orders: todayOrders.length, revenue: todayOrders.reduce((s, o) => s + (o.subtotal || 0), 0) };
      const weekStats = { orders: weekOrders.length, revenue: weekOrders.reduce((s, o) => s + (o.subtotal || 0), 0) };
      const monthStats = { orders: monthOrders.length, revenue: monthOrders.reduce((s, o) => s + (o.subtotal || 0), 0) };

      const customers = new Set();
      const customerOrders = {};
      filteredOrders.forEach(order => {
        const customerId = order.customerId || order.customerPhone || order.customerName;
        if (customerId) {
          customers.add(customerId);
          customerOrders[customerId] = (customerOrders[customerId] || 0) + 1;
        }
      });
      const newCustomers = Object.values(customerOrders).filter(count => count === 1).length;
      const returningCustomers = Object.values(customerOrders).filter(count => count > 1).length;
      const avgCustomerValue = customers.size > 0 ? totalRevenue / customers.size : 0;
      const customerStats = { new: newCustomers, returning: returningCustomers, avgValue: avgCustomerValue };

      const inventoryStats = products.map(product => {
        const soldQuantity = filteredOrders.filter(o => o.productId === product.id || o.productName === product.productName)
          .reduce((sum, o) => sum + (o.quantity || 0), 0);
        const turnoverRate = product.inventory > 0 ? ((soldQuantity / (product.inventory + soldQuantity)) * 100).toFixed(1) : 0;
        return { ...product, soldQuantity, turnoverRate: parseFloat(turnoverRate) };
      }).sort((a, b) => b.soldQuantity - a.soldQuantity);

      setReportData({ totalOrders, totalRevenue, averageOrder, totalStores: reportType === 'global' ? stores.length : 1,
        topProducts, storePerformance, todayStats, weekStats, monthStats, customerStats, inventoryStats });
      message.success('Báo cáo đã được tạo thành công!');
    } catch (error) {
      console.error('Error:', error);
      message.error('Có lỗi khi tạo báo cáo!');
    } finally {
      setLoading(false);
    }
  };

  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const summaryData = [
      ['BÁO CÁO KINH DOANH'],
      ['Loại:', reportType === 'global' ? 'Toàn bộ' : 'Từng cửa hàng'],
      ['Từ:', dateRange[0].format('DD/MM/YYYY')],
      ['Đến:', dateRange[1].format('DD/MM/YYYY')],
      [], ['TỔNG QUAN'],
      ['Tổng đơn:', reportData.totalOrders],
      ['Doanh thu:', reportData.totalRevenue],
      ['Đơn TB:', reportData.averageOrder]
    ];
    const ws = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, ws, 'Tổng quan');
    if (reportData.topProducts.length > 0) {
      const topData = [['STT', 'Sản phẩm', 'SKU', 'SL bán', 'Doanh thu'],
        ...reportData.topProducts.map((p, i) => [i + 1, p.productName, p.sku, p.quantity, p.revenue])];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(topData), 'Top SP');
    }
    XLSX.writeFile(wb, `BaoCao_${reportType}_${dayjs().format('YYYYMMDD')}.xlsx`);
    message.success('Đã xuất Excel!');
  };

  const formatCurrency = (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);

  const topProductsColumns = [
    { title: 'STT', key: 'stt', width: 60, align: 'center', render: (_, __, i) => i + 1 },
    { title: 'Sản Phẩm', dataIndex: 'productName', key: 'productName', width: 250 },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 120 },
    { title: 'SL Bán', dataIndex: 'quantity', key: 'quantity', width: 100, align: 'center', sorter: (a, b) => a.quantity - b.quantity },
    { title: 'Doanh Thu', dataIndex: 'revenue', key: 'revenue', width: 150, align: 'right', render: (v) => formatCurrency(v), sorter: (a, b) => a.revenue - b.revenue }
  ];

  const storeColumns = [
    { title: 'STT', key: 'stt', width: 60, align: 'center', render: (_, __, i) => i + 1 },
    { title: 'Cửa Hàng', dataIndex: 'storeName', key: 'storeName', width: 200 },
    { title: 'Đơn', dataIndex: 'orders', key: 'orders', width: 100, align: 'center', sorter: (a, b) => a.orders - b.orders },
    { title: 'Doanh Thu', dataIndex: 'revenue', key: 'revenue', width: 150, align: 'right', render: (v) => formatCurrency(v), sorter: (a, b) => a.revenue - b.revenue },
    { title: 'Đơn TB', dataIndex: 'averageOrder', key: 'averageOrder', width: 150, align: 'right', render: (v) => formatCurrency(v) }
  ];

  const inventoryColumns = [
    { title: 'STT', key: 'stt', width: 60, align: 'center', render: (_, __, i) => i + 1 },
    { title: 'Sản Phẩm', dataIndex: 'productName', key: 'productName', width: 200 },
    { title: 'SKU', dataIndex: 'sku', key: 'sku', width: 100 },
    { title: 'Tồn', dataIndex: 'inventory', key: 'inventory', width: 80, align: 'center' },
    { title: 'Đã Bán', dataIndex: 'soldQuantity', key: 'soldQuantity', width: 80, align: 'center' },
    { title: 'Tỷ Lệ LC', dataIndex: 'turnoverRate', key: 'turnoverRate', width: 100, align: 'center', render: (v) => `${v}%`, sorter: (a, b) => a.turnoverRate - b.turnoverRate },
    { title: 'TT', key: 'status', width: 100, align: 'center', render: (_, r) => r.inventory === 0 ? <Tag color="red">Hết</Tag> : r.inventory < 10 ? <Tag color="orange">Sắp hết</Tag> : <Tag color="green">Còn</Tag> }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <BarChartOutlined style={{ fontSize: 32, color: '#007A33' }} />
          <div><h1 style={{ margin: 0, fontSize: 24, color: '#007A33' }}>Báo Cáo</h1>
          <p style={{ margin: 0, color: '#666' }}>Thống kê và phân tích dữ liệu kinh doanh</p></div>
        </div>
      </Card>

      <Card title={<span><BarChartOutlined /> Loại Báo Cáo</span>} style={{ marginBottom: 24, borderRadius: 12 }}>
        <Radio.Group value={reportType} onChange={(e) => setReportType(e.target.value)} style={{ width: '100%' }}>
          <Row gutter={16}>
            <Col xs={24} md={12}>
              <Card hoverable style={{ borderColor: reportType === 'global' ? '#007A33' : '#d9d9d9', borderWidth: reportType === 'global' ? 2 : 1 }}
                onClick={() => setReportType('global')}>
                <Radio value="global">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <GlobalOutlined style={{ fontSize: 32, color: '#1890ff' }} />
                    <div><h3 style={{ margin: 0 }}>Báo Cáo Toàn Bộ</h3><p style={{ margin: 0, color: '#666' }}>Thống kê tổng hợp tất cả cửa hàng</p></div>
                  </div>
                </Radio>
              </Card>
            </Col>
            <Col xs={24} md={12}>
              <Card hoverable style={{ borderColor: reportType === 'store' ? '#007A33' : '#d9d9d9', borderWidth: reportType === 'store' ? 2 : 1 }}
                onClick={() => setReportType('store')}>
                <Radio value="store">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <ShopOutlined style={{ fontSize: 32, color: '#52c41a' }} />
                    <div><h3 style={{ margin: 0 }}>Báo Cáo Từng Cửa Hàng</h3><p style={{ margin: 0, color: '#666' }}>Thống kê chi tiết theo cửa hàng</p></div>
                  </div>
                </Radio>
              </Card>
            </Col>
          </Row>
        </Radio.Group>
      </Card>

      {reportType === 'store' && (
        <Card title={<span><ShopOutlined /> Chọn Cửa Hàng</span>} style={{ marginBottom: 24, borderRadius: 12 }}>
          <Select placeholder="-- Chọn cửa hàng --" value={selectedStoreId} onChange={setSelectedStoreId} style={{ width: '100%' }} size="large">
            {stores.map(store => <Option key={store.id} value={store.id}>🏪 {store.name}</Option>)}
          </Select>
        </Card>
      )}

      <Card title={<span><LineChartOutlined /> Khoảng Thời Gian</span>} style={{ marginBottom: 24, borderRadius: 12 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <RangePicker value={dateRange} onChange={setDateRange} style={{ width: '100%' }} size="large" format="DD/MM/YYYY" />
          <Button type="primary" icon={<BarChartOutlined />} size="large" onClick={generateReport} loading={loading}
            disabled={reportType === 'store' && !selectedStoreId} style={{ width: '100%', height: 48 }}>Tạo Báo Cáo</Button>
        </Space>
      </Card>

      {reportData.totalOrders > 0 && (
        <>
          <Card title={<span><BarChartOutlined /> Tổng Quan</span>} style={{ marginBottom: 24, borderRadius: 12 }}>
            <Row gutter={16}>
              <Col xs={24} sm={12} lg={6}><Card><Statistic title="Tổng Đơn" value={reportData.totalOrders} prefix={<ShoppingCartOutlined style={{ color: '#1890ff' }} />} valueStyle={{ color: '#1890ff' }} /></Card></Col>
              <Col xs={24} sm={12} lg={6}><Card><Statistic title="Doanh Thu" value={reportData.totalRevenue} prefix={<DollarOutlined style={{ color: '#52c41a' }} />} valueStyle={{ color: '#52c41a' }} formatter={(v) => formatCurrency(v)} /></Card></Col>
              <Col xs={24} sm={12} lg={6}><Card><Statistic title="Đơn TB" value={reportData.averageOrder} prefix={<LineChartOutlined style={{ color: '#faad14' }} />} valueStyle={{ color: '#faad14' }} formatter={(v) => formatCurrency(v)} /></Card></Col>
              <Col xs={24} sm={12} lg={6}><Card><Statistic title="Cửa Hàng" value={reportData.totalStores} prefix={<ShopOutlined style={{ color: '#722ed1' }} />} valueStyle={{ color: '#722ed1' }} /></Card></Col>
            </Row>
          </Card>

          <Card title={<span><TrophyOutlined /> Sản Phẩm Bán Chạy</span>} style={{ marginBottom: 24, borderRadius: 12 }}>
            <Table columns={topProductsColumns} dataSource={reportData.topProducts} rowKey={(r, i) => i} pagination={false} scroll={{ x: 800 }} />
          </Card>

          {reportType === 'global' && reportData.storePerformance.length > 0 && (
            <Card title={<span><ShopOutlined /> Hiệu Suất Cửa Hàng</span>} style={{ marginBottom: 24, borderRadius: 12 }}>
              <Table columns={storeColumns} dataSource={reportData.storePerformance} rowKey="storeName" pagination={false} scroll={{ x: 800 }} />
            </Card>
          )}

          <Card title={<span><LineChartOutlined /> Phân Tích Theo Thời Gian</span>} style={{ marginBottom: 24, borderRadius: 12 }}>
            <Row gutter={16}>
              <Col xs={24} md={8}><Card style={{ background: '#f0f9ff', borderColor: '#1890ff' }}>
                <Statistic title="Hôm Nay" value={reportData.todayStats.orders} suffix="đơn" valueStyle={{ fontSize: 24, fontWeight: 'bold' }} />
                <div style={{ marginTop: 8, fontSize: 14, color: '#666' }}>DT: {formatCurrency(reportData.todayStats.revenue)}</div></Card></Col>
              <Col xs={24} md={8}><Card style={{ background: '#f6ffed', borderColor: '#52c41a' }}>
                <Statistic title="Tuần Này" value={reportData.weekStats.orders} suffix="đơn" valueStyle={{ fontSize: 24, fontWeight: 'bold' }} />
                <div style={{ marginTop: 8, fontSize: 14, color: '#666' }}>DT: {formatCurrency(reportData.weekStats.revenue)}</div></Card></Col>
              <Col xs={24} md={8}><Card style={{ background: '#fff7e6', borderColor: '#faad14' }}>
                <Statistic title="Tháng Này" value={reportData.monthStats.orders} suffix="đơn" valueStyle={{ fontSize: 24, fontWeight: 'bold' }} />
                <div style={{ marginTop: 8, fontSize: 14, color: '#666' }}>DT: {formatCurrency(reportData.monthStats.revenue)}</div></Card></Col>
            </Row>
          </Card>

          <Card title={<span><TeamOutlined /> Phân Tích Khách Hàng</span>} style={{ marginBottom: 24, borderRadius: 12 }}>
            <Row gutter={16}>
              <Col xs={24} md={8}><Card><Statistic title="KH Mới" value={reportData.customerStats.new} prefix={<UserAddOutlined style={{ color: '#1890ff' }} />} valueStyle={{ color: '#1890ff' }} /></Card></Col>
              <Col xs={24} md={8}><Card><Statistic title="KH Quay Lại" value={reportData.customerStats.returning} prefix={<UserOutlined style={{ color: '#52c41a' }} />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
              <Col xs={24} md={8}><Card><Statistic title="GT TB/KH" value={reportData.customerStats.avgValue} prefix={<ShoppingOutlined style={{ color: '#faad14' }} />} valueStyle={{ color: '#faad14' }} formatter={(v) => formatCurrency(v)} /></Card></Col>
            </Row>
          </Card>

          <Card title={<span><BoxPlotOutlined /> Tồn Kho</span>} style={{ marginBottom: 24, borderRadius: 12 }}>
            <Table columns={inventoryColumns} dataSource={reportData.inventoryStats} rowKey="id" pagination={{ pageSize: 10 }} scroll={{ x: 800 }} />
          </Card>

          <Card title={<span><FileExcelOutlined /> Xuất Báo Cáo</span>} style={{ marginBottom: 24, borderRadius: 12 }}>
            <Space>
              <Button type="primary" icon={<FileExcelOutlined />} onClick={exportExcel} style={{ background: '#52c41a', borderColor: '#52c41a' }}>Xuất Excel</Button>
            </Space>
          </Card>
        </>
      )}
    </div>
  );
};

export default Reports;
