import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Radio, Button, Modal } from 'antd';
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
  ShopOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import './MainLayout.css';

const { Header, Sider, Content } = Layout;

const MainLayout = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [stores, setStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState('all');
  const [storeDropdownVisible, setStoreDropdownVisible] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isAdmin, isManager } = useAuth();

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
      ]
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
      key: '/stores',
      icon: <ShopOutlined />,
      label: 'Cửa Hàng',
    },
    {
      key: '/reports',
      icon: <BarChartOutlined />,
      label: 'Báo Cáo',
    },
    {
      key: '/warehouse',
      icon: <InboxOutlined />,
      label: 'Quản Lý Kho',
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

  // Fetch stores from Firebase
  useEffect(() => {
    // Mock data - sau này fetch từ Firebase
    const mockStores = [
      { id: '1', name: 'Cửa hàng Góc Cheese Nhỏ', address: 'Q.1' },
      { id: '2', name: 'cửa hàng test', address: 'Q.2' },
      { id: '3', name: 'Tạp Hóa Bánh Beo', address: 'Q.3' },
    ];
    setStores(mockStores);
  }, []);

  // Get selected store name
  const getSelectedStoreName = () => {
    if (selectedStoreId === 'all') return 'Tất cả cửa hàng';
    const store = stores.find(s => s.id === selectedStoreId);
    return store ? store.name : 'Tất cả cửa hàng';
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
        value={selectedStoreId} 
        onChange={(e) => {
          setSelectedStoreId(e.target.value);
          setStoreDropdownVisible(false);
        }}
        style={{ width: '100%' }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {stores.map(store => (
            <div
              key={store.id}
              style={{
                background: 'rgba(255,255,255,0.1)',
                padding: '12px',
                borderRadius: '6px',
                cursor: 'pointer',
                transition: 'all 0.3s',
                border: selectedStoreId === store.id ? '2px solid #fbbf24' : '2px solid transparent'
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
                <ShopOutlined style={{ color: 'white', fontSize: '16px' }} />
                <span style={{ color: 'white', fontWeight: 500, fontSize: '14px', flex: 1 }}>
                  {getSelectedStoreName()}
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
    </Layout>
  );
};

export default MainLayout;
