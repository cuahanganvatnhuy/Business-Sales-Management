import React, { useState, useEffect } from 'react';
import { database } from '../../services/firebase.service';
import { ref, onValue, update, push } from 'firebase/database';
import {
  Card, Row, Col, Table, Tag, Button, Input, Select, Modal, InputNumber,
  message, Statistic, Space, Popconfirm, Radio, Dropdown, Menu
} from 'antd';
import {
  InboxOutlined, DollarOutlined, WarningOutlined, StopOutlined,
  PlusOutlined, ImportOutlined, ExportOutlined, EditOutlined,
  SearchOutlined, FileExcelOutlined, DeleteOutlined, EyeOutlined,
  MoreOutlined, PrinterOutlined, EllipsisOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';
import * as XLSX from 'xlsx';
import dayjs from 'dayjs';

const { Option } = Select;
const { Search } = Input;

const Inventory = () => {
  const navigate = useNavigate();
  const { selectedStore } = useStore();
  const { user, isAdmin } = useAuth();
  const userPermissions = user?.permissions || [];
  const hasPermission = isAdmin || userPermissions.includes('warehouse.inventory.view');
  const canImportStock = isAdmin || userPermissions.includes('warehouse.inventory.import');
  const canExportStock = isAdmin || userPermissions.includes('warehouse.inventory.export');
  const canAdjustStock = isAdmin || userPermissions.includes('warehouse.inventory.adjust');
  const canViewDetail = isAdmin || userPermissions.includes('warehouse.inventory.detail');
  const canExportReport = isAdmin || userPermissions.includes('warehouse.inventory.exportReport');

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Kho Hàng. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // Filters
  const [searchText, setSearchText] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  
  // Selection
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  
  // Modals
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [exportModalVisible, setExportModalVisible] = useState(false);
  const [adjustModalVisible, setAdjustModalVisible] = useState(false);
  const [updateModalVisible, setUpdateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [adjustQuantity, setAdjustQuantity] = useState(0);
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustType, setAdjustType] = useState('add'); // 'add' or 'subtract'
  const [updateQuantity, setUpdateQuantity] = useState(0);
  const [printModalVisible, setPrintModalVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  
  // Pagination state
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    showSizeChanger: true,
    pageSizeOptions: ['10', '20', '50', '100']
  });
  const [exportTransaction, setExportTransaction] = useState(null);

  // Load products
  useEffect(() => {
    setLoading(true);
    const productsRef = ref(database, 'products');
    const unsubscribe = onValue(productsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const productsArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setProducts(productsArray);
        setFilteredProducts(productsArray);
      } else {
        setProducts([]);
        setFilteredProducts([]);
      }
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Load categories
  useEffect(() => {
    const categoriesRef = ref(database, 'categories');
    const unsubscribe = onValue(categoriesRef, (snapshot) => {
      const data = snapshot.val();
      setCategories(data ? Object.keys(data).map(key => ({ id: key, ...data[key] })) : []);
    });
    return () => unsubscribe();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...products];
    
    if (searchText) {
      filtered = filtered.filter(p => 
        p.name?.toLowerCase().includes(searchText.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchText.toLowerCase())
      );
    }
    
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(p => p.categoryId === categoryFilter);
    }
    
    if (statusFilter !== 'all') {
      if (statusFilter === 'out') {
        filtered = filtered.filter(p => p.stock === 0);
      } else if (statusFilter === 'low') {
        filtered = filtered.filter(p => p.stock > 0 && p.stock < 10);
      } else if (statusFilter === 'in') {
        filtered = filtered.filter(p => p.stock >= 10);
      }
    }
    
    setFilteredProducts(filtered);
  }, [products, searchText, categoryFilter, statusFilter]);

  // Calculate statistics
  const totalProducts = products.length;
  const totalValue = products.reduce((sum, p) => sum + ((p.price || 0) * (p.stock || 0)), 0);
  const lowStock = products.filter(p => p.stock > 0 && p.stock < 10).length;
  const outOfStock = products.filter(p => p.stock === 0).length;

  // Handle adjust inventory (single or bulk) - SET stock to new value
  const handleAdjust = async () => {
    if (!canAdjustStock) {
      message.error('Bạn không có quyền điều chỉnh tồn kho.');
      return;
    }

    if (adjustQuantity < 0) {
      message.error('Số lượng kho không thể âm!');
      return;
    }
    
    try {
      const updates = {};
      const productsToAdjust = selectedProduct 
        ? [selectedProduct] 
        : products.filter(p => selectedRowKeys.includes(p.id));
      
      if (productsToAdjust.length === 0) {
        message.error('Vui lòng chọn sản phẩm!');
        return;
      }
      
      // Apply adjustments - SET stock to adjustQuantity
      productsToAdjust.forEach((product, index) => {
        const beforeStock = product.stock || 0;
        const newStock = adjustQuantity; // SET to new value, not add
        
        updates[`products/${product.id}/stock`] = newStock;
        updates[`products/${product.id}/updatedAt`] = new Date().toISOString();
        
        // Log transaction
        const transactionId = `txn_${Date.now()}_${index}`;
        updates[`warehouseTransactions/${transactionId}`] = {
          productId: product.id,
          productName: product.name,
          sku: product.sku,
          unit: product.unit || 'Cái',
          price: product.price || 0,
          type: 'adjustment',
          quantity: newStock,
          beforeQuantity: beforeStock,
          afterQuantity: newStock,
          reason: adjustReason || 'Điều chỉnh tồn kho',
          storeId: selectedStore?.id || null,
          storeName: selectedStore?.name || 'N/A',
          createdAt: new Date().toISOString()
        };
      });
      
      await update(ref(database), updates);
      message.success(`Đã điều chỉnh ${productsToAdjust.length} sản phẩm thành công!`);
      setAdjustModalVisible(false);
      setSelectedProduct(null);
      setSelectedRowKeys([]);
      setAdjustQuantity(0);
      setAdjustReason('');
    } catch (error) {
      console.error('Error:', error);
      message.error('Có lỗi xảy ra!');
    }
  };

  // Export Excel
  const exportExcel = () => {
    if (!canExportReport) {
      message.error('Bạn không có quyền xuất báo cáo Kho Hàng.');
      return;
    }

    const data = filteredProducts.map((p, i) => ({
      'STT': i + 1,
      'Sản Phẩm': p.name,
      'SKU': p.sku,
      'Danh Mục': categories.find(c => c.id === p.categoryId)?.name || 'N/A',
      'Đơn Vị': p.unit,
      'Tồn Kho': p.stock || 0,
      'Giá Nhập': p.price || 0,
      'Giá Trị': (p.price || 0) * (p.stock || 0),
      'Trạng Thái': p.stock === 0 ? 'Hết hàng' : p.stock < 10 ? 'Sắp hết' : 'Còn hàng'
    }));
    
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Kho Hàng');
    XLSX.writeFile(wb, `KhoHang_${dayjs().format('YYYYMMDD')}.xlsx`);
    message.success('Đã xuất Excel!');
  };

  // Handle import stock (add/subtract)
  const handleImportStock = async () => {
    if (adjustType === 'add') {
      if (!canImportStock) {
        message.error('Bạn không có quyền nhập kho.');
        return;
      }
    } else {
      if (!canExportStock) {
        message.error('Bạn không có quyền xuất kho.');
        return;
      }
    }

    if (adjustQuantity <= 0) {
      message.error('Vui lòng nhập số lượng hợp lệ!');
      return;
    }

    // Bulk operation
    if (!selectedProduct && selectedRowKeys.length > 0) {
      try {
        const selectedProducts = products.filter(p => selectedRowKeys.includes(p.id));
        
        for (const product of selectedProducts) {
          const beforeStock = product.stock || 0;
          const changeAmount = adjustType === 'add' ? adjustQuantity : -adjustQuantity;
          const afterStock = beforeStock + changeAmount;

          if (afterStock < 0) {
            message.warning(`Bỏ qua ${product.name}: Số lượng kho sẽ âm!`);
            continue;
          }

          // Update product stock
          await update(ref(database, `products/${product.id}`), {
            stock: afterStock,
            updatedAt: new Date().toISOString()
          });

          // Log transaction
          const txnRef = push(ref(database, 'warehouseTransactions'));
          await update(txnRef, {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            unit: product.unit || 'lỗi',
            price: product.price || 0,
            type: adjustType === 'add' ? 'import' : 'export',
            quantity: adjustQuantity,
            beforeQuantity: beforeStock,
            afterQuantity: afterStock,
            reason: adjustReason || (adjustType === 'add' ? 'Nhập kho hàng loạt' : 'Xuất kho hàng loạt'),
            storeId: selectedStore?.id || null,
            storeName: selectedStore?.name || 'N/A',
            createdAt: new Date().toISOString()
          });
        }

        message.success(`Đã ${adjustType === 'add' ? 'nhập' : 'xuất'} ${selectedProducts.length} sản phẩm!`);
        setImportModalVisible(false);
        setSelectedRowKeys([]);
        setAdjustQuantity(0);
        setAdjustReason('');
        return;
      } catch (error) {
        message.error('Lỗi: ' + error.message);
        return;
      }
    }

    // Single product operation
    if (!selectedProduct) {
      message.error('Vui lòng chọn sản phẩm!');
      return;
    }

    try {
      const beforeStock = selectedProduct.stock || 0;
      const changeAmount = adjustType === 'add' ? adjustQuantity : -adjustQuantity;
      const afterStock = beforeStock + changeAmount;

      if (afterStock < 0) {
        message.error('Số lượng kho không thể âm!');
        return;
      }

      // Update product stock
      await update(ref(database, `products/${selectedProduct.id}`), {
        stock: afterStock,
        updatedAt: new Date().toISOString()
      });

      // Log transaction
      const txnRef = push(ref(database, 'warehouseTransactions'));
      await update(txnRef, {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        sku: selectedProduct.sku,
        unit: selectedProduct.unit || 'Cái',
        price: selectedProduct.price || 0,
        type: adjustType === 'add' ? 'import' : 'export',
        quantity: adjustQuantity,
        beforeQuantity: beforeStock,
        afterQuantity: afterStock,
        reason: adjustReason || (adjustType === 'add' ? 'Nhập kho thêm' : 'Xuất kho'),
        storeId: selectedStore?.id || null,
        storeName: selectedStore?.name || 'N/A',
        createdAt: new Date().toISOString()
      });

      message.success(`Đã ${adjustType === 'add' ? 'nhập' : 'xuất'} kho thành công!`);
      setImportModalVisible(false);
      
      // If export, ask to print receipt
      if (adjustType === 'subtract') {
        setExportTransaction({
          productName: selectedProduct.name,
          sku: selectedProduct.sku,
          unit: selectedProduct.unit || 'Cái',
          quantity: adjustQuantity,
          beforeQuantity: beforeStock,
          afterQuantity: afterStock,
          reason: adjustReason || 'Xuất kho',
          storeName: selectedStore?.name || 'N/A',
          createdAt: new Date().toISOString()
        });
        setPrintModalVisible(true);
      }
      
      setSelectedProduct(null);
      setAdjustQuantity(0);
      setAdjustReason('');
      setAdjustType('add');
    } catch (error) {
      message.error('Lỗi: ' + error.message);
    }
  };

  // Handle update stock (set to new value)
  const handleUpdateStock = async () => {
    if (!canAdjustStock) {
      message.error('Bạn không có quyền điều chỉnh tồn kho.');
      return;
    }

    if (!selectedProduct || updateQuantity < 0) {
      message.error('Vui lòng nhập số lượng hợp lệ!');
      return;
    }

    try {
      const beforeStock = selectedProduct.stock || 0;

      // Update product stock
      await update(ref(database, `products/${selectedProduct.id}`), {
        stock: updateQuantity,
        updatedAt: new Date().toISOString()
      });

      // Log transaction
      const txnRef = push(ref(database, 'warehouseTransactions'));
      await update(txnRef, {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        sku: selectedProduct.sku,
        unit: selectedProduct.unit || 'Cái',
        price: selectedProduct.price || 0,
        type: 'adjustment',
        quantity: updateQuantity,
        beforeQuantity: beforeStock,
        afterQuantity: updateQuantity,
        reason: adjustReason || 'Điều chỉnh kho',
        storeId: selectedStore?.id || null,
        storeName: selectedStore?.name || 'N/A',
        createdAt: new Date().toISOString()
      });

      message.success('Đã cập nhật tồn kho thành công!');
      setUpdateModalVisible(false);
      setSelectedProduct(null);
      setUpdateQuantity(0);
      setAdjustReason('');
    } catch (error) {
      message.error('Lỗi: ' + error.message);
    }
  };

  // Print export receipt
  const printExportReceipt = () => {
    if (!exportTransaction) return;
    
    const printWindow = window.open('', '_blank');
    const printContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Phiếu Xuất Kho</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { 
            font-family: 'Times New Roman', Times, serif; 
            padding: 20px;
            background: #fff;
            font-size: 13px;
          }
          .receipt {
            max-width: 210mm;
            margin: 0 auto;
            padding: 15mm;
          }
          .company-header {
            text-align: center;
            margin-bottom: 5px;
          }
          .company-name {
            font-size: 13px;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 3px;
          }
          .company-info {
            font-size: 11px;
            color: #333;
          }
          .title {
            text-align: center;
            margin: 20px 0 10px 0;
          }
          .title h1 {
            font-size: 20px;
            font-weight: bold;
            text-transform: uppercase;
            margin-bottom: 8px;
            letter-spacing: 1px;
          }
          .title .date {
            font-size: 12px;
            font-style: italic;
          }
          .title .serial {
            font-size: 12px;
            margin-top: 5px;
          }
          .divider {
            border-top: 2px solid #000;
            margin: 15px 0;
          }
          .info-table {
            width: 100%;
            margin-bottom: 15px;
          }
          .info-table td {
            padding: 5px;
            font-size: 12px;
          }
          .info-label {
            font-weight: bold;
            width: 120px;
          }
          .product-table {
            width: 100%;
            border-collapse: collapse;
            margin: 15px 0;
          }
          .product-table th {
            background-color: #f0f0f0;
            border: 1px solid #000;
            padding: 8px 5px;
            font-size: 12px;
            font-weight: bold;
            text-align: center;
          }
          .product-table td {
            border: 1px solid #000;
            padding: 8px 5px;
            font-size: 12px;
          }
          .product-table .center {
            text-align: center;
          }
          .product-table .right {
            text-align: right;
          }
          .product-table .left {
            text-align: left;
          }
          .stock-row {
            background-color: #f9f9f9;
          }
          .stock-row td {
            font-weight: bold;
            padding: 10px 5px;
          }
          .stock-change {
            color: #d32f2f;
            font-size: 13px;
          }
          .stock-after {
            color: #388e3c;
            font-size: 13px;
          }
          .note-section {
            margin: 15px 0;
            padding: 10px;
            background: #f9f9f9;
            border-left: 3px solid #007A33;
          }
          .note-section .note-label {
            font-weight: bold;
            margin-bottom: 5px;
          }
          .signatures {
            margin-top: 40px;
            display: flex;
            justify-content: space-between;
          }
          .signature-box {
            text-align: center;
            width: 30%;
          }
          .signature-label {
            font-weight: bold;
            margin-bottom: 60px;
            font-size: 12px;
          }
          .signature-line {
            border-top: 1px dotted #333;
            padding-top: 5px;
            font-size: 11px;
            font-style: italic;
          }
          .footer-note {
            margin-top: 20px;
            font-size: 11px;
            font-style: italic;
            color: #666;
          }
          .print-time {
            text-align: right;
            font-size: 10px;
            color: #999;
            margin-top: 10px;
          }
          @media print {
            body { padding: 0; }
            .receipt { padding: 10mm; }
          }
        </style>
      </head>
      <body>
        <div class="receipt">
          <!-- Company Header -->
          <div class="company-header">
            <div class="company-name">🏢 Hệ Thống Quản Lý Kinh Doanh</div>
            <div class="company-info">Địa chỉ: ........................ - Hotline: ........................</div>
          </div>

          <!-- Title -->
          <div class="title">
            <h1>PHIẾU XUẤT KHO</h1>
            <div class="date">Ngày ${dayjs(exportTransaction.createdAt).format('DD')} tháng ${dayjs(exportTransaction.createdAt).format('MM')} năm ${dayjs(exportTransaction.createdAt).format('YYYY')}</div>
            <div class="serial">Số phiếu: XK-${dayjs(exportTransaction.createdAt).format('YYMMDDHHmmss')}</div>
          </div>

          <div class="divider"></div>

          <!-- Info Section -->
          <table class="info-table">
            <tr>
              <td class="info-label">🏪 Cửa hàng:</td>
              <td><strong>${exportTransaction.storeName}</strong></td>
            </tr>
            <tr>
              <td class="info-label">📝 Lý do xuất:</td>
              <td>${exportTransaction.reason}</td>
            </tr>
            <tr>
              <td class="info-label">⏰ Thời gian:</td>
              <td>${dayjs(exportTransaction.createdAt).format('HH:mm:ss - DD/MM/YYYY')}</td>
            </tr>
          </table>

          <!-- Product Table -->
          <table class="product-table">
            <thead>
              <tr>
                <th style="width: 40px;">STT</th>
                <th style="width: 35%;">Tên hàng hóa</th>
                <th style="width: 120px;">Mã SKU</th>
                <th style="width: 80px;">Đơn vị</th>
                <th style="width: 100px;">Số lượng xuất</th>
                <th>Ghi chú</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="center">1</td>
                <td class="left"><strong>${exportTransaction.productName}</strong></td>
                <td class="center">${exportTransaction.sku}</td>
                <td class="center">${exportTransaction.unit}</td>
                <td class="center"><strong style="font-size: 14px;">${exportTransaction.quantity}</strong></td>
                <td></td>
              </tr>
             
            </tbody>
          </table>

          <!-- Note Section -->
          <div class="note-section">
            <div class="note-label">📌 Lưu ý:</div>
            <div>- Vui lòng kiểm tra kỹ hàng hóa trước khi nhận</div>
            <div>- Phiếu xuất kho có giá trị trong ngày</div>
          </div>

          <!-- Signatures -->
          <div class="signatures">
            <div class="signature-box">
              <div class="signature-label">Người lập phiếu</div>
              <div class="signature-line">Ký tên</div>
            </div>
            <div class="signature-box">
              <div class="signature-label">Người nhận hàng</div>
              <div class="signature-line">Ký tên</div>
            </div>
            <div class="signature-box">
              <div class="signature-label">Thủ kho</div>
              <div class="signature-line">Ký tên</div>
            </div>
          </div>

          <div class="print-time">
            In lúc: ${dayjs().format('HH:mm:ss - DD/MM/YYYY')}
          </div>
        </div>
        
        <script>
          window.onload = function() {
            window.print();
            window.onafterprint = function() {
              window.close();
            };
          };
        </script>
      </body>
      </html>
    `;
    
    printWindow.document.write(printContent);
    printWindow.document.close();
    setPrintModalVisible(false);
  };

  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      render: (_, __, index) => index + 1
    },
    {
      title: 'Sản Phẩm',
      dataIndex: 'name',
      key: 'name',
      width: 200
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120
    },
    {
      title: 'Danh Mục',
      dataIndex: 'categoryId',
      key: 'category',
      width: 150,
      render: (categoryId) => categories.find(c => c.id === categoryId)?.name || 'N/A'
    },
    {
      title: 'Đơn Vị',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
      align: 'center'
    },
    {
      title: 'Tồn Kho',
      dataIndex: 'stock',
      key: 'stock',
      width: 100,
      align: 'center',
      sorter: (a, b) => (a.stock || 0) - (b.stock || 0),
      render: (stock) => <span style={{ fontWeight: 'bold' }}>{stock || 0}</span>
    },
    {
      title: 'Giá Nhập',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      align: 'right',
      render: (price) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price || 0)
    },
    {
      title: 'Giá Trị',
      key: 'value',
      width: 120,
      align: 'right',
      render: (_, record) => {
        const value = (record.price || 0) * (record.stock || 0);
        return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
      }
    },
    {
      title: 'Trạng Thái',
      key: 'status',
      width: 100,
      align: 'center',
      render: (_, record) => {
        if (record.stock === 0) return <Tag color="red">Hết hàng</Tag>;
        if (record.stock < 10) return <Tag color="orange">Sắp hết</Tag>;
        return <Tag color="green">Còn hàng</Tag>;
      }
    },
    {
      title: 'Thao Tác',
      key: 'action',
      width: 100,
      align: 'center',
      fixed: 'right',
      render: (_, record) => {
        const menu = (
          <Menu>
            <Menu.Item 
              key="view" 
              icon={<EyeOutlined style={{ color: '#1890ff' }} />}
              onClick={() => {
                if (!canViewDetail) {
                  message.error('Bạn không có quyền xem chi tiết sản phẩm kho.');
                  return;
                }
                setSelectedProduct(record);
                setDetailModalVisible(true);
              }}
            >
              Xem chi tiết
            </Menu.Item>
            <Menu.Item 
              key="adjust" 
              icon={<EditOutlined style={{ color: '#52c41a' }} />}
              onClick={() => {
                setSelectedProduct(record);
                setUpdateQuantity(record.stock || 0);
                setUpdateModalVisible(true);
              }}
            >
              Điều chỉnh
            </Menu.Item>
            <Menu.Divider />
            <Menu.Item 
              key="delete" 
              icon={<DeleteOutlined style={{ color: '#ff4d4f' }} />}
              danger
              onClick={() => {
                setProductToDelete(record);
                setDeleteConfirmVisible(true);
              }}
            >
              Xóa
            </Menu.Item>
          </Menu>
        );

        return (
          <Dropdown overlay={menu} trigger={['click']} placement="bottomRight">
            <Button 
              type="link" 
              icon={<EllipsisOutlined style={{ fontSize: 20, fontWeight: 'bold' }} />} 
            />
          </Dropdown>
        );
      }
    }
  ];

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <Card style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <InboxOutlined style={{ fontSize: 32, color: '#007A33' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 24, color: '#007A33' }}>Kho Hàng</h1>
            <p style={{ margin: 0, color: '#666' }}>Quản lý tồn kho sản phẩm</p>
          </div>
        </div>
      </Card>

      {/* Stats */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tổng Sản Phẩm"
              value={totalProducts}
              prefix={<InboxOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Giá Trị Kho"
              value={totalValue}
              prefix={<DollarOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
              formatter={(value) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value)}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Sắp Hết Hàng"
              value={lowStock}
              prefix={<WarningOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Hết Hàng"
              value={outOfStock}
              prefix={<StopOutlined style={{ color: '#f5222d' }} />}
              valueStyle={{ color: '#f5222d' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Actions & Filters */}
      <Card title="Danh Sách Sản Phẩm Kho" style={{ marginBottom: 24, borderRadius: 12 }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            <Button 
              type="primary" 
              icon={<PlusOutlined />}
              onClick={() => {
                setSelectedProduct(null);
                setAdjustType('add');
                setAdjustQuantity(0);
                setAdjustReason('');
                setImportModalVisible(true);
              }}
            >
              Nhập Kho Thêm
            </Button>
            <Button 
              icon={<ImportOutlined />} 
              style={{ background: '#52c41a', color: 'white', borderColor: '#52c41a' }}
              onClick={() => navigate('/products/add')}
            >
              Tạo Sản Phẩm Mới Vào Kho
            </Button>
            <Button 
              icon={<ExportOutlined />}
              onClick={() => {
                setSelectedProduct(null);
                setAdjustType('subtract');
                setAdjustQuantity(0);
                setAdjustReason('');
                setImportModalVisible(true);
              }}
            >
              Xuất Kho
            </Button>
            <Button 
              icon={<EditOutlined />}
              onClick={() => {
                setSelectedProduct(null);
                setUpdateQuantity(0);
                setAdjustReason('');
                setUpdateModalVisible(true);
              }}
            >
              Điều Chỉnh
            </Button>
            {selectedRowKeys.length > 0 && (
              <>
                <Button 
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => {
                    setSelectedProduct(null);
                    setAdjustType('add');
                    setImportModalVisible(true);
                  }}
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                >
                  Nhập Kho Đã Chọn ({selectedRowKeys.length})
                </Button>
                <Button 
                  type="primary"
                  danger
                  icon={<EditOutlined />}
                  onClick={() => {
                    setSelectedProduct(null);
                    setAdjustModalVisible(true);
                  }}
                >
                  Điều Chỉnh Đã Chọn ({selectedRowKeys.length})
                </Button>
              </>
            )}
            <Button icon={<FileExcelOutlined />} onClick={exportExcel} style={{ background: '#52c41a', color: 'white', borderColor: '#52c41a' }}>
              Xuất Báo Cáo
            </Button>
          </div>

          {/* Filters */}
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Search
                placeholder="Tìm sản phẩm, SKU..."
                allowClear
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                prefix={<SearchOutlined />}
              />
            </Col>
            <Col xs={24} md={8}>
              <Select
                placeholder="Danh mục"
                value={categoryFilter}
                onChange={setCategoryFilter}
                style={{ width: '100%' }}
              >
                <Option value="all">Tất cả danh mục</Option>
                {categories.map(cat => (
                  <Option key={cat.id} value={cat.id}>{cat.name}</Option>
                ))}
              </Select>
            </Col>
            <Col xs={24} md={8}>
              <Select
                placeholder="Trạng thái"
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: '100%' }}
              >
                <Option value="all">Tất cả trạng thái</Option>
                <Option value="in">Còn hàng</Option>
                <Option value="low">Sắp hết hàng</Option>
                <Option value="out">Hết hàng</Option>
              </Select>
            </Col>
          </Row>

          {/* Table */}
          <Table
            columns={columns}
            dataSource={filteredProducts}
            rowKey="id"
            loading={loading}
            rowSelection={{
              selectedRowKeys,
              onChange: (keys) => setSelectedRowKeys(keys),
              selections: [
                Table.SELECTION_ALL,
                Table.SELECTION_INVERT,
                Table.SELECTION_NONE,
              ],
            }}
            pagination={{
              ...pagination,
              total: filteredProducts.length,
              showTotal: (total) => `Tổng ${total} sản phẩm`,
              onChange: (page, pageSize) => {
                setPagination({ ...pagination, current: page, pageSize });
              },
              onShowSizeChange: (current, size) => {
                setPagination({ ...pagination, current: 1, pageSize: size });
              }
            }}
            scroll={{ x: 1400 }}
          />
        </Space>
      </Card>

      {/* Adjust Modal */}
      <Modal
        title={selectedProduct ? "Điều Chỉnh Tồn Kho" : `Điều Chỉnh Hàng Loạt (${selectedRowKeys.length} sản phẩm)`}
        open={adjustModalVisible}
        onOk={handleAdjust}
        onCancel={() => {
          setAdjustModalVisible(false);
          setSelectedProduct(null);
          setSelectedRowKeys([]);
          setAdjustQuantity(0);
          setAdjustReason('');
        }}
        okText="Lưu"
        cancelText="Hủy"
        width={selectedProduct ? 600 : 700}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          {selectedProduct ? (
            // Single product adjustment
            <>
              <div>
                <strong>Sản phẩm:</strong> {selectedProduct.name}
              </div>
              <div>
                <strong>SKU:</strong> {selectedProduct.sku}
              </div>
              <div>
                <strong>Tồn kho hiện tại:</strong> <span style={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff' }}>{selectedProduct.stock || 0}</span>
              </div>
            </>
          ) : (
            // Bulk adjustment
            <div style={{ padding: 12, background: '#fff7e6', borderRadius: 8, border: '1px solid #faad14' }}>
              <div style={{ marginBottom: 8 }}>
                <strong>⚠️ Điều chỉnh hàng loạt {selectedRowKeys.length} sản phẩm</strong>
              </div>
              <div style={{ fontSize: 13, color: '#666' }}>
                Số lượng điều chỉnh sẽ được áp dụng cho tất cả {selectedRowKeys.length} sản phẩm đã chọn.
              </div>
            </div>
          )}
          
          <div>
            <label>Số lượng điều chỉnh:</label>
            <InputNumber
              value={adjustQuantity}
              onChange={setAdjustQuantity}
              style={{ width: '100%', marginTop: 8 }}
              placeholder="Nhập số dương để tăng, số âm để giảm"
            />
            <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>
              Nhập số dương để tăng, số âm để giảm
            </div>
          </div>
          
          <div>
            <label>Lý do:</label>
            <Input.TextArea
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              rows={3}
              placeholder="Nhập lý do điều chỉnh..."
              style={{ marginTop: 8 }}
            />
          </div>
          
          {selectedProduct && adjustQuantity !== 0 && (
            <div style={{ padding: 12, background: '#f0f9ff', borderRadius: 8, border: '1px solid #1890ff' }}>
              <strong>Tồn kho sau điều chỉnh:</strong>{' '}
              <span style={{ fontSize: 18, fontWeight: 'bold', color: adjustQuantity > 0 ? '#52c41a' : '#f5222d' }}>
                {(selectedProduct.stock || 0) + adjustQuantity}
              </span>
            </div>
          )}
        </Space>
      </Modal>

      {/* Import/Export Stock Modal */}
      <Modal
        title={
          selectedProduct 
            ? (adjustType === 'add' ? '➕ Nhập Kho Thêm' : '➖ Xuất Kho')
            : selectedRowKeys.length > 0
              ? `${adjustType === 'add' ? '➕ Nhập' : '➖ Xuất'} Kho Hàng Loạt (${selectedRowKeys.length} sản phẩm)`
              : (adjustType === 'add' ? '➕ Nhập Kho Thêm' : '➖ Xuất Kho')
        }
        open={importModalVisible}
        onOk={handleImportStock}
        onCancel={() => {
          setImportModalVisible(false);
          setSelectedProduct(null);
          setAdjustQuantity(0);
          setAdjustReason('');
        }}
        okText={adjustType === 'add' ? 'Nhập Kho' : 'Xuất Kho'}
        cancelText="Hủy"
        width={selectedProduct ? 600 : 700}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* Dropdown chọn sản phẩm */}
          {!selectedProduct && selectedRowKeys.length === 0 && (
            <div>
              <label style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>Chọn Sản Phẩm:</label>
              <Select
                showSearch
                placeholder="Tìm và chọn sản phẩm..."
                style={{ width: '100%' }}
                value={null}
                onChange={(value) => {
                  const product = products.find(p => p.id === value);
                  setSelectedProduct(product);
                }}
                filterOption={(input, option) =>
                  option.children.toLowerCase().includes(input.toLowerCase())
                }
              >
                {products.map(p => (
                  <Option key={p.id} value={p.id}>
                    {p.name} - Tồn: {p.stock || 0} {p.unit || 'cái'}
                  </Option>
                ))}
              </Select>
            </div>
          )}

          {/* Single product info */}
          {selectedProduct && (
            <div style={{ padding: 12, background: '#f0f9ff', borderRadius: 8 }}>
              <div><strong>Sản phẩm:</strong> {selectedProduct.name}</div>
              <div><strong>SKU:</strong> {selectedProduct.sku}</div>
              <div><strong>Tồn kho hiện tại:</strong> <span style={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff' }}>{selectedProduct.stock || 0}</span> {selectedProduct.unit || 'cái'}</div>
            </div>
          )}

          {/* Bulk products list */}
          {!selectedProduct && selectedRowKeys.length > 0 && (
            <div style={{ padding: 15, background: '#f6ffed', border: '1px solid #b7eb8f', borderRadius: 8 }}>
              <div style={{ marginBottom: 10, fontWeight: 600 }}>
                📦 Danh sách {selectedRowKeys.length} sản phẩm đã chọn:
              </div>
              <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                {products.filter(p => selectedRowKeys.includes(p.id)).map((p, index) => (
                  <div key={p.id} style={{ 
                    padding: '8px 10px', 
                    background: '#fff', 
                    marginBottom: 5, 
                    borderRadius: 4,
                    border: '1px solid #d9f7be'
                  }}>
                    <strong>{index + 1}.</strong> {p.name} - Tồn: <strong>{p.stock || 0}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <label style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>
              Số Lượng {adjustType === 'add' ? 'Nhập' : 'Xuất'}:
            </label>
            <InputNumber
              min={1}
              value={adjustQuantity}
              onChange={setAdjustQuantity}
              style={{ width: '100%' }}
              placeholder="Nhập số lượng..."
            />
          </div>

          <div>
            <label style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>Lý Do:</label>
            <Input.TextArea
              rows={3}
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder={adjustType === 'add' ? 'Nhập kho từ nhà cung cấp...' : 'Xuất kho cho đơn hàng...'}
            />
          </div>

          {selectedProduct && adjustQuantity > 0 && (
            <div style={{ padding: 12, background: adjustType === 'add' ? '#f6ffed' : '#fff7e6', borderRadius: 8, border: `1px solid ${adjustType === 'add' ? '#52c41a' : '#faad14'}` }}>
              <strong>Tồn kho sau khi {adjustType === 'add' ? 'nhập' : 'xuất'}:</strong>{' '}
              <span style={{ fontSize: 18, fontWeight: 'bold', color: adjustType === 'add' ? '#52c41a' : '#faad14' }}>
                {adjustType === 'add' ? (selectedProduct.stock || 0) + adjustQuantity : (selectedProduct.stock || 0) - adjustQuantity}
              </span> {selectedProduct.unit || 'cái'}
            </div>
          )}
        </Space>
      </Modal>

      {/* Update Stock Modal (Set to specific value) */}
      <Modal
        title="🔧 Điều Chỉnh Tồn Kho"
        open={updateModalVisible}
        onOk={handleUpdateStock}
        onCancel={() => {
          setUpdateModalVisible(false);
          setSelectedProduct(null);
          setUpdateQuantity(0);
          setAdjustReason('');
        }}
        okText="Cập Nhật"
        cancelText="Hủy"
        width={600}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <label style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>Chọn Sản Phẩm:</label>
            <Select
              showSearch
              placeholder="Tìm và chọn sản phẩm..."
              style={{ width: '100%' }}
              value={selectedProduct?.id}
              onChange={(value) => {
                const product = products.find(p => p.id === value);
                setSelectedProduct(product);
                setUpdateQuantity(product?.stock || 0);
              }}
              filterOption={(input, option) =>
                option.children.toLowerCase().includes(input.toLowerCase())
              }
            >
              {products.map(p => (
                <Option key={p.id} value={p.id}>
                  {p.name} - Tồn: {p.stock || 0} {p.unit || 'cái'}
                </Option>
              ))}
            </Select>
          </div>

          {selectedProduct && (
            <>
              <div style={{ padding: 12, background: '#f0f9ff', borderRadius: 8 }}>
                <div><strong>Sản phẩm:</strong> {selectedProduct.name}</div>
                <div><strong>SKU:</strong> {selectedProduct.sku}</div>
                <div><strong>Tồn kho hiện tại:</strong> <span style={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff' }}>{selectedProduct.stock || 0}</span> {selectedProduct.unit || 'cái'}</div>
              </div>

              <div>
                <label style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>
                  Số Lượng Mới (Cập nhật tồn kho thành):
                </label>
                <InputNumber
                  min={0}
                  value={updateQuantity}
                  onChange={setUpdateQuantity}
                  style={{ width: '100%' }}
                  placeholder="Nhập số lượng mới..."
                />
                <div style={{ marginTop: 4, fontSize: 12, color: '#666' }}>
                  💡 Ví dụ: Kho đang 100, nhập 2 → Kho sẽ là 2
                </div>
              </div>

              <div>
                <label style={{ fontWeight: 600, marginBottom: 8, display: 'block' }}>Lý Do:</label>
                <Input.TextArea
                  rows={3}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Kiểm kê lại kho, điều chỉnh sai số..."
                />
              </div>

              <div style={{ padding: 12, background: '#fff7e6', borderRadius: 8, border: '1px solid #faad14' }}>
                <div style={{ marginBottom: 8 }}>
                  <strong>Thay đổi:</strong>{' '}
                  <span style={{ fontSize: 16, fontWeight: 'bold', color: updateQuantity > (selectedProduct.stock || 0) ? '#52c41a' : '#f5222d' }}>
                    {updateQuantity > (selectedProduct.stock || 0) ? '+' : ''}{updateQuantity - (selectedProduct.stock || 0)}
                  </span> {selectedProduct.unit || 'cái'}
                </div>
                <div>
                  <strong>Tồn kho sau cập nhật:</strong>{' '}
                  <span style={{ fontSize: 18, fontWeight: 'bold', color: '#1890ff' }}>
                    {updateQuantity}
                  </span> {selectedProduct.unit || 'cái'}
                </div>
              </div>
            </>
          )}
        </Space>
      </Modal>

      {/* Detail Modal */}
      <Modal
        title={<span><EyeOutlined /> Chi Tiết Sản Phẩm</span>}
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedProduct(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Đóng
          </Button>,
          <Button 
            key="adjust" 
            type="primary" 
            icon={<EditOutlined />}
            onClick={() => {
              setDetailModalVisible(false);
              setUpdateQuantity(selectedProduct?.stock || 0);
              setUpdateModalVisible(true);
            }}
          >
            Điều Chỉnh
          </Button>
        ]}
        width={700}
      >
        {selectedProduct && (
          <div style={{ padding: '16px 0' }}>
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <Card size="small" style={{ background: '#f0f9ff' }}>
                  <Statistic 
                    title="Tên Sản Phẩm" 
                    value={selectedProduct.name}
                    valueStyle={{ fontSize: 18, color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" style={{ background: '#f0f9ff' }}>
                  <Statistic 
                    title="SKU" 
                    value={selectedProduct.sku || 'N/A'}
                    valueStyle={{ fontSize: 18, color: '#1890ff' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" style={{ background: '#f6ffed' }}>
                  <Statistic 
                    title="Tồn Kho" 
                    value={selectedProduct.stock || 0}
                    suffix={selectedProduct.unit || 'cái'}
                    valueStyle={{ fontSize: 24, color: '#52c41a', fontWeight: 'bold' }}
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small" style={{ background: '#fff7e6' }}>
                  <Statistic 
                    title="Giá Nhập" 
                    value={selectedProduct.price || 0}
                    precision={0}
                    valueStyle={{ fontSize: 20, color: '#faad14' }}
                    prefix="₫"
                  />
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <div style={{ marginBottom: 8 }}><strong>Danh Mục:</strong></div>
                  <Tag color="blue">{categories.find(c => c.id === selectedProduct.categoryId)?.name || 'N/A'}</Tag>
                </Card>
              </Col>
              <Col span={12}>
                <Card size="small">
                  <div style={{ marginBottom: 8 }}><strong>Trạng Thái:</strong></div>
                  {selectedProduct.stock === 0 && <Tag color="red">Hết hàng</Tag>}
                  {selectedProduct.stock > 0 && selectedProduct.stock < 10 && <Tag color="orange">Sắp hết</Tag>}
                  {selectedProduct.stock >= 10 && <Tag color="green">Còn hàng</Tag>}
                </Card>
              </Col>
              <Col span={24}>
                <Card size="small" style={{ background: '#fafafa' }}>
                  <div style={{ marginBottom: 8 }}><strong>Giá Trị Tồn Kho:</strong></div>
                  <div style={{ fontSize: 24, fontWeight: 'bold', color: '#007A33' }}>
                    {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format((selectedProduct.price || 0) * (selectedProduct.stock || 0))}
                  </div>
                </Card>
              </Col>
              {selectedProduct.conversion && (
                <Col span={24}>
                  <Card size="small">
                    <div style={{ marginBottom: 8 }}><strong>Quy Đổi:</strong></div>
                    <div>{selectedProduct.conversion}</div>
                  </Card>
                </Col>
              )}
              {selectedProduct.description && (
                <Col span={24}>
                  <Card size="small">
                    <div style={{ marginBottom: 8 }}><strong>Mô Tả:</strong></div>
                    <div style={{ color: '#666' }}>{selectedProduct.description}</div>
                  </Card>
                </Col>
              )}
            </Row>
          </div>
        )}
      </Modal>

      {/* Print Confirmation Modal */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <PrinterOutlined style={{ fontSize: 24, color: '#007A33' }} />
            <span>In Phiếu Xuất Kho</span>
          </div>
        }
        open={printModalVisible}
        onOk={printExportReceipt}
        onCancel={() => {
          setPrintModalVisible(false);
          setExportTransaction(null);
        }}
        okText={
          <span>
            <PrinterOutlined /> In Phiếu
          </span>
        }
        cancelText="Hủy"
        okButtonProps={{ style: { background: '#007A33', borderColor: '#007A33' } }}
        width={500}
        centered
      >
        <div style={{ padding: '20px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <div style={{ 
              fontSize: 48, 
              marginBottom: 10,
              animation: 'bounce 1s ease infinite'
            }}>
              🖨️
            </div>
            <h3 style={{ color: '#007A33', marginBottom: 10 }}>
              Xuất kho thành công!
            </h3>
            <p style={{ color: '#666', fontSize: 14 }}>
              Bạn có muốn in phiếu xuất kho không?
            </p>
          </div>

          {exportTransaction && (
            <div style={{ 
              background: '#f9f9f9', 
              padding: 15, 
              borderRadius: 8,
              border: '1px solid #e0e0e0'
            }}>
              <div style={{ marginBottom: 10 }}>
                <strong>📦 Sản phẩm:</strong>{' '}
                <span style={{ color: '#007A33' }}>{exportTransaction.productName}</span>
              </div>
              <div style={{ marginBottom: 10 }}>
                <strong>📊 Số lượng xuất:</strong>{' '}
                <span style={{ color: '#f5222d', fontSize: 16, fontWeight: 'bold' }}>
                  {exportTransaction.quantity}
                </span>
              </div>
              <div style={{ marginBottom: 10 }}>
                <strong>🏪 Cửa hàng:</strong>{' '}
                <span>{exportTransaction.storeName}</span>
              </div>
              <div>
                <strong>📝 Lý do:</strong>{' '}
                <span>{exportTransaction.reason}</span>
              </div>
            </div>
          )}

          <div style={{ 
            marginTop: 20, 
            padding: 15, 
            background: '#e6f7ff', 
            borderRadius: 8,
            border: '1px solid #91d5ff'
          }}>
            <div style={{ fontSize: 12, color: '#666', marginBottom: 5 }}>
              💡 <strong>Lưu ý:</strong>
            </div>
            <ul style={{ fontSize: 12, color: '#666', paddingLeft: 20, margin: 0 }}>
              <li>Phiếu sẽ được mở trong cửa sổ mới</li>
              <li>Hộp thoại in sẽ tự động hiện ra</li>
              <li>Bạn có thể lưu phiếu dưới dạng PDF</li>
            </ul>
          </div>
        </div>

        <style>{`
          @keyframes bounce {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-10px); }
          }
        `}</style>
      </Modal>

      {productToDelete && (
        <Modal
          title="⚠️ Xác nhận xóa sản phẩm"
          open={deleteConfirmVisible}
          okText="Xóa"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
          onOk={async () => {
            try {
              await update(ref(database, `products/${productToDelete.id}`), {
                status: 'inactive',
                updatedAt: new Date().toISOString()
              });
              message.success('Đã xóa sản phẩm khỏi kho!');
            } catch (error) {
              message.error('Lỗi: ' + error.message);
            } finally {
              setDeleteConfirmVisible(false);
              setProductToDelete(null);
            }
          }}
          onCancel={() => {
            setDeleteConfirmVisible(false);
            setProductToDelete(null);
          }}
          centered
        >
          <p>Bạn có chắc muốn xóa "{productToDelete.name}" khỏi kho?</p>
          <p style={{ color: '#ff4d4f', fontWeight: 600 }}>Hành động này không thể hoàn tác.</p>
        </Modal>
      )}
    </div>
  );
};

export default Inventory;
