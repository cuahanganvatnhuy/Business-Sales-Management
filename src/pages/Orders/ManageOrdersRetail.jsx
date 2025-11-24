import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../../services/firebase.service';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';
import { ref, onValue, remove } from 'firebase/database';
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
  Dropdown,
  Modal
} from 'antd';
import {
  ShoppingOutlined,
  ShopOutlined,
  TeamOutlined,
  SearchOutlined,
  DownloadOutlined,
  FilterOutlined,
  CloseCircleOutlined,
  CalendarOutlined,
  DeleteOutlined,
  PrinterOutlined,
  EyeOutlined,
  MoreOutlined,
  EllipsisOutlined
} from '@ant-design/icons';
import { formatCurrency } from '../../utils/format';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { RangePicker } = DatePicker;
const { Option } = Select;

const ManageOrdersRetail = () => {
  const navigate = useNavigate();
  const { selectedStore, stores } = useStore();
  const { user, isAdmin } = useAuth();
  const userPermissions = user?.permissions || [];
  const hasPermission = isAdmin || userPermissions.includes('orders.manage.retail.view');
  const canViewDetail = isAdmin || userPermissions.includes('orders.manage.retail.detail');
  const canDeleteSingle = isAdmin || userPermissions.includes('orders.manage.retail.delete.single');
  const canDeleteBulk = isAdmin || userPermissions.includes('orders.manage.retail.delete.bulk');
  const canDeleteAll = isAdmin || userPermissions.includes('orders.manage.retail.delete.all');
  const canExportExcel = isAdmin || userPermissions.includes('orders.manage.retail.export');
  const canPrint = isAdmin || userPermissions.includes('orders.manage.retail.print');

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Quản Lý Đơn Hàng Bán Lẻ. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  // States
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState([null, null]);
  const [storeFilter, setStoreFilter] = useState('current');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);
  const navButtonStyle = {
    fontSize: 12,
    fontWeight: 600,
    height: 32,
    borderRadius: 6,
    padding: '0 15px'
  };

  useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.id = 'manage-orders-retail-layout-style';
    styleTag.innerHTML = `
      .manage-orders-retail-layout {
        margin: 0 !important;
        padding: 15px !important;
        background: #f5f7fa !important;
        border-radius: 0 !important;
        box-shadow: none !important;
        min-height: 100vh !important;
        height: 100% !important;
        overflow-x: auto !important;
        width: 92% !important;
        max-width: none !important;
        flex: 1 !important;
      }
      .manage-orders-retail-layout > * {
        width: 100% !important;
        max-width: 100% !important;
        margin: 0 auto;
      }
      .manage-orders-retail-layout :where(.css-dev-only-do-not-override-11mmrso).ant-btn {
        font-size: 12px !important;
        height: 32px !important;
        padding: 0 15px !important;
        border-radius: 6px !important;
      }
    `;
    document.head.appendChild(styleTag);
    const layoutContent = document.querySelector('.ant-layout-content');
    layoutContent?.classList.add('manage-orders-retail-layout');

    return () => {
      document.head.removeChild(styleTag);
      layoutContent?.classList.remove('manage-orders-retail-layout');
    };
  }, []);

  // Load orders from Firebase
  useEffect(() => {
    setLoading(true);
    const ordersRef = ref(database, 'salesOrders');
    
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Group items by order instead of flattening
        const ordersArray = [];
        
        Object.keys(data).forEach(key => {
          const order = data[key];
          
          // Skip if not retail order
          if (order.orderType !== 'retail') return;
          
          // Group all items into order summary
          if (order.items && Array.isArray(order.items) && order.items.length > 0) {
            // Calculate totals from all items
            const totalQuantity = order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
            const totalSubtotal = order.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
            const totalProfit = order.items.reduce((sum, item) => sum + (item.profit || 0), 0);
            
            // Get product names (comma separated)
            const productNames = order.items.map(item => item.productName).join(', ');
            const skus = order.items.map(item => item.sku).join(', ');
            
            ordersArray.push({
              id: key,
              orderId: order.orderId || key,
              orderDate: order.orderDate,
              customerName: order.customerName,
              customerPhone: order.customerPhone,
              createdAt: order.createdAt,
              updatedAt: order.updatedAt,
              // Aggregated item data
              productName: productNames,
              sku: skus,
              itemCount: order.items.length,
              quantity: totalQuantity,
              unit: order.items[0]?.unit || 'kg', // Use first item's unit
              subtotal: totalSubtotal,
              profit: totalProfit,
              storeName: order.storeName,
              // Store items for detail view
              items: order.items,
              _originalOrderKey: key
            });
          } else {
            // Legacy format: data directly on order object
            ordersArray.push({
              id: key,
              orderId: order.orderId || key,
              ...order,
              itemCount: 1,
              _originalOrderKey: key
            });
          }
        });
        
        // Sort by creation date
        ordersArray.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        
        console.log('📦 Loaded retail orders:', ordersArray.length);
        console.log('📊 Sample order:', ordersArray[0]);
        
        setOrders(ordersArray);
        setFilteredOrders(ordersArray);
      } else {
        setOrders([]);
        setFilteredOrders([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...orders];

    // Store filter
    if (storeFilter === 'current' && selectedStore && selectedStore.id !== 'all') {
      filtered = filtered.filter(order => order.storeName === selectedStore.name);
    } else if (storeFilter !== 'all' && storeFilter !== 'current') {
      // Filter by specific store ID
      const store = stores.find(s => s.id === storeFilter);
      if (store) {
        filtered = filtered.filter(order => order.storeName === store.name);
      }
    }
    // If storeFilter === 'all' OR selectedStore.id === 'all', show all orders (no filter)

    // Search filter
    if (searchText) {
      filtered = filtered.filter(order =>
        order.productName?.toLowerCase().includes(searchText.toLowerCase()) ||
        order.sku?.toLowerCase().includes(searchText.toLowerCase()) ||
        order.orderId?.toLowerCase().includes(searchText.toLowerCase()) ||
        order.customerName?.toLowerCase().includes(searchText.toLowerCase()) ||
        order.customerPhone?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Date range filter
    if (dateRange[0] && dateRange[1]) {
      filtered = filtered.filter(order => {
        const orderDate = dayjs(order.orderDate);
        return orderDate.isAfter(dateRange[0].startOf('day')) && 
               orderDate.isBefore(dateRange[1].endOf('day'));
      });
    }

    setFilteredOrders(filtered);
  }, [searchText, dateRange, storeFilter, orders, selectedStore, stores]);

  // Quick date filters
  const handleQuickFilter = (type) => {
    const today = dayjs();
    switch(type) {
      case 'today':
        setDateRange([today, today]);
        break;
      case 'week':
        setDateRange([today.startOf('week'), today.endOf('week')]);
        break;
      case 'month':
        setDateRange([today.startOf('month'), today.endOf('month')]);
        break;
      default:
        break;
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchText('');
    setDateRange([null, null]);
    setStoreFilter('current'); // Reset to current store (default)
    message.success('Đã xóa tất cả bộ lọc');
  };

  // Delete single order
  const handleDeleteOrder = async (record) => {
    if (!canDeleteSingle) {
      message.error('Bạn không có quyền xóa đơn hàng.');
      return;
    }
    try {
      const orderRef = ref(database, `salesOrders/${record.id}`);
      await remove(orderRef);
      message.success('Đã xóa đơn hàng thành công!');
      setSelectedRowKeys(selectedRowKeys.filter(key => key !== record.id));
      setDeleteConfirmVisible(false);
      setOrderToDelete(null);
    } catch (error) {
      console.error('Error deleting order:', error);
      message.error('Lỗi khi xóa đơn hàng: ' + error.message);
      setDeleteConfirmVisible(false);
      setOrderToDelete(null);
    }
  };

  // Delete selected orders
  const handleDeleteSelected = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Vui lòng chọn ít nhất 1 đơn hàng để xóa!');
      return;
    }

    if (!canDeleteBulk) {
      message.error('Bạn không có quyền xóa nhiều đơn hàng.');
      return;
    }

    try {
      setLoading(true);
      
      const deletePromises = selectedRowKeys.map(orderId => {
        const orderRef = ref(database, `salesOrders/${orderId}`);
        return remove(orderRef);
      });
      
      await Promise.all(deletePromises);
      message.success(`Đã xóa ${selectedRowKeys.length} đơn hàng thành công!`);
      setSelectedRowKeys([]);
    } catch (error) {
      console.error('Error deleting selected orders:', error);
      message.error('Lỗi khi xóa đơn hàng: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete all filtered orders
  const handleDeleteAll = async () => {
    if (filteredOrders.length === 0) {
      message.warning('Không có đơn hàng nào để xóa!');
      return;
    }

    if (!canDeleteAll) {
      message.error('Bạn không có quyền xóa tất cả đơn hàng.');
      return;
    }

    try {
      setLoading(true);
      
      const deletePromises = filteredOrders.map(order => {
        const orderRef = ref(database, `salesOrders/${order.id}`);
        return remove(orderRef);
      });
      
      await Promise.all(deletePromises);
      message.success(`Đã xóa tất cả ${filteredOrders.length} đơn hàng!`);
      setSelectedRowKeys([]);
    } catch (error) {
      console.error('Error deleting all orders:', error);
      message.error('Lỗi khi xóa đơn hàng: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Generate invoice HTML for a single order
  const generateInvoiceHTML = (record) => {
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Hóa Đơn - ${record.orderId}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #007A33;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .header h1 {
            color: #007A33;
            margin: 0;
          }
          .info-section {
            margin-bottom: 20px;
          }
          .info-row {
            display: flex;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
          }
          .info-label {
            font-weight: bold;
            width: 150px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #007A33;
            color: white;
          }
          .total-row {
            font-weight: bold;
            background-color: #f5f5f5;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            color: #666;
          }
          .page-break {
            page-break-after: always;
          }
          @media print {
            .print-button {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>HÓA ĐƠN BÁN LẺ</h1>
          <p>Mã đơn: ${record.orderId}</p>
        </div>
        
        <div class="info-section">
          <div class="info-row">
            <div class="info-label">Khách hàng:</div>
            <div>${record.customerName || 'Khách lẻ'}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Số điện thoại:</div>
            <div>${record.customerPhone || 'N/A'}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Ngày đặt:</div>
            <div>${dayjs(record.orderDate).format('DD/MM/YYYY')}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Cửa hàng:</div>
            <div>${record.storeName || 'N/A'}</div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Sản phẩm</th>
              <th>SKU</th>
              <th>Số lượng</th>
              <th>Đơn vị</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${record.items && record.items.length > 0 ? 
              record.items.map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${item.productName}</td>
                  <td>${item.sku}</td>
                  <td>${item.quantity}</td>
                  <td>${item.unit || 'kg'}</td>
                  <td>${formatCurrency(item.sellingPrice)}</td>
                  <td>${formatCurrency(item.subtotal)}</td>
                </tr>
              `).join('') 
              : `
                <tr>
                  <td>1</td>
                  <td>${record.productName || 'N/A'}</td>
                  <td>${record.sku || 'N/A'}</td>
                  <td>${record.quantity || 0}</td>
                  <td>${record.unit || 'kg'}</td>
                  <td>-</td>
                  <td>${formatCurrency(record.subtotal || 0)}</td>
                </tr>
              `
            }
            <tr class="total-row">
              <td colspan="6" style="text-align: right;">Tổng cộng:</td>
              <td>${formatCurrency(record.subtotal)}</td>
            </tr>
          </tbody>
        </table>
        
        <div class="footer">
          <p>Cảm ơn quý khách đã mua hàng!</p>
          <p>In lúc: ${dayjs().format('DD/MM/YYYY HH:mm')}</p>
        </div>
      </body>
      </html>
    `;
  };

  // View order detail
  const handleViewDetail = (record) => {
    if (!canViewDetail) {
      message.error('Bạn không có quyền xem chi tiết đơn hàng.');
      return;
    }
    setSelectedOrder(record);
    setDetailModalVisible(true);
  };

  // Print Invoice
  const handlePrintInvoice = (record) => {
    if (!canPrint) {
      message.error('Bạn không có quyền in hóa đơn.');
      return;
    }
    // Create print window
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    // Generate invoice HTML
    const invoiceHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Hóa Đơn - ${record.orderId}</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #007A33;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .header h1 {
            color: #007A33;
            margin: 0;
          }
          .info-section {
            margin-bottom: 20px;
          }
          .info-row {
            display: flex;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
          }
          .info-label {
            font-weight: bold;
            width: 150px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #007A33;
            color: white;
          }
          .total-row {
            font-weight: bold;
            background-color: #f5f5f5;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            color: #666;
          }
          .print-button {
            background-color: #007A33;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin: 20px 0;
          }
          @media print {
            .print-button {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>HÓA ĐƠN BÁN LẺ</h1>
          <p>Mã đơn: ${record.orderId}</p>
        </div>
        
        <div class="info-section">
          <div class="info-row">
            <div class="info-label">Khách hàng:</div>
            <div>${record.customerName || 'Khách lẻ'}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Số điện thoại:</div>
            <div>${record.customerPhone || 'N/A'}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Ngày đặt:</div>
            <div>${dayjs(record.orderDate).format('DD/MM/YYYY')}</div>
          </div>
          <div class="info-row">
            <div class="info-label">Cửa hàng:</div>
            <div>${record.storeName || 'N/A'}</div>
          </div>
        </div>
        
        <table>
          <thead>
            <tr>
              <th>STT</th>
              <th>Sản phẩm</th>
              <th>SKU</th>
              <th>Số lượng</th>
              <th>Đơn vị</th>
              <th>Đơn giá</th>
              <th>Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${record.items && record.items.length > 0 ? 
              record.items.map((item, index) => `
                <tr>
                  <td>${index + 1}</td>
                  <td>${item.productName}</td>
                  <td>${item.sku}</td>
                  <td>${item.quantity}</td>
                  <td>${item.unit || 'kg'}</td>
                  <td>${formatCurrency(item.sellingPrice)}</td>
                  <td>${formatCurrency(item.subtotal)}</td>
                </tr>
              `).join('') 
              : `
                <tr>
                  <td>1</td>
                  <td>${record.productName || 'N/A'}</td>
                  <td>${record.sku || 'N/A'}</td>
                  <td>${record.quantity || 0}</td>
                  <td>${record.unit || 'kg'}</td>
                  <td>-</td>
                  <td>${formatCurrency(record.subtotal || 0)}</td>
                </tr>
              `
            }
            <tr class="total-row">
              <td colspan="6" style="text-align: right;">Tổng cộng:</td>
              <td>${formatCurrency(record.subtotal)}</td>
            </tr>
          </tbody>
        </table>
        
        <button class="print-button" onclick="window.print()">In hóa đơn</button>
        
        <div class="footer">
          <p>Cảm ơn quý khách đã mua hàng!</p>
          <p>In lúc: ${dayjs().format('DD/MM/YYYY HH:mm')}</p>
        </div>
      </body>
      </html>
    `;
    
    // Write HTML to print window
    printWindow.document.write(invoiceHTML);
    printWindow.document.close();
    
    // Auto print after load
    printWindow.onload = function() {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
    
    message.success('Đã mở cửa sổ in hóa đơn!');
  };

  // Print selected invoices
  const handlePrintSelected = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Vui lòng chọn ít nhất 1 đơn hàng để in!');
      return;
    }

    if (!canPrint) {
      message.error('Bạn không có quyền in hóa đơn.');
      return;
    }

    const selectedOrders = orders.filter(order => selectedRowKeys.includes(order.id));
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    // Generate combined HTML for all selected orders
    const invoicesHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Hóa Đơn - ${selectedOrders.length} đơn</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #007A33;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .header h1 {
            color: #007A33;
            margin: 0;
          }
          .info-section {
            margin-bottom: 20px;
          }
          .info-row {
            display: flex;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
          }
          .info-label {
            font-weight: bold;
            width: 150px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #007A33;
            color: white;
          }
          .total-row {
            font-weight: bold;
            background-color: #f5f5f5;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            color: #666;
          }
          .page-break {
            page-break-after: always;
          }
          .print-button {
            background-color: #007A33;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin: 20px 0;
          }
          @media print {
            .print-button {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        ${selectedOrders.map((record, index) => `
          <div>
            <div class="header">
              <h1>HÓA ĐƠN BÁN LẺ</h1>
              <p>Mã đơn: ${record.orderId}</p>
            </div>
            
            <div class="info-section">
              <div class="info-row">
                <div class="info-label">Khách hàng:</div>
                <div>${record.customerName || 'Khách lẻ'}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Số điện thoại:</div>
                <div>${record.customerPhone || 'N/A'}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Ngày đặt:</div>
                <div>${dayjs(record.orderDate).format('DD/MM/YYYY')}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Cửa hàng:</div>
                <div>${record.storeName || 'N/A'}</div>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Sản phẩm</th>
                  <th>SKU</th>
                  <th>Số lượng</th>
                  <th>Đơn vị</th>
                  <th>Đơn giá</th>
                  <th>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                ${record.items && record.items.length > 0 ? 
                  record.items.map((item, idx) => `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>${item.productName}</td>
                      <td>${item.sku}</td>
                      <td>${item.quantity}</td>
                      <td>${item.unit || 'kg'}</td>
                      <td>${formatCurrency(item.sellingPrice)}</td>
                      <td>${formatCurrency(item.subtotal)}</td>
                    </tr>
                  `).join('') 
                  : `
                    <tr>
                      <td>1</td>
                      <td>${record.productName || 'N/A'}</td>
                      <td>${record.sku || 'N/A'}</td>
                      <td>${record.quantity || 0}</td>
                      <td>${record.unit || 'kg'}</td>
                      <td>-</td>
                      <td>${formatCurrency(record.subtotal || 0)}</td>
                    </tr>
                  `
                }
                <tr class="total-row">
                  <td colspan="6" style="text-align: right;">Tổng cộng:</td>
                  <td>${formatCurrency(record.subtotal)}</td>
                </tr>
              </tbody>
            </table>
            
            <div class="footer">
              <p>Cảm ơn quý khách đã mua hàng!</p>
              <p>In lúc: ${dayjs().format('DD/MM/YYYY HH:mm')}</p>
            </div>
          </div>
          ${index < selectedOrders.length - 1 ? '<div class="page-break"></div>' : ''}
        `).join('')}
        
        <button class="print-button" onclick="window.print()">In tất cả</button>
      </body>
      </html>
    `;
    
    printWindow.document.write(invoicesHTML);
    printWindow.document.close();
    
    printWindow.onload = function() {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
    
    message.success(`Đã mở cửa sổ in ${selectedOrders.length} hóa đơn!`);
  };

  // Print all filtered invoices
  const handlePrintAll = () => {
    if (filteredOrders.length === 0) {
      message.warning('Không có đơn hàng nào để in!');
      return;
    }

    if (!canPrint) {
      message.error('Bạn không có quyền in hóa đơn.');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    // Generate combined HTML for all filtered orders
    const invoicesHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Hóa Đơn - ${filteredOrders.length} đơn</title>
        <style>
          body {
            font-family: Arial, sans-serif;
            padding: 20px;
            max-width: 800px;
            margin: 0 auto;
          }
          .header {
            text-align: center;
            border-bottom: 2px solid #007A33;
            padding-bottom: 20px;
            margin-bottom: 20px;
          }
          .header h1 {
            color: #007A33;
            margin: 0;
          }
          .info-section {
            margin-bottom: 20px;
          }
          .info-row {
            display: flex;
            padding: 8px 0;
            border-bottom: 1px solid #eee;
          }
          .info-label {
            font-weight: bold;
            width: 150px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
          }
          th {
            background-color: #007A33;
            color: white;
          }
          .total-row {
            font-weight: bold;
            background-color: #f5f5f5;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            color: #666;
          }
          .page-break {
            page-break-after: always;
          }
          .print-button {
            background-color: #007A33;
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            margin: 20px 0;
          }
          @media print {
            .print-button {
              display: none;
            }
          }
        </style>
      </head>
      <body>
        ${filteredOrders.map((record, index) => `
          <div>
            <div class="header">
              <h1>HÓA ĐƠN BÁN LẺ</h1>
              <p>Mã đơn: ${record.orderId}</p>
            </div>
            
            <div class="info-section">
              <div class="info-row">
                <div class="info-label">Khách hàng:</div>
                <div>${record.customerName || 'Khách lẻ'}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Số điện thoại:</div>
                <div>${record.customerPhone || 'N/A'}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Ngày đặt:</div>
                <div>${dayjs(record.orderDate).format('DD/MM/YYYY')}</div>
              </div>
              <div class="info-row">
                <div class="info-label">Cửa hàng:</div>
                <div>${record.storeName || 'N/A'}</div>
              </div>
            </div>
            
            <table>
              <thead>
                <tr>
                  <th>STT</th>
                  <th>Sản phẩm</th>
                  <th>SKU</th>
                  <th>Số lượng</th>
                  <th>Đơn vị</th>
                  <th>Đơn giá</th>
                  <th>Thành tiền</th>
                </tr>
              </thead>
              <tbody>
                ${record.items && record.items.length > 0 ? 
                  record.items.map((item, idx) => `
                    <tr>
                      <td>${idx + 1}</td>
                      <td>${item.productName}</td>
                      <td>${item.sku}</td>
                      <td>${item.quantity}</td>
                      <td>${item.unit || 'kg'}</td>
                      <td>${formatCurrency(item.sellingPrice)}</td>
                      <td>${formatCurrency(item.subtotal)}</td>
                    </tr>
                  `).join('') 
                  : `
                    <tr>
                      <td>1</td>
                      <td>${record.productName || 'N/A'}</td>
                      <td>${record.sku || 'N/A'}</td>
                      <td>${record.quantity || 0}</td>
                      <td>${record.unit || 'kg'}</td>
                      <td>-</td>
                      <td>${formatCurrency(record.subtotal || 0)}</td>
                    </tr>
                  `
                }
                <tr class="total-row">
                  <td colspan="6" style="text-align: right;">Tổng cộng:</td>
                  <td>${formatCurrency(record.subtotal)}</td>
                </tr>
              </tbody>
            </table>
            
            <div class="footer">
              <p>Cảm ơn quý khách đã mua hàng!</p>
              <p>In lúc: ${dayjs().format('DD/MM/YYYY HH:mm')}</p>
            </div>
          </div>
          ${index < filteredOrders.length - 1 ? '<div class="page-break"></div>' : ''}
        `).join('')}
        
        <button class="print-button" onclick="window.print()">In tất cả</button>
      </body>
      </html>
    `;
    
    printWindow.document.write(invoicesHTML);
    printWindow.document.close();
    
    printWindow.onload = function() {
      setTimeout(() => {
        printWindow.print();
      }, 250);
    };
    
    message.success(`Đã mở cửa sổ in ${filteredOrders.length} hóa đơn!`);
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!canExportExcel) {
      message.error('Bạn không có quyền xuất file Excel.');
      return;
    }
    const exportData = filteredOrders.map((order, index) => {
      // Calculate selling price (average if multiple items)
      let sellingPrice = 0;
      if (order.items && order.items.length > 0) {
        if (order.items.length === 1) {
          sellingPrice = order.items[0].sellingPrice || 0;
        } else {
          sellingPrice = Math.round(order.items.reduce((sum, item) => sum + (item.sellingPrice || 0), 0) / order.items.length);
        }
      }
      
      return {
        'STT': index + 1,
        'Mã Đơn': order.orderId,
        'Khách Hàng': order.customerName || 'N/A',
        'SĐT': order.customerPhone || 'N/A',
        'Sản Phẩm': order.productName,
        'SKU': order.sku,
        'Ngày Đặt': order.orderDate,
        'Số Lượng': order.quantity,
        'Đơn Vị': order.unit || 'kg',
        'Giá Bán': sellingPrice,
        'Tổng Tiền': order.subtotal,
        'Cửa Hàng': order.storeName || 'N/A'
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Đơn Hàng Lẻ');
    XLSX.writeFile(wb, `DonHangLe_${dayjs().format('YYYYMMDD')}.xlsx`);
    message.success('Đã xuất file Excel thành công!');
  };

  // Table columns
  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      fixed: 'left',
      render: (_, __, index) => index + 1
    },
    {
      title: 'Mã Đơn',
      dataIndex: 'orderId',
      key: 'orderId',
      width: 180,
      fixed: 'left',
      render: (orderId) => orderId || 'N/A'
    },
    {
      title: 'Khách Hàng',
      dataIndex: 'customerName',
      key: 'customerName',
      width: 150,
      render: (name) => name || 'N/A'
    },
    {
      title: 'SĐT',
      dataIndex: 'customerPhone',
      key: 'customerPhone',
      width: 120,
      render: (phone) => phone || 'N/A'
    },
    {
      title: 'Sản Phẩm',
      dataIndex: 'productName',
      key: 'productName',
      width: 250,
      render: (name, record) => {
        if (record.itemCount > 1) {
          return (
            <div>
              <div style={{ fontWeight: 600 }}>{record.itemCount} sản phẩm</div>
              <div style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {name}
              </div>
            </div>
          );
        }
        return name || 'N/A';
      }
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 150,
      render: (sku, record) => {
        if (record.itemCount > 1) {
          return (
            <div style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {sku || 'N/A'}
            </div>
          );
        }
        return sku || 'N/A';
      }
    },
    {
      title: 'Ngày Đặt',
      dataIndex: 'orderDate',
      key: 'orderDate',
      width: 120,
      render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : 'N/A'
    },
    {
      title: 'Số Lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'center',
      render: (qty) => qty || 0
    },
    {
      title: 'Đơn Vị',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
      align: 'center',
      render: (unit) => unit || 'kg'
    },
    {
      title: 'Giá Bán',
      dataIndex: 'sellingPrice',
      key: 'sellingPrice',
      width: 120,
      align: 'right',
      render: (price, record) => {
        // If has items array, calculate average or show first item price
        if (record.items && record.items.length > 0) {
          if (record.items.length === 1) {
            return formatCurrency(record.items[0].sellingPrice || 0);
          } else {
            // Show average price for multiple items
            const avgPrice = record.items.reduce((sum, item) => sum + (item.sellingPrice || 0), 0) / record.items.length;
            return formatCurrency(Math.round(avgPrice));
          }
        }
        return formatCurrency(price || 0);
      }
    },
    {
      title: 'Tổng Tiền',
      dataIndex: 'subtotal',
      key: 'subtotal',
      width: 130,
      align: 'right',
      render: (amount) => (
        <span style={{ color: '#007A33', fontWeight: 600 }}>
          {formatCurrency(amount || 0)}
        </span>
      )
    },
    {
      title: 'Cửa Hàng',
      dataIndex: 'storeName',
      key: 'storeName',
      width: 130,
      align: 'center',
      render: (storeName) => (
        <span style={{ color: '#666' }}>
          {storeName || 'N/A'}
        </span>
      )
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
            key: 'view',
            icon: <EyeOutlined style={{ color: '#1890ff' }} />,
            label: 'Xem chi tiết',
            onClick: () => handleViewDetail(record)
          },
          {
            key: 'print',
            icon: <PrinterOutlined style={{ color: '#007A33' }} />,
            label: 'In hóa đơn',
            onClick: () => handlePrintInvoice(record)
          },
          {
            type: 'divider'
          },
          {
            key: 'delete',
            icon: <DeleteOutlined style={{ color: '#ff4d4f' }} />,
            label: 'Xóa',
            danger: true,
            onClick: () => {
              setOrderToDelete(record);
              setDeleteConfirmVisible(true);
            }
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
  const totalRevenue = filteredOrders.reduce((sum, order) => sum + (order.subtotal || 0), 0);
  const totalProfit = filteredOrders.reduce((sum, order) => sum + (order.profit || 0), 0);
  const totalOrders = filteredOrders.length;
  const totalQuantity = filteredOrders.reduce((sum, order) => sum + (order.quantity || 0), 0);

  return (
    <div style={{ padding: '5px' }}>
      {/* Header */}
      <Card 
        style={{ 
          marginBottom: 15,
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShopOutlined style={{ fontSize: 32, color: '#007A33' }} />
          <div>
            <h1 className="page-title" style={{ margin: 0, color: '#007A33' }}>Quản Lý Đơn Hàng Bán Lẻ</h1>
            <p style={{ margin: 0, color: '#666' }}>Quản lý các đơn hàng từ TMĐT, Bán Lẻ và Bán Sỉ</p>
          </div>
        </div>
      </Card>

      {/* Order Type Tabs */}
      <div style={{ marginBottom: 12 }}>
        <Space size="middle">
          <Button
            icon={<ShoppingOutlined />}
            size="large"
            onClick={() => navigate('/orders/manage/ecommerce')}
            style={{
              ...navButtonStyle,
              borderColor: '#d9d9d9',
              background: 'white',
              color: '#666'
            }}
          >
            Quản lý đơn hàng TMĐT
          </Button>
          <Button
            icon={<ShopOutlined />}
            size="large"
            type="primary"
            style={{
              ...navButtonStyle,
              background: '#007A33',
              borderColor: '#007A33'
            }}
          >
            Quản lý đơn hàng lẻ
          </Button>
          <Button
            icon={<TeamOutlined />}
            size="large"
            onClick={() => navigate('/orders/manage/wholesale')}
            style={{
              ...navButtonStyle,
              borderColor: '#d9d9d9',
              background: 'white',
              color: '#666'
            }}
          >
            Quản lý đơn hàng sỉ
          </Button>
        </Space>
      </div>

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
            <div style={{ marginBottom: 8, fontWeight: 600 }}>Lọc nhanh:</div>
            <Space>
              <Button
                icon={<CalendarOutlined />}
                onClick={() => handleQuickFilter('today')}
              >
                Hôm Nay
              </Button>
              <Button
                icon={<CalendarOutlined />}
                onClick={() => handleQuickFilter('week')}
              >
                Tuần Này
              </Button>
              <Button
                icon={<CalendarOutlined />}
                onClick={() => handleQuickFilter('month')}
              >
                Tháng Này
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Tổng Đơn Hàng"
              value={totalOrders}
              suffix="đơn"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Tổng Số Lượng"
              value={totalQuantity}
              suffix="sp"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Tổng Doanh Thu"
              value={totalRevenue}
              precision={0}
              valueStyle={{ color: '#007A33' }}
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

      {/* Orders Table */}
      <Card
        title={<><ShopOutlined /> Danh Sách Đơn Hàng Lẻ</>}
        extra={
          <Space>
            <Button
              type="primary"
              icon={<PrinterOutlined /> }
              onClick={handlePrintSelected}
              disabled={selectedRowKeys.length === 0}
              style={{ background: '#127211ff', borderColor: '#007A33' }}
            >
              In Đã Chọn ({selectedRowKeys.length})
            </Button>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={handlePrintAll}
              disabled={filteredOrders.length === 0}
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
            >
              In Tất Cả
            </Button>
            <Popconfirm
              title={`Xóa ${selectedRowKeys.length} đơn hàng đã chọn?`}
              description="Bạn có chắc chắn muốn xóa các đơn hàng đã chọn không?"
              onConfirm={handleDeleteSelected}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              disabled={selectedRowKeys.length === 0}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={selectedRowKeys.length === 0}
              >
                Xóa Đã Chọn ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
            <Popconfirm
              title={`Xóa tất cả ${filteredOrders.length} đơn hàng?`}
              description="CẢNH BÁO: Bạn sẽ xóa TẤT CẢ đơn hàng đang hiển thị. Không thể hoàn tác!"
              onConfirm={handleDeleteAll}
              okText="Xóa Tất Cả"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              disabled={filteredOrders.length === 0}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={filteredOrders.length === 0}
              >
                Xóa Tất Cả
              </Button>
            </Popconfirm>
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
        <Space style={{ marginBottom: 16, width: '100%' }} direction="vertical">
          <Row gutter={[16, 16]}>
            <Col xs={24} md={12}>
              <Input
                placeholder="Nhập mã đơn hàng, SKU, tên sản phẩm, khách hàng, SĐT..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
            </Col>
            <Col xs={24} md={6}>
              <Select
                placeholder="Lọc theo cửa hàng"
                value={storeFilter}
                onChange={setStoreFilter}
                style={{ width: '100%' }}
              >
                <Option value="current">
                  {selectedStore && selectedStore.id !== 'all' ? `📍 ${selectedStore.name}` : '📍 Cửa hàng hiện tại'}
                </Option>
                <Option value="all">🏪 Tất cả cửa hàng</Option>
                {stores.filter(s => s.id !== selectedStore?.id && selectedStore?.id !== 'all').map(store => (
                  <Option key={store.id} value={store.id}>
                    🏪 {store.name}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} md={6}>
              <Button
                icon={<CloseCircleOutlined />}
                onClick={handleClearFilters}
                block
              >
                Xóa Bộ Lọc
              </Button>
            </Col>
          </Row>
        </Space>

        <Table
          columns={columns}
          dataSource={filteredOrders}
          loading={loading}
          rowKey="id"
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            selections: [
              Table.SELECTION_ALL,
              Table.SELECTION_INVERT,
              Table.SELECTION_NONE,
            ],
          }}
          expandable={{
            expandedRowRender: (record) => {
              if (!record.items || record.items.length <= 1) return null;
              
              return (
                <div style={{ padding: '8px 48px', background: '#fafafa' }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: '#007A33' }}>
                    Chi tiết {record.items.length} sản phẩm:
                  </div>
                  {record.items.map((item, index) => (
                    <div key={index} style={{ 
                      padding: '8px 12px', 
                      marginBottom: 4, 
                      background: 'white',
                      borderLeft: '3px solid #007A33',
                      borderRadius: 4
                    }}>
                      <Row gutter={16}>
                        <Col span={8}>
                          <strong>Sản phẩm:</strong> {item.productName}
                        </Col>
                        <Col span={4}>
                          <strong>SKU:</strong> {item.sku}
                        </Col>
                        <Col span={3}>
                          <strong>SL:</strong> {item.quantity} {item.unit}
                        </Col>
                        <Col span={3}>
                          <strong>Giá:</strong> {formatCurrency(item.sellingPrice)}
                        </Col>
                        <Col span={3}>
                          <strong>Tổng:</strong> <span style={{ color: '#007A33' }}>{formatCurrency(item.subtotal)}</span>
                        </Col>
                        <Col span={3}>
                          <strong>LN:</strong> <span style={{ color: item.profit >= 0 ? '#52c41a' : '#ff4d4f' }}>
                            {formatCurrency(item.profit)}
                          </span>
                        </Col>
                      </Row>
                    </div>
                  ))}
                </div>
              );
            },
            rowExpandable: (record) => record.items && record.items.length > 1,
            expandedRowKeys: expandedRowKeys,
            onExpandedRowsChange: setExpandedRowKeys,
            showExpandColumn: false, // Hide expand icon
          }}
          onRow={(record) => ({
            onClick: (e) => {
              // Don't expand if clicking on checkbox, delete button, or action column
              if (e.target.closest('.ant-checkbox-wrapper') || 
                  e.target.closest('.ant-btn') ||
                  e.target.closest('.ant-table-selection-column') ||
                  e.target.closest('.ant-popconfirm')) {
                return;
              }
              
              // Only expand if has multiple items
              if (record.items && record.items.length > 1) {
                setExpandedRowKeys(prevKeys => {
                  const isExpanded = prevKeys.includes(record.id);
                  if (isExpanded) {
                    return prevKeys.filter(key => key !== record.id);
                  } else {
                    return [...prevKeys, record.id];
                  }
                });
              }
            },
            style: {
              cursor: record.items && record.items.length > 1 ? 'pointer' : 'default',
              backgroundColor: expandedRowKeys.includes(record.id) ? '#f0f9ff' : undefined
            },
            onMouseEnter: (e) => {
              if (record.items && record.items.length > 1) {
                e.currentTarget.style.backgroundColor = '#fafafa';
              }
            },
            onMouseLeave: (e) => {
              if (!expandedRowKeys.includes(record.id)) {
                e.currentTarget.style.backgroundColor = '';
              } else {
                e.currentTarget.style.backgroundColor = '#f0f9ff';
              }
            }
          })}
          scroll={{ x: 1600 }}
          pagination={{
            total: filteredOrders.length,
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} đơn hàng`
          }}
        />
      </Card>

      {/* Detail Modal */}
      <Modal
        title={<><EyeOutlined style={{ marginRight: 8 }} />Chi Tiết Đơn Hàng Lẻ</>}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Đóng
          </Button>,
          <Button 
            key="print" 
            type="primary"
            icon={<PrinterOutlined />}
            onClick={() => {
              handlePrintInvoice(selectedOrder);
              setDetailModalVisible(false);
            }}
            style={{ background: '#007A33', borderColor: '#007A33' }}
          >
            In Hóa Đơn
          </Button>
        ]}
        width={900}
      >
        {selectedOrder && (
          <div>
            {/* Order Info */}
            <Card size="small" style={{ marginBottom: 16 }}>
              <Row gutter={16}>
                <Col span={12}>
                  <p><strong>Mã Đơn:</strong> {selectedOrder.orderId}</p>
                  <p><strong>Khách Hàng:</strong> {selectedOrder.customerName || 'N/A'}</p>
                  <p><strong>SĐT:</strong> {selectedOrder.customerPhone || 'N/A'}</p>
                </Col>
                <Col span={12}>
                  <p><strong>Ngày Đặt:</strong> {dayjs(selectedOrder.orderDate).format('DD/MM/YYYY')}</p>
                  <p><strong>Giờ:</strong> {selectedOrder.orderTime || 'N/A'}</p>
                  <p><strong>Cửa Hàng:</strong> {selectedOrder.storeName || 'N/A'}</p>
                  <p><strong>Trạng Thái:</strong> <Tag color="green">Hoàn Thành</Tag></p>
                </Col>
              </Row>
            </Card>

            {/* Products Table */}
            <Table
              size="small"
              dataSource={selectedOrder.items || [{
                productName: selectedOrder.productName,
                sku: selectedOrder.sku,
                quantity: selectedOrder.quantity,
                unit: selectedOrder.unit,
                subtotal: selectedOrder.subtotal
              }]}
              rowKey={(item, index) => index}
              pagination={false}
              columns={[
                {
                  title: 'STT',
                  key: 'stt',
                  width: 50,
                  render: (_, __, index) => index + 1
                },
                {
                  title: 'Sản Phẩm',
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
                  title: 'Số Lượng',
                  dataIndex: 'quantity',
                  key: 'quantity',
                  width: 100,
                  align: 'center',
                  render: (qty, record) => `${qty} ${record.unit || 'kg'}`
                },
                {
                  title: 'Đơn Giá',
                  dataIndex: 'sellingPrice',
                  key: 'sellingPrice',
                  width: 120,
                  align: 'right',
                  render: (price) => formatCurrency(price || 0)
                },
                {
                  title: 'Thành Tiền',
                  dataIndex: 'subtotal',
                  key: 'subtotal',
                  width: 130,
                  align: 'right',
                  render: (amount) => (
                    <span style={{ color: '#007A33', fontWeight: 600 }}>
                      {formatCurrency(amount || 0)}
                    </span>
                  )
                }
              ]}
            />

            {/* Summary */}
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <p style={{ fontSize: 16 }}>
                <strong>Tổng Cộng: </strong>
                <span style={{ color: '#007A33', fontSize: 18, fontWeight: 'bold' }}>
                  {formatCurrency(selectedOrder.subtotal || 0)}
                </span>
              </p>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal confirm for delete single order */}
      {orderToDelete && (
        <Modal
          title="⚠️ Xóa đơn hàng"
          open={deleteConfirmVisible}
          onOk={() => handleDeleteOrder(orderToDelete)}
          onCancel={() => {
            setDeleteConfirmVisible(false);
            setOrderToDelete(null);
          }}
          okText="Xóa"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
          centered
        >
          <p><strong>Xóa đơn hàng {orderToDelete.orderId || 'N/A'}?</strong></p>
          <p>Bạn có chắc chắn muốn xóa đơn hàng này không? Hành động này không thể hoàn tác!</p>
        </Modal>
      )}
    </div>
  );
};

export default ManageOrdersRetail;
