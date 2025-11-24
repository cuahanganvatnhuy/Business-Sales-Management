import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../../services/firebase.service';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';
import { ref, onValue, push, set } from 'firebase/database';
import {
  Card,
  Table,
  Button,
  Input,
  Space,
  Tag,
  Row,
  Col,
  Statistic,
  message,
  Modal,
  Select,
  InputNumber,
  DatePicker,
  Dropdown,
  Form
} from 'antd';
import {
  UserOutlined,
  SearchOutlined,
  DownloadOutlined,
  EyeOutlined,
  DollarOutlined,
  ShoppingOutlined,
  PrinterOutlined,
  MoneyCollectOutlined,
  MoreOutlined,
  HistoryOutlined,
  FileTextOutlined,
  EllipsisOutlined
} from '@ant-design/icons';
import { formatCurrency } from '../../utils/format';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { Option } = Select;

const DebtManagement = () => {
  const navigate = useNavigate();
  const { selectedStore, stores } = useStore();
  const { user, isAdmin } = useAuth();
  const hasPermission = isAdmin || (user?.permissions || []).includes('orders.debt.manage.view');

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Công Nợ Khách Hàng Sỉ. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  // States
  const [customers, setCustomers] = useState([]);
  const [filteredCustomers, setFilteredCustomers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [storeFilter, setStoreFilter] = useState('current');
  const [statusFilter, setStatusFilter] = useState('all');
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);
  const [paymentModalVisible, setPaymentModalVisible] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentDate, setPaymentDate] = useState(dayjs());
  const [paymentNote, setPaymentNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [paymentHistory, setPaymentHistory] = useState([]);
  const [notesModalVisible, setNotesModalVisible] = useState(false);
  const [customerNotes, setCustomerNotes] = useState('');

  // Load orders and calculate debt by customer
  useEffect(() => {
    setLoading(true);
    const ordersRef = ref(database, 'salesOrders');
    
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Group by customer
        const customerMap = {};
        
        Object.keys(data).forEach(key => {
          const order = data[key];
          
          // Only wholesale orders
          if (order.orderType === 'wholesale') {
            const customerId = order.customerId || order.customerName;
            const customerName = order.customerName || 'N/A';
            const customerPhone = order.customerPhone || '';
            
            if (!customerMap[customerId]) {
              customerMap[customerId] = {
                customerId: customerId,
                customerName: customerName,
                customerPhone: customerPhone,
                totalOrders: 0,
                totalAmount: 0,
                totalDeposit: 0,
                totalRemaining: 0,
                orders: []
              };
            }
            
            // Calculate amounts
            const subtotal = order.subtotal || 0;
            const deposit = order.deposit || 0;
            // Fix: remainingAmount can be 0, so we need explicit undefined check
            const remaining = (order.remainingAmount !== undefined) 
              ? order.remainingAmount 
              : (subtotal - deposit);
            
            customerMap[customerId].totalOrders += 1;
            customerMap[customerId].totalAmount += subtotal;
            customerMap[customerId].totalDeposit += deposit;
            customerMap[customerId].totalRemaining += remaining;
            customerMap[customerId].orders.push({
              id: key,
              ...order,
              storeName: order.storeName || 'N/A'
            });
          }
        });
        
        // Convert to array
        const customersArray = Object.values(customerMap)
          .map(customer => ({
            ...customer,
            debtStatus: customer.totalRemaining === 0 ? 'paid' : 
                       customer.totalDeposit > 0 ? 'partial' : 'pending'
          }))
          .sort((a, b) => b.totalRemaining - a.totalRemaining); // Sort by debt desc
        
        setCustomers(customersArray);
        setFilteredCustomers(customersArray);
      } else {
        setCustomers([]);
        setFilteredCustomers([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Search, status, and store filter
  useEffect(() => {
    let filtered = [...customers];

    // Store filter - recalculate totals for each customer based on store
    if (storeFilter === 'current' && selectedStore && selectedStore.id !== 'all') {
      filtered = filtered.map(customer => {
        const storeOrders = customer.orders.filter(order => order.storeName === selectedStore.name);
        if (storeOrders.length === 0) return null; // Remove customer if no orders from this store
        
        const totalOrders = storeOrders.length;
        const totalAmount = storeOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
        const totalDeposit = storeOrders.reduce((sum, o) => sum + (o.deposit || 0), 0);
        const totalRemaining = storeOrders.reduce((sum, o) => {
          const subtotal = o.subtotal || 0;
          const deposit = o.deposit || 0;
          const remaining = (o.remainingAmount !== undefined) ? o.remainingAmount : (subtotal - deposit);
          return sum + remaining;
        }, 0);
        
        return {
          ...customer,
          totalOrders,
          totalAmount,
          totalDeposit,
          totalRemaining,
          debtStatus: totalRemaining === 0 ? 'paid' : totalDeposit > 0 ? 'partial' : 'pending'
        };
      }).filter(c => c !== null);
    } else if (storeFilter !== 'all' && storeFilter !== 'current') {
      // Filter by specific store ID
      const store = stores.find(s => s.id === storeFilter);
      if (store) {
        filtered = filtered.map(customer => {
          const storeOrders = customer.orders.filter(order => order.storeName === store.name);
          if (storeOrders.length === 0) return null;
          
          const totalOrders = storeOrders.length;
          const totalAmount = storeOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);
          const totalDeposit = storeOrders.reduce((sum, o) => sum + (o.deposit || 0), 0);
          const totalRemaining = storeOrders.reduce((sum, o) => {
            const subtotal = o.subtotal || 0;
            const deposit = o.deposit || 0;
            const remaining = (o.remainingAmount !== undefined) ? o.remainingAmount : (subtotal - deposit);
            return sum + remaining;
          }, 0);
          
          return {
            ...customer,
            totalOrders,
            totalAmount,
            totalDeposit,
            totalRemaining,
            debtStatus: totalRemaining === 0 ? 'paid' : totalDeposit > 0 ? 'partial' : 'pending'
          };
        }).filter(c => c !== null);
      }
    }
    // If storeFilter === 'all', use all customers as is

    // Search filter
    if (searchText) {
      filtered = filtered.filter(customer =>
        customer.customerName?.toLowerCase().includes(searchText.toLowerCase()) ||
        customer.customerPhone?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(customer => customer.debtStatus === statusFilter);
    }

    setFilteredCustomers(filtered);
  }, [searchText, statusFilter, storeFilter, customers, selectedStore, stores]);

  // View customer detail
  const handleViewDetail = (record) => {
    setSelectedCustomer(record);
    setCustomerOrders(record.orders || []);
    setDetailModalVisible(true);
  };

  // Open payment modal
  const handleCollectPayment = (record) => {
    setSelectedCustomer(record);
    setPaymentAmount(record.totalRemaining);
    setPaymentDate(dayjs());
    setPaymentNote('');
    setPaymentModalVisible(true);
  };

  // Save payment
  const handleSavePayment = async () => {
    if (!selectedCustomer || paymentAmount <= 0) {
      message.error('Vui lòng nhập số tiền hợp lệ!');
      return;
    }

    try {
      setLoading(true);
      const { ref: dbRef, update } = await import('firebase/database');
      
      // Update orders for this customer
      let remainingPayment = paymentAmount;
      
      for (const order of selectedCustomer.orders) {
        if (remainingPayment <= 0) break;
        if (order.remainingAmount <= 0) continue;
        
        const orderRemaining = order.remainingAmount || 0;
        const paymentForOrder = Math.min(remainingPayment, orderRemaining);
        const newDeposit = (order.deposit || 0) + paymentForOrder;
        const newRemaining = orderRemaining - paymentForOrder;
        
        // Determine new payment status
        let newPaymentStatus = 'pending';
        if (newRemaining === 0) {
          newPaymentStatus = 'paid';
        } else if (newDeposit > 0) {
          newPaymentStatus = 'partial';
        }
        
        // Update order in Firebase
        const orderRef = dbRef(database, `salesOrders/${order.id}`);
        await update(orderRef, {
          deposit: newDeposit,
          remainingAmount: newRemaining,
          paymentStatus: newPaymentStatus,
          updatedAt: new Date().toISOString()
        });
        
        remainingPayment -= paymentForOrder;
      }
      
      // Save payment history
      const paymentHistoryRef = ref(database, 'paymentHistory');
      const paymentRecord = {
        customerId: selectedCustomer.customerId,
        customerName: selectedCustomer.customerName,
        customerPhone: selectedCustomer.customerPhone,
        amount: paymentAmount,
        paymentDate: paymentDate.toISOString(),
        paymentMethod: paymentMethod,
        note: paymentNote,
        createdAt: new Date().toISOString(),
        createdBy: 'Admin' // TODO: Replace with actual user
      };
      await push(paymentHistoryRef, paymentRecord);
      
      message.success(`Đã thu ${formatCurrency(paymentAmount)} từ khách hàng!`);
      
      // Print receipt
      handlePrintReceipt(selectedCustomer, paymentAmount, paymentDate, paymentMethod, paymentNote);
      
      setPaymentModalVisible(false);
      
    } catch (error) {
      console.error('Error saving payment:', error);
      message.error('Lỗi khi lưu thanh toán: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Print debt statement
  const handlePrintDebt = (record) => {
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Phiếu Công Nợ</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { color: #007A33; margin: 0; }
          .info { margin-bottom: 20px; }
          .info p { margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin-top: 20px; }
          th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
          th { background-color: #007A33; color: white; }
          .total { text-align: right; margin-top: 20px; font-size: 18px; font-weight: bold; }
          .debt { color: #ff4d4f; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PHIẾU CÔNG NỢ KHÁCH HÀNG</h1>
          <p>Ngày: ${dayjs().format('DD/MM/YYYY')}</p>
        </div>
        
        <div class="info">
          <p><strong>Khách hàng:</strong> ${record.customerName}</p>
          <p><strong>SĐT:</strong> ${record.customerPhone}</p>
          <p><strong>Tổng đơn:</strong> ${record.totalOrders} đơn</p>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Mã Đơn</th>
              <th>Ngày</th>
              <th>Tổng Tiền</th>
              <th>Đã TT</th>
              <th>Còn Nợ</th>
            </tr>
          </thead>
          <tbody>
            ${record.orders.map((order, index) => `
              <tr>
                <td>${index + 1}</td>
                <td>${order.orderId}</td>
                <td>${dayjs(order.orderDate).format('DD/MM/YYYY')}</td>
                <td>${formatCurrency(order.subtotal || 0)}</td>
                <td>${formatCurrency(order.deposit || 0)}</td>
                <td style="color: ${order.remainingAmount > 0 ? '#ff4d4f' : '#52c41a'}">
                  ${formatCurrency(order.remainingAmount || 0)}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="total">
          <p>Tổng tiền: ${formatCurrency(record.totalAmount)}</p>
          <p style="color: #52c41a;">Đã thanh toán: ${formatCurrency(record.totalDeposit)}</p>
          <p class="debt">Còn nợ: ${formatCurrency(record.totalRemaining)}</p>
        </div>
        
        <p style="text-align: center; margin-top: 40px; color: #666;">
          In lúc: ${dayjs().format('DD/MM/YYYY HH:mm')}
        </p>
      </body>
      </html>
    `;
    
    printWindow.document.write(html);
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
    }, 250);
  };

  // Print receipt
  const handlePrintReceipt = (customer, amount, date, method, note) => {
    const receiptWindow = window.open('', '_blank', 'width=800,height=600');
    
    const methodText = {
      cash: 'Tiền mặt',
      bank: 'Chuyển khoản',
      other: 'Khác'
    };
    
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Phiếu Thu Tiền</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 40px; }
          .header { text-align: center; margin-bottom: 30px; }
          .header h1 { color: #007A33; margin: 0; font-size: 28px; }
          .header p { margin: 5px 0; color: #666; }
          .receipt-no { text-align: right; margin-bottom: 20px; font-weight: bold; }
          .info-box { border: 2px solid #007A33; padding: 20px; margin-bottom: 20px; border-radius: 8px; }
          .info-row { display: flex; justify-content: space-between; margin: 10px 0; }
          .info-label { font-weight: bold; width: 150px; }
          .amount-box { 
            background: #f0f9ff; 
            border: 2px dashed #007A33; 
            padding: 20px; 
            text-align: center; 
            margin: 20px 0;
            border-radius: 8px;
          }
          .amount { font-size: 32px; color: #007A33; font-weight: bold; }
          .amount-text { font-style: italic; color: #666; margin-top: 10px; }
          .signature { display: flex; justify-content: space-between; margin-top: 60px; }
          .sig-box { text-align: center; width: 45%; }
          .sig-line { margin-top: 80px; border-top: 1px solid #000; padding-top: 10px; }
          .footer { text-align: center; margin-top: 40px; color: #666; font-size: 12px; }
          @media print {
            body { padding: 20px; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>PHIẾU THU TIỀN</h1>
          <p>Ngày: ${date.format('DD/MM/YYYY')}</p>
        </div>
        
        <div class="receipt-no">
          Số phiếu: PT${Date.now()}
        </div>
        
        <div class="info-box">
          <div class="info-row">
            <span class="info-label">Họ tên người nộp:</span>
            <span>${customer.customerName}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Số điện thoại:</span>
            <span>${customer.customerPhone}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Phương thức:</span>
            <span>${methodText[method] || 'Tiền mặt'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Lý do thu:</span>
            <span>Thanh toán công nợ</span>
          </div>
          ${note ? `
          <div class="info-row">
            <span class="info-label">Ghi chú:</span>
            <span>${note}</span>
          </div>
          ` : ''}
        </div>
        
        <div class="amount-box">
          <div class="amount">${formatCurrency(amount)}</div>
          <div class="amount-text">(${numberToVietnameseWords(amount)} đồng)</div>
        </div>
        
        <div class="signature">
          <div class="sig-box">
            <p><strong>Người nộp tiền</strong></p>
            <p style="font-size: 12px; color: #666;">(Ký, ghi rõ họ tên)</p>
            <div class="sig-line">${customer.customerName}</div>
          </div>
          <div class="sig-box">
            <p><strong>Người thu tiền</strong></p>
            <p style="font-size: 12px; color: #666;">(Ký, ghi rõ họ tên)</p>
            <div class="sig-line">Admin</div>
          </div>
        </div>
        
        <div class="footer">
          <p>Cảm ơn quý khách!</p>
          <p>In lúc: ${dayjs().format('DD/MM/YYYY HH:mm')}</p>
        </div>
      </body>
      </html>
    `;
    
    receiptWindow.document.write(html);
    receiptWindow.document.close();
    setTimeout(() => {
      receiptWindow.print();
    }, 250);
  };

  // Convert number to Vietnamese words (simplified)
  const numberToVietnameseWords = (num) => {
    // Simple implementation - can be enhanced
    const units = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];
    // This is a simplified version - full implementation would be complex
    return `${Math.floor(num / 1000000)} triệu ${Math.floor((num % 1000000) / 1000)} nghìn`;
  };

  // View payment history
  const handleViewPaymentHistory = async (customer) => {
    try {
      setLoading(true);
      const historyRef = ref(database, 'paymentHistory');
      
      onValue(historyRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const history = Object.keys(data)
            .map(key => ({ id: key, ...data[key] }))
            .filter(h => h.customerId === customer.customerId)
            .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          
          setPaymentHistory(history);
        } else {
          setPaymentHistory([]);
        }
        setSelectedCustomer(customer);
        setHistoryModalVisible(true);
        setLoading(false);
      }, { onlyOnce: true });
      
    } catch (error) {
      console.error('Error loading payment history:', error);
      message.error('Lỗi khi tải lịch sử thanh toán');
      setLoading(false);
    }
  };

  // View/Edit customer notes
  const handleViewNotes = async (customer) => {
    try {
      setLoading(true);
      const notesRef = ref(database, `customerNotes/${customer.customerId}`);
      
      onValue(notesRef, (snapshot) => {
        const notes = snapshot.val();
        setCustomerNotes(notes?.notes || '');
        setSelectedCustomer(customer);
        setNotesModalVisible(true);
        setLoading(false);
      }, { onlyOnce: true });
      
    } catch (error) {
      console.error('Error loading notes:', error);
      message.error('Lỗi khi tải ghi chú');
      setLoading(false);
    }
  };

  // Save customer notes
  const handleSaveNotes = async () => {
    if (!selectedCustomer) return;
    
    try {
      setLoading(true);
      const notesRef = ref(database, `customerNotes/${selectedCustomer.customerId}`);
      await set(notesRef, {
        notes: customerNotes,
        updatedAt: new Date().toISOString(),
        updatedBy: 'Admin'
      });
      
      message.success('Đã lưu ghi chú!');
      setNotesModalVisible(false);
    } catch (error) {
      console.error('Error saving notes:', error);
      message.error('Lỗi khi lưu ghi chú');
    } finally {
      setLoading(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = filteredCustomers.map((customer, index) => ({
      'STT': index + 1,
      'Khách Hàng': customer.customerName,
      'SĐT': customer.customerPhone,
      'Số Đơn': customer.totalOrders,
      'Tổng Tiền': customer.totalAmount,
      'Đã Thanh Toán': customer.totalDeposit,
      'Còn Nợ': customer.totalRemaining,
      'Trạng Thái': customer.debtStatus === 'paid' ? 'Đã thanh toán' : 
                   customer.debtStatus === 'partial' ? 'Nợ 1 phần' : 'Chưa thanh toán'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Công Nợ Khách Hàng');
    XLSX.writeFile(wb, `CongNoKhachHang_${dayjs().format('YYYYMMDD')}.xlsx`);
    message.success('Đã xuất file Excel thành công!');
  };

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
      title: 'Khách Hàng',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 200,
      render: (name, record) => (
        <div>
          <div style={{ fontWeight: 600, color: '#007A33' }}>{name}</div>
          <div style={{ fontSize: 12, color: '#666' }}>{record.customerPhone}</div>
        </div>
      )
    },
    {
      title: 'Số Đơn',
      dataIndex: 'totalOrders',
      key: 'totalOrders',
      width: 100,
      align: 'center',
      render: (count) => (
        <Tag color="blue" style={{ fontSize: 14, fontWeight: 600 }}>
          {count} đơn
        </Tag>
      )
    },
    {
      title: 'Tổng Tiền',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 150,
      align: 'right',
      render: (amount) => (
        <span style={{ fontWeight: 600 }}>
          {formatCurrency(amount)}
        </span>
      )
    },
    {
      title: 'Đã Thanh Toán',
      dataIndex: 'totalDeposit',
      key: 'totalDeposit',
      width: 150,
      align: 'right',
      render: (amount) => (
        <span style={{ color: '#52c41a', fontWeight: 600 }}>
          {formatCurrency(amount)}
        </span>
      )
    },
    {
      title: 'Còn Nợ',
      dataIndex: 'totalRemaining',
      key: 'totalRemaining',
      width: 150,
      align: 'right',
      render: (amount) => (
        <span style={{ color: amount > 0 ? '#ff4d4f' : '#52c41a', fontWeight: 600, fontSize: 16 }}>
          {formatCurrency(amount)}
        </span>
      )
    },
    {
      title: 'Trạng Thái',
      dataIndex: 'debtStatus',
      key: 'debtStatus',
      width: 140,
      align: 'center',
      render: (status) => {
        const config = {
          paid: { text: 'Đã thanh toán', color: 'green' },
          partial: { text: 'Nợ 1 phần', color: 'orange' },
          pending: { text: 'Chưa thanh toán', color: 'red' }
        };
        const statusConfig = config[status] || config.pending;
        return <Tag color={statusConfig.color}>{statusConfig.text}</Tag>;
      }
    },
    {
      title: 'Thao Tác',
      key: 'action',
      width: 80,
      align: 'center',
      fixed: 'right',
      render: (_, record) => {
        const menuItems = [
          {
            key: 'collect',
            icon: <MoneyCollectOutlined style={{ color: '#52c41a' }} />,
            label: 'Thu tiền',
            onClick: () => handleCollectPayment(record),
            disabled: record.totalRemaining === 0
          },
          {
            key: 'history',
            icon: <HistoryOutlined style={{ color: '#722ed1' }} />,
            label: 'Lịch sử thanh toán',
            onClick: () => handleViewPaymentHistory(record)
          },
          {
            key: 'notes',
            icon: <FileTextOutlined style={{ color: '#faad14' }} />,
            label: 'Ghi chú',
            onClick: () => handleViewNotes(record)
          },
          {
            type: 'divider'
          },
          {
            key: 'view',
            icon: <EyeOutlined style={{ color: '#1890ff' }} />,
            label: 'Xem chi tiết',
            onClick: () => handleViewDetail(record)
          },
          {
            key: 'print',
            icon: <PrinterOutlined style={{ color: '#007A33' }} />,
            label: 'In phiếu nợ',
            onClick: () => handlePrintDebt(record)
          }
        ];

        return (
          <Dropdown
            menu={{ items: menuItems }}
            trigger={['click']}
            placement="bottomRight"
          >
            <Button
              icon={<EllipsisOutlined style={{ fontSize: 20, fontWeight: 'bold' }} />}
              size="small"
            />
          </Dropdown>
        );
      }
    }
  ];

  // Calculate statistics
  const totalCustomers = filteredCustomers.length;
  const totalDebt = filteredCustomers.reduce((sum, c) => sum + c.totalRemaining, 0);
  const totalPaid = filteredCustomers.reduce((sum, c) => sum + c.totalDeposit, 0);
  const customersWithDebt = filteredCustomers.filter(c => c.totalRemaining > 0).length;

  return (
    <div style={{ padding: '5px' }}>
      {/* Header */}
      <Card 
        style={{ 
          marginBottom: 24,
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DollarOutlined style={{ fontSize: 32, color: '#007A33' }} />
          <div>
            <h1 className="page-title" style={{ margin: 0, color: '#007A33' }}>Công Nợ Khách Hàng Sỉ</h1>
            <p style={{ margin: 0, color: '#666' }}>Quản lý công nợ theo từng khách hàng</p>
          </div>
        </div>
      </Card>

      {/* Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Tổng Khách Hàng"
              value={totalCustomers}
              prefix={<UserOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Khách Đang Nợ"
              value={customersWithDebt}
              prefix={<ShoppingOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Tổng Công Nợ"
              value={formatCurrency(totalDebt)}
              valueStyle={{ color: '#ff4d4f', fontSize: 20 }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card>
            <Statistic
              title="Đã Thu"
              value={formatCurrency(totalPaid)}
              valueStyle={{ color: '#52c41a', fontSize: 20 }}
            />
          </Card>
        </Col>
      </Row>

      {/* Table */}
      <Card
        title="Danh Sách Công Nợ"
        extra={
          <Space>
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
        <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
          <Col xs={24} md={12}>
            <Input
              placeholder="Tìm theo tên khách hàng hoặc SĐT..."
              prefix={<SearchOutlined />}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              allowClear
            />
          </Col>
          <Col xs={24} md={6}>
            <Select
              placeholder="Cửa hàng"
              value={storeFilter}
              onChange={setStoreFilter}
              style={{ width: '100%' }}
            >
              <Option value="current">
                {selectedStore && selectedStore.id !== 'all' ? `📍 ${selectedStore.name}` : '📍 Hiện tại'}
              </Option>
              <Option value="all">🏪 Tất cả</Option>
              {stores.filter(s => s.id !== selectedStore?.id && selectedStore?.id !== 'all').map(store => (
                <Option key={store.id} value={store.id}>
                  🏪 {store.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col xs={24} md={6}>
            <Select
              placeholder="Trạng thái"
              value={statusFilter}
              onChange={setStatusFilter}
              style={{ width: '100%' }}
            >
              <Option value="all">Tất cả TT</Option>
              <Option value="pending">Chưa TT</Option>
              <Option value="partial">Nợ 1 phần</Option>
              <Option value="paid">Đã TT</Option>
            </Select>
          </Col>
        </Row>

        <Table
          loading={loading}
          columns={columns}
          dataSource={filteredCustomers}
          rowKey="customerId"
          scroll={{ x: 1200 }}
          pagination={{
            total: filteredCustomers.length,
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} khách hàng`
          }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title={<><EyeOutlined style={{ marginRight: 8 }} />Chi Tiết Công Nợ</>}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Đóng
          </Button>
        ]}
        width={1000}
      >
        {selectedCustomer && (
          <div>
            {/* Customer Info */}
            <Card size="small" style={{ marginBottom: 16, background: '#f0f9ff' }}>
              <Row gutter={16}>
                <Col span={12}>
                  <p style={{ margin: '4px 0' }}><strong>Khách Hàng:</strong> {selectedCustomer.customerName}</p>
                  <p style={{ margin: '4px 0' }}><strong>SĐT:</strong> {selectedCustomer.customerPhone}</p>
                </Col>
                <Col span={12}>
                  <p style={{ margin: '4px 0' }}><strong>Tổng Đơn:</strong> {selectedCustomer.totalOrders} đơn</p>
                  <p style={{ margin: '4px 0' }}><strong>Tổng Tiền:</strong> <span style={{ color: '#007A33', fontWeight: 600 }}>{formatCurrency(selectedCustomer.totalAmount)}</span></p>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #d9d9d9' }}>
                <Col span={12}>
                  <p style={{ margin: '4px 0' }}><strong>Đã Thanh Toán:</strong> <span style={{ color: '#52c41a', fontWeight: 600 }}>{formatCurrency(selectedCustomer.totalDeposit)}</span></p>
                </Col>
                <Col span={12}>
                  <p style={{ margin: '4px 0' }}><strong>Còn Nợ:</strong> <span style={{ color: '#ff4d4f', fontWeight: 600, fontSize: 16 }}>{formatCurrency(selectedCustomer.totalRemaining)}</span></p>
                </Col>
              </Row>
            </Card>

            {/* Orders Table */}
            <Table
              size="small"
              dataSource={customerOrders}
              rowKey="id"
              pagination={false}
              expandable={{
                expandedRowRender: (record) => (
                  <div style={{ padding: '12px', background: '#fafafa' }}>
                    <strong style={{ marginBottom: 8, display: 'block' }}>📦 Sản phẩm trong đơn:</strong>
                    {record.items && record.items.length > 0 ? (
                      <Table
                        size="small"
                        dataSource={record.items}
                        rowKey={(item, index) => index}
                        pagination={false}
                        columns={[
                          {
                            title: 'Tên sản phẩm',
                            dataIndex: 'productName',
                            key: 'productName'
                          },
                          {
                            title: 'SKU',
                            dataIndex: 'sku',
                            key: 'sku',
                            width: 120
                          },
                          {
                            title: 'Số lượng',
                            dataIndex: 'quantity',
                            key: 'quantity',
                            width: 100,
                            align: 'center',
                            render: (qty, item) => `${qty} ${item.unit || 'kg'}`
                          },
                          {
                            title: 'Đơn giá',
                            dataIndex: 'sellingPrice',
                            key: 'sellingPrice',
                            width: 120,
                            align: 'right',
                            render: (price) => formatCurrency(price || 0)
                          },
                          {
                            title: 'Thành tiền',
                            dataIndex: 'subtotal',
                            key: 'subtotal',
                            width: 120,
                            align: 'right',
                            render: (amount) => (
                              <span style={{ color: '#007A33', fontWeight: 600 }}>
                                {formatCurrency(amount || 0)}
                              </span>
                            )
                          }
                        ]}
                      />
                    ) : (
                      <p style={{ margin: 0, color: '#666' }}>Không có thông tin sản phẩm</p>
                    )}
                  </div>
                ),
                expandIcon: ({ expanded, onExpand, record }) =>
                  expanded ? (
                    <Button size="small" icon={<span>▼</span>} onClick={e => onExpand(record, e)} />
                  ) : (
                    <Button size="small" icon={<span>▶</span>} onClick={e => onExpand(record, e)} />
                  )
              }}
              columns={[
                {
                  title: 'STT',
                  key: 'stt',
                  width: 50,
                  render: (_, __, index) => index + 1
                },
                {
                  title: 'Mã Đơn',
                  dataIndex: 'orderId',
                  key: 'orderId',
                  width: 180
                },
                {
                  title: 'Ngày',
                  dataIndex: 'orderDate',
                  key: 'orderDate',
                  width: 100,
                  render: (date) => dayjs(date).format('DD/MM/YYYY')
                },
                {
                  title: 'Tổng Tiền',
                  dataIndex: 'subtotal',
                  key: 'subtotal',
                  width: 120,
                  align: 'right',
                  render: (amount) => formatCurrency(amount || 0)
                },
                {
                  title: 'Đặt Cọc',
                  dataIndex: 'deposit',
                  key: 'deposit',
                  width: 120,
                  align: 'right',
                  render: (amount) => (
                    <span style={{ color: '#52c41a' }}>
                      {formatCurrency(amount || 0)}
                    </span>
                  )
                },
                {
                  title: 'Còn Lại',
                  dataIndex: 'remainingAmount',
                  key: 'remainingAmount',
                  width: 120,
                  align: 'right',
                  render: (amount) => (
                    <span style={{ color: amount > 0 ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>
                      {formatCurrency(amount || 0)}
                    </span>
                  )
                },
                {
                  title: 'TT Thanh Toán',
                  dataIndex: 'paymentStatus',
                  key: 'paymentStatus',
                  width: 130,
                  align: 'center',
                  render: (status) => {
                    const config = {
                      paid: { text: 'Đã thanh toán', color: 'green' },
                      partial: { text: 'TT 1 phần', color: 'orange' },
                      pending: { text: 'Chưa TT', color: 'red' }
                    };
                    const statusConfig = config[status] || config.pending;
                    return <Tag color={statusConfig.color}>{statusConfig.text}</Tag>;
                  }
                }
              ]}
            />
          </div>
        )}
      </Modal>

      {/* Payment Collection Modal */}
      <Modal
        title={<><MoneyCollectOutlined style={{ marginRight: 8, color: '#52c41a' }} />Thu Tiền Công Nợ</>}
        open={paymentModalVisible}
        onCancel={() => setPaymentModalVisible(false)}
        onOk={handleSavePayment}
        okText="Xác Nhận Thu"
        cancelText="Hủy"
        okButtonProps={{ 
          style: { background: '#52c41a', borderColor: '#52c41a' },
          loading: loading
        }}
        width={600}
      >
        {selectedCustomer && (
          <div>
            <Card size="small" style={{ marginBottom: 16, background: '#f0f9ff' }}>
              <p style={{ margin: '4px 0' }}><strong>Khách Hàng:</strong> {selectedCustomer.customerName}</p>
              <p style={{ margin: '4px 0' }}><strong>SĐT:</strong> {selectedCustomer.customerPhone}</p>
              <p style={{ margin: '4px 0' }}>
                <strong>Tổng Công Nợ:</strong>{' '}
                <span style={{ color: '#ff4d4f', fontWeight: 600, fontSize: 16 }}>
                  {formatCurrency(selectedCustomer.totalRemaining)}
                </span>
              </p>
            </Card>

            <Form layout="vertical">
              <Form.Item label="Số Tiền Thu" required>
                <InputNumber
                  value={paymentAmount}
                  onChange={setPaymentAmount}
                  min={0}
                  max={selectedCustomer.totalRemaining}
                  style={{ width: '100%' }}
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/\$\s?|(,*)/g, '')}
                  addonAfter="VNĐ"
                  size="large"
                />
                <div style={{ marginTop: 8, fontSize: 12, color: '#666' }}>
                  Tối đa: {formatCurrency(selectedCustomer.totalRemaining)}
                </div>
              </Form.Item>

              <Form.Item label="Ngày Thu">
                <DatePicker
                  value={paymentDate}
                  onChange={setPaymentDate}
                  style={{ width: '100%' }}
                  format="DD/MM/YYYY"
                  placeholder="Chọn ngày thu tiền"
                />
              </Form.Item>

              <Form.Item label="Phương Thức Thanh Toán">
                <Select
                  value={paymentMethod}
                  onChange={setPaymentMethod}
                  style={{ width: '100%' }}
                >
                  <Option value="cash">💵 Tiền mặt</Option>
                  <Option value="bank">🏦 Chuyển khoản</Option>
                  <Option value="other">📝 Khác</Option>
                </Select>
              </Form.Item>

              <Form.Item label="Ghi Chú">
                <Input.TextArea
                  value={paymentNote}
                  onChange={(e) => setPaymentNote(e.target.value)}
                  rows={3}
                  placeholder="Ghi chú về lần thanh toán này..."
                />
              </Form.Item>

              <div style={{ 
                padding: '12px', 
                background: '#f6ffed', 
                borderRadius: 8,
                border: '1px solid #b7eb8f'
              }}>
                <p style={{ margin: 0, color: '#52c41a', fontWeight: 600 }}>
                  💡 Sau khi thu: Còn nợ {formatCurrency(Math.max(0, selectedCustomer.totalRemaining - paymentAmount))}
                </p>
              </div>
            </Form>
          </div>
        )}
      </Modal>

      {/* Payment History Modal */}
      <Modal
        title={<><HistoryOutlined style={{ marginRight: 8, color: '#722ed1' }} />Lịch Sử Thanh Toán</>}
        open={historyModalVisible}
        onCancel={() => setHistoryModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setHistoryModalVisible(false)}>
            Đóng
          </Button>
        ]}
        width={900}
      >
        {selectedCustomer && (
          <div>
            <Card size="small" style={{ marginBottom: 16, background: '#f0f9ff' }}>
              <p style={{ margin: '4px 0' }}><strong>Khách Hàng:</strong> {selectedCustomer.customerName}</p>
              <p style={{ margin: '4px 0' }}><strong>SĐT:</strong> {selectedCustomer.customerPhone}</p>
            </Card>

            {paymentHistory.length > 0 ? (
              <Table
                size="small"
                dataSource={paymentHistory}
                rowKey="id"
                pagination={false}
                columns={[
                  {
                    title: 'STT',
                    key: 'stt',
                    width: 50,
                    render: (_, __, index) => index + 1
                  },
                  {
                    title: 'Ngày Thu',
                    dataIndex: 'paymentDate',
                    key: 'paymentDate',
                    width: 120,
                    render: (date) => dayjs(date).format('DD/MM/YYYY')
                  },
                  {
                    title: 'Số Tiền',
                    dataIndex: 'amount',
                    key: 'amount',
                    width: 130,
                    align: 'right',
                    render: (amount) => (
                      <span style={{ color: '#52c41a', fontWeight: 600 }}>
                        {formatCurrency(amount || 0)}
                      </span>
                    )
                  },
                  {
                    title: 'Phương Thức',
                    dataIndex: 'paymentMethod',
                    key: 'paymentMethod',
                    width: 130,
                    render: (method) => {
                      const methodConfig = {
                        cash: { text: 'Tiền mặt', icon: '💵' },
                        bank: { text: 'Chuyển khoản', icon: '🏦' },
                        other: { text: 'Khác', icon: '📝' }
                      };
                      const config = methodConfig[method] || methodConfig.cash;
                      return `${config.icon} ${config.text}`;
                    }
                  },
                  {
                    title: 'Ghi Chú',
                    dataIndex: 'note',
                    key: 'note',
                    render: (note) => note || '-'
                  },
                  {
                    title: 'Người Thu',
                    dataIndex: 'createdBy',
                    key: 'createdBy',
                    width: 100
                  }
                ]}
              />
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                <HistoryOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <p>Chưa có lịch sử thanh toán</p>
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Customer Notes Modal */}
      <Modal
        title={<><FileTextOutlined style={{ marginRight: 8, color: '#faad14' }} />Ghi Chú Khách Hàng</>}
        open={notesModalVisible}
        onCancel={() => setNotesModalVisible(false)}
        onOk={handleSaveNotes}
        okText="Lưu Ghi Chú"
        cancelText="Hủy"
        okButtonProps={{ style: { background: '#faad14', borderColor: '#faad14' } }}
        width={600}
      >
        {selectedCustomer && (
          <div>
            <Card size="small" style={{ marginBottom: 16, background: '#fff7e6' }}>
              <p style={{ margin: '4px 0' }}><strong>Khách Hàng:</strong> {selectedCustomer.customerName}</p>
              <p style={{ margin: '4px 0' }}><strong>SĐT:</strong> {selectedCustomer.customerPhone}</p>
              <p style={{ margin: '4px 0' }}><strong>Công Nợ:</strong> <span style={{ color: '#ff4d4f', fontWeight: 600 }}>{formatCurrency(selectedCustomer.totalRemaining)}</span></p>
            </Card>

            <Form.Item label="Ghi Chú" style={{ marginBottom: 0 }}>
              <Input.TextArea
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                rows={8}
                placeholder="Nhập ghi chú về khách hàng...
• Thói quen thanh toán
• Uy tín
• Lịch sử liên hệ
• Các lưu ý khác..."
              />
            </Form.Item>

            <div style={{ marginTop: 16, padding: '12px', background: '#f0f9ff', borderRadius: 8 }}>
              <p style={{ margin: 0, fontSize: 12, color: '#666' }}>
                💡 <strong>Gợi ý:</strong> Ghi chú giúp bạn nhớ thông tin quan trọng về khách hàng để phục vụ tốt hơn
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DebtManagement;
