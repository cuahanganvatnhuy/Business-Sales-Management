import React, { useState, useEffect } from 'react';
import { database } from '../../services/firebase.service';
import { ref, onValue, update } from 'firebase/database';
import {
  Card, Row, Col, Table, Tag, Button, Input, Select, Modal, InputNumber,
  message, Statistic, Space, Popconfirm
} from 'antd';
import {
  InboxOutlined, DollarOutlined, WarningOutlined, StopOutlined,
  PlusOutlined, ImportOutlined, ExportOutlined, EditOutlined,
  SearchOutlined, FileExcelOutlined, DeleteOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';

const { Option } = Select;
const { Search } = Input;

const Inventory = () => {
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // Filters
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Selection
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  
  // Modals
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustQuantity, setAdjustQuantity] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');

  // Load products
  useEffect(() => {
    setLoading(true);
    const productsRef = ref(database, 'products');
    const unsubscribe = onValue(productsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const productsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setProducts(productsArray);
        setFilteredProducts(productsArray);
      } else {
        setProducts([]);
        setFilteredProducts([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load categories
  useEffect(() => {
    const categoriesRef = ref(database, 'categories');
    const unsubscribe = onValue(categoriesRef, (snapshot) => {
      const data = snapshot.val();
      setCategories(data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : []);
    });
    return () => unsubscribe();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...products];
    
    if (searchText) {
      filtered = filtered.filter(p => 
        p.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(p => p.categoryId === categoryFilter);
    }
    
    if (statusFilter !== 'all') {
      if (statusFilter === 'out') {
        filtered = filtered.filter(p => p.inventory === 0);
      } else if (statusFilter === 'low') {
        filtered = filtered.filter(p => p.inventory > 0 && p.inventory < 10);
      } else if (statusFilter === 'in') {
        filtered = filtered.filter(p => p.inventory >= 10);
      }
    }
    
    setFilteredProducts(filtered);
  }, [products, searchText, categoryFilter, statusFilter]);

  // Calculate statistics
  const totalProducts = products.length;
  const totalValue = products.reduce((sum, p) => sum + ((p.price || 0) * (p.inventory || 0)), 0);
  const lowStock = products.filter(p => p.inventory > 0 && p.inventory < 10).length;
  const outOfStock = products.filter(p => p.inventory === 0).length;

  // Handle adjust inventory (single or bulk)
  const handleAdjust = async () => {
    if (adjustQuantity === 0) {
      message.error('Vui lòng nhập số lượng điều chỉnh!');
      return;
    }
    
    try {
      const updates = {};
      const productsToAdjust = selectedProduct 
        ? [selectedProduct] 
        : products.filter(p => selectedRowKeys.includes(p.id));
      
      if (productsToAdjust.length === 0) {
        message.error('Vui lòng chọn sản phẩm!');
        return;
      }
      
      // Check all products can be adjusted
      for (const product of productsToAdjust) {
        const newInventory = (product.inventory || 0) + adjustQuantity;
        if (newInventory < 0) {
          message.error(`Sản phẩm "${product.name}" không đủ tồn kho để điều chỉnh!`);
          return;
        }
      }
      
      // Apply adjustments
      productsToAdjust.forEach((product, index) => {
        const newInventory = (product.inventory || 0) + adjustQuantity;
        updates[`products/${product.id}/inventory`] = newInventory;
        updates[`products/${product.id}/updatedAt`] = new Date().toISOString();
        
        // Log transaction
        const transactionId = `txn_${Date.now()}_${index}`;
        updates[`warehouseTransactions/${transactionId}`] = {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          type: adjustQuantity > 0 ? 'import' : 'export',
          quantity: Math.abs(adjustQuantity),
          beforeQuantity: product.inventory || 0,
          afterQuantity: newInventory,
          reason: adjustReason || 'Điều chỉnh tồn kho',
          createdAt: new Date().toISOString()
        };
      });
      
      await update(ref(database), updates);
      message.success(`Đã điều chỉnh ${productsToAdjust.length} sản phẩm thành công!`);
      setAdjustModalVisible(false);
      setSelectedProduct(null);
      setSelectedRowKeys([]);
      setAdjustQuantity(0);
      setAdjustReason('');
    } catch (error) {
      console.error('Error:', error);
      message.error('Có lỗi xảy ra!');
    }
  };

  // Export Excel
  const exportExcel = () => {
    const data = filteredProducts.map((p, i) => ({
      'STT': i + 1,
      'Sản Phẩm': p.name,
      'SKU': p.sku,
      'Danh Mục': categories.find(c => c.id === p.categoryId)?.name || 'N/A',
      'Đơn Vị': p.unit,
      'Tồn Kho': p.inventory || 0,
      'Giá Nhập': p.price || 0,
      'Giá Trị': (p.price || 0) * (p.inventory || 0),
      'Trạng Thái': p.inventory === 0 ? 'Hết hàng' : p.inventory < 10 ? 'Sắp hết' : 'Còn hàng'
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kho Hàng');
    XLSX.writeFile(wb, `KhoHang_${dayjs().format('YYYYMMDD')}.xlsx`);
    message.success('Đã xuất Excel!');
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
      dataIndex: 'name',
      key: 'name',
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
      dataIndex: 'categoryId',
      key: 'category',
      width: 150,
      render: (categoryId) => categories.find(c => c.id === categoryId)?.name || 'N/A'
    },
    {
      title: 'Đơn Vị',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
      align: 'center'
    },
    {
      title: 'Tồn Kho',
      dataIndex: 'inventory',
      key: 'inventory',
      width: 100,
      align: 'center',
      sorter: (a, b) => (a.inventory || 0) - (b.inventory || 0),
      render: (inv) => <span style={{ fontWeight: 'bold' }}>{inv || 0}</span>
    },
    {
      title: 'Giá Nhập',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      align: 'right',
      render: (price) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price || 0)
    },
    {
      title: 'Giá Trị',
      key: 'value',
      width: 120,
      align: 'right',
      render: (_, record) => {
        const value = (record.price || 0) * (record.inventory || 0);
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
      }
    },
    {
      title: 'Trạng Thái',
      key: 'status',
      width: 100,
      align: 'center',
      render: (_, record) => {
        if (record.inventory === 0) return <Tag color="red">Hết hàng</Tag>;
        if (record.inventory < 10) return <Tag color="orange">Sắp hết</Tag>;
        return <Tag color="green">Còn hàng</Tag>;
      }
    },
    {
      title: 'Thao Tác',
      key: 'action',
      width: 100,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          icon={<EditOutlined />}
          onClick={() => {
            setSelectedProduct(record);
            setAdjustModalVisible(true);
          }}
        >
          Điều chỉnh
        </Button>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <Card style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <InboxOutlined style={{ fontSize: 32, color: '#007A33' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 24, color: '#007A33' }}>Kho Hàng</h1>
            <p style={{ margin: 0, color: '#666' }}>Quản lý tồn kho sản phẩm</p>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tổng Sản Phẩm"
              value={totalProducts}
              prefix={<InboxOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Giá Trị Kho"
              value={totalValue}
              prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
              formatter={(value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Sắp Hết Hàng"
              value={lowStock}
              prefix={<WarningOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Hết Hàng"
              value={outOfStock}
              prefix={<StopOutlined style={{ color: '#f5222d' }} />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Actions & Filters */}
      <Card title="Danh Sách Sản Phẩm Kho" style={{ marginBottom: 24, borderRadius: 12 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button type="primary" icon={<PlusOutlined />}>Nhập Kho Thêm</Button>
            <Button icon={<ImportOutlined />} style={{ background: '#52c41a', color: 'white', borderColor: '#52c41a' }}>
              Tạo Sản Phẩm Mới Vào Kho
            </Button>
            <Button icon={<ExportOutlined />}>Xuất Kho</Button>
            <Button icon={<EditOutlined />}>Điều Chỉnh</Button>
            {selectedRowKeys.length > 0 && (
              <Button 
                type="primary"
                danger
                icon={<EditOutlined />}
                onClick={() => {
                  setSelectedProduct(null);
                  setAdjustModalVisible(true);
                }}
              >
                Điều Chỉnh Đã Chọn ({selectedRowKeys.length})
              </Button>
            )}
            <Button icon={<FileExcelOutlined />} onClick={exportExcel} style={{ background: '#52c41a', color: 'white', borderColor: '#52c41a' }}>
              Xuất Báo Cáo
            </Button>
          </div>

          {/* Filters */}
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Search
                placeholder="Tìm sản phẩm, SKU..."
                allowClear
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                prefix={<SearchOutlined />}
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
            <Col xs={24} md={8}>
              <Select
                placeholder="Trạng thái"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: '100%' }}
              >
                <Option value="all">Tất cả trạng thái</Option>
                <Option value="in">Còn hàng</Option>
                <Option value="low">Sắp hết hàng</Option>
                <Option value="out">Hết hàng</Option>
              </Select>
            </Col>
          </Row>

          {/* Table */}
          <Table
            columns={columns}
            dataSource={filteredProducts}
            rowKey="id"
            loading={loading}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
              selections: [
                Table.SELECTION_ALL,
                Table.SELECTION_INVERT,
                Table.SELECTION_NONE,
              ],
            }}
            pagination={{ pageSize: 10, showSizeChanger: true }}
            scroll={{ x: 1400 }}
          />
        </Space>
      </Card>

      {/* Adjust Modal */}
      <Modal
        title={selectedProduct ? "Điều Chỉnh Tồn Kho" : `Điều Chỉnh Hàng Loạt (${selectedRowKeys.length} sản phẩm)`}
        open={adjustModalVisible}
        onOk={handleAdjust}
        onCancel={() => {
          setAdjustModalVisible(false);
          setSelectedProduct(null);
          setSelectedRowKeys([]);
          setAdjustQuantity(0);
          setAdjustReason('');
        }}
        okText="Lưu"
        cancelText="Hủy"
        width={selectedProduct ? 600 : 700}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {selectedProduct ? (
            // Single product adjustment
            <>
              <div>
                <strong>Sản phẩm:</strong> {selectedProduct.name}
              </div>
              <div>
                <strong>SKU:</strong> {selectedProduct.sku}
              </div>
              <div>
                <strong>Tồn kho hiện tại:</strong> <span style={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff' }}>{selectedProduct.inventory || 0}</span>
              </div>
            </>
          ) : (
            // Bulk adjustment
            <div style={{ padding: 12, background: '#fff7e6', borderRadius: 8, border: '1px solid #faad14' }}>
              <div style={{ marginBottom: 8 }}>
                <strong>⚠️ Điều chỉnh hàng loạt {selectedRowKeys.length} sản phẩm</strong>
              </div>
              <div style={{ fontSize: 13, color: '#666' }}>
                Số lượng điều chỉnh sẽ được áp dụng cho tất cả {selectedRowKeys.length} sản phẩm đã chọn.
              </div>
            </div>
          )}
          
          <div>
            <label>Số lượng điều chỉnh:</label>
            <InputNumber
              value={adjustQuantity}
              onChange={setAdjustQuantity}
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Nhập số dương để tăng, số âm để giảm"
            />
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Nhập số dương để tăng, số âm để giảm
            </div>
          </div>
          
          <div>
            <label>Lý do:</label>
            <Input.TextArea
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              rows={3}
              placeholder="Nhập lý do điều chỉnh..."
              style={{ marginTop: 8 }}
            />
          </div>
          
          {selectedProduct && adjustQuantity !== 0 && (
            <div style={{ padding: 12, background: '#f0f9ff', borderRadius: 8, border: '1px solid #1890ff' }}>
              <strong>Tồn kho sau điều chỉnh:</strong>{' '}
              <span style={{ fontSize: 18, fontWeight: 'bold', color: adjustQuantity > 0 ? '#52c41a' : '#f5222d' }}>
                {(selectedProduct.inventory || 0) + adjustQuantity}
              </span>
            </div>
          )}
        </Space>
      </Modal>
    </div>
  );
};

export default Inventory;
