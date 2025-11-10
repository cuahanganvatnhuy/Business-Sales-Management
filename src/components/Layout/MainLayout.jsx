import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Radio, Button, Modal, Card, Spin } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  ShoppingCartOutlined,
  InboxOutlined,
  TeamOutlined,
  SettingOutlined,
  LogoutOutlined,
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  BarChartOutlined,
  FileTextOutlined,
  ShopOutlined,
  DollarOutlined,
  PlusOutlined,
  EnvironmentOutlined,
  LineChartOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../contexts/StoreContext';
import { database } from '../../services/firebase.service';
import { ref, onValue } from 'firebase/database';
import './MainLayout.css';

const { Header, Sider, Content } = Layout;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [storeDropdownVisible, setStoreDropdownVisible] = useState(false);
  const [storeModalVisible, setStoreModalVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin, isManager } = useAuth();
  const { selectedStore, selectStore, stores, setStores, switching } = useStore();

  // Load stores from Firebase
  useEffect(() => {
    const storesRef = ref(database, 'stores');
    const unsubscribe = onValue(storesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const storesArray = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(store => store.status === 'active')
          .sort((a, b) => a.name.localeCompare(b.name));
        setStores(storesArray);
      } else {
        setStores([]);
      }
    });
    return () => unsubscribe();
  }, [setStores]);

  // Show store selection modal if no store selected
  useEffect(() => {
    if (stores.length > 0 && !selectedStore) {
      setStoreModalVisible(true);
    }
  }, [stores, selectedStore]);

  // Menu items cho sidebar - ĐẦY ĐỦ
  const menuItems = [
    {
      key: '/dashboard',
      icon: <DashboardOutlined />,
      label: 'Dashboard',
    },
    {
      key: 'products-menu',
      icon: <ShoppingOutlined />,
      label: 'Sản Phẩm',
      children: [
        {
          key: '/products/add',
          icon: <i className="fas fa-plus" />,
          label: 'Thêm Sản Phẩm',
        },
        {
          key: '/products/manage',
          icon: <i className="fas fa-list" />,
          label: 'Quản Lý Sản Phẩm',
        },
        {
          key: '/categories',
          icon: <i className="fas fa-tags" />,
          label: 'Danh Mục Sản Phẩm',
        },
      ]
    },
    {
      key: '/selling-products',
      icon: <i className="fas fa-money-bill-wave" />,
      label: 'Quản Lý Sản Phẩm Bán',
    },
    {
      key: 'create-orders',
      icon: <i className="fas fa-plus-circle" />,
      label: 'Tạo Đơn Hàng',
      children: [
        {
          key: '/orders/create/ecommerce',
          icon: <ShoppingCartOutlined />,
          label: 'Đơn Hàng TMĐT',
        },
        {
          key: '/orders/create/retail',
          icon: <ShopOutlined />,
          label: 'Đơn Hàng Bán Lẻ',
        },
        {
          key: '/orders/create/wholesale',
          icon: <i className="fas fa-warehouse" />,
          label: 'Đơn Hàng Bán Sỉ',
        },
      ]
    },
    {
      key: 'manage-orders',
      icon: <i className="fas fa-chart-line" />,
      label: 'Quản Lý Đơn Hàng Bán',
      children: [
        {
          key: '/orders/manage/ecommerce',
          icon: <ShoppingCartOutlined />,
          label: 'Quản lý đơn hàng TMĐT',
        },
        {
          key: '/orders/manage/retail',
          icon: <ShopOutlined />,
          label: 'Quản lý đơn hàng lẻ',
        },
        {
          key: '/orders/manage/wholesale',
          icon: <TeamOutlined />,
          label: 'Quản lý đơn hàng sỉ',
        },
        {
          key: '/orders/debt',
          icon: <DollarOutlined />,
          label: 'Công nợ khách hàng sỉ',
        },
        {
          key: '/orders/debt/dashboard',
          icon: <BarChartOutlined />,
          label: 'Dashboard công nợ',
        },
      ]
    },
    {
      key: '/stores',
      icon: <ShopOutlined />,
      label: 'Quản Lý Cửa Hàng',
    },
    {
      key: 'finance',
      icon: <i className="fas fa-coins" />,
      label: 'Quản Lý Tài Chính',
      children: [
        {
          key: '/finance/transactions',
          icon: <i className="fas fa-file-invoice-dollar" />,
          label: 'Giao Dịch Tài Chính',
        },
        {
          key: '/finance/profit-overview',
          icon: <i className="fas fa-chart-pie" />,
          label: 'Tổng Quan Lợi Nhuận',
        },
        {
          key: '/finance/profit-ecommerce',
          icon: <ShoppingCartOutlined />,
          label: 'Lợi Nhuận Đơn TMĐT',
        },
        {
          key: '/finance/profit-retail',
          icon: <ShopOutlined />,
          label: 'Lợi Nhuận Đơn Lẻ',
        },
        {
          key: '/finance/profit-wholesale',
          icon: <i className="fas fa-warehouse" />,
          label: 'Lợi Nhuận Đơn Sỉ',
        },
      ]
    },
    {
      key: '/reports',
      icon: <BarChartOutlined />,
      label: 'Báo Cáo',
    },
    {
      key: 'warehouse',
      icon: <InboxOutlined />,
      label: 'Quản Lý Kho',
      children: [
        {
          key: '/warehouse/inventory',
          icon: <InboxOutlined />,
          label: 'Kho Hàng',
        },
        {
          key: '/warehouse/transactions',
          icon: <i className="fas fa-exchange-alt" />,
          label: 'Quản Lý Giao Dịch',
        },
        {
          key: '/warehouse/usage-report',
          icon: <LineChartOutlined />,
          label: 'Báo Cáo Sử Dụng',
        },
        {
          key: '/warehouse/order-report',
          icon: <ShoppingCartOutlined />,
          label: 'Báo Cáo Đơn Hàng',
        },
      ]
    },
    {
      key: '/shipping-costs',
      icon: <i className="fas fa-shipping-fast" />,
      label: 'Chi Phí Vận Chuyển',
    },
    {
      key: 'invoices',
      icon: <FileTextOutlined />,
      label: 'Quản Lý Hóa Đơn',
      children: [
        {
          key: '/invoices/global',
          icon: <i className="fas fa-globe" />,
          label: 'Hóa Đơn Toàn Bộ',
        },
        {
          key: '/invoices/store',
          icon: <ShopOutlined />,
          label: 'Hóa Đơn Từng Cửa Hàng TMĐT',
        },
        {
          key: '/invoices/payment',
          icon: <i className="fas fa-money-bill-wave" />,
          label: 'Hóa Đơn Thanh Toán',
        },
      ]
    },
    {
      key: '/settings',
      icon: <SettingOutlined />,
      label: 'Cài Đặt',
    },
  ];

  // Chỉ admin mới thấy menu quản lý người dùng
  if (isAdmin) {
    // Insert before Settings
    menuItems.splice(menuItems.length - 1, 0, {
      key: '/users',
      icon: <TeamOutlined />,
      label: 'Quản Lý Người Dùng',
    });
  }

  // Get selected store name
  const getSelectedStoreName = () => {
    return selectedStore ? selectedStore.name : 'Chọn cửa hàng';
  };

  // Store dropdown menu content
  const storeDropdownContent = (
    <div style={{
      background: 'linear-gradient(135deg, #007A33 0%, #005A25 100%)',
      padding: '16px',
      borderRadius: '8px',
      minWidth: '320px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
    }}>
      <div style={{
        color: 'white',
        fontWeight: 600,
        fontSize: '14px',
        marginBottom: '12px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        borderBottom: '1px solid rgba(255,255,255,0.2)',
        paddingBottom: '8px'
      }}>
        <ShopOutlined />
        Danh Sách Cửa Hàng
      </div>
      
      <Radio.Group 
        value={selectedStore?.id || 'all'} 
        onChange={(e) => {
          if (e.target.value === 'all') {
            // Select "All Stores"
            selectStore({ id: 'all', name: 'Toàn Bộ Cửa Hàng' }, true);
          } else {
            const store = stores.find(s => s.id === e.target.value);
            if (store) {
              selectStore(store, true); // Show notification when switching from dropdown
            }
          }
          setStoreDropdownVisible(false);
        }}
        style={{ width: '100%' }}
        disabled={switching}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {/* Option: Toàn Bộ Cửa Hàng */}
          <div
            style={{
              background: 'rgba(255,255,255,0.1)',
              padding: '12px',
              borderRadius: '6px',
              cursor: 'pointer',
              transition: 'all 0.3s',
              border: selectedStore?.id === 'all' ? '2px solid #fbbf24' : '2px solid transparent'
            }}
          >
            <Radio value="all" style={{ width: '100%' }}>
              <div style={{ color: 'white' }}>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>🏪 Toàn Bộ Cửa Hàng</div>
                <div style={{ fontSize: '12px', opacity: 0.8 }}>Xem tất cả dữ liệu</div>
              </div>
            </Radio>
          </div>

          {/* Individual Stores */}
          {stores.map(store => (
            <div
              key={store.id}
              style={{
                background: 'rgba(255,255,255,0.1)',
                padding: '12px',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                border: selectedStore?.id === store.id ? '2px solid #fbbf24' : '2px solid transparent'
              }}
            >
              <Radio value={store.id} style={{ width: '100%' }}>
                <div style={{ color: 'white' }}>
                  <div style={{ fontWeight: 500, fontSize: '14px' }}>{store.name}</div>
                  <div style={{ fontSize: '12px', opacity: 0.8 }}>{store.address}</div>
                </div>
              </Radio>
            </div>
          ))}
        </div>
      </Radio.Group>

      <Button
        type="primary"
        block
        style={{
          marginTop: '12px',
          background: '#fbbf24',
          borderColor: '#fbbf24',
          color: '#007A33',
          fontWeight: 600,
          height: '36px'
        }}
        onClick={() => {
          setStoreDropdownVisible(false);
          navigate('/stores');
        }}
      >
        + Quản lý Cửa Hàng
      </Button>
    </div>
  );

  // Menu dropdown cho user
  const userMenuItems = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: 'Thông tin cá nhân',
      onClick: () => navigate('/profile'),
    },
    {
      key: 'password',
      icon: <SettingOutlined />,
      label: 'Đổi mật khẩu',
      onClick: () => navigate('/change-password'),
    },
    isAdmin && {
      key: 'users',
      icon: <TeamOutlined />,
      label: 'Quản lý tài khoản',
      onClick: () => navigate('/users'),
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Đăng xuất',
      danger: true,
      onClick: logout,
    },
  ].filter(Boolean);

  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  return (
    <Layout style={{ minHeight: '100vh', display: 'flex', flexDirection: 'row' }}>
      {/* SIDEBAR */}
      <Sider 
        trigger={null} 
        collapsible 
        collapsed={collapsed}
        width={250}
        collapsedWidth={80}
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          zIndex: 1000,
          background: 'linear-gradient(135deg, #007A33 0%, #005A28 100%)',
        }}
      >
        <div className="logo">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            {!collapsed ? (
              <div style={{ flex: 1 }}>
                <h2>PMQLDH</h2>
                <span>Phúc Hoàng Technology</span>
              </div>
            ) : (
              <h2 style={{ fontSize: '18px', margin: '16px 0' }}>PM</h2>
            )}
            {/* Toggle Button in Sidebar */}
            <div style={{ cursor: 'pointer', fontSize: '18px', color: 'white', padding: '8px' }} onClick={() => setCollapsed(!collapsed)}>
              {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined)}
            </div>
          </div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0, flex: 1, marginBottom: 0 }}
        />
        
        {/* User Controls at Bottom of Sidebar */}
        {!collapsed && (
          <div style={{
            padding: '16px',
            borderTop: '1px solid rgba(255, 255, 255, 0.1)',
            background: 'rgba(0, 0, 0, 0.1)',
          }}>
            {/* Store Selector Dropdown */}
            <Dropdown
              open={storeDropdownVisible}
              onOpenChange={setStoreDropdownVisible}
              dropdownRender={() => storeDropdownContent}
              placement="topLeft"
              trigger={['click']}
            >
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                background: 'rgba(255,255,255,0.1)',
                padding: '10px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                marginBottom: '12px',
                transition: 'all 0.3s',
                border: storeDropdownVisible ? '2px solid #fbbf24' : '2px solid transparent'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
              >
                {switching ? (
                  <Spin size="small" style={{ marginRight: 8 }} />
                ) : (
                  <ShopOutlined style={{ color: 'white', fontSize: '16px' }} />
                )}
                <span style={{ color: 'white', fontWeight: 500, fontSize: '14px', flex: 1 }}>
                  {switching ? 'Đang chuyển...' : getSelectedStoreName()}
                </span>
              </div>
            </Dropdown>

            {/* User Info */}
            <Dropdown menu={{ items: userMenuItems }} placement="topRight" arrow trigger={['click']}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                background: 'rgba(255,255,255,0.1)',
                padding: '10px 12px',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.3s'
              }}>
                <Avatar icon={<UserOutlined />} style={{ backgroundColor: '#fbbf24', color: '#007A33' }} />
                <span style={{ fontWeight: 500, color: 'white', fontSize: '14px' }}>
                  {user?.displayName || user?.email?.split('@')[0] || 'User'}
                </span>
              </div>
            </Dropdown>
          </div>
        )}
      </Sider>

      {/* MAIN CONTENT */}
      <Layout style={{ 
        marginLeft: collapsed ? 80 : 250, 
        transition: 'margin-left 0.2s', 
        background: '#f5f7fa',
        flex: 1,
        width: '100%',
        minHeight: '100vh',
      }}>
        {/* CONTENT AREA - Full Height */}
        <Content>
          {/* Outlet sẽ render các page con như Dashboard, Products... */}
          <Outlet />
        </Content>
      </Layout>

      {/* Store Selection Modal - Bắt buộc chọn cửa hàng */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ShopOutlined style={{ fontSize: 24, color: '#007A33' }} />
            <span style={{ fontSize: 18, fontWeight: 600 }}>Chọn Cửa Hàng</span>
          </div>
        }
        open={storeModalVisible}
        closable={false}
        footer={null}
        width={500}
        centered
      >
        <div style={{ padding: '16px 0' }}>
          <p style={{ fontSize: 14, color: '#666', marginBottom: 24 }}>
            Vui lòng chọn cửa hàng để tiếp tục sử dụng hệ thống
          </p>

          <Radio.Group 
            value={selectedStore?.id}
            onChange={(e) => {
              const store = stores.find(s => s.id === e.target.value);
              if (store) {
                selectStore(store, false); // Don't show notification in initial modal
                setStoreModalVisible(false);
              }
            }}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {stores.map(store => (
                <Card
                  key={store.id}
                  hoverable
                  style={{
                    border: selectedStore?.id === store.id 
                      ? '2px solid #007A33' 
                      : '1px solid #d9d9d9',
                    background: selectedStore?.id === store.id 
                      ? '#f6ffed' 
                      : 'white'
                  }}
                >
                  <Radio value={store.id} style={{ width: '100%' }}>
                    <div>
                      <div style={{ 
                        fontWeight: 600, 
                        fontSize: 16, 
                        color: '#007A33',
                        marginBottom: 4
                      }}>
                        {store.name}
                      </div>
                      <div style={{ fontSize: 13, color: '#666' }}>
                        <EnvironmentOutlined style={{ marginRight: 4 }} />
                        {store.address}
                      </div>
                    </div>
                  </Radio>
                </Card>
              ))}
            </Space>
          </Radio.Group>

          {stores.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 0' }}>
              <ShopOutlined style={{ fontSize: 48, color: '#d9d9d9', marginBottom: 16 }} />
              <p style={{ color: '#999' }}>Chưa có cửa hàng nào</p>
              <Button 
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => {
                  setStoreModalVisible(false);
                  navigate('/stores');
                }}
                style={{ marginTop: 16 }}
              >
                Tạo Cửa Hàng Đầu Tiên
              </Button>
            </div>
          )}
        </div>
      </Modal>
    </Layout>
  );
};

export default MainLayout;
