import React, { useState } from 'react';
import { Card, Form, Input, Button, Space, Typography, message } from 'antd';
import { LockOutlined, SaveOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { changeUserPassword } from '../../services/auth.service';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const ChangePassword = () => {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();

  const handleChangePassword = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      await changeUserPassword(
        user.email,
        values.oldPassword,
        values.newPassword
      );

      message.success('Đổi mật khẩu thành công! Vui lòng đăng nhập lại.');
      
      // Đăng xuất và chuyển về trang login
      setTimeout(async () => {
        await logout();
        navigate('/login');
      }, 1500);
    } catch (error) {
      console.error('Change password error:', error);
      
      if (error.code === 'auth/wrong-password' || error.message?.includes('wrong-password')) {
        message.error('Mật khẩu cũ không đúng');
      } else if (error.code === 'auth/weak-password' || error.message?.includes('weak-password')) {
        message.error('Mật khẩu mới quá yếu. Vui lòng chọn mật khẩu mạnh hơn (ít nhất 6 ký tự)');
      } else if (error.code === 'auth/requires-recent-login') {
        message.error('Vui lòng đăng nhập lại trước khi đổi mật khẩu');
      } else {
        message.error(error.message || 'Không thể đổi mật khẩu. Vui lòng thử lại');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Space align="center" style={{ marginBottom: 8 }}>
            <LockOutlined style={{ fontSize: 24, color: '#0f9d58' }} />
            <Title level={3} style={{ margin: 0 }}>Đổi mật khẩu</Title>
          </Space>
          <Text type="secondary">
            Vui lòng nhập mật khẩu cũ và mật khẩu mới để thay đổi
          </Text>
        </div>

        <Form
          layout="vertical"
          form={form}
          onFinish={handleChangePassword}
        >
          <Form.Item
            label="Mật khẩu cũ"
            name="oldPassword"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu cũ' }
            ]}
          >
            <Input.Password
              placeholder="Nhập mật khẩu cũ"
              prefix={<LockOutlined />}
            />
          </Form.Item>

          <Form.Item
            label="Mật khẩu mới"
            name="newPassword"
            rules={[
              { required: true, message: 'Vui lòng nhập mật khẩu mới' },
              { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' }
            ]}
            hasFeedback
          >
            <Input.Password
              placeholder="Nhập mật khẩu mới"
              prefix={<LockOutlined />}
            />
          </Form.Item>

          <Form.Item
            label="Nhập lại mật khẩu mới"
            name="confirmPassword"
            dependencies={['newPassword']}
            rules={[
              { required: true, message: 'Vui lòng nhập lại mật khẩu mới' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('newPassword') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('Mật khẩu nhập lại không khớp'));
                }
              })
            ]}
            hasFeedback
          >
            <Input.Password
              placeholder="Nhập lại mật khẩu mới"
              prefix={<LockOutlined />}
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                htmlType="submit"
                loading={loading}
                style={{ background: '#0f9d58', borderColor: '#0f9d58' }}
              >
                Đổi mật khẩu
              </Button>
              <Button onClick={() => form.resetFields()}>
                Làm mới
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default ChangePassword;

