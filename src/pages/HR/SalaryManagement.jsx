import React, { useState, useEffect } from 'react';
import { database } from '../../services/firebase.service';
import { ref, onValue, push, set, update, remove } from 'firebase/database';
import { 
  Card, 
  Table, 
  Button, 
  Typography, 
  Space, 
  Tag, 
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  message,
  Divider,
  Popconfirm,
  DatePicker,
  Row,
  Col,
  Statistic,
  Calendar,
  Checkbox
} from 'antd';
import {
  DollarOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;

dayjs.locale('vi');

const SalaryManagement = () => {
  const { user, isAdmin } = useAuth();
  const hasPermission = isAdmin || (user?.permissions || []).includes('hr.salary.view');

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Quản Lý Lương. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  const [loading, setLoading] = useState(false);
  const [salaries, setSalaries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [stores, setStores] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingSalary, setEditingSalary] = useState(null);
  const [attendance, setAttendance] = useState({});
  const [selectedMonth, setSelectedMonth] = useState(dayjs());
  const [form] = Form.useForm();

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
          .map(key => ({ id: key, ...data[key] }))
          .sort((a, b) => dayjs(b.createdAt).valueOf() - dayjs(a.createdAt).valueOf());
        setSalaries(salariesArray);
      } else {
        setSalaries([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  };

  // Open modal for edit/create
  const handleOpenModal = (salary = null) => {
    setEditingSalary(salary);
    if (salary) {
      form.setFieldsValue({
        ...salary,
        month: dayjs(salary.month),
        startDate: dayjs(salary.startDate),
        endDate: dayjs(salary.endDate)
      });
      setSelectedMonth(dayjs(salary.month));
      setAttendance(salary.attendance || {});
    } else {
      form.resetFields();
      setSelectedMonth(dayjs());
      setAttendance({});
    }
    setModalVisible(true);
  };

  // Initialize attendance for a month (all days worked by default)
  const initializeAttendance = (month) => {
    const startDate = dayjs(month).startOf('month');
    const endDate = dayjs(month).endOf('month');
    const daysInMonth = endDate.date();
    
    const newAttendance = {};
    for (let day = 1; day <= daysInMonth; day++) {
      const dateKey = startDate.date(day).format('YYYY-MM-DD');
      newAttendance[dateKey] = true; // Default: worked
    }
    
    setAttendance(newAttendance);
    return newAttendance;
  };

  // Toggle attendance for a specific day
  const toggleAttendance = (date) => {
    const dateKey = date.format('YYYY-MM-DD');
    setAttendance(prev => ({
      ...prev,
      [dateKey]: !prev[dateKey]
    }));
  };

  // Calculate working days
  const calculateWorkingDays = () => {
    const workedDays = Object.values(attendance).filter(v => v === true).length;
    const totalDays = Object.keys(attendance).length;
    return { workedDays, totalDays };
  };

  // Save salary
  const handleSaveSalary = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      const { workedDays, totalDays } = calculateWorkingDays();

      if (editingSalary) {
        // Update existing salary
        const updatedSalary = {
          ...editingSalary,
          ...values,
          month: values.month.format('YYYY-MM'),
          startDate: values.startDate.format('YYYY-MM-DD'),
          endDate: values.endDate.format('YYYY-MM-DD'),
          attendance: attendance,
          workedDays: workedDays,
          totalDays: totalDays,
          updatedAt: new Date().toISOString()
        };

        const salaryRef = ref(database, `salaries/${editingSalary.id}`);
        await update(salaryRef, updatedSalary);
        message.success('Đã cập nhật lương nhân viên!');
      } else {
        // Create new salary
        const salaryData = {
          employeeId: values.employeeId,
          employeeName: values.employeeName,
          storeId: values.storeId,
          storeName: values.storeName,
          employmentType: values.employmentType,
          baseSalary: values.baseSalary,
          overtimeHours: values.overtimeHours || 0,
          overtimeRate: values.overtimeRate || 0,
          bonus: values.bonus || 0,
          deduction: values.deduction || 0,
          totalSalary: calculateTotalSalary(values),
          month: values.month.format('YYYY-MM'),
          startDate: values.startDate.format('YYYY-MM-DD'),
          endDate: values.endDate.format('YYYY-MM-DD'),
          attendance: attendance,
          workedDays: workedDays,
          totalDays: totalDays,
          status: 'pending',
          notes: values.notes || '',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const salariesRef = ref(database, 'salaries');
        const newSalaryRef = push(salariesRef);
        await set(newSalaryRef, salaryData);
        message.success('Đã tạo lương nhân viên mới!');
      }

      setModalVisible(false);
      form.resetFields();
      setEditingSalary(null);
      setAttendance({});
      setLoading(false);
    } catch (error) {
      console.error('Error saving salary:', error);
      message.error('Có lỗi xảy ra!');
      setLoading(false);
    }
  };

  // Calculate total salary based on working days
  const calculateTotalSalary = (values) => {
    const base = values.baseSalary || 0;
    const { workedDays, totalDays } = calculateWorkingDays();
    
    // Calculate daily rate based on working days
    const dailyRate = totalDays > 0 ? base / totalDays : 0;
    const calculatedBase = dailyRate * workedDays;
    
    const overtime = (values.overtimeHours || 0) * (values.overtimeRate || 0);
    const bonus = values.bonus || 0;
    const deduction = values.deduction || 0;
    
    return calculatedBase + overtime + bonus - deduction;
  };

  // Delete salary
  const handleDeleteSalary = async (id) => {
    try {
      const salaryRef = ref(database, `salaries/${id}`);
      await remove(salaryRef);
      message.success('Đã xóa lương nhân viên!');
    } catch (error) {
      console.error('Error deleting salary:', error);
      message.error('Lỗi khi xóa lương nhân viên!');
    }
  };

  // Update salary status
  const handleUpdateStatus = async (id, status) => {
    try {
      const salaryRef = ref(database, `salaries/${id}`);
      await update(salaryRef, {
        status: status,
        updatedAt: new Date().toISOString()
      });
      message.success('Đã cập nhật trạng thái!');
    } catch (error) {
      console.error('Error updating status:', error);
      message.error('Lỗi khi cập nhật trạng thái!');
    }
  };

  // Table columns
  const columns = [
    {
      title: 'Nhân Viên',
      dataIndex: 'employeeName',
      key: 'employeeName',
      width: 150,
    },
    {
      title: 'Cửa Hàng',
      dataIndex: 'storeName',
      key: 'storeName',
      width: 150,
    },
    {
      title: 'Loại Hình',
      dataIndex: 'employmentType',
      key: 'employmentType',
      width: 120,
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
      title: 'Tháng',
      dataIndex: 'month',
      key: 'month',
      width: 100,
    },
    {
      title: 'Ngày Đi Làm',
      dataIndex: 'workedDays',
      key: 'workedDays',
      width: 100,
      align: 'center',
      render: (worked, record) => `${worked || 0}/${record.totalDays || 0}`
    },
    {
      title: 'Lương Cơ Bản',
      dataIndex: 'baseSalary',
      key: 'baseSalary',
      width: 120,
      align: 'right',
      render: (amount) => (
        <Text strong style={{ color: '#007A33' }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0)}
        </Text>
      )
    },
    {
      title: 'Giờ Làm Thêm',
      dataIndex: 'overtimeHours',
      key: 'overtimeHours',
      width: 100,
      align: 'center',
      render: (hours) => `${hours || 0}h`
    },
    {
      title: 'Thưởng',
      dataIndex: 'bonus',
      key: 'bonus',
      width: 100,
      align: 'right',
      render: (amount) => (
        <Text strong style={{ color: '#52c41a' }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0)}
        </Text>
      )
    },
    {
      title: 'Khấu Trừ',
      dataIndex: 'deduction',
      key: 'deduction',
      width: 100,
      align: 'right',
      render: (amount) => (
        <Text strong style={{ color: '#ff4d4f' }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0)}
        </Text>
      )
    },
    {
      title: 'Tổng Lương',
      dataIndex: 'totalSalary',
      key: 'totalSalary',
      width: 120,
      align: 'right',
      render: (amount) => (
        <Text strong style={{ color: '#1890ff', fontSize: 16 }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0)}
        </Text>
      )
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      render: (status) => {
        const statusMap = {
          pending: { label: 'Chưa thanh toán', color: 'warning' },
          paid: { label: 'Đã thanh toán', color: 'success' }
        };
        const config = statusMap[status] || { label: 'N/A', color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      }
    },
    {
      title: 'Thao Tác',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            icon={<EditOutlined />}
            onClick={() => handleOpenModal(record)}
            size="small"
          >
            Sửa
          </Button>
          {record.status === 'pending' ? (
            <Button
              type="link"
              onClick={() => handleUpdateStatus(record.id, 'paid')}
              size="small"
              style={{ color: '#52c41a' }}
            >
              Thanh toán
            </Button>
          ) : (
            <Button
              type="link"
              onClick={() => handleUpdateStatus(record.id, 'pending')}
              size="small"
              style={{ color: '#faad14' }}
            >
              Hoàn tác
            </Button>
          )}
          <Popconfirm
            title="Bạn có chắc muốn xóa?"
            onConfirm={() => handleDeleteSalary(record.id)}
            okText="Có"
            cancelText="Không"
          >
            <Button
              type="link"
              danger
              icon={<DeleteOutlined />}
              size="small"
            >
              Xóa
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ];

  // Calculate statistics
  const totalSalaries = salaries.reduce((sum, s) => sum + (s.totalSalary || 0), 0);
  const paidSalaries = salaries.filter(s => s.status === 'paid').reduce((sum, s) => sum + (s.totalSalary || 0), 0);
  const pendingSalaries = salaries.filter(s => s.status === 'pending').reduce((sum, s) => sum + (s.totalSalary || 0), 0);

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
            <DollarOutlined style={{ fontSize: 20, color: '#0f9d58' }} />
          </div>
          <div>
            <Title level={2} style={{ margin: 0, color: 'rgb(8 125 68)', fontWeight: 'bold', fontSize: 23 }}>
              Quản Lý Lương Nhân Viên
            </Title>
            <Text type="secondary">Quản lý lương cho nhân viên full-time và part-time</Text>
          </div>
        </div>
      </div>

      {/* Statistics */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Tổng Lương"
              value={totalSalaries}
              precision={0}
              valueStyle={{ color: '#007A33' }}
              prefix={<DollarOutlined />}
              formatter={(value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Đã Thanh Toán"
              value={paidSalaries}
              precision={0}
              valueStyle={{ color: '#52c41a' }}
              prefix={<DollarOutlined />}
              formatter={(value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Chưa Thanh Toán"
              value={pendingSalaries}
              precision={0}
              valueStyle={{ color: '#ff4d4f' }}
              prefix={<DollarOutlined />}
              formatter={(value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)}
            />
          </Card>
        </Col>
      </Row>

      <Card
        style={{ borderRadius: 12, boxShadow: '0 10px 30px rgba(15, 157, 88, 0.08)' }}
        bodyStyle={{ padding: 24 }}
      >
        <div style={{ marginBottom: 16 }}>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => handleOpenModal()}
            size="large"
          >
            Tạo Lương Mới
          </Button>
        </div>

        <Table
          columns={columns}
          dataSource={salaries}
          rowKey="id"
          loading={loading}
          pagination={{
            defaultPageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} bản ghi`,
          }}
          scroll={{ x: 1500 }}
        />
      </Card>

      {/* Modal Form */}
      <Modal
        title={
          <span>
            <DollarOutlined style={{ marginRight: 8 }} />
            {editingSalary ? 'Chỉnh Sửa Lương' : 'Tạo Lương Mới'}
          </span>
        }
        open={modalVisible}
        onOk={handleSaveSalary}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        width={700}
        okText={editingSalary ? 'Cập Nhật' : 'Tạo Mới'}
        cancelText="Hủy"
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 20 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Nhân Viên"
                name="employeeId"
                rules={[{ required: true, message: 'Vui lòng chọn nhân viên!' }]}
              >
                <Select
                  placeholder="Chọn nhân viên"
                  onChange={(value) => {
                    const employee = employees.find(e => e.id === value);
                    if (employee) {
                      form.setFieldsValue({ employeeName: employee.fullName || employee.email });
                    }
                  }}
                >
                  {employees.map(emp => (
                    <Option key={emp.id} value={emp.id}>
                      {emp.fullName || emp.email}
                    </Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Cửa Hàng"
                name="storeId"
                rules={[{ required: true, message: 'Vui lòng chọn cửa hàng!' }]}
              >
                <Select
                  placeholder="Chọn cửa hàng"
                  onChange={(value) => {
                    const store = stores.find(s => s.id === value);
                    if (store) {
                      form.setFieldsValue({ storeName: store.name });
                    }
                  }}
                >
                  {stores.map(store => (
                    <Option key={store.id} value={store.id}>{store.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Tên Nhân Viên"
            name="employeeName"
            rules={[{ required: true, message: 'Vui lòng nhập tên nhân viên!' }]}
          >
            <Input placeholder="Tên nhân viên" />
          </Form.Item>

          <Form.Item
            label="Tên Cửa Hàng"
            name="storeName"
            rules={[{ required: true, message: 'Vui lòng nhập tên cửa hàng!' }]}
          >
            <Input placeholder="Tên cửa hàng" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Loại Hình Làm Việc"
                name="employmentType"
                rules={[{ required: true, message: 'Vui lòng chọn loại hình!' }]}
              >
                <Select placeholder="Chọn loại hình">
                  <Option value="fulltime">Full-time</Option>
                  <Option value="parttime">Part-time</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Tháng"
                name="month"
                rules={[{ required: true, message: 'Vui lòng chọn tháng!' }]}
              >
                <DatePicker 
                  picker="month" 
                  format="MM/YYYY" 
                  style={{ width: '100%' }} 
                  onChange={(date) => {
                    if (date) {
                      setSelectedMonth(date);
                      if (!editingSalary) {
                        initializeAttendance(date);
                      }
                    }
                  }}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Ngày Bắt Đầu"
                name="startDate"
                rules={[{ required: true, message: 'Vui lòng chọn ngày bắt đầu!' }]}
              >
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Ngày Kết Thúc"
                name="endDate"
                rules={[{ required: true, message: 'Vui lòng chọn ngày kết thúc!' }]}
              >
                <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Lương Cơ Bản"
            name="baseSalary"
            rules={[{ required: true, message: 'Vui lòng nhập lương cơ bản!' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
              placeholder="Nhập lương cơ bản"
              min={0}
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Giờ Làm Thêm"
                name="overtimeHours"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  placeholder="Số giờ làm thêm"
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Đơn Giả Làm Thêm"
                name="overtimeRate"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                  placeholder="Đơn giá giờ"
                  min={0}
                />
              </Form.Item>
            </Col>
          </Row>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                label="Thưởng"
                name="bonus"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                  placeholder="Số tiền thưởng"
                  min={0}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="Khấu Trừ"
                name="deduction"
              >
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                  placeholder="Số tiền khấu trừ"
                  min={0}
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            label="Ghi Chú"
            name="notes"
          >
            <Input.TextArea rows={3} placeholder="Nhập ghi chú (tùy chọn)" />
          </Form.Item>

          <Divider orientation="left">Chấm Công</Divider>
          
          <div style={{ marginBottom: 16 }}>
            <Space>
              <Button 
                type="primary" 
                size="small"
                onClick={() => {
                  if (selectedMonth) {
                    initializeAttendance(selectedMonth);
                    message.success('Đã đánh dấu tất cả ngày là đi làm');
                  }
                }}
              >
                Đánh dấu tất cả đi làm
              </Button>
              <Button 
                size="small"
                onClick={() => {
                  const { workedDays, totalDays } = calculateWorkingDays();
                  message.info(`Đã đi làm: ${workedDays}/${totalDays} ngày`);
                }}
              >
                Xem thống kê
              </Button>
            </Space>
          </div>

          <div style={{ maxHeight: 300, overflowY: 'auto', border: '1px solid #d9d9d9', borderRadius: 8, padding: 16 }}>
            <Row gutter={[8, 8]}>
              {selectedMonth && Array.from({ length: selectedMonth.daysInMonth() }, (_, i) => {
                const date = selectedMonth.date(i + 1);
                const dateKey = date.format('YYYY-MM-DD');
                const isWorked = attendance[dateKey];
                const dayOfWeek = date.day();
                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                
                return (
                  <Col key={dateKey} span={4}>
                    <div
                      onClick={() => toggleAttendance(date)}
                      style={{
                        padding: '8px',
                        border: `2px solid ${isWorked ? '#52c41a' : '#ff4d4f'}`,
                        borderRadius: 6,
                        cursor: 'pointer',
                        textAlign: 'center',
                        background: isWorked ? '#f6ffed' : '#fff1f0',
                        transition: 'all 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                      onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                    >
                      <div style={{ fontSize: 12, fontWeight: 'bold', color: '#666' }}>
                        {date.format('DD/MM')}
                      </div>
                      <div style={{ fontSize: 10, color: '#999' }}>
                        {['CN', 'T2', 'T3', 'T4', 'T5', 'T6', 'T7'][dayOfWeek]}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        {isWorked ? (
                          <CheckCircleOutlined style={{ color: '#52c41a', fontSize: 16 }} />
                        ) : (
                          <CloseCircleOutlined style={{ color: '#ff4d4f', fontSize: 16 }} />
                        )}
                      </div>
                      {isWeekend && (
                        <div style={{ fontSize: 10, color: '#faad14', marginTop: 2 }}>
                          Cuối tuần
                        </div>
                      )}
                    </div>
                  </Col>
                );
              })}
            </Row>
          </div>

          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <Text type="secondary">
              Click vào ngày để đổi trạng thái (Đi làm / Không đi làm)
            </Text>
          </div>
        </Form>
      </Modal>
    </div>
  );
};

export default SalaryManagement;
