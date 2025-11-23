import React, { useState, useEffect } from 'react';
import { database } from '../../services/firebase.service';
import { useAuth } from '../../contexts/AuthContext';
import { ref, onValue, push, set, update, remove } from 'firebase/database';
import {
  Card,
  Table,
  Button,
  Input,
  Space,
  Tag,
  Row,
  Col,
  Statistic,
  message,
  Modal,
  Form,
  Select
} from 'antd';
import {
  ShopOutlined,
  SearchOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
  UserOutlined,
  ShoppingOutlined
} from '@ant-design/icons';

const { Option } = Select;

const ManageStores = () => {
  const { user, isAdmin } = useAuth();
  const userPermissions = user?.permissions || [];
  const hasPermission = isAdmin || userPermissions.includes('stores.manage.view');
  const canAddStore = isAdmin || userPermissions.includes('stores.manage.add');
  const canEditStore = isAdmin || userPermissions.includes('stores.manage.edit');
  const canDeleteStore = isAdmin || userPermissions.includes('stores.manage.delete');

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Quản Lý Cửa Hàng. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }
  const [stores, setStores] = useState([]);
  const [filteredStores, setFilteredStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [modalVisible, setModalVisible] = useState(false);
  const [editingStore, setEditingStore] = useState(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedStore, setSelectedStore] = useState(null);
  const [form] = Form.useForm();

  // Load stores from Firebase
  useEffect(() => {
    setLoading(true);
    const storesRef = ref(database, 'stores');
    
    const unsubscribe = onValue(storesRef, async (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Load order counts for each store by type
        const ordersRef = ref(database, 'salesOrders');
        onValue(ordersRef, (ordersSnapshot) => {
          const ordersData = ordersSnapshot.val();
          const orderStats = {}; // { storeName: { total, ecommerce, retail, wholesale } }
          
          if (ordersData) {
            Object.values(ordersData).forEach(order => {
              const storeName = order.storeName || 'N/A';
              const orderType = order.orderType || 'unknown';
              
              if (!orderStats[storeName]) {
                orderStats[storeName] = {
                  total: 0,
                  ecommerce: 0,
                  retail: 0,
                  wholesale: 0
                };
              }
              
              orderStats[storeName].total += 1;
              
              if (orderType === 'ecommerce') {
                orderStats[storeName].ecommerce += 1;
              } else if (orderType === 'retail') {
                orderStats[storeName].retail += 1;
              } else if (orderType === 'wholesale') {
                orderStats[storeName].wholesale += 1;
              }
            });
          }

          const storesArray = Object.keys(data).map(key => ({
            id: key,
            ...data[key],
            orderCount: orderStats[data[key].name]?.total || 0,
            ecommerceCount: orderStats[data[key].name]?.ecommerce || 0,
            retailCount: orderStats[data[key].name]?.retail || 0,
            wholesaleCount: orderStats[data[key].name]?.wholesale || 0
          })).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          
          setStores(storesArray);
          setFilteredStores(storesArray);
          setLoading(false);
        }, { onlyOnce: true });
      } else {
        setStores([]);
        setFilteredStores([]);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Search and filter
  useEffect(() => {
    let filtered = [...stores];

    if (searchText) {
      filtered = filtered.filter(store =>
        store.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        store.address?.toLowerCase().includes(searchText.toLowerCase()) ||
        store.phone?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(store => store.status === statusFilter);
    }

    setFilteredStores(filtered);
  }, [searchText, statusFilter, stores]);

  // Open add/edit modal
  const handleOpenModal = (store = null) => {
    if (store) {
      if (!canEditStore) {
        message.error('Bạn không có quyền chỉnh sửa cửa hàng.');
        return;
      }
      setEditingStore(store);
      form.setFieldsValue(store);
    } else {
      if (!canAddStore) {
        message.error('Bạn không có quyền thêm cửa hàng.');
        return;
      }
      setEditingStore(null);
      form.resetFields();
    }
    setModalVisible(true);
  };

  // Save store (add or edit)
  const handleSaveStore = async () => {
    if (editingStore) {
      if (!canEditStore) {
        message.error('Bạn không có quyền chỉnh sửa cửa hàng.');
        return;
      }
    } else {
      if (!canAddStore) {
        message.error('Bạn không có quyền thêm cửa hàng.');
        return;
      }
    }

    try {
      const values = await form.validateFields();
      setLoading(true);

      if (editingStore) {
        // Update existing store
        const storeRef = ref(database, `stores/${editingStore.id}`);
        await update(storeRef, {
          ...values,
          updatedAt: new Date().toISOString()
        });
        message.success('Đã cập nhật cửa hàng!');
      } else {
        // Create new store
        const storesRef = ref(database, 'stores');
        const newStoreRef = push(storesRef);
        await set(newStoreRef, {
          ...values,
          status: values.status || 'active',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        });
        message.success('Đã thêm cửa hàng mới!');
      }

      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('Error saving store:', error);
      message.error('Lỗi khi lưu cửa hàng: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete store
  const handleDeleteStore = async (store) => {
    if (!canDeleteStore) {
      message.error('Bạn không có quyền xóa cửa hàng.');
      return;
    }

    try {
      setLoading(true);
      const storeRef = ref(database, `stores/${store.id}`);
      await remove(storeRef);
      message.success('Đã xóa cửa hàng!');
    } catch (error) {
      console.error('Error deleting store:', error);
      message.error('Lỗi khi xóa cửa hàng: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Table columns
  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      render: (_, __, index) => index + 1
    },
    {
      title: 'Tên Cửa Hàng',
      dataIndex: 'name',
      key: 'name',
      width: 200,
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#007A33', fontSize: 16 }}>
            <ShopOutlined style={{ marginRight: 8 }} />
            {name}
          </div>
          <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
            <EnvironmentOutlined style={{ marginRight: 4 }} />
            {record.address}
          </div>
        </div>
      )
    },
    {
      title: 'Số Điện Thoại',
      dataIndex: 'phone',
      key: 'phone',
      width: 130,
      render: (phone) => (
        <span>
          <PhoneOutlined style={{ marginRight: 4, color: '#1890ff' }} />
          {phone || '-'}
        </span>
      )
    },
    {
      title: 'Người Quản Lý',
      dataIndex: 'manager',
      key: 'manager',
      width: 150,
      render: (manager) => (
        <span>
          <UserOutlined style={{ marginRight: 4, color: '#722ed1' }} />
          {manager || '-'}
        </span>
      )
    },
    {
      title: 'Số Đơn Hàng',
      dataIndex: 'orderCount',
      key: 'orderCount',
      width: 120,
      align: 'center',
      sorter: (a, b) => a.orderCount - b.orderCount,
      render: (count) => (
        <Tag color={count > 0 ? 'blue' : 'default'} style={{ fontSize: 14 }}>
          <ShoppingOutlined style={{ marginRight: 4 }} />
          {count} đơn
        </Tag>
      )
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center',
      render: (status) => {
        const config = {
          active: { text: 'Đang hoạt động', color: 'green' },
          inactive: { text: 'Ngừng hoạt động', color: 'red' }
        };
        const statusConfig = config[status] || config.active;
        return <Tag color={statusConfig.color}>{statusConfig.text}</Tag>;
      }
    },
    {
      title: 'Thao Tác',
      key: 'action',
      width: 150,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
           
            size="small"
            onClick={() => {
              setSelectedStore(record);
              setDetailModalVisible(true);
            }}
          >
            Xem
          </Button>
          <Button
            type="primary"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleOpenModal(record)}
            style={{ background: '#faad14', borderColor: '#faad14' }}
          >
            Sửa
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            size="small"
            onClick={() => {
              Modal.confirm({
                title: 'Xóa cửa hàng?',
                content: `Bạn có chắc chắn muốn xóa cửa hàng "${record.name}"?`,
                okText: 'Xóa',
                cancelText: 'Hủy',
                okButtonProps: { danger: true },
                onOk: () => handleDeleteStore(record)
              });
            }}
          >
            Xóa
          </Button>
        </Space>
      )
    }
  ];

  // Calculate statistics
  const totalStores = filteredStores.length;
  const activeStores = filteredStores.filter(s => s.status === 'active').length;
  const inactiveStores = filteredStores.filter(s => s.status === 'inactive').length;
  const totalOrders = filteredStores.reduce((sum, s) => sum + s.orderCount, 0);

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <Card style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShopOutlined style={{ fontSize: 32, color: '#007A33' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 24, color: '#007A33' }}>Quản Lý Cửa Hàng</h1>
            <p style={{ margin: 0, color: '#666' }}>Quản lý thông tin và thống kê các cửa hàng</p>
          </div>
        </div>
      </Card>

      {/* Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Tổng Cửa Hàng"
              value={totalStores}
              prefix={<ShopOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Đang Hoạt Động"
              value={activeStores}
              prefix={<ShopOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Ngừng Hoạt Động"
              value={inactiveStores}
              prefix={<ShopOutlined style={{ color: '#ff4d4f' }} />}
              valueStyle={{ color: '#ff4d4f' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Tổng Đơn Hàng"
              value={totalOrders}
              prefix={<ShoppingOutlined style={{ color: '#722ed1' }} />}
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card
        title="Danh Sách Cửa Hàng"
        extra={
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenModal()}
            style={{ background: '#52c41a', borderColor: '#52c41a' }}
          >
            Thêm Cửa Hàng
          </Button>
        }
        style={{ borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}
      >
        <Row gutter={16} style={{ marginBottom: 16 }}>
          <Col xs={24} md={16}>
            <Input
              placeholder="Tìm theo tên, địa chỉ, số điện thoại..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={8}>
            <Select
              placeholder="Lọc theo trạng thái"
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: '100%' }}
            >
              <Option value="all">Tất cả trạng thái</Option>
              <Option value="active">Đang hoạt động</Option>
              <Option value="inactive">Ngừng hoạt động</Option>
            </Select>
          </Col>
        </Row>

        <Table
          loading={loading}
          columns={columns}
          dataSource={filteredStores}
          rowKey="id"
          scroll={{ x: 1200 }}
          pagination={{
            total: filteredStores.length,
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} cửa hàng`
          }}
          locale={{
            emptyText: (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <ShopOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
                <p style={{ fontSize: 16, color: '#666' }}>Chưa có cửa hàng nào</p>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => handleOpenModal()}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                >
                  Thêm Cửa Hàng Đầu Tiên
                </Button>
              </div>
            )
          }}
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        title={
          <span>
            <ShopOutlined style={{ marginRight: 8, color: '#007A33' }} />
            {editingStore ? 'Chỉnh Sửa Cửa Hàng' : 'Thêm Cửa Hàng Mới'}
          </span>
        }
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        onOk={handleSaveStore}
        okText={editingStore ? 'Cập Nhật' : 'Thêm Mới'}
        cancelText="Hủy"
        width={600}
        okButtonProps={{
          style: { background: '#52c41a', borderColor: '#52c41a' }
        }}
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 16 }}
        >
          <Form.Item
            label="Tên Cửa Hàng"
            name="name"
            rules={[{ required: true, message: 'Vui lòng nhập tên cửa hàng!' }]}
          >
            <Input
              prefix={<ShopOutlined />}
              placeholder="VD: Cửa hàng Quận 1"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="Địa Chỉ"
            name="address"
            rules={[{ required: true, message: 'Vui lòng nhập địa chỉ!' }]}
          >
            <Input
              prefix={<EnvironmentOutlined />}
              placeholder="VD: 123 Nguyễn Huệ, Quận 1, TP.HCM"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="Số Điện Thoại"
            name="phone"
            rules={[
              { required: true, message: 'Vui lòng nhập số điện thoại!' },
              { pattern: /^[0-9]{10,11}$/, message: 'Số điện thoại không hợp lệ!' }
            ]}
          >
            <Input
              prefix={<PhoneOutlined />}
              placeholder="VD: 0901234567"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="Người Quản Lý"
            name="manager"
          >
            <Input
              prefix={<UserOutlined />}
              placeholder="VD: Nguyễn Văn A"
              size="large"
            />
          </Form.Item>

          <Form.Item
            label="Trạng Thái"
            name="status"
            initialValue="active"
          >
            <Select size="large">
              <Option value="active">
                <Tag color="green">Đang hoạt động</Tag>
              </Option>
              <Option value="inactive">
                <Tag color="red">Ngừng hoạt động</Tag>
              </Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Detail Modal - Show order stats by type */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShopOutlined style={{ color: '#007A33', fontSize: 20 }} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>
              Chi Tiết Đơn Hàng - {selectedStore?.name}
            </span>
          </div>
        }
        visible={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" type="primary" onClick={() => setDetailModalVisible(false)}>
            Đóng
          </Button>
        ]}
        width={600}
        centered
      >
        {selectedStore && (
          <div>
            <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
              <Col span={24}>
                <Card style={{ background: '#f0f9ff', borderColor: '#1890ff' }}>
                  <Statistic
                    title={<span style={{ fontSize: 16, fontWeight: 600 }}>Tổng Đơn Hàng</span>}
                    value={selectedStore.orderCount || 0}
                    prefix={<ShoppingOutlined style={{ color: '#1890ff' }} />}
                    valueStyle={{ color: '#1890ff', fontSize: 32, fontWeight: 'bold' }}
                    suffix="đơn"
                  />
                </Card>
              </Col>
            </Row>

            <Row gutter={[16, 16]}>
              <Col span={8}>
                <Card style={{ background: '#fff7e6', borderColor: '#faad14' }}>
                  <Statistic
                    title="Đơn TMĐT"
                    value={selectedStore.ecommerceCount || 0}
                    valueStyle={{ color: '#faad14', fontSize: 24, fontWeight: 'bold' }}
                    suffix="đơn"
                  />
                  <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                    Shopee, Lazada, TikTok...
                  </div>
                </Card>
              </Col>

              <Col span={8}>
                <Card style={{ background: '#f6ffed', borderColor: '#52c41a' }}>
                  <Statistic
                    title="Đơn Lẻ"
                    value={selectedStore.retailCount || 0}
                    valueStyle={{ color: '#52c41a', fontSize: 24, fontWeight: 'bold' }}
                    suffix="đơn"
                  />
                  <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                    Bán lẻ trực tiếp
                  </div>
                </Card>
              </Col>

              <Col span={8}>
                <Card style={{ background: '#fff1f0', borderColor: '#ff4d4f' }}>
                  <Statistic
                    title="Đơn Sỉ"
                    value={selectedStore.wholesaleCount || 0}
                    valueStyle={{ color: '#ff4d4f', fontSize: 24, fontWeight: 'bold' }}
                    suffix="đơn"
                  />
                  <div style={{ fontSize: 12, color: '#999', marginTop: 8 }}>
                    Bán sỉ cho khách hàng
                  </div>
                </Card>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ManageStores;
