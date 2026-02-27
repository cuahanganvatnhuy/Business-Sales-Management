import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { login } from '../../services/auth.service';
import './styles.css';

const Login = () => {
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const onFinish = async (values) => {
    try {
      setLoading(true);
      await login(values.email, values.password);
      message.success('Đăng nhập thành công!');
      navigate('/dashboard');
    } catch (error) {
      console.error('Login error:', error);
      let errorMessage = 'Đăng nhập thất bại!';
      
      if (error.code === 'auth/user-not-found') {
        errorMessage = 'Tài khoản không tồn tại!';
      } else if (error.code === 'auth/wrong-password') {
        errorMessage = 'Mật khẩu không đúng!';
      } else if (error.code === 'auth/invalid-email') {
        errorMessage = 'Email không hợp lệ!';
      } else if (error.code === 'auth/invalid-credential') {
        errorMessage = 'Email hoặc mật khẩu không đúng!';
      } else if (error.message && error.message.includes('vô hiệu hóa')) {
        errorMessage = error.message;
      } else if (error.message && error.message.includes('tạm khóa')) {
        errorMessage = error.message;
      } else if (error.message && error.message.includes('User data not found')) {
        errorMessage = 'Thông tin tài khoản không tồn tại trong hệ thống!';
      }
      
      message.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <Card className="login-card">
        <div className="login-header" style={{ textAlign: 'center', marginBottom: '24px' }}>
          <img 
            src="/logo6.png" 
            alt="PMQLDH Logo" 
            style={{ 
              maxWidth: '350px', 
              height: 'auto',
              marginBottom: '16px'
            }} 
          />
          <p style={{ margin: 0, fontSize: '16px', color: '#666' }}>Hệ thống Quản lý Kinh doanh</p>
        </div>
        
        <Form
          name="login"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="email"
            rules={[
              { required: true, message: 'Vui lòng nhập email!' },
              { type: 'email', message: 'Email không hợp lệ!' }
            ]}
          >
            <Input 
              prefix={<UserOutlined />} 
              placeholder="Email" 
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu!' },
              { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự!' }
            ]}
          >
            <Input.Password
              prefix={<LockOutlined />}
              placeholder="Mật khẩu"
            />
          </Form.Item>

          <Form.Item>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              block
            >
              Đăng nhập
            </Button>
          </Form.Item>
        </Form>

        <div className="login-footer">
          {/* <p>2026 AP ERP – Phúc Hoàng Technology. All rights reserved.</p> */}
             <p>2026 AP ERP Technology. All rights reserved.</p>
        </div>
      </Card>
    </div>
  );
};

export default Login;
