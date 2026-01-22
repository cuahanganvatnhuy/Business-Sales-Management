import React, { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Button,
  Table,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  Select,
  Switch,
  Typography,
  message,
  Popconfirm,
  Checkbox
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserAddOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { database } from '../../services/firebase.service';
import { useAuth } from '../../contexts/AuthContext';
import { register } from '../../services/auth.service';
import { onValue, push, ref, remove, set, update } from 'firebase/database';

const { Title, Text } = Typography;
const { Option } = Select;

const STATUS_COLORS = {
  active: 'green',
  inactive: 'volcano',
  suspended: 'red'
};

const StaffManagement = () => {
  const { user, isAdmin } = useAuth();
  const userPermissions = user?.permissions || [];
  const hasPermission = isAdmin || userPermissions.includes('hr.staff.view');
  const canAddStaff = isAdmin || userPermissions.includes('hr.staff.add');
  const canEditStaff = isAdmin || userPermissions.includes('hr.staff.edit');
  const canDeleteStaff = isAdmin || userPermissions.includes('hr.staff.delete');

  if (!hasPermission) {
    return (
      <div style={{ padding: 24 }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Quản Lý Tài Khoản Nhân Sự. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  const [staffAccounts, setStaffAccounts] = useState([]);
  const [roles, setRoles] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [changePassword, setChangePassword] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    const accountsRef = ref(database, 'staffAccounts');
    setLoading(true);
    const unsubscribe = onValue(accountsRef, snapshot => {
      const data = snapshot.val() || {};
      const parsed = Object.entries(data).map(([id, value]) => ({
        id,
        ...value
      }));
      parsed.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      setStaffAccounts(parsed);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsubscribe();
  }, []);

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

  // Load stores from Firebase
  useEffect(() => {
    const storesRef = ref(database, 'stores');
    const unsubscribe = onValue(storesRef, snapshot => {
      const data = snapshot.val() || {};
      const parsed = Object.entries(data)
        .map(([id, value]) => ({
          id,
          ...value
        }))
        .filter(store => store.status === 'active')
        .sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setStores(parsed);
    });

    return () => unsubscribe();
  }, []);

  // Đồng bộ dữ liệu form khi modal mở để chỉnh sửa
  useEffect(() => {
    if (modalVisible && editingAccount) {
      // allowedStoreIds: null hoặc 'all' = toàn bộ cửa hàng, array = danh sách cửa hàng được phép
      let allowedStoreIds = editingAccount.allowedStoreIds;
      if (!allowedStoreIds || allowedStoreIds === 'all' || allowedStoreIds === null) {
        allowedStoreIds = ['all'];
      } else if (!Array.isArray(allowedStoreIds)) {
        allowedStoreIds = [allowedStoreIds];
      }
      
      setTimeout(() => {
        form.setFieldsValue({
          fullName: editingAccount.fullName || '',
          email: editingAccount.email || '',
          phone: editingAccount.phone || '',
          allowedStoreIds: allowedStoreIds,
          roleIds: editingAccount.roleIds || [],
          status: editingAccount.status || 'active',
          note: editingAccount.note || ''
        });
      }, 150);
    }
  }, [modalVisible, editingAccount, form]);

  const filteredAccounts = useMemo(() => {
    if (!searchText.trim()) {
      return staffAccounts;
    }
    const text = searchText.toLowerCase();
    return staffAccounts.filter(acc =>
      (acc.fullName || '').toLowerCase().includes(text) ||
      (acc.email || '').toLowerCase().includes(text) ||
      (acc.phone || '').toLowerCase().includes(text)
    );
  }, [staffAccounts, searchText]);

  const openCreateModal = () => {
    if (!canAddStaff) {
      message.error('Bạn không có quyền thêm tài khoản nhân sự.');
      return;
    }
    setEditingAccount(null);
    setChangePassword(false); // Reset checkbox
    form.resetFields();
    setModalVisible(true);
  };

  const openEditModal = (record) => {
    if (!canEditStaff) {
      message.error('Bạn không có quyền chỉnh sửa tài khoản nhân sự.');
      return;
    }
    setEditingAccount(record);
    setChangePassword(false); // Reset checkbox đổi mật khẩu
    
    // allowedStoreIds: null hoặc 'all' = toàn bộ cửa hàng, array = danh sách cửa hàng được phép
    let allowedStoreIds = record.allowedStoreIds;
    if (!allowedStoreIds || allowedStoreIds === 'all' || allowedStoreIds === null) {
      allowedStoreIds = ['all'];
    } else if (!Array.isArray(allowedStoreIds)) {
      allowedStoreIds = [allowedStoreIds];
    }
    
    setModalVisible(true);
    
    // Reset form và set giá trị sau khi modal đã mở
    setTimeout(() => {
      form.resetFields();
      form.setFieldsValue({
        fullName: record.fullName || '',
        email: record.email || '',
        phone: record.phone || '',
        allowedStoreIds: allowedStoreIds,
        roleIds: record.roleIds || [],
        status: record.status || 'active',
        note: record.note || ''
      });
    }, 100);
  };

  const handleSaveAccount = async () => {
    try {
      const values = await form.validateFields();
      // Xử lý allowedStoreIds: 'all' hoặc array các store ID
      let allowedStoreIds = values.allowedStoreIds;
      if (!allowedStoreIds || allowedStoreIds.length === 0) {
        allowedStoreIds = 'all'; // Mặc định toàn bộ nếu không chọn gì
      } else if (Array.isArray(allowedStoreIds) && allowedStoreIds.includes('all')) {
        allowedStoreIds = 'all'; // Nếu có "all" trong array, chỉ lưu "all"
      } else if (allowedStoreIds === 'all' || (Array.isArray(allowedStoreIds) && allowedStoreIds.length === stores.length)) {
        allowedStoreIds = 'all'; // Nếu chọn tất cả cửa hàng, lưu "all"
      }

      const payload = {
        fullName: values.fullName.trim(),
        email: values.email.trim(),
        phone: values.phone?.trim() || '',
        allowedStoreIds: allowedStoreIds,
        roleIds: values.roleIds || [],
        status: values.status || 'active',
        note: values.note || '',
        updatedAt: Date.now()
      };

      if (editingAccount) {
        if (!canEditStaff) {
          message.error('Bạn không có quyền chỉnh sửa tài khoản nhân sự.');
          return;
        }
        
        // Xử lý đổi mật khẩu nếu có
        if (changePassword) {
          if (!values.oldPassword || !values.newPassword) {
            message.error('Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới');
            return;
          }
          
          if (values.newPassword !== values.confirmNewPassword) {
            message.error('Mật khẩu mới nhập lại không khớp');
            return;
          }
          
          try {
            const { changeUserPassword } = await import('../../services/auth.service');
            await changeUserPassword(
              values.email, 
              values.oldPassword, 
              values.newPassword
            );
            message.success('Đổi mật khẩu thành công');
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
            return;
          }
        }
        
        await update(ref(database, `staffAccounts/${editingAccount.id}`), payload);
        message.success('Cập nhật tài khoản thành công');
      } else {
        if (!canAddStaff) {
          message.error('Bạn không có quyền thêm tài khoản nhân sự.');
          return;
        }
        const password = values.password;
        if (!password) {
          message.error('Vui lòng nhập mật khẩu cho tài khoản mới');
          return;
        }

        // Tạo tài khoản đăng nhập Firebase + hồ sơ `users`
        const primaryRole = (payload.roleIds && payload.roleIds[0]) || 'staff';
        const createdUser = await register(payload.email, password, {
          displayName: payload.fullName,
          role: primaryRole
        });

        const uid = createdUser.uid;

        // Lưu thông tin tài khoản nhân sự, dùng uid làm khóa
        await set(ref(database, `staffAccounts/${uid}`), {
          ...payload,
          uid,
          createdAt: Date.now()
        });

        message.success('Tạo tài khoản đăng nhập nhân sự thành công');
      }
      setModalVisible(false);
      setEditingAccount(null);
      setChangePassword(false);
      form.resetFields();
    } catch (error) {
      if (error?.errorFields) {
        return;
      }
      console.error('handleSaveAccount error:', error);
      message.error('Không thể lưu tài khoản. Vui lòng thử lại');
    }
  };

  const handleDeleteAccount = async (accountId) => {
    try {
      if (!canDeleteStaff) {
        message.error('Bạn không có quyền xóa tài khoản nhân sự.');
        return;
      }
      await remove(ref(database, `staffAccounts/${accountId}`));
      message.success('Đã xóa tài khoản nhân sự');
    } catch (error) {
      console.error('handleDeleteAccount error:', error);
      message.error('Không thể xóa tài khoản. Vui lòng thử lại');
    }
  };

  const handleStatusToggle = async (checked, record) => {
    try {
      if (!canEditStaff) {
        message.error('Bạn không có quyền chỉnh sửa tài khoản nhân sự.');
        return;
      }
      await update(ref(database, `staffAccounts/${record.id}`), {
        status: checked ? 'active' : 'inactive',
        updatedAt: Date.now()
      });
      message.success('Đã cập nhật trạng thái');
    } catch (error) {
      console.error('handleStatusToggle error:', error);
      message.error('Không thể cập nhật trạng thái');
    }
  };

  const getRoleBadges = (roleIds = []) => {
    if (!roleIds.length) {
      return <Tag color="default">Chưa phân quyền</Tag>;
    }
    return roleIds.map(roleId => {
      const role = roles.find(r => r.id === roleId);
      return (
        <Tag key={roleId} color="blue">
          {role?.name || roleId}
        </Tag>
      );
    });
  };

  const columns = [
    {
      title: 'Họ & tên',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (text, record) => (
        <div>
          <Text strong>{text || 'Chưa cập nhật'}</Text>
          <div style={{ fontSize: 12, color: '#888' }}>
           
          </div>
        </div>
      )
    },
    {
      title: 'Email đăng nhập',
      dataIndex: 'email',
      key: 'email',
      render: (text) => text || <Text type="secondary">Chưa có</Text>
    },
    {
      title: 'SĐT',
      dataIndex: 'phone',
      key: 'phone',
      render: (text) => text || <Text type="secondary">-</Text>
    },
    {
      title: 'Quyền hiện tại',
      dataIndex: 'roleIds',
      key: 'roleIds',
      render: (roleIds) => getRoleBadges(roleIds)
    },
    {
      title: 'Quyền truy cập cửa hàng',
      dataIndex: 'allowedStoreIds',
      key: 'allowedStoreIds',
      width: 200,
      render: (allowedStoreIds, record) => {
        if (!allowedStoreIds || allowedStoreIds === 'all') {
          return <Tag color="green">Toàn bộ cửa hàng</Tag>;
        }
        if (Array.isArray(allowedStoreIds) && allowedStoreIds.length > 0) {
          if (allowedStoreIds.includes('all')) {
            return <Tag color="green">Toàn bộ cửa hàng</Tag>;
          }
          return (
            <Space wrap>
              {allowedStoreIds.map(storeId => {
                const store = stores.find(s => s.id === storeId);
                return (
                  <Tag key={storeId} color="blue">
                    {store?.name || storeId}
                  </Tag>
                );
              })}
            </Space>
          );
        }
        return <Tag color="default">Chưa cấu hình</Tag>;
      }
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 140,
      render: (status, record) => (
        <Space>
          <Tag color={STATUS_COLORS[status] || 'default'}>
            {status === 'active' ? 'Đang hoạt động' : status === 'inactive' ? 'Không hoạt động' : 'Tạm khóa'}
          </Tag>
          <Switch
            checked={status === 'active'}
            onChange={(checked) => handleStatusToggle(checked, record)}
            size="small"
          />
        </Space>
      )
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 150,
      render: (value) => value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-'
    },
    {
      title: 'Hành động',
      key: 'actions',
      width: 160,
      render: (_, record) => (
        <Space>
          <Button icon={<EditOutlined />} size="small" onClick={() => openEditModal(record)}>
            Sửa
          </Button>
          <Popconfirm
            title="Xóa tài khoản?"
            description="Bạn chắc chắn muốn xóa tài khoản này? Hành động không thể khôi phục."
            okText="Xóa"
            okType="danger"
            cancelText="Hủy"
            onConfirm={() => handleDeleteAccount(record.id)}
          >
            <Button danger icon={<DeleteOutlined />} size="small">
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  const roleOptions = roles.length
    ? roles.map(role => (
      <Option key={role.id} value={role.id}>
        {role.name}
      </Option>
    ))
    : null;

  return (
    <div style={{ padding: 24, background: '#f5f5f5', minHeight: '100vh' }}>
      <div
        style={{
          background: '#fff',
          padding: '16px 24px',
          borderRadius: 12,
          boxShadow: '0 12px 30px rgba(5, 153, 0, 0.08)',
          marginBottom: 16
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: '50%',
              background: '#e6f7e6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <UserAddOutlined style={{ fontSize: 20, color: '#0f9d58' }} />
          </div>
          <div>
            <Title
              level={2}
              style={{ margin: 0, color: 'rgb(8 125 68)', fontWeight: 'bold', fontSize: 23 }}
            >
              Quản Lý Tài Khoản Nhân Sự
            </Title>
            <Text type="secondary">
              Theo dõi tài khoản đăng nhập và phân quyền cho từng nhân sự
            </Text>
          </div>
        </div>
      </div>

      <div
        style={{
          background: '#fff',
          padding: 20,
          borderRadius: 12,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.05)',
          marginBottom: 16
        }}
      >
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 16,
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
        >
          <Input.Search
            placeholder="Tìm theo tên, email, SĐT"
            allowClear
            onChange={(e) => setSearchText(e.target.value)}
            style={{ width: 300, flex: '1 1 280px' }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={openCreateModal}
            style={{ background: '#0f9d58', borderColor: '#0f9d58' }}
          >
            Thêm tài khoản
          </Button>
        </div>
      </div>

      <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 12, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.05)' }}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={filteredAccounts}
          columns={columns}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title={
          <Space align="center">
            {editingAccount ? <EditOutlined /> : <UserAddOutlined />}
            <span>{editingAccount ? 'Cập nhật tài khoản' : 'Thêm tài khoản nhân sự'}</span>
          </Space>
        }
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingAccount(null);
          setChangePassword(false);
          form.resetFields();
        }}
        onOk={handleSaveAccount}
        okText={editingAccount ? 'Cập nhật' : 'Thêm mới'}
        destroyOnClose
        width={600}
      >
        <Form
          layout="vertical"
          form={form}
          preserve={false}
          initialValues={{
            status: 'active',
            roleIds: [],
            allowedStoreIds: ['all']
          }}
        >
          <Form.Item
            label="Họ và tên"
            name="fullName"
            rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}
          >
            <Input placeholder="Nhập họ tên nhân sự" />
          </Form.Item>

          <Form.Item
            label="Email đăng nhập"
            name="email"
            rules={[
              { required: true, message: 'Vui lòng nhập email' },
              { type: 'email', message: 'Email không hợp lệ' }
            ]}
          >
            <Input placeholder="vidu@domain.com" disabled={!!editingAccount} />
          </Form.Item>

          {editingAccount && (
            <Form.Item>
              <Checkbox 
                checked={changePassword}
                onChange={(e) => setChangePassword(e.target.checked)}
              >
                Đổi mật khẩu
              </Checkbox>
            </Form.Item>
          )}

          {editingAccount && changePassword && (
            <>
              <Form.Item
                label="Mật khẩu cũ"
                name="oldPassword"
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu cũ' }
                ]}
              >
                <Input.Password placeholder="Nhập mật khẩu cũ" />
              </Form.Item>

              <Form.Item
                label="Mật khẩu mới"
                name="newPassword"
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu mới' },
                  { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' }
                ]}
              >
                <Input.Password placeholder="Nhập mật khẩu mới" />
              </Form.Item>

              <Form.Item
                label="Nhập lại mật khẩu mới"
                name="confirmNewPassword"
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
              >
                <Input.Password placeholder="Nhập lại mật khẩu mới" />
              </Form.Item>
            </>
          )}

          {!editingAccount && (
            <>
              <Form.Item
                label="Mật khẩu"
                name="password"
                rules={[
                  { required: true, message: 'Vui lòng nhập mật khẩu' },
                  { min: 6, message: 'Mật khẩu phải có ít nhất 6 ký tự' }
                ]}
              >
                <Input.Password placeholder="Nhập mật khẩu đăng nhập" />
              </Form.Item>

              <Form.Item
                label="Nhập lại mật khẩu"
                name="confirmPassword"
                dependencies={['password']}
                rules={[
                  { required: true, message: 'Vui lòng nhập lại mật khẩu' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || getFieldValue('password') === value) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('Mật khẩu nhập lại không khớp'));
                    }
                  })
                ]}
              >
                <Input.Password placeholder="Nhập lại mật khẩu" />
              </Form.Item>
            </>
          )}

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
            label="Gắn quyền (role)"
            name="roleIds"
            tooltip="Có thể chọn nhiều quyền, dùng trang Quản Lý Quyền để tạo quyền mới"
          >
            <Select
              mode="multiple"
              allowClear
              placeholder="Chọn quyền"
              loading={!roles.length}
            >
              {roleOptions}
            </Select>
          </Form.Item>

          <Form.Item
            label="Quyền truy cập cửa hàng"
            name="allowedStoreIds"
            tooltip="Chọn cửa hàng mà nhân viên này có quyền truy cập dữ liệu. Chọn 'Toàn bộ cửa hàng' để cho phép xem tất cả dữ liệu."
          >
            <Select
              mode="multiple"
              placeholder="Chọn cửa hàng"
              loading={!stores.length}
              maxTagCount="responsive"
              onChange={(value) => {
                // Nếu chọn "all", chỉ giữ "all" và xóa các lựa chọn khác
                if (Array.isArray(value) && value.includes('all')) {
                  // Nếu đang chọn "all" mới
                  if (value[value.length - 1] === 'all') {
                    form.setFieldsValue({ allowedStoreIds: ['all'] });
                  } else {
                    // Nếu đang bỏ chọn "all"
                    const withoutAll = value.filter(v => v !== 'all');
                    form.setFieldsValue({ allowedStoreIds: withoutAll.length > 0 ? withoutAll : ['all'] });
                  }
                }
              }}
            >
              <Option key="all" value="all">
                <strong>🏪 Toàn bộ cửa hàng</strong>
              </Option>
              {stores.map(store => (
                <Option key={store.id} value={store.id}>
                  {store.name}
                </Option>
              ))}
            </Select>
          </Form.Item>

          <Form.Item
            label="Trạng thái"
            name="status"
          >
            <Select>
              <Option value="active">Đang hoạt động</Option>
              <Option value="inactive">Không hoạt động</Option>
              <Option value="suspended">Tạm khóa</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Ghi chú"
            name="note"
          >
            <Input.TextArea rows={3} placeholder="Thông tin thêm cho tài khoản" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default StaffManagement;

