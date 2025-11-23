import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Button, Modal, Form, Input, Select, DatePicker, InputNumber, Tag, message, Dropdown, Space, Descriptions, Popconfirm } from 'antd';
import { TruckOutlined, DollarOutlined, CalculatorOutlined, LineChartOutlined, PlusOutlined, ExportOutlined, FilterOutlined, MoreOutlined, EyeOutlined, EditOutlined, DeleteOutlined, PrinterOutlined } from '@ant-design/icons';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';
import { database } from '../../services/firebase.service';
import { ref, onValue, push, set, remove, update } from 'firebase/database';
import { formatCurrency } from '../../utils/format';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import './ShippingCost.css';

const { RangePicker } = DatePicker;
const { TextArea } = Input;

const ShippingCost = () => {
  const { selectedStore } = useStore();
  const { user, isAdmin } = useAuth();
  const userPermissions = user?.permissions || [];
  const hasPermission = isAdmin || userPermissions.includes('shippingcost.view');
  const canAdd = isAdmin || userPermissions.includes('shippingcost.add');
  const canEdit = isAdmin || userPermissions.includes('shippingcost.edit');
  const canDelete = isAdmin || userPermissions.includes('shippingcost.delete');
  const canExport = isAdmin || userPermissions.includes('shippingcost.export');
  const canViewDetail = isAdmin || userPermissions.includes('shippingcost.viewDetail');
  const [loading, setLoading] = useState(true);

  // Check page access permission
  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Quản Lý Chi Phí Vận Chuyển. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }
  const [shippingCosts, setShippingCosts] = useState([]);
  const [filteredData, setFilteredData] = useState([]);
  const [stores, setStores] = useState([]);
  const [products, setProducts] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [viewingRecord, setViewingRecord] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [form] = Form.useForm();

  // Filters
  const [dateRange, setDateRange] = useState(null);
  const [typeFilter, setTypeFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('all');

  // Statistics
  const [stats, setStats] = useState({
    totalImportCost: 0,
    totalExportCost: 0,
    totalShippingCost: 0,
    averageCost: 0,
    importCount: 0,
    exportCount: 0,
    totalTransactions: 0
  });

  useEffect(() => {
    loadShippingCosts();
    loadStores();
    loadProducts();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [shippingCosts, dateRange, typeFilter, storeFilter, selectedStore]);

  useEffect(() => {
    calculateStatistics();
  }, [filteredData]);

  const loadShippingCosts = () => {
    const shippingRef = ref(database, 'shippingCosts');
    onValue(shippingRef, (snapshot) => {
      const data = snapshot.val();
      const costs = [];
      if (data) {
        Object.keys(data).forEach(key => {
          costs.push({
            id: key,
            ...data[key]
          });
        });
      }
      costs.sort((a, b) => new Date(b.date || b.timestamp) - new Date(a.date || a.timestamp));
      setShippingCosts(costs);
      setLoading(false);
    });
  };

  const loadStores = () => {
    const storesRef = ref(database, 'stores');
    onValue(storesRef, (snapshot) => {
      const data = snapshot.val();
      const storeList = [];
      if (data) {
        Object.keys(data).forEach(key => {
          storeList.push({
            id: key,
            ...data[key]
          });
        });
      }
      setStores(storeList);
    });
  };

  const loadProducts = () => {
    const productsRef = ref(database, 'products');
    onValue(productsRef, (snapshot) => {
      const data = snapshot.val();
      const productList = [];
      if (data) {
        Object.keys(data).forEach(key => {
          productList.push({
            id: key,
            ...data[key]
          });
        });
      }
      setProducts(productList);
    });
  };

  const applyFilters = () => {
    let filtered = [...shippingCosts];

    // Auto filter by selected store from StoreContext
    if (selectedStore && selectedStore.id !== 'all') {
      filtered = filtered.filter(item => item.storeId === selectedStore.id);
    }

    // Date range filter
    if (dateRange && dateRange.length === 2) {
      const [start, end] = dateRange;
      filtered = filtered.filter(item => {
        const itemDate = dayjs(item.date || item.timestamp);
        return itemDate.isAfter(start.startOf('day')) && itemDate.isBefore(end.endOf('day'));
      });
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter(item => item.transactionType === typeFilter);
    }

    // Additional store filter (nếu user muốn filter thêm)
    if (storeFilter !== 'all') {
      filtered = filtered.filter(item => item.storeId === storeFilter);
    }

    setFilteredData(filtered);
  };

  const calculateStatistics = () => {
    const importCosts = filteredData.filter(item => item.transactionType === 'import');
    const exportCosts = filteredData.filter(item => item.transactionType === 'export');

    const totalImportCost = importCosts.reduce((sum, item) => sum + (item.shippingCost || 0), 0);
    const totalExportCost = exportCosts.reduce((sum, item) => sum + (item.shippingCost || 0), 0);
    const totalShippingCost = totalImportCost + totalExportCost;
    const averageCost = filteredData.length > 0 ? totalShippingCost / filteredData.length : 0;

    setStats({
      totalImportCost,
      totalExportCost,
      totalShippingCost,
      averageCost,
      importCount: importCosts.length,
      exportCount: exportCosts.length,
      totalTransactions: filteredData.length
    });
  };

  const handleAddNew = () => {
    if (!canAdd) {
      message.error('Bạn không có quyền thêm mới chi phí vận chuyển.');
      return;
    }
    form.resetFields();
    setEditingId(null);
    setModalVisible(true);
  };

  const openEditModal = (record) => {
    if (!canEdit) {
      message.error('Bạn không có quyền chỉnh sửa chi phí vận chuyển.');
      return;
    }
    form.setFieldsValue({
      transactionType: record.transactionType,
      date: dayjs(record.date),
      storeId: record.storeId,
      productIds: record.productIds || [],
      shippingCost: record.shippingCost,
      shippingMethod: record.shippingMethod,
      notes: record.notes
    });
    setEditingId(record.id);
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      const storeData = stores.find(s => s.id === values.storeId);
      
      // Get selected products data
      const selectedProductIds = values.productIds || [];
      const selectedProducts = selectedProductIds.map(id => 
        products.find(p => p.id === id)
      ).filter(p => p);
      const productNames = selectedProducts.map(p => p.name);
      
      const shippingData = {
        transactionType: values.transactionType,
        date: values.date.format('YYYY-MM-DD HH:mm:ss'),
        timestamp: new Date().toISOString(),
        storeId: values.storeId,
        storeName: storeData ? storeData.name : '',
        productIds: selectedProductIds,
        productNames: productNames,
        productCount: selectedProductIds.length,
        shippingCost: values.shippingCost,
        shippingMethod: values.shippingMethod,
        notes: values.notes || '',
        updatedAt: new Date().toISOString()
      };

      if (editingId) {
        await update(ref(database, `shippingCosts/${editingId}`), shippingData);
        message.success('Cập nhật chi phí vận chuyển thành công!');
      } else {
        shippingData.createdAt = new Date().toISOString();
        await push(ref(database, 'shippingCosts'), shippingData);
        message.success('Thêm chi phí vận chuyển thành công!');
      }

      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('Error saving shipping cost:', error);
      message.error('Có lỗi xảy ra!');
    }
  };

  const handleViewDetail = (record) => {
    if (!canViewDetail) {
      message.error('Bạn không có quyền xem chi tiết chi phí vận chuyển.');
      return;
    }
    setViewingRecord(record);
    setDetailModalVisible(true);
  };

  const handlePrintReceipt = (record) => {
    // Create print window
    const printWindow = window.open('', '', 'width=800,height=600');
    printWindow.document.write(`
      <html>
        <head>
          <title>Phiếu Chi Phí Vận Chuyển</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 20px; }
            h2 { text-align: center; color: #007A33; }
            .info { margin: 20px 0; }
            .info-row { margin: 10px 0; }
            .label { font-weight: bold; display: inline-block; width: 200px; }
            .value { display: inline-block; }
          </style>
        </head>
        <body>
          <h2>PHIẾU CHI PHÍ VẬN CHUYỂN</h2>
          <div class="info">
            <div class="info-row"><span class="label">Loại giao dịch:</span><span class="value">${record.transactionType === 'import' ? 'Nhập hàng' : 'Xuất hàng'}</span></div>
            <div class="info-row"><span class="label">Ngày:</span><span class="value">${dayjs(record.date).format('DD/MM/YYYY HH:mm')}</span></div>
            <div class="info-row"><span class="label">Cửa hàng:</span><span class="value">${record.storeName}</span></div>
            <div class="info-row"><span class="label">Sản phẩm:</span><span class="value">${record.productNames && record.productNames.length > 0 ? record.productNames.join(', ') : 'Không có'}</span></div>
            <div class="info-row"><span class="label">Chi phí vận chuyển:</span><span class="value">${formatCurrency(record.shippingCost)}</span></div>
            <div class="info-row"><span class="label">Hình thức:</span><span class="value">${getShippingMethodLabel(record.shippingMethod)}</span></div>
            <div class="info-row"><span class="label">Ghi chú:</span><span class="value">${record.notes || 'Không có'}</span></div>
          </div>
          <script>window.print(); window.close();</script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDelete = async (id) => {
    if (!canDelete) {
      message.error('Bạn không có quyền xóa chi phí vận chuyển.');
      return;
    }
    try {
      await remove(ref(database, `shippingCosts/${id}`));
      message.success('Xóa chi phí vận chuyển thành công!');
    } catch (error) {
      console.error('Error deleting shipping cost:', error);
      message.error('Có lỗi xảy ra!');
    }
  };

  const handleBulkDelete = async () => {
    try {
      await Promise.all(selectedRowKeys.map(id => remove(ref(database, `shippingCosts/${id}`))));
      message.success(`Đã xóa ${selectedRowKeys.length} chi phí vận chuyển!`);
      setSelectedRowKeys([]);
    } catch (error) {
      console.error('Error deleting shipping costs:', error);
      message.error('Có lỗi xảy ra!');
    }
  };

  const handleDeleteAll = async () => {
    try {
      await Promise.all(filteredData.map(item => remove(ref(database, `shippingCosts/${item.id}`))));
      message.success(`Đã xóa tất cả ${filteredData.length} chi phí vận chuyển!`);
      setSelectedRowKeys([]);
    } catch (error) {
      console.error('Error deleting all shipping costs:', error);
      message.error('Có lỗi xảy ra!');
    }
  };

  const exportToExcel = () => {
    if (!canExport) {
      message.error('Bạn không có quyền xuất báo cáo chi phí vận chuyển.');
      return;
    }
    const exportData = filteredData.map((item, index) => ({
      'STT': index + 1,
      'Ngày': dayjs(item.date).format('DD/MM/YYYY HH:mm'),
      'Loại': item.transactionType === 'import' ? 'Nhập hàng' : 'Xuất hàng',
      'Cửa Hàng': item.storeName,
      'Sản Phẩm': item.productNames && item.productNames.length > 0 
        ? item.productNames.join(', ') 
        : 'Chưa chọn',
      'Số Lượng SP': item.productCount || 0,
      'Chi Phí': item.shippingCost,
      'Hình Thức': getShippingMethodLabel(item.shippingMethod),
      'Ghi Chú': item.notes || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Chi Phí Vận Chuyển');
    XLSX.writeFile(wb, `ChiPhiVanChuyen_${dayjs().format('YYYYMMDD')}.xlsx`);
    message.success('Xuất Excel thành công!');
  };

  const getShippingMethodLabel = (method) => {
    const methods = {
      'xe_tai': 'Chành Xe',
      'ship_cod': 'Ship COD',
      'grab_express': 'Grab Express',
      'giao_hang_nhanh': 'Giao Hàng Nhanh',
      'giao_hang_tiet_kiem': 'Giao Hàng Tiết Kiệm',
      'viettel_post': 'Viettel Post',
      'vnpost': 'VN Post',
      'j_t_express': 'J&T Express',
      'shopee_express': 'Shopee Express',
      'lazada_express': 'Lazada Express',
      'khac': 'Khác'
    };
    return methods[method] || method;
  };

  const clearFilters = () => {
    setDateRange(null);
    setTypeFilter('all');
    setStoreFilter('all');
  };

  const columns = [
    {
      title: 'STT',
      key: 'index',
      width: 60,
      render: (_, __, index) => index + 1
    },
    {
      title: 'Ngày',
      dataIndex: 'date',
      key: 'date',
      width: 150,
      render: (date) => dayjs(date).format('DD/MM/YYYY HH:mm')
    },
    {
      title: 'Loại',
      dataIndex: 'transactionType',
      key: 'transactionType',
      width: 120,
      render: (type) => (
        <Tag color={type === 'import' ? 'blue' : 'green'}>
          {type === 'import' ? 'Nhập hàng' : 'Xuất hàng'}
        </Tag>
      )
    },
    {
      title: 'Cửa Hàng',
      dataIndex: 'storeName',
      key: 'storeName',
      width: 150
    },
    {
      title: 'Sản Phẩm',
      dataIndex: 'productNames',
      key: 'productNames',
      width: 250,
      render: (names, record) => {
        if (!names || names.length === 0) {
          return <span style={{ color: '#999', fontStyle: 'italic' }}>Chưa chọn</span>;
        }
        if (names.length === 1) {
          return <span>{names[0]}</span>;
        }
        return (
          <div>
            <Tag color="blue">{names.length} sản phẩm</Tag>
            <div style={{ fontSize: '11px', color: '#666', marginTop: '4px' }}>
              {names.slice(0, 2).join(', ')}
              {names.length > 2 && ` +${names.length - 2} khác`}
            </div>
          </div>
        );
      }
    },
    {
      title: 'Chi Phí Vận Chuyển',
      dataIndex: 'shippingCost',
      key: 'shippingCost',
      width: 150,
      render: (cost) => <span style={{ color: '#007A33', fontWeight: 'bold' }}>{formatCurrency(cost)}</span>
    },
    {
      title: 'Hình Thức',
      dataIndex: 'shippingMethod',
      key: 'shippingMethod',
      width: 150,
      render: (method) => getShippingMethodLabel(method)
    },
    {
      title: 'Ghi Chú',
      dataIndex: 'notes',
      key: 'notes',
      ellipsis: true
    },
    {
      title: 'Thao Tác',
      key: 'actions',
      width: 80,
      fixed: 'right',
      render: (_, record) => {
        const menuItems = [
          {
            key: 'view',
            icon: <EyeOutlined style={{ color: '#1890ff' }} />,
            label: 'Xem chi tiết',
            onClick: () => handleViewDetail(record)
          },
          {
            key: 'edit',
            icon: <EditOutlined style={{ color: '#007A33' }} />,
            label: 'Sửa',
            onClick: () => openEditModal(record)
          },
          {
            key: 'print',
            icon: <PrinterOutlined style={{ color: '#722ed1' }} />,
            label: 'In phiếu',
            onClick: () => handlePrintReceipt(record)
          },
          {
            type: 'divider'
          },
          {
            key: 'delete',
            icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
            label: (
              <Popconfirm
                title="Xác nhận xóa"
                description="Bạn có chắc chắn muốn xóa chi phí vận chuyển này?"
                onConfirm={(e) => {
                  e.stopPropagation();
                  handleDelete(record.id);
                }}
                okText="Xóa"
                cancelText="Hủy"
                okButtonProps={{ danger: true }}
              >
                <span>Xóa</span>
              </Popconfirm>
            ),
            danger: true
          }
        ];

        return (
          <Dropdown
            menu={{ items: menuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button 
              type="text" 
              icon={<MoreOutlined style={{ fontSize: '20px', fontWeight: 'bold' }} />}
              size="small"
            />
          </Dropdown>
        );
      }
    }
  ];

  return (
    <div className="shipping-cost-page" style={{ padding: '24px' }}>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 8 }}>
          <h1 style={{ margin: 0, color: '#007A33', fontSize: '28px', fontWeight: '700' }}>
            <TruckOutlined style={{ marginRight: 12 }} />
            Quản Lý Chi Phí Vận Chuyển
          </h1>
          {selectedStore && (
            <Tag color={selectedStore.id === 'all' ? 'blue' : 'green'} style={{ fontSize: '14px', padding: '4px 12px' }}>
              {selectedStore.id === 'all' ? '🏪 Toàn Bộ Cửa Hàng' : `📍 ${selectedStore.name}`}
            </Tag>
          )}
        </div>
        <p style={{ margin: '8px 0 0 0', color: '#666' }}>
          {selectedStore && selectedStore.id === 'all' 
            ? 'Theo dõi chi phí vận chuyển tất cả cửa hàng' 
            : `Theo dõi chi phí vận chuyển cửa hàng: ${selectedStore?.name || ''}`}
        </p>
      </div>

      {/* Statistics Cards */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Chi Phí Nhập Hàng"
              value={stats.totalImportCost}
              prefix={<TruckOutlined style={{ color: '#4facfe' }} />}
              formatter={(value) => formatCurrency(value)}
              suffix={<div style={{ fontSize: 12, color: '#999' }}>{stats.importCount} lần nhập</div>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Chi Phí Xuất Hàng"
              value={stats.totalExportCost}
              prefix={<TruckOutlined style={{ color: '#43e97b' }} />}
              formatter={(value) => formatCurrency(value)}
              suffix={<div style={{ fontSize: 12, color: '#999' }}>{stats.exportCount} lần xuất</div>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tổng Chi Phí"
              value={stats.totalShippingCost}
              prefix={<DollarOutlined style={{ color: '#fa709a' }} />}
              formatter={(value) => formatCurrency(value)}
              suffix={<div style={{ fontSize: 12, color: '#999' }}>{stats.totalTransactions} giao dịch</div>}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Chi Phí Trung Bình"
              value={stats.averageCost}
              prefix={<CalculatorOutlined style={{ color: '#a8edea' }} />}
              formatter={(value) => formatCurrency(value)}
              suffix={<div style={{ fontSize: 12, color: '#999' }}>Mỗi giao dịch</div>}
            />
          </Card>
        </Col>
      </Row>

      {/* Filters */}
      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16}>
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Khoảng Thời Gian</label>
              <RangePicker
                style={{ width: '100%' }}
                value={dateRange}
                onChange={setDateRange}
                format="DD/MM/YYYY"
              />
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Loại Giao Dịch</label>
              <Select
                style={{ width: '100%' }}
                value={typeFilter}
                onChange={setTypeFilter}
              >
                <Select.Option value="all">Tất cả</Select.Option>
                <Select.Option value="import">Nhập hàng</Select.Option>
                <Select.Option value="export">Xuất hàng</Select.Option>
              </Select>
            </div>
          </Col>
          <Col xs={24} sm={8}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Cửa Hàng</label>
              <Select
                style={{ width: '100%' }}
                value={storeFilter}
                onChange={setStoreFilter}
              >
                <Select.Option value="all">Tất cả cửa hàng</Select.Option>
                {stores.map(store => (
                  <Select.Option key={store.id} value={store.id}>{store.name}</Select.Option>
                ))}
              </Select>
            </div>
          </Col>
        </Row>
        <Row gutter={16}>
          <Col>
            <Button icon={<FilterOutlined />} onClick={applyFilters}>Lọc</Button>
          </Col>
          <Col>
            <Button onClick={clearFilters}>Xóa Lọc</Button>
          </Col>
          {canAdd && (
            <Col>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleAddNew}>
                Thêm Chi Phí Vận Chuyển
              </Button>
            </Col>
          )}
          {canExport && (
            <Col>
              <Button 
                icon={<ExportOutlined />} 
                onClick={exportToExcel}
                style={{ marginLeft: 8 }}
              >
                Xuất Excel
              </Button>
            </Col>
          )}
        </Row>
      </Card>

      {/* Table */}
      <Card 
        title={`Chi Tiết Chi Phí Vận Chuyển (${filteredData.length} kết quả)`}
        extra={
          <Space>
            {selectedRowKeys.length > 0 && (
              <>
                <span style={{ marginRight: 8 }}>
                  Đã chọn: <strong>{selectedRowKeys.length}</strong>
                </span>
                <Popconfirm
                  title="Xác nhận xóa nhiều"
                  description={`Bạn có chắc chắn muốn xóa ${selectedRowKeys.length} chi phí vận chuyển đã chọn?`}
                  onConfirm={handleBulkDelete}
                  okText="Xóa"
                  cancelText="Hủy"
                  okButtonProps={{ danger: true }}
                >
                  <Button 
                    danger 
                    icon={<DeleteOutlined />}
                  >
                    Xóa đã chọn
                  </Button>
                </Popconfirm>
              </>
            )}
            <Popconfirm
              title="Xác nhận xóa tất cả"
              description={`Bạn có chắc chắn muốn xóa TẤT CẢ ${filteredData.length} chi phí vận chuyển đang hiển thị?`}
              onConfirm={handleDeleteAll}
              okText="Xóa tất cả"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              disabled={filteredData.length === 0}
            >
              <Button 
                danger 
                icon={<DeleteOutlined />}
                disabled={filteredData.length === 0}
              >
                Xóa tất cả
              </Button>
            </Popconfirm>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredData}
          rowKey="id"
          loading={loading}
          rowSelection={{
            selectedRowKeys,
            onChange: (selectedKeys) => setSelectedRowKeys(selectedKeys),
            selections: [
              Table.SELECTION_ALL,
              Table.SELECTION_INVERT,
              Table.SELECTION_NONE,
            ],
          }}
          pagination={{
            pageSize: 15,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} bản ghi`
          }}
          scroll={{ x: 1500 }}
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        title={editingId ? 'Chỉnh Sửa Chi Phí Vận Chuyển' : 'Thêm Chi Phí Vận Chuyển'}
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        onOk={handleSave}
        width="70%"
        okText="Lưu"
        cancelText="Hủy"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="transactionType"
                label="Loại Giao Dịch"
                rules={[{ required: true, message: 'Vui lòng chọn loại giao dịch' }]}
              >
                <Select>
                  <Select.Option value="import">Nhập hàng</Select.Option>
                  <Select.Option value="export">Xuất hàng</Select.Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="date"
                label="Ngày Giao Dịch"
                rules={[{ required: true, message: 'Vui lòng chọn ngày' }]}
              >
                <DatePicker showTime style={{ width: '100%' }} format="DD/MM/YYYY HH:mm" />
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="storeId"
                label="Cửa Hàng"
                rules={[{ required: true, message: 'Vui lòng chọn cửa hàng' }]}
              >
                <Select>
                  {stores.map(store => (
                    <Select.Option key={store.id} value={store.id}>{store.name}</Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="productIds"
                label="Sản Phẩm"
              >
                <Select
                  mode="multiple"
                  showSearch
                  placeholder="Chọn sản phẩm (không bắt buộc)"
                  filterOption={(input, option) => {
                    const product = products.find(p => p.id === option.value);
                    if (!product) return false;
                    const searchText = `${product.name} ${product.sku || ''}`.toLowerCase();
                    return searchText.includes(input.toLowerCase());
                  }}
                  allowClear
                  maxTagCount={2}
                  maxTagPlaceholder={(omittedValues) => `+${omittedValues.length} sản phẩm`}
                >
                  {products.map(product => (
                    <Select.Option key={product.id} value={product.id}>
                      {product.name} {product.sku ? `(${product.sku})` : ''}
                    </Select.Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="shippingCost"
                label="Chi Phí Vận Chuyển (VNĐ)"
                rules={[{ required: true, message: 'Vui lòng nhập chi phí' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  max={100000000}
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/\$\s?|(,*)/g, '')}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="shippingMethod"
                label="Hình Thức Vận Chuyển"
                rules={[{ required: true, message: 'Vui lòng chọn hình thức vận chuyển' }]}
              >
                <Select>
                  <Select.Option value="xe_tai">Chành Xe</Select.Option>
                  <Select.Option value="ship_cod">Ship COD</Select.Option>
                  <Select.Option value="grab_express">Grab Express</Select.Option>
                  <Select.Option value="giao_hang_nhanh">Giao Hàng Nhanh</Select.Option>
                  <Select.Option value="giao_hang_tiet_kiem">Giao Hàng Tiết Kiệm</Select.Option>
                  <Select.Option value="viettel_post">Viettel Post</Select.Option>
                  <Select.Option value="vnpost">VN Post</Select.Option>
                  <Select.Option value="j_t_express">J&T Express</Select.Option>
                  <Select.Option value="shopee_express">Shopee Express</Select.Option>
                  <Select.Option value="lazada_express">Lazada Express</Select.Option>
                  <Select.Option value="khac">Khác</Select.Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="notes" label="Ghi Chú">
            <TextArea rows={3} placeholder="Nhập ghi chú về chi phí vận chuyển..." />
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail View Modal */}
      <Modal
        title="Chi Tiết Chi Phí Vận Chuyển"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="print" icon={<PrinterOutlined />} onClick={() => handlePrintReceipt(viewingRecord)}>
            In phiếu
          </Button>,
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Đóng
          </Button>
        ]}
        width={700}
      >
        {viewingRecord && (
          <Descriptions bordered column={2}>
            <Descriptions.Item label="Loại Giao Dịch" span={1}>
              <Tag color={viewingRecord.transactionType === 'import' ? 'blue' : 'green'}>
                {viewingRecord.transactionType === 'import' ? 'Nhập hàng' : 'Xuất hàng'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="Ngày Giao Dịch" span={1}>
              {dayjs(viewingRecord.date).format('DD/MM/YYYY HH:mm')}
            </Descriptions.Item>
            <Descriptions.Item label="Cửa Hàng" span={2}>
              {viewingRecord.storeName}
            </Descriptions.Item>
            <Descriptions.Item label="Sản Phẩm" span={2}>
              {viewingRecord.productNames && viewingRecord.productNames.length > 0 ? (
                <div>
                  {viewingRecord.productNames.map((name, index) => (
                    <Tag key={index} color="blue" style={{ marginBottom: 4 }}>
                      {name}
                    </Tag>
                  ))}
                </div>
              ) : (
                <span style={{ color: '#999', fontStyle: 'italic' }}>Chưa chọn</span>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="Chi Phí Vận Chuyển" span={2}>
              <span style={{ fontSize: '18px', color: '#007A33', fontWeight: 'bold' }}>
                {formatCurrency(viewingRecord.shippingCost)}
              </span>
            </Descriptions.Item>
            <Descriptions.Item label="Hình Thức Vận Chuyển" span={2}>
              {getShippingMethodLabel(viewingRecord.shippingMethod)}
            </Descriptions.Item>
            <Descriptions.Item label="Ghi Chú" span={2}>
              {viewingRecord.notes || <span style={{ color: '#999', fontStyle: 'italic' }}>Không có ghi chú</span>}
            </Descriptions.Item>
            <Descriptions.Item label="Ngày Tạo" span={1}>
              {dayjs(viewingRecord.createdAt).format('DD/MM/YYYY HH:mm:ss')}
            </Descriptions.Item>
            <Descriptions.Item label="Cập Nhật Lần Cuối" span={1}>
              {dayjs(viewingRecord.updatedAt).format('DD/MM/YYYY HH:mm:ss')}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default ShippingCost;
