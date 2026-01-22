import React, { useState, useEffect, useMemo } from 'react';
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
  Divider,
  Modal,
  Spin
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
import { useAuth } from '../../contexts/AuthContext';
import { ref, push, set, onValue, remove } from 'firebase/database';

const { RangePicker } = DatePicker;
const { Title, Text } = Typography;

const COLUMN_HEADERS = {
  orderId: ['Order/adjustment ID', 'Mã giao dịch/Điều chỉnh', 'Order ID'],
  type: ['Type', 'Loại giao dịch'],
  orderCreatedTime: ['Order created time', 'Thời gian tạo đơn'],
  orderSettledTime: ['Order settled time', 'Thời gian tất toán'],
  currency: ['Currency', 'Tiền tệ'],
  totalSettlementAmount: ['Total settlement amount', 'Tổng tiền thanh toán'],
  totalRevenue: ['Total Revenue', 'Tổng doanh thu'],
  subtotalAfterDiscount: ['Subtotal after seller discounts', 'Giá trị sau giảm giá'],
  subtotalBeforeDiscount: ['Subtotal before discounts', 'Giá trị trước giảm giá'],
  sellerDiscounts: ['Seller discounts', 'Giảm giá của người bán'],
  refundSubtotalAfterDiscount: ['Refund subtotal after seller discounts', 'Hoàn tiền sau giảm giá'],
  refundSubtotalBeforeDiscount: ['Refund subtotal before seller discounts', 'Hoàn tiền trước giảm giá'],
  refundSellerDiscounts: ['Refund of seller discounts', 'Hoàn phần giảm của người bán'],
  totalFees: ['Total Fees', 'Tổng phí'],
  transactionFee: ['Transaction fee', 'Phí giao dịch'],
  commissionFee: ['TikTok Shop commission fee', 'Phí hoa hồng TikTok Shop'],
  sellerShippingFee: ['Seller shipping fee', 'Phí vận chuyển người bán'],
  actualShippingFee: ['Actual shipping fee', 'Phí vận chuyển thực tế'],
  platformShippingFee: ['Platform shipping fee', 'Phí vận chuyển sàn']
};

const COLUMN_LABELS = {
  orderId: 'Mã giao dịch/Điều chỉnh',
  type: 'Loại giao dịch',
  orderCreatedTime: 'Thời gian tạo đơn',
  orderSettledTime: 'Thời gian tất toán',
  currency: 'Tiền tệ',
  totalSettlementAmount: 'Tổng tiền thanh toán',
  totalRevenue: 'Tổng doanh thu',
  subtotalAfterDiscount: 'Giá trị sau giảm giá',
  subtotalBeforeDiscount: 'Giá trị trước giảm giá',
  sellerDiscounts: 'Giảm giá của người bán',
  refundSubtotalAfterDiscount: 'Hoàn tiền sau giảm giá',
  refundSubtotalBeforeDiscount: 'Hoàn tiền trước giảm giá',
  refundSellerDiscounts: 'Hoàn phần giảm của người bán',
  totalFees: 'Tổng phí',
  transactionFee: 'Phí giao dịch',
  commissionFee: 'Phí hoa hồng TikTok Shop',
  sellerShippingFee: 'Phí vận chuyển người bán',
  actualShippingFee: 'Phí vận chuyển thực tế',
  platformShippingFee: 'Phí vận chuyển sàn'
};

const numericFields = [
  'totalSettlementAmount',
  'totalRevenue',
  'subtotalAfterDiscount',
  'subtotalBeforeDiscount',
  'sellerDiscounts',
  'refundSubtotalAfterDiscount',
  'refundSubtotalBeforeDiscount',
  'refundSellerDiscounts',
  'totalFees',
  'transactionFee',
  'commissionFee',
  'sellerShippingFee',
  'actualShippingFee',
  'platformShippingFee'
];

const parseNumber = (value) => {
  if (value === undefined || value === null || value === '') return 0;
  if (typeof value === 'number') return value;
  const cleaned = String(value).replace(/,/g, '').trim();
  const parsed = parseFloat(cleaned);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const parseExcelDate = (value) => {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value === 'number') {
    // Excel serial number
    const date = new Date(Math.round((value - 25569) * 86400 * 1000));
    return dayjs(date).isValid() ? dayjs(date).toISOString() : null;
  }
  const parsed = dayjs(value);
  return parsed.isValid() ? parsed.toISOString() : null;
};

const calculateNumericSummary = (data = []) => {
  const summary = {};
  numericFields.forEach(field => {
    summary[field] = data.reduce((sum, item) => sum + (parseFloat(item[field]) || 0), 0);
  });
  return summary;
};


const currencyFormatter = new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' });

const renderCurrency = (value, currency = 'VND') => {
  if (currency !== 'VND') {
    return `${currency} ${Number(value || 0).toLocaleString()}`;
  }
  return currencyFormatter.format(value || 0);
};

const normalizeHeader = (header = '') =>
  header
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');

const getColumnValue = (row, field) => {
  if (!row) return undefined;
  if (!row.__normalizedCache) {
    row.__normalizedCache = {};
    Object.entries(row).forEach(([key, value]) => {
      if (!key) return;
      const normalized = normalizeHeader(key);
      if (normalized && row.__normalizedCache[normalized] === undefined) {
        row.__normalizedCache[normalized] = value;
      }
    });
  }

  const headers = COLUMN_HEADERS[field] || [];
  for (const header of headers) {
    const normalized = normalizeHeader(header);
    if (normalized && row.__normalizedCache[normalized] !== undefined) {
      return row.__normalizedCache[normalized];
    }
  }
  const fallback = row[field];
  if (fallback !== undefined) return fallback;
  const normalizedField = normalizeHeader(field);
  return row.__normalizedCache[normalizedField];
};

const FinancialTransactions = () => {
  const { user, isAdmin } = useAuth();
  const hasPermission = isAdmin || (user?.permissions || []).includes('finance.transactions.view');

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Giao Dịch Tài Chính. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  const [loading, setLoading] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [importRange, setImportRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [filterRange, setFilterRange] = useState([dayjs().startOf('month'), dayjs()]);
  const [previewData, setPreviewData] = useState([]);
  const [previewSummary, setPreviewSummary] = useState(null);
  const [saving, setSaving] = useState(false);
  const [tablePagination, setTablePagination] = useState({
    current: 1,
    pageSize: 50
  });

  useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.id = 'financial-transactions-layout-style';
    styleTag.innerHTML = `
      .financial-transactions-layout {
       
        padding: 24px !important;
        background: #f5f7fa !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        min-height: 100vh !important;
        height: 100% !important;
        overflow-x: auto !important;
        width: 89% !important;
        max-width: 89% !important;
        flex: 1 !important;
      }
      .financial-transactions-layout > * {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 auto;
      }
    `;
    document.head.appendChild(styleTag);

    const layoutContent = document.querySelector('.ant-layout-content');
    layoutContent?.classList.add('financial-transactions-layout');

    return () => {
      document.head.removeChild(styleTag);
      layoutContent?.classList.remove('financial-transactions-layout');
    };
  }, []);

  // Load transactions from Firebase
  useEffect(() => {
    loadTransactions();
  }, []);

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

  const processExcelData = (rows = [], range) => {
    return rows
      .filter(row => row && (getColumnValue(row, 'orderId')))
      .map((row, index) => {
        const orderIdValue = getColumnValue(row, 'orderId') || '';
        const record = {
          key: `${orderIdValue || 'row'}_${index}`,
          orderId: orderIdValue,
          type: getColumnValue(row, 'type') || '',
          orderCreatedTime: parseExcelDate(getColumnValue(row, 'orderCreatedTime')) || new Date().toISOString(),
          orderSettledTime: parseExcelDate(getColumnValue(row, 'orderSettledTime')) || new Date().toISOString(),
          currency: getColumnValue(row, 'currency') || 'VND',
          originalRow: row
        };

        numericFields.forEach(field => {
          record[field] = parseNumber(getColumnValue(row, field) || row[field] || 0);
        });

        record.importedRangeStart = range?.[0]?.startOf('day').toISOString() || null;
        record.importedRangeEnd = range?.[1]?.endOf('day').toISOString() || null;
        record.importedAt = new Date().toISOString();
        record.fileName = row.__rowNum__ !== undefined ? `Row ${row.__rowNum__ + 1}` : '';

        return record;
      });
  };

  const handleUpload = (file) => {
    if (!importRange?.[0] || !importRange?.[1]) {
      message.error('Vui lòng chọn khoảng thời gian cho dữ liệu cần nhập!');
      return false;
    }

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

        // Process file and show preview
        const processedTransactions = processExcelData(jsonData, importRange);
        console.log('Processed transactions:', processedTransactions);
        setPreviewData(processedTransactions);
        setPreviewSummary(calculateNumericSummary(processedTransactions));

        message.success(`Đã đọc ${processedTransactions.length} giao dịch từ file.`);
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

  const savePreviewData = async () => {
    if (!previewData.length) {
      message.warning('Không có dữ liệu để lưu.');
      return;
    }
    setSaving(true);
    try {
      const transactionsRef = ref(database, 'financialTransactions');
      for (const transaction of previewData) {
        const newTransactionRef = push(transactionsRef);
        const { originalRow, __normalizedCache, ...rest } = transaction;
        const sanitizedOriginal = originalRow
          ? JSON.stringify(originalRow, (key, value) => (key === '__normalizedCache' ? undefined : value))
          : null;
        await set(newTransactionRef, {
          ...rest,
          originalRow: sanitizedOriginal
        });
      }
      message.success(`Đã lưu ${previewData.length} giao dịch.`);
      setPreviewData([]);
      setPreviewSummary(null);
    } catch (error) {
      console.error(error);
      message.error('Lưu dữ liệu thất bại.');
    } finally {
      setSaving(false);
    }
  };

  const displayedTransactions = useMemo(() => {
    if (!transactions.length) return [];
    if (!filterRange?.[0] || !filterRange?.[1]) return transactions;

    return transactions.filter(tx => {
      const settled = tx.orderSettledTime || tx.createdAt;
      if (!settled) return false;
      const settledDate = dayjs(settled);
      return settledDate.isBetween(
        filterRange[0].startOf('day'),
        filterRange[1].endOf('day'),
        null,
        '[]'
      );
    });
  }, [transactions, filterRange]);

  const savedSummary = useMemo(() => calculateNumericSummary(displayedTransactions), [displayedTransactions]);

  const handleClearAll = async () => {
    if (window.confirm('Bạn có chắc muốn xóa tất cả giao dịch?')) {
      const transactionsRef = ref(database, 'financialTransactions');
      await remove(transactionsRef);
      message.success('Đã xóa tất cả giao dịch');
    }
  };

  const transactionColumns = [
    {
      title: 'Order/Adjustment ID',
      dataIndex: 'orderId',
      key: 'orderId',
      width: 180,
      fixed: 'left'
    },
    {
      title: 'Type',
      dataIndex: 'type',
      key: 'type',
      width: 120,
      render: (type) => <Tag color="blue">{type || 'N/A'}</Tag>
    },
    {
      title: 'Order Created Time',
      dataIndex: 'orderCreatedTime',
      key: 'orderCreatedTime',
      width: 180,
      render: (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : 'N/A')
    },
    {
      title: 'Order Settled Time',
      dataIndex: 'orderSettledTime',
      key: 'orderSettledTime',
      width: 180,
      render: (value) => (value ? dayjs(value).format('DD/MM/YYYY HH:mm') : 'N/A')
    },
    {
      title: 'Currency',
      dataIndex: 'currency',
      key: 'currency',
      width: 100
    },
    ...numericFields.map(field => ({
      title: COLUMN_LABELS[field] || field,
      dataIndex: field,
      key: field,
      width: 180,
      align: 'right',
      render: (value, record) => renderCurrency(value, record.currency)
    }))
  ];

  const handleCancelPreview = () => {
    setPreviewData([]);
    setPreviewSummary(null);
    message.info('Đã hủy dữ liệu tạm trên màn hình.');
  };

  const netSaved = (savedSummary.totalSettlementAmount || 0) - (savedSummary.totalFees || 0);
  const netPreview = previewSummary
    ? (previewSummary.totalSettlementAmount || 0) - (previewSummary.totalFees || 0)
    : 0;

  return (
    <div className="financial-transactions-page" style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
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
     

      <Card style={{ marginBottom: 24 }}>
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={8}>
            <Card>
              <Statistic
                title="Tổng tiền thanh toán"
                value={savedSummary.totalSettlementAmount || 0}
                formatter={(value) => renderCurrency(value)}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Tổng doanh thu"
                value={savedSummary.totalRevenue || 0}
                formatter={(value) => renderCurrency(value)}
              />
            </Card>
          </Col>
          <Col span={8}>
            <Card>
              <Statistic
                title="Hoàn tiền sau giảm giá"
                value={savedSummary.refundSubtotalAfterDiscount || 0}
                formatter={(value) => renderCurrency(value)}
              />
            </Card>
          </Col>
        </Row>

        <Row gutter={[16, 16]} align="bottom">
          <Col xs={24} md={8}>
            <Text strong>1. Khoảng thời gian hiển thị dữ liệu đã lưu</Text>
            <RangePicker
              value={filterRange}
              onChange={setFilterRange}
              format="DD/MM/YYYY"
              style={{ width: '100%', marginTop: 8 }}
            />
          </Col>
          <Col xs={24} md={8}>
            <Text strong>2. Khoảng thời gian cho file tải lên</Text>
            <RangePicker
              value={importRange}
              onChange={setImportRange}
              format="DD/MM/YYYY"
              style={{ width: '100%', marginTop: 8 }}
            />
          </Col>
          <Col xs={24} md={8}>
            <Text strong>3. Chọn file Excel xuất từ TikTok</Text>
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
                style={{ marginTop: 8 }}
              >
                Chọn file Excel
              </Button>
            </Upload>
            <Text type="secondary" style={{ display: 'block', marginTop: 8 }}>
              * File cần có các cột: Order/adjustment ID, Type, Order created time, Order settled time,
              Currency, Total settlement amount, Total Revenue, Subtotal after seller discounts,
              Subtotal before discounts, Seller discounts, Refund subtotal sau & trước giảm giá,
              Refund of seller discounts, Total Fees, Transaction fee, TikTok Shop commission fee,
              Seller shipping fee, Actual shipping fee, Platform shipping fee.
            </Text>
          </Col>
        </Row>
      </Card>

      {previewData.length > 0 && (
        <Card
          title="Xem trước dữ liệu tải lên"
          style={{ marginBottom: 24 }}
          extra={
            <Space>
              <Button onClick={handleCancelPreview} icon={<ClearOutlined />}>
                Hủy
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                loading={saving}
                onClick={savePreviewData}
              >
                Lưu dữ liệu
              </Button>
            </Space>
          }
        >
          <Row gutter={16} style={{ marginBottom: 16 }}>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="Tổng tiền thanh toán"
                  value={previewSummary?.totalSettlementAmount || 0}
                  formatter={(value) => renderCurrency(value)}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="Tổng doanh thu"
                  value={previewSummary?.totalRevenue || 0}
                  formatter={(value) => renderCurrency(value)}
                />
              </Card>
            </Col>
            <Col span={8}>
              <Card size="small">
                <Statistic
                  title="Hoàn tiền sau giảm giá"
                  value={previewSummary?.refundSubtotalAfterDiscount || 0}
                  formatter={(value) => renderCurrency(value)}
                />
              </Card>
            </Col>
          </Row>

          <Table
            columns={transactionColumns}
            dataSource={previewData}
            rowKey="key"
            pagination={{ pageSize: 10 }}
            scroll={{ x: 2200 }}
          />
        </Card>
      )}

      {/* Transactions Table */}
      <Card
        title="Dữ liệu giao dịch đã lưu"
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
          columns={transactionColumns}
          dataSource={displayedTransactions}
          loading={loading}
          pagination={{
            ...tablePagination,
            total: displayedTransactions.length,
            showSizeChanger: true,
            pageSizeOptions: ['10','20', '50', '100', '200'],
            showTotal: (total) => `Tổng ${total} giao dịch`,
            onChange: (page, pageSize) => {
              setTablePagination({ current: page, pageSize });
            },
            onShowSizeChange: (current, size) => {
              setTablePagination({ current: 1, pageSize: size });
            }
          }}
          rowKey="key"
          scroll={{ x: 2200 }}
        />
      </Card>
      </div>
      <Modal
        open={saving}
        footer={null}
        closable={false}
        centered
        maskClosable={false}
      >
        <Space direction="vertical" align="center" style={{ width: '100%' }}>
          <Spin tip="Đang lưu dữ liệu..." />
          <Text type="secondary">Vui lòng chờ trong giây lát</Text>
        </Space>
      </Modal>
    </div>
  );
};

export default FinancialTransactions;
