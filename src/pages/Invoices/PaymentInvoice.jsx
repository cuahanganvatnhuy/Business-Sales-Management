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
  Col
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
  EyeOutlined
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
            const dateA = dayjs(a.paymentDate, 'DD/MM/YYYY');
            const dateB = dayjs(b.paymentDate, 'DD/MM/YYYY');
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
    if (searchText) {
      const filtered = payments.filter(payment =>
        payment.invoiceId?.toLowerCase().includes(searchText.toLowerCase()) ||
        payment.customerName?.toLowerCase().includes(searchText.toLowerCase()) ||
        payment.storeName?.toLowerCase().includes(searchText.toLowerCase())
      );
      setFilteredPayments(filtered);
    } else {
      setFilteredPayments(payments);
    }
  }, [searchText, payments]);

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
              Hóa Đơn Thanh Toán
            </Title>
            <Text type="secondary">Quản lý hóa đơn thanh toán của khách hàng</Text>
          </div>
        </div>
      </div>

      <Card
        style={{ borderRadius: 12, boxShadow: '0 10px 30px rgba(15, 157, 88, 0.08)' }}
        bodyStyle={{ padding: 24 }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 16 }}>
            <Space>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => handleOpenModal()}
                size="large"
              >
                Tạo Hóa Đơn Mới
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
                    size="large"
                  >
                    Xóa Đã Chọn ({selectedRowKeys.length})
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
                    size="large"
                    type="dashed"
                  >
                    Xóa Tất Cả
                  </Button>
                </Popconfirm>
              )}
            </Space>
            <Input
              placeholder="Tìm kiếm theo mã hóa đơn, tên khách hàng, cửa hàng..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              style={{ minWidth: 280, maxWidth: 400 }}
              allowClear
            />
          </div>

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
            }}
            scroll={{ x: 1400 }}
          />
        </Space>
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
        width={700}
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
        width="70%"
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
