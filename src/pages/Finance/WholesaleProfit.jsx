import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  DatePicker,
  Select,
  Space,
  Statistic,
  Row,
  Col,
  Typography,
  Tag,
  Button
} from 'antd';
import {
  TeamOutlined,
  DollarOutlined,
  FileExcelOutlined,
  EyeOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { database } from '../../services/firebase.service';
import { ref, onValue } from 'firebase/database';
import * as XLSX from 'xlsx';
import { useAuth } from '../../contexts/AuthContext';
import ExternalCostSettings from './components/ExternalCostSettings';
import RetailOrderDetailModal from './components/RetailOrderDetailModal';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title, Text } = Typography;

const WholesaleProfit = () => {
  const { user, isAdmin } = useAuth();
  const hasPermission = isAdmin || (user?.permissions || []).includes('finance.profit.wholesale.view');

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Lợi Nhuận Đơn Sỉ. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [stores, setStores] = useState([]);
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'days'), dayjs()]);
  const [selectedStore, setSelectedStore] = useState('all');
  const [statistics, setStatistics] = useState({
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    totalExternalCost: 0
  });
  const [externalCostSettings, setExternalCostSettings] = useState({});
  const [showExternalSettings, setShowExternalSettings] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    loadStores();
    loadOrders();
  }, []);

  useEffect(() => {
    const externalRef = ref(database, 'wholesaleExternalCostSettings');
    onValue(externalRef, (snapshot) => {
      setExternalCostSettings(snapshot.val() || {});
    });
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, dateRange, selectedStore, externalCostSettings]);

  useEffect(() => {
    calculateStatistics();
  }, [filteredOrders]);

  const loadStores = () => {
    const storesRef = ref(database, 'stores');
    onValue(storesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const storesArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setStores(storesArray);
      }
    });
  };

  const loadOrders = () => {
    setLoading(true);
    const ordersRef = ref(database, 'salesOrders');
    onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const ordersArray = Object.keys(data)
          .map(key => {
            const order = { id: key, ...data[key] };
            const isWholesaleOrder =
              order.orderType === 'wholesale' ||
              order.platform === 'wholesale' ||
              order.source === 'wholesale_sales' ||
              (order.orderId && order.orderId.includes('WHOLESALE'));
            if (!isWholesaleOrder) return null;

            if (order.items && Array.isArray(order.items) && order.items.length > 0) {
              const totalQuantity = order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
              const totalAmount = order.totalAmount || order.items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
              const totalImportCost = order.items.reduce(
                (sum, item) => sum + ((Number(item.importPrice) || 0) * (Number(item.quantity) || 0)),
                0
              );
              const productNames = order.items.map(item => item.productName).join(', ');

              return {
                ...order,
                productName: productNames,
                quantity: totalQuantity,
                totalAmount,
                importCost: totalImportCost
              };
            }

            return {
              ...order,
              quantity: order.quantity || order.items?.length || 1,
              totalAmount: order.totalAmount || Number(order.sellingPrice) || 0,
              importCost: order.importCost || ((Number(order.importPrice) || 0) * (order.quantity || 1))
            };
          })
          .filter(Boolean);
        setOrders(ordersArray);
      } else {
        setOrders([]);
      }
      setLoading(false);
    });
  };

  const getStoreKey = (order) =>
    order.storeId ||
    order.store ||
    order.storeKey ||
    order.storeName ||
    '';

  const calculateExternalCosts = (order, revenue) => {
    const storeKey = getStoreKey(order);
    const storeConfigs = externalCostSettings?.[storeKey];
    if (!storeConfigs) return { totalExternalCost: 0, breakdown: {} };

    const breakdown = {};
    const addCost = (key, config) => {
      if (!config || config.enabled !== true) return;
      const value = parseFloat(config.value) || 0;
      if (!value) return;
      const amount = config.type === 'percentage'
        ? (revenue * value) / 100
        : value;
      breakdown[key] = (breakdown[key] || 0) + amount;
    };

    if (storeConfigs.costConfigs) {
      Object.entries(storeConfigs.costConfigs).forEach(([key, config]) => addCost(key, config));
    }

    if (storeConfigs.customCosts) {
      storeConfigs.customCosts.forEach(custom => addCost(custom.label || custom.key, custom));
    }

    const totalExternalCost = Object.values(breakdown).reduce(
      (sum, value) => sum + (parseFloat(value) || 0),
      0
    );

    return { totalExternalCost, breakdown };
  };

  const enhanceOrderWithCosts = (order) => {
    const revenue = parseFloat(order.totalAmount) || 0;
    const importCost = Math.abs(parseFloat(order.importCost) || 0);
    const { totalExternalCost, breakdown } = calculateExternalCosts(order, revenue);
    const totalCost = importCost + totalExternalCost;
    const profit = revenue - totalCost;
    const profitMargin = revenue > 0 ? (profit / revenue) * 100 : 0;

    return {
      ...order,
      revenue,
      importCost,
      externalCost: totalExternalCost,
      totalCost,
      profit,
      profitMargin,
      externalCostBreakdown: breakdown
    };
  };

  const filterOrders = () => {
    let filtered = orders
      .filter(order => {
        const orderDate = dayjs(order.orderDate || order.createdAt);
        const inDateRange = orderDate.isValid()
          ? orderDate.isBetween(dateRange[0], dateRange[1], 'day', '[]')
          : true;
        const storeKey = getStoreKey(order);
        const matchStore = selectedStore === 'all' || storeKey === selectedStore;
        return inDateRange && matchStore;
      })
      .map(enhanceOrderWithCosts);
    setFilteredOrders(filtered);
  };

  const calculateStatistics = () => {
    const totalRevenue = filteredOrders.reduce((sum, order) => 
      sum + (parseFloat(order.revenue) || 0), 0
    );
    const totalCost = filteredOrders.reduce((sum, order) => 
      sum + (parseFloat(order.totalCost) || (parseFloat(order.importCost) || 0)), 0
    );
    const totalExternalCost = filteredOrders.reduce((sum, order) =>
      sum + (parseFloat(order.externalCost) || 0), 0
    );
    const totalProfit = filteredOrders.reduce((sum, order) =>
      sum + (parseFloat(order.profit) || 0), 0
    );

    setStatistics({ totalRevenue, totalCost, totalProfit, totalExternalCost });
  };

  const exportToExcel = () => {
    const exportData = filteredOrders.map(order => ({
      'Mã đơn': order.orderId || order.id,
      'Ngày': dayjs(order.orderDate || order.createdAt).format('DD/MM/YYYY'),
      'Khách hàng': order.customerName || '',
      'Cửa hàng': order.storeName || '',
      'Sản phẩm': order.productName || '',
      'Số lượng': order.quantity || 0,
      'Doanh thu (₫)': order.revenue || order.totalAmount || 0,
      'Chi phí nhập (₫)': order.importCost || 0,
      'Chi phí bên ngoài (₫)': order.externalCost || 0,
      'Tổng chi phí (₫)': order.totalCost || 0,
      'Lợi nhuận (₫)': order.profit || ((order.totalAmount || 0) - (order.importCost || 0)),
      'Tỷ lệ LN %': order.revenue > 0 ?
        (((order.profit || 0) / order.revenue) * 100).toFixed(2) : 0
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lợi nhuận Bán Sỉ');
    XLSX.writeFile(wb, `loi-nuan-ban-si-${dayjs().format('YYYY-MM-DD')}.xlsx`);
  };

  const columns = [
    {
      title: 'Mã đơn',
      dataIndex: 'orderId',
      key: 'orderId',
      width: 150,
      render: (text, record) => text || record.id
    },
    {
      title: 'Ngày',
      dataIndex: 'orderDate',
      key: 'orderDate',
      width: 120,
      render: (date, record) => dayjs(date || record.createdAt).format('DD/MM/YYYY')
    },
    {
      title: 'Khách hàng',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 200,
      ellipsis: true
    },
    {
      title: 'Cửa hàng',
      dataIndex: 'storeName',
      key: 'storeName',
      width: 150
    },
    {
      title: 'Sản phẩm',
      dataIndex: 'productName',
      key: 'productName',
      ellipsis: true
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'center'
    },
    {
      title: 'Doanh thu',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 150,
      align: 'right',
      render: (amount) => (
        <Text strong style={{ color: '#1890ff' }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0)}
        </Text>
      )
    },
    {
      title: 'Chi phí nhập',
      dataIndex: 'importCost',
      key: 'importCost',
      width: 150,
      align: 'right',
      render: (cost) => (
        <Text style={{ color: '#fa541c' }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(cost || 0)}
        </Text>
      )
    },
    {
      title: 'Chi phí bên ngoài',
      dataIndex: 'externalCost',
      key: 'externalCost',
      width: 160,
      align: 'right',
      render: (cost) => (
        <Text style={{ color: '#ff7a45' }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(cost || 0)}
        </Text>
      )
    },
    {
      title: 'Tổng chi phí',
      dataIndex: 'totalCost',
      key: 'totalCost',
      width: 160,
      align: 'right',
      render: (cost) => (
        <Text strong style={{ color: '#ff4d4f' }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(cost || 0)}
        </Text>
      )
    },
    {
      title: 'Lợi nhuận',
      key: 'profit',
      width: 150,
      align: 'right',
      render: (_, record) => {
        const profit = record.profit || ((record.revenue || 0) - (record.totalCost || 0));
        return (
          <Text strong style={{ color: profit >= 0 ? '#52c41a' : '#ff4d4f' }}>
            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(profit)}
          </Text>
        );
      }
    },
    {
      title: 'Tỷ lệ LN',
      key: 'profitMargin',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const margin = record.profitMargin || 0;
        return (
          <Tag color={margin >= 30 ? 'green' : margin >= 15 ? 'orange' : 'red'}>
            {margin.toFixed(1)}%
          </Tag>
        );
      }
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 110,
      align: 'center',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => {
            setSelectedOrder(record);
            setDetailVisible(true);
          }}
        >
          Xem
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      {/* Page Header */}
      <div style={{ 
        background: 'white', 
        padding: '16px 24px', 
        marginBottom: '24px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <TeamOutlined style={{ fontSize: '24px', color: '#127e03ff' }} />
          <Title level={2} style={{ margin: 0, color: '#127e03ff' ,fontWeight: 'bold'}}>Lợi Nhuận Đơn Sỉ</Title>
        </div>
        <Text type="secondary">Phân tích lợi nhuận từ các đơn hàng bán sỉ</Text>
      </div>

      <div style={{ background: 'white', padding: '24px', borderRadius: '8px' }}>

      <Card style={{ marginBottom: 24 }}>
        <Space size="large" wrap>
          <div>
            <Text strong>Thời gian: </Text>
            <RangePicker value={dateRange} onChange={setDateRange} format="DD/MM/YYYY" />
          </div>
          <div>
            <Text strong>Cửa hàng: </Text>
            <Select value={selectedStore} onChange={setSelectedStore} style={{ width: 240 }}>
              <Option value="all">Tất cả cửa hàng</Option>
              {stores.map(store => (
                <Option key={store.id} value={store.id}>
                  {store.name || store.storeName}
                </Option>
              ))}
            </Select>
          </div>
          <Button onClick={() => setShowExternalSettings(true)}>
            Cài Đặt Chi Phí
          </Button>
          <Button icon={<FileExcelOutlined />} onClick={exportToExcel} type="primary">
            Xuất Excel
          </Button>
        </Space>
      </Card>

      <ExternalCostSettings
        visible={showExternalSettings}
        onClose={() => setShowExternalSettings(false)}
        selectedStore={selectedStore}
        onSave={() => {}}
        firebasePath="wholesaleExternalCostSettings"
      />

      <RetailOrderDetailModal
        visible={detailVisible}
        onClose={() => {
          setDetailVisible(false);
          setSelectedOrder(null);
        }}
        orderData={selectedOrder}
      />

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Tổng doanh thu"
              value={statistics.totalRevenue}
              precision={0}
              prefix={<DollarOutlined />}
              suffix="₫"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Tổng chi phí"
              value={statistics.totalCost}
              precision={0}
              suffix="₫"
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Tổng chi phí bên ngoài"
              value={statistics.totalExternalCost}
              precision={0}
              suffix="₫"
              valueStyle={{ color: '#ff7a45' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Tổng lợi nhuận"
              value={statistics.totalProfit}
              precision={0}
              suffix="₫"
              valueStyle={{ color: statistics.totalProfit >= 0 ? '#52c41a' : '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      <Card title={`Danh sách đơn hàng (${filteredOrders.length} đơn)`}>
        <Table
          columns={columns}
          dataSource={filteredOrders}
          loading={loading}
          rowKey="id"
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} đơn`
          }}
          scroll={{ x: 1500 }}
        />
      </Card>
      </div>
    </div>
  );
};

export default WholesaleProfit;
