import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, Table, Tag, Spin, Button, List, Dropdown, Menu } from 'antd';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';
import { database } from '../../services/firebase.service';
import { ref, onValue } from 'firebase/database';
import { useNavigate } from 'react-router-dom';
import {
  ShoppingCartOutlined,
  ShoppingOutlined,
  DollarOutlined,
  InboxOutlined,
  DashboardOutlined,
  PlusCircleOutlined,
  FileTextOutlined,
  TeamOutlined,
  BarChartOutlined,
  SettingOutlined,
  ShopOutlined,
  UserOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  PrinterOutlined,
  MoreOutlined
} from '@ant-design/icons';
import { formatCurrency } from '../../utils/format';
import { ORDER_STATUS_LABELS, ORDER_STATUS_COLORS } from '../../utils/constants';

const Dashboard = () => {
  const { selectedStore } = useStore();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const hasPermission = isAdmin || (user?.permissions || []).includes('dashboard.view');
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalProducts: 0,
    totalRevenue: 0,
    lowStockProducts: 0
  });
  const [recentOrders, setRecentOrders] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, [selectedStore]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Load orders from Firebase
      const ordersRef = ref(database, 'salesOrders');
      onValue(ordersRef, (snapshot) => {
        const ordersData = snapshot.val();
        let orders = [];
        
        if (ordersData) {
          orders = Object.keys(ordersData).map(key => ({
            id: key,
            ...ordersData[key]
          }));
          
          // Filter by store if not 'all'
          if (selectedStore && selectedStore.id !== 'all') {
            orders = orders.filter(order => order.storeName === selectedStore.name);
          }
        }
        
        // Load products (dùng chung, không filter)
        const productsRef = ref(database, 'products');
        onValue(productsRef, (prodSnapshot) => {
          const productsData = prodSnapshot.val();
          const products = productsData ? Object.keys(productsData).map(key => ({
            id: key,
            ...productsData[key]
          })) : [];
          
          // Tính toán thống kê
          const totalRevenue = orders
            .filter(order => order.status === 'completed')
            .reduce((sum, order) => sum + (order.totalAmount || 0), 0);

          const lowStockProducts = products.filter(p => (p.stock || 0) <= 10).length;

          setStats({
            totalOrders: orders.length,
            totalProducts: products.length,
            totalRevenue,
            lowStockProducts
          });

          // Lấy 10 đơn hàng gần nhất
          const sortedOrders = orders
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
            .slice(0, 10);
          setRecentOrders(sortedOrders);
          
          setLoading(false);
        }, { onlyOnce: true });
      }, { onlyOnce: true });
    } catch (error) {
      console.error('Load dashboard error:', error);
      setLoading(false);
    }
  };

  const columns = [
    {
      title: 'Mã đơn',
      dataIndex: 'id',
      key: 'id',
      width: 150,
      render: (id) => id?.slice(0, 8) || 'N/A'
    },
    {
      title: 'Khách hàng',
      dataIndex: 'customerName',
      key: 'customerName',
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      render: (amount) => formatCurrency(amount || 0)
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={ORDER_STATUS_COLORS[status] || 'default'}>
          {ORDER_STATUS_LABELS[status] || status}
        </Tag>
      )
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date) => new Date(date).toLocaleDateString('vi-VN')
    }
  ];

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Dashboard. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" tip="Đang tải dữ liệu..." />
      </div>
    );
  }

  return (
    <div style={{ width: '100%', maxWidth: '100%' }}>
      {/* Header Section */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 8 }}>
          <DashboardOutlined style={{ fontSize: '32px', color: '#007A33' }} />
          <h1 className="page-title" style={{ margin: 0, color: '#007A33' }}>Dashboard</h1>
          {selectedStore && (
            <Tag color={selectedStore.id === 'all' ? 'blue' : 'green'} style={{ fontSize: '14px', padding: '4px 12px' }}>
              {selectedStore.id === 'all' ? '🏪 Toàn Bộ Cửa Hàng' : `📍 ${selectedStore.name}`}
            </Tag>
          )}
        </div>
        <p style={{ margin: 0, color: '#666', fontSize: '14px', paddingLeft: '44px' }}>
          {selectedStore && selectedStore.id === 'all' 
            ? 'Tổng quan tất cả cửa hàng' 
            : `Tổng quan cửa hàng: ${selectedStore?.name || ''}`}
        </p>
      </div>
      
      {/* Stats Cards với icon lớn màu sắc */}
      <Row gutter={[16, 16]} style={{ marginBottom: 32, width: '100%' }}>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ 
                width: '56px', 
                height: '56px', 
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', 
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ShoppingCartOutlined style={{ fontSize: '28px', color: 'white' }} />
              </div>
              <div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#333', lineHeight: 1 }}>{stats.totalOrders}</div>
                <div style={{ fontSize: '13px', color: '#999', marginTop: '4px' }}>Tổng Đơn Hàng</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ 
                width: '56px', 
                height: '56px', 
                background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', 
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <DollarOutlined style={{ fontSize: '28px', color: 'white' }} />
              </div>
              <div>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#333', lineHeight: 1 }}>{formatCurrency(stats.totalRevenue)}</div>
                <div style={{ fontSize: '13px', color: '#999', marginTop: '4px' }}>Tổng Doanh Thu</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ 
                width: '56px', 
                height: '56px', 
                background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', 
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <ShoppingOutlined style={{ fontSize: '28px', color: 'white' }} />
              </div>
              <div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#333', lineHeight: 1 }}>{stats.totalProducts}</div>
                <div style={{ fontSize: '13px', color: '#999', marginTop: '4px' }}>Tổng Sản Phẩm</div>
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card hoverable style={{ background: 'white', borderRadius: '12px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', border: 'none' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
              <div style={{ 
                width: '56px', 
                height: '56px', 
                background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', 
                borderRadius: '12px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                <InboxOutlined style={{ fontSize: '28px', color: 'white' }} />
              </div>
              <div>
                <div style={{ fontSize: '28px', fontWeight: '700', color: '#333', lineHeight: 1 }}>{stats.lowStockProducts}</div>
                <div style={{ fontSize: '13px', color: '#999', marginTop: '4px' }}>Đơn Hàng Nhận Nay</div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* Đơn Hàng Gần Đây */}
      <Card 
        style={{ 
          marginBottom: 24, 
          width: '100%', 
          background: 'white', 
          borderRadius: '12px', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: 'none'
        }}
        title={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '16px', fontWeight: '600' }}>⚫ Đơn Hàng Gần Đây</span>
            <Button type="link" style={{ color: '#007A33' }} onClick={() => navigate('/orders/manage/ecommerce')}>Xem Tất Cả</Button>
          </div>
        }
      >
        <List
          dataSource={recentOrders.slice(0, 5)}
          locale={{ emptyText: 'Chưa có đơn hàng nào' }}
          renderItem={(order) => {
            const actionMenu = (
              <Menu
                onClick={({ key }) => {
                  if (key === 'view') {
                    console.log('Xem chi tiết:', order.id);
                    // Navigate to order detail
                  } else if (key === 'edit') {
                    console.log('Chỉnh sửa:', order.id);
                    // Navigate to order edit
                  } else if (key === 'print') {
                    console.log('In đơn hàng:', order.id);
                    // Print order
                  } else if (key === 'delete') {
                    console.log('Xóa đơn hàng:', order.id);
                    // Show delete confirmation
                  }
                }}
              >
                <Menu.Item key="view" icon={<EyeOutlined />}>
                  Xem Chi Tiết
                </Menu.Item>
                <Menu.Item key="edit" icon={<EditOutlined />}>
                  Chỉnh Sửa
                </Menu.Item>
                <Menu.Item key="print" icon={<PrinterOutlined />}>
                  In Đơn Hàng
                </Menu.Item>
                <Menu.Divider />
                <Menu.Item key="delete" icon={<DeleteOutlined />} danger>
                  Xóa Đơn Hàng
                </Menu.Item>
              </Menu>
            );

            // Get first product item
            const firstItem = order.items && order.items.length > 0 ? order.items[0] : {};
            const totalQty = order.totalQuantity || (order.items ? order.items.reduce((s, item) => s + (item.quantity || 0), 0) : 0);

            return (
              <List.Item
                style={{ 
                  padding: '12px 0',
                  borderBottom: '1px solid #f0f0f0',
                  transition: 'background 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#fafafa'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              >
                <div style={{ display: 'flex', alignItems: 'center', width: '100%', gap: '10px' }}>
                  
                  {/* Loại đơn */}
                  <div style={{ minWidth: '70px' }}>
                    <Tag color={order.orderType === 'ecommerce' ? 'blue' : order.orderType === 'retail' ? 'green' : 'orange'} 
                      style={{ fontSize: '11px', margin: 0, fontWeight: 600 }}>
                      {order.orderType === 'ecommerce' ? 'TMĐT' : order.orderType === 'retail' ? 'RETAIL' : 'WHOLESALE'}
                    </Tag>
                  </div>
                  
                  {/* Mã đơn */}
                  <div style={{ minWidth: '130px' }}>
                    <div style={{ fontSize: '12px', fontWeight: 600, color: '#333' }}>
                      {order.orderId || order.id?.slice(0, 8) || 'N/A'}
                    </div>
                  </div>

                  {/* Tên sản phẩm */}
                  <div style={{ flex: 1, minWidth: '180px' }}>
                    <div style={{ fontWeight: 500, fontSize: '13px', color: '#000', marginBottom: '2px' }}>
                      {firstItem.productName || 'N/A'}
                    </div>
                    <div style={{ fontSize: '11px', color: '#999' }}>
                      {order.items && order.items.length > 1 ? `+${order.items.length - 1} sản phẩm khác` : ''}
                    </div>
                  </div>

                  {/* Số lượng */}
                  <div style={{ minWidth: '50px', textAlign: 'center' }}>
                    <div style={{ fontSize: '13px', fontWeight: 600, color: '#333' }}>
                      {totalQty || 0}
                    </div>
                  </div>

                  {/* Đơn vị */}
                  <div style={{ minWidth: '50px', textAlign: 'center' }}>
                    <Tag style={{ fontSize: '11px', margin: 0 }}>
                      {firstItem.unit || 'kg'}
                    </Tag>
                  </div>

                  {/* Giá */}
                  <div style={{ minWidth: '90px', textAlign: 'right' }}>
                    <div style={{ fontSize: '12px', color: '#666' }}>
                      {formatCurrency(firstItem.sellingPrice || 0)}
                    </div>
                  </div>

                  {/* Tổng tiền */}
                  <div style={{ minWidth: '110px', textAlign: 'right' }}>
                    <div style={{ fontSize: '14px', fontWeight: 700, color: '#007A33' }}>
                      {formatCurrency(order.totalAmount || 0)}
                    </div>
                  </div>

                  {/* Ngày tạo */}
                  <div style={{ minWidth: '80px', textAlign: 'right', color: '#999', fontSize: '11px' }}>
                    {new Date(order.createdAt).toLocaleDateString('vi-VN')}
                  </div>

                  {/* Actions */}
                  <div style={{ minWidth: '35px', textAlign: 'right' }}>
                    <Dropdown overlay={actionMenu} trigger={['click']} placement="bottomRight">
                      <Button 
                        type="text" 
                        icon={<MoreOutlined />} 
                        size="small"
                        style={{ color: '#999' }}
                      />
                    </Dropdown>
                  </div>
                </div>
              </List.Item>
            );
          }}
        />
      </Card>

      {/* Thao Tác Nhanh */}
      <Card 
        title={<span style={{ fontSize: '16px', fontWeight: '600' }}>⚡ Thao Tác Nhanh</span>}
        style={{ 
          width: '100%', 
          background: 'white', 
          borderRadius: '12px', 
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          border: 'none'
        }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={12} sm={8} md={6} lg={3}>
            <div 
              style={{ textAlign: 'center', cursor: 'pointer', padding: '16px', borderRadius: '8px', transition: 'all 0.3s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              onClick={() => navigate('/orders/create/ecommerce')}
            >
              <PlusCircleOutlined style={{ fontSize: '32px', color: '#f5576c', marginBottom: '8px' }} />
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Tạo Đơn Hàng</div>
              <div style={{ fontSize: '11px', color: '#999' }}>Tạo đơn hàng mới nhanh</div>
            </div>
          </Col>
          <Col xs={12} sm={8} md={6} lg={3}>
            <div 
              style={{ textAlign: 'center', cursor: 'pointer', padding: '16px', borderRadius: '8px', transition: 'all 0.3s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              onClick={() => navigate('/selling-products')}
            >
              <ShoppingOutlined style={{ fontSize: '32px', color: '#fa8c16', marginBottom: '8px' }} />
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Quản Lý Sản Phẩm</div>
              <div style={{ fontSize: '11px', color: '#999' }}>Thêm, sửa, xóa sản phẩm</div>
            </div>
          </Col>
          <Col xs={12} sm={8} md={6} lg={3}>
            <div 
              style={{ textAlign: 'center', cursor: 'pointer', padding: '16px', borderRadius: '8px', transition: 'all 0.3s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              onClick={() => navigate('/orders/create/ecommerce')}
            >
              <FileTextOutlined style={{ fontSize: '32px', color: '#52c41a', marginBottom: '8px' }} />
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Quản Lý Đơn Hàng</div>
              <div style={{ fontSize: '11px', color: '#999' }}>Xem và quản lý đơn hàng</div>
            </div>
          </Col>
          <Col xs={12} sm={8} md={6} lg={3}>
            <div 
              style={{ textAlign: 'center', cursor: 'pointer', padding: '16px', borderRadius: '8px', transition: 'all 0.3s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              onClick={() => navigate('/stores')}
            >
              <DollarOutlined style={{ fontSize: '32px', color: '#1890ff', marginBottom: '8px' }} />
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Quản Lý Cửa Hàng</div>
              <div style={{ fontSize: '11px', color: '#999' }}>Thêm, sửa thông tin cửa hàng</div>
            </div>
          </Col>
          <Col xs={12} sm={8} md={6} lg={3}>
            <div 
              style={{ textAlign: 'center', cursor: 'pointer', padding: '16px', borderRadius: '8px', transition: 'all 0.3s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              onClick={() => navigate('/warehouse/inventory')}
            >
              <InboxOutlined style={{ fontSize: '32px', color: '#722ed1', marginBottom: '8px' }} />
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Quản Lý Kho</div>
              <div style={{ fontSize: '11px', color: '#999' }}>Quản lý tồn kho và nhập xuất</div>
            </div>
          </Col>
          <Col xs={12} sm={8} md={6} lg={3}>
            <div 
              style={{ textAlign: 'center', cursor: 'pointer', padding: '16px', borderRadius: '8px', transition: 'all 0.3s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              onClick={() => navigate('/finance')}
            >
              <TeamOutlined style={{ fontSize: '32px', color: '#eb2f96', marginBottom: '8px' }} />
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Quản Lý Lợi Nhuận</div>
              <div style={{ fontSize: '11px', color: '#999' }}>Xem báo cáo lợi nhuận</div>
            </div>
          </Col>
          <Col xs={12} sm={8} md={6} lg={3}>
            <div 
              style={{ textAlign: 'center', cursor: 'pointer', padding: '16px', borderRadius: '8px', transition: 'all 0.3s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              onClick={() => navigate('/orders/manage/retail')}
            >
              <ShopOutlined style={{ fontSize: '32px', color: '#13c2c2', marginBottom: '8px' }} />
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Đơn Hàng Bán</div>
              <div style={{ fontSize: '11px', color: '#999' }}>Quản lý đơn bán lẻ/sỉ</div>
            </div>
          </Col>
          <Col xs={12} sm={8} md={6} lg={3}>
            <div 
              style={{ textAlign: 'center', cursor: 'pointer', padding: '16px', borderRadius: '8px', transition: 'all 0.3s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              onClick={() => navigate('/reports')}
            >
              <BarChartOutlined style={{ fontSize: '32px', color: '#faad14', marginBottom: '8px' }} />
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Báo Cáo</div>
              <div style={{ fontSize: '11px', color: '#999' }}>Xem báo cáo chi tiết</div>
            </div>
          </Col>
          <Col xs={12} sm={8} md={6} lg={3}>
            <div 
              style={{ textAlign: 'center', cursor: 'pointer', padding: '16px', borderRadius: '8px', transition: 'all 0.3s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              onClick={() => navigate('/customers')}
            >
              <UserOutlined style={{ fontSize: '32px', color: '#2f54eb', marginBottom: '8px' }} />
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Quản Lý Nhân sự</div>
              <div style={{ fontSize: '11px', color: '#999' }}>Danh sách Nhân sự</div>
            </div>
          </Col>
          <Col xs={12} sm={8} md={6} lg={3}>
            <div 
              style={{ textAlign: 'center', cursor: 'pointer', padding: '16px', borderRadius: '8px', transition: 'all 0.3s' }}
              onMouseEnter={(e) => e.currentTarget.style.background = '#f5f5f5'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
              onClick={() => navigate('/settings')}
            >
              <SettingOutlined style={{ fontSize: '32px', color: '#8c8c8c', marginBottom: '8px' }} />
              <div style={{ fontSize: '13px', fontWeight: '500' }}>Cài Đặt</div>
              <div style={{ fontSize: '11px', color: '#999' }}>Cấu hình hệ thống</div>
            </div>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default Dashboard;
