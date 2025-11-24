import React, { useState, useEffect } from 'react';
import { Card, Button, Table, Input, Select, Tag, Modal, Form, InputNumber, message, Spin, Statistic, Row, Col } from 'antd';
import { 
  MoneyCollectOutlined, 
  SearchOutlined, 
  SyncOutlined, 
  FileExcelOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  BoxPlotOutlined,
  CheckCircleOutlined,
  PauseCircleOutlined,
  TagsOutlined
} from '@ant-design/icons';
import { database } from '../../services/firebase.service';
import { ref, onValue, push, set, update, remove } from 'firebase/database';
import { formatCurrency } from '../../utils/format';
import * as XLSX from 'xlsx';
import { useAuth } from '../../contexts/AuthContext';
import './SellingProducts.css';

const { TextArea } = Input;
const { Option } = Select;

const SellingProducts = () => {
  const { user, isAdmin } = useAuth();
  const userPermissions = user?.permissions || [];
  const canViewSellingProducts = isAdmin || userPermissions.includes('sellingProducts.view');
  const canEditSellingProducts = isAdmin || userPermissions.includes('sellingProducts.manage.edit');
  const canDeleteSellingSingle = isAdmin || userPermissions.includes('sellingProducts.manage.delete.single');
  const canDeleteSellingBulk = isAdmin || userPermissions.includes('sellingProducts.manage.delete.bulk');
  const canSyncAll = isAdmin || userPermissions.includes('sellingProducts.manage.sync.all');
  const canSyncSelect = isAdmin || userPermissions.includes('sellingProducts.manage.sync.select');
  const canActivate = isAdmin || userPermissions.includes('sellingProducts.manage.activate');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]); // Sản phẩm gốc
  const [sellingProducts, setSellingProducts] = useState([]); // Sản phẩm đang bán
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedRows, setSelectedRows] = useState([]);
  const [editingKey, setEditingKey] = useState('');
  const [editingPrice, setEditingPrice] = useState(0);
  
  // Modals
  const [selectModalVisible, setSelectModalVisible] = useState(false);
  const [priceModalVisible, setPriceModalVisible] = useState(false);
  const [syncModalVisible, setSyncModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteSingleModalVisible, setDeleteSingleModalVisible] = useState(false);
  const [availableProductsToSync, setAvailableProductsToSync] = useState([]);
  const [selectedProductsForAdd, setSelectedProductsForAdd] = useState([]);
  const [editingProduct, setEditingProduct] = useState(null);
  const [deletingProduct, setDeletingProduct] = useState(null);
  
  const [form] = Form.useForm();

  // Load original products
  useEffect(() => {
    const productsRef = ref(database, 'products');
    onValue(productsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const productsList = Object.entries(data).map(([id, product]) => ({
          id,
          ...product
        }));
        setProducts(productsList);
      }
    });
  }, []);

  // Load selling products
  useEffect(() => {
    const sellingRef = ref(database, 'sellingProducts');
    onValue(sellingRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const sellingList = Object.entries(data).map(([id, product]) => ({
          id,
          ...product
        }));
        setSellingProducts(sellingList);
        setFilteredProducts(sellingList);
      } else {
        setSellingProducts([]);
        setFilteredProducts([]);
      }
    });
  }, []);

  // JOIN sellingProducts with products to get real-time inventory
  const enrichedSellingProducts = sellingProducts.map(sp => {
    const product = products.find(p => p.id === sp.productId);
    return {
      ...sp,
      inventory: product?.stock || 0, // Get inventory from products table
      realInventory: product?.stock || 0
    };
  });

  // Filter products
  useEffect(() => {
    let filtered = [...enrichedSellingProducts];

    if (searchText) {
      filtered = filtered.filter(p =>
        p.productName?.toLowerCase().includes(searchText.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    if (statusFilter !== 'all') {
      filtered = filtered.filter(p => p.status === statusFilter);
    }

    setFilteredProducts(filtered);
  }, [searchText, statusFilter, sellingProducts, products]);

  // Statistics
  const stats = {
    total: sellingProducts.length,
    active: sellingProducts.filter(p => p.status === 'active').length,
    inactive: sellingProducts.filter(p => p.status === 'inactive').length,
    avgPrice: sellingProducts.length > 0 
      ? sellingProducts.reduce((sum, p) => sum + (p.sellingPrice || 0), 0) / sellingProducts.length 
      : 0
  };

  const heroStyles = {
    card: {
      background: '#fff',
      padding: '18px 26px',
      borderRadius: 16,
      boxShadow: '0 10px 24px rgba(15, 157, 88, 0.12)',
      marginBottom: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      flexWrap: 'wrap',
      gap: 16
    },
    left: {
      display: 'flex',
      alignItems: 'center',
      gap: 16
    },
    icon: {
      width: 52,
      height: 52,
      borderRadius: '50%',
      background: '#e9f8ee',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#0f9d58',
      fontSize: 24
    },
    title: {
      margin: 0,
      color: '#0d7c39',
      fontWeight: 700,
      fontSize: 23,
      lineHeight: 1.2
    },
    subtitle: {
      margin: 4,
      color: '#5f6b65'
    },
    actions: {
      display: 'flex',
      gap: 12,
      flexWrap: 'wrap',
      justifyContent: 'flex-end'
    }
  };

  // Handle sync all products
  const handleSyncAll = () => {
    if (!canSyncAll) {
      message.error('Bạn không có quyền đồng bộ toàn bộ sản phẩm bán.');
      return;
    }
    // Tính số sản phẩm có thể đồng bộ
    const availableProducts = products.filter(p => 
      !sellingProducts.some(sp => sp.productId === p.id)
    );

    console.log('🔍 Checking sync...');
    console.log('Available products for sync:', availableProducts.length);
    console.log('Total products:', products.length);
    console.log('Current selling products:', sellingProducts.length);

    // Nếu không có sản phẩm nào để đồng bộ
    if (availableProducts.length === 0) {
      message.info('Tất cả sản phẩm đã được đồng bộ!');
      return;
    }

    // Set state và hiển thị modal
    setAvailableProductsToSync(availableProducts);
    setSyncModalVisible(true);
    console.log('✅ Sync modal opened');
  };

  // Confirm sync
  const handleConfirmSync = async () => {
    setSyncModalVisible(false);
    await syncAllProducts();
  };

  const syncAllProducts = async () => {
    setLoading(true);
    try {
      console.log('🔄 Starting sync...');
      console.log('Total products:', products.length);
      console.log('Current selling products:', sellingProducts.length);
      
      const availableProducts = products.filter(p => 
        !sellingProducts.some(sp => sp.productId === p.id)
      );

      console.log('Available products to sync:', availableProducts.length);

      if (availableProducts.length === 0) {
        message.info('Tất cả sản phẩm đã được đồng bộ!');
        setLoading(false);
        return;
      }

      console.log('Syncing products:', availableProducts.map(p => p.name));

      const sellingRef = ref(database, 'sellingProducts');
      let successCount = 0;
      
      for (const product of availableProducts) {
        try {
          const newRef = push(sellingRef);
          await set(newRef, {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            importPrice: product.price || 0,
            sellingPrice: 0,
            unit: product.unit || 'cái',
            purchaseCount: 0,
            status: 'inactive',
            productType: product.productType || 'dry',
            weight: product.weight || 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
          successCount++;
          console.log(`✅ Synced: ${product.name}`);
        } catch (error) {
          console.error(`❌ Failed to sync: ${product.name}`, error);
        }
      }

      if (successCount > 0) {
        message.success(`Đã đồng bộ ${successCount} sản phẩm!`);
      } else {
        message.error('Không thể đồng bộ sản phẩm nào!');
      }
    } catch (error) {
      console.error('Error syncing:', error);
      message.error('Lỗi đồng bộ: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle select products
  const handleSelectProducts = () => {
    if (!canSyncSelect) {
      message.error('Bạn không có quyền chọn sản phẩm để đồng bộ.');
      return;
    }
    const availableProducts = products.filter(p => 
      !sellingProducts.some(sp => sp.productId === p.id)
    );
    
    if (availableProducts.length === 0) {
      message.info('Không có sản phẩm nào để chọn!');
      return;
    }
    
    setSelectModalVisible(true);
  };

  // Handle create selected products
  const handleCreateSelected = async () => {
    if (!canSyncSelect) {
      message.error('Bạn không có quyền chọn sản phẩm để đồng bộ.');
      return;
    }
    if (selectedProductsForAdd.length === 0) {
      message.warning('Vui lòng chọn ít nhất 1 sản phẩm!');
      return;
    }

    setLoading(true);
    try {
      const sellingRef = ref(database, 'sellingProducts');
      for (const productId of selectedProductsForAdd) {
        const product = products.find(p => p.id === productId);
        if (product) {
          const newRef = push(sellingRef);
          await set(newRef, {
            productId: product.id,
            productName: product.name,
            sku: product.sku,
            importPrice: product.price || 0,
            sellingPrice: 0,
            unit: product.unit || 'cái',
            purchaseCount: 0,
            status: 'inactive',
            productType: product.productType || 'dry',
            weight: product.weight || 0,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          });
        }
      }

      message.success(`Đã thêm ${selectedProductsForAdd.length} sản phẩm!`);
      setSelectModalVisible(false);
      setSelectedProductsForAdd([]);
    } catch (error) {
      console.error('Error creating:', error);
      message.error('Lỗi thêm sản phẩm: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle edit price
  const handleEditPrice = (record) => {
    if (!canEditSellingProducts) {
      message.error('Bạn không có quyền chỉnh sửa sản phẩm bán.');
      return;
    }
    setEditingProduct(record);
    form.setFieldsValue({
      sellingPrice: record.sellingPrice,
      status: record.status || 'inactive',
      notes: record.notes || ''
    });
    setPriceModalVisible(true);
  };

  // Handle save price
  const handleSavePrice = async (values) => {
    try {
      if (!canEditSellingProducts) {
        message.error('Bạn không có quyền chỉnh sửa sản phẩm bán.');
        return;
      }
      const productRef = ref(database, `sellingProducts/${editingProduct.id}`);
      await update(productRef, {
        sellingPrice: values.sellingPrice,
        status: values.status,
        notes: values.notes,
        updatedAt: new Date().toISOString()
      });

      message.success('Đã cập nhật giá bán!');
      setPriceModalVisible(false);
      form.resetFields();
      setEditingProduct(null);
    } catch (error) {
      console.error('Error updating:', error);
      message.error('Lỗi cập nhật: ' + error.message);
    }
  };

  // Handle delete single product
  const handleDelete = (record) => {
    if (!canDeleteSellingSingle) {
      message.error('Bạn không có quyền xóa sản phẩm bán.');
      return;
    }
    console.log('🗑️ Opening delete modal for single product:', record.productName);
    setDeletingProduct(record);
    setDeleteSingleModalVisible(true);
  };

  // Confirm delete single product
  const handleConfirmDeleteSingle = async () => {
    setDeleteSingleModalVisible(false);
    setLoading(true);
    
    try {
      if (!canDeleteSellingSingle) {
        message.error('Bạn không có quyền xóa sản phẩm bán.');
        return;
      }
      console.log('🗑️ Deleting product:', deletingProduct.id);
      const productRef = ref(database, `sellingProducts/${deletingProduct.id}`);
      await remove(productRef);
      message.success(`Đã xóa sản phẩm "${deletingProduct.productName}"!`);
      console.log('✅ Product deleted successfully');
      setDeletingProduct(null);
    } catch (error) {
      console.error('❌ Error deleting:', error);
      message.error('Lỗi xóa: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle delete selected
  const handleDeleteSelected = () => {
    if (selectedRows.length === 0) {
      message.warning('Vui lòng chọn sản phẩm cần xóa!');
      return;
    }

    if (!canDeleteSellingBulk) {
      message.error('Bạn không có quyền xóa nhiều sản phẩm bán.');
      return;
    }

    console.log('🗑️ Opening delete modal for:', selectedRows.length, 'products');
    setDeleteModalVisible(true);
  };

  // Confirm delete selected
  const handleConfirmDelete = async () => {
    setDeleteModalVisible(false);
    setLoading(true);
    
    try {
      if (!canDeleteSellingBulk) {
        message.error('Bạn không có quyền xóa nhiều sản phẩm bán.');
        return;
      }
      console.log('🗑️ Deleting products:', selectedRows);
      let deletedCount = 0;
      
      for (const id of selectedRows) {
        try {
          const productRef = ref(database, `sellingProducts/${id}`);
          await remove(productRef);
          deletedCount++;
          console.log(`✅ Deleted: ${id}`);
        } catch (error) {
          console.error(`❌ Failed to delete: ${id}`, error);
        }
      }
      
      if (deletedCount > 0) {
        message.success(`Đã xóa ${deletedCount} sản phẩm!`);
      } else {
        message.error('Không thể xóa sản phẩm nào!');
      }
      
      setSelectedRows([]);
    } catch (error) {
      console.error('Error deleting:', error);
      message.error('Lỗi xóa: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle bulk update status
  const handleBulkUpdateStatus = async (newStatus) => {
    if (selectedRows.length === 0) {
      message.warning('Vui lòng chọn sản phẩm!');
      return;
    }

    if (!canActivate) {
      message.error('Bạn không có quyền kích hoạt / tạm dừng sản phẩm bán.');
      return;
    }

    const statusText = newStatus === 'active' ? 'Kích hoạt' : 'Tạm dừng';
    console.log(`🔄 Updating ${selectedRows.length} products to ${newStatus}`);
    
    setLoading(true);
    try {
      let updatedCount = 0;
      
      for (const id of selectedRows) {
        try {
          const productRef = ref(database, `sellingProducts/${id}`);
          await update(productRef, {
            status: newStatus,
            updatedAt: new Date().toISOString()
          });
          updatedCount++;
          console.log(`✅ Updated: ${id} to ${newStatus}`);
        } catch (error) {
          console.error(`❌ Failed to update: ${id}`, error);
        }
      }
      
      if (updatedCount > 0) {
        message.success(`Đã ${statusText.toLowerCase()} ${updatedCount} sản phẩm!`);
      } else {
        message.error('Không thể cập nhật sản phẩm nào!');
      }
      
      setSelectedRows([]);
    } catch (error) {
      console.error('Error updating status:', error);
      message.error('Lỗi cập nhật: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Handle inline edit price
  const handleInlineEdit = (record) => {
    if (!canEditSellingProducts) {
      message.error('Bạn không có quyền chỉnh sửa sản phẩm bán.');
      return;
    }
    setEditingKey(record.id);
    setEditingPrice(record.sellingPrice || 0);
  };

  // Save inline edit price
  const handleSaveInlinePrice = async (record) => {
    if (!canEditSellingProducts) {
      message.error('Bạn không có quyền chỉnh sửa sản phẩm bán.');
      return;
    }
    if (editingPrice === record.sellingPrice) {
      setEditingKey('');
      return;
    }

    if (editingPrice < 0) {
      message.warning('Giá bán phải lớn hơn 0!');
      return;
    }

    try {
      const productRef = ref(database, `sellingProducts/${record.id}`);
      await update(productRef, {
        sellingPrice: editingPrice,
        updatedAt: new Date().toISOString()
      });
      
      message.success(`Đã cập nhật giá bán: ${formatCurrency(editingPrice)}`);
      setEditingKey('');
      console.log(`💰 Updated price for ${record.productName}: ${editingPrice}`);
    } catch (error) {
      console.error('Error updating price:', error);
      message.error('Lỗi cập nhật giá: ' + error.message);
    }
  };

  // Cancel inline edit
  const handleCancelInlineEdit = () => {
    setEditingKey('');
    setEditingPrice(0);
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = filteredProducts.map((p, index) => ({
      'STT': index + 1,
      'Tên sản phẩm': p.productName,
      'SKU': p.sku,
      'Giá nhập': p.importPrice,
      'Giá bán': p.sellingPrice,
      'Lợi nhuận': p.sellingPrice - p.importPrice,
      '% Lợi nhuận': p.importPrice > 0 ? (((p.sellingPrice - p.importPrice) / p.importPrice) * 100).toFixed(2) + '%' : '0%',
      'Tồn kho': p.inventory,
      'Đơn vị': p.unit,
      'Lượt mua': p.purchaseCount || 0,
      'Trạng thái': p.status === 'active' ? 'Đang bán' : 'Tạm dừng'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sản phẩm bán');
    XLSX.writeFile(wb, `San_Pham_Ban_${new Date().toISOString().slice(0, 10)}.xlsx`);
    message.success('Đã xuất file Excel!');
  };

  // Calculate profit
  const calculateProfit = () => {
    const sellingPrice = form.getFieldValue('sellingPrice') || 0;
    const importPrice = editingProduct?.importPrice || 0;
    const profit = sellingPrice - importPrice;
    const profitPercent = importPrice > 0 ? ((profit / importPrice) * 100).toFixed(2) : 0;
    
    return { profit, profitPercent };
  };

  // Table columns
  const columns = [
    {
      title: 'STT',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_, __, index) => index + 1
    },
    {
      title: 'Tên sản phẩm',
      dataIndex: 'productName',
      key: 'productName',
      width: 250,
      ellipsis: true
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120
    },
    {
      title: 'Giá nhập',
      dataIndex: 'importPrice',
      key: 'importPrice',
      width: 120,
      align: 'right',
      render: (price) => formatCurrency(price)
    },
    {
      title: 'Giá bán',
      dataIndex: 'sellingPrice',
      key: 'sellingPrice',
      width: 180,
      align: 'right',
      render: (price, record) => {
        const isEditing = editingKey === record.id;
        
        return isEditing ? (
          <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
            <InputNumber
              value={editingPrice}
              onChange={setEditingPrice}
              onPressEnter={() => handleSaveInlinePrice(record)}
              onBlur={() => handleSaveInlinePrice(record)}
              onKeyDown={(e) => {
                if (e.key === 'Escape') {
                  handleCancelInlineEdit();
                }
              }}
              formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
              parser={value => value.replace(/\$\s?|(,*)/g, '')}
              style={{ width: '100%' }}
              autoFocus
              min={0}
              placeholder="Nhập giá bán..."
            />
          </div>
        ) : (
          <div 
            onClick={() => handleInlineEdit(record)}
            style={{ 
              cursor: 'pointer',
              padding: '6px 12px',
              borderRadius: '6px',
              transition: 'all 0.3s',
              fontWeight: 600,
              color: price > 0 ? '#52c41a' : '#999',
              border: '1px dashed #d9d9d9',
              background: price === 0 ? '#fafafa' : 'transparent',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#f0f9ff';
              e.currentTarget.style.border = '1px dashed #1890ff';
              const icon = e.currentTarget.querySelector('.edit-icon');
              if (icon) icon.style.opacity = '1';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = price === 0 ? '#fafafa' : 'transparent';
              e.currentTarget.style.border = '1px dashed #d9d9d9';
              const icon = e.currentTarget.querySelector('.edit-icon');
              if (icon) icon.style.opacity = '0.3';
            }}
            title="💰 Click để nhập giá bán"
          >
            <span style={{ flex: 1, textAlign: 'right' }}>
              {price === 0 ? 'Nhập giá...' : formatCurrency(price)}
            </span>
            <EditOutlined 
              className="edit-icon"
              style={{ 
                fontSize: '12px', 
                color: '#1890ff',
                opacity: '0.3',
                transition: 'opacity 0.3s'
              }} 
            />
          </div>
        );
      }
    },
    {
      title: 'Tồn kho',
      dataIndex: 'inventory',
      key: 'inventory',
      width: 100,
      align: 'center'
    },
    {
      title: 'Đơn vị',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
      align: 'center'
    },
    {
      title: 'Lượt mua',
      dataIndex: 'purchaseCount',
      key: 'purchaseCount',
      width: 100,
      align: 'center',
      render: (count) => count || 0
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center',
      render: (status) => (
        <Tag color={status === 'active' ? 'success' : 'default'}>
          {status === 'active' ? '✅ Đang bán' : '⏸️ Tạm dừng'}
        </Tag>
      )
    },
    {
      title: 'Thao tác',
      key: 'action',
      width: 150,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
          <Button
            type="primary"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEditPrice(record)}
          />
          <Button
            danger
            icon={<DeleteOutlined />}
            size="small"
            onClick={() => handleDelete(record)}
          />
        </div>
      )
    }
  ];

  // Available products for selection
  const availableProducts = products.filter(p => 
    !sellingProducts.some(sp => sp.productId === p.id)
  );

  const selectColumns = [
    {
      title: 'STT',
      key: 'index',
      width: 60,
      align: 'center',
      render: (_, __, index) => index + 1
    },
    {
      title: 'Tên sản phẩm',
      dataIndex: 'name',
      key: 'name',
      width: 300
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120
    },
    {
      title: 'Đơn vị',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
      align: 'center'
    },
    {
      title: 'Tồn kho',
      dataIndex: 'stock',
      key: 'stock',
      width: 100,
      align: 'center'
    },
    {
      title: 'Giá nhập',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      align: 'right',
      render: (price) => formatCurrency(price)
    },
    {
      title: 'Trạng thái',
      dataIndex: 'status',
      key: 'status',
      width: 120,
      align: 'center',
      render: (status) => (
        <Tag color={status === 'active' ? 'success' : 'default'}>
          {status === 'active' ? 'Active' : 'Inactive'}
        </Tag>
      )
    }
  ];

  if (!canViewSellingProducts) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Quản Lý Sản Phẩm Bán. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="selling-products-page">
      <Spin spinning={loading}>
        {/* Page Header */}
        <div style={heroStyles.card}>
          <div style={heroStyles.left}>
            <div style={heroStyles.icon}>
              <MoneyCollectOutlined />
            </div>
            <div>
              <h1 style={heroStyles.title}>Quản Lý Sản Phẩm Bán</h1>
              <p style={heroStyles.subtitle}>Đồng bộ sản phẩm và quản lý giá bán trên các kênh</p>
            </div>
          </div>
          <div style={heroStyles.actions}>
            <Button icon={<PlusOutlined />} onClick={handleSelectProducts}>
              Chọn Sản Phẩm Lẻ
            </Button>
            <Button icon={<SyncOutlined />} onClick={handleSyncAll}>
              Đồng Bộ Toàn Bộ
            </Button>
            <Button
              icon={<FileExcelOutlined />}
              onClick={handleExportExcel}
              style={{ background: '#52c41a', borderColor: '#52c41a', color: 'white' }}
            >
              Xuất Excel
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <Row gutter={16} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card>
              <Statistic
                title="Tổng Sản Phẩm"
                value={stats.total}
                prefix={<BoxPlotOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Đang Bán"
                value={stats.active}
                prefix={<CheckCircleOutlined />}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Tạm Dừng"
                value={stats.inactive}
                prefix={<PauseCircleOutlined />}
                valueStyle={{ color: '#fa8c16' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="Giá Bán Trung Bình"
                value={stats.avgPrice}
                prefix={<TagsOutlined />}
                formatter={(value) => formatCurrency(value)}
                valueStyle={{ color: '#722ed1' }}
              />
            </Card>
          </Col>
        </Row>

        {/* Selling Products Table */}
        <Card
          title={<span><BoxPlotOutlined /> Danh Sách Sản Phẩm Bán</span>}
          extra={
            <div style={{ display: 'flex', gap: '12px' }}>
              <Input
                placeholder="Tìm kiếm sản phẩm..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 250 }}
              />
              <Select
                value={statusFilter}
                onChange={setStatusFilter}
                style={{ width: 150 }}
              >
                <Option value="all">Tất cả trạng thái</Option>
                <Option value="active">Đang bán</Option>
                <Option value="inactive">Tạm dừng</Option>
              </Select>
            </div>
          }
        >
          {selectedRows.length > 0 && (
            <div style={{ 
              marginBottom: 16, 
              padding: '16px', 
              background: '#f0f9ff', 
              borderRadius: '8px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <span style={{ fontSize: '15px', fontWeight: 500 }}>
                Đã chọn: <strong style={{ color: '#1890ff', fontSize: '16px' }}>{selectedRows.length}</strong> sản phẩm
              </span>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button 
                  type="primary"
                  style={{ background: '#52c41a', borderColor: '#52c41a' }}
                  onClick={() => handleBulkUpdateStatus('active')}
                  icon={<CheckCircleOutlined />}
                >
                  Kích hoạt
                </Button>
                <Button 
                  style={{ 
                    background: '#fa8c16', 
                    borderColor: '#fa8c16', 
                    color: 'white' 
                  }}
                  onClick={() => handleBulkUpdateStatus('inactive')}
                  icon={<PauseCircleOutlined />}
                >
                  Tạm dừng
                </Button>
                <Button 
                  danger 
                  onClick={handleDeleteSelected}
                  icon={<DeleteOutlined />}
                >
                  Xóa đã chọn
                </Button>
              </div>
            </div>
          )}

          <Table
            rowSelection={{
              selectedRowKeys: selectedRows,
              onChange: setSelectedRows
            }}
            columns={columns}
            dataSource={filteredProducts.map(p => ({ ...p, key: p.id }))}
            pagination={{ 
              defaultPageSize: 10,
              showSizeChanger: true, 
              showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} sản phẩm`,
              pageSizeOptions: ['10', '20', '50', '100'],
              showQuickJumper: true
            }}
            scroll={{ x: 1400 }}
          />
        </Card>

        {/* Select Products Modal */}
        <Modal
          title={<span><SearchOutlined /> Chọn Sản Phẩm Để Thiết Lập Giá Bán</span>}
          open={selectModalVisible}
          onCancel={() => {
            setSelectModalVisible(false);
            setSelectedProductsForAdd([]);
          }}
          width={1200}
          footer={[
            <Button key="cancel" onClick={() => setSelectModalVisible(false)}>
              Hủy
            </Button>,
            <Button
              key="submit"
              type="primary"
              onClick={handleCreateSelected}
              disabled={selectedProductsForAdd.length === 0}
            >
              Lưu ({selectedProductsForAdd.length} sản phẩm)
            </Button>
          ]}
        >
          <Table
            rowSelection={{
              selectedRowKeys: selectedProductsForAdd,
              onChange: setSelectedProductsForAdd
            }}
            columns={selectColumns}
            dataSource={availableProducts.map(p => ({ ...p, key: p.id }))}
            pagination={{ 
              defaultPageSize: 10,
              showSizeChanger: true,
              showTotal: (total, range) => `${range[0]}-${range[1]} của ${total} sản phẩm`,
              pageSizeOptions: ['10', '20', '50', '100']
            }}
            scroll={{ y: 400 }}
          />
        </Modal>

        {/* Price Edit Modal */}
        <Modal
          title={<span><MoneyCollectOutlined /> Thiết Lập Giá Bán</span>}
          open={priceModalVisible}
          onCancel={() => {
            setPriceModalVisible(false);
            form.resetFields();
            setEditingProduct(null);
          }}
          footer={null}
          width={600}
        >
          {editingProduct && (
            <Form
              form={form}
              layout="vertical"
              onFinish={handleSavePrice}
            >
              <div style={{ background: '#f5f5f5', padding: '16px', borderRadius: '8px', marginBottom: '24px' }}>
                <div style={{ marginBottom: '8px' }}>
                  <strong>Tên sản phẩm:</strong> {editingProduct.productName}
                </div>
                <div style={{ marginBottom: '8px' }}>
                  <strong>SKU:</strong> {editingProduct.sku}
                </div>
                <div>
                  <strong>Giá nhập:</strong> <span style={{ color: '#1890ff', fontWeight: 600 }}>{formatCurrency(editingProduct.importPrice)}</span>
                </div>
              </div>

              <Form.Item
                label="Giá Bán (VNĐ)"
                name="sellingPrice"
                rules={[{ required: true, message: 'Vui lòng nhập giá bán!' }]}
              >
                <InputNumber
                  style={{ width: '100%' }}
                  min={0}
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/\$\s?|(,*)/g, '')}
                  onChange={() => form.validateFields()}
                />
              </Form.Item>

              <div style={{ 
                background: '#e6f7ff', 
                padding: '16px', 
                borderRadius: '8px', 
                marginBottom: '16px' 
              }}>
                {(() => {
                  const { profit, profitPercent } = calculateProfit();
                  const profitColor = profit > 0 ? '#52c41a' : profit < 0 ? '#ff4d4f' : '#999';
                  return (
                    <>
                      <div style={{ marginBottom: '8px' }}>
                        <strong>Lợi nhuận:</strong> 
                        <span style={{ marginLeft: '8px', fontSize: '16px', fontWeight: 600, color: profitColor }}>
                          {formatCurrency(profit)}
                        </span>
                      </div>
                      <div>
                        <strong>% Lợi nhuận:</strong> 
                        <span style={{ marginLeft: '8px', fontSize: '16px', fontWeight: 600, color: profitColor }}>
                          {profitPercent}%
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>

              <Form.Item
                label="Trạng Thái"
                name="status"
              >
                <Select>
                  <Option value="active">Đang hoạt động</Option>
                  <Option value="inactive">Tạm dừng</Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="Ghi Chú"
                name="notes"
              >
                <TextArea rows={3} placeholder="Ghi chú về sản phẩm..." />
              </Form.Item>

              <Form.Item>
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                  <Button onClick={() => setPriceModalVisible(false)}>
                    Hủy
                  </Button>
                  <Button type="primary" htmlType="submit">
                    Lưu
                  </Button>
                </div>
              </Form.Item>
            </Form>
          )}
        </Modal>

        {/* Delete Single Product Modal */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DeleteOutlined style={{ color: '#ff4d4f' }} />
              <span>Xác nhận xóa sản phẩm</span>
            </div>
          }
          open={deleteSingleModalVisible}
          onCancel={() => {
            setDeleteSingleModalVisible(false);
            setDeletingProduct(null);
            console.log('❌ User cancelled delete single');
          }}
          width={500}
          centered
          footer={[
            <Button 
              key="cancel" 
              size="large"
              onClick={() => {
                setDeleteSingleModalVisible(false);
                setDeletingProduct(null);
              }}
            >
              Hủy
            </Button>,
            <Button
              key="submit"
              danger
              type="primary"
              size="large"
              onClick={handleConfirmDeleteSingle}
            >
              <DeleteOutlined /> Xóa sản phẩm
            </Button>
          ]}
        >
          {deletingProduct && (
            <div style={{ padding: '16px 0' }}>
              <p style={{ fontSize: '16px', marginBottom: '16px' }}>
                Bạn có chắc chắn muốn xóa sản phẩm này?
              </p>
              <div style={{ 
                padding: '12px 16px', 
                background: '#f5f5f5', 
                borderRadius: '8px',
                marginBottom: '16px'
              }}>
                <div style={{ fontWeight: 600, fontSize: '15px', marginBottom: '4px' }}>
                  {deletingProduct.productName}
                </div>
                <div style={{ color: '#666', fontSize: '13px' }}>
                  SKU: {deletingProduct.sku}
                </div>
              </div>
              <div style={{ 
                padding: '12px 16px', 
                background: '#fff2e8', 
                borderRadius: '8px',
                border: '1px solid #ffbb96'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fa8c16' }}>
                  <span style={{ fontSize: '20px' }}>⚠️</span>
                  <span style={{ fontWeight: 500 }}>
                    Hành động này không thể hoàn tác!
                  </span>
                </div>
              </div>
            </div>
          )}
        </Modal>

        {/* Delete Multiple Products Modal */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <DeleteOutlined style={{ color: '#ff4d4f' }} />
              <span>Xác nhận xóa nhiều sản phẩm</span>
            </div>
          }
          open={deleteModalVisible}
          onCancel={() => {
            setDeleteModalVisible(false);
            console.log('❌ User cancelled delete');
          }}
          width={500}
          centered
          footer={[
            <Button 
              key="cancel" 
              size="large"
              onClick={() => {
                setDeleteModalVisible(false);
                console.log('❌ User cancelled delete');
              }}
            >
              Hủy
            </Button>,
            <Button
              key="submit"
              danger
              type="primary"
              size="large"
              onClick={handleConfirmDelete}
            >
              <DeleteOutlined /> Xóa {selectedRows.length} sản phẩm
            </Button>
          ]}
        >
          <div style={{ padding: '16px 0' }}>
            <p style={{ fontSize: '16px', marginBottom: '16px' }}>
              Bạn có chắc chắn muốn xóa <strong style={{ color: '#ff4d4f', fontSize: '18px' }}>{selectedRows.length}</strong> sản phẩm đã chọn?
            </p>
            <div style={{ 
              padding: '12px 16px', 
              background: '#fff2e8', 
              borderRadius: '8px',
              border: '1px solid #ffbb96'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#fa8c16' }}>
                <span style={{ fontSize: '20px' }}>⚠️</span>
                <span style={{ fontWeight: 500 }}>
                  Hành động này không thể hoàn tác!
                </span>
              </div>
            </div>
          </div>
        </Modal>

        {/* Sync Confirmation Modal */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <SyncOutlined style={{ color: '#1890ff' }} />
              <span>Xác nhận đồng bộ</span>
            </div>
          }
          open={syncModalVisible}
          onCancel={() => {
            setSyncModalVisible(false);
            console.log('❌ User cancelled sync');
          }}
          width={600}
          centered
          footer={[
            <Button 
              key="cancel" 
              size="large"
              onClick={() => {
                setSyncModalVisible(false);
                console.log('❌ User cancelled sync');
              }}
            >
              ❌ Hủy
            </Button>,
            <Button
              key="submit"
              type="primary"
              size="large"
              style={{ 
                background: '#52c41a', 
                borderColor: '#52c41a',
                fontWeight: 600
              }}
              onClick={handleConfirmSync}
            >
              ✅ Đồng bộ {availableProductsToSync.length} sản phẩm
            </Button>
          ]}
        >
          <div>
            <p style={{ fontSize: '16px', marginBottom: '12px' }}>
              Hệ thống tìm thấy <strong style={{ color: '#1890ff', fontSize: '20px' }}>{availableProductsToSync.length}</strong> sản phẩm 
              chưa có trong danh sách bán.
            </p>
            <p style={{ color: '#666', marginBottom: '16px' }}>
              Bạn có muốn đồng bộ tất cả những sản phẩm này không?
            </p>
            
            <div style={{ 
              marginTop: '16px', 
              padding: '16px', 
              background: '#f0f9ff', 
              borderRadius: '8px',
              maxHeight: '300px',
              overflowY: 'auto',
              border: '1px solid #91d5ff'
            }}>
              <div style={{ 
                fontWeight: 600, 
                marginBottom: '12px', 
                color: '#1890ff',
                fontSize: '15px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                📋 Danh sách sản phẩm sẽ được đồng bộ:
              </div>
              {availableProductsToSync.slice(0, 10).map((p, index) => (
                <div 
                  key={p.id} 
                  style={{ 
                    padding: '8px 12px', 
                    fontSize: '14px',
                    background: 'white',
                    marginBottom: '4px',
                    borderRadius: '4px',
                    border: '1px solid #e6f7ff'
                  }}
                >
                  <span style={{ fontWeight: 600, color: '#1890ff', marginRight: '8px' }}>
                    {index + 1}.
                  </span>
                  {p.name}
                  <span style={{ color: '#999', marginLeft: '8px', fontSize: '12px' }}>
                    ({p.sku})
                  </span>
                </div>
              ))}
              {availableProductsToSync.length > 10 && (
                <div style={{ 
                  padding: '8px 12px', 
                  color: '#999', 
                  fontStyle: 'italic',
                  textAlign: 'center',
                  background: 'white',
                  borderRadius: '4px',
                  marginTop: '8px'
                }}>
                  ... và {availableProductsToSync.length - 10} sản phẩm khác
                </div>
              )}
            </div>
          </div>
        </Modal>
      </Spin>
    </div>
  );
};

export default SellingProducts;
