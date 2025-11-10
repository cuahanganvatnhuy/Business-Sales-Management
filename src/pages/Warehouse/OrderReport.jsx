import React, { useState, useEffect } from 'react';
import { database } from '../../services/firebase.service';
import { ref, onValue } from 'firebase/database';
import {
  Card, Table, DatePicker, Select, Button, Space, Row, Col, Statistic, Radio
} from 'antd';
import {
  ShoppingCartOutlined, ShopOutlined, TeamOutlined, FileExcelOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { RangePicker } = DatePicker;
const { Option } = Select;

const OrderReport = () => {
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [orderTypeFilter, setOrderTypeFilter] = useState('ecommerce');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('all');
  const [stores, setStores] = useState([]);
  
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [usageRate, setUsageRate] = useState(100);

  // Load orders
  useEffect(() => {
    setLoading(true);
    const ordersRef = ref(database, 'salesOrders');
    const storesRef = ref(database, 'stores');
    
    onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      setOrders(data ? Object.keys(data).map(k => ({ id: k, ...data[k] })) : []);
    });
    
    onValue(storesRef, (snapshot) => {
      const data = snapshot.val();
      setStores(data ? Object.keys(data).map(k => ({ id: k, ...data[k] })) : []);
      setLoading(false);
    });
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = orders.filter(o => o.orderType === orderTypeFilter);
    
    if (dateRange && dateRange[0] && dateRange[1]) {
      filtered = filtered.filter(o => {
        const orderDate = dayjs(o.orderDate || o.createdAt);
        return orderDate.isAfter(dateRange[0].subtract(1, 'day')) && orderDate.isBefore(dateRange[1].add(1, 'day'));
      });
    }
    
    if (platformFilter !== 'all' && orderTypeFilter === 'ecommerce') {
      filtered = filtered.filter(o => o.platform === platformFilter);
    }
    
    if (storeFilter !== 'all') {
      const store = stores.find(s => s.id === storeFilter);
      filtered = filtered.filter(o => o.storeName === store?.name);
    }
    
    setFilteredOrders(filtered);
    
    const total = filtered.length;
    const quantity = filtered.reduce((sum, o) => sum + (o.quantity || 0), 0);
    const revenue = filtered.reduce((sum, o) => sum + (o.subtotal || 0), 0);
    
    setTotalOrders(total);
    setTotalQuantity(quantity);
    setTotalRevenue(revenue);
    setUsageRate(100);
  }, [orders, dateRange, orderTypeFilter, platformFilter, storeFilter, stores]);

  // Export Excel
  const exportExcel = () => {
    const data = filteredOrders.map((o, i) => ({
      'STT': i + 1,
      'Mã ĐH': o.orderId,
      'Ngày': dayjs(o.orderDate || o.createdAt).format('DD/MM/YYYY'),
      'Sản Phẩm': o.productName,
      'SKU': o.sku,
      'Số Lượng': o.quantity,
      'Đơn Vị': o.unit,
      'Giá Trị': o.subtotal,
      'Sàn': o.platform || 'N/A',
      'Cửa Hàng': o.storeName
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Báo Cáo Đơn Hàng');
    XLSX.writeFile(wb, `BaoCaoDonHang_${orderTypeFilter}_${dayjs().format('YYYYMMDD')}.xlsx`);
  };

  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      render: (_, __, index) => index + 1
    },
    {
      title: 'Mã Đơn Hàng',
      dataIndex: 'orderId',
      key: 'orderId',
      width: 150
    },
    {
      title: 'Ngày Tạo',
      key: 'date',
      width: 120,
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      render: (_, record) => dayjs(record.orderDate || record.createdAt).format('DD/MM/YYYY')
    },
    {
      title: 'Sản Phẩm',
      dataIndex: 'productName',
      key: 'productName',
      width: 200
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120
    },
    {
      title: 'SL Xuất',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 80,
      align: 'center',
      sorter: (a, b) => a.quantity - b.quantity,
      render: (qty) => <span style={{ fontWeight: 'bold' }}>{qty}</span>
    },
    {
      title: 'Đơn Vị',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
      align: 'center'
    },
    {
      title: 'Giá Trị',
      dataIndex: 'subtotal',
      key: 'subtotal',
      width: 120,
      align: 'right',
      sorter: (a, b) => a.subtotal - b.subtotal,
      render: (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value || 0)
    }
  ];

  if (orderTypeFilter === 'ecommerce') {
    columns.splice(6, 0, {
      title: 'Sàn TMĐT',
      dataIndex: 'platform',
      key: 'platform',
      width: 120,
      align: 'center',
      render: (platform) => {
        const platforms = {
          'shopee': { name: 'Shopee', color: 'orange' },
          'lazada': { name: 'Lazada', color: 'blue' },
          'tiktok': { name: 'TikTok', color: 'black' },
          'sendo': { name: 'Sendo', color: 'red' },
          'tiki': { name: 'Tiki', color: 'cyan' }
        };
        const p = platforms[platform] || { name: platform || 'N/A', color: 'default' };
        return <span style={{ color: p.color, fontWeight: 'bold' }}>{p.name}</span>;
      }
    });
  }

  columns.push({
    title: 'Cửa Hàng',
    dataIndex: 'storeName',
    key: 'storeName',
    width: 150
  });

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <Card style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShoppingCartOutlined style={{ fontSize: 32, color: '#007A33' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 24, color: '#007A33' }}>Báo Cáo Đơn Hàng</h1>
            <p style={{ margin: 0, color: '#666' }}>Báo cáo xuất kho theo đơn hàng</p>
          </div>
        </div>
      </Card>

      {/* Order Type Tabs */}
      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <Radio.Group value={orderTypeFilter} onChange={(e) => setOrderTypeFilter(e.target.value)} buttonStyle="solid">
          <Radio.Button value="ecommerce">
            <ShoppingCartOutlined /> Quản Lý Đơn Hàng TMĐT
          </Radio.Button>
          <Radio.Button value="retail">
            <ShopOutlined /> Quản Lý Đơn Hàng Lẻ
          </Radio.Button>
          <Radio.Button value="wholesale">
            <TeamOutlined /> Quản Lý Đơn Hàng Sỉ
          </Radio.Button>
        </Radio.Group>
      </Card>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
            <Statistic
              title={<span style={{ color: 'white' }}>Tổng Đơn {orderTypeFilter === 'ecommerce' ? 'TMĐT' : orderTypeFilter === 'retail' ? 'Lẻ' : 'Sỉ'}</span>}
              value={totalOrders}
              valueStyle={{ color: 'white' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', color: 'white' }}>
            <Statistic
              title={<span style={{ color: 'white' }}>Số Lượng Xuất Kho</span>}
              value={totalQuantity}
              valueStyle={{ color: 'white' }}
              suffix="SP"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', color: 'white' }}>
            <Statistic
              title={<span style={{ color: 'white' }}>Giá Trị Xuất Kho</span>}
              value={totalRevenue}
              valueStyle={{ color: 'white' }}
              formatter={(value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', color: 'white' }}>
            <Statistic
              title={<span style={{ color: 'white' }}>% Sử Dụng Kho</span>}
              value={usageRate}
              valueStyle={{ color: 'white' }}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      {/* Filters & Report */}
      <Card title={`Bộ Lọc Thống Kê - Đơn Hàng ${orderTypeFilter === 'ecommerce' ? 'TMĐT' : orderTypeFilter === 'retail' ? 'Lẻ' : 'Sỉ'}`} style={{ marginBottom: 24, borderRadius: 12 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
              />
            </Col>
            {orderTypeFilter === 'ecommerce' && (
              <Col xs={24} md={6}>
                <Select
                  placeholder="Sàn TMĐT"
                  value={platformFilter}
                  onChange={setPlatformFilter}
                  style={{ width: '100%' }}
                >
                  <Option value="all">Tất cả sàn</Option>
                  <Option value="shopee">Shopee</Option>
                  <Option value="lazada">Lazada</Option>
                  <Option value="tiktok">TikTok</Option>
                  <Option value="sendo">Sendo</Option>
                  <Option value="tiki">Tiki</Option>
                </Select>
              </Col>
            )}
            <Col xs={24} md={orderTypeFilter === 'ecommerce' ? 6 : 8}>
              <Select
                placeholder="Cửa hàng"
                value={storeFilter}
                onChange={setStoreFilter}
                style={{ width: '100%' }}
              >
                <Option value="all">Tất cả cửa hàng</Option>
                {stores.map(store => (
                  <Option key={store.id} value={store.id}>{store.name}</Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} md={orderTypeFilter === 'ecommerce' ? 4 : 8}>
              <Button
                type="primary"
                icon={<FileExcelOutlined />}
                onClick={exportExcel}
                style={{ width: '100%', background: '#52c41a', borderColor: '#52c41a' }}
              >
                Xuất Excel
              </Button>
            </Col>
          </Row>

          <Table
            columns={columns}
            dataSource={filteredOrders}
            rowKey="id"
            loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            scroll={{ x: 1400 }}
          />
        </Space>
      </Card>
    </div>
  );
};

export default OrderReport;
