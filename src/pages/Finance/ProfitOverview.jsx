import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  DatePicker,
  Select,
  Space,
  Typography,
  Divider,
  Table,
  Tag,
  Button,
  Tooltip
} from 'antd';
import {
  DollarOutlined,
  RiseOutlined,
  FallOutlined,
  ShoppingCartOutlined,
  ShopOutlined,
  FileExcelOutlined,
  QuestionCircleOutlined
} from '@ant-design/icons';
import { Line, Column, Pie } from '@ant-design/plots';
import dayjs from 'dayjs';
import { database } from '../../services/firebase.service';
import { useAuth } from '../../contexts/AuthContext';
import { ref, onValue } from 'firebase/database';
import * as XLSX from 'xlsx';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title, Text } = Typography;

const ProfitOverview = () => {
  const { user, isAdmin } = useAuth();
  const hasPermission = isAdmin || (user?.permissions || []).includes('finance.profit.overview.view');

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Tổng Quan Lợi Nhuận. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'days'),
    dayjs()
  ]);
  const [selectedStore, setSelectedStore] = useState('all');
  const [orders, setOrders] = useState([]);
  const [stores, setStores] = useState([]);
  const [statistics, setStatistics] = useState({
    totalRevenue: 0,
    totalCost: 0,
    totalProfit: 0,
    profitMargin: 0,
    orderCount: 0
  });
  const [channelData, setChannelData] = useState([]);
  const [retailExternalSettings, setRetailExternalSettings] = useState({});
  const [wholesaleExternalSettings, setWholesaleExternalSettings] = useState({});
  const [platformFeeSettings, setPlatformFeeSettings] = useState({});
  const [externalCostSettings, setExternalCostSettings] = useState({});
  const [packagingCostSettings, setPackagingCostSettings] = useState({});
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [filteredOrdersState, setFilteredOrdersState] = useState([]);

  const renderStatTitle = (label, description) => (
    <Space size={4}>
      <span>{label}</span>
      <Tooltip title={description} placement="top">
        <QuestionCircleOutlined style={{ color: '#999' }} />
      </Tooltip>
    </Space>
  );

  useEffect(() => {
    loadStores();
    loadOrders();
  }, []);

  useEffect(() => {
    const retailRef = ref(database, 'retailExternalCostSettings');
    const wholesaleRef = ref(database, 'wholesaleExternalCostSettings');
    const platformRef = ref(database, 'platformFeeSettings');
    const externalRef = ref(database, 'externalCostSettings');
    const packagingRef = ref(database, 'packagingCostSettings');

    onValue(retailRef, (snapshot) => {
      setRetailExternalSettings(snapshot.val() || {});
    });

    onValue(wholesaleRef, (snapshot) => {
      setWholesaleExternalSettings(snapshot.val() || {});
    });

    onValue(platformRef, (snapshot) => {
      setPlatformFeeSettings(snapshot.val() || {});
    });

    onValue(externalRef, (snapshot) => {
      setExternalCostSettings(snapshot.val() || {});
    });

    onValue(packagingRef, (snapshot) => {
      setPackagingCostSettings(snapshot.val() || {});
    });
  }, []);

  useEffect(() => {
    if (orders.length > 0) {
      calculateStatistics();
    } else {
      setFilteredOrdersState([]);
      setStatistics({
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        profitMargin: 0,
        orderCount: 0
      });
      setChannelData([]);
    }
  }, [orders, dateRange, selectedStore, selectedChannel, retailExternalSettings, wholesaleExternalSettings, platformFeeSettings, externalCostSettings, packagingCostSettings]);

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
        const ordersArray = Object.keys(data).map(key => {
          const order = { id: key, ...data[key] };
          // Chuẩn hóa doanh thu/chi phí cho đơn có nhiều sản phẩm
          if (order.items && Array.isArray(order.items) && order.items.length > 0) {
            const totalAmount = order.totalAmount ||
              order.items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
            const totalImportCost = order.importCost !== undefined
              ? Number(order.importCost) || 0
              : order.items.reduce(
                  (sum, item) => sum + ((Number(item.importPrice) || 0) * (Number(item.quantity) || 0)),
                  0
                );

            return {
              ...order,
              totalAmount,
              importCost: totalImportCost
            };
          }

          return {
            ...order,
            totalAmount: order.totalAmount || Number(order.sellingPrice) || 0,
            importCost: order.importCost !== undefined
              ? Number(order.importCost) || 0
              : (Number(order.importPrice) || 0) * (order.quantity || 1)
          };
        });
        setOrders(ordersArray);
      } else {
        setOrders([]);
      }
      setLoading(false);
    });
  };

  const isEcommerceOrder = (order) =>
    order.orderType === 'ecommerce' ||
    !!order.platform ||
    !!order.ecommercePlatform ||
    order.source === 'ecommerce' ||
    order.source === 'tmdt' ||
    order.source === 'tmdt_sales' ||
    (order.orderId && order.orderId.includes('TMDT'));

  const isRetailOrder = (order) =>
    order.orderType === 'retail' ||
    order.platform === 'retail' ||
    order.source === 'retail_sales' ||
    (order.orderId && order.orderId.includes('RETAIL'));

  const isWholesaleOrder = (order) =>
    order.orderType === 'wholesale' ||
    order.platform === 'wholesale' ||
    order.source === 'wholesale_sales' ||
    (order.orderId && order.orderId.includes('WHOLESALE'));

  const getOrderRevenue = (order) =>
    parseFloat(order.totalAmount) || 0;

  const getOrderCost = (order) =>
    parseFloat(order.importCost) || 0;

  const getOrderChannelLabel = (order) => {
    if (isEcommerceOrder(order)) return 'TMĐT';
    if (isRetailOrder(order)) return 'Bán Lẻ';
    if (isWholesaleOrder(order)) return 'Bán Sỉ';
    return 'Khác';
  };

  const getStoreKey = (order) =>
    order.storeId ||
    order.store ||
    order.storeKey ||
    order.storeName ||
    'default';

  const calculateExternalFromSettings = (settingsRoot, order, revenue) => {
    const storeKey = getStoreKey(order);
    const storeSettings = settingsRoot?.[storeKey];
    if (!storeSettings) return 0;

    let total = 0;

    const addCost = (config) => {
      if (!config || config.enabled !== true) return;
      const raw = parseFloat(config.value) || 0;
      if (!raw) return;
      const amount = config.type === 'percentage'
        ? (revenue * raw) / 100
        : raw;
      total += amount;
    };

    Object.values(storeSettings.costConfigs || {}).forEach(addCost);
    (storeSettings.customCosts || []).forEach(custom => addCost(custom));

    return total;
  };

  const getPlatformVariations = (platformRaw = '') => {
    const lower = platformRaw.toLowerCase();
    const variations = [platformRaw, lower];

    if (lower.includes('tiktok')) {
      variations.push('TikTok Shop', 'tiktok', 'tik tok');
    } else if (lower.includes('shopee')) {
      variations.push('Shopee');
    } else if (lower.includes('lazada')) {
      variations.push('Lazada');
    } else if (lower.includes('sendo')) {
      variations.push('Sendo');
    } else if (lower.includes('facebook') || lower.includes('fb')) {
      variations.push('Facebook Shop');
    } else if (lower.includes('zalo')) {
      variations.push('Zalo Shop');
    }

    return variations;
  };

  const getPlatformConfigs = (platformRaw, storeKey) => {
    const platformData = platformFeeSettings || {};
    const variations = getPlatformVariations(platformRaw);

    for (const name of variations) {
      if (platformData[name] && platformData[name][storeKey]) {
        const storeData = platformData[name][storeKey];
        return storeData.feeConfigs || storeData;
      }
    }
    return null;
  };

  const calculateEcommerceFees = (order, revenue) => {
    if (!isEcommerceOrder(order)) return 0;

    // If order already has totalFees calculated (from EcommerceProfit page), use it
    if (order.totalFees !== undefined && order.totalFees !== null) {
      const fees = parseFloat(order.totalFees) || 0;
      console.log('📊 Using existing totalFees from order:', { orderId: order.orderId, totalFees: fees });
      return fees;
    }

    const storeKey = getStoreKey(order);
    let totalFees = 0;

    // 1. Calculate platform fees
    const platformRaw = order.platform || order.ecommercePlatform || order.source || '';
    const platformConfigs = getPlatformConfigs(platformRaw, storeKey);
    if (platformConfigs) {
      Object.entries(platformConfigs).forEach(([key, config]) => {
        if (!config || config.enabled !== true) return;
        const value = parseFloat(config.value) || 0;
        if (!value) return;
        const amount = config.type === 'percentage'
          ? (revenue * value) / 100
          : value;
        totalFees += amount;
      });
    }

    // 2. Calculate external costs
    const externalConfigs = externalCostSettings?.[storeKey];
    if (externalConfigs) {
      const costs = externalConfigs.costConfigs || externalConfigs;
      Object.entries(costs || {}).forEach(([key, config]) => {
        if (typeof config === 'object') {
          if (!config.enabled) return;
          const amount = parseFloat(config.value) || 0;
          totalFees += amount;
        } else if (config) {
          totalFees += parseFloat(config) || 0;
        }
      });
    }

    // 3. Calculate packaging costs
    const packagingConfigs = packagingCostSettings?.[storeKey];
    if (packagingConfigs) {
      Object.values(packagingConfigs).forEach(packages => {
        if (Array.isArray(packages)) {
          packages.forEach(pkg => {
            if (pkg && pkg.cost) {
              totalFees += parseFloat(pkg.cost) || 0;
            }
          });
        } else if (typeof packages === 'object' && packages !== null) {
          Object.values(packages).forEach(pkg => {
            if (pkg && pkg.cost) {
              totalFees += parseFloat(pkg.cost) || 0;
            }
          });
        }
      });
    }

    return totalFees;
  };

const calculateNetForOrder = (order) => {
  const revenue = getOrderRevenue(order);
  const baseCost = getOrderCost(order);
  let extraCost = 0;
  let platformFees = 0;

  if (isEcommerceOrder(order)) {
    // Calculate all fees for ecommerce orders (platform fees + external costs + packaging costs)
    platformFees = calculateEcommerceFees(order, revenue);
  } else if (isRetailOrder(order)) {
    extraCost = calculateExternalFromSettings(retailExternalSettings, order, revenue);
  } else if (isWholesaleOrder(order)) {
    extraCost = calculateExternalFromSettings(wholesaleExternalSettings, order, revenue);
  }

  // Net profit = revenue - base cost - extra cost - platform fees
  const netProfit = revenue - baseCost - extraCost - platformFees;

  if (isEcommerceOrder(order)) {
    console.log('📦 Ecommerce order calculated:', {
      orderId: order.orderId,
      revenue,
      baseCost,
      platformFees,
      netProfit,
      grossProfit: revenue - baseCost
    });
  }

  return {
    ...order,
    revenue,
    baseCost,
    extraCost,
    platformFees,
    netProfit
  };
};

  const calculateStatistics = () => {
    // Filter orders by date range, store and channel
    let filteredOrders = orders
      .filter(order => {
        const orderDate = dayjs(order.orderDate || order.createdAt);
        const inDateRange = orderDate.isBetween(dateRange[0], dateRange[1], 'day', '[]');
        const matchStore = selectedStore === 'all' || order.storeId === selectedStore;
        const isChannelOrder = isEcommerceOrder(order) || isRetailOrder(order) || isWholesaleOrder(order);
        let matchChannel = true;
        if (selectedChannel === 'ecommerce') matchChannel = isEcommerceOrder(order);
        else if (selectedChannel === 'retail') matchChannel = isRetailOrder(order);
        else if (selectedChannel === 'wholesale') matchChannel = isWholesaleOrder(order);

        return inDateRange && matchStore && isChannelOrder && matchChannel;
      })
      .map(calculateNetForOrder);

    setFilteredOrdersState(filteredOrders);

    // Calculate statistics
    let totalRevenue = 0;
    let totalProfit = 0;

    filteredOrders.forEach(order => {
      totalRevenue += order.revenue;
      totalProfit += order.netProfit;
    });

    const totalCost = filteredOrders.reduce((sum, order) => {
      return sum + order.baseCost + order.extraCost + (order.platformFees || 0);
    }, 0);
    const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    setStatistics({
      totalRevenue,
      totalCost,
      totalProfit,
      profitMargin,
      orderCount: filteredOrders.length
    });

    // Calculate channel data
    const ecommerceOrders = filteredOrders.filter(isEcommerceOrder);
    const retailOrders = filteredOrders.filter(isRetailOrder);
    const wholesaleOrders = filteredOrders.filter(isWholesaleOrder);

    const calculateChannelNetProfit = (orders, type) => {
      return orders.reduce((sum, o) => {
        // All channels now use netProfit which includes all costs
        return sum + o.netProfit;
      }, 0);
    };

    setChannelData([
      { channel: 'Thương Mại Điện Tử ', profit: calculateChannelNetProfit(ecommerceOrders, 'ecommerce'), count: ecommerceOrders.length },
      { channel: 'Bán Lẻ', profit: calculateChannelNetProfit(retailOrders, 'retail'), count: retailOrders.length },
      { channel: 'Bán Sỉ', profit: calculateChannelNetProfit(wholesaleOrders, 'wholesale'), count: wholesaleOrders.length }
    ]);
  };

  const channelColumns = [
    {
      title: 'Kênh bán',
      dataIndex: 'channel',
      key: 'channel',
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'Số đơn',
      dataIndex: 'count',
      key: 'count',
      render: (count) => <Tag color="blue">{count} đơn</Tag>
    },
    {
      title: 'Lợi nhuận',
      dataIndex: 'profit',
      key: 'profit',
      align: 'right',
      render: (profit) => (
        <Text strong style={{ color: profit >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(profit)}
        </Text>
      )
    }
  ];

  const exportReport = () => {
    if (!filteredOrdersState.length) {
      XLSX.utils.book_new(); // tạo file trống để Excel không báo lỗi
      return;
    }

    const exportData = filteredOrdersState.map(order => ({
      'Kênh bán': getOrderChannelLabel(order),
      'Mã đơn': order.orderId || order.id,
      'Ngày': dayjs(order.orderDate || order.createdAt).format('DD/MM/YYYY'),
      'Cửa hàng': order.storeName || '',
      'Doanh thu (₫)': order.revenue,
      'Chi phí hàng hóa (₫)': order.baseCost,
      'Chi phí bổ sung (₫)': order.extraCost,
      'Lợi nhuận ròng (₫)': order.netProfit
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Tong-quan-loi-nhuan');
    XLSX.writeFile(wb, `tong-quan-loi-nhuan-${dayjs().format('YYYY-MM-DD')}.xlsx`);
  };

  const pieConfig = {
    data: channelData,
    angleField: 'profit',
    colorField: 'channel',
    radius: 0.8,
    label: {
      type: 'outer',
      content: '{name} {percentage}'
    },
    interactions: [{ type: 'element-active' }]
  };

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
          <RiseOutlined style={{ fontSize: '24px', color: '#127e03ff' }} />
          <Title level={2} style={{ margin: 0, color: '#127e03ff' ,fontWeight: 'bold'}}>Tổng Quan Lợi Nhuận</Title>
        </div>
        <Text type="secondary">Theo dõi tổng quan lợi nhuận từ tất cả các kênh bán hàng</Text>
      </div>

      <div style={{ background: 'white', padding: '24px', borderRadius: '8px' }}>

      {/* Filters */}
      <Card style={{ marginBottom: 24 }}>
        <Space size="large" wrap>
          <div>
            <Text strong>Thời gian: </Text>
            <RangePicker
              value={dateRange}
              onChange={setDateRange}
              format="DD/MM/YYYY"
            />
          </div>
          <div>
            <Text strong>Cửa hàng: </Text>
            <Select
              value={selectedStore}
              onChange={setSelectedStore}
              style={{ width: 200 }}
            >
              <Option value="all">Tất cả cửa hàng</Option>
              {stores.map(store => (
                <Option key={store.id} value={store.id}>
                  {store.name || store.storeName}
                </Option>
              ))}
            </Select>
          </div>
          <div>
            <Text strong>Kênh bán: </Text>
            <Select
              value={selectedChannel}
              onChange={setSelectedChannel}
              style={{ width: 200 }}
            >
              <Option value="all">Tất cả kênh</Option>
              <Option value="ecommerce">Đơn TMĐT</Option>
              <Option value="retail">Đơn Bán Lẻ</Option>
              <Option value="wholesale">Đơn Bán Sỉ</Option>
            </Select>
          </div>
          <Button
            type="primary"
            icon={<FileExcelOutlined />}
            onClick={exportReport}
          >
            Xuất báo cáo
          </Button>
        </Space>
      </Card>

      {/* Summary Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title={renderStatTitle('Tổng doanh thu', 'Tổng tiền bán hàng đã ghi nhận trong phạm vi thời gian và bộ lọc hiện tại.')}
              value={statistics.totalRevenue}
              precision={0}
              valueStyle={{ color: '#1890ff' }}
              prefix={<DollarOutlined />}
              suffix="₫"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title={renderStatTitle('Tổng chi phí', 'Bao gồm giá nhập hàng, phí sàn TMĐT và mọi chi phí bên ngoài/đóng gói được cấu hình.')}
              value={statistics.totalCost}
              precision={0}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<ShoppingCartOutlined />}
              suffix="₫"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Lợi nhuận"
              value={statistics.totalProfit}
              precision={0}
              valueStyle={{ color: statistics.totalProfit >= 0 ? '#52c41a' : '#ff4d4f' }}
              prefix={<RiseOutlined />}
              suffix="₫"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Tỷ suất lợi nhuận"
              value={statistics.profitMargin}
              precision={2}
              valueStyle={{ color: statistics.profitMargin >= 0 ? '#52c41a' : '#ff4d4f' }}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        {/* Channel Distribution */}
        <Col span={12}>
          <Card title="Phân bổ lợi nhuận theo kênh">
            <Pie {...pieConfig} />
          </Card>
        </Col>

        {/* Channel Table */}
        <Col span={12}>
          <Card title="Chi tiết theo kênh">
            <Table
              columns={channelColumns}
              dataSource={channelData}
              pagination={false}
              loading={loading}
            />
          </Card>
        </Col>
      </Row>
      </div>
    </div>
  );
};

export default ProfitOverview;
