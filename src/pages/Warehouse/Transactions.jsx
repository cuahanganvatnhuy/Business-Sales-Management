import React, { useState, useEffect } from 'react';
import { database } from '../../services/firebase.service';
import { ref, onValue, remove } from 'firebase/database';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  Card, Table, Tag, DatePicker, Select, Button, Space, Row, Col, Tabs, Statistic, Input, Tooltip, Modal, Dropdown, Menu, message
} from 'antd';
import {
  SwapOutlined, ImportOutlined, ExportOutlined, FileExcelOutlined,
  EditOutlined, ShoppingCartOutlined, DollarOutlined, FilterOutlined, QuestionCircleOutlined,
  EyeOutlined, DeleteOutlined, EllipsisOutlined, PrinterOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Search } = Input;

const Transactions = () => {
  const { user, isAdmin } = useAuth();
  const userPermissions = user?.permissions || [];
  const hasPermission = isAdmin || userPermissions.includes('warehouse.transactions.view');
  const canViewDetail = isAdmin || userPermissions.includes('warehouse.transactions.detail');
  const canDeleteSingle = isAdmin || userPermissions.includes('warehouse.transactions.delete.single');
  const canDeleteBulk = isAdmin || userPermissions.includes('warehouse.transactions.delete.bulk');
  const canExportReport = isAdmin || userPermissions.includes('warehouse.transactions.export');
  const canPrintReceipt = isAdmin || userPermissions.includes('warehouse.transactions.print');

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Quản Lý Giao Dịch Kho. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  const { selectedStore } = useStore();
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [filteredTransactions, setFilteredTransactions] = useState([]);
  const [stores, setStores] = useState([]);
  const [categories, setCategories] = useState([]);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [activeTab, setActiveTab] = useState('export');
  const [dateRange, setDateRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [storeFilter, setStoreFilter] = useState(selectedStore?.id || 'all');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deletingTransaction, setDeletingTransaction] = useState(null);
  const [bulkDeleteModalVisible, setBulkDeleteModalVisible] = useState(false);
  
  // Pagination state
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50', '100']
  });

  // Load stores
  useEffect(() => {
    const storesRef = ref(database, 'stores');
    const unsubscribe = onValue(storesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const storesArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setStores(storesArray);
      } else {
        setStores([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Update store filter when selected store changes
  useEffect(() => {
    if (selectedStore && selectedStore.id !== 'all') {
      setStoreFilter(selectedStore.id);
    }
  }, [selectedStore]);

  // Load categories
  useEffect(() => {
    const categoriesRef = ref(database, 'categories');
    const unsubscribe = onValue(categoriesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const categoriesArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setCategories(categoriesArray);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load transactions with product category
  useEffect(() => {
    setLoading(true);
    const transactionsRef = ref(database, 'warehouseTransactions');
    const productsRef = ref(database, 'products');
    
    const unsubscribeTransactions = onValue(transactionsRef, (txnSnapshot) => {
      onValue(productsRef, (prodSnapshot) => {
        const txnData = txnSnapshot.val();
        const prodData = prodSnapshot.val();
        
        if (txnData) {
          const transactionsArray = Object.keys(txnData).map(key => {
            const txn = { id: key, ...txnData[key] };
            // Join with products to get categoryId
            if (prodData && txn.productId) {
              const product = prodData[txn.productId];
              if (product) {
                txn.categoryId = product.categoryId;
                txn.categoryName = product.category;
              }
            }
            return txn;
          }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setTransactions(transactionsArray);
        } else {
          setTransactions([]);
        }
        setLoading(false);
      }, { onlyOnce: true });
    });
    
    return () => unsubscribeTransactions();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...transactions];
    
    // Filter by tab (export/import/adjustment)
    if (activeTab === 'export') {
      filtered = filtered.filter(t => t.type === 'export');
    } else if (activeTab === 'import') {
      filtered = filtered.filter(t => t.type === 'import');
    } else if (activeTab === 'adjustment') {
      filtered = filtered.filter(t => t.type === 'adjustment');
    }
    
    // Filter by date range
    if (dateRange && dateRange[0] && dateRange[1]) {
      filtered = filtered.filter(t => {
        const txDate = dayjs(t.createdAt);
        return txDate.isAfter(dateRange[0].subtract(1, 'day')) && txDate.isBefore(dateRange[1].add(1, 'day'));
      });
    }
    
    // Filter by store
    if (storeFilter !== 'all') {
      filtered = filtered.filter(t => t.storeId === storeFilter);
    }
    
    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(t => t.categoryId === categoryFilter);
    }
    
    // Filter by search text
    if (searchText) {
      filtered = filtered.filter(t => 
        t.productName?.toLowerCase().includes(searchText.toLowerCase()) ||
        t.sku?.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    
    setFilteredTransactions(filtered);
  }, [transactions, activeTab, dateRange, storeFilter, categoryFilter, searchText]);

  // Export Excel
  const exportExcel = () => {
    if (!canExportReport) {
      message.error('Bạn không có quyền xuất báo cáo giao dịch kho.');
      return;
    }
    const data = filteredTransactions.map((t, i) => ({
      'STT': i + 1,
      'Ngày': dayjs(t.createdAt).format('DD/MM/YYYY HH:mm'),
      'Loại': t.type === 'import' ? 'Nhập kho' : t.type === 'export' ? 'Xuất kho' : 'Điều chỉnh',
      'Sản Phẩm': t.productName,
      'SKU': t.sku,
      'Số Lượng': t.quantity,
      'Tồn Trước': t.beforeQuantity,
      'Tồn Sau': t.afterQuantity,
      'Lý Do': t.reason,
      'Giá Trị': (t.price || 0) * (t.quantity || 0)
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Giao Dịch Kho');
    XLSX.writeFile(wb, `GiaoDichKho_${dayjs().format('YYYYMMDD')}.xlsx`);
  };

  // Print receipt
  const printReceipt = (transaction) => {
    if (!canPrintReceipt) {
      message.error('Bạn không có quyền in phiếu giao dịch kho.');
      return;
    }
    const typeText = transaction.type === 'import' ? 'NHẬP KHO' : transaction.type === 'export' ? 'XUẤT KHO' : 'ĐIỀU CHỈNH KHO';
    const typePrefix = transaction.type === 'import' ? 'NK' : transaction.type === 'export' ? 'XK' : 'DC';
    const typeColor = transaction.type === 'import' ? '#52c41a' : transaction.type === 'export' ? '#f5222d' : '#1890ff';
    
    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Phiếu ${typeText}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Times New Roman', Times, serif; 
            padding: 20px;
            background: #fff;
            font-size: 13px;
          }
          .receipt {
            max-width: 210mm;
            margin: 0 auto;
            padding: 15mm;
          }
          .company-header {
            text-align: center;
            margin-bottom: 5px;
          }
          .company-name {
            font-size: 13px;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 3px;
          }
          .company-info {
            font-size: 11px;
            color: #333;
          }
          .title {
            text-align: center;
            margin: 20px 0 10px 0;
          }
          .title h1 {
            font-size: 20px;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 8px;
            letter-spacing: 1px;
            color: ${typeColor};
          }
          .title .date {
            font-size: 12px;
            font-style: italic;
          }
          .title .serial {
            font-size: 12px;
            margin-top: 5px;
          }
          .divider {
            border-top: 2px solid #000;
            margin: 15px 0;
          }
          .info-table {
            width: 100%;
            margin-bottom: 15px;
          }
          .info-table td {
            padding: 5px;
            font-size: 12px;
          }
          .info-label {
            font-weight: bold;
            width: 120px;
          }
          .product-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
          }
          .product-table th {
            background-color: #f0f0f0;
            border: 1px solid #000;
            padding: 8px 5px;
            font-size: 12px;
            font-weight: bold;
            text-align: center;
          }
          .product-table td {
            border: 1px solid #000;
            padding: 8px 5px;
            font-size: 12px;
          }
          .product-table .center {
            text-align: center;
          }
          .product-table .right {
            text-align: right;
          }
          .product-table .left {
            text-align: left;
          }
          .note-section {
            margin: 15px 0;
            padding: 10px;
            background: #f9f9f9;
            border-left: 3px solid ${typeColor};
          }
          .note-section .note-label {
            font-weight: bold;
            margin-bottom: 5px;
          }
          .signatures {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
          }
          .signature-box {
            text-align: center;
            width: 30%;
          }
          .signature-label {
            font-weight: bold;
            margin-bottom: 60px;
            font-size: 12px;
          }
          .signature-line {
            border-top: 1px dotted #333;
            padding-top: 5px;
            font-size: 11px;
            font-style: italic;
          }
          .print-time {
            text-align: right;
            font-size: 10px;
            color: #999;
            margin-top: 10px;
          }
          @media print {
            body { padding: 0; }
            .receipt { padding: 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <!-- Company Header -->
          <div class="company-header">
            <div class="company-name">🏢 Hệ Thống Quản Lý Kinh Doanh</div>
            <div class="company-info">Địa chỉ: ........................ - Hotline: ........................</div>
          </div>

          <!-- Title -->
          <div class="title">
            <h1>PHIẾU ${typeText}</h1>
            <div class="date">Ngày ${dayjs(transaction.createdAt).format('DD')} tháng ${dayjs(transaction.createdAt).format('MM')} năm ${dayjs(transaction.createdAt).format('YYYY')}</div>
            <div class="serial">Số phiếu: ${typePrefix}-${dayjs(transaction.createdAt).format('YYMMDDHHmmss')}</div>
          </div>

          <div class="divider"></div>

          <!-- Info Section -->
          <table class="info-table">
            <tr>
              <td class="info-label">🏪 Cửa hàng:</td>
              <td><strong>${transaction.storeName || 'N/A'}</strong></td>
            </tr>
            <tr>
              <td class="info-label">📝 Lý do:</td>
              <td>${transaction.reason || 'N/A'}</td>
            </tr>
            <tr>
              <td class="info-label">⏰ Thời gian:</td>
              <td>${dayjs(transaction.createdAt).format('HH:mm:ss - DD/MM/YYYY')}</td>
            </tr>
          </table>

          <!-- Product Table -->
          <table class="product-table">
            <thead>
              <tr>
                <th style="width: 40px;">STT</th>
                <th style="width: 35%;">Tên hàng hóa</th>
                <th style="width: 120px;">Mã SKU</th>
                <th style="width: 80px;">Đơn vị</th>
                <th style="width: 100px;">Số lượng</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="center">1</td>
                <td class="left"><strong>${transaction.productName}</strong></td>
                <td class="center">${transaction.sku || 'N/A'}</td>
                <td class="center">${transaction.unit || 'lỗi'}</td>
                <td class="center"><strong style="font-size: 14px; color: ${typeColor};">${transaction.quantity}</strong></td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <!-- Note Section -->
          <div class="note-section">
            <div class="note-label">📌 Lưu ý:</div>
            <div>- Vui lòng kiểm tra kỹ hàng hóa ${transaction.type === 'export' ? 'trước khi nhận' : 'khi nhận'}</div>
            <div>- Phiếu ${transaction.type === 'import' ? 'nhập' : transaction.type === 'export' ? 'xuất' : 'điều chỉnh'} kho có giá trị trong ngày</div>
          </div>

          <!-- Signatures -->
          <div class="signatures">
            <div class="signature-box">
              <div class="signature-label">Người lập phiếu</div>
              <div class="signature-line">Ký tên</div>
            </div>
            <div class="signature-box">
              <div class="signature-label">${transaction.type === 'export' ? 'Người nhận hàng' : 'Người giao hàng'}</div>
              <div class="signature-line">Ký tên</div>
            </div>
            <div class="signature-box">
              <div class="signature-label">Thủ kho</div>
              <div class="signature-line">Ký tên</div>
            </div>
          </div>

          <div class="print-time">
            In lúc: ${dayjs().format('HH:mm:ss - DD/MM/YYYY')}
          </div>
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
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
      title: 'Ngày Giờ',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      sorter: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
      render: (date) => dayjs(date).format('DD/MM/YYYY HH:mm')
    },
    {
      title: 'Loại GD',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      align: 'center',
      render: (type) => {
        if (type === 'import') {
          return <Tag color="green" icon={<ImportOutlined />}>Nhập</Tag>;
        } else if (type === 'export') {
          return <Tag color="red" icon={<ExportOutlined />}>Xuất</Tag>;
        } else if (type === 'adjustment') {
          return <Tag color="blue" icon={<EditOutlined />}>Điều chỉnh</Tag>;
        }
        return <Tag>N/A</Tag>;
      }
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
      title: 'Cửa Hàng',
      dataIndex: 'storeId',
      key: 'storeId',
      width: 150,
      render: (storeId) => {
        const store = stores.find(s => s.id === storeId);
        return store ? <Tag color="blue">{store.name}</Tag> : <Tag color="default">N/A</Tag>;
      }
    },
    {
      title: 'Số Lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'center',
      render: (qty, record) => {
        if (record.type === 'import') {
          return <span style={{ fontWeight: 'bold', color: '#52c41a' }}>+{qty}</span>;
        } else if (record.type === 'export') {
          return <span style={{ fontWeight: 'bold', color: '#f5222d' }}>-{qty}</span>;
        } else if (record.type === 'adjustment') {
          return <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{qty}</span>;
        }
        return qty;
      }
    },
    {
      title: 'Tồn Trước',
      dataIndex: 'beforeQuantity',
      key: 'beforeQuantity',
      width: 100,
      align: 'center'
    },
    {
      title: 'Tồn Sau',
      dataIndex: 'afterQuantity',
      key: 'afterQuantity',
      width: 100,
      align: 'center',
      render: (qty) => <span style={{ fontWeight: 'bold' }}>{qty}</span>
    },
    {
      title: 'Lý Do',
      dataIndex: 'reason',
      key: 'reason',
      width: 200
    },
    {
      title: 'Giá Trị',
      key: 'value',
      width: 120,
      align: 'right',
      render: (_, record) => {
        const value = (record.price || 0) * record.quantity;
        return (
          <span style={{ fontWeight: 'bold', color: '#1890ff' }}>
            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)}
          </span>
        );
      }
    },
    {
      title: 'Thao Tác',
      key: 'action',
      width: 100,
      align: 'center',
      fixed: 'right',
      render: (_, record) => {
        const menu = (
          <Menu>
            <Menu.Item
              key="view"
              icon={<EyeOutlined style={{ color: '#1890ff' }} />}
              onClick={() => {
                if (!canViewDetail) {
                  message.error('Bạn không có quyền xem chi tiết giao dịch kho.');
                  return;
                }
                setSelectedTransaction(record);
                setDetailModalVisible(true);
              }}
            >
              Xem chi tiết
            </Menu.Item>
            <Menu.Item
              key="print"
              icon={<PrinterOutlined style={{ color: '#52c41a' }} />}
              onClick={() => printReceipt(record)}
            >
              In phiếu
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item
              key="delete"
              icon={<DeleteOutlined style={{ color: '#ff4d4f' }} />}
              danger
              onClick={() => {
                if (!canDeleteSingle) {
                  message.error('Bạn không có quyền xóa giao dịch kho.');
                  return;
                }
                setDeletingTransaction(record);
                setDeleteModalVisible(true);
              }}
            >
              Xóa
            </Menu.Item>
          </Menu>
        );

        return (
          <Dropdown overlay={menu} trigger={['click']} placement="bottomRight">
            <Button type="link" icon={<EllipsisOutlined style={{ fontSize: 20, fontWeight: 'bold' }} />} />
          </Dropdown>
        );
      }
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <Card style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <SwapOutlined style={{ fontSize: 32, color: '#007A33' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 24, color: '#007A33' }}>Quản Lý Giao Dịch Kho</h1>
            <p style={{ margin: 0, color: '#666' }}>Lịch sử nhập xuất kho</p>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <Tabs 
          activeKey={activeTab} 
          onChange={setActiveTab}
          items={[
            {
              key: 'export',
              label: (
                <span>
                  <ExportOutlined /> Quản lý xuất kho{' '}
                  <Tooltip title="Quản lý các giao dịch xuất hàng ra khỏi kho (bán hàng, xuất cho đơn hàng, xuất hủy...)">
                    <QuestionCircleOutlined style={{ fontSize: 14, color: '#1890ff', cursor: 'help' }} />
                  </Tooltip>
                </span>
              )
            },
            {
              key: 'import',
              label: (
                <span>
                  <ImportOutlined /> Quản lý nhập kho{' '}
                  <Tooltip title="Quản lý các giao dịch nhập hàng vào kho (nhập từ nhà cung cấp, nhập bổ sung, hoàn trả...)">
                    <QuestionCircleOutlined style={{ fontSize: 14, color: '#1890ff', cursor: 'help' }} />
                  </Tooltip>
                </span>
              )
            },
            {
              key: 'adjustment',
              label: (
                <span>
                  <EditOutlined /> Quản lý điều chỉnh{' '}
                  <Tooltip title="Quản lý các giao dịch điều chỉnh số lượng tồn kho (kiểm kê, sửa sai số, cập nhật tồn kho...)">
                    <QuestionCircleOutlined style={{ fontSize: 14, color: '#1890ff', cursor: 'help' }} />
                  </Tooltip>
                </span>
              )
            }
          ]}
        />

        {/* Filters */}
        <Space direction="vertical" style={{ width: '100%', marginTop: 16 }} size="large">
          <Row gutter={16}>
            <Col xs={24} md={7}>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                style={{ width: '100%' }}
                format="DD/MM/YYYY"
                placeholder={['Từ ngày', 'Đến ngày']}
              />
            </Col>
            <Col xs={24} md={5}>
              <Select
                placeholder="🏪 Chọn cửa hàng"
                value={storeFilter}
                onChange={setStoreFilter}
                style={{ width: '100%' }}
                allowClear
              >
                <Option value="all">🏪 Tất cả cửa hàng</Option>
                {stores.map(store => (
                  <Option key={store.id} value={store.id}>
                    {store.name}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} md={4}>
              <Select
                placeholder="📦 Chọn danh mục"
                value={categoryFilter}
                onChange={setCategoryFilter}
                style={{ width: '100%' }}
                allowClear
              >
                <Option value="all">📦 Tất cả danh mục</Option>
                {categories.map(cat => (
                  <Option key={cat.id} value={cat.id}>
                    {cat.name}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} md={5}>
              <Search
                placeholder="Tìm sản phẩm..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
            </Col>
            <Col xs={24} md={3}>
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

          {/* Statistics */}
          <div style={{ 
            display: 'flex', 
            gap: '1px', 
            background: '#e8e8e8',
            marginBottom: 16,
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            <div style={{ 
              flex: 1,
              background: '#fff',
              padding: '16px 20px',
              borderLeft: '3px solid #5b8ff9',
              minHeight: '70px'
            }}>
              <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                TỔNG GIAO DỊCH
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <SwapOutlined style={{ fontSize: '18px', color: '#5b8ff9' }} />
                <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#5b8ff9' }}>
                  {filteredTransactions.length}
                </span>
              </div>
            </div>

            <div style={{ 
              flex: 1,
              background: '#fff',
              padding: '16px 20px',
              borderLeft: activeTab === 'export' ? '3px solid #ff4d4f' : '3px solid #52c41a',
              minHeight: '70px'
            }}>
              <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                {activeTab === 'export' ? 'TỔNG XUẤT KHO' : activeTab === 'import' ? 'TỔNG NHẬP KHO' : 'TỔNG ĐIỀU CHỈNH'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeTab === 'export' ? (
                  <ExportOutlined style={{ fontSize: '18px', color: '#ff4d4f' }} />
                ) : activeTab === 'import' ? (
                  <ImportOutlined style={{ fontSize: '18px', color: '#52c41a' }} />
                ) : (
                  <EditOutlined style={{ fontSize: '18px', color: '#1890ff' }} />
                )}
                <span style={{ fontSize: '28px', fontWeight: 'bold', color: activeTab === 'export' ? '#ff4d4f' : activeTab === 'import' ? '#52c41a' : '#1890ff' }}>
                  {filteredTransactions.reduce((sum, t) => sum + (t.quantity || 0), 0)}
                </span>
              </div>
            </div>

            <div style={{ 
              flex: 1,
              background: '#fff',
              padding: '16px 20px',
              borderLeft: '3px solid #faad14',
              minHeight: '70px'
            }}>
              <div style={{ fontSize: '11px', color: '#8c8c8c', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                GIÁ TRỊ SỬ DỤNG
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <DollarOutlined style={{ fontSize: '18px', color: '#faad14' }} />
                <span style={{ fontSize: '28px', fontWeight: 'bold', color: '#faad14' }}>
                  {new Intl.NumberFormat('vi-VN').format(
                    filteredTransactions.reduce((sum, t) => sum + ((t.price || 0) * (t.quantity || 0)), 0)
                  )}
                </span>
                <span style={{ fontSize: '16px', color: '#faad14', marginLeft: '-2px' }}>₫</span>
              </div>
            </div>
          </div>

          {/* Bulk Delete Button */}
          {selectedRowKeys.length > 0 && (
            <Button
              type="primary"
              danger
              icon={<DeleteOutlined />}
              onClick={() => {
                if (!canDeleteBulk) {
                  message.error('Bạn không có quyền xóa nhiều giao dịch kho.');
                  return;
                }
                setBulkDeleteModalVisible(true);
              }}
            >
              Xóa đã chọn ({selectedRowKeys.length})
            </Button>
          )}

          {/* Table */}
          <Table
            columns={columns}
            dataSource={filteredTransactions}
            rowKey="id"
            loading={loading}
            pagination={{
              ...pagination,
              total: filteredTransactions.length,
              showTotal: (total) => `Tổng ${total} giao dịch`,
              onChange: (page, pageSize) => {
                setPagination({ ...pagination, current: page, pageSize });
              },
              onShowSizeChange: (current, size) => {
                setPagination({ ...pagination, current: 1, pageSize: size });
              }
            }}
            scroll={{ x: 1200 }}
            rowSelection={{
              selectedRowKeys,
              onChange: setSelectedRowKeys,
              selections: [
                Table.SELECTION_ALL,
                Table.SELECTION_INVERT,
                Table.SELECTION_NONE
              ]
            }}
          />
        </Space>
      </Card>

      {/* Detail Modal */}
      <Modal
        title={<span><EyeOutlined /> Chi Tiết Giao Dịch</span>}
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedTransaction(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Đóng
          </Button>
        ]}
        width={700}
      >
        {selectedTransaction && (
          <div style={{ padding: '16px 0' }}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card size="small" style={{ background: '#f0f9ff' }}>
                  <div style={{ marginBottom: 8 }}><strong>Loại Giao Dịch:</strong></div>
                  {selectedTransaction.type === 'import' 
                    ? <Tag color="green" icon={<ImportOutlined />}>Nhập Kho</Tag>
                    : <Tag color="red" icon={<ExportOutlined />}>Xuất Kho</Tag>
                  }
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" style={{ background: '#f0f9ff' }}>
                  <div style={{ marginBottom: 8 }}><strong>Ngày Giờ:</strong></div>
                  <div style={{ fontSize: 16, fontWeight: 'bold', color: '#1890ff' }}>
                    {dayjs(selectedTransaction.createdAt).format('DD/MM/YYYY HH:mm')}
                  </div>
                </Card>
              </Col>
              <Col span={24}>
                <Card size="small" style={{ background: '#fff7e6' }}>
                  <div style={{ marginBottom: 8 }}><strong>Sản Phẩm:</strong></div>
                  <div style={{ fontSize: 18, fontWeight: 'bold', color: '#faad14' }}>
                    {selectedTransaction.productName}
                  </div>
                  <div style={{ color: '#666', marginTop: 4 }}>SKU: {selectedTransaction.sku}</div>
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="Số Lượng"
                    value={selectedTransaction.quantity}
                    valueStyle={{ 
                      color: selectedTransaction.type === 'import' ? '#52c41a' : '#f5222d',
                      fontWeight: 'bold'
                    }}
                    prefix={selectedTransaction.type === 'import' ? '+' : '-'}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="Tồn Trước"
                    value={selectedTransaction.beforeQuantity}
                    valueStyle={{ color: '#666' }}
                  />
                </Card>
              </Col>
              <Col span={8}>
                <Card size="small">
                  <Statistic
                    title="Tồn Sau"
                    value={selectedTransaction.afterQuantity}
                    valueStyle={{ color: '#1890ff', fontWeight: 'bold' }}
                  />
                </Card>
              </Col>
              {selectedTransaction.storeId && (
                <Col span={12}>
                  <Card size="small">
                    <div style={{ marginBottom: 8 }}><strong>Cửa Hàng:</strong></div>
                    <Tag color="blue">{selectedTransaction.storeName || 'N/A'}</Tag>
                  </Card>
                </Col>
              )}
              {selectedTransaction.orderId && (
                <Col span={12}>
                  <Card size="small">
                    <div style={{ marginBottom: 8 }}><strong>Mã Đơn Hàng:</strong></div>
                    <Tag color="purple">{selectedTransaction.orderId}</Tag>
                  </Card>
                </Col>
              )}
              <Col span={24}>
                <Card size="small" style={{ background: '#fafafa' }}>
                  <div style={{ marginBottom: 8 }}><strong>Lý Do:</strong></div>
                  <div style={{ color: '#666' }}>{selectedTransaction.reason || 'N/A'}</div>
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title="⚠️ Xác Nhận Xóa"
        open={deleteModalVisible}
        onOk={async () => {
          try {
            if (deletingTransaction) {
              await remove(ref(database, `warehouseTransactions/${deletingTransaction.id}`));
              message.success('Đã xóa giao dịch!');
            }
            setDeleteModalVisible(false);
            setDeletingTransaction(null);
          } catch (error) {
            message.error('Lỗi: ' + error.message);
          }
        }}
        onCancel={() => {
          setDeleteModalVisible(false);
          setDeletingTransaction(null);
        }}
        okText="Xóa"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
      >
        <p>Bạn có chắc muốn xóa giao dịch <strong>"{deletingTransaction?.productName}"</strong>?</p>
        <p style={{ color: '#999' }}>Hành động này không thể hoàn tác.</p>
      </Modal>

      {/* Bulk Delete Confirmation Modal */}
      <Modal
        title="⚠️ Xác Nhận Xóa Nhiều"
        open={bulkDeleteModalVisible}
        onOk={async () => {
          try {
            await Promise.all(
              selectedRowKeys.map(id => remove(ref(database, `warehouseTransactions/${id}`)))
            );
            message.success(`Đã xóa ${selectedRowKeys.length} giao dịch!`);
            setSelectedRowKeys([]);
            setBulkDeleteModalVisible(false);
          } catch (error) {
            message.error('Lỗi: ' + error.message);
          }
        }}
        onCancel={() => setBulkDeleteModalVisible(false)}
        okText="Xóa tất cả"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
      >
        <p>Bạn có chắc muốn xóa <strong>{selectedRowKeys.length} giao dịch</strong> đã chọn?</p>
        <p style={{ color: '#999' }}>Hành động này không thể hoàn tác.</p>
      </Modal>
    </div>
  );
};

export default Transactions;
