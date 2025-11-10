import React, { useState, useEffect } from 'react';
import { Card, Input, Select, Table, Button, Modal, Form, InputNumber, Tag, Row, Col, Statistic, message, Popconfirm } from 'antd';
import { 
  PlusOutlined, 
  SearchOutlined, 
  DownloadOutlined, 
  EditOutlined, 
  DeleteOutlined,
  CheckCircleOutlined,
  PauseCircleOutlined,
  ExclamationCircleOutlined,
  BoxPlotOutlined
} from '@ant-design/icons';
import { database } from '../../services/firebase.service';
import { ref, onValue, update, remove, get } from 'firebase/database';
import { formatCurrency } from '../../utils/format';
import { useNavigate } from 'react-router-dom';
import './Products.css';

const { Search } = Input;
const { Option } = Select;
const { TextArea } = Form.Item;

const ManageProducts = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [editModalVisible, setEditModalVisible] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]); // For bulk delete
  
  const [stats, setStats] = useState({
    total: 0,
    active: 0,
    inactive: 0,
    outOfStock: 0
  });

  // Load categories
  useEffect(() => {
    const categoriesRef = ref(database, 'categories');
    onValue(categoriesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const categoriesList = Object.entries(data).map(([id, cat]) => ({
          id,
          ...cat
        }));
        setCategories(categoriesList);
      }
    });
  }, []);

  // Load products
  useEffect(() => {
    const productsRef = ref(database, 'products');
    onValue(productsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const productsList = Object.entries(data).map(([id, product]) => ({
          key: id,
          id,
          ...product
        }));
        setProducts(productsList);
        setFilteredProducts(productsList);
        calculateStats(productsList);
      } else {
        setProducts([]);
        setFilteredProducts([]);
      }
    });
  }, []);

  // Calculate stats
  const calculateStats = (productsList) => {
    const total = productsList.length;
    const active = productsList.filter(p => !p.status || p.status === 'active').length;
    const inactive = productsList.filter(p => p.status === 'inactive').length;
    const outOfStock = productsList.filter(p => p.status === 'out_of_stock' || (p.stock !== undefined && p.stock <= 0)).length;
    
    setStats({ total, active, inactive, outOfStock });
  };

  // Apply filters
  useEffect(() => {
    let filtered = [...products];

    // Search filter
    if (searchText) {
      filtered = filtered.filter(p => 
        p.name.toLowerCase().includes(searchText.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchText.toLowerCase()))
      );
    }

    // Category filter
    if (categoryFilter) {
      filtered = filtered.filter(p => p.categoryId === categoryFilter);
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    setFilteredProducts(filtered);
  }, [searchText, categoryFilter, statusFilter, products]);

  // Get category name
  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Chưa phân loại';
  };

  // Get status info
  const getStatusInfo = (status, stock) => {
    if (status === 'out_of_stock' || stock <= 0) {
      return { text: 'Hết hàng', color: 'red' };
    }
    if (status === 'inactive') {
      return { text: 'Ngừng bán', color: 'orange' };
    }
    return { text: 'Đang bán', color: 'green' };
  };

  // Edit product
  const handleEdit = (product) => {
    setEditingProduct(product);
    form.setFieldsValue({
      name: product.name,
      sku: product.sku,
      categoryId: product.categoryId,
      price: product.price,
      stock: product.stock || 0,
      unit: product.unit || 'cai',
      conversion: product.conversion,
      status: product.status || 'active',
      description: product.description
    });
    setEditModalVisible(true);
  };

  // Save edit
  const handleSaveEdit = async () => {
    try {
      const values = await form.validateFields();
      
      const productRef = ref(database, `products/${editingProduct.id}`);
      await update(productRef, {
        ...values,
        updatedAt: new Date().toISOString()
      });

      message.success('Cập nhật sản phẩm thành công!');
      setEditModalVisible(false);
      setEditingProduct(null);
      form.resetFields();
    } catch (error) {
      message.error('Lỗi cập nhật sản phẩm: ' + error.message);
    }
  };

  // Export Excel
  const handleExport = () => {
    try {
      const headers = ['STT', 'Tên sản phẩm', 'SKU', 'Danh mục', 'Giá bán', 'Tồn kho', 'Đơn vị', 'Trạng thái'];
      const csvContent = [
        headers.join(','),
        ...filteredProducts.map((product, index) => {
          const statusInfo = getStatusInfo(product.status, product.stock);
          return [
            index + 1,
            `"${product.name}"`,
            `"${product.sku || 'N/A'}"`,
            `"${getCategoryName(product.categoryId)}"`,
            product.price || 0,
            product.stock || 0,
            `"${product.unit || 'cái'}"`,
            `"${statusInfo.text}"`
          ].join(',');
        })
      ].join('\n');
      
      const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `danh-sach-san-pham-${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      message.success('Xuất file thành công!');
    } catch (error) {
      message.error('Lỗi xuất file: ' + error.message);
    }
  };

  // Table columns
  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      render: (_, __, index) => index + 1
    },
    {
      title: 'Tên sản phẩm',
      dataIndex: 'name',
      key: 'name',
      width: 200
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
      render: (sku) => sku || 'N/A'
    },
    {
      title: 'Danh mục',
      dataIndex: 'categoryId',
      key: 'category',
      width: 150,
      render: (categoryId) => getCategoryName(categoryId)
    },
    {
      title: 'Giá bán',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      align: 'right',
      render: (price) => formatCurrency(price)
    },
    {
      title: 'Tồn kho',
      dataIndex: 'stock',
      key: 'stock',
      width: 100,
      align: 'center',
      render: (stock) => {
        const stockClass = stock <= 0 ? 'out' : stock <= 10 ? 'low' : '';
        return <span className={`stock-badge ${stockClass}`}>{stock || 0}</span>;
      }
    },
    {
      title: 'Đơn vị',
      dataIndex: 'unit',
      key: 'unit',
      width: 100,
      align: 'center',
      render: (unit) => unit || 'cái'
    },
    {
      title: 'Quy đổi',
      dataIndex: 'conversion',
      key: 'conversion',
      width: 120,
      align: 'center',
      render: (conversion) => conversion || '-'
    },
    {
      title: 'Trạng thái',
      key: 'status',
      width: 120,
      align: 'center',
      render: (_, record) => {
        const statusInfo = getStatusInfo(record.status, record.stock);
        return <Tag color={statusInfo.color}>{statusInfo.text}</Tag>;
      }
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      align: 'center',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }} onClick={(e) => e.stopPropagation()}>
          <Button 
            type="primary" 
            icon={<EditOutlined />} 
            size="small"
            onClick={(e) => {
              e.stopPropagation();
              handleEdit(record);
            }}
          />
          <Popconfirm
            title="Xác nhận xóa"
            description={`Bạn có chắc muốn xóa "${record.name}"?`}
            onConfirm={async () => {
              try {
                // Delete product
                const productRef = ref(database, `products/${record.id}`);
                await remove(productRef);
                
                // Also delete from sellingProducts if exists
                const sellingProductsRef = ref(database, 'sellingProducts');
                const snapshot = await get(sellingProductsRef);
                if (snapshot.exists()) {
                  const sellingProducts = snapshot.val();
                  const deletePromises = [];
                  Object.keys(sellingProducts).forEach(key => {
                    if (sellingProducts[key].productId === record.id) {
                      deletePromises.push(remove(ref(database, `sellingProducts/${key}`)));
                    }
                  });
                  if (deletePromises.length > 0) {
                    await Promise.all(deletePromises);
                  }
                }
                
                message.success('Xóa sản phẩm thành công!');
              } catch (error) {
                message.error('Lỗi xóa sản phẩm: ' + error.message);
              }
            }}
            okText="Xóa"
            cancelText="Hủy"
            okButtonProps={{ danger: true }}
          >
            <Button 
              danger 
              icon={<DeleteOutlined />} 
              size="small"
              onClick={(e) => e.stopPropagation()}
            />
          </Popconfirm>
        </div>
      )
    }
  ];

  return (
    <div className="manage-products-page">
      {/* Page Header */}
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ margin: 0, color: '#007A33', fontSize: '28px', fontWeight: '700' }}>
            <BoxPlotOutlined /> Quản Lý Sản Phẩm
          </h1>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          {selectedRowKeys.length > 0 && (
            <Popconfirm
              title="Xác nhận xóa hàng loạt"
              description={`Bạn có chắc muốn xóa ${selectedRowKeys.length} sản phẩm đã chọn?`}
              onConfirm={async () => {
                try {
                  console.log('🗑️ Bulk deleting:', selectedRowKeys);
                  
                  // Delete products
                  const deleteProductPromises = selectedRowKeys.map(productId => {
                    const productRef = ref(database, `products/${productId}`);
                    return remove(productRef);
                  });
                  await Promise.all(deleteProductPromises);
                  
                  // Also delete from sellingProducts
                  const sellingProductsRef = ref(database, 'sellingProducts');
                  const snapshot = await get(sellingProductsRef);
                  if (snapshot.exists()) {
                    const sellingProducts = snapshot.val();
                    const deleteSellingPromises = [];
                    Object.keys(sellingProducts).forEach(key => {
                      if (selectedRowKeys.includes(sellingProducts[key].productId)) {
                        deleteSellingPromises.push(remove(ref(database, `sellingProducts/${key}`)));
                      }
                    });
                    if (deleteSellingPromises.length > 0) {
                      await Promise.all(deleteSellingPromises);
                    }
                  }
                  
                  message.success(`Đã xóa ${selectedRowKeys.length} sản phẩm thành công!`);
                  setSelectedRowKeys([]);
                } catch (error) {
                  message.error('Lỗi xóa sản phẩm: ' + error.message);
                }
              }}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button 
                danger 
                icon={<DeleteOutlined />}
              >
                Xóa Đã Chọn ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
          )}
          <Button icon={<DownloadOutlined />} onClick={handleExport}>
            Xuất Excel
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/products/add')}>
            Thêm Sản Phẩm
          </Button>
        </div>
      </div>

      {/* Search and Filter */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '16px' }}>
          <Search
            placeholder="Tìm kiếm sản phẩm theo tên, SKU..."
            allowClear
            prefix={<SearchOutlined />}
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: '100%' }}
          />
          <Select
            placeholder="Tất cả danh mục"
            allowClear
            onChange={(value) => setCategoryFilter(value || '')}
            style={{ width: '100%' }}
          >
            {categories.map(cat => (
              <Option key={cat.id} value={cat.id}>{cat.name}</Option>
            ))}
          </Select>
          <Select
            placeholder="Tất cả trạng thái"
            allowClear
            onChange={(value) => setStatusFilter(value || '')}
            style={{ width: '100%' }}
          >
            <Option value="active">Đang bán</Option>
            <Option value="inactive">Ngừng bán</Option>
            <Option value="out_of_stock">Hết hàng</Option>
          </Select>
        </div>
      </Card>

      {/* Stats Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tổng sản phẩm"
              value={stats.total}
              prefix={<BoxPlotOutlined style={{ color: '#667eea' }} />}
              valueStyle={{ color: '#667eea' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Đang bán"
              value={stats.active}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Ngừng bán"
              value={stats.inactive}
              prefix={<PauseCircleOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Hết hàng"
              value={stats.outOfStock}
              prefix={<ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Products Table */}
      <Card>
        {filteredProducts.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '50px' }}>
            <BoxPlotOutlined style={{ fontSize: '64px', color: '#ccc' }} />
            <h3 style={{ marginTop: '16px' }}>Chưa có sản phẩm nào</h3>
            <p style={{ color: '#666' }}>Hãy thêm sản phẩm đầu tiên để bắt đầu bán hàng</p>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/products/add')}>
              Thêm Sản Phẩm
            </Button>
          </div>
        ) : (
          <Table
            columns={columns}
            dataSource={filteredProducts}
            rowKey="id"
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
              selections: [
                Table.SELECTION_ALL,
                Table.SELECTION_INVERT,
                Table.SELECTION_NONE,
              ],
            }}
            pagination={{ pageSize: 10, showSizeChanger: true, showTotal: (total) => `Tổng ${total} sản phẩm` }}
            scroll={{ x: 1200 }}
          />
        )}
      </Card>

      {/* Edit Modal */}
      <Modal
        title="Chỉnh Sửa Sản Phẩm"
        open={editModalVisible}
        onOk={handleSaveEdit}
        onCancel={() => {
          setEditModalVisible(false);
          setEditingProduct(null);
          form.resetFields();
        }}
        okText="Lưu thay đổi"
        cancelText="Hủy"
        width={700}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Tên sản phẩm"
            name="name"
            rules={[{ required: true, message: 'Vui lòng nhập tên sản phẩm!' }]}
          >
            <Input />
          </Form.Item>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Form.Item label="SKU" name="sku">
              <Input />
            </Form.Item>

            <Form.Item
              label="Danh mục"
              name="categoryId"
              rules={[{ required: true, message: 'Vui lòng chọn danh mục!' }]}
            >
              <Select>
                {categories.map(cat => (
                  <Option key={cat.id} value={cat.id}>{cat.name}</Option>
                ))}
              </Select>
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Form.Item
              label="Giá bán (đ)"
              name="price"
              rules={[{ required: true, message: 'Vui lòng nhập giá!' }]}
            >
              <InputNumber
                style={{ width: '100%' }}
                min={0}
                formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                parser={value => value.replace(/\$\s?|(,*)/g, '')}
              />
            </Form.Item>

            <Form.Item label="Số lượng tồn kho" name="stock">
              <InputNumber style={{ width: '100%' }} min={0} />
            </Form.Item>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Form.Item label="Đơn vị tính" name="unit">
              <Input />
            </Form.Item>

            <Form.Item label="Quy đổi" name="conversion">
              <Input />
            </Form.Item>
          </div>

          <Form.Item label="Trạng thái" name="status">
            <Select>
              <Option value="active">Đang bán</Option>
              <Option value="inactive">Ngừng bán</Option>
              <Option value="out_of_stock">Hết hàng</Option>
            </Select>
          </Form.Item>

          <Form.Item label="Mô tả sản phẩm" name="description">
            <Input.TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>

    </div>
  );
};

export default ManageProducts;
