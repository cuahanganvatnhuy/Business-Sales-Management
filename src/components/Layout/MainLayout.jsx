import React, { useState, useEffect, useMemo } from 'react';
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
  LineChartOutlined,
  ClockCircleOutlined
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../contexts/StoreContext';
import { database } from '../../services/firebase.service';
import { ref, onValue } from 'firebase/database';
import ChatBot from '../ChatBot';
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
  const userPermissions = user?.permissions || [];

  // Helper function để kiểm tra quyền
  const hasPermission = (permission) => {
    if (!permission) return true; // Không có permission yêu cầu thì cho phép
    return isAdmin || userPermissions.includes(permission);
  };

  // Mapping route với permission cần thiết
  const routePermissions = {
    '/dashboard': 'dashboard.view',
    'products-menu': 'menu.products', // Menu group "Sản Phẩm"
    '/products/add': 'products.add',
    '/products/manage': 'menu.products',
    '/categories': 'menu.products',
    '/selling-products': 'sellingProducts.view',
    'create-orders': null, // Menu group - hiển thị nếu có ít nhất 1 child có quyền
    '/orders/create/ecommerce': 'orders.create.ecommerce',
    '/orders/create/retail': 'orders.create.retail',
    '/orders/create/wholesale': 'orders.create.wholesale',
    'manage-orders': null, // Menu group - hiển thị nếu có ít nhất 1 child có quyền
    '/orders/manage/ecommerce': 'orders.manage.ecommerce.view',
    '/orders/manage/retail': 'orders.manage.retail.view',
    '/orders/manage/wholesale': 'orders.manage.wholesale.view',
    '/orders/debt': 'orders.debt.manage.view',
    '/orders/debt/dashboard': 'orders.debt.dashboard.view',
    '/stores': 'stores.manage.view',
    'finance': null, // Menu group - hiển thị nếu có ít nhất 1 child có quyền
    '/finance/transactions': 'finance.transactions.view',
    '/finance/overview': 'finance.profit.overview.view',
    '/finance/ecommerce-profit': 'finance.profit.ecommerce.view',
    '/finance/retail-profit': 'finance.profit.retail.view',
    '/finance/wholesale-profit': 'finance.profit.wholesale.view',
    '/reports': 'reports.view',
    'warehouse': null, // Menu group - hiển thị nếu có ít nhất 1 child có quyền
    '/warehouse/inventory': 'warehouse.inventory.view',
    '/warehouse/transactions': 'warehouse.transactions.view',
    '/warehouse/usage-report': 'warehouse.usageReport.view',
    '/warehouse/order-report': 'warehouse.orderReport.view',
    '/shipping-cost': 'shippingcost.view',
    'invoices': null, // Menu group - hiển thị nếu có ít nhất 1 child có quyền
    '/invoices/global': 'invoices.global.view',
    '/invoices/store': 'invoices.store.view',
    '/invoices/payment': 'invoices.payment.view',
    '/hr/staff': 'hr.staff.view',
    '/hr/roles': 'hr.roles.view',
    'settings': null, // Menu group - hiển thị nếu có ít nhất 1 child có quyền
    '/settings': 'settings.view',
  };

  // Hàm lọc menu items dựa trên permissions
  const filterMenuItems = (items) => {
    return items.map(item => {
      // Nếu có children, lọc children trước
      if (item.children && Array.isArray(item.children)) {
        const filteredChildren = filterMenuItems(item.children);
        // Nếu sau khi lọc không còn children nào, ẩn menu cha
        if (filteredChildren.length === 0) {
          return null;
        }
        
        // Kiểm tra permission cho menu group (nếu có)
        const route = item.key;
        const requiredPermission = routePermissions[route];
        
        // Nếu menu group có permission requirement và user không có quyền, ẩn nó
        if (requiredPermission !== null && requiredPermission !== undefined && !hasPermission(requiredPermission)) {
          return null;
        }
        
        // Trả về item với children đã được lọc
        return {
          ...item,
          children: filteredChildren
        };
      }
      
      // Kiểm tra permission cho route (không có children)
      const route = item.key;
      const requiredPermission = routePermissions[route];
      
      // Nếu route không có trong mapping, cho phép hiển thị (route không có permission check)
      if (requiredPermission === undefined) {
        return item;
      }
      
      // Nếu permission là null (menu group), cho phép hiển thị
      if (requiredPermission === null) {
        return item;
      }
      
      // Kiểm tra permission - nếu không có quyền, trả về null
      if (!hasPermission(requiredPermission)) {
        return null;
      }
      
      return item;
    }).filter(item => item !== null); // Loại bỏ các item null
  };

  // Load stores from Firebase - Load tất cả stores, filtering sẽ được làm trong useMemo
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
          key: '/finance/overview',
          icon: <i className="fas fa-chart-pie" />,
          label: 'Tổng Quan Lợi Nhuận',
        },
        {
          key: '/finance/ecommerce-profit',
          icon: <ShoppingCartOutlined />,
          label: 'Lợi Nhuận Đơn TMĐT',
        },
        {
          key: '/finance/retail-profit',
          icon: <ShopOutlined />,
          label: 'Lợi Nhuận Đơn Lẻ',
        },
        {
          key: '/finance/wholesale-profit',
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
      key: '/shipping-cost',
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
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Cài Đặt',
      children: (isAdmin || hasPermission('settings.view')) ? [
        {
          key: '/settings',
          icon: <ClockCircleOutlined />,
          label: 'Thời gian hết hạn',
        },
      ] : []
    },
  ];

  // Chỉ admin mới thấy menu quản lý người dùng
  if (isAdmin) {
    // Insert before Settings
    menuItems.splice(menuItems.length - 1, 0, {
      key: 'hr-management',
      icon: <TeamOutlined />,
      label: 'Quản Lý Nhân sự',
      children: [
        {
          key: '/hr/staff',
          icon: <UserOutlined />,
          label: 'Tài khoản nhân sự',
        },
        {
          key: '/hr/roles',
          icon: <SettingOutlined />,
          label: 'Cài đặt phân quyền',
        }
      ]
    });
  }

  // Lọc menu items dựa trên permissions
  const filteredMenuItems = filterMenuItems(menuItems);

  // Get selected store name
  const getSelectedStoreName = () => {
    return selectedStore ? selectedStore.name : 'Chọn cửa hàng';
  };

  // Store dropdown menu content
  // Tính toán stores được phép hiển thị dựa trên allowedStoreIds
  const allowedStores = useMemo(() => {
    if (isAdmin) {
      return stores; // Admin thấy tất cả
    }
    
    const allowedStoreIds = user?.allowedStoreIds;
    
    // Kiểm tra nếu là 'all' (string) hoặc ['all'] (array chứa 'all')
    const isAllStores = !allowedStoreIds || 
                       allowedStoreIds === 'all' || 
                       (Array.isArray(allowedStoreIds) && allowedStoreIds.includes('all'));
    
    if (isAllStores) {
      return stores; // Không có giới hạn, hiển thị tất cả
    }
    
    // Lọc stores dựa trên allowedStoreIds
    if (Array.isArray(allowedStoreIds)) {
      return stores.filter(store => allowedStoreIds.includes(store.id));
    } else if (typeof allowedStoreIds === 'string') {
      return stores.filter(store => store.id === allowedStoreIds);
    }
    
    return stores;
  }, [stores, isAdmin, user?.allowedStoreIds]);

  // Kiểm tra có quyền xem "Toàn Bộ Cửa Hàng" không
  const canViewAllStores = useMemo(() => {
    if (isAdmin) return true;
    
    const allowedStoreIds = user?.allowedStoreIds;
    return !allowedStoreIds || 
           allowedStoreIds === 'all' || 
           (Array.isArray(allowedStoreIds) && allowedStoreIds.includes('all'));
  }, [isAdmin, user?.allowedStoreIds]);

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
        value={selectedStore?.id || (canViewAllStores ? 'all' : allowedStores[0]?.id)} 
        onChange={(e) => {
          if (e.target.value === 'all') {
            // Select "All Stores"
            selectStore({ id: 'all', name: 'Toàn Bộ Cửa Hàng' }, true);
          } else {
            const store = allowedStores.find(s => s.id === e.target.value);
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
          {/* Option: Toàn Bộ Cửa Hàng - chỉ hiển thị nếu có quyền */}
          {canViewAllStores && (
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
          )}

          {/* Individual Stores - chỉ hiển thị stores được phép */}
          {allowedStores.map(store => (
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
      key: 'hr-staff-and-roles',
      icon: <TeamOutlined />,
      label: 'Quản lý nhân sự & quyền',
      onClick: () => navigate('/hr/staff'),
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
        <div className="logo" style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center',
          padding: '16px 0',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
          <div style={{ 
            width: '100%',
            display: 'flex', 
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
           
          }}>
            {!collapsed ? (
              <div style={{ 
                width: '100%',
                display: 'flex', 
                justifyContent: 'center' 
              }}>
                <img 
                  src="logo.png" 
                  alt="Logo" 
                  style={{ 
                    width: '180px', 
                    height: 'auto', 
                    maxWidth: '100%',
                    transition: 'all 0.3s'
                  }} 
                />
              </div>
            ) : (
              <div 
                onClick={(e) => {
                  e.stopPropagation();
                  requestAnimationFrame(() => setCollapsed(false));
                }}
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  width: '100%',
                  cursor: 'pointer',
                  padding: '8px 0',
                  WebkitTapHighlightColor: 'transparent',
                  userSelect: 'none'
                }}>
                <img 
                  src="logo4.png" 
                  alt="Logo" 
                  style={{ 
                    width: '35px', 
                    height: '35px',
                    transition: 'all 0.3s',
                    margin: '0 auto',
                    display: 'block'
                  }} 
                />
              </div>
            )}
            <div 
              style={{ 
                cursor: 'pointer', 
                fontSize: '18px', 
                color: 'white',
                marginLeft: 'auto'
              }} 
              onClick={() => setCollapsed(!collapsed)}
            >
              {React.createElement(collapsed ? MenuUnfoldOutlined : MenuFoldOutlined)}
            </div>
          </div>
        </div>
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[location.pathname]}
          items={filteredMenuItems}
          onClick={handleMenuClick}
          style={{ borderRight: 0, flex: 1, marginBottom: 0 }}
        />
        
        {/* User Controls at Bottom of Sidebar */}
        <div style={{
          padding: collapsed ? '12px 8px' : '16px',
          borderTop: '1px solid rgba(255, 255, 255, 0.1)',
          background: 'rgba(0, 0, 0, 0.1)',
        }}>
          {/* Store Selector Dropdown */}
          <Dropdown
            open={storeDropdownVisible}
            onOpenChange={setStoreDropdownVisible}
            dropdownRender={() => storeDropdownContent}
            placement={collapsed ? "topRight" : "topLeft"}
            trigger={['click']}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: collapsed ? '0' : '10px',
              background: 'rgba(255,255,255,0.1)',
              padding: collapsed ? '8px' : '10px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              marginBottom: collapsed ? '8px' : '12px',
              transition: 'all 0.3s',
              border: storeDropdownVisible ? '2px solid #fbbf24' : '2px solid transparent',
              justifyContent: collapsed ? 'center' : 'flex-start'
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.2)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.1)'}
            >
              {switching ? (
                <Spin size="small" style={{ marginRight: collapsed ? 0 : 8 }} />
              ) : (
                <ShopOutlined style={{ 
                  color: 'white', 
                  fontSize: collapsed ? '18px' : '16px',
                  marginRight: collapsed ? 0 : '8px'
                }} />
              )}
              {!collapsed && (
                <span style={{ color: 'white', fontWeight: 500, fontSize: '14px', flex: 1 }}>
                  {switching ? 'Đang chuyển...' : getSelectedStoreName()}
                </span>
              )}
            </div>
          </Dropdown>

          {/* User Info */}
          <Dropdown 
            menu={{ items: userMenuItems }} 
            placement={collapsed ? "topRight" : "topRight"} 
            arrow 
            trigger={['click']}
          >
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: collapsed ? '0' : '12px',
              background: 'rgba(255,255,255,0.1)',
              padding: collapsed ? '8px' : '10px 12px',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.3s',
              justifyContent: collapsed ? 'center' : 'flex-start'
            }}>
              <Avatar 
                icon={<UserOutlined />} 
                size={collapsed ? 'small' : 'default'}
                style={{ 
                  backgroundColor: '#fbbf24', 
                  color: '#007A33',
                  marginRight: collapsed ? 0 : '8px'
                }} 
              />
              {!collapsed && (
                <span style={{ fontWeight: 500, color: 'white', fontSize: '14px' }}>
                  {user?.displayName || user?.email?.split('@')[0] || 'User'}
                </span>
              )}
            </div>
          </Dropdown>
        </div>
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
            value={selectedStore?.id || (canViewAllStores ? 'all' : allowedStores[0]?.id)}
            onChange={(e) => {
              if (e.target.value === 'all') {
                selectStore({ id: 'all', name: 'Toàn Bộ Cửa Hàng' }, false);
                setStoreModalVisible(false);
              } else {
                const store = allowedStores.find(s => s.id === e.target.value);
                if (store) {
                  selectStore(store, false); // Don't show notification in initial modal
                  setStoreModalVisible(false);
                }
              }
            }}
            style={{ width: '100%' }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size={12}>
              {/* Option: Toàn Bộ Cửa Hàng - chỉ hiển thị nếu có quyền */}
              {canViewAllStores && (
                <Card
                  hoverable
                  style={{
                    border: selectedStore?.id === 'all' 
                      ? '2px solid #007A33' 
                      : '1px solid #d9d9d9',
                    background: selectedStore?.id === 'all' 
                      ? '#f6ffed' 
                      : 'white'
                  }}
                >
                  <Radio value="all" style={{ width: '100%' }}>
                    <div>
                      <div style={{ 
                        fontWeight: 600, 
                        fontSize: 16, 
                        color: '#007A33',
                        marginBottom: 4
                      }}>
                        🏪 Toàn Bộ Cửa Hàng
                      </div>
                      <div style={{ fontSize: 13, color: '#666' }}>
                        Xem tất cả dữ liệu
                      </div>
                    </div>
                  </Radio>
                </Card>
              )}
              {allowedStores.map(store => (
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

          {allowedStores.length === 0 && (
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

      {/* AI ChatBot Support */}
      <ChatBot />
    </Layout>
  );
};

export default MainLayout;
