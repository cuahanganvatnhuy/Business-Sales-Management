import React, { useState, useEffect } from 'react';
import { database } from '../../services/firebase.service';
import { ref, onValue, push, set, update, remove } from 'firebase/database';
import {
  Card,
  DatePicker,
  Button,
  Table,
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
  Dropdown,
  Row,
  Col,
  Statistic,
  Progress
} from 'antd';
import {
  FileTextOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DollarOutlined,
  PrinterOutlined,
  SearchOutlined,
  MoreOutlined,
  EyeOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  WalletOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import 'dayjs/locale/vi';
import { useAuth } from '../../contexts/AuthContext';

const { Title, Text } = Typography;
const { Option } = Select;
const { TextArea } = Input;

dayjs.locale('vi');

const PaymentInvoice = () => {
  const { user, isAdmin } = useAuth();
  const hasPermission = isAdmin || (user?.permissions || []).includes('invoices.payment.view');

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Hóa Đơn Thanh Toán. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  const [loading, setLoading] = useState(false);
  const [payments, setPayments] = useState([]);
  const [filteredPayments, setFilteredPayments] = useState([]);
  const [stores, setStores] = useState([]);
  const [orders, setOrders] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingPayment, setEditingPayment] = useState(null);
  const [searchText, setSearchText] = useState('');
  const [selectedStore, setSelectedStore] = useState(null);
  const [selectedPaymentStatus, setSelectedPaymentStatus] = useState(null);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [viewingPayment, setViewingPayment] = useState(null);
  const [form] = Form.useForm();

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

  // Load orders (for reference)
  useEffect(() => {
    const ordersRef = ref(database, 'salesOrders');
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const ordersArray = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        setOrders(ordersArray);
      }
    });
    return () => unsubscribe();
  }, []);

  // Load payments
  useEffect(() => {
    loadPayments();
  }, []);

  const loadPayments = () => {
    setLoading(true);
    const paymentsRef = ref(database, 'paymentInvoices');
    
    const unsubscribe = onValue(paymentsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const paymentsArray = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .sort((a, b) => {
            const dateA = dayjs(a.createdAt);
            const dateB = dayjs(b.createdAt);
            return dateB.valueOf() - dateA.valueOf();
          });
        
        setPayments(paymentsArray);
        setFilteredPayments(paymentsArray);
      } else {
        setPayments([]);
        setFilteredPayments([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  };

  // Search filter
  useEffect(() => {
    let filtered = payments;

    // Filter by search text
    if (searchText) {
      filtered = filtered.filter(payment =>
        payment.invoiceId?.toLowerCase().includes(searchText.toLowerCase()) ||
        payment.customerName?.toLowerCase().includes(searchText.toLowerCase()) ||
        payment.storeName?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Filter by store
    if (selectedStore) {
      filtered = filtered.filter(payment => payment.storeName === selectedStore);
    }

    // Filter by payment status
    if (selectedPaymentStatus) {
      filtered = filtered.filter(payment => payment.paymentStatus === selectedPaymentStatus);
    }

    setFilteredPayments(filtered);
  }, [searchText, payments, selectedStore, selectedPaymentStatus]);

  // Open modal for edit/create
  const handleOpenModal = (payment = null) => {
    setEditingPayment(payment);
    if (payment) {
      form.setFieldsValue({
        ...payment,
        paymentDate: dayjs(payment.paymentDate)
      });
    } else {
      form.resetFields();
    }
    setModalVisible(true);
  };

  // Open detail modal
  const handleViewDetail = (payment) => {
    try {
      console.log('Opening detail for payment:', payment);
      setViewingPayment(payment);
      setDetailModalVisible(true);
    } catch (error) {
      console.error('Error opening detail modal:', error);
      message.error('Lỗi khi mở chi tiết hóa đơn!');
    }
  };

  // Save payment
  const handleSavePayment = async () => {
    try {
      const values = await form.validateFields();
      setLoading(true);

      if (editingPayment) {
        // Thanh toán thêm cho hóa đơn đã có
        const additionalAmount = values.additionalAmount || 0;
        const newPaidAmount = (editingPayment.paidAmount || 0) + additionalAmount;
        const newRemainingAmount = (editingPayment.totalAmount || 0) - newPaidAmount;
        
        // Tạo record lịch sử thanh toán
        const paymentRecord = {
          amount: additionalAmount,
          date: values.paymentDate.format('DD/MM/YYYY'),
          method: values.paymentMethod,
          notes: values.notes || '',
          timestamp: new Date().toISOString()
        };

        // Cập nhật hóa đơn với thông tin thanh toán mới
        const updatedPayment = {
          ...editingPayment,
          paidAmount: newPaidAmount,
          remainingAmount: newRemainingAmount,
          paymentStatus: newRemainingAmount <= 0 ? 'paid' : 'partial',
          paymentHistory: [...(editingPayment.paymentHistory || []), paymentRecord],
          lastPaymentDate: values.paymentDate.format('YYYY-MM-DD'),
          updatedAt: new Date().toISOString()
        };

        const paymentRef = ref(database, `paymentInvoices/${editingPayment.id}`);
        await update(paymentRef, updatedPayment);
        message.success(`Đã thanh toán thêm ${new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(additionalAmount)}!`);
      } else {
        // Tạo hóa đơn mới
        const paidAmount = values.paidAmount || 0;
        const totalAmount = values.totalAmount || 0;
        const remainingAmount = totalAmount - paidAmount;

        const paymentData = {
          invoiceId: `INV-${Date.now()}`,
          customerName: values.customerName,
          storeName: values.storeName,
          totalAmount: totalAmount,
          paidAmount: paidAmount,
          remainingAmount: remainingAmount,
          paymentStatus: values.paymentStatus,
          paymentMethod: values.paymentMethod,
          paymentDate: values.paymentDate.format('YYYY-MM-DD'),
          notes: values.notes || '',
          paymentHistory: [{
            amount: paidAmount,
            date: values.paymentDate.format('DD/MM/YYYY'),
            method: values.paymentMethod,
            notes: values.notes || '',
            timestamp: new Date().toISOString()
          }],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        const paymentsRef = ref(database, 'paymentInvoices');
        const newPaymentRef = push(paymentsRef);
        await set(newPaymentRef, paymentData);
        message.success('Đã tạo hóa đơn thanh toán mới!');
      }

      setModalVisible(false);
      form.resetFields();
      setEditingPayment(null);
      setLoading(false);
    } catch (error) {
      console.error('Error saving payment:', error);
      message.error('Có lỗi xảy ra!');
      setLoading(false);
    }
  };

  // Delete payment
  const handleDeletePayment = async (id) => {
    try {
      const paymentRef = ref(database, `paymentInvoices/${id}`);
      await remove(paymentRef);
      message.success('Đã xóa hóa đơn thanh toán!');
    } catch (error) {
      console.error('Error deleting payment:', error);
      message.error('Lỗi khi xóa hóa đơn thanh toán!');
    }
  };

  // Delete selected payments
  const handleDeleteSelected = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Vui lòng chọn ít nhất một hóa đơn để xóa!');
      return;
    }

    try {
      const deletePromises = selectedRowKeys.map(id => {
        const paymentRef = ref(database, `paymentInvoices/${id}`);
        return remove(paymentRef);
      });
      
      await Promise.all(deletePromises);
      setSelectedRowKeys([]);
      message.success(`Đã xóa ${selectedRowKeys.length} hóa đơn thanh toán!`);
    } catch (error) {
      console.error('Error deleting selected payments:', error);
      message.error('Lỗi khi xóa hóa đơn thanh toán!');
    }
  };

  // Delete all payments
  const handleDeleteAll = async () => {
    if (filteredPayments.length === 0) {
      message.warning('Không có hóa đơn nào để xóa!');
      return;
    }

    try {
      const deletePromises = filteredPayments.map(payment => {
        const paymentRef = ref(database, `paymentInvoices/${payment.id}`);
        return remove(paymentRef);
      });
      
      await Promise.all(deletePromises);
      setSelectedRowKeys([]);
      message.success(`Đã xóa tất cả ${filteredPayments.length} hóa đơn thanh toán!`);
    } catch (error) {
      console.error('Error deleting all payments:', error);
      message.error('Lỗi khi xóa tất cả hóa đơn thanh toán!');
    }
  };

  // Print payment invoice
  const printPaymentInvoice = (payment) => {
    const formatCurrency = (amount) => {
      return new Intl.NumberFormat('vi-VN', {
        style: 'currency',
        currency: 'VND'
      }).format(amount || 0);
    };

    const getPaymentMethodLabel = (method) => {
      switch(method) {
        case 'cash': return 'Tiền mặt';
        case 'bank': return 'Chuyển khoản';
        case 'card': return 'Thẻ';
        case 'momo': return 'Ví MoMo';
        case 'other': return 'Khác';
        default: return 'Không xác định';
      }
    };

    let invoiceHTML = `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <title>Hóa Đơn Thanh Toán - ${payment.invoiceId}</title>
          <style>
              body {
                  font-family: Arial, sans-serif;
                  margin: 0;
                  padding: 20px;
                  background: white;
              }
              .invoice-container {
                  max-width: 800px;
                  margin: 0 auto;
                  background: white;
                  padding: 40px;
                  border: 2px solid #007A33;
              }
              .header {
                  text-align: center;
                  margin-bottom: 30px;
                  border-bottom: 3px solid #007A33;
                  padding-bottom: 20px;
              }
              .company-name {
                  font-size: 28px;
                  font-weight: bold;
                  color: #007A33;
                  margin-bottom: 10px;
              }
              .invoice-title {
                  font-size: 24px;
                  font-weight: bold;
                  margin: 20px 0;
                  text-align: center;
                  color: #333;
              }
              .invoice-id {
                  text-align: center;
                  font-size: 16px;
                  color: #666;
                  margin-bottom: 30px;
              }
              .info-section {
                  margin-bottom: 30px;
              }
              .info-row {
                  display: flex;
                  margin-bottom: 12px;
              }
              .info-label {
                  font-weight: bold;
                  width: 180px;
                  color: #555;
              }
              .info-value {
                  flex: 1;
                  color: #333;
              }
              .amount-section {
                  background: #f5f5f5;
                  padding: 20px;
                  border-radius: 8px;
                  border: 2px solid #007A33;
                  margin: 30px 0;
              }
              .amount-row {
                  display: flex;
                  justify-content: space-between;
                  margin-bottom: 10px;
                  font-size: 18px;
              }
              .amount-label {
                  font-weight: bold;
              }
              .amount-value {
                  font-weight: bold;
                  color: #007A33;
                  font-size: 24px;
              }
              .notes-section {
                  margin: 30px 0;
                  padding: 15px;
                  background: #fffbe6;
                  border-left: 4px solid #faad14;
              }
              .notes-title {
                  font-weight: bold;
                  margin-bottom: 8px;
                  color: #333;
              }
              .signature-section {
                  display: flex;
                  justify-content: space-between;
                  margin-top: 60px;
              }
              .signature-box {
                  text-align: center;
                  width: 45%;
              }
              .signature-label {
                  font-weight: bold;
                  margin-bottom: 60px;
              }
              .footer {
                  margin-top: 40px;
                  text-align: center;
                  color: #666;
                  font-size: 12px;
                  border-top: 2px solid #eee;
                  padding-top: 20px;
              }
              @media print {
                  body { margin: 0; }
                  .invoice-container { border: none; }
              }
          </style>
      </head>
      <body>
          <div class="invoice-container">
              <div class="header">
                  <div class="company-name">HỆ THỐNG QUẢN LÝ KINH DOANH</div>
                  <div style="color: #666; font-size: 16px;">Phúc Hoàng Technology</div>
              </div>
              
              <div class="invoice-title">HÓA ĐƠN THANH TOÁN</div>
              <div class="invoice-id">Mã hóa đơn: <strong>${payment.invoiceId}</strong></div>
              
              <div class="info-section">
                  <div class="info-row">
                      <span class="info-label">Tên khách hàng:</span>
                      <span class="info-value">${payment.customerName || 'N/A'}</span>
                  </div>
                  <div class="info-row">
                      <span class="info-label">Số điện thoại:</span>
                      <span class="info-value">${payment.customerPhone || 'N/A'}</span>
                  </div>
                  <div class="info-row">
                      <span class="info-label">Cửa hàng:</span>
                      <span class="info-value">${payment.storeName || 'N/A'}</span>
                  </div>
                  <div class="info-row">
                      <span class="info-label">Ngày thanh toán:</span>
                      <span class="info-value">${payment.paymentDate || 'N/A'}</span>
                  </div>
                  <div class="info-row">
                      <span class="info-label">Phương thức:</span>
                      <span class="info-value">${getPaymentMethodLabel(payment.paymentMethod)}</span>
                  </div>
                  ${payment.referenceOrderId ? `
                  <div class="info-row">
                      <span class="info-label">Mã đơn hàng liên quan:</span>
                      <span class="info-value">${payment.referenceOrderId}</span>
                  </div>
                  ` : ''}
              </div>

              <!-- Thống kê theo loại đơn -->
              ${payment.orderStats ? `
              <div style="margin: 20px 0; padding: 15px; background: #f9f9f9; border: 1px solid #ddd; border-radius: 4px;">
                  <div style="display: flex; justify-content: space-around; font-size: 14px; font-weight: bold;">
                      <span>Tổng Đơn TMĐT: ${formatCurrency(payment.orderStats.ecommerce?.importCost || 0)}</span>
                      <span>Tổng Đơn Sỉ: ${formatCurrency(payment.orderStats.wholesale?.importCost || 0)}</span>
                      <span>Tổng Đơn Lẻ: ${formatCurrency(payment.orderStats.retail?.importCost || 0)}</span>
                  </div>
              </div>
              ` : ''}

              <!-- Bảng sản phẩm -->
              ${payment.productList && payment.productList.length > 0 ? `
              <div style="margin: 20px 0; padding: 10px; background: #f0f8ff; border-left: 4px solid #007A33;">
                  <span style="font-size: 16px; font-weight: bold; color: #007A33;">📊 Tổng hợp chung</span>
              </div>
              
              <table style="width: 100%; border-collapse: collapse; margin-bottom: 30px;">
                  <thead>
                      <tr style="background-color: #4a4a4a; color: white;">
                          <th style="padding: 12px; text-align: center; font-weight: bold;">STT</th>
                          <th style="padding: 12px; text-align: left; font-weight: bold;">TÊN SẢN PHẨM</th>
                          <th style="padding: 12px; text-align: center; font-weight: bold;">SỐ LƯỢNG</th>
                          <th style="padding: 12px; text-align: center; font-weight: bold;">ĐƠN GIÁ</th>
                          <th style="padding: 12px; text-align: center; font-weight: bold;">THÀNH TIỀN</th>
                      </tr>
                  </thead>
                  <tbody>
                      ${payment.productList.map((product, index) => {
                        const unitDisplay = product.unit === 'kg' ? 'kg' : 'gói';
                        return `
                        <tr style="border-bottom: 1px solid #ddd;">
                            <td style="padding: 10px; text-align: center;">${index + 1}</td>
                            <td style="padding: 10px;">${product.productName}</td>
                            <td style="padding: 10px; text-align: center;">${product.totalQuantity} ${unitDisplay}</td>
                            <td style="padding: 10px; text-align: right;">${formatCurrency(product.importPrice)}</td>
                            <td style="padding: 10px; text-align: right;">${formatCurrency(product.totalImportCost)}</td>
                        </tr>`;
                      }).join('')}
                  </tbody>
              </table>
              ` : ''}

              <div class="amount-section">
                  <div class="amount-row">
                      <span class="amount-label">TỔNG TIỀN:</span>
                      <span class="amount-value" style="color: #007A33;">${formatCurrency(payment.totalAmount || 0)}</span>
                  </div>
                  <div class="amount-row">
                      <span class="amount-label">ĐÃ THANH TOÁN:</span>
                      <span class="amount-value" style="color: #1890ff;">${formatCurrency(payment.paidAmount || 0)}</span>
                  </div>
                  <div class="amount-row">
                      <span class="amount-label">CÒN LẠI:</span>
                      <span class="amount-value" style="color: ${(payment.remainingAmount || 0) > 0 ? '#ff4d4f' : '#52c41a'};">${formatCurrency(payment.remainingAmount || 0)}</span>
                  </div>
                  <div class="amount-row" style="border-top: 2px solid #007A33; padding-top: 15px; margin-top: 15px;">
                      <span class="amount-label">TRẠNG THÁI:</span>
                      <span class="amount-value" style="color: ${
                        payment.paymentStatus === 'paid' ? '#52c41a' : 
                        payment.paymentStatus === 'partial' ? '#faad14' : '#ff4d4f'
                      }; font-size: 20px;">
                        ${payment.paymentStatus === 'paid' ? 'ĐÃ THANH TOÁN' : 
                          payment.paymentStatus === 'partial' ? 'THANH TOÁN 1 PHẦN' : 'CHƯA THANH TOÁN'}
                      </span>
                  </div>
              </div>

              ${payment.paymentHistory && payment.paymentHistory.length > 0 ? `
              <div style="margin: 30px 0; padding: 20px; background: #f9f9f9; border-radius: 8px;">
                  <div style="font-weight: bold; margin-bottom: 15px; color: #333; font-size: 18px;">📋 LỊCH SỬ THANH TOÁN:</div>
                  ${payment.paymentHistory.map((hist, index) => `
                    <div style="margin-bottom: 12px; padding: 12px; background: white; border-radius: 6px; border-left: 4px solid #1890ff;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <strong>Lần ${index + 1}:</strong> ${formatCurrency(hist.amount)}
                                <span style="margin-left: 20px; color: #666;">📅 ${hist.date}</span>
                                <span style="margin-left: 20px; color: #666;">💳 ${hist.method === 'cash' ? 'Tiền mặt' : hist.method === 'bank_transfer' ? 'Chuyển khoản' : hist.method}</span>
                            </div>
                        </div>
                        ${hist.notes ? `<div style="margin-top: 5px; color: #666; font-size: 14px;">Ghi chú: ${hist.notes}</div>` : ''}
                    </div>
                  `).join('')}
              </div>
              ` : ''}

              ${payment.notes ? `
              <div class="notes-section">
                  <div class="notes-title">📝 Ghi chú:</div>
                  <div>${payment.notes}</div>
              </div>
              ` : ''}

              <div class="signature-section">
                  <div class="signature-box">
                      <div class="signature-label">Người thanh toán</div>
                      <div>___________________</div>
                      <div style="margin-top: 10px; font-size: 14px;">${payment.customerName || ''}</div>
                  </div>
                  <div class="signature-box">
                      <div class="signature-label">Người nhận tiền</div>
                      <div>___________________</div>
                      <div style="margin-top: 10px; font-size: 14px;">Cửa hàng</div>
                  </div>
              </div>
              
              <div class="footer">
                  <strong>Hệ Thống Quản Lý Kinh Doanh</strong><br>
                  Phúc Hoàng Technology<br>
                  Cảm ơn quý khách!<br>
                  Ngày in: ${new Date().toLocaleString('vi-VN')}
              </div>
          </div>
      </body>
      </html>`;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      message.error('Không thể mở cửa sổ in. Vui lòng kiểm tra popup blocker!');
      return;
    }

    printWindow.document.write(invoiceHTML);
    printWindow.document.close();
    printWindow.onload = () => {
      printWindow.print();
    };

    message.success('Đã mở cửa sổ in hóa đơn!');
  };

  // Table columns
  const columns = [
    {
      title: 'Mã HĐ',
      dataIndex: 'invoiceId',
      key: 'invoiceId',
      width: 120,
      fixed: 'left',
    },
    {
      title: 'Ngày tạo',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 100,
      render: (date) => dayjs(date).format('DD/MM/YYYY')
    },
    {
      title: 'Thời gian',
      dataIndex: 'paymentDate',
      key: 'paymentDate',
      width: 100,
      render: (date) => dayjs(date).format('DD/MM/YYYY')
    },
    {
      title: 'Cửa hàng',
      dataIndex: 'storeName',
      key: 'storeName',
      width: 120,
    },
    {
      title: 'Tổng tiền',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 120,
      align: 'right',
      render: (amount) => (
        <Text strong style={{ color: '#007A33' }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0)}
        </Text>
      )
    },
    {
      title: 'Đã thanh toán',
      dataIndex: 'paidAmount',
      key: 'paidAmount',
      width: 120,
      align: 'right',
      render: (amount) => (
        <Text strong style={{ color: '#1890ff' }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0)}
        </Text>
      )
    },
    {
      title: 'Còn lại',
      dataIndex: 'remainingAmount',
      key: 'remainingAmount',
      width: 120,
      align: 'right',
      render: (amount) => (
        <Text strong style={{ color: amount > 0 ? '#ff4d4f' : '#52c41a' }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0)}
        </Text>
      )
    },
    {
      title: 'Trạng thái',
      dataIndex: 'paymentStatus',
      key: 'paymentStatus',
      width: 120,
      render: (status) => {
        const statusMap = {
          paid: { label: 'Đã thanh toán', color: 'success' },
          partial: { label: 'Thanh toán 1 phần', color: 'warning' },
          unpaid: { label: 'Chưa thanh toán', color: 'error' }
        };
        const config = statusMap[status] || { label: 'N/A', color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      }
    },
    {
      title: 'Ghi chú',
      dataIndex: 'notes',
      key: 'notes',
      width: 150,
      ellipsis: true,
    },
    {
      title: 'Phương Thức',
      dataIndex: 'paymentMethod',
      key: 'paymentMethod',
      width: 120,
      render: (method) => {
        const methodMap = {
          cash: { label: 'Tiền mặt', color: 'green' },
          bank_transfer: { label: 'Chuyển khoản', color: 'blue' },
          credit_card: { label: 'Thẻ tín dụng', color: 'purple' },
          other: { label: 'Khác', color: 'default' }
        };
        const config = methodMap[method] || { label: 'N/A', color: 'default' };
        return <Tag color={config.color}>{config.label}</Tag>;
      }
    },
    {
      title: 'Thao Tác',
      key: 'action',
      width: 80,
      fixed: 'right',
      align: 'center',
      render: (_, record) => {
        const menuItems = [
          {
            key: 'view',
            icon: <EyeOutlined />,
            label: 'Xem Chi Tiết'
          },
          {
            key: 'print',
            icon: <PrinterOutlined />,
            label: 'In'
          },
          {
            key: 'edit',
            icon: <EditOutlined />,
            label: 'Sửa'
          },
          {
            type: 'divider'
          },
          {
            key: 'delete',
            icon: <DeleteOutlined />,
            label: (
              <Popconfirm
                title="Bạn có chắc muốn xóa?"
                onConfirm={() => handleDeletePayment(record.id)}
                okText="Có"
                cancelText="Không"
              >
                <span style={{ color: '#ff4d4f' }}>Xóa</span>
              </Popconfirm>
            ),
            danger: true
          }
        ];

        const handleMenuClick = ({ key }) => {
          if (key === 'view') {
            handleViewDetail(record);
          } else if (key === 'print') {
            printPaymentInvoice(record);
          } else if (key === 'edit') {
            handleOpenModal(record);
          }
          // Delete is handled by Popconfirm directly
        };

        return (
          <Dropdown
            menu={{ 
              items: menuItems,
              onClick: handleMenuClick
            }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              type="text"
              icon={<MoreOutlined />}
              style={{ 
                border: 'none',
                boxShadow: 'none',
                transform: 'rotate(90deg)'
              }}
            />
          </Dropdown>
        );
      }
    }
  ];

  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div style={{ padding: { xs: 0, md: '24px' }, background: '#f0f2f5', minHeight: '100vh' }}>
      {!isMobile ? (
        <>
          {/* Desktop Header */}
          <div
            style={{
              background: '#fff',
              padding: { xs: '12px 16px', md: '16px 24px' },
              borderRadius: 12,
              marginBottom: { xs: 12, md: 24 },
              boxShadow: '0 12px 30px rgba(5, 153, 0, 0.08)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: { xs: 12, md: 16 } }}>
              <div
                style={{
                  width: { xs: 40, md: 48 },
                  height: { xs: 40, md: 48 },
                  borderRadius: '50%',
                  background: '#e6f7e6',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <DollarOutlined style={{ fontSize: { xs: 16, md: 20 }, color: '#0f9d58' }} />
              </div>
              <div>
                <Title level={2} style={{ margin: 0, color: 'rgb(8 125 68)', fontWeight: 'bold', fontSize: { xs: 18, md: 23 } }}>
                  Hóa Đơn Thanh Toán
                </Title>
                <Text type="secondary" style={{ fontSize: { xs: 12, md: 14 } }}>Quản lý hóa đơn thanh toán của khách hàng</Text>
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Mobile Header */}
          <div
            style={{
              background: 'linear-gradient(135deg, #007A33 0%, #005A28 100%)',
              padding: '24px 20px',
              borderRadius: 0,
              marginBottom: 0,
              boxShadow: '0 4px 16px rgba(0, 122, 51, 0.2)'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: 'rgba(255, 255, 255, 0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backdropFilter: 'blur(10px)'
                }}
              >
                <DollarOutlined style={{ fontSize: 26, color: 'white' }} />
              </div>
              <div>
                <Title level={3} style={{ margin: 0, color: 'white', fontWeight: 'bold', fontSize: 22 }}>
                  Hóa Đơn
                </Title>
                <Text style={{ color: 'rgba(255, 255, 255, 0.95)', fontSize: 14, fontWeight: 500 }}>
                  {filteredPayments.length} hóa đơn
                </Text>
              </div>
            </div>
          </div>

          {/* Mobile Quick Stats */}
          <div style={{ padding: '16px 16px 0' }}>
            <Row gutter={[12, 12]} style={{ marginBottom: 16 }}>
              <Col span={12}>
                <div
                  style={{
                    background: 'linear-gradient(135deg, #5b8ff9 0%, #4876e8 100%)',
                    padding: 16,
                    borderRadius: 12,
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(91, 143, 249, 0.25)'
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.95, marginBottom: 4 }}>Tổng HĐ</div>
                  <div style={{ fontSize: 18, fontWeight: 'bold', lineHeight: 1.2 }}>
                    {filteredPayments.length}
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div
                  style={{
                    background: 'linear-gradient(135deg, #ff7d45 0%, #e66a2e 100%)',
                    padding: 16,
                    borderRadius: 12,
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(255, 125, 69, 0.25)'
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.95, marginBottom: 4 }}>Tổng Tiền</div>
                  <div style={{ fontSize: 18, fontWeight: 'bold', lineHeight: 1.2 }}>
                    {new Intl.NumberFormat('vi-VN').format(filteredPayments.reduce((sum, p) => sum + (p.totalAmount || 0), 0))}
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div
                  style={{
                    background: 'linear-gradient(135deg, #5ad8a6 0%, #4bc49a 100%)',
                    padding: 16,
                    borderRadius: 12,
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(90, 216, 166, 0.25)'
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.95, marginBottom: 4 }}>Đã Thanh Toán</div>
                  <div style={{ fontSize: 18, fontWeight: 'bold', lineHeight: 1.2 }}>
                    {new Intl.NumberFormat('vi-VN').format(filteredPayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0))}
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div
                  style={{
                    background: 'linear-gradient(135deg, #f6bd16 0%, #e5a810 100%)',
                    padding: 16,
                    borderRadius: 12,
                    color: 'white',
                    boxShadow: '0 4px 12px rgba(246, 189, 22, 0.25)'
                  }}
                >
                  <div style={{ fontSize: 12, opacity: 0.95, marginBottom: 4 }}>Còn Lại</div>
                  <div style={{ fontSize: 18, fontWeight: 'bold', lineHeight: 1.2 }}>
                    {new Intl.NumberFormat('vi-VN').format(filteredPayments.reduce((sum, p) => sum + (p.remainingAmount || 0), 0))}
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        </>
      )}

      {/* Dashboard Statistics - Hidden on mobile */}
      {!isMobile && (
        <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={12} sm={12} md={6}>
          <Card
            style={{
              borderRadius: 12,
              background: '#5b8ff9',
              color: 'white',
              boxShadow: '0 4px 12px rgba(91, 143, 249, 0.2)'
            }}
            bodyStyle={{ padding: { xs: 12, md: 20 } }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: { xs: 12, md: 14 } }}>Tổng HĐ</span>}
              value={filteredPayments.length}
              prefix={<FileTextOutlined style={{ color: 'white', fontSize: { xs: 16, md: 24 } }} />}
              valueStyle={{ color: 'white', fontSize: { xs: 20, md: 28 }, fontWeight: 'bold' }}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card
            style={{
              borderRadius: 12,
              background: '#ff7d45',
              color: 'white',
              boxShadow: '0 4px 12px rgba(255, 125, 69, 0.2)'
            }}
            bodyStyle={{ padding: { xs: 12, md: 20 } }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: { xs: 12, md: 14 } }}>Tổng Tiền</span>}
              value={filteredPayments.reduce((sum, p) => sum + (p.totalAmount || 0), 0)}
              prefix={<DollarOutlined style={{ color: 'white', fontSize: { xs: 16, md: 24 } }} />}
              precision={0}
              valueStyle={{ color: 'white', fontSize: { xs: 20, md: 28 }, fontWeight: 'bold' }}
              formatter={(value) => new Intl.NumberFormat('vi-VN').format(value)}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card
            style={{
              borderRadius: 12,
              background: '#5ad8a6',
              color: 'white',
              boxShadow: '0 4px 12px rgba(90, 216, 166, 0.2)'
            }}
            bodyStyle={{ padding: { xs: 12, md: 20 } }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: { xs: 12, md: 14 } }}>Đã TT</span>}
              value={filteredPayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0)}
              prefix={<CheckCircleOutlined style={{ color: 'white', fontSize: { xs: 16, md: 24 } }} />}
              precision={0}
              valueStyle={{ color: 'white', fontSize: { xs: 20, md: 28 }, fontWeight: 'bold' }}
              formatter={(value) => new Intl.NumberFormat('vi-VN').format(value)}
            />
          </Card>
        </Col>
        <Col xs={12} sm={12} md={6}>
          <Card
            style={{
              borderRadius: 12,
              background: '#f6bd16',
              color: 'white',
              boxShadow: '0 4px 12px rgba(246, 189, 22, 0.2)'
            }}
            bodyStyle={{ padding: { xs: 12, md: 20 } }}
          >
            <Statistic
              title={<span style={{ color: 'rgba(255,255,255,0.9)', fontSize: { xs: 12, md: 14 } }}>Còn Lại</span>}
              value={filteredPayments.reduce((sum, p) => sum + (p.remainingAmount || 0), 0)}
              prefix={<WalletOutlined style={{ color: 'white', fontSize: { xs: 16, md: 24 } }} />}
              precision={0}
              valueStyle={{ color: 'white', fontSize: { xs: 20, md: 28 }, fontWeight: 'bold' }}
              formatter={(value) => new Intl.NumberFormat('vi-VN').format(value)}
            />
          </Card>
        </Col>
      </Row>
      )}

      {/* Status Breakdown */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={8} md={8}>
          <Card
            style={{
              borderRadius: 12,
              background: '#f6ffed',
              border: '2px solid #52c41a',
              boxShadow: '0 4px 12px rgba(82, 196, 26, 0.15)'
            }}
            bodyStyle={{ padding: 16 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: '#52c41a', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                  Đã Thanh Toán
                </div>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#262626' }}>
                  {filteredPayments.filter(p => p.paymentStatus === 'paid').length}
                </div>
              </div>
              <CheckCircleOutlined style={{ fontSize: 32, color: '#52c41a' }} />
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            style={{
              borderRadius: 12,
              background: '#fffbe6',
              border: '2px solid #faad14',
              boxShadow: '0 4px 12px rgba(250, 173, 20, 0.15)'
            }}
            bodyStyle={{ padding: 16 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: '#faad14', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                  Thanh Toán 1 Phần
                </div>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#262626' }}>
                  {filteredPayments.filter(p => p.paymentStatus === 'partial').length}
                </div>
              </div>
              <ClockCircleOutlined style={{ fontSize: 32, color: '#faad14' }} />
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={8}>
          <Card
            style={{
              borderRadius: 12,
              background: '#fff1f0',
              border: '2px solid #ff4d4f',
              boxShadow: '0 4px 12px rgba(255, 77, 79, 0.15)'
            }}
            bodyStyle={{ padding: 16 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <div style={{ color: '#ff4d4f', fontSize: 13, fontWeight: 500, marginBottom: 4 }}>
                  Chưa Thanh Toán
                </div>
                <div style={{ fontSize: 24, fontWeight: 'bold', color: '#262626' }}>
                  {filteredPayments.filter(p => p.paymentStatus === 'unpaid').length}
                </div>
              </div>
              <ExclamationCircleOutlined style={{ fontSize: 32, color: '#ff4d4f' }} />
            </div>
          </Card>
        </Col>
      </Row>

      {/* Payment Status Distribution */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} md={12}>
          <Card
            title={<span style={{ fontSize: 16, fontWeight: 'bold', color: '#262626' }}>📊 Tỷ Trạng Thái Thanh Toán</span>}
            style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
            bodyStyle={{ padding: 20 }}
          >
            <Space direction="vertical" style={{ width: '100%' }} size="large">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: '#52c41a', fontWeight: 500 }}>Đã Thanh Toán</span>
                  <span style={{ fontWeight: 'bold' }}>
                    {filteredPayments.length > 0 
                      ? Math.round((filteredPayments.filter(p => p.paymentStatus === 'paid').length / filteredPayments.length) * 100) 
                      : 0}%
                  </span>
                </div>
                <Progress 
                  percent={filteredPayments.length > 0 
                    ? Math.round((filteredPayments.filter(p => p.paymentStatus === 'paid').length / filteredPayments.length) * 100) 
                    : 0} 
                  strokeColor="#52c41a"
                  showInfo={false}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: '#faad14', fontWeight: 500 }}>Thanh Toán 1 Phần</span>
                  <span style={{ fontWeight: 'bold' }}>
                    {filteredPayments.length > 0 
                      ? Math.round((filteredPayments.filter(p => p.paymentStatus === 'partial').length / filteredPayments.length) * 100) 
                      : 0}%
                  </span>
                </div>
                <Progress 
                  percent={filteredPayments.length > 0 
                    ? Math.round((filteredPayments.filter(p => p.paymentStatus === 'partial').length / filteredPayments.length) * 100) 
                    : 0} 
                  strokeColor="#faad14"
                  showInfo={false}
                />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <span style={{ color: '#ff4d4f', fontWeight: 500 }}>Chưa Thanh Toán</span>
                  <span style={{ fontWeight: 'bold' }}>
                    {filteredPayments.length > 0 
                      ? Math.round((filteredPayments.filter(p => p.paymentStatus === 'unpaid').length / filteredPayments.length) * 100) 
                      : 0}%
                  </span>
                </div>
                <Progress 
                  percent={filteredPayments.length > 0 
                    ? Math.round((filteredPayments.filter(p => p.paymentStatus === 'unpaid').length / filteredPayments.length) * 100) 
                    : 0} 
                  strokeColor="#ff4d4f"
                  showInfo={false}
                />
              </div>
            </Space>
          </Card>
        </Col>
        <Col xs={24} md={12}>
          <Card
            title={<span style={{ fontSize: 16, fontWeight: 'bold', color: '#262626' }}>🏪 Thống Kê Theo Cửa Hàng</span>}
            style={{ borderRadius: 12, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
            bodyStyle={{ padding: 16, maxHeight: 450, overflowY: 'auto' }}
          >
            <Table
              dataSource={stores.map(store => {
                const storePayments = filteredPayments.filter(p => p.storeName === store.name);
                if (storePayments.length === 0) return null;

                const totalInvoices = storePayments.length;
                const totalAmount = storePayments.reduce((sum, p) => sum + (p.totalAmount || 0), 0);
                const paidAmount = storePayments.reduce((sum, p) => sum + (p.paidAmount || 0), 0);
                const remainingAmount = storePayments.reduce((sum, p) => sum + (p.remainingAmount || 0), 0);

                return {
                  key: store.id,
                  store: store.name,
                  invoices: totalInvoices,
                  total: totalAmount,
                  paid: paidAmount,
                  remaining: remainingAmount
                };
              }).filter(item => item !== null)}
              columns={[
                {
                  title: 'Cửa Hàng',
                  dataIndex: 'store',
                  key: 'store',
                  ellipsis: true,
                  render: (text) => <span style={{ fontWeight: 500, color: '#262626' }}>{text}</span>
                },
                {
                  title: 'Số HĐ',
                  dataIndex: 'invoices',
                  key: 'invoices',
                  align: 'center',
                  render: (value) => <Tag color="blue" style={{ fontWeight: 'bold' }}>{value}</Tag>
                },
                {
                  title: 'Tổng Tiền',
                  dataIndex: 'total',
                  key: 'total',
                  align: 'right',
                  render: (value) => <span style={{ fontWeight: 'bold', color: '#52c41a' }}>{new Intl.NumberFormat('vi-VN').format(value)}</span>
                },
                {
                  title: 'Đã TT',
                  dataIndex: 'paid',
                  key: 'paid',
                  align: 'right',
                  render: (value) => <span style={{ fontWeight: 'bold', color: '#1890ff' }}>{new Intl.NumberFormat('vi-VN').format(value)}</span>
                },
                {
                  title: 'Còn Lại',
                  dataIndex: 'remaining',
                  key: 'remaining',
                  align: 'right',
                  render: (value) => <span style={{ fontWeight: 'bold', color: value > 0 ? '#ff4d4f' : '#52c41a' }}>{new Intl.NumberFormat('vi-VN').format(value)}</span>
                }
              ]}
              pagination={false}
              size="small"
              scroll={{ y: 350, x: 800 }}
            />
          </Card>
        </Col>
      </Row>

      <Card
        style={{ 
          borderRadius: { xs: 0, md: 12 }, 
          boxShadow: 'none',
          background: 'transparent'
        }}
        bodyStyle={{ padding: { xs: '16px', md: 24 } }}
      >
        {!isMobile ? (
          <Space direction="vertical" size={24} style={{ width: '100%' }}>
            <Row gutter={[8, 8]} style={{ marginBottom: 0 }}>
              <Col xs={24} sm={24} md={8}>
                <Space wrap size="small">
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => handleOpenModal()}
                    size={{ xs: 'small', sm: 'middle', md: 'large' }}
                  >
                    {window.innerWidth < 576 ? 'Tạo' : 'Tạo Hóa Đơn Mới'}
                  </Button>

                  {selectedRowKeys.length > 0 && (
                    <Popconfirm
                      title={`Bạn có chắc muốn xóa ${selectedRowKeys.length} hóa đơn đã chọn?`}
                      onConfirm={handleDeleteSelected}
                      okText="Có"
                      cancelText="Không"
                    >
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        size={{ xs: 'small', sm: 'middle', md: 'large' }}
                      >
                        {window.innerWidth < 576 ? `Xóa (${selectedRowKeys.length})` : `Xóa Đã Chọn (${selectedRowKeys.length})`}
                      </Button>
                    </Popconfirm>
                  )}

                  {filteredPayments.length > 0 && (
                    <Popconfirm
                      title={`Bạn có chắc muốn xóa tất cả ${filteredPayments.length} hóa đơn?`}
                      onConfirm={handleDeleteAll}
                      okText="Có"
                      cancelText="Không"
                    >
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        size={{ xs: 'small', sm: 'middle', md: 'large' }}
                        type="dashed"
                      >
                        {window.innerWidth < 576 ? 'Xóa Tất Cả' : 'Xóa Tất Cả'}
                      </Button>
                    </Popconfirm>
                  )}
                </Space>
              </Col>
              <Col xs={24} sm={24} md={16}>
                <Space wrap size="small" style={{ width: '100%', justifyContent: 'flex-end' }}>
                  <Select
                    placeholder="Cửa hàng"
                    value={selectedStore}
                    onChange={setSelectedStore}
                    style={{ width: 200 }}
                    allowClear
                  >
                    {stores.map(store => (
                      <Option key={store.id} value={store.name}>{store.name}</Option>
                    ))}
                  </Select>
                  <Select
                    placeholder="Trạng thái"
                    value={selectedPaymentStatus}
                    onChange={setSelectedPaymentStatus}
                    style={{ width: 150 }}
                    allowClear
                  >
                    <Option value="paid">Đã TT</Option>
                    <Option value="partial">1 Phần</Option>
                    <Option value="unpaid">Chưa TT</Option>
                  </Select>
                  <Input
                    placeholder="Tìm kiếm..."
                    prefix={<SearchOutlined />}
                    value={searchText}
                    onChange={(e) => setSearchText(e.target.value)}
                    style={{ width: 200 }}
                    allowClear
                  />
                </Space>
              </Col>
            </Row>

            {/* Table */}
            <Table
              columns={columns}
              dataSource={filteredPayments}
              rowKey="id"
              loading={loading}
              rowSelection={{
                selectedRowKeys,
                onChange: setSelectedRowKeys,
                selections: [
                  Table.SELECTION_ALL,
                  Table.SELECTION_INVERT,
                  Table.SELECTION_NONE,
                ],
              }}
              pagination={{
                defaultPageSize: 10,
                showSizeChanger: true,
                showTotal: (total, range) =>
                  `${range[0]}-${range[1]} của ${total} hóa đơn${selectedRowKeys.length > 0 ? ` (Đã chọn: ${selectedRowKeys.length})` : ''}`,
                pageSizeOptions: ['10', '20', '50', '100'],
                simple: window.innerWidth < 576,
              }}
              scroll={{ x: { xs: 800, md: 1200 } }}
              size={{ xs: 'small', md: 'middle' }}
            />
          </Space>
        ) : (
          <>
            {/* Mobile Filters */}
            <div style={{ padding: '0 16px 16px' }}>
              <Space direction="vertical" size={12} style={{ width: '100%' }}>
                <Input
                  placeholder="Tìm kiếm hóa đơn..."
                  prefix={<SearchOutlined />}
                  value={searchText}
                  onChange={(e) => setSearchText(e.target.value)}
                  allowClear
                  size="large"
                  style={{
                    borderRadius: 12,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.04)'
                  }}
                />
                <Row gutter={[12, 12]}>
                  <Col span={12}>
                    <Select
                      placeholder="Cửa hàng"
                      value={selectedStore}
                      onChange={setSelectedStore}
                      style={{ width: '100%' }}
                      size="large"
                      allowClear
                    >
                      {stores.map(store => (
                        <Option key={store.id} value={store.name}>{store.name}</Option>
                      ))}
                    </Select>
                  </Col>
                  <Col span={12}>
                    <Select
                      placeholder="Trạng thái"
                      value={selectedPaymentStatus}
                      onChange={setSelectedPaymentStatus}
                      style={{ width: '100%' }}
                      size="large"
                      allowClear
                    >
                      <Option value="paid">Đã TT</Option>
                      <Option value="partial">1 Phần</Option>
                      <Option value="unpaid">Chưa TT</Option>
                    </Select>
                  </Col>
                </Row>
              </Space>
            </div>

            {/* Mobile Action Button */}
            <div style={{ padding: '0 16px 16px' }}>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => handleOpenModal()}
                block
                size="large"
                style={{
                  height: 48,
                  borderRadius: 12,
                  fontSize: 16,
                  fontWeight: 600,
                  boxShadow: '0 4px 12px rgba(24, 144, 255, 0.3)'
                }}
              >
                Tạo Hóa Đơn Mới
              </Button>
            </div>

            {/* Mobile Card List */}
            <div style={{ padding: '0 16px 16px' }}>
              <Space direction="vertical" size={10} style={{ width: '100%' }}>
                {filteredPayments.map(payment => (
                  <div
                    key={payment.id}
                    style={{
                      background: 'white',
                      borderRadius: 10,
                      padding: 12,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                      border: '1px solid #f0f0f0'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div
                        style={{
                          width: 44,
                          height: 44,
                          borderRadius: 10,
                          background: payment.paymentStatus === 'paid' ? '#f6ffed' : payment.paymentStatus === 'partial' ? '#fffbe6' : '#fff1f0',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0
                        }}
                      >
                        {payment.paymentStatus === 'paid' ? (
                          <CheckCircleOutlined style={{ fontSize: 22, color: '#52c41a' }} />
                        ) : payment.paymentStatus === 'partial' ? (
                          <ClockCircleOutlined style={{ fontSize: 22, color: '#faad14' }} />
                        ) : (
                          <ExclamationCircleOutlined style={{ fontSize: 22, color: '#ff4d4f' }} />
                        )}
                      </div>
                      <div style={{ flex: 1, minWidth: 0, overflow: 'hidden' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                          <span style={{ fontWeight: 600, fontSize: 14, color: '#262626', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payment.invoiceId}</span>
                          <span style={{ fontWeight: 'bold', fontSize: 15, color: '#52c41a', flexShrink: 0, marginLeft: 8 }}>
                            {new Intl.NumberFormat('vi-VN').format(payment.totalAmount)}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: '#8c8c8c', marginBottom: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payment.customerName}</div>
                        <div style={{ fontSize: 11, color: '#bfbfbf', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{payment.storeName} • {payment.paymentDate ? dayjs(payment.paymentDate).format('DD/MM/YYYY') : 'N/A'}</div>
                      </div>
                      <Dropdown
                        menu={{
                          items: [
                            {
                              key: 'view',
                              icon: <EyeOutlined />,
                              label: 'Xem chi tiết',
                              onClick: () => handleViewDetail(payment)
                            },
                            {
                              key: 'edit',
                              icon: <EditOutlined />,
                              label: 'Chỉnh sửa',
                              onClick: () => handleOpenModal(payment)
                            },
                            {
                              type: 'divider'
                            },
                            {
                              key: 'delete',
                              icon: <DeleteOutlined />,
                              label: (
                                <Popconfirm
                                  title="Xóa hóa đơn này?"
                                  onConfirm={() => handleDeletePayment(payment.id)}
                                  okText="Có"
                                  cancelText="Không"
                                >
                                  <span style={{ color: '#ff4d4f' }}>Xóa</span>
                                </Popconfirm>
                              ),
                              danger: true
                            }
                          ]
                        }}
                        trigger={['click']}
                        placement="bottomRight"
                      >
                        <Button
                          type="text"
                          icon={<MoreOutlined />}
                          size="small"
                          style={{
                            color: '#8c8c8c',
                            padding: '4px'
                          }}
                        />
                      </Dropdown>
                    </div>
                  </div>
                ))}
                {filteredPayments.length === 0 && (
                  <div style={{
                    textAlign: 'center',
                    padding: 48,
                    color: '#bfbfbf',
                    background: 'white',
                    borderRadius: 12,
                    border: '2px dashed #d9d9d9'
                  }}>
                    <FileTextOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                    <div style={{ fontSize: 14 }}>Không có hóa đơn</div>
                  </div>
                )}
              </Space>
            </div>
          </>
        )}
      </Card>

      {/* Modal Form */}
      <Modal
        title={
          <span>
            <FileTextOutlined style={{ marginRight: 8 }} />
            {editingPayment ? 'Chỉnh Sửa Hóa Đơn' : 'Tạo Hóa Đơn Mới'}
          </span>
        }
        open={modalVisible}
        onOk={handleSavePayment}
        onCancel={() => {
          setModalVisible(false);
          form.resetFields();
        }}
        width={{ xs: '100%', sm: 600, md: 700 }}
        style={{ top: 20 }}
        okText={editingPayment ? 'Cập Nhật' : 'Tạo Mới'}
        cancelText="Hủy"
      >
        <Form
          form={form}
          layout="vertical"
          style={{ marginTop: 20 }}
        >
          {editingPayment && (
            <>
              <Form.Item label="Thông Tin Hóa Đơn">
                <div style={{ background: '#f5f5f5', padding: '12px', borderRadius: '6px' }}>
                  <div><strong>Mã HĐ:</strong> {editingPayment.invoiceId}</div>
                  <div><strong>Khách hàng:</strong> {editingPayment.customerName}</div>
                  <div><strong>Cửa hàng:</strong> {editingPayment.storeName}</div>
                  <div><strong>Tổng tiền:</strong> {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(editingPayment.totalAmount || 0)}</div>
                  <div><strong>Đã thanh toán:</strong> {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(editingPayment.paidAmount || 0)}</div>
                  <div><strong>Còn lại:</strong> {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(editingPayment.remainingAmount || 0)}</div>
                </div>
              </Form.Item>
              
              <Divider>Thanh Toán Thêm</Divider>
            </>
          )}

          {!editingPayment && (
            <>
              <Form.Item
                label="Tên Khách Hàng"
                name="customerName"
                rules={[{ required: true, message: 'Vui lòng nhập tên khách hàng!' }]}
              >
                <Input placeholder="Nhập tên khách hàng" />
              </Form.Item>

              <Form.Item
                label="Cửa Hàng"
                name="storeName"
                rules={[{ required: true, message: 'Vui lòng chọn cửa hàng!' }]}
              >
                <Select placeholder="Chọn cửa hàng">
                  {stores.map(store => (
                    <Option key={store.id} value={store.name}>{store.name}</Option>
                  ))}
                </Select>
              </Form.Item>

              <Form.Item
                label="Tổng Tiền"
                name="totalAmount"
                rules={[{ required: true, message: 'Vui lòng nhập tổng tiền!' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                  placeholder="Nhập tổng tiền"
                />
              </Form.Item>
            </>
          )}

          <Form.Item
            label="Ngày Thanh Toán"
            name="paymentDate"
            rules={[{ required: true, message: 'Vui lòng chọn ngày!' }]}
          >
            <DatePicker format="DD/MM/YYYY" style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            label="Phương Thức Thanh Toán"
            name="paymentMethod"
            rules={[{ required: true, message: 'Vui lòng chọn phương thức!' }]}
          >
            <Select placeholder="Chọn phương thức thanh toán">
              <Option value="cash">Tiền mặt</Option>
              <Option value="bank">Chuyển khoản</Option>
              <Option value="card">Thẻ</Option>
              <Option value="momo">Ví MoMo</Option>
              <Option value="other">Khác</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label={editingPayment ? "Số Tiền Thanh Toán Thêm" : "Số Tiền Thanh Toán"}
            name={editingPayment ? "additionalAmount" : "paidAmount"}
            rules={[{ required: true, message: 'Vui lòng nhập số tiền!' }]}
          >
            <InputNumber
              style={{ width: '100%' }}
              placeholder={editingPayment ? "Nhập số tiền thanh toán thêm" : "Nhập số tiền thanh toán"}
              min={0}
              max={editingPayment ? editingPayment.remainingAmount : undefined}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\$\s?|(,*)/g, '')}
            />
          </Form.Item>

          <Form.Item
            label="Trạng Thái"
            name="paymentStatus"
            rules={[{ required: true, message: 'Vui lòng chọn trạng thái!' }]}
          >
            <Select placeholder="Chọn trạng thái thanh toán">
              <Option value="paid">Đã Thanh Toán</Option>
              <Option value="partial">Thanh Toán 1 Phần</Option>
              <Option value="unpaid">Chưa Thanh Toán</Option>
            </Select>
          </Form.Item>

          <Form.Item
            label="Ghi Chú"
            name="notes"
          >
            <TextArea rows={3} placeholder="Nhập ghi chú (tùy chọn)" />
          </Form.Item>

          {editingPayment && editingPayment.paymentHistory && editingPayment.paymentHistory.length > 0 && (
            <Form.Item label="Lịch Sử Thanh Toán">
              <div style={{ background: '#f9f9f9', padding: '12px', borderRadius: '6px', maxHeight: '200px', overflowY: 'auto' }}>
                {editingPayment.paymentHistory.map((payment, index) => (
                  <div key={index} style={{ marginBottom: '8px', padding: '8px', background: 'white', borderRadius: '4px' }}>
                    <div><strong>Lần {index + 1}:</strong> {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(payment.amount)}</div>
                    <div><strong>Ngày:</strong> {payment.date}</div>
                    <div><strong>Phương thức:</strong> {payment.method}</div>
                    {payment.notes && <div><strong>Ghi chú:</strong> {payment.notes}</div>}
                  </div>
                ))}
              </div>
            </Form.Item>
          )}
        </Form>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title="Chi Tiết Hóa Đơn Thanh Toán"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setViewingPayment(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Đóng
          </Button>,
          viewingPayment && (
            <Button
              key="print"
              type="primary"
              icon={<PrinterOutlined />}
              onClick={() => {
                printPaymentInvoice(viewingPayment);
                setDetailModalVisible(false);
              }}
            >
              In Hóa Đơn
            </Button>
          )
        ]}
        width={{ xs: '100%', sm: '80%', md: '70%', lg: '60%' }}
        style={{ top: 20 }}
      >
        {viewingPayment ? (
          <div>
            {/* Thông tin cơ bản */}
            <div style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
              <Row gutter={[16, 8]}>
                <Col span={12}>
                  <div><strong>Mã Hóa Đơn:</strong> {viewingPayment.invoiceId}</div>
                </Col>
                <Col span={12}>
                  <div><strong>Ngày Tạo:</strong> {dayjs(viewingPayment.createdAt).format('DD/MM/YYYY HH:mm')}</div>
                </Col>
                <Col span={12}>
                  <div><strong>Khách Hàng:</strong> {viewingPayment.customerName}</div>
                </Col>
                <Col span={12}>
                  <div><strong>Cửa Hàng:</strong> {viewingPayment.storeName}</div>
                </Col>
              </Row>
            </div>

            {/* Thông tin tài chính */}
            <div style={{ background: '#f0f8ff', padding: '16px', borderRadius: '8px', marginBottom: '20px' }}>
              <Title level={5}>💰 Thông Tin Tài Chính</Title>
              <Row gutter={[16, 8]}>
                <Col span={8}>
                  <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '6px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#007A33' }}>
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(viewingPayment.totalAmount || 0)}
                    </div>
                    <div style={{ color: '#666' }}>Tổng Tiền</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '6px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1890ff' }}>
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(viewingPayment.paidAmount || 0)}
                    </div>
                    <div style={{ color: '#666' }}>Đã Thanh Toán</div>
                  </div>
                </Col>
                <Col span={8}>
                  <div style={{ textAlign: 'center', padding: '12px', background: 'white', borderRadius: '6px' }}>
                    <div style={{ fontSize: '16px', fontWeight: 'bold', color: (viewingPayment.remainingAmount || 0) > 0 ? '#ff4d4f' : '#52c41a' }}>
                      {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(viewingPayment.remainingAmount || 0)}
                    </div>
                    <div style={{ color: '#666' }}>Còn Lại</div>
                  </div>
                </Col>
              </Row>
              <div style={{ textAlign: 'center', marginTop: '12px' }}>
                <Tag color={
                  viewingPayment.paymentStatus === 'paid' ? 'success' : 
                  viewingPayment.paymentStatus === 'partial' ? 'warning' : 'error'
                } style={{ fontSize: '14px', padding: '4px 12px' }}>
                  {viewingPayment.paymentStatus === 'paid' ? 'Đã Thanh Toán' : 
                   viewingPayment.paymentStatus === 'partial' ? 'Thanh Toán 1 Phần' : 'Chưa Thanh Toán'}
                </Tag>
              </div>
            </div>

            {/* Lịch sử thanh toán */}
            {viewingPayment.paymentHistory && viewingPayment.paymentHistory.length > 0 && (
              <div>
                <Title level={5}>📋 Lịch Sử Thanh Toán</Title>
                <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                  {viewingPayment.paymentHistory.map((payment, index) => (
                    <div key={index} style={{ 
                      marginBottom: '12px', 
                      padding: '16px', 
                      background: '#fafafa', 
                      borderRadius: '8px',
                      borderLeft: '4px solid #1890ff'
                    }}>
                      <Row gutter={[16, 4]}>
                        <Col span={6}>
                          <div><strong>Lần {index + 1}</strong></div>
                          <div style={{ color: '#666', fontSize: '12px' }}>{payment.date}</div>
                        </Col>
                        <Col span={6}>
                          <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#1890ff' }}>
                            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(payment.amount)}
                          </div>
                        </Col>
                        <Col span={6}>
                          <Tag color="blue">{payment.method === 'cash' ? 'Tiền mặt' : payment.method === 'bank_transfer' ? 'Chuyển khoản' : payment.method}</Tag>
                        </Col>
                        <Col span={6}>
                          {payment.notes && (
                            <div style={{ fontSize: '12px', color: '#666' }}>
                              <strong>Ghi chú:</strong> {payment.notes}
                            </div>
                          )}
                        </Col>
                      </Row>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Ghi chú */}
            {viewingPayment.notes && (
              <div style={{ marginTop: '20px' }}>
                <Title level={5}>📝 Ghi Chú</Title>
                <div style={{ background: '#f9f9f9', padding: '12px', borderRadius: '6px' }}>
                  {viewingPayment.notes}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div>Không có dữ liệu để hiển thị</div>
        )}
      </Modal>
    </div>
  );
};

export default PaymentInvoice;
