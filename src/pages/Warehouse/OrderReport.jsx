import React, { useState, useEffect } from 'react';
import { database } from '../../services/firebase.service';
import { ref, onValue } from 'firebase/database';
import { useAuth } from '../../contexts/AuthContext';
import {
  Card, Table, DatePicker, Select, Button, Space, Row, Col, Statistic, Radio, Modal, Tag, message
} from 'antd';
import {
  ShoppingCartOutlined, ShopOutlined, TeamOutlined, FileExcelOutlined, BarChartOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { RangePicker } = DatePicker;
const { Option } = Select;

const OrderReport = () => {
  const { user, isAdmin } = useAuth();
  const userPermissions = user?.permissions || [];
  const hasPermission = isAdmin || userPermissions.includes('warehouse.orderReport.view');
  const canExportReport = isAdmin || userPermissions.includes('warehouse.orderReport.export');

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Báo Cáo Đơn Hàng. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [orderTypeFilter, setOrderTypeFilter] = useState('ecommerce');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('all');
  const [unitFilter, setUnitFilter] = useState('all');
  const [stores, setStores] = useState([]);
  
  const [totalOrders, setTotalOrders] = useState(0);
  const [totalQuantity, setTotalQuantity] = useState(0);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [usageRate, setUsageRate] = useState(100);
  const [unitBreakdown, setUnitBreakdown] = useState([]);
  
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

  // Pagination state
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50', '100']
  });

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
    
    // Filter by unit (case-insensitive)
    if (unitFilter !== 'all') {
      filtered = filtered.filter(o => {
        if (!o.items || o.items.length === 0) return false;
        return o.items.some(item => 
          item.unit && item.unit.toLowerCase() === unitFilter.toLowerCase()
        );
      });
    }
    
    setFilteredOrders(filtered);
    
    // Calculate unit breakdown from ALL filtered orders (not affected by unitFilter)
    const unitStats = {};
    let filteredForBreakdown = orders.filter(o => o.orderType === orderTypeFilter);
    
    if (dateRange && dateRange[0] && dateRange[1]) {
      filteredForBreakdown = filteredForBreakdown.filter(o => {
        const orderDate = dayjs(o.orderDate || o.createdAt);
        return orderDate.isAfter(dateRange[0].subtract(1, 'day')) && orderDate.isBefore(dateRange[1].add(1, 'day'));
      });
    }
    
    if (platformFilter !== 'all' && orderTypeFilter === 'ecommerce') {
      filteredForBreakdown = filteredForBreakdown.filter(o => o.platform === platformFilter);
    }
    
    if (storeFilter !== 'all') {
      const store = stores.find(s => s.id === storeFilter);
      filteredForBreakdown = filteredForBreakdown.filter(o => o.storeName === store?.name);
    }
    
    filteredForBreakdown.forEach(o => {
      if (o.items && o.items.length > 0) {
        o.items.forEach(item => {
          const originalUnit = item.unit || 'kg';
          const unit = originalUnit.toLowerCase(); // Normalize to lowercase
          if (!unitStats[unit]) {
            // First occurrence: use original case for display
            unitStats[unit] = { unit: originalUnit, count: 0, quantity: 0 };
          }
          // Accumulate counts (merge "Gói" + "gói" into one entry)
          unitStats[unit].count += 1;
          unitStats[unit].quantity += item.quantity || 0;
        });
      }
    });
    
    const breakdown = Object.values(unitStats).sort((a, b) => b.quantity - a.quantity);
    setUnitBreakdown(breakdown);
    
    const total = filtered.length;
    const quantity = filtered.reduce((sum, o) => {
      // Use totalQuantity if exists, otherwise calculate from items
      const qty = o.totalQuantity || (o.items ? o.items.reduce((s, item) => s + (item.quantity || 0), 0) : 0);
      return sum + qty;
    }, 0);
    const revenue = filtered.reduce((sum, o) => sum + (o.totalAmount || 0), 0);
    
    setTotalOrders(total);
    setTotalQuantity(quantity);
    setTotalRevenue(revenue);
    setUsageRate(100);
  }, [orders, dateRange, orderTypeFilter, platformFilter, storeFilter, unitFilter, stores]);

  // Export Unit Report
  const exportUnitReport = () => {
    if (!canExportReport) {
      message.error('Bạn không có quyền xuất báo cáo Báo Cáo Đơn Hàng.');
      return;
    }
    // Summary data
    const summary = [{
      'Loại báo cáo': `Báo cáo xuất kho theo đơn vị - ${orderTypeFilter === 'ecommerce' ? 'TMĐT' : orderTypeFilter === 'retail' ? 'Lẻ' : 'Sỉ'}`,
      'Thời gian': `${dateRange[0].format('DD/MM/YYYY')} - ${dateRange[1].format('DD/MM/YYYY')}`,
      'Tổng đơn hàng': totalOrders,
      'Tổng giá trị': new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(totalRevenue)
    }];

    // Unit breakdown data
    const unitData = unitBreakdown.map((item, index) => ({
      'STT': index + 1,
      'Đơn vị': item.unit,
      'Số lượng xuất': item.quantity,
      'Số đơn hàng': item.count,
      'Trung bình/đơn': Math.round(item.quantity / item.count)
    }));

    // Create workbook
    const wb = XLSX.utils.book_new();
    
    // Add summary sheet
    const wsSummary = XLSX.utils.json_to_sheet(summary);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'Tổng Quan');
    
    // Add unit breakdown sheet
    const wsUnit = XLSX.utils.json_to_sheet(unitData);
    XLSX.utils.book_append_sheet(wb, wsUnit, 'Theo Đơn Vị');
    
    // Export
    XLSX.writeFile(wb, `BaoCaoTheoDoVi_${orderTypeFilter}_${dayjs().format('YYYYMMDD')}.xlsx`);
    message.success('Đã xuất báo cáo theo đơn vị!');
  };

  // Export Excel
  const exportExcel = () => {
    if (!canExportReport) {
      message.error('Bạn không có quyền xuất báo cáo Báo Cáo Đơn Hàng.');
      return;
    }
    
    const data = filteredOrders.map((o, i) => {
      const firstItem = o.items && o.items.length > 0 ? o.items[0] : {};
      const totalQty = o.totalQuantity || (o.items ? o.items.reduce((s, item) => s + (item.quantity || 0), 0) : 0);
      return {
        'STT': i + 1,
        'Mã ĐH': o.orderId,
        'Ngày': dayjs(o.orderDate || o.createdAt).format('DD/MM/YYYY'),
        'Sản Phẩm': firstItem.productName || 'N/A',
        'SKU': firstItem.sku || 'N/A',
        'Số Lượng': totalQty,
        'Đơn Vị': firstItem.unit || 'kg',
        'Giá Trị': o.totalAmount || 0,
        'Sàn': o.platform || 'N/A',
        'Cửa Hàng': o.storeName
      };
    });
    
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
      dataIndex: 'items',
      key: 'productName',
      width: 200,
      render: (items) => {
        if (!items || items.length === 0) return 'N/A';
        if (items.length === 1) return items[0].productName || 'N/A';
        return (
          <div>
            <div style={{ fontWeight: 600 }}>{items.length} sản phẩm</div>
            <div style={{ fontSize: 11, color: '#999' }}>{items[0].productName}</div>
          </div>
        );
      }
    },
    {
      title: 'SKU',
      dataIndex: 'items',
      key: 'sku',
      width: 120,
      render: (items) => {
        if (!items || items.length === 0) return 'N/A';
        return items[0].sku || 'N/A';
      }
    },
    {
      title: 'SL Xuất',
      key: 'quantity',
      width: 80,
      align: 'center',
      sorter: (a, b) => {
        const qtyA = a.totalQuantity || (a.items ? a.items.reduce((s, item) => s + (item.quantity || 0), 0) : 0);
        const qtyB = b.totalQuantity || (b.items ? b.items.reduce((s, item) => s + (item.quantity || 0), 0) : 0);
        return qtyA - qtyB;
      },
      render: (_, record) => {
        const qty = record.totalQuantity || (record.items ? record.items.reduce((s, item) => s + (item.quantity || 0), 0) : 0);
        return <span style={{ fontWeight: 'bold' }}>{qty || 0}</span>;
      }
    },
    {
      title: 'Đơn Vị',
      dataIndex: 'items',
      key: 'unit',
      width: 80,
      align: 'center',
      render: (items) => {
        if (!items || items.length === 0) return 'kg';
        return items[0].unit || 'kg';
      }
    },
    {
      title: 'Giá Trị',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 120,
      align: 'right',
      sorter: (a, b) => (a.totalAmount || 0) - (b.totalAmount || 0),
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
            <p style={{ margin: 0, color: '#666' }}>Báo cáo việc sử dụng kho của đừng loại đơn hàng</p>
          </div>
        </div>
      </Card>

      {/* Order Type Tabs */}
      {/* Tab Navigation */}
      <div style={{ 
        marginBottom: 24, 
        borderBottom: '1px solid #f0f0f0',
        background: '#fff',
        padding: '0 24px',
        borderRadius: '12px 12px 0 0'
      }}>
        <div style={{ display: 'flex', gap: 40 }}>
          <div
            onClick={() => setOrderTypeFilter('ecommerce')}
            style={{
              padding: '16px 0',
              cursor: 'pointer',
              borderBottom: orderTypeFilter === 'ecommerce' ? '3px solid #088d1eff' : '3px solid transparent',
              color: orderTypeFilter === 'ecommerce' ? '#088d1eff' : '#666',
              fontWeight: orderTypeFilter === 'ecommerce' ? 600 : 400,
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <ShoppingCartOutlined style={{ fontSize: 16 }} />
            <span>Đơn Hàng TMĐT</span>
          </div>
          <div
            onClick={() => setOrderTypeFilter('retail')}
            style={{
              padding: '16px 0',
              cursor: 'pointer',
              borderBottom: orderTypeFilter === 'retail' ? '3px solid #088d1eff' : '3px solid transparent',
              color: orderTypeFilter === 'retail' ? '#088d1eff' : '#666',
              fontWeight: orderTypeFilter === 'retail' ? 600 : 400,
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <ShopOutlined style={{ fontSize: 16 }} />
            <span>Đơn Hàng Lẻ</span>
          </div>
          <div
            onClick={() => setOrderTypeFilter('wholesale')}
            style={{
              padding: '16px 0',
              cursor: 'pointer',
              borderBottom: orderTypeFilter === 'wholesale' ? '3px solid #088d1eff' : '3px solid transparent',
              color: orderTypeFilter === 'wholesale' ? '#088d1eff' : '#666',
              fontWeight: orderTypeFilter === 'wholesale' ? 600 : 400,
              transition: 'all 0.3s',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <TeamOutlined style={{ fontSize: 16 }} />
            <span>Đơn Hàng Sỉ</span>
          </div>
        </div>
      </div>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ color: '#667eee' }}>
            <Statistic
              title={<span style={{ color: '#122b9eff' }}>Tổng Đơn {orderTypeFilter === 'ecommerce' ? 'TMĐT' : orderTypeFilter === 'retail' ? 'Lẻ' : 'Sỉ'}</span>}
              value={totalOrders}
              valueStyle={{ color: '#122b9eff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{  }}>
            <Statistic
              title={<span style={{ color: '#0a742dff' }}>Số Lượng Xuất Kho</span>}
              value={totalQuantity}
              valueStyle={{ color: '#0a742dff' }}
              suffix="SP"
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{  }}>
            <Statistic
              title={<span style={{ color: '#a71300ff' }}>Giá Trị Xuất Kho</span>}
              value={totalRevenue}
              valueStyle={{ color: '#a71300ff' }}
              formatter={(value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card style={{ }}>
            <Statistic
              title={<span style={{ color: '#24d301ff' }}>% Sử Dụng Kho</span>}
              value={usageRate}
              valueStyle={{ color: '#24d301ff' }}
              suffix="%"
            />
          </Card>
        </Col>
      </Row>

      {/* Filters & Report */}
      <Card title={`Bộ Lọc Thống Kê - Đơn Hàng ${orderTypeFilter === 'ecommerce' ? 'TMĐT' : orderTypeFilter === 'retail' ? 'Lẻ' : 'Sỉ'}`} style={{ marginBottom: 24, borderRadius: 12 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <Row gutter={[8, 8]} align="middle">
            <Col flex="280px">
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
              />
            </Col>
            {orderTypeFilter === 'ecommerce' && (
              <Col flex="140px">
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
            <Col flex="140px">
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
            <Col flex="160px">
              <Select
                placeholder="Đơn vị"
                value={unitFilter}
                onChange={(value) => setUnitFilter(value)}
                style={{ width: '100%' }}
                showSearch
                optionFilterProp="children"
              >
                <Option value="all">Tất cả đơn vị</Option>
                {unitBreakdown.map(item => (
                  <Option key={item.unit} value={item.unit.toLowerCase()}>
                    {item.unit} ({item.quantity})
                  </Option>
                ))}
                {/* Fallback options nếu chưa có data */}
                {unitBreakdown.length === 0 && (
                  <>
                    <Option value="kg">kg</Option>
                    <Option value="g">g</Option>
                    <Option value="cái">Cái</Option>
                    <Option value="hộp">Hộp</Option>
                    <Option value="gói">Gói</Option>
                    <Option value="thùng">Thùng</Option>
                    <Option value="l">l</Option>
                    <Option value="ml">ml</Option>
                  </>
                )}
              </Select>
            </Col>
            <Col flex="none">
              <Space size={8}>
                <Button
                  type="primary"
                  icon={<BarChartOutlined />}
                  onClick={exportUnitReport}
                  style={{ background: '#088d1eff', borderColor: '#088d1eff' }}
                >
                  Xuất Báo Cáo
                </Button>
                <Button
                  type="primary"
                  icon={<FileExcelOutlined />}
                  onClick={exportExcel}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                >
                  Xuất Excel
                </Button>
              </Space>
            </Col>
          </Row>

          {/* Unit Breakdown Chips */}
          {unitBreakdown.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 12, color: '#666', marginBottom: 8, fontWeight: 500 }}>
                📊 Lọc theo đơn vị:
              </div>
              <Space wrap size={[6, 6]}>
                {unitBreakdown.map((item, index) => {
                  const isSelected = unitFilter.toLowerCase() === item.unit.toLowerCase();
                  return (
                    <div
                      key={index}
                      style={{
                        padding: '4px 10px',
                        background: isSelected ? '#f6ffed' : '#fafafa',
                        border: isSelected ? '1.5px solid #52c41a' : '1px solid #d9d9d9',
                        borderRadius: 4,
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        fontSize: 12,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4
                      }}
                      onClick={() => setUnitFilter(item.unit.toLowerCase())}
                    >
                      <span style={{ fontWeight: 500, color: isSelected ? '#52c41a' : '#333' }}>{item.unit}</span>
                      <span style={{ color: '#999' }}>({item.quantity})</span>
                    </div>
                  );
                })}
                {unitFilter !== 'all' && (
                  <div
                    style={{
                      padding: '4px 10px',
                      background: '#fff',
                      border: '1px dashed #d9d9d9',
                      borderRadius: 4,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      fontSize: 12,
                      color: '#088d1eff',
                      fontWeight: 500
                    }}
                    onClick={() => setUnitFilter('all')}
                  >
                    ↻ Xóa lọc
                  </div>
                )}
              </Space>
            </div>
          )}

          <Table
            columns={columns}
            dataSource={filteredOrders}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              total: filteredOrders.length,
              showTotal: (total) => `Tổng ${total} đơn hàng`,
              onChange: (page, pageSize) => {
                setPagination({ ...pagination, current: page, pageSize });
              },
              onShowSizeChange: (current, size) => {
                setPagination({ ...pagination, current: 1, pageSize: size });
              }
            }}
            scroll={{ x: 1400 }}
            onRow={(record) => ({
              onClick: () => {
                if (record.items && record.items.length > 1) {
                  setSelectedOrder(record);
                  setDetailModalVisible(true);
                }
              },
              style: {
                cursor: record.items && record.items.length > 1 ? 'pointer' : 'default'
              }
            })}
          />
        </Space>
      </Card>

      {/* Detail Modal */}
      <Modal
        title={
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: '#007A33' }}>
              Chi tiết {selectedOrder?.items?.length || 0} sản phẩm
            </div>
            <div style={{ fontSize: 12, color: '#666', fontWeight: 'normal', marginTop: 4 }}>
              Mã đơn: {selectedOrder?.orderId}
            </div>
          </div>
        }
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={900}
      >
        {selectedOrder && selectedOrder.items && (
          <Table
            dataSource={selectedOrder.items}
            rowKey={(item, index) => index}
            pagination={false}
            size="small"
            columns={[
              {
                title: 'Sản phẩm',
                dataIndex: 'productName',
                key: 'productName',
                width: 200
              },
              {
                title: 'SKU',
                dataIndex: 'sku',
                key: 'sku',
                width: 150,
                render: (sku) => <Tag color="blue">{sku}</Tag>
              },
              {
                title: 'SL',
                dataIndex: 'quantity',
                key: 'quantity',
                width: 80,
                align: 'center',
                render: (qty) => <span style={{ fontWeight: 'bold' }}>{qty}</span>
              },
              {
                title: 'Giá',
                dataIndex: 'sellingPrice',
                key: 'sellingPrice',
                width: 120,
                align: 'right',
                render: (price) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price || 0)
              },
              {
                title: 'Tổng',
                dataIndex: 'subtotal',
                key: 'subtotal',
                width: 130,
                align: 'right',
                render: (amount) => (
                  <span style={{ fontWeight: 600, color: '#007A33' }}>
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0)}
                  </span>
                )
              },
              {
                title: 'LN',
                dataIndex: 'profit',
                key: 'profit',
                width: 100,
                align: 'right',
                render: (profit) => (
                  <span style={{ color: profit >= 0 ? '#52c41a' : '#f5222d', fontWeight: 600 }}>
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(profit || 0)}
                  </span>
                )
              }
            ]}
          />
        )}
      </Modal>
    </div>
  );
};

export default OrderReport;
