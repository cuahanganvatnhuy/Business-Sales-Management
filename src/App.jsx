import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { AuthProvider } from './contexts/AuthContext';
import { StoreProvider } from './contexts/StoreContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { AddProduct, ManageProducts } from './pages/Products';
import Categories from './pages/Categories';
import SellingProducts from './pages/SellingProducts';
import { CreateOrderTMDT, CreateOrderRetail, CreateOrderWholesale, ManageOrdersTMDT, ManageOrdersRetail, ManageOrdersWholesale, DebtManagement, DebtDashboard } from './pages/Orders';
import { ManageStores } from './pages/Stores';
import Reports from './pages/Reports';
import { Inventory, Transactions, UsageReport, OrderReport } from './pages/Warehouse';
import ShippingCost from './pages/ShippingCost';
import { GlobalInvoice, StoreInvoice, PaymentInvoice } from './pages/Invoices';
import { FinancialTransactions, ProfitOverview, EcommerceProfit, RetailProfit, WholesaleProfit } from './pages/Finance';
import StaffManagement from './pages/HR/StaffManagement';
import RoleManagement from './pages/HR/RoleManagement';
import Profile from './pages/Profile';
import ChangePassword from './pages/ChangePassword';
import Settings from './pages/Settings';
import MainLayout from './components/Layout/MainLayout';
import './App.css';

function App() {
  useEffect(() => {
    const applyZoom = () => {
      const width = window.innerWidth;
      if (width <= 1600) {
        document.body.classList.add('app-zoom-80');
      } else {
        document.body.classList.remove('app-zoom-80');
      }
    };
    applyZoom();
    window.addEventListener('resize', applyZoom);
    return () => window.removeEventListener('resize', applyZoom);
  }, []);
  return (
    <ConfigProvider locale={viVN}>
      <AuthProvider>
        <StoreProvider>
          <Router>
          <Routes>
            {/* Public Route - Login */}
            <Route path="/login" element={<Login />} />
            
            {/* Protected Routes - Cần đăng nhập */}
            <Route path="/" element={
              <PrivateRoute>
                <MainLayout />
              </PrivateRoute>
            }>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              
              {/* Products Routes */}
              <Route path="products">
                <Route index element={<Navigate to="manage" replace />} />
                <Route path="add" element={<AddProduct />} />
                <Route path="manage" element={<ManageProducts />} />
              </Route>
              
              {/* Categories Route */}
              <Route path="categories" element={<Categories />} />
              
              {/* Selling Products Route */}
              <Route path="selling-products" element={<SellingProducts />} />
              
              {/* Orders Routes */}
              <Route path="orders/create">
                <Route path="ecommerce" element={<CreateOrderTMDT />} />
                <Route path="retail" element={<CreateOrderRetail />} />
                <Route path="wholesale" element={<CreateOrderWholesale />} />
              </Route>
              
              <Route path="orders/manage">
                <Route path="ecommerce" element={<ManageOrdersTMDT />} />
                <Route path="retail" element={<ManageOrdersRetail />} />
                <Route path="wholesale" element={<ManageOrdersWholesale />} />
              </Route>
              
              <Route path="orders/debt" element={<DebtManagement />} />
              <Route path="orders/debt/dashboard" element={<DebtDashboard />} />
              
              {/* Stores Route */}
              <Route path="stores" element={<ManageStores />} />
              
              {/* Reports Route */}
              <Route path="reports" element={<Reports />} />
              
              {/* Warehouse Routes */}
              <Route path="warehouse">
                <Route index element={<Navigate to="inventory" replace />} />
                <Route path="inventory" element={<Inventory />} />
                <Route path="transactions" element={<Transactions />} />
                <Route path="usage-report" element={<UsageReport />} />
                <Route path="order-report" element={<OrderReport />} />
              </Route>
              
              {/* Shipping Cost Route */}
              <Route path="shipping-cost" element={<ShippingCost />} />
              
              {/* Invoices Routes */}
              <Route path="invoices">
                <Route index element={<Navigate to="global" replace />} />
                <Route path="global" element={<GlobalInvoice />} />
                <Route path="store" element={<StoreInvoice />} />
                <Route path="payment" element={<PaymentInvoice />} />
              </Route>
              
              {/* Finance Routes */}
              <Route path="finance">
                <Route index element={<Navigate to="transactions" replace />} />
                <Route path="transactions" element={<FinancialTransactions />} />
                <Route path="overview" element={<ProfitOverview />} />
                <Route path="ecommerce-profit" element={<EcommerceProfit />} />
                <Route path="retail-profit" element={<RetailProfit />} />
                <Route path="wholesale-profit" element={<WholesaleProfit />} />
              </Route>

              {/* Human Resources */}
              <Route path="hr">
                <Route path="staff" element={<StaffManagement />} />
                <Route path="roles" element={<RoleManagement />} />
              </Route>

              {/* User Profile & Settings */}
              <Route path="profile" element={<Profile />} />
              <Route path="change-password" element={<ChangePassword />} />
              <Route path="settings" element={<Settings />} />
            </Route>
            
            {/* Redirect mọi route không tồn tại về dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
          </Router>
        </StoreProvider>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default App;
