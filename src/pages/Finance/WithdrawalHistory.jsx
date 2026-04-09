import React, { useState, useEffect, useMemo } from 'react';
import { 
  Card, 
  Button, 
  Table, 
  DatePicker, 
  Space, 
  Statistic, 
  Row, 
  Col,
  message,
  Tag,
  Typography,
  Divider,
  Modal,
  Form,
  Input,
  InputNumber,
  Select,
  Spin,
  Tooltip,
  Radio
} from 'antd';
import { Line, Column } from '@ant-design/plots';
import {
  PlusOutlined,
  DeleteOutlined,
  EditOutlined,
  DollarOutlined,
  CalendarOutlined,
  UserOutlined,
  SearchOutlined,
  FilterOutlined,
  ClearOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';
import { database } from '../../services/firebase.service';
import { useAuth } from '../../contexts/AuthContext';
import { useStore } from '../../contexts/StoreContext';
import { ref, push, set, onValue, remove, update } from 'firebase/database';

const { Title, Text } = Typography;
const { Option } = Select;

const WithdrawalHistory = () => {
  const { user: currentUser } = useAuth();
  const { selectedStore } = useStore();
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();
  const [totalAmount, setTotalAmount] = useState(0);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [stores, setStores] = useState([]);
  
  // Filter states
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState(null);
  const [selectedPerson, setSelectedPerson] = useState(null);
  const [quickFilter, setQuickFilter] = useState('all');
  const [selectedStoreFilter, setSelectedStoreFilter] = useState('all');
  const [selectedWithdrawalInfoFilter, setSelectedWithdrawalInfoFilter] = useState('all');

  const effectiveStore = useMemo(() => {
    if (selectedStore) return selectedStore;
    const savedStoreId = localStorage.getItem('selectedStoreId');
    const savedStoreName = localStorage.getItem('selectedStoreName');
    if (savedStoreId && savedStoreName) {
      return { id: savedStoreId, name: savedStoreName };
    }
    return null;
  }, [selectedStore]);

  useEffect(() => {
    const storesRef = ref(database, 'stores');
    const unsubscribe = onValue(storesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const list = Object.keys(data).map((key) => ({
          id: key,
          ...data[key]
        }));
        list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
        setStores(list);
      } else {
        setStores([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Fetch withdrawals from Firebase
  useEffect(() => {
    if (!currentUser) return;

    setLoading(true);
    const withdrawalsRef = ref(database, `withdrawals/${currentUser.uid}`);
    
    const unsubscribe = onValue(withdrawalsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const withdrawalsList = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        })).sort((a, b) => new Date(b.date) - new Date(a.date));
        setWithdrawals(withdrawalsList);
      } else {
        setWithdrawals([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser]);

  // Get unique persons for filter dropdown
  const uniquePersons = useMemo(() => {
    const persons = [...new Set(withdrawals.map(w => w.person).filter(Boolean))];
    return persons.sort();
  }, [withdrawals]);

  // Filter withdrawals
  const filteredWithdrawals = useMemo(() => {
    let filtered = [...withdrawals];

    // Apply text search
    if (searchText) {
      filtered = filtered.filter(item => 
        (item.withdrawalInfo && item.withdrawalInfo.toLowerCase().includes(searchText.toLowerCase())) ||
        (item.notes && item.notes.toLowerCase().includes(searchText.toLowerCase())) ||
        (item.person && item.person.toLowerCase().includes(searchText.toLowerCase()))
      );
    }

    // Apply date range filter
    if (dateRange && dateRange.length === 2) {
      const [startDate, endDate] = dateRange;
      filtered = filtered.filter(item => {
        const itemDate = dayjs(item.date);
        return itemDate.isAfter(startDate.subtract(1, 'day')) && itemDate.isBefore(endDate.add(1, 'day'));
      });
    }

    // Apply person filter
    if (selectedPerson) {
      filtered = filtered.filter(item => item.person === selectedPerson);
    }

    // Apply store filter
    if (selectedStoreFilter && selectedStoreFilter !== 'all') {
      filtered = filtered.filter(item => item.storeId === selectedStoreFilter);
    }

    // Apply withdrawal info filter
    if (selectedWithdrawalInfoFilter && selectedWithdrawalInfoFilter !== 'all') {
      filtered = filtered.filter(item => {
        if (selectedWithdrawalInfoFilter === 'Tiên rút TikTok') {
          return item.withdrawalInfo === 'Tiên rút TikTok';
        } else if (selectedWithdrawalInfoFilter === 'Tiên hàng thanh toán') {
          return item.withdrawalInfo === 'Tiên hàng thanh toán';
        } else if (selectedWithdrawalInfoFilter === 'other') {
          return item.withdrawalInfo !== 'Tiên rút TikTok' && item.withdrawalInfo !== 'Tiên hàng thanh toán';
        }
        return true;
      });
    }

    // Apply quick filter
    if (quickFilter !== 'all') {
      const today = dayjs();
      switch (quickFilter) {
        case 'today':
          filtered = filtered.filter(item => dayjs(item.date).isSame(today, 'day'));
          break;
        case 'week':
          filtered = filtered.filter(item => dayjs(item.date).isSame(today, 'week'));
          break;
        case 'month':
          filtered = filtered.filter(item => dayjs(item.date).isSame(today, 'month'));
          break;
        case 'quarter':
          filtered = filtered.filter(item => dayjs(item.date).isSame(today, 'quarter'));
          break;
        case 'year':
          filtered = filtered.filter(item => dayjs(item.date).isSame(today, 'year'));
          break;
      }
    }

    return filtered;
  }, [withdrawals, searchText, dateRange, selectedPerson, quickFilter, selectedStoreFilter, selectedWithdrawalInfoFilter]);

  // Calculate filtered total
  const filteredTotal = useMemo(() => {
    return filteredWithdrawals.reduce((sum, item) => sum + (item.amount || 0), 0);
  }, [filteredWithdrawals]);

  // Update total amount when withdrawals change
  useEffect(() => {
    const total = withdrawals.reduce((sum, item) => sum + (item.amount || 0), 0);
    setTotalAmount(total);
  }, [withdrawals]);

  // Clear all filters
  const clearFilters = () => {
    setSearchText('');
    setDateRange(null);
    setSelectedPerson(null);
    setQuickFilter('all');
    setSelectedStoreFilter('all');
    setSelectedWithdrawalInfoFilter('all');
  };

  // Export to Excel
  const exportToExcel = () => {
    try {
      const dataToExport = filteredWithdrawals.map((item, index) => ({
        'STT': index + 1,
        'Ngày rút tiền': dayjs(item.date).format('DD/MM/YYYY'),
        'Thông tin rút tiền': item.withdrawalInfo || '',
        'Số tiền (VNÐ)': item.amount || 0,
        'Người thực hiện': item.person || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Unknown',
        'Cửa hàng': item.storeName || '',
        'Ghi chú': item.notes || '',
        'Ngày tạo': item.createdAt ? dayjs(item.createdAt).format('DD/MM/YYYY HH:mm') : ''
      }));

      // Add summary row
      if (dataToExport.length > 0) {
        dataToExport.push({
          'STT': '',
          'Ngày rút tiền': 'TỔNG CỘNG',
          'Thông tin rút tiền': '',
          'Số tiền (VNÐ)': filteredTotal,
          'Người thực hiện': '',
          'Cửa hàng': '',
          'Ghi chú': '',
          'Ngày tạo': ''
        });
      }

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(dataToExport);
      
      // Set column widths
      const colWidths = [
        { wch: 8 },  // STT
        { wch: 15 }, // Ngày rút tiên
        { wch: 30 }, // Thông tin rút tiên
        { wch: 15 }, // Số tiền
        { wch: 20 }, // Người thực hiện
        { wch: 20 }, // Cửa hàng
        { wch: 25 }, // Ghi chú
        { wch: 20 }  // Ngày tạo
      ];
      ws['!cols'] = colWidths;

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Lich Su Rut Tien');

      // Generate filename with current date
      const fileName = `Lich_Su_Rut_Tien_${dayjs().format('DDMMYYYY_HHmmss')}.xlsx`;

      // Save file
      XLSX.writeFile(wb, fileName);
      
      message.success('Xuất Excel thành công!');
    } catch (error) {
      message.error('Lỗi khi xuất Excel: ' + error.message);
    }
  };

  // Chart data preparation
  const [chartType, setChartType] = useState('monthly');
  
  const chartData = useMemo(() => {
    const groupedData = {};
    
    filteredWithdrawals.forEach(item => {
      const date = dayjs(item.date);
      let key;
      
      switch (chartType) {
        case 'daily':
          key = date.format('DD/MM');
          break;
        case 'weekly':
          key = `Tuân ${date.week()}`;
          break;
        case 'quarterly':
          key = `Q${date.quarter()}/${date.year()}`;
          break;
        case 'yearly':
          key = date.year().toString();
          break;
        default: // monthly
          key = `Tháng ${date.month() + 1}/${date.year()}`;
      }
      
      if (!groupedData[key]) {
        groupedData[key] = { period: key, amount: 0, count: 0 };
      }
      groupedData[key].amount += item.amount || 0;
      groupedData[key].count += 1;
    });
    
    return Object.values(groupedData).sort((a, b) => {
      // Sort by period (chronological)
      const aDate = dayjs(a.period, ['DD/MM', 'Tuân W', 'Q M/YYYY', 'YYYY', 'Tháng M/YYYY']);
      const bDate = dayjs(b.period, ['DD/MM', 'Tuân W', 'Q M/YYYY', 'YYYY', 'Tháng M/YYYY']);
      return aDate.isValid() && bDate.isValid() ? aDate.diff(bDate) : a.period.localeCompare(b.period);
    });
  }, [filteredWithdrawals, chartType]);

  // Chart config for line chart
  const lineChartConfig = {
    data: chartData,
    xField: 'period',
    yField: 'amount',
    point: {
      size: 5,
      shape: 'diamond',
    },
    smooth: true,
    color: '#1890ff',
    tooltip: {
      formatter: (data) => ({
        name: 'Số tiền rút',
        value: `${data.amount.toLocaleString('vi-VN')} VNÐ`,
      }),
    },
    annotations: [
      {
        type: 'line',
        start: ['min', 'median'],
        end: ['max', 'median'],
        style: {
          stroke: '#F4664A',
          lineDash: [2, 2],
        },
      },
    ],
  };

  // Chart config for column chart
  const columnChartConfig = {
    data: chartData,
    xField: 'period',
    yField: 'amount',
    color: '#52c41a',
    columnWidthRatio: 0.8,
    meta: {
      amount: {
        alias: 'Số tiên (VNÐ)',
        formatter: (v) => `${v.toLocaleString('vi-VN')}`,
      },
    },
    tooltip: {
      formatter: (data) => ({
        name: 'Số tiên rút',
        value: `${data.amount.toLocaleString('vi-VN')} VNÐ`,
      }),
    },
  };

  // Handle form submission
  const handleSubmit = async (values) => {
    try {
      // Check if user is logged in
      if (!currentUser) {
        message.error('Bạn chưa đăng nhập! Vui lòng đăng nhập lại.');
        return;
      }
      
      // Check if store is selected
      if (!effectiveStore) {
        message.error('Vui lòng chọn cửa hàng trước khi thêm giao dịch! (Bạn có thể cần chọn lại cửa hàng ở màn hình chính)');
        return;
      }
      
      console.log('Form values:', values); // Debug log
      console.log('Selected store:', effectiveStore); // Debug log
      console.log('Current user:', currentUser); // Debug log
      
      const parsedAmount = Number(values.amount);
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        message.error('Số tiền không hợp lệ. Vui lòng nhập số tiền lớn hơn 0.');
        return;
      }

      const withdrawalInfo = values.withdrawalInfoPreset === 'other'
        ? (values.withdrawalInfoCustom || '').trim()
        : values.withdrawalInfoPreset;

      if (!withdrawalInfo) {
        message.error('Vui lòng nhập thông tin rút tiền!');
        return;
      }

      const withdrawalData = {
        ...values,
        withdrawalInfo,
        date: values.date ? values.date.format('YYYY-MM-DD') : dayjs().format('YYYY-MM-DD'),
        createdAt: new Date().toISOString(),
        amount: parsedAmount,
        person: currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Unknown',
        storeName: effectiveStore?.name || 'Chưa chọn cửa hàng',
        storeId: effectiveStore?.id || null,
        notes: values.notes ?? ''
      };

      const sanitizedWithdrawalData = Object.fromEntries(
        Object.entries(withdrawalData).filter(([, v]) => v !== undefined)
      );
      
      console.log('Withdrawal data to save:', sanitizedWithdrawalData); // Debug log
      console.log('Database path:', `withdrawals/${currentUser.uid}`); // Debug log

      if (editingRecord) {
        // Update existing record
        console.log('Updating record:', editingRecord.id); // Debug log
        await update(ref(database, `withdrawals/${currentUser.uid}/${editingRecord.id}`), sanitizedWithdrawalData);
        message.success('Cập nhật thông tin rút tiền thành công!');
      } else {
        // Add new record
        console.log('Adding new record...'); // Debug log
        await push(ref(database, `withdrawals/${currentUser.uid}`), sanitizedWithdrawalData);
        message.success('Thêm thông tin rút tiền thành công!');
      }

      setIsModalVisible(false);
      form.resetFields();
      setEditingRecord(null);
    } catch (error) {
      console.error('Detailed error:', error); // Debug log
      message.error('Có lỗi xảy ra: ' + error.message);
    }
  };

  // Handle delete
  const handleDelete = async (id) => {
    Modal.confirm({
      title: 'Xác nhận xóa',
      content: 'Bạn có chắc chắn muốn xóa thông tin rút tiền này?',
      okText: 'Xóa',
      cancelText: 'Hủy',
      onOk: async () => {
        const hide = message.loading('Đang xóa...', 0);
        try {
          if (!currentUser?.uid) {
            message.error('Bạn chưa đăng nhập!');
            return;
          }
          await set(ref(database, `withdrawals/${currentUser.uid}/${id}`), null);
          message.success('Xóa thông tin rút tiền thành công!');
          setSelectedRowKeys((prev) => prev.filter((key) => key !== id));
        } catch (error) {
          message.error('Có lỗi xảy ra khi xóa: ' + error.message);
          throw error;
        } finally {
          hide();
        }
      }
    });
  };

  const handleDeleteSelected = async () => {
    if (!currentUser?.uid) {
      message.error('Bạn chưa đăng nhập!');
      return;
    }
    if (selectedRowKeys.length === 0) {
      message.warning('Vui lòng chọn ít nhất 1 giao dịch để xóa.');
      return;
    }

    Modal.confirm({
      title: 'Xác nhận xóa đã chọn',
      content: `Bạn có chắc chắn muốn xóa ${selectedRowKeys.length} giao dịch đã chọn?`,
      okText: 'Xóa',
      cancelText: 'Hủy',
      onOk: async () => {
        const hide = message.loading('Đang xóa...', 0);
        try {
          await Promise.all(
            selectedRowKeys.map((id) => set(ref(database, `withdrawals/${currentUser.uid}/${id}`), null))
          );
          message.success('Xóa giao dịch đã chọn thành công!');
          setSelectedRowKeys([]);
        } catch (error) {
          message.error('Có lỗi xảy ra khi xóa: ' + error.message);
          throw error;
        } finally {
          hide();
        }
      }
    });
  };

  const handleDeleteAllFiltered = async () => {
    if (!currentUser?.uid) {
      message.error('Bạn chưa đăng nhập!');
      return;
    }
    if (filteredWithdrawals.length === 0) {
      message.warning('Không có giao dịch nào để xóa.');
      return;
    }

    Modal.confirm({
      title: 'Xác nhận xóa tất cả',
      content: `Bạn có chắc chắn muốn xóa ${filteredWithdrawals.length} giao dịch đang hiển thị?`,
      okText: 'Xóa',
      cancelText: 'Hủy',
      onOk: async () => {
        const hide = message.loading('Đang xóa...', 0);
        try {
          await Promise.all(
            filteredWithdrawals.map((w) => set(ref(database, `withdrawals/${currentUser.uid}/${w.id}`), null))
          );
          message.success('Xóa tất cả giao dịch đang hiển thị thành công!');
          setSelectedRowKeys([]);
        } catch (error) {
          message.error('Có lỗi xảy ra khi xóa: ' + error.message);
          throw error;
        } finally {
          hide();
        }
      }
    });
  };

  // Handle edit
  const handleEdit = (record) => {
    setEditingRecord(record);
    const presets = ['Tiên rút TikTok', 'Tiên hàng thanh toán'];
    const preset = presets.includes(record.withdrawalInfo) ? record.withdrawalInfo : 'other';
    form.setFieldsValue({
      ...record,
      date: dayjs(record.date)
      ,
      withdrawalInfoPreset: preset,
      withdrawalInfoCustom: preset === 'other' ? (record.withdrawalInfo || '') : ''
    });
    setIsModalVisible(true);
  };

  // Table columns
  const columns = [
    {
      title: 'Ngày rút tiền',
      dataIndex: 'date',
      key: 'date',
      sorter: (a, b) => new Date(a.date) - new Date(b.date),
      render: (date) => dayjs(date).format('DD/MM/YYYY')
    },
    {
      title: 'Thông tin rút tiền',
      dataIndex: 'withdrawalInfo',
      key: 'withdrawalInfo',
      render: (info) => info || '-'
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      sorter: (a, b) => a.amount - b.amount,
      render: (amount) => (
        <Text strong style={{ color: '#f5222d' }}>
          {amount.toLocaleString('vi-VN')} VNÐ
        </Text>
      )
    },
    {
      title: 'Người thực hiện',
      dataIndex: 'person',
      key: 'person',
      render: (person) => person || currentUser?.displayName || currentUser?.email?.split('@')[0] || 'Unknown'
    },
    {
      title: 'Cửa hàng',
      dataIndex: 'storeName',
      key: 'storeName',
      render: (storeName) => storeName || '-'
    },
    {
      title: 'Ghi chú',
      dataIndex: 'notes',
      key: 'notes',
      render: (notes) => notes || '-'
    },
    {
      title: 'Thao tác',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button 
            type="primary" 
            size="small" 
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            Sửa
          </Button>
          <Button 
            danger 
            size="small" 
            icon={<DeleteOutlined />}
            onClick={() => handleDelete(record.id)}
          >
            Xóa
          </Button>
        </Space>
      )
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Title level={2}>Lịch Sử Rút Tiền</Title>
      
      {/* Statistics Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Tổng số tiền đã rút"
              value={filteredTotal}
              formatter={(value) => `${value.toLocaleString('vi-VN')} VNÐ`}
              prefix={<DollarOutlined style={{ color: '#f5222d' }} />}
              valueStyle={{ color: '#f5222d' }}
            />
            {filteredTotal !== totalAmount && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Tổng cộng: {totalAmount.toLocaleString('vi-VN')} VNÐ
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Số giao dịch"
              value={filteredWithdrawals.length}
              prefix={<CalendarOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
            {filteredWithdrawals.length !== withdrawals.length && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Tổng cộng: {withdrawals.length} giao dịch
              </div>
            )}
          </Card>
        </Col>
        <Col xs={24} sm={12} md={8}>
          <Card>
            <Statistic
              title="Trung bình mỗi lần rút"
              value={filteredWithdrawals.length > 0 ? filteredTotal / filteredWithdrawals.length : 0}
              formatter={(value) => `${Math.round(value).toLocaleString('vi-VN')} VNÐ`}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
            {filteredWithdrawals.length !== withdrawals.length && (
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                TB cộng: {withdrawals.length > 0 ? Math.round(totalAmount / withdrawals.length).toLocaleString('vi-VN') : 0} VNÐ
              </div>
            )}
          </Card>
        </Col>
      </Row>

      {/* Chart Card */}
      <Card 
        title="Biểu đồ thống kê rút tiền"
        extra={
          <Radio.Group 
            value={chartType} 
            onChange={(e) => setChartType(e.target.value)}
            size="small"
          >
            <Radio.Button value="daily">Ngày</Radio.Button>
            <Radio.Button value="weekly">Tuần</Radio.Button>
            <Radio.Button value="monthly">Tháng</Radio.Button>
            <Radio.Button value="quarterly">Quý</Radio.Button>
            <Radio.Button value="yearly">Năm</Radio.Button>
          </Radio.Group>
        }
        style={{ marginBottom: '16px' }}
      >
        {chartData.length > 0 ? (
          <Row gutter={[16, 16]}>
            <Col xs={24} lg={12}>
              <div style={{ marginBottom: '16px' }}>
                <Text strong>Biểu Đồ Đường</Text>
              </div>
              <Line {...lineChartConfig} height={300} />
            </Col>
            <Col xs={24} lg={12}>
              <div style={{ marginBottom: '16px' }}>
                <Text strong>Biểu Đồ Cột</Text>
              </div>
              <Column {...columnChartConfig} height={300} />
            </Col>
          </Row>
        ) : (
          <div style={{ textAlign: 'center', padding: '60px 0', color: '#999' }}>
            <Text type="secondary">Không có dữ liệu</Text>
          </div>
        )}
      </Card>

      {/* Filter Card */}
      <Card 
        title="Bộ lọc & Tìm kiếm"
        size="small"
        style={{ marginBottom: '16px' }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} sm={12} md={6} lg={6}>
            <Input
              placeholder="Tìm kiếm theo thông tin, ghi chú..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} sm={12} md={4} lg={4}>
            <Select
              placeholder="Lọc theo người thực hiện"
              value={selectedPerson}
              onChange={setSelectedPerson}
              allowClear
              style={{ width: '100%' }}
            >
              {uniquePersons.map(person => (
                <Option key={person} value={person}>{person}</Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4} lg={4}>
            <Select
              placeholder="Lọc theo cửa hàng"
              value={selectedStoreFilter}
              onChange={setSelectedStoreFilter}
              style={{ width: '100%' }}
            >
              <Option value="all">Tất cả cửa hàng</Option>
              {stores.map((store) => (
                <Option key={store.id} value={store.id}>
                  {store.name || store.id}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} sm={12} md={4} lg={4}>
            <Select
              placeholder="Lọc theo thông tin rút tiền"
              value={selectedWithdrawalInfoFilter}
              onChange={setSelectedWithdrawalInfoFilter}
              style={{ width: '100%' }}
            >
              <Option value="all">Tất cả</Option>
              <Option value="Tiền rút TikTok">Tiền rút TikTok</Option>
              <Option value="Tiền hàng thanh toán">Tiền hàng thanh toán</Option>
              <Option value="other">Khác</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6} lg={6}>
            <DatePicker.RangePicker
              placeholder={['Từ ngày', 'Đến ngày']}
              value={dateRange}
              onChange={setDateRange}
              style={{ width: '100%' }}
            />
          </Col>
          <Col xs={24} sm={12} md={4} lg={4}>
            <Select
              placeholder="Lọc nhanh"
              value={quickFilter}
              onChange={setQuickFilter}
              style={{ width: '100%' }}
            >
              <Option value="all">Tất cả</Option>
              <Option value="today">Hôm nay</Option>
              <Option value="week">Tuần này</Option>
              <Option value="month">Tháng này</Option>
              <Option value="quarter">Quý này</Option>
              <Option value="year">Năm này</Option>
            </Select>
          </Col>
          <Col xs={24} sm={12} md={6} lg={6}>
            <DatePicker.RangePicker
              placeholder={['Từ ngày', 'Đến ngày']}
              value={dateRange}
              onChange={setDateRange}
              style={{ width: '100%' }}
            />
          </Col>
           <Row style={{ marginTop: '0px' }}>
          <Col span={24}>
            <Space>
              <Button 
                icon={<ClearOutlined />}
                onClick={clearFilters}
                disabled={!searchText && !dateRange && !selectedPerson && quickFilter === 'all' && selectedStoreFilter === 'all' && selectedWithdrawalInfoFilter === 'all'}
              >
                Xóa bộ lọc
              </Button>
              <Text type="secondary">
                Hiển thị {filteredWithdrawals.length} / {withdrawals.length} giao dịch
              </Text>
            </Space>
          </Col>
        </Row>
        </Row>
       
      </Card>

      {/* Main Table Card */}
      <Card 
        title="Danh sách lịch sử rút tiền"
        extra={
          <Space>
            <Tooltip title="Xuât danh sách ra file Excel">
              <Button 
                icon={<DownloadOutlined />}
                onClick={exportToExcel}
                disabled={filteredWithdrawals.length === 0}
              >
                Xuất Excel
              </Button>
            </Tooltip>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleDeleteSelected}
              disabled={selectedRowKeys.length === 0}
            >
              Xóa đã chọn
            </Button>
            <Button
              danger
              icon={<DeleteOutlined />}
              onClick={handleDeleteAllFiltered}
              disabled={filteredWithdrawals.length === 0}
            >
              Xóa tất cả
            </Button>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => {
                setEditingRecord(null);
                form.resetFields();
                setIsModalVisible(true);
              }}
            >
              Thêm Thông Tin Rút Tiền
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={filteredWithdrawals}
          loading={loading}
          rowKey="id"
          rowSelection={{
            selectedRowKeys,
            onChange: (keys) => setSelectedRowKeys(keys)
          }}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total, range) => 
              `Hiển thị ${range[0]}-${range[1]} trong ${total} giao dịch`
          }}
          scroll={{ x: 800 }}
          locale={{
            emptyText: searchText || dateRange || selectedPerson || quickFilter !== 'all' 
              ? 'Không tìm thấy giao dịch phù hợp với bộ lọc' 
              : 'Chưa có dữ liệu giao dịch'
          }
          }
        />
      </Card>

      {/* Add/Edit Modal */}
      <Modal
        title={editingRecord ? "Chỉnh Sửa Thông Tin Rút Tiền" : "Thêm Thông Tin Rút Tiền"}
        open={isModalVisible}
        onCancel={() => {
          setIsModalVisible(false);
          form.resetFields();
          setEditingRecord(null);
        }}
        footer={null}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            date: dayjs(),
            withdrawalInfoPreset: 'Tiền rút TikTok'
          }}
        >
          <Form.Item
            name="date"
            label="Ngày rút tiền"
            rules={[{ required: true, message: 'Vui lòng chọn ngày rút tiền!' }]}
          >
            <DatePicker 
              style={{ width: '100%' }} 
              format="DD/MM/YYYY"
              placeholder="Chọn ngày rút tiền"
            />
          </Form.Item>

          <Form.Item
            name="withdrawalInfoPreset"
            label="Thông tin rút tiền"
            rules={[{ required: true, message: 'Vui lòng chọn thông tin rút tiền!' }]}
          >
            <Select style={{ width: '100%' }}>
              <Option value="Tiền rút TikTok">Tiền rút TikTok</Option>
              <Option value="Tiền hàng thanh toán">Tiền hàng thanh toán</Option>
              <Option value="other">Khác...</Option>
            </Select>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prev, curr) => prev.withdrawalInfoPreset !== curr.withdrawalInfoPreset}
          >
            {({ getFieldValue }) =>
              getFieldValue('withdrawalInfoPreset') === 'other' ? (
                <Form.Item
                  name="withdrawalInfoCustom"
                  label="Nhập thông tin rút tiền"
                  rules={[{ required: true, message: 'Vui lòng nhập thông tin rút tiền!' }]}
                >
                  <Input.TextArea
                    rows={3}
                    placeholder="Nhập thông tin chi tiết về lần rút tiền"
                  />
                </Form.Item>
              ) : null
            }
          </Form.Item>

          <Form.Item
            name="amount"
            label="Số tiền (VNÐ)"
            rules={[
              { required: true, message: 'Vui lòng nhập số tiền!' },
              { type: 'number', min: 1, message: 'Số tiền phải lớn hơn 0 !' }
            ]}
          >
            <InputNumber
              style={{ width: '100%' }}
              formatter={(value) => {
                if (value === null || value === undefined) return '';
                return `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
              }}
              parser={(value) => {
                if (value === null || value === undefined) return '';
                return value.toString().replace(/\$\s?|(,*)/g, '');
              }}
              placeholder="Nhập số tiền"
              min={0}
              step={1000}
            />
          </Form.Item>


          <Form.Item
            name="storeName"
            label="Cửa hàng"
            initialValue={effectiveStore?.name || ''}
          >
            <Input 
              placeholder="Cửa hàng thực hiện rút tiền" 
              disabled
              value={effectiveStore?.name || ''}
            />
          </Form.Item>

          <Form.Item
            name="notes"
            label="Ghi chú"
          >
            <Input.TextArea 
              rows={2}
              placeholder="Nhập ghi chú thêm (nếu có)"
            />
          </Form.Item>

          <Form.Item>
            <Space>
              <Button type="primary" htmlType="submit">
                {editingRecord ? "Cập Nhật" : "Thêm"}
              </Button>
              <Button 
                onClick={() => {
                  setIsModalVisible(false);
                  form.resetFields();
                  setEditingRecord(null);
                }}
              >
                Hủy
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default WithdrawalHistory;
