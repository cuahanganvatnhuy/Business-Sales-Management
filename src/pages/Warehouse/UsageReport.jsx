import React, { useState, useEffect } from 'react';
import { database } from '../../services/firebase.service';
import { ref, onValue } from 'firebase/database';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  Card, Table, DatePicker, Select, Button, Space, Row, Col, Statistic, Input
} from 'antd';
import {
  LineChartOutlined, RiseOutlined, FallOutlined, FileExcelOutlined,
  SwapOutlined, DollarOutlined, ReloadOutlined, SearchOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { RangePicker } = DatePicker;
const { Option } = Select;

const UsageReport = () => {
  const { selectedStore } = useStore();
  const { user, isAdmin } = useAuth();
  const userPermissions = user?.permissions || [];
  const hasPermission = isAdmin || userPermissions.includes('warehouse.usageReport.view');
  const canExportReport = isAdmin || userPermissions.includes('warehouse.usageReport.export');

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Báo Cáo Sử Dụng. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categories, setCategories] = useState([]);
  const [storeFilter, setStoreFilter] = useState(selectedStore?.id || 'all');
  const [stores, setStores] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [periodFilter, setPeriodFilter] = useState('month'); // today, week, month, custom
  
  const [totalTransactions, setTotalTransactions] = useState(0);
  const [totalImport, setTotalImport] = useState(0);
  const [totalExport, setTotalExport] = useState(0);
  const [totalValue, setTotalValue] = useState(0);
  
  // Pagination state
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50', '100']
  });

  // Load data
  useEffect(() => {
    setLoading(true);
    
    const transactionsRef = ref(database, 'warehouseTransactions');
    const productsRef = ref(database, 'products');
    const categoriesRef = ref(database, 'categories');
    const storesRef = ref(database, 'stores');
    
    onValue(transactionsRef, (snapshot) => {
      setTransactions(snapshot.val() ? Object.values(snapshot.val()) : []);
    });
    
    onValue(productsRef, (snapshot) => {
      setProducts(snapshot.val() ? Object.keys(snapshot.val()).map(k => ({ id: k, ...snapshot.val()[k] })) : []);
    });
    
    onValue(categoriesRef, (snapshot) => {
      setCategories(snapshot.val() ? Object.keys(snapshot.val()).map(k => ({ id: k, ...snapshot.val()[k] })) : []);
    });

    onValue(storesRef, (snapshot) => {
      setStores(snapshot.val() ? Object.keys(snapshot.val()).map(k => ({ id: k, ...snapshot.val()[k] })) : []);
      setLoading(false);
    });
  }, []);

  // Update store filter when selected store changes
  useEffect(() => {
    if (selectedStore && selectedStore.id !== 'all') {
      setStoreFilter(selectedStore.id);
    }
  }, [selectedStore]);

  // Handle period filter change
  useEffect(() => {
    if (periodFilter === 'today') {
      setDateRange([dayjs().startOf('day'), dayjs().endOf('day')]);
    } else if (periodFilter === 'week') {
      setDateRange([dayjs().startOf('week'), dayjs().endOf('week')]);
    } else if (periodFilter === 'month') {
      setDateRange([dayjs().startOf('month'), dayjs().endOf('month')]);
    }
    // 'custom' keeps current dateRange
  }, [periodFilter]);

  // Generate report
  useEffect(() => {
    if (!transactions.length || !products.length) return;
    
    let filtered = transactions.filter(t => {
      if (!dateRange || !dateRange[0] || !dateRange[1]) return true;
      const txDate = dayjs(t.createdAt);
      return txDate.isAfter(dateRange[0].subtract(1, 'day')) && txDate.isBefore(dateRange[1].add(1, 'day'));
    });

    // Filter by store
    if (storeFilter !== 'all') {
      filtered = filtered.filter(t => t.storeId === storeFilter);
    }
    
    const productStats = {};
    
    filtered.forEach(tx => {
      const key = `${tx.productId}_${tx.storeId || 'nostore'}`;
      if (!productStats[key]) {
        const product = products.find(p => p.id === tx.productId);
        const store = stores.find(s => s.id === tx.storeId);
        productStats[key] = {
          productId: tx.productId,
          productName: tx.productName,
          sku: tx.sku,
          categoryId: product?.categoryId,
          categoryName: product?.category || 'N/A',
          storeId: tx.storeId,
          storeName: store?.name || tx.storeName || 'N/A',
          totalImport: 0,
          totalExport: 0,
          beginStock: 0, // Will calculate
          endStock: product?.stock || 0,
          currentStock: product?.stock || 0,
          price: product?.price || 0
        };
      }
      
      if (tx.type === 'import') {
        productStats[key].totalImport += tx.quantity;
      } else {
        productStats[key].totalExport += tx.quantity;
      }
    });
    
    let report = Object.values(productStats).map(r => {
      // Calculate begin stock = current - import + export
      const beginStock = r.currentStock - r.totalImport + r.totalExport;
      return {
        ...r,
        beginStock: Math.max(0, beginStock),
        endStock: r.currentStock,
        totalValue: r.price * r.totalExport,
        usageRate: r.beginStock + r.totalImport > 0 
          ? ((r.totalExport / (r.beginStock + r.totalImport)) * 100).toFixed(1) 
          : 0
      };
    });
    
    // Filter by category
    if (categoryFilter !== 'all') {
      report = report.filter(r => r.categoryId === categoryFilter);
    }
    
    // Filter by search text
    if (searchText) {
      report = report.filter(r => 
        r.productName?.toLowerCase().includes(searchText.toLowerCase()) ||
        r.sku?.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    
    report.sort((a, b) => b.totalExport - a.totalExport);
    setReportData(report);
    
    const sumImport = report.reduce((sum, r) => sum + r.totalImport, 0);
    const sumExport = report.reduce((sum, r) => sum + r.totalExport, 0);
    const sumValue = report.reduce((sum, r) => sum + r.totalValue, 0);
    
    setTotalTransactions(filtered.length);
    setTotalImport(sumImport);
    setTotalExport(sumExport);
    setTotalValue(sumValue);
  }, [transactions, products, stores, dateRange, categoryFilter, storeFilter, searchText]);

  // Export Excel
  const exportExcel = () => {
    if (!canExportReport) {
      message.error('Bạn không có quyền xuất báo cáo Báo Cáo Sử Dụng.');
      return;
    }
    const data = reportData.map((r, i) => ({
      'STT': i + 1,
      'Sản Phẩm': r.productName,
      'SKU': r.sku,
      'Danh Mục': r.categoryName,
      'Cửa Hàng': r.storeName,
      'Tồn Đầu Kỳ': r.beginStock,
      'Nhập Kho': r.totalImport,
      'Xuất Kho': r.totalExport,
      'Tồn Cuối Kỳ': r.endStock,
      'Tồn Hiện Tại': r.currentStock,
      '% Sử Dụng': `${r.usageRate}%`,
      'Giá Trị Xuất': r.totalValue
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Báo Cáo Sử Dụng');
    XLSX.writeFile(wb, `BaoCaoSuDung_${dayjs().format('YYYYMMDD')}.xlsx`);
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
      title: 'Danh Mục',
      dataIndex: 'categoryName',
      key: 'categoryName',
      width: 120
    },
    {
      title: 'Cửa Hàng',
      dataIndex: 'storeName',
      key: 'storeName',
      width: 120
    },
    {
      title: 'Tồn Đầu Kỳ',
      dataIndex: 'beginStock',
      key: 'beginStock',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.beginStock - b.beginStock
    },
    {
      title: 'Nhập Kho',
      dataIndex: 'totalImport',
      key: 'totalImport',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.totalImport - b.totalImport,
      render: (qty) => <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{qty}</span>
    },
    {
      title: 'Xuất Kho',
      dataIndex: 'totalExport',
      key: 'totalExport',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.totalExport - b.totalExport,
      render: (qty) => <span style={{ color: '#f5222d', fontWeight: 'bold' }}>{qty}</span>
    },
    {
      title: 'Tồn Cuối Kỳ',
      dataIndex: 'endStock',
      key: 'endStock',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.endStock - b.endStock,
      render: (qty) => <span style={{ color: '#1890ff', fontWeight: 'bold' }}>{qty}</span>
    },
    {
      title: 'Tồn Hiện Tại',
      dataIndex: 'currentStock',
      key: 'currentStock',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.currentStock - b.currentStock
    },
    {
      title: '% Sử Dụng',
      dataIndex: 'usageRate',
      key: 'usageRate',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.usageRate - b.usageRate,
      render: (rate) => <span style={{ color: rate > 80 ? '#52c41a' : rate > 50 ? '#faad14' : '#999' }}>{rate}%</span>
    },
    {
      title: 'Giá Trị Xuất',
      dataIndex: 'totalValue',
      key: 'totalValue',
      width: 150,
      align: 'right',
      sorter: (a, b) => a.totalValue - b.totalValue,
      render: (value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <Card style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LineChartOutlined style={{ fontSize: 32, color: '#007A33' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 24, color: '#007A33' }}>Báo Cáo Sử Dụng</h1>
            <p style={{ margin: 0, color: '#666' }}>Thống kê nhập xuất và sử dụng kho</p>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={[8, 8]} align="middle">
          <Col><span style={{ color: '#666', fontWeight: 500, fontSize: 13 }}>📅</span></Col>
          <Col style={{ width: 110 }}>
            <Select value={periodFilter} onChange={(val) => { setPeriodFilter(val); if (val !== 'custom') setDateRange(null); }} style={{ width: '100%' }} size="small">
              <Option value="today">Hôm nay</Option>
              <Option value="week">Tuần này</Option>
              <Option value="month">Tháng này</Option>
              <Option value="custom">Tùy chỉnh</Option>
            </Select>
          </Col>
          <Col style={{ width: 280 }}>
            <RangePicker
              value={dateRange}
              onChange={(dates) => { setDateRange(dates); setPeriodFilter('custom'); }}
              style={{ width: '100%' }}
              size="small"
              format="DD/MM/YYYY"
              placeholder={['dd/mm/yyyy', 'dd/mm/yyyy']}
              disabled={periodFilter !== 'custom'}
            />
          </Col>
          <Col><span style={{ color: '#666', fontWeight: 500, fontSize: 13 }}>📦</span></Col>
          <Col style={{ width: 140 }}>
            <Select value={categoryFilter} onChange={setCategoryFilter} style={{ width: '100%' }} size="small" allowClear placeholder="Danh mục">
              <Option value="all">Tất cả danh mục</Option>
              {categories.map(cat => (<Option key={cat.id} value={cat.id}>{cat.name}</Option>))}
            </Select>
          </Col>
          <Col><span style={{ color: '#666', fontWeight: 500, fontSize: 13 }}>🏪</span></Col>
          <Col style={{ width: 140 }}>
            <Select value={storeFilter} onChange={setStoreFilter} style={{ width: '100%' }} size="small" allowClear placeholder="Cửa hàng">
              <Option value="all">Tất cả cửa hàng</Option>
              {stores.map(store => (<Option key={store.id} value={store.id}>{store.name}</Option>))}
            </Select>
          </Col>
          <Col flex="auto">
            <Input
              placeholder="🔍 Tìm kiếm..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
              size="small"
              style={{ width: '100%' }}
            />
          </Col>
          <Col>
            <Button size="small" icon={<ReloadOutlined />} onClick={() => { setPeriodFilter('month'); setCategoryFilter('all'); setStoreFilter('all'); setSearchText(''); }}>Làm mới</Button>
          </Col>
          <Col>
            <Button size="small" type="primary" icon={<FileExcelOutlined />} onClick={exportExcel} style={{ background: '#52c41a', borderColor: '#52c41a' }}>Xuất Excel</Button>
          </Col>
        </Row>
      </Card>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={6}>
          <Card style={{ borderLeft: '4px solid #6c5ce7' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#999' }}>TỔNG GIAO DỊCH</span>}
              value={totalTransactions}
              prefix={<SwapOutlined style={{ color: '#6c5ce7', fontSize: 20 }} />}
              valueStyle={{ color: '#6c5ce7', fontSize: 24, fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderLeft: '4px solid #00cfe8' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#999' }}>TỔNG NHẬP KHO</span>}
              value={totalImport}
              prefix={<RiseOutlined style={{ color: '#00cfe8', fontSize: 20 }} />}
              valueStyle={{ color: '#00cfe8', fontSize: 24, fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderLeft: '4px solid #ff9f43' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#999' }}>TỔNG XUẤT KHO</span>}
              value={totalExport}
              prefix={<FallOutlined style={{ color: '#ff9f43', fontSize: 20 }} />}
              valueStyle={{ color: '#ff9f43', fontSize: 24, fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={6}>
          <Card style={{ borderLeft: '4px solid #b8b8b8' }}>
            <Statistic
              title={<span style={{ fontSize: 12, color: '#999' }}>GIÁ TRỊ SỬ DỤNG</span>}
              value={totalValue}
              prefix={<DollarOutlined style={{ color: '#b8b8b8', fontSize: 20 }} />}
              valueStyle={{ color: '#2d3436', fontSize: 22, fontWeight: 'bold' }}
              formatter={(value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)}
            />
          </Card>
        </Col>
      </Row>

      {/* Report Table */}
      <Card title="Báo Cáo Sử Dụng Theo Sản Phẩm" style={{ marginBottom: 24, borderRadius: 12 }}>
        <Table
          columns={columns}
          dataSource={reportData}
          rowKey={(record) => `${record.productId}_${record.storeId || 'nostore'}`}
          loading={loading}
          pagination={{
            ...pagination,
            total: reportData.length,
            showTotal: (total) => `Tổng ${total} sản phẩm`,
            onChange: (page, pageSize) => {
              setPagination({ ...pagination, current: page, pageSize });
            },
            onShowSizeChange: (current, size) => {
              setPagination({ ...pagination, current: 1, pageSize: size });
            }
          }}
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
};

export default UsageReport;
