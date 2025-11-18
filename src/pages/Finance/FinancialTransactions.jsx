import React, { useState, useEffect } from 'react';
import { 
  Card, 
  Button, 
  Upload, 
  Table, 
  DatePicker, 
  Space, 
  Statistic, 
  Row, 
  Col,
  message,
  Tag,
  Typography,
  Divider
} from 'antd';
import {
  UploadOutlined,
  FileExcelOutlined,
  SaveOutlined,
  ClearOutlined,
  DollarOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined
} from '@ant-design/icons';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';
import { database } from '../../services/firebase.service';
import { ref, push, set, onValue, remove } from 'firebase/database';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const FinancialTransactions = () => {
  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [dateRange, setDateRange] = useState([dayjs(), dayjs()]);
  const [summary, setSummary] = useState({
    totalIncome: 0,
    totalExpense: 0,
    balance: 0
  });

  // Load transactions from Firebase
  useEffect(() => {
    loadTransactions();
  }, []);

  // Calculate summary when transactions change
  useEffect(() => {
    calculateSummary();
  }, [transactions]);

  const loadTransactions = () => {
    const transactionsRef = ref(database, 'financialTransactions');
    onValue(transactionsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const transactionsArray = Object.keys(data).map(key => ({
          key,
          id: key,
          ...data[key]
        }));
        setTransactions(transactionsArray);
      } else {
        setTransactions([]);
      }
    });
  };

  const calculateSummary = () => {
    const income = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);
    
    const expense = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0);

    setSummary({
      totalIncome: income,
      totalExpense: expense,
      balance: income - expense
    });
  };

  const handleUpload = (file) => {
    setLoading(true);
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);

        console.log('Excel data:', jsonData);

        // Process and save transactions
        const processedTransactions = processExcelData(jsonData);
        saveTransactions(processedTransactions);

        message.success(`Đã tải lên ${processedTransactions.length} giao dịch`);
      } catch (error) {
        console.error('Error processing Excel:', error);
        message.error('Lỗi xử lý file Excel');
      } finally {
        setLoading(false);
      }
    };

    reader.readAsArrayBuffer(file);
    return false; // Prevent auto upload
  };

  const processExcelData = (data) => {
    return data.map(row => {
      // Detect transaction type based on common column names
      const amount = parseFloat(row['Số tiền'] || row['Amount'] || row['amount'] || 0);
      const type = row['Loại'] || row['Type'] || row['type'] || 
                   (amount >= 0 ? 'income' : 'expense');
      
      return {
        date: row['Ngày'] || row['Date'] || row['date'] || dayjs().format('YYYY-MM-DD'),
        description: row['Mô tả'] || row['Description'] || row['description'] || '',
        amount: Math.abs(amount),
        type: type,
        category: row['Danh mục'] || row['Category'] || row['category'] || '',
        reference: row['Mã tham chiếu'] || row['Reference'] || row['reference'] || '',
        createdAt: new Date().toISOString()
      };
    });
  };

  const saveTransactions = async (transactionsToSave) => {
    const transactionsRef = ref(database, 'financialTransactions');
    
    for (const transaction of transactionsToSave) {
      const newTransactionRef = push(transactionsRef);
      await set(newTransactionRef, transaction);
    }
  };

  const handleClearAll = async () => {
    if (window.confirm('Bạn có chắc muốn xóa tất cả giao dịch?')) {
      const transactionsRef = ref(database, 'financialTransactions');
      await remove(transactionsRef);
      message.success('Đã xóa tất cả giao dịch');
    }
  };

  const columns = [
    {
      title: 'Ngày',
      dataIndex: 'date',
      key: 'date',
      width: 120,
      render: (date) => dayjs(date).format('DD/MM/YYYY')
    },
    {
      title: 'Mô tả',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true
    },
    {
      title: 'Loại',
      dataIndex: 'type',
      key: 'type',
      width: 100,
      render: (type) => (
        <Tag color={type === 'income' ? 'green' : 'red'}>
          {type === 'income' ? 'Thu' : 'Chi'}
        </Tag>
      )
    },
    {
      title: 'Danh mục',
      dataIndex: 'category',
      key: 'category',
      width: 150
    },
    {
      title: 'Số tiền',
      dataIndex: 'amount',
      key: 'amount',
      width: 150,
      align: 'right',
      render: (amount, record) => (
        <Text strong style={{ color: record.type === 'income' ? '#52c41a' : '#ff4d4f' }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount)}
        </Text>
      )
    },
    {
      title: 'Mã tham chiếu',
      dataIndex: 'reference',
      key: 'reference',
      width: 150
    }
  ];

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      {/* Page Header */}
      <div style={{ 
        background: 'white', 
        padding: '16px 24px', 
        marginBottom: '24px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <DollarOutlined style={{ fontSize: '24px', color: '#127e03ff' }} />
          <Title level={2} style={{ margin: 0, color: '#127e03ff' ,fontWeight: 'bold'}}>Giao Dịch Tài Chính</Title>
        </div>
        <Text type="secondary">Tổng hợp và phân tích dữ liệu kinh doanh</Text>
      </div>

      <div style={{ background: 'white', padding: '24px', borderRadius: '8px' }}>

      {/* Summary Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="Tổng Thu"
              value={summary.totalIncome}
              precision={0}
              valueStyle={{ color: '#3f8600' }}
              prefix={<ArrowUpOutlined />}
              suffix="₫"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Tổng Chi"
              value={summary.totalExpense}
              precision={0}
              valueStyle={{ color: '#cf1322' }}
              prefix={<ArrowDownOutlined />}
              suffix="₫"
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="Số dư"
              value={summary.balance}
              precision={0}
              valueStyle={{ color: summary.balance >= 0 ? '#3f8600' : '#cf1322' }}
              prefix={<DollarOutlined />}
              suffix="₫"
            />
          </Card>
        </Col>
      </Row>

      {/* Upload Section */}
      <Card 
        title={<><FileExcelOutlined /> Tải lên dữ liệu Excel</>}
        style={{ marginBottom: 24 }}
      >
        <Space direction="vertical" style={{ width: '100%' }}>
          <RangePicker
            value={dateRange}
            onChange={setDateRange}
            format="DD/MM/YYYY"
            style={{ width: '100%' }}
          />
          <Upload
            accept=".xlsx,.xls"
            beforeUpload={handleUpload}
            showUploadList={false}
          >
            <Button 
              icon={<UploadOutlined />} 
              size="large" 
              type="primary"
              loading={loading}
            >
              Chọn file Excel
            </Button>
          </Upload>
          <Text type="secondary">
            * File Excel cần có các cột: Ngày, Mô tả, Số tiền, Loại (Thu/Chi), Danh mục
          </Text>
        </Space>
      </Card>

      {/* Transactions Table */}
      <Card
        title="Danh sách giao dịch"
        extra={
          <Button 
            danger 
            icon={<ClearOutlined />}
            onClick={handleClearAll}
          >
            Xóa tất cả
          </Button>
        }
      >
        <Table
          columns={columns}
          dataSource={transactions}
          loading={loading}
          pagination={{
            pageSize: 20,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} giao dịch`
          }}
          scroll={{ x: 1000 }}
        />
      </Card>
      </div>
    </div>
  );
};

export default FinancialTransactions;
