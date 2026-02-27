import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../../services/firebase.service';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';
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
  Modal,
  Tooltip
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
  const { user, isAdmin } = useAuth();
  const userPermissions = user?.permissions || [];
  const hasPermission = isAdmin || userPermissions.includes('orders.manage.ecommerce.view');
  const canViewDetail = isAdmin || userPermissions.includes('orders.manage.ecommerce.detail');
  const canDeleteSingle = isAdmin || userPermissions.includes('orders.manage.ecommerce.delete.single');
  const canDeleteBulk = isAdmin || userPermissions.includes('orders.manage.ecommerce.delete.bulk');
  const canDeleteAll = isAdmin || userPermissions.includes('orders.manage.ecommerce.delete.all');
  const canExportExcel = isAdmin || userPermissions.includes('orders.manage.ecommerce.export');
  const canPrint = isAdmin || userPermissions.includes('orders.manage.ecommerce.print');

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Quản Lý Đơn Hàng TMĐT. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  // States
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [storeFilter, setStoreFilter] = useState('current'); // 'current', 'all', or storeId
  const [dateRange, setDateRange] = useState([null, null]);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState(null);

  useEffect(() => {
    const styleTag = document.createElement('style');
    styleTag.id = 'manage-orders-tmdt-layout-style';
    styleTag.innerHTML = `
      .manage-orders-tmdt-layout :where(.css-dev-only-do-not-override-11mmrso).ant-btn {
        font-size: 12px !important;
        height: 32px !important;
        padding: 0 15px !important;
        border-radius: 6px !important;
      }
    `;
    document.head.appendChild(styleTag);
    const layoutContent = document.querySelector('.ant-layout-content');
    layoutContent?.classList.add('manage-orders-tmdt-layout');

    return () => {
      document.head.removeChild(styleTag);
      layoutContent?.classList.remove('manage-orders-tmdt-layout');
    };
  }, []);

  const navButtonStyle = {
    fontSize: 12,
    fontWeight: 600,
    height: 32,
    borderRadius: 6,
    padding: '0 15px'
  };

  // Load products and categories
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  
  // Load all categories
  
  useEffect(() => {
    const categoriesRef = ref(database, 'categories');
    const unsubscribe = onValue(categoriesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const categoriesList = Object.entries(data).map(([id, cat]) => ({
          id,
          ...cat
        }));
        setCategories(categoriesList);
      }
    });
    
    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
    };
  }, []);
  
  // Load all products
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
  
  // Function to get category name by ID
  const getCategoryName = (categoryId) => {
    if (!categoryId) return 'Chưa phân loại';
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Chưa phân loại';
  };

  // State for pagination
  const [tablePagination, setTablePagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total) => `Tổng ${total} đơn hàng`,
    onChange: (page, pageSize) => {
      setTablePagination(prev => ({
        ...prev,
        current: page,
        pageSize
      }));
    }
  });

  // Xử lý dữ liệu đơn hàng
  const processOrdersData = (data, productsList = [], categoriesList = []) => {
    if (!data) {
      console.log('❌ Không có dữ liệu để xử lý');
      return [];
    }

    console.log('🔍 Đang xử lý dữ liệu đơn hàng...');
    console.log('📦 Số sản phẩm:', productsList?.length);
    console.log('🏷️ Số danh mục:', categoriesList?.length);

    try {
      const result = [];
      const orderEntries = Object.entries(data);
      
      for (const [id, order] of orderEntries) {
        try {
          // Kiểm tra xem có phải đơn TMĐT không
          const isEcommerce = 
            order.orderType === 'ecommerce' || 
            order.platform || 
            order.source === 'ecommerce' || 
            order.source === 'tmdt' ||
            order.source === 'tmdt_sales' ||
            (order.orderId && (order.orderId.includes('TMDT') || order.orderId.includes('SHOP') || order.orderId.includes('LAZ') || order.orderId.includes('TIKI')));
          
          if (!isEcommerce) continue;
          
          // Kiểm tra items
          if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
            console.log(`⚠️ Đơn hàng ${id} không có sản phẩm`);
            continue;
          }
          
          // Xử lý từng sản phẩm trong đơn
          const itemsWithCategories = [];
          for (const item of order.items) {
            try {
              const product = productsList.find(p => 
                p && (p.id === item.productId || p.sku === item.sku || p.name === item.productName)
              );
              
              itemsWithCategories.push({
                ...item,
                categoryName: product ? getCategoryName(product.categoryId) : 'Chưa phân loại',
                productName: item.productName || product?.name || 'Không rõ',
                sku: item.sku || product?.sku || 'Không có SKU',
                price: parseFloat(item.sellingPrice || item.price) || 0,
                costPrice: parseFloat(product?.costPrice || product?.cost || item.costPrice || item.cost || 0),
                quantity: parseInt(item.quantity) || 1,
                unit: item.unit || 'cái',
                // Thêm thông tin sản phẩm đầy đủ để debug
                _productData: product ? {
                  hasCost: !!product.costPrice || !!product.cost,
                  costPrice: product.costPrice,
                  cost: product.cost
                } : null
              });
            } catch (itemError) {
              console.error(`❌ Lỗi xử lý sản phẩm trong đơn ${id}:`, itemError);
              // Vẫn thêm sản phẩm với thông tin cơ bản nếu có lỗi
              itemsWithCategories.push({
                ...item,
                categoryName: 'Lỗi xử lý',
                productName: item.productName || 'Không rõ',
                sku: item.sku || 'Không có SKU',
                price: parseFloat(item.sellingPrice || item.price) || 0,
                costPrice: parseFloat(item.costPrice || item.cost || 0),
                quantity: parseInt(item.quantity) || 1,
                unit: item.unit || 'cái',
                _error: 'Lỗi xử lý sản phẩm',
                _itemData: item
              });
            }
          }
          
          // Tính tổng tiền và lợi nhuận từ các sản phẩm trong đơn hàng
          let totalAmount = 0;
          let totalProfit = 0;
          
          itemsWithCategories.forEach(item => {
            const itemPrice = parseFloat(item.sellingPrice || item.price || 0);
            const itemQuantity = parseInt(item.quantity || 0);
            
            // Debug log for cost data
            console.log('Product cost data:', {
              itemId: item.id,
              itemName: item.productName,
              sellingPrice: itemPrice,
              costPrice: item.costPrice,
              cost: item.cost,
              quantity: itemQuantity,
              productData: item._productData
            });
            
            // Get cost price from various possible locations
            const itemCost = parseFloat(
              item.costPrice || 
              item.cost || 
              (item._productData ? (item._productData.costPrice || item._productData.cost) : 0) || 
              0
            );
            
            // Log warning if cost is 0 or not set
            if (itemCost === 0) {
              console.warn('⚠️ Cost price is 0 for item:', {
                id: item.id,
                name: item.productName,
                sku: item.sku,
                sellingPrice: itemPrice
              });
            }
            
            const itemSubtotal = itemPrice * itemQuantity;
            const itemProfit = (itemPrice - itemCost) * itemQuantity;
            
            totalAmount += itemSubtotal;
            totalProfit += itemProfit;
            
            // Cập nhật lợi nhuận cho từng sản phẩm
            item.profit = itemProfit;
            item.subtotal = itemSubtotal;
            item._debug = {
              price: itemPrice,
              cost: itemCost,
              quantity: itemQuantity,
              profit: itemProfit,
              subtotal: itemSubtotal
            };
          });
          
          // Tạo đối tượng đơn hàng đã xử lý
          const processedOrder = {
            ...order,
            id,
            key: id,
            itemCount: itemsWithCategories.length,
            items: itemsWithCategories,
            orderDate: order.orderDate || order.createdAt || new Date().toISOString(),
            totalAmount: totalAmount,
            subtotal: totalAmount, // Đảm bảo có trường subtotal cho cột tổng tiền
            profit: totalProfit,   // Tổng lợi nhuận của đơn hàng
            platform: order.platform || order.source || 'Khác',
            storeName: order.storeName || order.store || 'Chưa xác định',
            status: order.status || 'completed',
            paymentStatus: order.paymentStatus || 'paid',
            // Cập nhật lại giá bán và số lượng tổng cho đơn hàng
            sellingPrice: itemsWithCategories.length > 0 ? itemsWithCategories[0].sellingPrice : 0,
            quantity: itemsWithCategories.reduce((sum, item) => sum + (parseInt(item.quantity) || 0), 0)
          };
          
          result.push(processedOrder);
          
        } catch (orderError) {
          console.error(`❌ Lỗi xử lý đơn hàng ${id}:`, orderError);
          // Vẫn tiếp tục xử lý các đơn khác nếu có lỗi
        }
      }
      
      console.log(`✅ Đã xử lý thành công ${result.length} đơn hàng TMĐT`);
      return result;
      
    } catch (error) {
      console.error('❌ Lỗi nghiêm trọng khi xử lý dữ liệu:', error);
      return [];
    }
  };

  // Load orders from Firebase
  useEffect(() => {
    console.log('🔄 [1/3] Bắt đầu tải đơn hàng từ Firebase...');
    setLoading(true);
    
    const ordersRef = ref(database, 'salesOrders');
    console.log('� Đường dẫn Firebase:', ordersRef.toString());
    
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      console.log('✅ [2/3] Đã nhận dữ liệu từ Firebase');
      
      if (!snapshot.exists()) {
        console.warn('⚠️ Không tìm thấy dữ liệu đơn hàng trong salesOrders');
        message.warning('Không tìm thấy dữ liệu đơn hàng');
        setOrders([]);
        setFilteredOrders([]);
        setLoading(false);
        return;
      }
      
      const data = snapshot.val();
      console.log(`📊 Tổng số đơn hàng: ${Object.keys(data || {}).length}`);
      
      if (!data || Object.keys(data).length === 0) {
        console.warn('⚠️ Dữ liệu đơn hàng trống');
        message.warning('Không có dữ liệu đơn hàng');
        setOrders([]);
        setFilteredOrders([]);
        setLoading(false);
        return;
      }
      
      try {
        // Log sample of raw data
        const firstOrderKey = Object.keys(data)[0];
        console.log('🔍 Mẫu dữ liệu thô:', {
          id: firstOrderKey,
          ...data[firstOrderKey]
        });
        
        // Process the data with products and categories
        console.log('🔄 Đang xử lý dữ liệu...');
        const processedData = processOrdersData(data, products, categories);
        console.log(`✅ Đã xử lý ${processedData.length} đơn hàng TMĐT`);
        
        if (processedData.length === 0) {
          console.warn('⚠️ Không tìm thấy đơn hàng TMĐT nào phù hợp');
          message.warning('Không tìm thấy đơn hàng TMĐT nào');
        }
        
        // Update state with the processed data
        setTablePagination(prev => ({
          ...prev,
          total: processedData.length,
          current: 1 // Reset về trang đầu tiên
        }));
        
        setOrders(processedData);
        setFilteredOrders(processedData);
        
        // Log first order for debugging
        if (processedData.length > 0) {
          console.log('� Mẫu đơn hàng đã xử lý:', {
            id: processedData[0].id,
            items: processedData[0].items?.length,
            total: processedData[0].totalAmount,
            date: processedData[0].orderDate,
            platform: processedData[0].platform
          });
        }
        
      } catch (error) {
        console.error('❌ Lỗi khi xử lý dữ liệu:', error);
        message.error('Lỗi khi xử lý dữ liệu: ' + (error.message || 'Lỗi không xác định'));
      } finally {
        setLoading(false);
      }
      
    }, (error) => {
      console.error('❌ Lỗi khi tải dữ liệu:', error);
      message.error('Không thể tải dữ liệu đơn hàng: ' + (error.message || 'Lỗi kết nối'));
      setLoading(false);
    });
    
    return () => {
      try {
        console.log('🧹 Dọn dẹp kết nối...');
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      } catch (error) {
        console.error('❌ Lỗi khi đóng kết nối:', error);
      }
    };
  }, [products, categories]);

  // Apply filters
  useEffect(() => {
    let filtered = [...orders];
    
    console.log('🔍 Applying filters:', {
      storeFilter,
      selectedStore: selectedStore?.name,
      searchText,
      dateRange: dateRange?.map(d => d?.format('DD/MM/YYYY')),
      platformFilter
    });

    // Store filter
    if (storeFilter === 'current' && selectedStore && selectedStore.id !== 'all') {
      filtered = filtered.filter(order => 
        order.storeName?.toLowerCase() === selectedStore.name?.toLowerCase() ||
        order.store?.toLowerCase() === selectedStore.name?.toLowerCase()
      );
      console.log(`🛍️ Filtered by current store (${selectedStore.name}):`, filtered.length);
    } else if (storeFilter !== 'all' && storeFilter !== 'current') {
      const store = stores.find(s => s.id === storeFilter);
      if (store) {
        filtered = filtered.filter(order => 
          order.storeName?.toLowerCase() === store.name?.toLowerCase() ||
          order.store?.toLowerCase() === store.name?.toLowerCase()
        );
        console.log(`🏪 Filtered by store ${store.name}:`, filtered.length);
      }
    }

    // Search filter
    if (searchText) {
      const search = searchText.toLowerCase();
      filtered = filtered.filter(order =>
        (order.productName?.toLowerCase().includes(search)) ||
        (order.sku?.toLowerCase().includes(search)) ||
        (order.orderId?.toLowerCase().includes(search)) ||
        (order.id?.toLowerCase().includes(search)) ||
        (order.items?.some(item => 
          item.productName?.toLowerCase().includes(search) ||
          item.sku?.toLowerCase().includes(search)
        ))
      );
      console.log('🔍 After search filter:', filtered.length);
    }

    // Date range filter
    if (dateRange[0] && dateRange[1]) {
      filtered = filtered.filter(order => {
        try {
          const orderDate = dayjs(order.orderDate || order.createdAt);
          return orderDate.isAfter(dateRange[0].startOf('day')) && 
                 orderDate.isBefore(dateRange[1].endOf('day'));
        } catch (error) {
          console.error('Error processing order date:', order.orderDate, error);
          return false;
        }
      });
      console.log('📅 After date filter:', filtered.length);
    }

    // Platform filter
    if (platformFilter !== 'all') {
      filtered = filtered.filter(order => 
        order.platform?.toLowerCase() === platformFilter.toLowerCase() ||
        order.source?.toLowerCase() === platformFilter.toLowerCase()
      );
      console.log('🛒 After platform filter:', filtered.length);
    }

    // Category filter
    if (categoryFilter && categoryFilter !== 'all') {
      console.log('🔍 Filtering by category:', categoryFilter);
      filtered = filtered.filter(order => {
        const hasMatchingCategory = order.items?.some(item => {
          console.log('Item category:', item.categoryName, 'Looking for:', categoryFilter);
          return item.categoryName === categoryFilter || 
                 (categoryFilter === 'Chưa phân loại' && !item.categoryName);
        });
        return hasMatchingCategory;
      });
      console.log('📦 After category filter:', filtered.length, 'orders found');
    }

    // Update filtered orders and pagination
    setFilteredOrders(filtered);
    
    // Update pagination total and reset to first page
    setTablePagination(prev => ({
      ...prev,
      total: filtered.length,
      current: 1 // Reset to first page when filters change
    }));
    
    console.log('✅ Applied all filters. Total filtered orders:', filtered.length);
  }, [searchText, dateRange, platformFilter, categoryFilter, storeFilter, orders, selectedStore, stores]);
  
  // Handle pagination changes
  const handleTableChange = (pagination, filters, sorter) => {
    setTablePagination(prev => ({
      ...prev,
      current: pagination.current,
      pageSize: pagination.pageSize
    }));
  };

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
    setCategoryFilter('all');
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

    if (!canPrint) {
      message.error('Bạn không có quyền in hóa đơn.');
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

    if (!canPrint) {
      message.error('Bạn không có quyền in hóa đơn.');
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
    if (!canExportExcel) {
      message.error('Bạn không có quyền xuất file Excel.');
      return;
    }
    const exportData = filteredOrders.map((order, index) => ({
      'STT': index + 1,
      'Mã Đơn': order.orderId,
      'Sản Phẩm': order.productName,
      'SKU': order.sku,
      'Sàn TMĐT': getPlatformName(order.platform),
      'Ngày Đặt': order.orderDate,
      'Số Lượng': order.quantity,
      'Đơn Vị': order.unit || 'Lỗi',
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

  // Tạo dữ liệu đã xử lý cho bảng
  const processedOrders = React.useMemo(() => {
    if (!orders || !Array.isArray(orders)) return []; 
    return orders.map(order => {
      // Xử lý dữ liệu cho mỗi đơn hàng
      const processedOrder = { ...order };    
      // Đảm bảo items là mảng
      if (!Array.isArray(processedOrder.items)) {
        processedOrder.items = [];
      }
      // Thêm thông tin category cho từng sản phẩm
      processedOrder.items = processedOrder.items.map(item => {
        const product = products.find(p => p && (p.id === item.productId || p.sku === item.sku));
        return {
          ...item,
          categoryName: getCategoryName(product?.categoryId)
        };
      });
      
      return processedOrder;
    });
  }, [orders, products]);

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
      render: (_, record) => {
        if (!record.items || !Array.isArray(record.items)) return 'N/A';
        
        if (record.items.length > 1) {
          return (
            <div>
              <div style={{ fontWeight: 600 }}>{record.items.length} sản phẩm</div>
              <div style={{ fontSize: 12, color: '#666' }}>
                {record.items.map((item, index) => (
                  <div key={index} style={{ marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.productName || 'N/A'}
                  </div>
                ))}
              </div>
            </div>
          );
        }
        return record.items[0]?.productName || 'N/A';
      }
    },
    {
      title: 'Danh mục',
      key: 'category',
      width: 150,
      render: (_, record) => {
        if (!record.items || !Array.isArray(record.items)) return 'N/A';
        
        // Lấy danh sách danh mục duy nhất
        const uniqueCategories = Array.from(new Set(
          record.items
            .map(item => item.categoryName)
            .filter(Boolean)
        ));
        
        if (uniqueCategories.length === 0) return 'Chưa phân loại';
        if (uniqueCategories.length === 1) return uniqueCategories[0];
        
        return (
          <Tooltip title={uniqueCategories.join(', ')}>
            <Tag color="blue">{uniqueCategories.length} danh mục</Tag>
          </Tooltip>
        );
      },
      filters: [
        { text: 'Chưa phân loại', value: 'Chưa phân loại' },
        ...Array.from(new Set(
          processedOrders.flatMap(order => 
            (order.items || []).map(item => item.categoryName).filter(Boolean)
          )
        )).map(cat => ({
          text: cat,
          value: cat
        }))
      ],
      onFilter: (value, record) => {
        if (!record.items) return false;
        
        if (value === 'Chưa phân loại') {
          return record.items.every(item => !item.categoryName);
        }
        
        return record.items.some(item => item.categoryName === value);
      }
    },
    {
      title: 'SKU',
      key: 'sku',
      width: 150,
      render: (_, record) => {
        if (!record.items || !Array.isArray(record.items)) return 'N/A';
        
        if (record.items.length > 1) {
          return (
            <div>
              {record.items.map((item, index) => (
                <div key={index} style={{ 
                  marginBottom: 4, 
                  whiteSpace: 'nowrap', 
                  overflow: 'hidden', 
                  textOverflow: 'ellipsis',
                  fontSize: 12
                }}>
                  {item.sku || 'N/A'}
                </div>
              ))}
            </div>
          );
        }
        return record.items[0]?.sku || 'N/A';
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
        <div style={{
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          width: '100%'
        }}>
          <Tag color="green" icon={<ShopOutlined />} style={{ maxWidth: '100%' }}>
            <span style={{
              display: 'inline-block',
              maxWidth: 'calc(100% - 20px)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              verticalAlign: 'middle'
            }}>
              {storeName || 'N/A'}
            </span>
          </Tag>
        </div>
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
      key: 'quantity',
      width: 100,
      align: 'center',
      render: (_, record) => {
        if (!record.items || !Array.isArray(record.items)) return 0;
        return record.items.reduce((sum, item) => sum + (parseFloat(item.quantity) || 0), 0);
      }
    },
    {
      title: 'Đơn Vị',
      key: 'unit',
      width: 80,
      align: 'center',
      render: (_, record) => {
        if (!record.items || !Array.isArray(record.items) || record.items.length === 0) return 'kg';
        return record.items[0]?.unit || 'kg';
      }
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
      title: 'Lợi Nhuận',
      dataIndex: 'profit',
      key: 'profit',
      width: 130,
      align: 'right',
      render: (profit) => (
        <span style={{ color: (profit || 0) >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>
          {formatCurrency(profit || 0)}
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
          marginBottom: 12,
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShoppingOutlined style={{ fontSize: 32, color: '#007A33' }} />
          <div>
            <h1 className="page-title" style={{ margin: 0, color: '#007A33' }}>Quản Lý Đơn Hàng TMĐT</h1>
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
            type="primary"
            style={{
              ...navButtonStyle,
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
              ...navButtonStyle,
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
          <Row gutter={[8, 8]} style={{ display: 'flex', flexWrap: 'nowrap', marginBottom: 16 }}>
            <Col flex="1" style={{ minWidth: '200px' }}>
              <Input
                placeholder="Tìm kiếm..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
            </Col>
        
            <Col flex="1" style={{ minWidth: '120px' }}>
              <Select
                placeholder="Cửa hàng"
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
            <Col flex="1" style={{ minWidth: '120px' }}>
              <Select
                placeholder="Sàn"
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
                <Option value="Website">Website</Option>
                <Option value="other">Khác</Option>
              </Select>
            </Col>
            <Col flex="1" style={{ minWidth: '180px' }}>
              <Select
                placeholder="Chọn danh mục"
                value={categoryFilter}
                onChange={setCategoryFilter}
                style={{ width: '100%' }}
                allowClear
              >
                <Option value="all">Tất cả danh mục</Option>
                <Option value="Chưa phân loại">Chưa phân loại</Option>
                {Array.from(new Set(
                  orders.flatMap(order => 
                    (order.items || [])
                      .map(item => item.categoryName)
                      .filter(Boolean)
                  ) 
                )).map((category, index) => (
                  <Option key={`${category}-${index}`} value={category}>
                    {category}
                  </Option>
                ))}
              </Select>
            </Col>
             <Col>
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

        {/* Table with pagination */}
        <Table
          columns={columns}
          dataSource={filteredOrders}
          rowKey="id"
          loading={loading}
          scroll={{ x: 1500, y: 'calc(100vh - 300px)' }}
          pagination={{
            current: tablePagination.current,
            pageSize: tablePagination.pageSize,
            total: tablePagination.total,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `Tổng: ${total} đơn hàng`,
            locale: {
              items_per_page: ' / trang',
              jump_to: 'Đến',
              jump_to_confirm: 'xác nhận',
              page: 'Trang',
              prev_page: 'Trang trước',
              next_page: 'Trang sau',
              prev_5: 'Trang trước 5',
              next_5: 'Trang sau 5',
              prev_3: 'Trang trước 3',
              next_3: 'Trang sau 3',
            },
            showLessItems: true,
            size: 'small',
            pageSizeOptions: ['10', '20', '50', '100', '1000000'],
            onChange: (page, pageSize) => {
              setTablePagination(prev => ({
                ...prev,
                current: page,
                pageSize: Number(pageSize) === 1000000 ? filteredOrders.length : Number(pageSize)
              }));
            },
            onShowSizeChange: (_, size) => {
              setTablePagination(prev => ({
                ...prev,
                current: 1,
                pageSize: Number(size) === 1000000 ? filteredOrders.length : Number(size)
              }));
            },
            // Custom page size selector
            itemRender: (_, type, originalElement) => {
              if (type === 'pageSize') {
                return (
                  <Select
                    value={tablePagination.pageSize === filteredOrders.length ? 1000000 : tablePagination.pageSize}
                    onChange={(value) => {
                      const newPageSize = value === 1000000 ? filteredOrders.length : value;
                      setTablePagination(prev => ({
                        ...prev,
                        current: 1,
                        pageSize: newPageSize
                      }));
                    }}
                    options={[
                      { value: 10, label: '10/trang' },
                      { value: 20, label: '20/trang' },
                      { value: 50, label: '50/trang' },
                      { value: 100, label: '100/trang' },
                      { value: 1000000, label: 'Hiển thị tất cả' }
                    ]}
                    bordered={false}
                    dropdownMatchSelectWidth={false}
                  />
                );
              }
              return originalElement;
            }
              }}
              expandable={{
                expandedRowRender: (record) => {
                  if (!record.items || !Array.isArray(record.items)) return null;
                  
                  return (
                    <div style={{ margin: 0, padding: 0 }}>
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
                              <strong>Sản phẩm:</strong> {item.productName || 'N/A'}
                            </Col>
                            <Col span={4}>
                              <strong>SKU:</strong> {item.sku || 'N/A'}
                            </Col>
                            <Col span={3}>
                              <strong>SL:</strong> {item.quantity || 0} {item.unit || ''}
                            </Col>
                            <Col span={3}>
                              <strong>Giá:</strong> {formatCurrency(item.sellingPrice || 0)}
                            </Col>
                            <Col span={3}>
                              <strong>Tổng:</strong> <span style={{ color: '#007A33' }}>{formatCurrency(item.subtotal || 0)}</span>
                            </Col>
                            <Col span={3}>
                              <strong>LN:</strong> <span style={{ color: (item.profit || 0) >= 0 ? '#52c41a' : '#ff4d4f' }}>
                                {formatCurrency(item.profit || 0)}
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
                showExpandColumn: false
              }}
              onRow={(record) => ({
                onClick: (e) => {
                  if (e.target.closest('.ant-checkbox-wrapper') || 
                      e.target.closest('.ant-btn') ||
                      e.target.closest('.ant-table-selection-column') ||
                      e.target.closest('.ant-popconfirm')) {
                    return;
                  }
                  
                  if (record.items && record.items.length > 1) {
                    setExpandedRowKeys(prevKeys => {
                      const isExpanded = prevKeys.includes(record.id);
                      return isExpanded 
                        ? prevKeys.filter(key => key !== record.id)
                        : [...prevKeys, record.id];
                    });
                  }
                },
                style: {
                  cursor: record.items && record.items.length > 1 ? 'pointer' : 'default',
                  backgroundColor: expandedRowKeys.includes(record.id) ? '#f0f9ff' : undefined
                },
                onMouseEnter: (e) => {
                  if (record.items && record.items.length > 1) {
                    e.currentTarget.style.backgroundColor = '#f5f5f5';
                  }
                },
                onMouseLeave: (e) => {
                  if (record.items && record.items.length > 1) {
                    e.currentTarget.style.backgroundColor = expandedRowKeys.includes(record.id) ? '#f0f9ff' : 'white';
                  }
                }
              })}
            />
          );
        })()}
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

export default ManageOrdersTMDT;
