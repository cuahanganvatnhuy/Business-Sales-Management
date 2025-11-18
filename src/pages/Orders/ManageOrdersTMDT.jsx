import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../../services/firebase.service';
import { useStore } from '../../contexts/StoreContext';
import { ref, onValue, remove, update } from 'firebase/database';
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
  EllipsisOutlined,
  SyncOutlined
} from '@ant-design/icons';
import { formatCurrency } from '../../utils/format';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { RangePicker } = DatePicker;
const { Option } = Select;

const ManageOrdersTMDT = () => {
  const navigate = useNavigate();
  const { selectedStore, stores } = useStore();
  
  // States
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [storeFilter, setStoreFilter] = useState('current'); // 'current', 'all', or storeId
  const [dateRange, setDateRange] = useState([null, null]);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);

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
          
          // Skip if not ecommerce order
          if (order.orderType !== 'ecommerce') return;
          
          // Group all items into order summary
          if (order.items && Array.isArray(order.items) && order.items.length > 0) {
            // Calculate totals for multi-item orders
            const totalQuantity = order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
            const totalSubtotal = order.totalAmount || order.items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
            const totalProfit = order.totalProfit || order.items.reduce((sum, item) => sum + (Number(item.profit) || 0), 0);
            // Use first item's selling price for single-item orders, or calculate average
            const sellingPrice = order.items.length === 1 
              ? order.items[0].sellingPrice 
              : order.items.reduce((sum, item) => sum + (Number(item.sellingPrice) || 0), 0) / order.items.length;
            
            // Get product names (comma separated)
            const productNames = order.items.map(item => item.productName).join(', ');
            const skus = order.items.map(item => item.sku).join(', ');
            
            ordersArray.push({
              id: key,
              orderId: order.orderId || key,
              orderDate: order.orderDate,
              platform: order.platform,
              otherPlatform: order.otherPlatform,
              storeName: order.storeName || 'N/A',
              storeId: order.storeId || null,
              createdAt: order.createdAt,
              updatedAt: order.updatedAt,
              // Aggregated item data
              productName: productNames,
              sku: skus,
              itemCount: order.items.length,
              quantity: totalQuantity,
              unit: order.items[0]?.unit || 'kg', // Use first item's unit
              sellingPrice: sellingPrice, // Add sellingPrice here
              subtotal: totalSubtotal,
              profit: totalProfit,
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
        
        console.log('📦 Loaded orders:', ordersArray.length);
        console.log('📊 Sample order:', {
          orderId: ordersArray[0]?.orderId,
          sellingPrice: ordersArray[0]?.sellingPrice,
          firstItemSellingPrice: ordersArray[0]?.items?.[0]?.sellingPrice,
          subtotal: ordersArray[0]?.subtotal
        });
        
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
        order.orderId?.toLowerCase().includes(searchText.toLowerCase())
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

    // Platform filter
    if (platformFilter !== 'all') {
      filtered = filtered.filter(order => order.platform === platformFilter);
    }

    setFilteredOrders(filtered);
  }, [searchText, dateRange, platformFilter, storeFilter, orders, selectedStore, stores]);

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
    setPlatformFilter('all');
    setStoreFilter('current'); // Reset to current store (default)
    message.success('Đã xóa tất cả bộ lọc');
  };

  // Delete single order
  const handleDeleteOrder = async (record) => {
    try {
      const orderRef = ref(database, `salesOrders/${record.id}`);
      await remove(orderRef);
      message.success('Đã xóa đơn hàng thành công!');
      setSelectedRowKeys(selectedRowKeys.filter(key => key !== record.id));
    } catch (error) {
      console.error('Error deleting order:', error);
      message.error('Lỗi khi xóa đơn hàng: ' + error.message);
    }
  };

  // Delete selected orders
  const handleDeleteSelected = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Vui lòng chọn ít nhất 1 đơn hàng để xóa!');
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

  // Sync selling prices from current product data
  const handleSyncSellingPrices = async () => {
    if (filteredOrders.length === 0) {
      message.warning('Không có đơn hàng nào để đồng bộ giá!');
      return;
    }

    try {
      setLoading(true);
      
      // Load current selling products
      const sellingProductsRef = ref(database, 'sellingProducts');
      const sellingProductsSnapshot = await new Promise((resolve) => {
        onValue(sellingProductsRef, resolve, { onlyOnce: true });
      });
      
      const sellingProductsData = sellingProductsSnapshot.val();
      if (!sellingProductsData) {
        message.error('Không tìm thấy dữ liệu sản phẩm bán!');
        return;
      }

      const sellingProductsMap = {};
      Object.entries(sellingProductsData).forEach(([id, product]) => {
        sellingProductsMap[product.sku] = product.sellingPrice || 0;
      });

      let updatedCount = 0;
      const updatePromises = [];

      for (const order of filteredOrders) {
        if (order.items && Array.isArray(order.items)) {
          // Multi-item order
          let hasUpdates = false;
          const updatedItems = order.items.map(item => {
            const currentSellingPrice = sellingProductsMap[item.sku];
            if (currentSellingPrice && currentSellingPrice !== item.sellingPrice) {
              hasUpdates = true;
              const newSubtotal = currentSellingPrice * item.quantity;
              const newProfit = (currentSellingPrice - item.importPrice) * item.quantity;
              return {
                ...item,
                sellingPrice: currentSellingPrice,
                subtotal: newSubtotal,
                profit: newProfit
              };
            }
            return item;
          });

          if (hasUpdates) {
            const totalSubtotal = updatedItems.reduce((sum, item) => sum + (item.subtotal || 0), 0);
            const totalProfit = updatedItems.reduce((sum, item) => sum + (item.profit || 0), 0);
            
            const orderRef = ref(database, `salesOrders/${order.id}`);
            updatePromises.push(
              update(orderRef, {
                items: updatedItems,
                totalAmount: totalSubtotal,
                totalProfit: totalProfit,
                updatedAt: new Date().toISOString()
              })
            );
            updatedCount++;
          }
        } else {
          // Single-item order (legacy format)
          const currentSellingPrice = sellingProductsMap[order.sku];
          if (currentSellingPrice && currentSellingPrice !== order.sellingPrice) {
            const newSubtotal = currentSellingPrice * order.quantity;
            const newProfit = (currentSellingPrice - order.importPrice) * order.quantity;
            
            const orderRef = ref(database, `salesOrders/${order.id}`);
            updatePromises.push(
              update(orderRef, {
                sellingPrice: currentSellingPrice,
                subtotal: newSubtotal,
                profit: newProfit,
                updatedAt: new Date().toISOString()
              })
            );
            updatedCount++;
          }
        }
      }

      if (updatePromises.length > 0) {
        await Promise.all(updatePromises);
        message.success(`Đã đồng bộ giá bán cho ${updatedCount} đơn hàng!`);
      } else {
        message.info('Tất cả đơn hàng đã có giá bán mới nhất!');
      }
    } catch (error) {
      console.error('Error syncing selling prices:', error);
      message.error('Lỗi khi đồng bộ giá bán: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // View order detail
  const handleViewDetail = (record) => {
    setSelectedOrder(record);
    setDetailModalVisible(true);
  };

  // Print Invoice
  const handlePrintInvoice = (record) => {
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
          <h1>HÓA ĐƠN TMĐT</h1>
          <p>Mã đơn: ${record.orderId}</p>
        </div>
        
        <div class="info-section">
          <div class="info-row">
            <div class="info-label">Sàn TMĐT:</div>
            <div>${getPlatformName(record.platform)}</div>
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

    const selectedOrders = orders.filter(order => selectedRowKeys.includes(order.id));
    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    const invoicesHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Hóa Đơn - ${selectedOrders.length} đơn</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #007A33; padding-bottom: 20px; margin-bottom: 20px; }
          .header h1 { color: #007A33; margin: 0; }
          .info-section { margin-bottom: 20px; }
          .info-row { display: flex; padding: 8px 0; border-bottom: 1px solid #eee; }
          .info-label { font-weight: bold; width: 150px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #007A33; color: white; }
          .total-row { font-weight: bold; background-color: #f5f5f5; }
          .footer { margin-top: 40px; text-align: center; color: #666; }
          .page-break { page-break-after: always; }
          .print-button { background-color: #007A33; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 20px 0; }
          @media print { .print-button { display: none; } }
        </style>
      </head>
      <body>
        ${selectedOrders.map((record, index) => `
          <div>
            <div class="header"><h1>HÓA ĐƠN TMĐT</h1><p>Mã đơn: ${record.orderId}</p></div>
            <div class="info-section">
              <div class="info-row"><div class="info-label">Sàn TMĐT:</div><div>${getPlatformName(record.platform)}</div></div>
              <div class="info-row"><div class="info-label">Ngày đặt:</div><div>${dayjs(record.orderDate).format('DD/MM/YYYY')}</div></div>
              <div class="info-row"><div class="info-label">Cửa hàng:</div><div>${record.storeName || 'N/A'}</div></div>
            </div>
            <table><thead><tr><th>STT</th><th>Sản phẩm</th><th>SKU</th><th>Số lượng</th><th>Đơn vị</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
            <tbody>
              ${record.items && record.items.length > 0 ? record.items.map((item, idx) => `
                <tr><td>${idx + 1}</td><td>${item.productName}</td><td>${item.sku}</td><td>${item.quantity}</td><td>${item.unit || 'kg'}</td><td>${formatCurrency(item.sellingPrice)}</td><td>${formatCurrency(item.subtotal)}</td></tr>
              `).join('') : `<tr><td>1</td><td>${record.productName || 'N/A'}</td><td>${record.sku || 'N/A'}</td><td>${record.quantity || 0}</td><td>${record.unit || 'kg'}</td><td>-</td><td>${formatCurrency(record.subtotal || 0)}</td></tr>`}
              <tr class="total-row"><td colspan="6" style="text-align: right;">Tổng cộng:</td><td>${formatCurrency(record.subtotal)}</td></tr>
            </tbody></table>
            <div class="footer"><p>Cảm ơn quý khách đã mua hàng!</p><p>In lúc: ${dayjs().format('DD/MM/YYYY HH:mm')}</p></div>
          </div>
          ${index < selectedOrders.length - 1 ? '<div class="page-break"></div>' : ''}
        `).join('')}
        <button class="print-button" onclick="window.print()">In tất cả</button>
      </body>
      </html>
    `;
    
    printWindow.document.write(invoicesHTML);
    printWindow.document.close();
    printWindow.onload = function() { setTimeout(() => { printWindow.print(); }, 250); };
    message.success(`Đã mở cửa sổ in ${selectedOrders.length} hóa đơn!`);
  };

  // Print all filtered invoices
  const handlePrintAll = () => {
    if (filteredOrders.length === 0) {
      message.warning('Không có đơn hàng nào để in!');
      return;
    }

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    
    const invoicesHTML = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>Hóa Đơn - ${filteredOrders.length} đơn</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
          .header { text-align: center; border-bottom: 2px solid #007A33; padding-bottom: 20px; margin-bottom: 20px; }
          .header h1 { color: #007A33; margin: 0; }
          .info-section { margin-bottom: 20px; }
          .info-row { display: flex; padding: 8px 0; border-bottom: 1px solid #eee; }
          .info-label { font-weight: bold; width: 150px; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
          th { background-color: #007A33; color: white; }
          .total-row { font-weight: bold; background-color: #f5f5f5; }
          .footer { margin-top: 40px; text-align: center; color: #666; }
          .page-break { page-break-after: always; }
          .print-button { background-color: #007A33; color: white; padding: 10px 20px; border: none; border-radius: 4px; cursor: pointer; margin: 20px 0; }
          @media print { .print-button { display: none; } }
        </style>
      </head>
      <body>
        ${filteredOrders.map((record, index) => `
          <div>
            <div class="header"><h1>HÓA ĐƠN TMĐT</h1><p>Mã đơn: ${record.orderId}</p></div>
            <div class="info-section">
              <div class="info-row"><div class="info-label">Sàn TMĐT:</div><div>${getPlatformName(record.platform)}</div></div>
              <div class="info-row"><div class="info-label">Ngày đặt:</div><div>${dayjs(record.orderDate).format('DD/MM/YYYY')}</div></div>
              <div class="info-row"><div class="info-label">Cửa hàng:</div><div>${record.storeName || 'N/A'}</div></div>
            </div>
            <table><thead><tr><th>STT</th><th>Sản phẩm</th><th>SKU</th><th>Số lượng</th><th>Đơn vị</th><th>Đơn giá</th><th>Thành tiền</th></tr></thead>
            <tbody>
              ${record.items && record.items.length > 0 ? record.items.map((item, idx) => `
                <tr><td>${idx + 1}</td><td>${item.productName}</td><td>${item.sku}</td><td>${item.quantity}</td><td>${item.unit || 'kg'}</td><td>${formatCurrency(item.sellingPrice)}</td><td>${formatCurrency(item.subtotal)}</td></tr>
              `).join('') : `<tr><td>1</td><td>${record.productName || 'N/A'}</td><td>${record.sku || 'N/A'}</td><td>${record.quantity || 0}</td><td>${record.unit || 'kg'}</td><td>-</td><td>${formatCurrency(record.subtotal || 0)}</td></tr>`}
              <tr class="total-row"><td colspan="6" style="text-align: right;">Tổng cộng:</td><td>${formatCurrency(record.subtotal)}</td></tr>
            </tbody></table>
            <div class="footer"><p>Cảm ơn quý khách đã mua hàng!</p><p>In lúc: ${dayjs().format('DD/MM/YYYY HH:mm')}</p></div>
          </div>
          ${index < filteredOrders.length - 1 ? '<div class="page-break"></div>' : ''}
        `).join('')}
        <button class="print-button" onclick="window.print()">In tất cả</button>
      </body>
      </html>
    `;
    
    printWindow.document.write(invoicesHTML);
    printWindow.document.close();
    printWindow.onload = function() { setTimeout(() => { printWindow.print(); }, 250); };
    message.success(`Đã mở cửa sổ in ${filteredOrders.length} hóa đơn!`);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = filteredOrders.map((order, index) => ({
      'STT': index + 1,
      'Mã Đơn': order.orderId,
      'Sản Phẩm': order.productName,
      'SKU': order.sku,
      'Sàn TMĐT': getPlatformName(order.platform),
      'Ngày Đặt': order.orderDate,
      'Số Lượng': order.quantity,
      'Đơn Vị': order.unit || 'kg',
      'Giá Bán': order.sellingPrice,
      'Tổng Tiền': order.subtotal,
      'Cửa Hàng': order.storeName || 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Đơn Hàng TMĐT');
    XLSX.writeFile(wb, `DonHangTMDT_${dayjs().format('YYYYMMDD')}.xlsx`);
    message.success('Đã xuất file Excel thành công!');
  };

  // Get platform name
  const getPlatformName = (platform) => {
    const platforms = {
      'shopee': 'Shopee',
      'lazada': 'Lazada',
      'tiktok': 'TikTok Shop',
      'sendo': 'Sendo',
      'tiki': 'Tiki',
      'facebook': 'Facebook',
      'zalo': 'Zalo',
      'other': 'Khác'
    };
    return platforms[platform] || platform;
  };

  // Get platform color
  const getPlatformColor = (platform) => {
    const colors = {
      'shopee': 'orange',
      'lazada': 'blue',
      'tiktok': 'black',
      'sendo': 'red',
      'tiki': 'cyan',
      'facebook': 'blue',
      'zalo': 'blue',
      'other': 'default'
    };
    return colors[platform] || 'default';
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
      title: 'Sàn TMĐT',
      dataIndex: 'platform',
      key: 'platform',
      width: 120,
      render: (platform) => (
        <Tag color={getPlatformColor(platform)}>
          {getPlatformName(platform)}
        </Tag>
      )
    },
    {
      title: 'Cửa Hàng',
      dataIndex: 'storeName',
      key: 'storeName',
      width: 150,
      render: (storeName) => (
        <Tag color="green" icon={<ShopOutlined />}>
          {storeName || 'N/A'}
        </Tag>
      )
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
        console.log('Rendering sellingPrice:', {
          orderId: record.orderId,
          directPrice: price,
          recordSellingPrice: record.sellingPrice,
          hasItems: !!record.items,
          firstItemSellingPrice: record.items?.[0]?.sellingPrice
        });
        
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
              Modal.confirm({
                title: 'Xóa đơn hàng này?',
                content: 'Bạn có chắc chắn muốn xóa đơn hàng này không?',
                okText: 'Xóa',
                cancelText: 'Hủy',
                okButtonProps: { danger: true },
                onOk: () => handleDeleteOrder(record)
              });
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
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <Card 
        style={{ 
          marginBottom: 24,
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShoppingOutlined style={{ fontSize: 32, color: '#007A33' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 24, color: '#007A33' }}>Quản Lý Đơn Hàng TMĐT</h1>
            <p style={{ margin: 0, color: '#666' }}>Quản lý các đơn hàng từ TMĐT, Bán Lẻ và Bán Sỉ</p>
          </div>
        </div>
      </Card>

      {/* Order Type Tabs */}
      <div style={{ marginBottom: 24 }}>
        <Space size="middle">
          <Button
            icon={<ShoppingOutlined />}
            size="large"
            type="primary"
            style={{
              background: '#007A33',
              borderColor: '#007A33'
            }}
          >
            Quản lý đơn hàng TMĐT
          </Button>
          <Button
            icon={<ShopOutlined />}
            size="large"
            onClick={() => navigate('/orders/manage/retail')}
            style={{
              borderColor: '#d9d9d9',
              background: 'white',
              color: '#666'
            }}
          >
            Quản lý đơn hàng lẻ
          </Button>
          <Button
            icon={<TeamOutlined />}
            size="large"
            onClick={() => navigate('/orders/manage/wholesale')}
            style={{
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
              suffix="₫"
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
              suffix="₫"
              valueStyle={{ color: totalProfit >= 0 ? '#52c41a' : '#ff4d4f' }}
              formatter={(value) => formatCurrency(value)}
            />
          </Card>
        </Col>
      </Row>

      {/* Orders Table */}
      <Card
        title={<><ShoppingOutlined /> Danh Sách Đơn Hàng TMĐT</>}
        extra={
          <Space>
            <Popconfirm
              title="Đồng bộ giá bán từ dữ liệu hiện tại?"
              description="Cập nhật giá bán cho tất cả đơn hàng từ giá bán hiện tại trong quản lý sản phẩm bán"
              onConfirm={handleSyncSellingPrices}
              okText="Đồng bộ"
              cancelText="Hủy"
              disabled={filteredOrders.length === 0}
            >
              <Button
                type="primary"
                icon={<SyncOutlined />}
                disabled={filteredOrders.length === 0}
                style={{ background: '#1890ff', borderColor: '#1890ff' }}
              >
                Đồng Bộ Giá Bán
              </Button>
            </Popconfirm>
            <Button
              type="primary"
              icon={<PrinterOutlined />}
              onClick={handlePrintSelected}
              disabled={selectedRowKeys.length === 0}
              style={{ background: '#0a4e09ff', borderColor: '#227444ff' }}
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
                placeholder="Nhập mã đơn hàng, SKU, tên sản phẩm..."
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
              <Select
                placeholder="Tất cả sàn"
                value={platformFilter}
                onChange={setPlatformFilter}
                style={{ width: '100%' }}
              >
                <Option value="all">Tất cả sàn</Option>
                <Option value="shopee">Shopee</Option>
                <Option value="lazada">Lazada</Option>
                <Option value="tiktok">TikTok Shop</Option>
                <Option value="sendo">Sendo</Option>
                <Option value="tiki">Tiki</Option>
                <Option value="facebook">Facebook</Option>
                <Option value="zalo">Zalo</Option>
                <Option value="other">Khác</Option>
              </Select>
            </Col>
          </Row>
          <Row gutter={16}>
            <Col xs={24}>
              <Button
                icon={<CloseCircleOutlined />}
                onClick={handleClearFilters}
                block
              >
                Xóa Tất Cả Bộ Lọc
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
          scroll={{ x: 1500 }}
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
        title={<><EyeOutlined style={{ marginRight: 8 }} />Chi Tiết Đơn Hàng TMĐT</>}
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
                  <p><strong>Sàn TMĐT:</strong> {selectedOrder.platform || 'N/A'}</p>
                  <p><strong>Ngày Đặt:</strong> {dayjs(selectedOrder.orderDate).format('DD/MM/YYYY')}</p>
                </Col>
                <Col span={12}>
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
                sellingPrice: selectedOrder.sellingPrice,
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
                  align: 'center'
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
    </div>
  );
};

export default ManageOrdersTMDT;
