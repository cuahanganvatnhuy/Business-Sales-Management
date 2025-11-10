import React, { useState, useEffect } from 'react';
import { database } from '../../services/firebase.service';
import { ref, onValue } from 'firebase/database';
import {
  Card, Table, DatePicker, Select, Button, Space, Row, Col, Statistic
} from 'antd';
import {
  LineChartOutlined, RiseOutlined, FallOutlined, FileExcelOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { RangePicker } = DatePicker;
const { Option } = Select;

const UsageReport = () => {
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [products, setProducts] = useState([]);
  const [reportData, setReportData] = useState([]);
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [categories, setCategories] = useState([]);
  
  const [totalImport, setTotalImport] = useState(0);
  const [totalExport, setTotalExport] = useState(0);
  const [totalValue, setTotalValue] = useState(0);

  // Load data
  useEffect(() => {
    setLoading(true);
    
    const transactionsRef = ref(database, 'warehouseTransactions');
    const productsRef = ref(database, 'products');
    const categoriesRef = ref(database, 'categories');
    
    onValue(transactionsRef, (snapshot) => {
      setTransactions(snapshot.val() ? Object.values(snapshot.val()) : []);
    });
    
    onValue(productsRef, (snapshot) => {
      setProducts(snapshot.val() ? Object.keys(snapshot.val()).map(k => ({ id: k, ...snapshot.val()[k] })) : []);
    });
    
    onValue(categoriesRef, (snapshot) => {
      setCategories(snapshot.val() ? Object.keys(snapshot.val()).map(k => ({ id: k, ...snapshot.val()[k] })) : []);
      setLoading(false);
    });
  }, []);

  // Generate report
  useEffect(() => {
    if (!transactions.length || !products.length) return;
    
    let filtered = transactions.filter(t => {
      if (!dateRange || !dateRange[0] || !dateRange[1]) return true;
      const txDate = dayjs(t.createdAt);
      return txDate.isAfter(dateRange[0].subtract(1, 'day')) && txDate.isBefore(dateRange[1].add(1, 'day'));
    });
    
    const productStats = {};
    
    filtered.forEach(tx => {
      if (!productStats[tx.productId]) {
        const product = products.find(p => p.id === tx.productId);
        productStats[tx.productId] = {
          productId: tx.productId,
          productName: tx.productName,
          sku: tx.sku,
          categoryId: product?.categoryId,
          totalImport: 0,
          totalExport: 0,
          currentStock: product?.inventory || 0,
          price: product?.price || 0
        };
      }
      
      if (tx.type === 'import') {
        productStats[tx.productId].totalImport += tx.quantity;
      } else {
        productStats[tx.productId].totalExport += tx.quantity;
      }
    });
    
    let report = Object.values(productStats);
    
    if (categoryFilter !== 'all') {
      report = report.filter(r => r.categoryId === categoryFilter);
    }
    
    report = report.map(r => ({
      ...r,
      totalValue: r.price * r.currentStock,
      usageRate: r.totalImport > 0 ? ((r.totalExport / r.totalImport) * 100).toFixed(1) : 0
    })).sort((a, b) => b.totalExport - a.totalExport);
    
    setReportData(report);
    
    const sumImport = report.reduce((sum, r) => sum + r.totalImport, 0);
    const sumExport = report.reduce((sum, r) => sum + r.totalExport, 0);
    const sumValue = report.reduce((sum, r) => sum + r.totalValue, 0);
    
    setTotalImport(sumImport);
    setTotalExport(sumExport);
    setTotalValue(sumValue);
  }, [transactions, products, dateRange, categoryFilter]);

  // Export Excel
  const exportExcel = () => {
    const data = reportData.map((r, i) => ({
      'STT': i + 1,
      'Sản Phẩm': r.productName,
      'SKU': r.sku,
      'Tổng Nhập': r.totalImport,
      'Tổng Xuất': r.totalExport,
      'Tồn Kho': r.currentStock,
      'Tỷ Lệ SD': `${r.usageRate}%`,
      'Giá Trị': r.totalValue
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
      title: 'Tổng Nhập',
      dataIndex: 'totalImport',
      key: 'totalImport',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.totalImport - b.totalImport,
      render: (qty) => <span style={{ color: '#52c41a', fontWeight: 'bold' }}>{qty}</span>
    },
    {
      title: 'Tổng Xuất',
      dataIndex: 'totalExport',
      key: 'totalExport',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.totalExport - b.totalExport,
      render: (qty) => <span style={{ color: '#f5222d', fontWeight: 'bold' }}>{qty}</span>
    },
    {
      title: 'Tồn Kho',
      dataIndex: 'currentStock',
      key: 'currentStock',
      width: 100,
      align: 'center',
      sorter: (a, b) => a.currentStock - b.currentStock
    },
    {
      title: 'Tỷ Lệ SD (%)',
      dataIndex: 'usageRate',
      key: 'usageRate',
      width: 120,
      align: 'center',
      sorter: (a, b) => a.usageRate - b.usageRate,
      render: (rate) => `${rate}%`
    },
    {
      title: 'Giá Trị',
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

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Tổng Nhập Kho"
              value={totalImport}
              prefix={<RiseOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
              suffix="SP"
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Tổng Xuất Kho"
              value={totalExport}
              prefix={<FallOutlined style={{ color: '#f5222d' }} />}
              valueStyle={{ color: '#f5222d' }}
              suffix="SP"
            />
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card>
            <Statistic
              title="Giá Trị Tồn"
              value={totalValue}
              valueStyle={{ color: '#1890ff' }}
              formatter={(value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters & Report */}
      <Card title="Báo Cáo Chi Tiết" style={{ marginBottom: 24, borderRadius: 12 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <Row gutter={16}>
            <Col xs={24} md={10}>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
              />
            </Col>
            <Col xs={24} md={8}>
              <Select
                placeholder="Danh mục"
                value={categoryFilter}
                onChange={setCategoryFilter}
                style={{ width: '100%' }}
              >
                <Option value="all">Tất cả danh mục</Option>
                {categories.map(cat => (
                  <Option key={cat.id} value={cat.id}>{cat.name}</Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} md={6}>
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
            dataSource={reportData}
            rowKey="productId"
            loading={loading}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            scroll={{ x: 1200 }}
          />
        </Space>
      </Card>
    </div>
  );
};

export default UsageReport;
