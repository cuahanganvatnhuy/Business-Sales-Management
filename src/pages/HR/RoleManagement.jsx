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
  Checkbox,
  Typography,
  message,
  Tooltip,
  Dropdown
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SafetyCertificateOutlined,
  EyeOutlined,
  EllipsisOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { database } from '../../services/firebase.service';
import { useAuth } from '../../contexts/AuthContext';
import { onValue, push, ref, remove, set, update } from 'firebase/database';

const { Title, Text } = Typography;

const PERMISSION_GROUPS = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    permissions: [
      { key: 'dashboard.view', label: 'Xem trang Dashboard' }
    ]
  },
  {
    key: 'reports-manage',
    label: 'Báo Cáo',
    permissions: [
      { key: 'reports.view', label: 'Truy cập trang Báo Cáo' }
    ]
  },
  {
    key: 'products-menu',
    label: 'Sản Phẩm / Thêm Sản Phẩm',
    permissions: [
      { key: 'menu.products', label: 'Truy cập menu Sản Phẩm' },
      { key: 'products.add', label: 'Truy cập chức năng Thêm Sản Phẩm' }
    ]
  },
  {
    key: 'products-manage',
    label: 'Quản Lý Sản Phẩm',
    permissions: [
      { key: 'products.manage.edit', label: 'Chỉnh sửa sản phẩm' },
      { key: 'products.manage.delete.single', label: 'Xóa 1 sản phẩm' },
      { key: 'products.manage.delete.bulk', label: 'Xóa nhiều sản phẩm' }
    ]
  },
  {
    key: 'selling-products-manage',
    label: 'Quản Lý Sản Phẩm Bán',
    permissions: [
      { key: 'sellingProducts.view', label: 'Truy cập trang Quản Lý Sản Phẩm Bán' },
      { key: 'sellingProducts.manage.edit', label: 'Chỉnh sửa sản phẩm bán' },
      { key: 'sellingProducts.manage.delete.single', label: 'Xóa 1 sản phẩm bán' },
      { key: 'sellingProducts.manage.delete.bulk', label: 'Xóa nhiều sản phẩm bán' },
      { key: 'sellingProducts.manage.sync.all', label: 'Đồng bộ toàn bộ sản phẩm bán' },
      { key: 'sellingProducts.manage.sync.select', label: 'Chọn sản phẩm để đồng bộ' },
      { key: 'sellingProducts.manage.activate', label: 'Kích hoạt / tạm dừng sản phẩm bán' }
    ]
  },
  {
    key: 'orders-create',
    label: 'Truy Cập Trang Tạo Đơn Hàng',
    permissions: [
      { key: 'orders.create.ecommerce', label: 'Tạo Đơn Hàng TMĐT' },
      { key: 'orders.create.retail', label: 'Tạo Đơn Hàng Bán Lẻ' },
      { key: 'orders.create.wholesale', label: 'Tạo Đơn Hàng Bán Sỉ' }
    ]
  },
  {
    key: 'orders-manage-ecommerce',
    label: 'Quản Lý Đơn Hàng TMĐT',
    permissions: [
      { key: 'orders.manage.ecommerce.view', label: 'Truy cập trang Quản Lý Đơn Hàng TMĐT' },
      { key: 'orders.manage.ecommerce.detail', label: 'Xem chi tiết đơn hàng TMĐT' },
      { key: 'orders.manage.ecommerce.delete.single', label: 'Xóa 1 đơn hàng TMĐT' },
      { key: 'orders.manage.ecommerce.delete.bulk', label: 'Xóa nhiều đơn hàng TMĐT (đơn được chọn)' },
      { key: 'orders.manage.ecommerce.delete.all', label: 'Xóa tất cả đơn hàng TMĐT đang lọc' },
      { key: 'orders.manage.ecommerce.export', label: 'Xuất file Excel đơn hàng TMĐT' },
      { key: 'orders.manage.ecommerce.print', label: 'In hóa đơn đơn hàng TMĐT' }
    ]
  },
  {
    key: 'orders-manage-retail',
    label: 'Quản Lý Đơn Hàng Bán Lẻ',
    permissions: [
      { key: 'orders.manage.retail.view', label: 'Truy cập trang Quản Lý Đơn Hàng Bán Lẻ' },
      { key: 'orders.manage.retail.detail', label: 'Xem chi tiết đơn hàng Bán Lẻ' },
      { key: 'orders.manage.retail.delete.single', label: 'Xóa 1 đơn hàng Bán Lẻ' },
      { key: 'orders.manage.retail.delete.bulk', label: 'Xóa nhiều đơn hàng Bán Lẻ (đơn được chọn)' },
      { key: 'orders.manage.retail.delete.all', label: 'Xóa tất cả đơn hàng Bán Lẻ đang lọc' },
      { key: 'orders.manage.retail.export', label: 'Xuất file Excel đơn hàng Bán Lẻ' },
      { key: 'orders.manage.retail.print', label: 'In hóa đơn đơn hàng Bán Lẻ' }
    ]
  },
  {
    key: 'orders-manage-wholesale-debt',
    label: 'Quản Lý Đơn Hàng Bán Sỉ & Công Nợ',
    permissions: [
      { key: 'orders.manage.wholesale.view', label: 'Truy cập trang Quản Lý Đơn Hàng Bán Sỉ' },
      { key: 'orders.manage.wholesale.detail', label: 'Xem chi tiết đơn hàng Bán Sỉ' },
      { key: 'orders.manage.wholesale.edit', label: 'Chỉnh sửa đơn hàng Bán Sỉ' },
      { key: 'orders.manage.wholesale.delete.single', label: 'Xóa 1 đơn hàng Bán Sỉ' },
      { key: 'orders.manage.wholesale.delete.bulk', label: 'Xóa nhiều đơn hàng Bán Sỉ (đơn được chọn)' },
      { key: 'orders.manage.wholesale.delete.all', label: 'Xóa tất cả đơn hàng Bán Sỉ đang lọc' },
      { key: 'orders.debt.manage.view', label: 'Truy cập trang Công Nợ Khách Hàng Sỉ' },
      { key: 'orders.debt.dashboard.view', label: 'Truy cập trang Dashboard Công Nợ' }
    ]
  },
  {
    key: 'stores-manage',
    label: 'Quản Lý Cửa Hàng',
    permissions: [
      { key: 'stores.manage.view', label: 'Truy cập trang Quản Lý Cửa Hàng' },
      { key: 'stores.manage.add', label: 'Thêm cửa hàng' },
      { key: 'stores.manage.edit', label: 'Chỉnh sửa cửa hàng' },
      { key: 'stores.manage.delete', label: 'Xóa cửa hàng' }
    ]
  },
  {
    key: 'warehouse-inventory',
    label: 'Quản Lý Kho Hàng',
    permissions: [
      { key: 'warehouse.inventory.view', label: 'Truy cập trang Kho Hàng' },
      { key: 'warehouse.inventory.import', label: 'Nhập kho (tăng tồn kho)' },
      { key: 'warehouse.inventory.export', label: 'Xuất kho (giảm tồn kho)' },
      { key: 'warehouse.inventory.adjust', label: 'Điều chỉnh tồn kho' },
      { key: 'warehouse.inventory.detail', label: 'Xem chi tiết sản phẩm kho' },
      { key: 'warehouse.inventory.exportReport', label: 'Xuất báo cáo Kho Hàng (Excel)' }
    ]
  },
  {
    key: 'warehouse-transactions',
    label: 'Quản Lý Giao Dịch Kho',
    permissions: [
      { key: 'warehouse.transactions.view', label: 'Truy cập trang Quản Lý Giao Dịch Kho' },
      { key: 'warehouse.transactions.detail', label: 'Xem chi tiết giao dịch kho' },
      { key: 'warehouse.transactions.delete.single', label: 'Xóa 1 giao dịch kho' },
      { key: 'warehouse.transactions.delete.bulk', label: 'Xóa nhiều giao dịch kho (giao dịch được chọn)' },
      { key: 'warehouse.transactions.export', label: 'Xuất báo cáo Giao Dịch Kho (Excel)' },
      { key: 'warehouse.transactions.print', label: 'In phiếu giao dịch kho' }
    ]
  },
  {
    key: 'warehouse-reports',
    label: 'Báo Cáo Kho Hàng',
    permissions: [
      { key: 'warehouse.usageReport.view', label: 'Truy cập trang Báo Cáo Sử Dụng' },
      { key: 'warehouse.usageReport.export', label: 'Xuất báo cáo Báo Cáo Sử Dụng (Excel)' },
      { key: 'warehouse.orderReport.view', label: 'Truy cập trang Báo Cáo Đơn Hàng' },
      { key: 'warehouse.orderReport.export', label: 'Xuất báo cáo Báo Cáo Đơn Hàng (Excel)' }
    ]
  },
  {
    key: 'finance-manage',
    label: 'Quản Lý Tài Chính & Lợi Nhuận',
    permissions: [
      { key: 'finance.transactions.view', label: 'Truy cập trang Giao Dịch Tài Chính' },
      { key: 'finance.profit.overview.view', label: 'Truy cập trang Tổng Quan Lợi Nhuận' },
      { key: 'finance.profit.ecommerce.view', label: 'Truy cập trang Lợi Nhuận Đơn TMĐT' },
      { key: 'finance.profit.retail.view', label: 'Truy cập trang Lợi Nhuận Đơn Lẻ' },
      { key: 'finance.profit.wholesale.view', label: 'Truy cập trang Lợi Nhuận Đơn Sỉ' }
    ]
  },
  {
    key: 'invoices-manage',
    label: 'Quản LýHóa Đơn',
    permissions: [
      { key: 'invoices.global.view', label: 'Truy cập Trang Hóa Đơn Toàn Bộ' },
      { key: 'invoices.store.view', label: 'Truy cập Trang Hóa Đơn Từng Cửa Hàng' },
      { key: 'invoices.payment.view', label: 'Truy cập Trang Hóa Đơn Thanh Toán' }
    ]
  },
  {
    key: 'shipping-cost-manage',
    label: 'Quản Lý Chi Phí Vận Chuyển',
    permissions: [
      { key: 'shippingcost.view', label: 'Truy cập trang Quản Lý Chi Phí Vận Chuyển' },
      { key: 'shippingcost.add', label: 'Thêm chi phí vận chuyển' },
      { key: 'shippingcost.edit', label: 'Chỉnh sửa chi phí vận chuyển' },
      { key: 'shippingcost.delete', label: 'Xóa chi phí vận chuyển' },
      { key: 'shippingcost.export', label: 'Xuất báo cáo chi phí vận chuyển (Excel)' },
      { key: 'shippingcost.viewDetail', label: 'Xem chi tiết chi phí vận chuyển' }
    ]
  },
  {
    key: 'hr-roles-manage',
    label: 'Cài Đặt Phân Quyền',
    permissions: [
      { key: 'hr.roles.view', label: 'Truy cập trang Cài Đặt Phân Quyền' },
      { key: 'hr.roles.detail', label: 'Xem chi tiết quyền / role' },
      { key: 'hr.roles.add', label: 'Thêm quyền / role' },
      { key: 'hr.roles.edit', label: 'Chỉnh sửa quyền / role' },
      { key: 'hr.roles.delete', label: 'Xóa quyền / role' }
    ]
  },
  {
    key: 'hr-staff-manage',
    label: 'Quản Lý Tài Khoản Nhân Sự',
    permissions: [
      { key: 'hr.staff.view', label: 'Truy cập trang Quản Lý Tài Khoản Nhân Sự' },
      { key: 'hr.staff.add', label: 'Thêm tài khoản nhân sự' },
      { key: 'hr.staff.edit', label: 'Chỉnh sửa tài khoản nhân sự' },
      { key: 'hr.staff.delete', label: 'Xóa tài khoản nhân sự' }
    ]
  },
  {
    key: 'settings-manage',
    label: 'Quản Lý Cài Đặt',
    permissions: [
      { key: 'settings.view', label: 'Truy cập trang Cài Đặt' },
      { key: 'settings.database.config', label: 'Cấu hình Database' },
      { key: 'settings.database.reset', label: 'Xóa cấu hình Database về mặc định' },
      { key: 'settings.expiration.store', label: 'Quản lý thời gian hết hạn theo cửa hàng' },
      { key: 'settings.expiration.account', label: 'Quản lý thời gian hết hạn theo tài khoản' }
    ]
  },
  {
    key: 'categories',
    label: 'Danh Mục Sản Phẩm',
    permissions: [
      { key: 'categories.manage.edit', label: 'Chỉnh sửa danh mục' },
      { key: 'categories.manage.delete.single', label: 'Xóa 1 danh mục' },
      { key: 'categories.manage.delete.bulk', label: 'Xóa nhiều danh mục' }
    ]
  }
];

const allPermissionKeys = PERMISSION_GROUPS.flatMap(g => g.permissions.map(p => p.key));

const RoleManagement = () => {
  const { user, isAdmin } = useAuth();
  const userPermissions = user?.permissions || [];
  const hasPermission = isAdmin || userPermissions.includes('hr.roles.view');
  const canViewDetail = isAdmin || userPermissions.includes('hr.roles.detail');
  const canAddRole = isAdmin || userPermissions.includes('hr.roles.add');
  const canEditRole = isAdmin || userPermissions.includes('hr.roles.edit');
  const canDeleteRole = isAdmin || userPermissions.includes('hr.roles.delete');

  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailVisible, setDetailVisible] = useState(false);
  const [editingRole, setEditingRole] = useState(null);
  const [selectedRole, setSelectedRole] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form] = Form.useForm();

  useEffect(() => {
    const rolesRef = ref(database, 'roles');
    setLoading(true);
    const unsubscribe = onValue(rolesRef, snapshot => {
      const data = snapshot.val() || {};
      const parsed = Object.entries(data).map(([id, value]) => {
        const rawPermissions = value.permissions;
        const normalizedPermissions = Array.isArray(rawPermissions)
          ? rawPermissions
          : rawPermissions
            ? Object.keys(rawPermissions)
            : [];

        return {
          id,
          ...value,
          permissions: normalizedPermissions
        };
      });
      parsed.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      setRoles(parsed);
      setLoading(false);
    }, () => setLoading(false));

    return () => unsubscribe();
  }, []);

  const filteredRoles = useMemo(() => {
    if (!searchText.trim()) return roles;
    const q = searchText.toLowerCase();
    return roles.filter(
      r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.description || '').toLowerCase().includes(q)
    );
  }, [roles, searchText]);

  const openCreateModal = () => {
    if (!canAddRole) {
      message.error('Bạn không có quyền thêm quyền / role.');
      return;
    }
    setEditingRole(null);
    form.resetFields();
    form.setFieldsValue({ permissions: [] });
    setModalVisible(true);
  };

  const openEditModal = (record) => {
    if (!canEditRole) {
      message.error('Bạn không có quyền chỉnh sửa quyền / role.');
      return;
    }
    console.log('openEditModal record:', record);
    setEditingRole(record);
    
    // Xử lý permissions - đảm bảo là mảng
    const permissions = Array.isArray(record.permissions)
      ? record.permissions
      : record.permissions && typeof record.permissions === 'object'
      ? Object.keys(record.permissions)
      : [];

   

    // Set giá trị vào form
    form.setFieldsValue({
      name: record.name || '',
      description: record.description || '',
      permissions: permissions
    });
    
    setModalVisible(true);
  };

  // Đồng bộ dữ liệu Form khi ĐÓNG modal (Thêm / Sửa)
  useEffect(() => {
    if (!modalVisible) {
      form.resetFields();
      setEditingRole(null);
    }
  }, [modalVisible, form]);

  // Đồng bộ dữ liệu Form khi MỞ modal sửa
  useEffect(() => {
    if (modalVisible && editingRole) {
      // Xử lý permissions - đảm bảo là mảng
      const permissions = Array.isArray(editingRole.permissions)
        ? editingRole.permissions
        : editingRole.permissions && typeof editingRole.permissions === 'object'
        ? Object.keys(editingRole.permissions)
        : [];

      // Set giá trị vào form khi modal đã mở
      // Sử dụng setTimeout để đảm bảo form đã được mount
      const timer = setTimeout(() => {
        form.setFieldsValue({
          name: editingRole.name || '',
          description: editingRole.description || '',
          permissions: permissions
        });
        console.log('Form values set for editing:', {
          name: editingRole.name,
          permissionsCount: permissions.length,
          permissions: permissions
        });
      }, 150);

      return () => clearTimeout(timer);
    }
  }, [modalVisible, editingRole, form]);

  const openDetailModal = (record) => {
    if (!canViewDetail) {
      message.error('Bạn không có quyền xem chi tiết quyền / role.');
      return;
    }
    setSelectedRole(record);
    setDetailVisible(true);
  };

const handleSaveRole = async () => {
  try {
    const values = await form.validateFields();
    const permissions = Array.isArray(values.permissions) ? values.permissions : [];
    
    const payload = {
      name: values.name.trim(),
      description: (values.description || '').trim(),
      permissions,
      updatedAt: Date.now()
    };

    if (editingRole) {
      if (!canEditRole) {
        message.error('Bạn không có quyền chỉnh sửa quyền / role.');
        return;
      }
      await update(ref(database, `roles/${editingRole.id}`), payload);
      message.success('Cập nhật quyền / role thành công');
    } else {
      if (!canAddRole) {
        message.error('Bạn không có quyền thêm quyền / role.');
        return;
      }
      const newRef = push(ref(database, 'roles'));
      await set(newRef, {
        ...payload,
        createdAt: Date.now()
      });
      message.success('Tạo quyền / role mới thành công');
    }

    setModalVisible(false);
    setEditingRole(null);
    form.resetFields();
  } catch (error) {
    console.error('handleSaveRole error:', error);
    message.error('Không thể lưu quyền. Vui lòng thử lại');
  }
};

  const handleDeleteRole = async (roleId) => {
  try {
      if (!canDeleteRole) {
        message.error('Bạn không có quyền xóa quyền / role.');
        return;
      }
      if (!roleId) {
        message.error('Không xác định được quyền / role cần xóa.');
        return;
      }
      console.log('handleDeleteRole start:', roleId);
      await remove(ref(database, `roles/${roleId}`));
      message.success('Đã xóa quyền / role');
    } catch (error) {
      console.error('handleDeleteRole error:', error);
      message.error(error?.message || 'Không thể xóa quyền. Vui lòng thử lại');
    }
  };

  const columns = [
    {
      title: 'Tên quyền / role',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Space direction="vertical" size={2}>
          <Text strong>{text}</Text>
          <Text type="secondary" style={{ fontSize: 12 }}>
           
          </Text>
        </Space>
      )
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
      render: (text) => text || <Text type="secondary">Chưa có mô tả</Text>
    },
    {
      title: 'Số quyền',
      dataIndex: 'permissions',
      key: 'permissions',
      width: 120,
      render: (permissions = []) => (
        <Tag color="blue">{permissions.length} quyền</Tag>
      )
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 160,
      render: (value) => value ? dayjs(value).format('DD/MM/YYYY HH:mm') : '-'
    },
    {
      title: 'Thao tác',
      key: 'actions',
      width: 120,
      render: (_, record) => {
        const menuItems = [
          canViewDetail && {
            key: 'detail',
            icon: <EyeOutlined />,
            label: 'Chi tiết'
          },
          canEditRole && {
            key: 'edit',
            icon: <EditOutlined />,
            label: 'Sửa'
          },
          canDeleteRole && {
            key: 'delete',
            icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
            label: 'Xóa',
            danger: true
          }
        ].filter(Boolean);

        if (menuItems.length === 0) {
          return (
            <Tooltip title="Bạn không có quyền thao tác ở mục này">
              <Button
                size="small"
                icon={<EllipsisOutlined style={{ fontSize: 18, fontWeight: 'bold' }} />}
                disabled
              />
            </Tooltip>
          );
        }

        return (
          <Dropdown
            menu={{
              items: menuItems,
              onClick: ({ key }) => {
                console.log('Dropdown action click:', key, 'roleId:', record?.id);
                if (key === 'detail') {
                  openDetailModal(record);
                }
                if (key === 'edit') {
                  openEditModal(record);
                }
                if (key === 'delete') {
                  // Let dropdown close first then open confirm modal
                  setTimeout(() => {
                    console.log('Open delete confirm for role:', record?.id);
                    setDeleteTarget(record);
                  }, 0);
                }
              }
            }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              size="small"
              icon={<EllipsisOutlined style={{ fontSize: 18, fontWeight: 'bold' }} />}
            />
          </Dropdown>
        );
      }
    }
  ];

  if (!hasPermission) {
    return (
      <div style={{ padding: 24 }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Cài Đặt Phân Quyền. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  const renderPermissionCheckboxes = () => {
    const sortedGroups = [...PERMISSION_GROUPS].sort((a, b) => {
      const diff = a.permissions.length - b.permissions.length;
      if (diff !== 0) return diff;
      return a.label.localeCompare(b.label, 'vi');
    });

    return (
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: 16
        }}
      >
        {sortedGroups.map(group => (
          <div
            key={group.key}
            style={{
              flex: '1 1 calc(25% - 16px)',
              minWidth: 220,
              maxWidth: '25%'
            }}
          >
            <Card
              size="small"
              title={group.label}
              style={{ marginBottom: 12 }}
            >
              <Space direction="vertical" style={{ width: '100%' }}>
                {group.permissions.map(perm => (
                  <Form.Item
                    key={perm.key}
                    noStyle
                    shouldUpdate={false}
                  >
                    <Checkbox value={perm.key}>
                      <span style={{ color: '#000' }}>{perm.label}</span>
                    </Checkbox>
                  </Form.Item>
                ))}
              </Space>
            </Card>
          </div>
        ))}
      </div>
    );
  };

  const getPermissionLabel = (permKey) => {
    const found = PERMISSION_GROUPS
      .flatMap(g => g.permissions)
      .find(p => p.key === permKey);
    return found?.label || permKey;
  };

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
            <SafetyCertificateOutlined style={{ fontSize: 24, color: '#0f9d58' }} />
          </div>
          <div>
            <Title
              level={2}
               style={{ margin: 0, color: 'rgb(8 125 68)', fontWeight: 'bold', fontSize: 23 }}
            >
              Cài Đặt Phân Quyền
            </Title>
            <Text type="secondary">
              Quản lý các nhóm quyền sử dụng hệ thống  xem, in báo cáo...)
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
            placeholder="Tìm theo tên / mô tả quyền"
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
            Thêm quyền / role
          </Button>
        </div>
      </div>

      <Card bodyStyle={{ padding: 0 }} style={{ borderRadius: 12, boxShadow: '0 8px 24px rgba(0, 0, 0, 0.05)' }}>
        <Table
          rowKey="id"
          loading={loading}
          dataSource={filteredRoles}
          columns={columns}
          pagination={{ pageSize: 10, showSizeChanger: true }}
        />
      </Card>

      <Modal
        title={
          <Space>
            <SafetyCertificateOutlined />
            <span>{editingRole ? 'Cập nhật quyền / role' : 'Thêm quyền / role mới'}</span>
          </Space>
        }
        open={modalVisible}
        onCancel={() => {
          setModalVisible(false);
          setEditingRole(null);
          form.resetFields();
        }}
        onOk={handleSaveRole}
        okText={editingRole ? 'Cập nhật' : 'Thêm mới'}
        width="85%"
        destroyOnClose
        afterOpenChange={(open) => {
          if (open && editingRole) {
            // Xử lý permissions - đảm bảo là mảng
            const permissions = Array.isArray(editingRole.permissions)
              ? editingRole.permissions
              : editingRole.permissions && typeof editingRole.permissions === 'object'
              ? Object.keys(editingRole.permissions)
              : [];

            // Set giá trị vào form sau khi modal đã mở hoàn toàn
            setTimeout(() => {
              form.setFieldsValue({
                name: editingRole.name || '',
                description: editingRole.description || '',
                permissions: permissions
              });
              console.log('Form values set via afterOpenChange:', {
                name: editingRole.name,
                permissionsCount: permissions.length,
                permissions: permissions
              });
            }, 50);
          }
        }}
      >
        <Form
          layout="vertical"
          form={form}
          preserve={false}
        >
          <Form.Item
            label="Tên quyền / role"
            name="name"
            rules={[{ required: true, message: 'Vui lòng nhập tên quyền' }]}
          >
            <Input placeholder="Ví dụ: Admin, Kế toán, Nhân viên bán hàng..." />
          </Form.Item>

          <Form.Item
            label="Mô tả"
            name="description"
          >
            <Input.TextArea rows={3} placeholder="Mô tả ngắn về chức năng của quyền này" />
          </Form.Item>

          <Form.Item
            label="Danh sách quyền chi tiết"
            name="permissions"
          >
            <Checkbox.Group style={{ width: '100%' }}>
              {renderPermissionCheckboxes()}
            </Checkbox.Group>
          </Form.Item>

          <Form.Item shouldUpdate>
            {() => {
              const selected = form.getFieldValue('permissions') || [];
              const count = selected.length;
              return (
                <Text type="secondary">
                  Đã chọn <Text strong>{count}</Text>/{allPermissionKeys.length} quyền
                </Text>
              );
            }}
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title={
          <Space>
            <EyeOutlined />
            <span>Chi tiết quyền / role</span>
          </Space>
        }
        open={detailVisible}
        onCancel={() => {
          setDetailVisible(false);
          setSelectedRole(null);
        }}
        footer={null}
        width="85%"
      >
        {selectedRole && (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            <div>
              <Text type="secondary">Tên quyền</Text>
              <div>
                <Text strong>{selectedRole.name}</Text>
              </div>
            </div>
            <div>
              <Text type="secondary">Mô tả</Text>
              <div>
                <Text>{selectedRole.description || 'Chưa có mô tả'}</Text>
              </div>
            </div>
            <div>
              <Text type="secondary">Danh sách quyền chi tiết</Text>
              <div
                style={{
                  marginTop: 8,
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 16
                }}
              >
                {PERMISSION_GROUPS.map(group => (
                  <div
                    key={group.key}
                    style={{
                      flex: '1 1 calc(25% - 16px)',
                      minWidth: 220,
                      maxWidth: '25%'
                    }}
                  >
                    <Card
                      size="small"
                      title={group.label}
                      style={{ marginBottom: 12 }}
                    >
                      <Space direction="vertical" style={{ width: '100%' }}>
                        {group.permissions.map(perm => {
                          const isChecked =
                            Array.isArray(selectedRole.permissions) &&
                            selectedRole.permissions.includes(perm.key);

                          return (
                            <Checkbox
                              key={perm.key}
                              checked={isChecked}
                              disabled
                              className="role-permission-view-checkbox"
                            >
                              <span
                                style={
                                  isChecked
                                    ? { fontWeight: 500, color: '#000' }
                                    : undefined
                                }
                              >
                                {perm.label}
                              </span>
                            </Checkbox>
                          );
                        })}
                      </Space>
                    </Card>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <Text type="secondary">Thời gian</Text>
              <div style={{ marginTop: 4, fontSize: 12 }}>
                {selectedRole.createdAt && (
                  <div>
                    Tạo: {dayjs(selectedRole.createdAt).format('DD/MM/YYYY HH:mm')}
                  </div>
                )}
                {selectedRole.updatedAt && (
                  <div>
                    Cập nhật: {dayjs(selectedRole.updatedAt).format('DD/MM/YYYY HH:mm')}
                  </div>
                )}
              </div>
            </div>
          </Space>
        )}
      </Modal>

      {/* Confirm Delete Modal */}
      <Modal
        open={!!deleteTarget}
        title={
          <Space>
            <DeleteOutlined style={{ color: '#ff4d4f' }} />
            <span>Xóa quyền / role</span>
          </Space>
        }
        okText="Xóa"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
        onCancel={() => setDeleteTarget(null)}
        onOk={async () => {
          console.log('Confirm delete OK for role:', deleteTarget?.id);
          if (deleteTarget?.id) {
            await handleDeleteRole(deleteTarget.id);
          }
          setDeleteTarget(null);
        }}
        zIndex={2000}
        destroyOnClose
      >
        <Space direction="vertical" size={8} style={{ width: '100%' }}>
          <Text>Bạn chắc chắn muốn xóa quyền / role này?</Text>
          {deleteTarget?.name && (
            <Text>
              Quyền: <Text strong>{deleteTarget.name}</Text>
            </Text>
          )}
          <Text type="secondary">
            Những tài khoản đang dùng quyền này có thể cần phân quyền lại.
          </Text>
        </Space>
      </Modal>
    </div>
  );
};

export default RoleManagement;


