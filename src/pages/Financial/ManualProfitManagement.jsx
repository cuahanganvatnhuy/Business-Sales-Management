import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../../services/firebase.service';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';
import { ref, onValue, push, update, remove } from 'firebase/database';
import {
  Card,
  Table,
  Button,
  Input,
  DatePicker,
  Space,
  Tag,
  Select,
  Row,
  Col,
  Statistic,
  message,
  Popconfirm,
  Modal,
  Tooltip,
  InputNumber,
  Form
} from 'antd';
import {
  DollarOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  FilterOutlined,
  CloseCircleOutlined,
  CalendarOutlined,
  PrinterOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { formatCurrency } from '../../utils/format';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { RangePicker } = DatePicker;
const { Option } = Select;

const ShopProfitManagement = () => {
  const navigate = useNavigate();
  const { selectedStore, stores } = useStore();
  const { user, isAdmin } = useAuth();
  const userPermissions = user?.permissions || [];
  const hasPermission = isAdmin || userPermissions.includes('financial.profit.manual.view');
  const canCreate = isAdmin || userPermissions.includes('financial.profit.manual.create');
  const canEdit = isAdmin || userPermissions.includes('financial.profit.manual.edit');
  const canDelete = isAdmin || userPermissions.includes('financial.profit.manual.delete');

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Lợi Nhuận Shop. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  // States
  const [profitRecords, setProfitRecords] = useState([]);
  const [filteredRecords, setFilteredRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState([null, null]);
  const [storeFilter, setStoreFilter] = useState('current');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingRecord, setEditingRecord] = useState(null);
  const [form] = Form.useForm();
  const [expenses, setExpenses] = useState([
    { category: '', description: '', amount: 0 }
  ]);

  useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.id = 'manual-profit-management-style';
    styleTag.innerHTML = `
      .manual-profit-management :where(.css-dev-only-do-not-override-11mmrso).ant-btn {
        font-size: 12px !important;
        height: 32px !important;
        padding: 0 15px !important;
        border-radius: 6px !important;
      }
    `;
    document.head.appendChild(styleTag);
    const layoutContent = document.querySelector('.ant-layout-content');
    layoutContent?.classList.add('manual-profit-management');

    return () => {
      document.head.removeChild(styleTag);
      layoutContent?.classList.remove('manual-profit-management');
    };
  }, []);

  // Load profit records from Firebase
  useEffect(() => {
    setLoading(true);
    const profitRef = ref(database, 'manualProfitRecords');
    
    const unsubscribe = onValue(profitRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const recordsList = Object.entries(data).map(([id, record]) => ({
          id,
          key: id,
          ...record
        }));
        setProfitRecords(recordsList);
        setFilteredRecords(recordsList);
      } else {
        setProfitRecords([]);
        setFilteredRecords([]);
      }
      setLoading(false);
    }, (error) => {
      console.error('Error loading profit records:', error);
      message.error('Không thể tải dữ liệu lợi nhuận thủ công');
      setLoading(false);
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...profitRecords];

    // Store filter
    if (storeFilter === 'current' && selectedStore && selectedStore.id !== 'all') {
      filtered = filtered.filter(record => 
        record.storeName?.toLowerCase() === selectedStore.name?.toLowerCase()
      );
    } else if (storeFilter !== 'all' && storeFilter !== 'current') {
      const store = stores.find(s => s.id === storeFilter);
      if (store) {
        filtered = filtered.filter(record => 
          record.storeName?.toLowerCase() === store.name?.toLowerCase()
        );
      }
    }

    // Search filter
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(record =>
        (record.description?.toLowerCase().includes(search)) ||
        (record.category?.toLowerCase().includes(search)) ||
        (record.notes?.toLowerCase().includes(search))
      );
    }

    // Date range filter
    if (dateRange[0] && dateRange[1]) {
      filtered = filtered.filter(record => {
        const recordDate = dayjs(record.date);
        return recordDate.isAfter(dateRange[0].startOf('day')) && 
               recordDate.isBefore(dateRange[1].endOf('day'));
      });
    }

    // Category filter
    if (categoryFilter && categoryFilter !== 'all') {
      filtered = filtered.filter(record => record.category === categoryFilter);
    }

    setFilteredRecords(filtered);
  }, [searchText, dateRange, categoryFilter, storeFilter, profitRecords, selectedStore, stores]);

  // Calculate statistics
  const totalRevenue = filteredRecords.reduce((sum, record) => sum + (record.revenue || 0), 0);
  const totalCost = filteredRecords.reduce((sum, record) => sum + (record.cost || 0), 0);
  const totalProfit = filteredRecords.reduce((sum, record) => sum + (record.profit || 0), 0);
  const totalRecords = filteredRecords.length;

  // Table columns
  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      render: (_, __, index) => index + 1
    },
    {
      title: 'Ngày',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : 'N/A'
    },
    {
      title: 'Cửa Hàng',
      dataIndex: 'storeName',
      key: 'storeName',
      width: 150,
      render: (storeName) => (
        <Tag color="green" icon={<DollarOutlined />}>
          {storeName || 'N/A'}
        </Tag>
      )
    },
    {
      title: 'Mô Tả',
      dataIndex: 'description',
      key: 'description',
      width: 200,
      ellipsis: true,
      render: (description) => (
        <Tooltip title={description}>
          {description || 'N/A'}
        </Tooltip>
      )
    },
    {
      title: 'Danh Mục',
      dataIndex: 'category',
      key: 'category',
      width: 120,
      render: (category) => (
        <Tag color="blue">{category || 'N/A'}</Tag>
      )
    },
    {
      title: 'Doanh Thu',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 120,
      align: 'right',
      render: (revenue) => (
        <span style={{ color: '#52c41a', fontWeight: 600 }}>
          {formatCurrency(revenue || 0)}
        </span>
      )
    },
    {
      title: 'Chi Phí',
      dataIndex: 'cost',
      key: 'cost',
      width: 120,
      align: 'right',
      render: (cost) => (
        <span style={{ color: '#ff4d4f', fontWeight: 600 }}>
          {formatCurrency(cost || 0)}
        </span>
      )
    },
    {
      title: 'Lợi Nhuận',
      dataIndex: 'profit',
      key: 'profit',
      width: 130,
      align: 'right',
      render: (profit) => (
        <span style={{ 
          color: (profit || 0) >= 0 ? '#52c41a' : '#ff4d4f', 
          fontWeight: 600 
        }}>
          {formatCurrency(profit || 0)}
        </span>
      )
    },
    {
      title: 'Ghi Chú',
      dataIndex: 'notes',
      key: 'notes',
      width: 150,
      ellipsis: true,
      render: (notes) => (
        <Tooltip title={notes}>
          {notes || '-'}
        </Tooltip>
      )
    },
    {
      title: 'Thao Tác',
      key: 'action',
      width: 100,
      align: 'center',
      render: (_, record) => (
        <Space>
          {canEdit && (
            <Button
              icon={<EditOutlined />}
              size="small"
              onClick={() => handleEdit(record)}
            />
          )}
          {canDelete && (
            <Popconfirm
              title="Xóa bản ghi này?"
              description="Bạn có chắc chắn muốn xóa bản ghi lợi nhuận này không?"
              onConfirm={() => handleDelete(record.id)}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
            >
              <Button
                icon={<DeleteOutlined />}
                size="small"
                danger
              />
            </Popconfirm>
          )}
        </Space>
      )
    }
  ];

  // Handlers
  const handleAdd = () => {
    setEditingRecord(null);
    setExpenses([{ category: '', description: '', amount: 0 }]);
    setModalVisible(true);
    form.resetFields();
  };

  const handleEdit = (record) => {
    setEditingRecord(record);
    setModalVisible(true);
    
    // Parse expenses from record if exists
    if (record.expenses && Array.isArray(record.expenses)) {
      setExpenses(record.expenses);
    } else if (record.cost > 0) {
      // Convert single cost to expenses array
      setExpenses([{ 
        category: record.category || 'Chi phí khác', 
        description: record.description || 'Chi phí', 
        amount: record.cost || 0 
      }]);
    } else {
      // No expenses, set empty array
      setExpenses([{ category: '', description: '', amount: 0 }]);
    }
    
    form.setFieldsValue({
      ...record,
      date: record.date ? dayjs(record.date) : dayjs(),
      revenue: record.revenue || 0,
      storeName: selectedStore?.name || record.storeName || ''
    });
  };

  const addExpense = () => {
    setExpenses([...expenses, { category: '', description: '', amount: 0 }]);
  };

  const removeExpense = (index) => {
    const newExpenses = expenses.filter((_, i) => i !== index);
    setExpenses(newExpenses);
  };

  const updateExpense = (index, field, value) => {
    const newExpenses = [...expenses];
    newExpenses[index] = { ...newExpenses[index], [field]: value };
    setExpenses(newExpenses);
  };

  const handleDelete = async (id) => {
    try {
      const recordRef = ref(database, `manualProfitRecords/${id}`);
      await remove(recordRef);
      message.success('Đã xóa bản ghi thành công!');
    } catch (error) {
      console.error('Error deleting record:', error);
      message.error('Lỗi khi xóa bản ghi');
    }
  };

  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      
      // Calculate total expenses
      const totalExpenses = expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0);
      
      const recordData = {
        ...values,
        date: values.date.format('YYYY-MM-DD'),
        expenses: expenses.filter(exp => exp.amount > 0), // Only save expenses with amount > 0
        cost: totalExpenses,
        profit: (values.revenue || 0) - totalExpenses,
        updatedAt: new Date().toISOString()
      };

      if (editingRecord) {
        // Update existing record
        const recordRef = ref(database, `manualProfitRecords/${editingRecord.id}`);
        await update(recordRef, recordData);
        message.success('Đã cập nhật bản ghi thành công!');
      } else {
        // Add new record
        const newRecordRef = push(ref(database, 'manualProfitRecords'));
        await update(newRecordRef, {
          ...recordData,
          createdAt: new Date().toISOString()
        });
        message.success('Đã thêm bản ghi thành công!');
      }

      setModalVisible(false);
      form.resetFields();
      setExpenses([{ category: '', description: '', amount: 0 }]);
    } catch (error) {
      console.error('Error saving record:', error);
      message.error('Lỗi khi lưu bản ghi');
    }
  };

  const handleClearFilters = () => {
    setSearchText('');
    setDateRange([null, null]);
    setCategoryFilter('all');
    setStoreFilter('current');
    message.success('Đã xóa tất cả bộ lọc');
  };

  const handleExportExcel = () => {
    const exportData = filteredRecords.map((record, index) => ({
      'STT': index + 1,
      'Ngày': record.date ? dayjs(record.date).format('DD/MM/YYYY') : 'N/A',
      'Cửa Hàng': record.storeName || 'N/A',
      'Mô Tả': record.description || 'N/A',
      'Danh Mục': record.category || 'N/A',
      'Doanh Thu': record.revenue || 0,
      'Chi Phí': record.cost || 0,
      'Lợi Nhuận': record.profit || 0,
      'Ghi Chú': record.notes || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lợi Nhuận Shop');
    XLSX.writeFile(wb, `LoiNhuanShop_${dayjs().format('YYYYMMDD')}.xlsx`);
    message.success('Đã xuất file Excel thành công!');
  };

  return (
    <div style={{ padding: '5px' }}>
      {/* Header */}
      <Card 
        style={{ 
          marginBottom: 12,
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DollarOutlined style={{ fontSize: 32, color: '#007A33' }} />
          <div>
            <h1 className="page-title" style={{ margin: 0, color: '#007A33' }}>Lợi Nhuận Shop</h1>
            <p style={{ margin: 0, color: '#666' }}>Nhập lợi nhuận shop theo ngày</p>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card
        style={{
          marginBottom: 24,
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>Từ ngày - Đến ngày:</div>
            <Space.Compact style={{ width: '100%' }}>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                format="DD/MM/YYYY"
                style={{ width: '100%' }}
                placeholder={['Từ ngày', 'Đến ngày']}
              />
              <Button
                type="primary"
                icon={<FilterOutlined />}
                style={{ background: '#007A33' }}
              >
                Lọc
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={handleClearFilters}
              >
                Xóa Tất Cả
              </Button>
            </Space.Compact>
          </Col>
          <Col xs={24} lg={12}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>Tìm kiếm:</div>
            <Input
              placeholder="Tìm kiếm..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
        </Row>
      </Card>

      {/* Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Tổng Bản Ghi"
              value={totalRecords}
              suffix="bản ghi"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Tổng Doanh Thu"
              value={totalRevenue}
              precision={0}
              valueStyle={{ color: '#52c41a' }}
              formatter={(value) => formatCurrency(value)}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Tổng Chi Phí"
              value={totalCost}
              precision={0}
              valueStyle={{ color: '#ff4d4f' }}
              formatter={(value) => formatCurrency(value)}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Tổng Lợi Nhuận"
              value={totalProfit}
              precision={0}
              valueStyle={{ color: totalProfit >= 0 ? '#52c41a' : '#ff4d4f' }}
              formatter={(value) => formatCurrency(value)}
            />
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card
        title={<><DollarOutlined /> Danh Sách Lợi Nhuận Shop</>}
        extra={
          <Space>
            {canCreate && (
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={handleAdd}
                style={{ background: '#007A33', borderColor: '#007A33' }}
              >
                Thêm Bản Ghi
              </Button>
            )}
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportExcel}
              style={{ color: '#52c41a', borderColor: '#52c41a' }}
            >
              Xuất Excel
            </Button>
          </Space>
        }
        style={{
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        <Table
          columns={columns}
          dataSource={filteredRecords}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1200 }}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `Tổng: ${total} bản ghi`,
            pageSizeOptions: ['10', '20', '50', '100']
          }}
        />
      </Card>

      {/* Modal */}
      <Modal
        title={editingRecord ? 'Cập Nhật Lợi Nhuận' : 'Thêm Lợi Nhuận'}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        width="65%"
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{
            date: dayjs(),
            storeName: selectedStore?.name || '',
            category: 'Khác'
          }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="date"
                label="Ngày"
                rules={[{ required: true, message: 'Vui lòng chọn ngày!' }]}
              >
                <DatePicker style={{ width: '100%' }} format="DD/MM/YYYY" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="storeName"
                label="Cửa Hàng"
                rules={[{ required: true, message: 'Vui lòng nhập cửa hàng!' }]}
              >
                <Input 
                  value={selectedStore?.name || ''} 
                  readOnly 
                  style={{ background: '#f5f5f5', cursor: 'not-allowed' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="description"
            label="Mô Tả"
          >
            <Input placeholder="Nhập mô tả (nếu có)" />
          </Form.Item>
          <Form.Item
            name="revenue"
            label="Doanh Thu"
            rules={[{ required: true, message: 'Vui lòng nhập doanh thu!' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder="0"
              formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
            />
          </Form.Item>

          {/* Chi Phí Section */}
          <Form.Item label="Chi Phí">
            <div style={{ border: '1px solid #d9d9d9', borderRadius: '6px', padding: '16px', marginBottom: '16px' }}>
              {expenses.map((expense, index) => (
                <Row key={index} gutter={16} style={{ marginBottom: '8px' }}>
                  <Col span={8}>
                    <Form.Item
                      label="Danh Mục"
                      style={{ marginBottom: 0 }}
                    >
                      <Select
                        placeholder="Chọn danh mục"
                        value={expense.category}
                        onChange={(value) => updateExpense(index, 'category', value)}
                        style={{ width: '100%' }}
                      >
                        <Option value="Nhân Công">Nhân Công</Option>
                        <Option value="Mặt Bằng">Mặt Bằng</Option>
                        <Option value="Điện Nước">Điện Nước</Option>
                        <Option value="Internet">Internet</Option>
                        <Option value="Mặt Bằng Bán Hàng">Mặt Bằng Bán Hàng</Option>
                        <Option value="Vận Chuyển">Vận Chuyển</Option>
                        <Option value="Khác">Khác</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={10}>
                    <Form.Item
                      label="Mô Tả"
                      style={{ marginBottom: 0 }}
                    >
                      <Input
                        placeholder="Nhập mô tả chi phí (nếu có)"
                        value={expense.description}
                        onChange={(e) => updateExpense(index, 'description', e.target.value)}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={4}>
                    <Form.Item
                      label="Số Tiền"
                      style={{ marginBottom: 0 }}
                    >
                      <InputNumber
                        placeholder="0"
                        value={expense.amount}
                        onChange={(value) => updateExpense(index, 'amount', value || 0)}
                        formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                        style={{ width: '100%' }}
                      />
                    </Form.Item>
                  </Col>
                  <Col span={2}>
                    <Button
                      type="text"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={() => removeExpense(index)}
                      style={{ 
                        marginTop: '24px', 
                        color: '#ff4d4f',
                        border: 'none',
                        background: 'transparent',
                        padding: '4px 8px'
                      }}
                    />
                  </Col>
                </Row>
              ))}
              
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={addExpense}
                style={{ width: '100%', marginTop: '8px' }}
              >
                Thêm Chi Phí
              </Button>
            </div>
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label="Tổng Chi Phí">
                <InputNumber
                  value={expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0)}
                  disabled
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                  style={{ width: '100%', background: '#f5f5f5' }}
                />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label="Lợi Nhuận (Tự động)">
                <InputNumber
                  value={form.getFieldValue('revenue') - expenses.reduce((sum, expense) => sum + (expense.amount || 0), 0)}
                  disabled
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                  style={{ width: '100%', background: '#f5f5f5' }}
                />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item
            name="notes"
            label="Ghi Chú"
          >
            <Input.TextArea rows={3} placeholder="Nhập ghi chú (nếu có)" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ShopProfitManagement;
