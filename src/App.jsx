import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider } from 'antd';
import viVN from 'antd/locale/vi_VN';
import { AuthProvider } from './contexts/AuthContext';
import PrivateRoute from './components/PrivateRoute';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { AddProduct, ManageProducts } from './pages/Products';
import Categories from './pages/Categories';
import SellingProducts from './pages/SellingProducts';
import { CreateOrderTMDT, CreateOrderRetail, CreateOrderWholesale, ManageOrdersTMDT, ManageOrdersRetail } from './pages/Orders';
import MainLayout from './components/Layout/MainLayout';
import './App.css';

function App() {
  return (
    <ConfigProvider locale={viVN}>
      <AuthProvider>
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
                <Route path="wholesale" element={<div>Manage Wholesale Orders (Coming Soon)</div>} />
              </Route>
              
              {/* Sẽ thêm routes khác sau */}
            </Route>
            
            {/* Redirect mọi route không tồn tại về dashboard */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </Router>
      </AuthProvider>
    </ConfigProvider>
  );
}

export default App;
