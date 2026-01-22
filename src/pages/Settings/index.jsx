import React, { useState, useEffect } from 'react';
import { Card, Table, Button, Space, Modal, Form, DatePicker, Input, message, Tag, Popconfirm, Typography, Select, Tabs } from 'antd';
import { SettingOutlined, ClockCircleOutlined, EditOutlined, DeleteOutlined, PlusOutlined, ShopOutlined, UserOutlined, SafetyCertificateOutlined, ReloadOutlined } from '@ant-design/icons';
import { database } from '../../services/firebase.service';
import { ref, onValue, update, get, set } from 'firebase/database';
import dayjs from 'dayjs';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const Settings = () => {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const userPermissions = user?.permissions || [];
  const hasPermission = isAdmin || userPermissions.includes('settings.view');
  const canResetConfig = isAdmin || userPermissions.includes('settings.database.reset');
  const [staffAccounts, setStaffAccounts] = useState([]);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [storeModalVisible, setStoreModalVisible] = useState(false);
  const [editingAccount, setEditingAccount] = useState(null);
  const [editingStore, setEditingStore] = useState(null);
  const [form] = Form.useForm();
  const [storeForm] = Form.useForm();

  useEffect(() => {
    loadStaffAccounts();
    loadStores();
  }, []);

  const loadStaffAccounts = async () => {
    try {
      const staffRef = ref(database, 'staffAccounts');
      const unsubscribe = onValue(staffRef, (snapshot) => {
        const data = snapshot.val() || {};
        const accounts = Object.entries(data).map(([uid, account]) => ({
          uid,
          ...account,
          expirationDate: account.expirationDate || null,
          expirationType: account.expirationType || 'never' // 'never', 'date', 'days'
        }));
        
        // Sắp xếp theo tên
        accounts.sort((a, b) => (a.fullName || '').localeCompare(b.fullName || ''));
        setStaffAccounts(accounts);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Load staff accounts error:', error);
      message.error('Không thể tải danh sách tài khoản');
    }
  };

  const loadStores = async () => {
    try {
      const storesRef = ref(database, 'stores');
      const unsubscribe = onValue(storesRef, (snapshot) => {
        const data = snapshot.val() || {};
        const storesList = Object.entries(data).map(([id, store]) => ({
          id,
          ...store,
          expirationDate: store.expirationDate || null,
          expirationType: store.expirationType || 'never'
        }));
        
        // Sắp xếp theo tên
        storesList.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setStores(storesList);
      });

      return () => unsubscribe();
    } catch (error) {
      console.error('Load stores error:', error);
      message.error('Không thể tải danh sách cửa hàng');
    }
  };

  const getExpirationStatus = (account) => {
    if (!account.expirationDate) {
      return { status: 'never', color: 'default', text: 'Không giới hạn' };
    }

    const expirationDate = dayjs(account.expirationDate);
    const now = dayjs();
    const daysLeft = expirationDate.diff(now, 'day');

    if (daysLeft < 0) {
      return { status: 'expired', color: 'red', text: `Đã hết hạn ${Math.abs(daysLeft)} ngày` };
    } else if (daysLeft <= 7) {
      return { status: 'warning', color: 'orange', text: `Còn ${daysLeft} ngày` };
    } else {
      return { status: 'active', color: 'green', text: `Còn ${daysLeft} ngày` };
    }
  };

  const openEditModal = (account = null) => {
    setEditingAccount(account);
    form.resetFields();
    
    if (account) {
      form.setFieldsValue({
        fullName: account.fullName || '',
        email: account.email || '',
        expirationType: account.expirationType || 'never',
        expirationDate: account.expirationDate ? dayjs(account.expirationDate) : null,
        days: account.expirationDays || 7
      });
    } else {
      form.setFieldsValue({
        expirationType: 'never',
        days: 7
      });
    }
    
    setModalVisible(true);
  };

  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (!editingAccount) {
        message.error('Vui lòng chọn tài khoản để chỉnh sửa');
        return;
      }

      const updates = {};
      
      // Xử lý thời gian hết hạn
      if (values.expirationType === 'date' && values.expirationDate) {
        updates.expirationDate = values.expirationDate.format('YYYY-MM-DD');
        updates.expirationType = 'date';
      } else if (values.expirationType === 'days' && values.days) {
        const expirationDate = dayjs().add(values.days, 'day');
        updates.expirationDate = expirationDate.format('YYYY-MM-DD');
        updates.expirationDays = values.days;
        updates.expirationType = 'days';
      } else if (values.expirationType === 'never') {
        updates.expirationDate = null;
        updates.expirationType = 'never';
        delete updates.expirationDays;
      }

      updates.updatedAt = Date.now();

      const accountRef = ref(database, `staffAccounts/${editingAccount.uid}`);
      await update(accountRef, updates);

      message.success('Cập nhật thời gian hết hạn thành công');
      setModalVisible(false);
      form.resetFields();
    } catch (error) {
      console.error('Save expiration error:', error);
      message.error('Không thể cập nhật thời gian hết hạn');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveExpiration = async (uid) => {
    try {
      const accountRef = ref(database, `staffAccounts/${uid}`);
      await update(accountRef, {
        expirationDate: null,
        expirationType: 'never',
        updatedAt: Date.now()
      });
      message.success('Đã xóa thời gian hết hạn');
    } catch (error) {
      console.error('Remove expiration error:', error);
      message.error('Không thể xóa thời gian hết hạn');
    }
  };

  // Hàm xử lý cửa hàng
  const openStoreEditModal = (store = null) => {
    setEditingStore(store);
    storeForm.resetFields();
    
    if (store) {
      storeForm.setFieldsValue({
        name: store.name || '',
        expirationType: store.expirationType || 'never',
        expirationDate: store.expirationDate ? dayjs(store.expirationDate) : null,
        days: store.expirationDays || 7
      });
    } else {
      storeForm.setFieldsValue({
        expirationType: 'never',
        days: 7
      });
    }
    
    setStoreModalVisible(true);
  };

  const handleSaveStore = async () => {
    try {
      const values = await storeForm.validateFields();
      setLoading(true);

      if (!editingStore) {
        message.error('Vui lòng chọn cửa hàng để chỉnh sửa');
        return;
      }

      const updates = {};
      
      // Xử lý thời gian hết hạn
      if (values.expirationType === 'date' && values.expirationDate) {
        updates.expirationDate = values.expirationDate.format('YYYY-MM-DD');
        updates.expirationType = 'date';
      } else if (values.expirationType === 'days' && values.days) {
        const expirationDate = dayjs().add(values.days, 'day');
        updates.expirationDate = expirationDate.format('YYYY-MM-DD');
        updates.expirationDays = values.days;
        updates.expirationType = 'days';
      } else if (values.expirationType === 'never') {
        updates.expirationDate = null;
        updates.expirationType = 'never';
        delete updates.expirationDays;
      }

      updates.updatedAt = Date.now();

      const storeRef = ref(database, `stores/${editingStore.id}`);
      await update(storeRef, updates);

      message.success('Cập nhật thời gian hết hạn cửa hàng thành công. Tất cả tài khoản thuộc cửa hàng này sẽ bị ảnh hưởng.');
      setStoreModalVisible(false);
      storeForm.resetFields();
    } catch (error) {
      console.error('Save store expiration error:', error);
      message.error('Không thể cập nhật thời gian hết hạn');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveStoreExpiration = async (storeId) => {
    try {
      const storeRef = ref(database, `stores/${storeId}`);
      await update(storeRef, {
        expirationDate: null,
        expirationType: 'never',
        updatedAt: Date.now()
      });
      message.success('Đã xóa thời gian hết hạn cửa hàng');
    } catch (error) {
      console.error('Remove store expiration error:', error);
      message.error('Không thể xóa thời gian hết hạn');
    }
  };

  const columns = [
    {
      title: 'Họ và tên',
      dataIndex: 'fullName',
      key: 'fullName',
      render: (text) => text || 'Chưa cập nhật'
    },
    {
      title: 'Email',
      dataIndex: 'email',
      key: 'email'
    },
    {
      title: 'Ngày hết hạn',
      dataIndex: 'expirationDate',
      key: 'expirationDate',
      render: (date, record) => {
        const status = getExpirationStatus(record);
        return (
          <Space>
            {date ? (
              <>
                <Text>{dayjs(date).format('DD/MM/YYYY')}</Text>
                <Tag color={status.color}>{status.text}</Tag>
              </>
            ) : (
              <Tag color={status.color}>{status.text}</Tag>
            )}
          </Space>
        );
      }
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const color = status === 'active' ? 'green' : status === 'inactive' ? 'red' : 'orange';
        const text = status === 'active' ? 'Hoạt động' : status === 'inactive' ? 'Không hoạt động' : 'Tạm khóa';
        return <Tag color={color}>{text}</Tag>;
      }
    },
    {
      title: 'Thao tác',
      key: 'action',
      render: (_, record) => {
        const expirationStatus = getExpirationStatus(record);
        return (
          <Space>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => openEditModal(record)}
              size="small"
            >
              Cài đặt
            </Button>
            {record.expirationDate && (
              <Popconfirm
                title="Xóa thời gian hết hạn?"
                description="Tài khoản này sẽ không còn giới hạn thời gian sử dụng."
                onConfirm={() => handleRemoveExpiration(record.uid)}
                okText="Xóa"
                cancelText="Hủy"
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                >
                  Xóa hạn
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      }
    }
  ];

  const [dbConfigModalVisible, setDbConfigModalVisible] = useState(false);
  const [editingStoreForDb, setEditingStoreForDb] = useState(null);
  const [dbForm] = Form.useForm();

  const [systemDbConfig, setSystemDbConfig] = useState(null);

  useEffect(() => {
    loadSystemDbConfig();
  }, []);

  const loadSystemDbConfig = async () => {
    try {
      // Load từ localStorage trước (nhanh hơn)
      const configStr = localStorage.getItem('firebase_custom_config');
      if (configStr) {
        try {
          const config = JSON.parse(configStr);
          setSystemDbConfig(config);
          dbForm.setFieldsValue({
            databaseUrl: config.databaseUrl || '',
            apiKey: config.apiKey || '',
            authDomain: config.authDomain || '',
            projectId: config.projectId || '',
            storageBucket: config.storageBucket || '',
            messagingSenderId: config.messagingSenderId || '',
            appId: config.appId || ''
          });
        } catch (error) {
          console.error('Error parsing config from localStorage:', error);
        }
      }
      
      // Load từ database để đồng bộ
      const configRef = ref(database, 'systemConfig/database');
      const unsubscribe = onValue(configRef, (snapshot) => {
        if (snapshot.exists()) {
          const config = snapshot.val();
          setSystemDbConfig(config);
          dbForm.setFieldsValue({
            databaseUrl: config.databaseUrl || '',
            apiKey: config.apiKey || '',
            authDomain: config.authDomain || '',
            projectId: config.projectId || '',
            storageBucket: config.storageBucket || '',
            messagingSenderId: config.messagingSenderId || '',
            appId: config.appId || ''
          });
          // Đồng bộ với localStorage
          localStorage.setItem('firebase_custom_config', JSON.stringify(config));
        }
      });
      return () => unsubscribe();
    } catch (error) {
      console.error('Load system DB config error:', error);
    }
  };

  const handleSaveDbConfig = async (values) => {
    console.log('🔵 handleSaveDbConfig được gọi với values:', values);
    
    try {
      setLoading(true);
      console.log('🟡 Bắt đầu validate...');

      // Validate các field bắt buộc
      if (!values.apiKey || !values.projectId) {
        console.log('❌ Thiếu API Key hoặc Project ID');
        message.error('Vui lòng nhập đầy đủ API Key và Project ID');
        setLoading(false);
        return;
      }

      // Validate và xử lý databaseURL
      let databaseUrl = values.databaseUrl?.trim() || '';
      
      // Loại bỏ dấu / ở cuối nếu có
      if (databaseUrl.endsWith('/')) {
        databaseUrl = databaseUrl.slice(0, -1);
      }
      
      // Kiểm tra format URL hợp lệ
      const isValidUrl = (url) => {
        if (!url) return false;
        // Pattern cho Firebase Realtime Database URL
        // Format 1: https://<project-id>-default-rtdb.<region>.firebasedatabase.app
        // Format 2: https://<project-id>.firebaseio.com
        // Region có thể chứa: chữ, số, dấu gạch ngang (ví dụ: asia-southeast1, us-central1)
        const firebaseUrlPattern1 = /^https:\/\/[a-zA-Z0-9-]+-default-rtdb\.[a-zA-Z0-9-]+\.firebasedatabase\.app\/?$/;
        const firebaseUrlPattern2 = /^https:\/\/[a-zA-Z0-9-]+\.firebaseio\.com\/?$/;
        const result = firebaseUrlPattern1.test(url) || firebaseUrlPattern2.test(url);
        console.log('🔍 URL validation:', { url, pattern1: firebaseUrlPattern1.test(url), pattern2: firebaseUrlPattern2.test(url), result });
        return result;
      };
      
      if (databaseUrl && !isValidUrl(databaseUrl)) {
        console.log('❌ Database URL không hợp lệ:', databaseUrl);
        message.error('Database URL không hợp lệ! Format đúng: https://<project-id>-default-rtdb.<region>.firebasedatabase.app hoặc https://<project-id>.firebaseio.com');
        setLoading(false);
        return;
      }
      
      if (databaseUrl) {
        console.log('✅ Database URL hợp lệ:', databaseUrl);
      }
      
      // Tự động tạo databaseURL nếu chưa có (từ projectId)
      if (!databaseUrl && values.projectId) {
        // Mặc định sử dụng format Firebase Realtime Database
        databaseUrl = `https://${values.projectId.trim()}-default-rtdb.asia-southeast1.firebasedatabase.app`;
        console.log('ℹ️ Tự động tạo Database URL:', databaseUrl);
        message.info(`Tự động tạo Database URL: ${databaseUrl}`);
      }

      const config = {
        databaseUrl: databaseUrl,
        apiKey: values.apiKey?.trim() || '',
        authDomain: values.authDomain?.trim() || '',
        projectId: values.projectId?.trim() || '',
        storageBucket: values.storageBucket?.trim() || '',
        messagingSenderId: values.messagingSenderId?.trim() || '',
        appId: values.appId?.trim() || '',
        updatedAt: Date.now()
      };

      console.log('💾 Đang lưu cấu hình database...', {
        projectId: config.projectId,
        hasDatabaseUrl: !!config.databaseUrl,
        databaseUrl: config.databaseUrl,
        hasApiKey: !!config.apiKey
      });

      // Lưu vào database
      console.log('🟢 Đang lưu vào Firebase...');
      const configRef = ref(database, 'systemConfig/database');
      await set(configRef, config);
      console.log('✅ Đã lưu vào Firebase');

      // Lưu vào localStorage để load khi khởi động lại
      localStorage.setItem('firebase_custom_config', JSON.stringify(config));
      console.log('✅ Đã lưu vào localStorage');

      console.log('✅ Đã lưu cấu hình database thành công!');
      message.success({
        content: 'Cấu hình database thành công! Đang tải lại trang để áp dụng thay đổi...',
        duration: 2,
      });
      
      // Tự động reload sau 2 giây để áp dụng config mới
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('❌ Save DB config error:', error);
      console.error('❌ Error details:', {
        message: error.message,
        code: error.code,
        stack: error.stack
      });
      message.error(`Không thể lưu cấu hình database: ${error.message || error}`, 5);
    } finally {
      setLoading(false);
      console.log('🟣 Đã kết thúc handleSaveDbConfig');
    }
  };

  const handleResetDbConfig = async () => {
    try {
      setLoading(true);
      console.log('🔄 Đang xóa cấu hình database tùy chỉnh...');

      // Xóa từ Firebase
      const configRef = ref(database, 'systemConfig/database');
      await set(configRef, null);
      console.log('✅ Đã xóa cấu hình từ Firebase');

      // Xóa từ localStorage
      localStorage.removeItem('firebase_custom_config');
      console.log('✅ Đã xóa cấu hình từ localStorage');

      // Xóa các localStorage keys cũ của Firebase
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('firebase:host:')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log('🗑️ Đã xóa localStorage key:', key);
      });

      console.log('✅ Đã xóa cấu hình database thành công!');
      message.success({
        content: 'Đã xóa cấu hình database. Đang tải lại trang để áp dụng cấu hình mặc định...',
        duration: 2,
      });

      // Tự động reload sau 2 giây để áp dụng config mặc định
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('❌ Reset DB config error:', error);
      message.error(`Không thể xóa cấu hình database: ${error.message || error}`, 5);
    } finally {
      setLoading(false);
    }
  };

  const openDbConfigModal = (store) => {
    setEditingStoreForDb(store);
    dbForm.resetFields();
    
    if (store) {
      dbForm.setFieldsValue({
        name: store.name || '',
        databaseUrl: store.databaseUrl || '',
        apiKey: store.apiKey || '',
        authDomain: store.authDomain || '',
        projectId: store.projectId || '',
        storageBucket: store.storageBucket || '',
        messagingSenderId: store.messagingSenderId || '',
        appId: store.appId || ''
      });
    }
    
    setDbConfigModalVisible(true);
  };

  const handleSaveStoreDbConfig = async () => {
    try {
      const values = await dbForm.validateFields();
      setLoading(true);

      if (!editingStoreForDb) {
        message.error('Vui lòng chọn cửa hàng để cấu hình');
        return;
      }

      const updates = {
        databaseUrl: values.databaseUrl?.trim() || '',
        apiKey: values.apiKey?.trim() || '',
        authDomain: values.authDomain?.trim() || '',
        projectId: values.projectId?.trim() || '',
        storageBucket: values.storageBucket?.trim() || '',
        messagingSenderId: values.messagingSenderId?.trim() || '',
        appId: values.appId?.trim() || '',
        updatedAt: Date.now()
      };

      const storeRef = ref(database, `stores/${editingStoreForDb.id}`);
      await update(storeRef, updates);

      message.success('Cấu hình database thành công');
      setDbConfigModalVisible(false);
      dbForm.resetFields();
    } catch (error) {
      console.error('Save DB config error:', error);
      message.error('Không thể lưu cấu hình database');
    } finally {
      setLoading(false);
    }
  };

  const storeColumns = [
    {
      title: 'Tên cửa hàng',
      dataIndex: 'name',
      key: 'name'
    },
    {
      title: 'Địa chỉ',
      dataIndex: 'address',
      key: 'address',
      render: (text) => text || 'Chưa cập nhật'
    },
    {
      title: 'Database',
      key: 'database',
      render: (_, record) => {
        const hasDbConfig = record.databaseUrl || record.projectId;
        return (
          <Tag color={hasDbConfig ? 'green' : 'default'}>
            {hasDbConfig ? 'Đã cấu hình' : 'Chưa cấu hình'}
          </Tag>
        );
      }
    },
    {
      title: 'Ngày hết hạn',
      dataIndex: 'expirationDate',
      key: 'expirationDate',
      render: (date, record) => {
        const status = getExpirationStatus(record);
        return (
          <Space>
            {date ? (
              <>
                <Text>{dayjs(date).format('DD/MM/YYYY')}</Text>
                <Tag color={status.color}>{status.text}</Tag>
              </>
            ) : (
              <Tag color={status.color}>{status.text}</Tag>
            )}
          </Space>
        );
      }
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 300,
      render: (_, record) => {
        return (
          <Space>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => openStoreEditModal(record)}
              size="small"
            >
              Hết hạn
            </Button>
            <Button
              icon={<SettingOutlined />}
              onClick={() => openDbConfigModal(record)}
              size="small"
            >
              DB Config
            </Button>
            {record.expirationDate && (
              <Popconfirm
                title="Xóa thời gian hết hạn?"
                description="Tất cả tài khoản thuộc cửa hàng này sẽ không còn giới hạn thời gian sử dụng."
                onConfirm={() => handleRemoveStoreExpiration(record.id)}
                okText="Xóa"
                cancelText="Hủy"
              >
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  size="small"
                >
                  Xóa hạn
                </Button>
              </Popconfirm>
            )}
          </Space>
        );
      }
    }
  ];

  if (!hasPermission) {
    return (
      <div style={{ padding: 24 }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Cài Đặt. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
            <SettingOutlined style={{ color: '#0f9d58' }} />
            Cài đặt thời gian hết hạn
          </Title>
          <Text type="secondary" style={{ marginTop: 8, display: 'block' }}>
            Quản lý thời gian hết hạn sử dụng. Cài đặt theo cửa hàng sẽ áp dụng cho tất cả tài khoản thuộc cửa hàng đó.
          </Text>
        </div>

        <Tabs defaultActiveKey="database">
          <TabPane 
            tab={
              <span>
                <SettingOutlined />
                Cấu hình Database
              </span>
            } 
            key="database"
          >
            <Card style={{ marginBottom: 16 }}>
              <Title level={4}>Cấu hình Database cho phần mềm</Title>
              <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
                Cấu hình kết nối database Firebase cho toàn bộ hệ thống. Thông tin này sẽ được áp dụng cho tất cả cửa hàng.
              </Text>
              <div style={{ 
                background: '#fff7e6', 
                border: '1px solid #ffd591', 
                borderRadius: 4, 
                padding: 12, 
                marginBottom: 16 
              }}>
                <Text strong style={{ color: '#d46b08' }}>📋 Hướng dẫn lấy Database URL:</Text>
                <ol style={{ marginTop: 8, marginBottom: 0, paddingLeft: 20 }}>
                  <li>Vào Firebase Console → Project của bạn (tets-ef8c6)</li>
                  <li>Chọn <strong>"Realtime Database"</strong> ở sidebar bên trái</li>
                  <li>Nếu chưa tạo database, click <strong>"Create Database"</strong></li>
                  <li>Copy URL từ phần <strong>"Data"</strong> hoặc <strong>"Database URL"</strong></li>
                  <li>Format đúng: <code>https://tets-ef8c6-default-rtdb.asia-southeast1.firebasedatabase.app</code></li>
                </ol>
              </div>
              
              <Form
                form={dbForm}
                layout="vertical"
                onFinish={handleSaveDbConfig}
                onFinishFailed={(errorInfo) => {
                  console.error('❌ Form validation failed:', errorInfo);
                  message.error('Vui lòng kiểm tra lại các trường bắt buộc');
                }}
              >
                <Form.Item
                  label="Database URL"
                  name="databaseUrl"
                  tooltip="URL của Firebase Realtime Database (ví dụ: https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app). Nếu để trống, hệ thống sẽ tự động tạo từ Project ID."
                  rules={[
                    { type: 'url', message: 'Database URL không hợp lệ', validateTrigger: 'onBlur' }
                  ]}
                >
                  <Input
                    placeholder="https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app"
                  />
                </Form.Item>

                <Form.Item
                  label="API Key"
                  name="apiKey"
                  tooltip="Firebase API Key"
                  rules={[
                    { required: true, message: 'Vui lòng nhập API Key' }
                  ]}
                >
                  <Input.Password
                    placeholder="AIzaSy..."
                  />
                </Form.Item>

                <Form.Item
                  label="Auth Domain"
                  name="authDomain"
                  tooltip="Firebase Auth Domain (ví dụ: your-project.firebaseapp.com)"
                >
                  <Input
                    placeholder="your-project.firebaseapp.com"
                  />
                </Form.Item>

                <Form.Item
                  label="Project ID"
                  name="projectId"
                  tooltip="Firebase Project ID"
                  rules={[
                    { required: true, message: 'Vui lòng nhập Project ID' }
                  ]}
                >
                  <Input
                    placeholder="your-project-id"
                  />
                </Form.Item>

                <Form.Item
                  label="Storage Bucket"
                  name="storageBucket"
                  tooltip="Firebase Storage Bucket (ví dụ: your-project.appspot.com)"
                >
                  <Input
                    placeholder="your-project.appspot.com"
                  />
                </Form.Item>

                <Form.Item
                  label="Messaging Sender ID"
                  name="messagingSenderId"
                  tooltip="Firebase Messaging Sender ID"
                >
                  <Input
                    placeholder="123456789012"
                  />
                </Form.Item>

                <Form.Item
                  label="App ID"
                  name="appId"
                  tooltip="Firebase App ID"
                >
                  <Input
                    placeholder="1:123456789012:web:abcdef123456"
                  />
                </Form.Item>

                <Form.Item>
                  <Space>
                    <Button type="primary" htmlType="submit" loading={loading}>
                      Lưu cấu hình
                    </Button>
                    {canResetConfig && (
                      <Popconfirm
                        title="Xóa cấu hình database?"
                        description="Bạn có chắc chắn muốn xóa cấu hình tùy chỉnh và quay về cấu hình mặc định? Hệ thống sẽ tự động tải lại trang."
                        onConfirm={handleResetDbConfig}
                        okText="Xóa"
                        cancelText="Hủy"
                        okButtonProps={{ danger: true }}
                      >
                        <Button 
                          danger 
                          icon={<ReloadOutlined />} 
                          loading={loading}
                        >
                          Xóa cấu hình
                        </Button>
                      </Popconfirm>
                    )}
                  </Space>
                </Form.Item>

                <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
                  💡 Lấy thông tin này từ Firebase Console {'>'} Project Settings {'>'} General {'>'} Your apps
                </Text>
              </Form>
            </Card>
          </TabPane>
          <TabPane 
            tab={
              <span>
                <ShopOutlined />
                Theo cửa hàng
              </span>
            } 
            key="stores"
          >
            <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text type="secondary">
                ⚠️ Khi cửa hàng hết hạn, TẤT CẢ tài khoản thuộc cửa hàng đó sẽ bị khóa và không thể đăng nhập.
              </Text>
            </div>
           
            <Table
              columns={storeColumns}
              dataSource={stores}
              rowKey="id"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          <TabPane 
            tab={
              <span>
                <UserOutlined />
                Theo tài khoản
              </span>
            } 
            key="accounts"
          >
            <Text type="secondary" style={{ display: 'block', marginBottom: 16 }}>
              Cài đặt thời gian hết hạn cho từng tài khoản riêng lẻ.
            </Text>
            <Table
              columns={columns}
              dataSource={staffAccounts}
              rowKey="uid"
              loading={loading}
              pagination={{ pageSize: 10 }}
            />
          </TabPane>
          <TabPane 
            tab={
              <span>
                <SafetyCertificateOutlined />
                Phân quyền
              </span>
            } 
            key="permissions"
          >
            <Card>
              <div style={{ marginBottom: 24 }}>
                <Title level={4}>Quản lý phân quyền</Title>
                <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
                  Quản lý roles và permissions cho hệ thống. Tạo roles, gán quyền và phân quyền cho nhân viên.
                </Text>
              </div>
              
              <Space direction="vertical" size="large" style={{ width: '100%' }}>
                <Card>
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Title level={5}>Quản lý Roles</Title>
                    <Text type="secondary">
                      Tạo và quản lý các nhóm quyền (roles) trong hệ thống. Mỗi role có thể có nhiều permissions khác nhau.
                    </Text>
                    <Button 
                      type="primary" 
                      icon={<SafetyCertificateOutlined />}
                      onClick={() => navigate('/hr/roles')}
                      size="large"
                    >
                      Mở trang Quản lý Roles
                    </Button>
                  </Space>
                </Card>
                
                <Card>
                  <Space direction="vertical" size="middle" style={{ width: '100%' }}>
                    <Title level={5}>Phân quyền cho nhân viên</Title>
                    <Text type="secondary">
                      Gán roles và permissions cho từng tài khoản nhân viên. Quản lý quyền truy cập cửa hàng cho từng nhân viên.
                    </Text>
                    <Button 
                      type="primary" 
                      icon={<UserOutlined />}
                      onClick={() => navigate('/hr/staff')}
                      size="large"
                    >
                      Mở trang Quản lý Nhân sự
                    </Button>
                  </Space>
                </Card>
              </Space>
            </Card>
          </TabPane>
        </Tabs>

        <Modal
          title={
            <Space>
              <ClockCircleOutlined style={{ color: '#0f9d58' }} />
              <span>Cài đặt thời gian hết hạn</span>
            </Space>
          }
          open={modalVisible}
          onCancel={() => {
            setModalVisible(false);
            form.resetFields();
          }}
          onOk={handleSave}
          okText="Lưu"
          cancelText="Hủy"
          width={600}
          confirmLoading={loading}
        >
          <Form
            form={form}
            layout="vertical"
          >
            <Form.Item label="Tài khoản">
              <Input
                value={editingAccount?.fullName || editingAccount?.email || ''}
                disabled
              />
            </Form.Item>

            <Form.Item
              label="Loại hết hạn"
              name="expirationType"
              rules={[{ required: true, message: 'Vui lòng chọn loại hết hạn' }]}
            >
              <Select>
                <Select.Option value="never">Không giới hạn</Select.Option>
                <Select.Option value="date">Theo ngày cụ thể</Select.Option>
                <Select.Option value="days">Số ngày từ hôm nay</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) =>
                prevValues.expirationType !== currentValues.expirationType
              }
            >
              {({ getFieldValue }) => {
                const expirationType = getFieldValue('expirationType');
                
                if (expirationType === 'date') {
                  return (
                    <Form.Item
                      label="Ngày hết hạn"
                      name="expirationDate"
                      rules={[{ required: true, message: 'Vui lòng chọn ngày hết hạn' }]}
                    >
                      <DatePicker
                        style={{ width: '100%' }}
                        format="DD/MM/YYYY"
                        disabledDate={(current) => current && current < dayjs().startOf('day')}
                      />
                    </Form.Item>
                  );
                }
                
                if (expirationType === 'days') {
                  return (
                    <Form.Item
                      label="Số ngày sử dụng"
                      name="days"
                      rules={[
                        { required: true, message: 'Vui lòng nhập số ngày' },
                        { type: 'number', min: 1, message: 'Số ngày phải lớn hơn 0' }
                      ]}
                    >
                      <Input
                        type="number"
                        placeholder="Ví dụ: 7 (1 tuần), 30 (1 tháng)"
                        addonAfter="ngày"
                      />
                    </Form.Item>
                  );
                }
                
                return null;
              }}
            </Form.Item>
          </Form>
        </Modal>

        <Modal
          title={
            <Space>
              <ClockCircleOutlined style={{ color: '#0f9d58' }} />
              <span>Cài đặt thời gian hết hạn cửa hàng</span>
            </Space>
          }
          open={storeModalVisible}
          onCancel={() => {
            setStoreModalVisible(false);
            storeForm.resetFields();
          }}
          onOk={handleSaveStore}
          okText="Lưu"
          cancelText="Hủy"
          width={600}
          confirmLoading={loading}
        >
          <Form
            form={storeForm}
            layout="vertical"
          >
            <Form.Item label="Cửa hàng">
              <Input
                value={editingStore?.name || ''}
                disabled
              />
            </Form.Item>

            <Form.Item
              label="Loại hết hạn"
              name="expirationType"
              rules={[{ required: true, message: 'Vui lòng chọn loại hết hạn' }]}
            >
              <Select>
                <Select.Option value="never">Không giới hạn</Select.Option>
                <Select.Option value="date">Theo ngày cụ thể</Select.Option>
                <Select.Option value="days">Số ngày từ hôm nay</Select.Option>
              </Select>
            </Form.Item>

            <Form.Item
              noStyle
              shouldUpdate={(prevValues, currentValues) =>
                prevValues.expirationType !== currentValues.expirationType
              }
            >
              {({ getFieldValue }) => {
                const expirationType = getFieldValue('expirationType');
                
                if (expirationType === 'date') {
                  return (
                    <Form.Item
                      label="Ngày hết hạn"
                      name="expirationDate"
                      rules={[{ required: true, message: 'Vui lòng chọn ngày hết hạn' }]}
                    >
                      <DatePicker
                        style={{ width: '100%' }}
                        format="DD/MM/YYYY"
                        disabledDate={(current) => current && current < dayjs().startOf('day')}
                      />
                    </Form.Item>
                  );
                }
                
                if (expirationType === 'days') {
                  return (
                    <Form.Item
                      label="Số ngày sử dụng"
                      name="days"
                      rules={[
                        { required: true, message: 'Vui lòng nhập số ngày' },
                        { type: 'number', min: 1, message: 'Số ngày phải lớn hơn 0' }
                      ]}
                    >
                      <Input
                        type="number"
                        placeholder="Ví dụ: 7 (1 tuần), 30 (1 tháng)"
                        addonAfter="ngày"
                      />
                    </Form.Item>
                  );
                }
                
                return null;
              }}
            </Form.Item>
            <Text type="warning" style={{ display: 'block', marginTop: 16 }}>
              ⚠️ Lưu ý: Khi cửa hàng hết hạn, tất cả tài khoản thuộc cửa hàng này sẽ không thể đăng nhập.
            </Text>
          </Form>
        </Modal>

        <Modal
          title={
            <Space>
              <SettingOutlined style={{ color: '#0f9d58' }} />
              <span>Cấu hình Database cho cửa hàng</span>
            </Space>
          }
          open={dbConfigModalVisible}
          onCancel={() => {
            setDbConfigModalVisible(false);
            dbForm.resetFields();
          }}
          onOk={handleSaveStoreDbConfig}
          okText="Lưu"
          cancelText="Hủy"
          width={700}
          confirmLoading={loading}
        >
          <Form
            form={dbForm}
            layout="vertical"
          >
            <Form.Item label="Cửa hàng">
              <Input
                value={editingStoreForDb?.name || ''}
                disabled
              />
            </Form.Item>

            <Form.Item
              label="Database URL"
              name="databaseUrl"
              tooltip="URL của Firebase Realtime Database (ví dụ: https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app)"
            >
              <Input
                placeholder="https://your-project-default-rtdb.asia-southeast1.firebasedatabase.app"
              />
            </Form.Item>

            <Form.Item
              label="API Key"
              name="apiKey"
              tooltip="Firebase API Key"
            >
              <Input.Password
                placeholder="AIzaSy..."
              />
            </Form.Item>

            <Form.Item
              label="Auth Domain"
              name="authDomain"
              tooltip="Firebase Auth Domain (ví dụ: your-project.firebaseapp.com)"
            >
              <Input
                placeholder="your-project.firebaseapp.com"
              />
            </Form.Item>

            <Form.Item
              label="Project ID"
              name="projectId"
              tooltip="Firebase Project ID"
            >
              <Input
                placeholder="your-project-id"
              />
            </Form.Item>

            <Form.Item
              label="Storage Bucket"
              name="storageBucket"
              tooltip="Firebase Storage Bucket (ví dụ: your-project.appspot.com)"
            >
              <Input
                placeholder="your-project.appspot.com"
              />
            </Form.Item>

            <Form.Item
              label="Messaging Sender ID"
              name="messagingSenderId"
              tooltip="Firebase Messaging Sender ID"
            >
              <Input
                placeholder="123456789012"
              />
            </Form.Item>

            <Form.Item
              label="App ID"
              name="appId"
              tooltip="Firebase App ID"
            >
              <Input
                placeholder="1:123456789012:web:abcdef123456"
              />
            </Form.Item>

            <Text type="secondary" style={{ display: 'block', marginTop: 16 }}>
              💡 Lấy thông tin này từ Firebase Console {'>'} Project Settings {'>'} General {'>'} Your apps
            </Text>
          </Form>
        </Modal>
      </Card>
    </div>
  );
};

export default Settings;

