import React, { useState, useEffect } from 'react';
import { database } from '../../services/firebase.service';
import { ref, onValue } from 'firebase/database';
import { 
  Card, 
  Row, 
  Col, 
  Statistic, 
  Typography, 
  Table, 
  Tag,
  Space,
  Select,
  DatePicker
} from 'antd';
import {
  TeamOutlined,
  DollarOutlined,
  ClockCircleOutlined,
  UserOutlined,
  ShopOutlined,
  RiseOutlined,
  FallOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;
const { RangePicker } = DatePicker;

dayjs.locale('vi');

const HRDashboard = () => {
  const { user, isAdmin } = useAuth();
  const hasPermission = isAdmin || (user?.permissions || []).includes('hr.dashboard.view');

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Dashboard Nhân Sự. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [salaries, setSalaries] = useState([]);
  const [stores, setStores] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format('YYYY-MM'));
  const [selectedStore, setSelectedStore] = useState(null);

  // Load employees from staffAccounts
  useEffect(() => {
    const employeesRef = ref(database, 'staffAccounts');
    const unsubscribe = onValue(employeesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const employeesArray = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(emp => emp.status === 'active');
        setEmployees(employeesArray);
      } else {
        setEmployees([]);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load stores
  useEffect(() => {
    const storesRef = ref(database, 'stores');
    const unsubscribe = onValue(storesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const storesArray = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .filter(store => store.status === 'active');
        setStores(storesArray);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load salaries
  useEffect(() => {
    loadSalaries();
  }, []);

  const loadSalaries = () => {
    setLoading(true);
    const salariesRef = ref(database, 'salaries');
    
    const unsubscribe = onValue(salariesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const salariesArray = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }));
        setSalaries(salariesArray);
      } else {
        setSalaries([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  };

  // Filter salaries by month and store
  const filteredSalaries = salaries.filter(salary => {
    const matchMonth = selectedMonth ? salary.month === selectedMonth : true;
    const matchStore = selectedStore ? salary.storeId === selectedStore : true;
    return matchMonth && matchStore;
  });

  // Calculate statistics
  const totalEmployees = employees.length;
  const fullTimeEmployees = employees.filter(e => e.employmentType === 'fulltime').length;
  const partTimeEmployees = employees.filter(e => e.employmentType === 'parttime').length;

  const totalSalary = filteredSalaries.reduce((sum, s) => sum + (s.totalSalary || 0), 0);
  const paidSalary = filteredSalaries.filter(s => s.status === 'paid').reduce((sum, s) => sum + (s.totalSalary || 0), 0);
  const pendingSalary = filteredSalaries.filter(s => s.status === 'pending').reduce((sum, s) => sum + (s.totalSalary || 0), 0);

  const averageSalary = totalEmployees > 0 ? totalSalary / totalEmployees : 0;

  // Employee by store
  const employeesByStore = stores.map(store => {
    const storeEmployees = employees.filter(e => {
      // Check if employee has access to this store
      if (!e.allowedStoreIds || e.allowedStoreIds === 'all') {
        return true; // Has access to all stores
      }
      if (Array.isArray(e.allowedStoreIds)) {
        return e.allowedStoreIds.includes(store.id) || e.allowedStoreIds.includes('all');
      }
      return false;
    });
    return {
      storeName: store.name,
      total: storeEmployees.length,
      fulltime: storeEmployees.filter(e => e.employmentType === 'fulltime').length,
      parttime: storeEmployees.filter(e => e.employmentType === 'parttime').length
    };
  });

  // Salary table columns
  const salaryColumns = [
    {
      title: 'Nhân Viên',
      dataIndex: 'employeeName',
      key: 'employeeName',
    },
    {
      title: 'Cửa Hàng',
      dataIndex: 'storeName',
      key: 'storeName',
    },
    {
      title: 'Loại Hình',
      dataIndex: 'employmentType',
      key: 'employmentType',
      render: (type) => {
        const typeMap = {
          fulltime: { label: 'Full-time', color: 'blue' },
          parttime: { label: 'Part-time', color: 'green' }
        };
        const config = typeMap[type] || { label: 'N/A', color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      }
    },
    {
      title: 'Tổng Lương',
      dataIndex: 'totalSalary',
      key: 'totalSalary',
      align: 'right',
      render: (amount) => (
        <Text strong style={{ color: '#007A33' }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0)}
        </Text>
      )
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusMap = {
          pending: { label: 'Chưa thanh toán', color: 'warning' },
          paid: { label: 'Đã thanh toán', color: 'success' }
        };
        const config = statusMap[status] || { label: 'N/A', color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      }
    },
  ];

  // Store table columns
  const storeColumns = [
    {
      title: 'Cửa Hàng',
      dataIndex: 'storeName',
      key: 'storeName',
    },
    {
      title: 'Tổng Nhân Viên',
      dataIndex: 'total',
      key: 'total',
      align: 'center',
    },
    {
      title: 'Full-time',
      dataIndex: 'fulltime',
      key: 'fulltime',
      align: 'center',
      render: (count) => <Tag color="blue">{count}</Tag>
    },
    {
      title: 'Part-time',
      dataIndex: 'parttime',
      key: 'parttime',
      align: 'center',
      render: (count) => <Tag color="green">{count}</Tag>
    },
  ];

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      <div
        style={{
          background: '#fff',
          padding: '16px 24px',
          borderRadius: 12,
          marginBottom: 24,
          boxShadow: '0 12px 30px rgba(5, 153, 0, 0.08)'
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
            <TeamOutlined style={{ fontSize: 20, color: '#0f9d58' }} />
          </div>
          <div>
            <Title level={2} style={{ margin: 0, color: 'rgb(8 125 68)', fontWeight: 'bold', fontSize: 23 }}>
              Dashboard Nhân Sự
            </Title>
            <Text type="secondary">Thống kê và quản lý nhân sự</Text>
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card style={{ marginBottom: 24, borderRadius: 12 }}>
        <Space size="large">
          <div>
            <Text strong>Tháng:</Text>
            <DatePicker
              picker="month"
              format="MM/YYYY"
              value={selectedMonth ? dayjs(selectedMonth, 'YYYY-MM') : null}
              onChange={(date) => setSelectedMonth(date ? date.format('YYYY-MM') : null)}
              style={{ marginLeft: 8, width: 150 }}
            />
          </div>
          <div>
            <Text strong>Cửa Hàng:</Text>
            <Select
              placeholder="Tất cả cửa hàng"
              value={selectedStore}
              onChange={setSelectedStore}
              style={{ marginLeft: 8, width: 200 }}
              allowClear
            >
              {stores.map(store => (
                <Option key={store.id} value={store.id}>{store.name}</Option>
              ))}
            </Select>
          </div>
        </Space>
      </Card>

      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card>
            <Statistic
              title="Tổng Nhân Viên"
              value={totalEmployees}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#007A33' }}
            />
            <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
              <Space>
                <Tag color="blue">Full-time: {fullTimeEmployees}</Tag>
                <Tag color="green">Part-time: {partTimeEmployees}</Tag>
              </Space>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Tổng Lương"
              value={totalSalary}
              precision={0}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#1890ff' }}
              formatter={(value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Đã Thanh Toán"
              value={paidSalary}
              precision={0}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#52c41a' }}
              formatter={(value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="Chưa Thanh Toán"
              value={pendingSalary}
              precision={0}
              prefix={<ClockCircleOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
              formatter={(value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card>
            <Statistic
              title="Lương Trung Bình"
              value={averageSalary}
              precision={0}
              prefix={<DollarOutlined />}
              valueStyle={{ color: '#722ed1' }}
              formatter={(value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <Statistic
              title="Tỷ Lệ Thanh Toán"
              value={totalSalary > 0 ? ((paidSalary / totalSalary) * 100).toFixed(1) : 0}
              suffix="%"
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Tables */}
      <Row gutter={[16, 16]}>
        <Col span={12}>
          <Card 
            title={<span><ShopOutlined /> Nhân Viên Theo Cửa Hàng</span>}
            style={{ borderRadius: 12 }}
          >
            <Table
              columns={storeColumns}
              dataSource={employeesByStore}
              rowKey="storeName"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card 
            title={<span><DollarOutlined /> Chi Tiết Lương Tháng {selectedMonth}</span>}
            style={{ borderRadius: 12 }}
          >
            <Table
              columns={salaryColumns}
              dataSource={filteredSalaries}
              rowKey="id"
              loading={loading}
              pagination={{
                pageSize: 5,
                showSizeChanger: false,
              }}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default HRDashboard;
