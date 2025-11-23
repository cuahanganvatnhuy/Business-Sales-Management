import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Button, Space, Typography, message, Avatar, Tag } from 'antd';
import { UserOutlined, EditOutlined, SaveOutlined } from '@ant-design/icons';
import { useAuth } from '../../contexts/AuthContext';
import { database } from '../../services/firebase.service';
import { ref, get, update, onValue } from 'firebase/database';

const { Title, Text } = Typography;

const Profile = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form] = Form.useForm();
  const [staffData, setStaffData] = useState(null);
  const [roles, setRoles] = useState([]);

  useEffect(() => {
    if (user?.uid) {
      loadStaffData();
    }
  }, [user]);

  // Load roles để hiển thị tên role
  useEffect(() => {
    const rolesRef = ref(database, 'roles');
    const unsubscribe = onValue(rolesRef, snapshot => {
      const data = snapshot.val() || {};
      const parsed = Object.entries(data).map(([id, value]) => ({
        id,
        ...value
      }));
      setRoles(parsed);
    });

    return () => unsubscribe();
  }, []);

  const loadStaffData = async () => {
    try {
      const staffRef = ref(database, `staffAccounts/${user.uid}`);
      const snapshot = await get(staffRef);
      if (snapshot.exists()) {
        const data = snapshot.val();
        setStaffData(data);
        form.setFieldsValue({
          fullName: data.fullName || user.displayName || '',
          email: data.email || user.email || '',
          phone: data.phone || '',
          note: data.note || ''
        });
      } else {
        // Nếu không có trong staffAccounts, dùng thông tin từ user
        form.setFieldsValue({
          fullName: user.displayName || '',
          email: user.email || '',
          phone: '',
          note: ''
        });
      }
    } catch (error) {
      console.error('Load staff data error:', error);
      message.error('Không thể tải thông tin cá nhân');
    }
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      // Cập nhật vào staffAccounts nếu có
      if (user?.uid) {
        const staffRef = ref(database, `staffAccounts/${user.uid}`);
        const snapshot = await get(staffRef);
        
        if (snapshot.exists()) {
          await update(staffRef, {
            fullName: values.fullName.trim(),
            phone: values.phone?.trim() || '',
            note: values.note?.trim() || '',
            updatedAt: Date.now()
          });
        } else {
          // Nếu chưa có trong staffAccounts, tạo mới
          await update(staffRef, {
            fullName: values.fullName.trim(),
            email: values.email.trim(),
            phone: values.phone?.trim() || '',
            note: values.note?.trim() || '',
            status: 'active',
            createdAt: Date.now(),
            updatedAt: Date.now()
          });
        }
      }

      message.success('Cập nhật thông tin thành công');
      setEditing(false);
      loadStaffData();
    } catch (error) {
      console.error('Save profile error:', error);
      message.error('Không thể cập nhật thông tin');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Space align="center" style={{ marginBottom: 16 }}>
            <Avatar size={64} icon={<UserOutlined />} style={{ backgroundColor: '#0f9d58' }} />
            <div>
              <Title level={3} style={{ margin: 0 }}>
                {user?.displayName || user?.fullName || user?.email?.split('@')[0] || 'User'}
              </Title>
              <Text type="secondary">{user?.email}</Text>
            </div>
          </Space>
          
          {user?.roleIds && Array.isArray(user.roleIds) && user.roleIds.length > 0 && (
            <Space wrap style={{ marginTop: 8 }}>
              <Text type="secondary" style={{ marginRight: 8 }}>Quyền:</Text>
              {user.roleIds.map((roleId) => {
                const role = roles.find(r => r.id === roleId);
                return (
                  <Tag key={roleId} color="blue">
                    {role?.name || roleId}
                  </Tag>
                );
              })}
            </Space>
          )}
        </div>

        <Form
          layout="vertical"
          form={form}
          disabled={!editing}
        >
          <Form.Item
            label="Họ và tên"
            name="fullName"
            rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
          >
            <Input placeholder="Nhập họ tên" />
          </Form.Item>

          <Form.Item
            label="Email"
            name="email"
          >
            <Input disabled placeholder="Email đăng nhập" />
          </Form.Item>

          <Form.Item
            label="Số điện thoại"
            name="phone"
            rules={[
              { pattern: /^[0-9+() -]*$/, message: 'Số điện thoại không hợp lệ' }
            ]}
          >
            <Input placeholder="Nhập số điện thoại" />
          </Form.Item>

          <Form.Item
            label="Ghi chú"
            name="note"
          >
            <Input.TextArea rows={3} placeholder="Thông tin thêm" />
          </Form.Item>

          <Form.Item>
            <Space>
              {!editing ? (
                <Button
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => setEditing(true)}
                >
                  Chỉnh sửa
                </Button>
              ) : (
                <>
                  <Button
                    type="primary"
                    icon={<SaveOutlined />}
                    loading={loading}
                    onClick={handleSave}
                  >
                    Lưu thay đổi
                  </Button>
                  <Button onClick={() => {
                    setEditing(false);
                    loadStaffData();
                  }}>
                    Hủy
                  </Button>
                </>
              )}
            </Space>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default Profile;

