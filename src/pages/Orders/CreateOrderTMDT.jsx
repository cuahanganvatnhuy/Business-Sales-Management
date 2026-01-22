import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../../contexts/StoreContext';
import {
  Card,
  Form,
  Input,
  Select,
  Button,
  DatePicker,
  InputNumber,
  message,
  Spin,
  Row,
  Col,
  Divider,
  Space,
  Upload,
  Table,
  Modal
} from 'antd';
import {
  DeleteOutlined,
  ShoppingCartOutlined,
  ShoppingOutlined,
  CheckOutlined,
  SaveOutlined,
  FilePdfOutlined,
  FileExcelOutlined,
  EditOutlined,
  UploadOutlined,
  InboxOutlined,
  ShopOutlined,
  PlusOutlined,
  TeamOutlined
} from '@ant-design/icons';
import { database } from '../../services/firebase.service';
import { ref, onValue, push, set } from 'firebase/database';
import { formatCurrency } from '../../utils/format';
import { parseExcelOrders } from '../../utils/excelOrderParser';
import { validateStock, deductStock, checkStockAvailability } from '../../utils/inventoryHelpers';
import { calculateOrderProfit } from '../../utils/profitCalculator';
import dayjs from 'dayjs';
import { useAuth } from '../../contexts/AuthContext';
import './Orders.css';

const { Option } = Select;

const CreateOrderTMDT = () => {
  const navigate = useNavigate();
  const { selectedStore } = useStore();
  const { user, isAdmin } = useAuth();
  const hasPermission = isAdmin || (user?.permissions || []).includes('orders.create.ecommerce');
  const [mainForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [sellingProducts, setSellingProducts] = useState([]);
  const [products, setProducts] = useState([]); // Products with stock info
  
  // Order info
  const [selectedPlatform, setSelectedPlatform] = useState(null);
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [orderCount, setOrderCount] = useState('');
  
  // Order forms
  const [orderForms, setOrderForms] = useState([]);
  const [showForms, setShowForms] = useState(false);
  
  // Creation method
  const [creationMethod, setCreationMethod] = useState('manual'); // manual, pdf, excel
  const [uploadedFile, setUploadedFile] = useState(null);
  
  // Success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdOrdersCount, setCreatedOrdersCount] = useState(0);
  
  // Upload progress
  const [uploadProgress, setUploadProgress] = useState({ show: false, current: 0, total: 0, message: '' });
  
  // Profit calculation
  const [orderProfits, setOrderProfits] = useState({});

  // Platforms list
  const platforms = [
    { value: 'shopee', label: 'Shopee', color: '#EE4D2D' },
    { value: 'lazada', label: 'Lazada', color: '#0F156D' },
    { value: 'tiktok', label: 'TikTok Shop', color: '#000000' },
    { value: 'sendo', label: 'Sendo', color: '#ED1B24' },
    { value: 'tiki', label: 'Tiki', color: '#1A94FF' },
    { value: 'facebook', label: 'Facebook Shop', color: '#1877F2' },
    { value: 'zalo', label: 'Zalo Shop', color: '#0068FF' },
    { value: 'other', label: 'Khác', color: '#999999' }
  ];

  // Load selling products (status = active only)
  useEffect(() => {
    const sellingProductsRef = ref(database, 'sellingProducts');
    const unsubscribe = onValue(sellingProductsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const productsList = Object.entries(data)
          .filter(([id, product]) => product.status === 'active')
          .map(([id, product]) => ({
            id,
            ...product
          }));
        setSellingProducts(productsList);
        console.log('✅ Loaded active selling products:', productsList.length);
      } else {
        setSellingProducts([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load products for stock validation
  useEffect(() => {
    const productsRef = ref(database, 'products');
    const unsubscribe = onValue(productsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const productsList = Object.entries(data).map(([id, product]) => ({
          id,
          ...product
        }));
        setProducts(productsList);
        console.log('✅ Loaded products for stock validation:', productsList.length);
      } else {
        setProducts([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Handle Excel file upload
  const handleExcelUpload = async (file) => {
    if (!selectedPlatform) {
      message.warning('Vui lòng chọn sàn TMĐT trước!');
      return false;
    }

    try {
      // Show progress modal
      setUploadProgress({ show: true, current: 0, total: 0, message: 'Đang đọc file Excel...' });
      
      // Parse Excel file
      const parsedOrders = await parseExcelOrders(file, selectedPlatform, sellingProducts);
      
      if (parsedOrders.length === 0) {
        setUploadProgress({ show: false, current: 0, total: 0, message: '' });
        message.warning('Không tìm thấy đơn hàng nào trong file Excel!');
        return false;
      }

      // Update progress: Processing orders
      setUploadProgress({ show: true, current: 0, total: parsedOrders.length, message: 'Đang xử lý đơn hàng...' });

      // Convert parsed orders to orderForms format with delay to show progress
      const forms = [];
      for (let i = 0; i < parsedOrders.length; i++) {
        const order = parsedOrders[i];
        
        // Update progress
        setUploadProgress({ 
          show: true, 
          current: i + 1, 
          total: parsedOrders.length, 
          message: `Đang xử lý đơn hàng ${i + 1}/${parsedOrders.length}...` 
        });
        
        forms.push({
          id: i + 1,
          orderId: order.orderId,
          items: order.items.map(item => ({
            key: Date.now() + Math.random(),
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            unit: item.unit || 'kg',
            importPrice: item.importPrice,
            sellingPrice: item.sellingPrice,
            quantity: item.quantity,
            subtotal: item.subtotal,
            profit: item.profit
          }))
        });
        
        // Small delay to show progress (can remove for instant processing)
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      setOrderForms(forms);
      setShowForms(true);
      setUploadProgress({ show: false, current: 0, total: 0, message: '' });
      
      // Tính lợi nhuận cho tất cả đơn hàng từ Excel
      setTimeout(async () => {
        for (const form of forms) {
          await calculateOrderProfitRealtime(form.id);
          // Delay nhỏ để tránh quá tải
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      }, 200);
      
      message.success(`Đã tải lên ${parsedOrders.length} đơn hàng từ file Excel!`);
      return false; // Prevent default upload
    } catch (error) {
      console.error('Error processing Excel:', error);
      setUploadProgress({ show: false, current: 0, total: 0, message: '' });
      message.error(`Lỗi xử lý file Excel: ${error.message}`);
      return false;
    }
  };

  // Generate order forms - Mỗi đơn hàng chứa nhiều sản phẩm
  const handleGenerateForms = () => {
    if (!selectedPlatform) {
      Modal.warning({
        title: 'Chưa chọn sàn TMĐT',
        content: 'Vui lòng chọn sàn thương mại điện tử trước khi tạo đơn hàng!',
        okText: 'Đã hiểu',
        centered: true
      });
      return;
    }

    const count = parseInt(orderCount);
    if (!count || count < 1 || count > 1000) {
      Modal.warning({
        title: 'Số lượng không hợp lệ',
        content: 'Vui lòng nhập số lượng đơn hàng từ 1 đến 1000!',
        okText: 'Đã hiểu',
        centered: true
      });
      return;
    }

    // Generate forms - Mỗi form là 1 đơn hàng với items array
    const forms = [];
    for (let i = 1; i <= count; i++) {
      forms.push({
        id: i,
        items: [] // Mỗi đơn có nhiều sản phẩm
      });
    }

    setOrderForms(forms);
    setShowForms(true);
    message.success(`Đã tạo ${count} đơn hàng!`);
  };

  // Add product to order
  const handleAddProduct = (orderId) => {
    setOrderForms(prevForms =>
      prevForms.map(form => {
        if (form.id === orderId) {
          return {
            ...form,
            items: [
              ...form.items,
              {
                key: Date.now(),
                productId: '',
                productName: '',
                sku: '',
                importPrice: 0,
                sellingPrice: 0,
                quantity: 1,
                subtotal: 0,
                profit: 0
              }
            ]
          };
        }
        return form;
      })
    );
  };

  // Calculate profit for an order
  const calculateOrderProfitRealtime = async (orderId) => {
    console.log('🧮 Starting profit calculation for order:', orderId);
    
    const form = orderForms.find(f => f.id === orderId);
    console.log('🔍 Form found:', form);
    console.log('🔍 Form items:', form?.items);
    console.log('🔍 Selected platform:', selectedPlatform);
    
    if (!form || !form.items.length || !selectedPlatform) {
      console.log('❌ Missing requirements:', { 
        hasForm: !!form, 
        hasItems: form?.items?.length > 0, 
        hasPlatform: !!selectedPlatform 
      });
      return;
    }

    // Chỉ tính nếu có ít nhất 1 item có productId
    const validItems = form.items.filter(item => item.productId && item.quantity > 0);
    console.log('🔍 All items:', form.items);
    console.log('🔍 Valid items:', validItems);
    console.log('🔍 Items details:', form.items.map(item => ({
      productId: item.productId,
      quantity: item.quantity,
      hasProductId: !!item.productId,
      hasQuantity: item.quantity > 0
    })));
    
    if (validItems.length === 0) {
      console.log('❌ No valid items found - items missing productId or quantity <= 0');
      return;
    }

    try {
      const platformName = platforms.find(p => p.value === selectedPlatform)?.label || selectedPlatform;
      
      // Sử dụng 'all' nếu selectedStore không có giá trị
      const storeId = selectedStore?.id || selectedStore || 'all';
      console.log('🔍 Store ID mapping:', { selectedStore, storeId });
      
      console.log('🏪 Platform info:', { selectedPlatform, platformName, selectedStore, storeId });
      console.log('📦 Order data:', form);
      
      console.log('🔄 About to call calculateOrderProfit...');
      console.log('🔄 calculateOrderProfit function:', typeof calculateOrderProfit);
      
      const profit = await calculateOrderProfit(form, platformName, storeId);
      console.log('✅ Profit calculated:', profit);
      
      setOrderProfits(prev => ({
        ...prev,
        [orderId]: profit
      }));
    } catch (error) {
      console.error('❌ Error calculating profit for order', orderId, ':', error);
    }
  };

  // Handle product selection for a specific item in an order
  const handleProductChange = (orderId, itemKey, productId) => {
    const product = sellingProducts.find(p => p.id === productId);
    if (product) {
      // Kiểm tra stock ngay khi chọn sản phẩm
      const quantity = 1; // Mặc định quantity = 1 khi chọn sản phẩm
      const stockCheck = checkStockAvailability(productId, quantity, products, sellingProducts);
      
      // Cảnh báo nếu stock = 0 hoặc không đủ
      if (stockCheck.stock === 0) {
        message.error(`🚨 CẢNH BÁO: Sản phẩm "${product.productName}" (SKU: ${product.sku || 'N/A'}) ĐÃ HẾT HÀNG! Tồn kho: 0. Không thể tạo đơn hàng với sản phẩm này!`, 5);
      } else if (!stockCheck.available) {
        message.warning(`⚠️ Sản phẩm "${product.productName}" không đủ hàng! ${stockCheck.message}`, 4);
      }
      
      setOrderForms(prevForms =>
        prevForms.map(form => {
          if (form.id === orderId) {
            return {
              ...form,
              items: form.items.map(item => {
                if (item.key === itemKey) {
                  const quantity = item.quantity || 1;
                  const subtotal = product.sellingPrice * quantity;
                  const profit = (product.sellingPrice - product.importPrice) * quantity;
                  
                  return {
                    ...item,
                    productId: product.id,
                    productName: product.productName,
                    sku: product.sku,
                    unit: product.unit || 'kg',
                    importPrice: product.importPrice,
                    sellingPrice: product.sellingPrice,
                    quantity,
                    subtotal,
                    profit
                  };
                }
                return item;
              })
            };
          }
          return form;
        })
      );
      
      // Tính lại lợi nhuận sau khi thay đổi sản phẩm
      setTimeout(() => calculateOrderProfitRealtime(orderId), 500);
    }
  };

  // Handle quantity change for a specific item
  const handleQuantityChange = (orderId, itemKey, quantity) => {
    // Find the item to validate stock
    const form = orderForms.find(f => f.id === orderId);
    const item = form?.items.find(i => i.key === itemKey);
    
    if (item && item.productId) {
      const stockCheck = checkStockAvailability(item.productId, quantity, products, sellingProducts);
      
      if (stockCheck.stock === 0) {
        message.error(`🚨 Sản phẩm "${item.productName}" (SKU: ${item.sku || 'N/A'}) ĐÃ HẾT HÀNG! Tồn kho: 0. Không thể tạo đơn hàng!`, 5);
      } else if (!stockCheck.available) {
        message.warning(`⚠️ ${stockCheck.message}`, 4);
      }
    }
    
    setOrderForms(prevForms =>
      prevForms.map(form => {
        if (form.id === orderId) {
          return {
            ...form,
            items: form.items.map(item => {
              if (item.key === itemKey) {
                const subtotal = item.sellingPrice * quantity;
                const profit = (item.sellingPrice - item.importPrice) * quantity;
                return { ...item, quantity, subtotal, profit };
              }
              return item;
            })
          };
        }
        return form;
      })
    );
    
    // Tính lại lợi nhuận sau khi thay đổi số lượng
    setTimeout(() => calculateOrderProfitRealtime(orderId), 100);
  };

  // Remove product from order
  const handleRemoveProduct = (orderId, itemKey) => {
    setOrderForms(prevForms =>
      prevForms.map(form => {
        if (form.id === orderId) {
          return {
            ...form,
            items: form.items.filter(item => item.key !== itemKey)
          };
        }
        return form;
      })
    );
    
    // Tính lại lợi nhuận sau khi xóa sản phẩm
    setTimeout(() => calculateOrderProfitRealtime(orderId), 100);
  };

  // Delete a form
  const handleDeleteForm = (formId) => {
    setOrderForms(prevForms => prevForms.filter(form => form.id !== formId));
    message.info('Đã xóa form đơn hàng!');
  };

  // Calculate totals for a specific order
  const calculateOrderTotals = (order) => {
    const totalAmount = order.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
    const totalProfit = order.items.reduce((sum, item) => sum + (item.profit || 0), 0);
    const totalItems = order.items.length;
    const totalQuantity = order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
    return { totalAmount, totalProfit, totalItems, totalQuantity };
  };

  // Calculate grand totals (all orders)
  const calculateTotals = () => {
    let totalAmount = 0;
    let totalProfit = 0;
    orderForms.forEach(form => {
      const orderTotal = calculateOrderTotals(form);
      totalAmount += orderTotal.totalAmount;
      totalProfit += orderTotal.totalProfit;
    });
    return { totalAmount, totalProfit };
  };

  // Create all orders
  const handleCreateAllOrders = async () => {
    // Validation: Check platform đã chọn chưa
    if (!selectedPlatform) {
      Modal.warning({
        title: 'Chưa chọn sàn TMĐT',
        content: 'Vui lòng chọn sàn thương mại điện tử trước khi tạo đơn hàng!',
        okText: 'Đã hiểu',
        centered: true
      });
      return;
    }

    // Validation: Check mỗi đơn phải có ít nhất 1 sản phẩm
    const emptyOrders = orderForms.filter(form => form.items.length === 0);
    if (emptyOrders.length > 0) {
      Modal.warning({
        title: 'Đơn hàng chưa có sản phẩm',
        content: `Có ${emptyOrders.length} đơn hàng chưa có sản phẩm! Vui lòng thêm sản phẩm trước khi tạo.`,
        okText: 'Đã hiểu',
        centered: true
      });
      return;
    }

    // Validation: Check tất cả items phải đã chọn sản phẩm
    let hasInvalidItems = false;
    orderForms.forEach(form => {
      const invalidItems = form.items.filter(item => !item.productId);
      if (invalidItems.length > 0) {
        hasInvalidItems = true;
      }
    });

    if (hasInvalidItems) {
      Modal.warning({
        title: 'Chưa chọn sản phẩm',
        content: 'Vui lòng chọn sản phẩm cho tất cả các dòng trước khi tạo đơn hàng!',
        okText: 'Đã hiểu',
        centered: true
      });
      return;
    }

    const otherPlatformName = mainForm.getFieldValue('otherPlatform');
    if (selectedPlatform === 'other' && !otherPlatformName) {
      Modal.warning({
        title: 'Chưa nhập tên sàn',
        content: 'Vui lòng nhập tên sàn thương mại điện tử khác!',
        okText: 'Đã hiểu',
        centered: true
      });
      return;
    }

    // Validate store selection
    if (!selectedStore || selectedStore.id === 'all') {
      Modal.warning({
        title: 'Chưa chọn cửa hàng',
        content: 'Vui lòng chọn một cửa hàng cụ thể để tạo đơn hàng! Không thể tạo đơn cho "Toàn Bộ Cửa Hàng".',
        okText: 'Đã hiểu',
        centered: true
      });
      return;
    }

    // Validate stock for all items in all orders
    const allItems = orderForms.flatMap(form => form.items);
    
    console.log('🔍 Validating stock...', { 
      allItemsCount: allItems.length, 
      productsCount: products.length,
      allItems: allItems,
      productIds: products.map(p => ({ id: p.id, name: p.name }))
    });
    
    // Check if products are loaded
    if (products.length === 0) {
      Modal.warning({
        title: 'Đang tải dữ liệu kho',
        content: 'Vui lòng đợi dữ liệu kho hàng tải xong rồi thử lại!',
        okText: 'Đã hiểu',
        centered: true
      });
      return;
    }
    
    const stockValidation = validateStock(allItems, products, sellingProducts);
    
    console.log('📊 Validation result:', stockValidation);
    console.log('📊 Errors:', stockValidation.errors);
    
    if (!stockValidation.valid) {
      // Kiểm tra xem có sản phẩm hết hàng không
      const hasOutOfStock = stockValidation.errors.some(err => err.includes('HẾT HÀNG') || err.includes('ĐÃ HẾT HÀNG'));
      const hasProductNotFound = stockValidation.errors.some(err => err.includes('không tồn tại'));
      
      // Thông báo ngay bằng message.error
      const errorMessage = hasOutOfStock 
        ? '🚨 KHÔNG THỂ TẠO ĐƠN HÀNG! Có sản phẩm ĐÃ HẾT HÀNG trong kho!'
        : '⚠️ Không thể tạo đơn hàng! Có sản phẩm không đủ hàng trong kho!';
      
      message.error(errorMessage, 5);
      
      // Hiển thị Modal.error ngay lập tức
      const modalTitle = hasOutOfStock 
        ? '🚨 KHÔNG THỂ TẠO ĐƠN HÀNG - KHO HẾT HÀNG!'
        : '⚠️ KHÔNG THỂ TẠO ĐƠN HÀNG - KHO KHÔNG ĐỦ HÀNG!';
      
      Modal.error({
        title: modalTitle,
        content: (
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            <div style={{ 
              marginBottom: 16, 
              padding: 12, 
              background: hasOutOfStock ? '#fff2f0' : '#fffbe6',
              border: hasOutOfStock ? '1px solid #ffccc7' : '1px solid #ffe58f',
              borderRadius: 6
            }}>
              <strong style={{ color: hasOutOfStock ? '#ff4d4f' : '#faad14', fontSize: 16 }}>
                {hasOutOfStock ? '🚨' : '⚠️'} Có {stockValidation.errors.length} sản phẩm gặp vấn đề về tồn kho:
              </strong>
            </div>
            {stockValidation.errors.map((error, index) => {
              const isOutOfStock = error.includes('HẾT HÀNG') || error.includes('ĐÃ HẾT HÀNG');
              return (
                <div 
                  key={index} 
                  style={{ 
                    marginBottom: 12, 
                    padding: 12,
                    background: isOutOfStock ? '#fff1f0' : '#fff',
                    border: isOutOfStock ? '2px solid #ff4d4f' : '1px solid #ffccc7',
                    borderRadius: 6,
                    color: isOutOfStock ? '#ff4d4f' : '#fa8c16',
                    fontSize: 14,
                    lineHeight: 1.6,
                    fontWeight: isOutOfStock ? 'bold' : 'normal'
                  }}
                >
                  <strong>• {error}</strong>
                </div>
              );
            })}
            <div style={{ 
              marginTop: 16, 
              padding: 12, 
              background: '#f6ffed', 
              border: '1px solid #b7eb8f',
              borderRadius: 6,
              fontSize: 13,
              color: '#52c41a'
            }}>
              💡 <strong>Giải pháp:</strong> Vui lòng kiểm tra tồn kho và nhập thêm hàng trước khi tạo đơn hàng!
            </div>
          </div>
        ),
        okText: 'Đã hiểu',
        centered: true,
        width: 750,
        okButtonProps: {
          style: {
            background: hasOutOfStock ? '#ff4d4f' : '#faad14',
            borderColor: hasOutOfStock ? '#ff4d4f' : '#faad14',
            height: 40,
            fontSize: 14,
            fontWeight: 'bold'
          }
        },
        maskClosable: false,
        closable: true,
        zIndex: 10000
      });
      
      return;
    }
    
    console.log('✅ Stock validation passed, creating orders...');

    try {
      // Show progress modal
      setUploadProgress({ 
        show: true, 
        current: 0, 
        total: orderForms.length, 
        message: 'Đang tạo đơn hàng...' 
      });

      const ordersRef = ref(database, 'salesOrders');

      // Save từng đơn hàng (mỗi đơn chứa nhiều items)
      for (let i = 0; i < orderForms.length; i++) {
        const form = orderForms[i];
        
        // Update progress
        setUploadProgress({ 
          show: true, 
          current: i + 1, 
          total: orderForms.length, 
          message: `Đang tạo đơn hàng ${i + 1}/${orderForms.length}...` 
        });
        
        const orderTotals = calculateOrderTotals(form);
        
        const newOrderRef = push(ordersRef);
        
        // Generate orderId: Use Excel orderId if available, else generate new one
        const generatedOrderId = form.orderId || `ECOM-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
        
        const orderData = {
          // Order info
          orderId: generatedOrderId,
          orderDate: selectedDate.format('YYYY-MM-DD'),
          platform: selectedPlatform,
          otherPlatform: selectedPlatform === 'other' ? otherPlatformName : '',
          orderType: 'ecommerce',
          storeName: selectedStore?.name || 'N/A',
          storeId: selectedStore?.id || null,
          
          // Order items (array of products)
          items: form.items.map(item => ({
            productId: item.productId,
            productName: item.productName,
            sku: item.sku,
            unit: item.unit || 'kg',
            importPrice: item.importPrice,
            sellingPrice: item.sellingPrice,
            quantity: item.quantity,
            subtotal: item.subtotal,
            profit: item.profit
          })),
          
          // Order totals
          totalAmount: orderTotals.totalAmount,
          totalProfit: orderTotals.totalProfit,
          totalItems: orderTotals.totalItems,
          totalQuantity: orderTotals.totalQuantity,
          
          // Metadata
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };
        
        console.log('💾 Saving order to Firebase:', orderData);
        await set(newOrderRef, orderData);
      }

      console.log('✅ Orders created successfully, count:', orderForms.length);
      
      // Tính lợi nhuận cho tất cả đơn hàng vừa tạo
      console.log('🧮 Starting profit calculation for all created orders...');
      console.log('🔍 Selected store for profit calculation:', selectedStore);
      for (const form of orderForms) {
        setTimeout(() => calculateOrderProfitRealtime(form.id), 1000);
      }
      
      // Deduct stock for all items
      setUploadProgress({ 
        show: true, 
        current: orderForms.length, 
        total: orderForms.length, 
        message: 'Đang cập nhật tồn kho...' 
      });
      
      const allItems = orderForms.flatMap(form => form.items);
      const firstOrderId = orderForms[0]?.orderId || 'BATCH';
      await deductStock(allItems, products, firstOrderId, 'ecommerce', sellingProducts, selectedStore);
      
      console.log('✅ Stock deducted successfully');
      
      // Đóng progress modal
      setUploadProgress({ show: false, current: 0, total: 0, message: '' });
      
      // Lưu số lượng đơn đã tạo
      setCreatedOrdersCount(orderForms.length);
      
      // Reset form
      mainForm.resetFields();
      setOrderCount('');
      setOrderForms([]);
      setShowForms(false);
      setSelectedPlatform(null);
      setSelectedDate(dayjs());
      
      // Hiển thị modal thành công
      setShowSuccessModal(true);
    } catch (error) {
      console.error('Error creating orders:', error);
      setUploadProgress({ show: false, current: 0, total: 0, message: '' });
      message.error('Lỗi tạo đơn hàng: ' + error.message);
    }
  };

  const { totalAmount, totalProfit } = calculateTotals();

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Tạo Đơn Hàng TMĐT. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  return (
    <Spin spinning={loading}>
      <div className="create-order-page"style={{padding:5}}>
        {/* Header */}
        <Card 
          style={{ 
            marginBottom: 24,
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ShoppingOutlined style={{ fontSize: 32, color: '#007A33' }} />
            <div>
              <h1 style={{ margin: 0, fontSize: 24, color: '#007A33' }}>Tạo Đơn Hàng TMĐT</h1>
              <p style={{ margin: 0, color: '#666' }}>Tạo đơn hàng từ các sàn thương mại điện tử</p>
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
              Đơn TMĐT
            </Button>
            <Button
              icon={<ShopOutlined />}
              size="large"
              onClick={() => navigate('/orders/create/retail')}
              style={{
                borderColor: '#d9d9d9',
                background: 'white',
                color: '#666'
              }}
            >
              Đơn Bán Lẻ
            </Button>
            <Button
              icon={<TeamOutlined />}
              size="large"
              onClick={() => navigate('/orders/create/wholesale')}
              style={{
                borderColor: '#d9d9d9',
                background: 'white',
                color: '#666'
              }}
            >
              Đơn Bán Sỉ
            </Button>
          </Space>
        </div>

        {/* Order Info Form */}
        <Card title={
          <span style={{ color: '#007A33', display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ 
              width: 20, 
              height: 20, 
              borderRadius: '50%', 
              background: 'white', 
              color: '#007A33',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 12,
              fontWeight: 'bold'
            }}>ℹ</span>
            Thông Tin Đơn Hàng
          </span>
        }>
          <Form form={mainForm} layout="vertical">
            {/* Method Selection Buttons - ĐẦU TIÊN */}
            <div className="method-buttons-container">
              <Button
                className={`method-button ${creationMethod === 'manual' ? 'active' : ''}`}
                icon={<EditOutlined />}
                onClick={() => setCreationMethod('manual')}
              >
                Tạo Đơn Thủ Công
              </Button>
              <Button
                className={`method-button ${creationMethod === 'excel' ? 'active' : ''}`}
                icon={<FileExcelOutlined />}
                onClick={() => setCreationMethod('excel')}
              >
                📊 Upload Excel TMĐT
              </Button>
            </div>

            {/* Platform Selection - FULL WIDTH */}
            <Form.Item
              label={<span style={{ fontWeight: 600, fontSize: 15 }}>Chọn Sàn TMĐT:</span>}
              required
            >
              <Select
                placeholder="🛒 Chọn sàn thương mại điện tử"
                size="large"
                value={selectedPlatform}
                onChange={setSelectedPlatform}
                style={{ fontSize: 15 }}
                showSearch
                allowClear
                filterOption={(input, option) =>
                  option.children.toLowerCase().includes(input.toLowerCase())
                }
              >
                {platforms.map(p => (
                  <Option key={p.value} value={p.value}>
                    {p.label}
                  </Option>
                ))}
              </Select>
            </Form.Item>

            {selectedPlatform === 'other' && (
              <Form.Item
                label="Tên sàn khác:"
                name="otherPlatform"
                rules={[{ required: true, message: 'Vui lòng nhập tên sàn!' }]}
              >
                <Input placeholder="Nhập tên sàn TMĐT" size="large" />
              </Form.Item>
            )}

            {/* Row 2 cột: Date | Quantity/Upload */}
            <Row gutter={16}>
              {/* Cột trái: Ngày Tạo Đơn */}
              <Col xs={24} md={12}>
                <Form.Item
                  label="Ngày Tạo Đơn:"
                  required
                >
                  <DatePicker
                    style={{ width: '100%' }}
                    format="DD/MM/YYYY"
                    size="large"
                    value={selectedDate}
                    onChange={setSelectedDate}
                  />
                </Form.Item>
              </Col>

              {/* Cột phải: Số Lượng / Upload */}
              <Col xs={24} md={12}>
                {/* Manual Method */}
                {creationMethod === 'manual' && (
                  <Form.Item
                    label="Số Lượng Đơn Hàng:"
                    required
                  >
                    <div style={{ display: 'flex', gap: 8 }}>
                      <InputNumber
                        style={{ flex: 1 }}
                        size="large"
                        min={1}
                        max={10000}
                        placeholder="Nhập số lượng đơn hàng"
                        value={orderCount}
                        onChange={setOrderCount}
                        onPressEnter={handleGenerateForms}
                      />
                      <Button
                        type="primary"
                        size="large"
                        icon={<CheckOutlined />}
                        onClick={handleGenerateForms}
                        style={{
                          background: 'linear-gradient(135deg, #007A33, #00632a)',
                          borderColor: '#007A33',
                          boxShadow: '0 2px 6px rgba(0, 122, 51, 0.3)',
                          fontWeight: 600
                        }}
                      >
                        ✓ Xác Nhận
                      </Button>
                    </div>
                    <div style={{ marginTop: 6, color: '#999', fontSize: 12 }}>
                      Nhập số lượng đơn hàng bạn muốn tạo (tối đa 10000 đơn)
                    </div>
                  </Form.Item>
                )}

                {/* PDF Upload Method */}
                {creationMethod === 'pdf' && (
                  <Form.Item label="Upload File PDF TikTok:">
                    <Upload.Dragger
                      accept=".pdf"
                      maxCount={1}
                      beforeUpload={(file) => {
                        setUploadedFile(file);
                        message.info(`File ${file.name} đã được chọn. Tính năng đang phát triển...`);
                        return false;
                      }}
                      onRemove={() => setUploadedFile(null)}
                    >
                      <p className="ant-upload-drag-icon">
                        <InboxOutlined style={{ color: '#007A33', fontSize: 32 }} />
                      </p>
                      <p className="ant-upload-text">Kéo thả PDF hoặc <span style={{ color: '#007A33' }}>chọn file</span></p>
                      <p className="ant-upload-hint">Hỗ trợ nhiều file PDF cùng lúc</p>
                    </Upload.Dragger>
                  </Form.Item>
                )}

                {/* Excel Upload Method */}
                {creationMethod === 'excel' && (
                  <Form.Item label="Upload File Excel TMĐT:">
                    <Upload.Dragger
                      accept=".xlsx,.xls"
                      maxCount={1}
                      beforeUpload={handleExcelUpload}
                      onRemove={() => {
                        setUploadedFile(null);
                        setOrderForms([]);
                        setShowForms(false);
                      }}
                    >
                      <p className="ant-upload-drag-icon">
                        <InboxOutlined style={{ color: '#52c41a', fontSize: 32 }} />
                      </p>
                      <p className="ant-upload-text">Kéo thả Excel hoặc <span style={{ color: '#52c41a' }}>chọn file</span></p>
                      <p className="ant-upload-hint">
                        Hỗ trợ file Excel (.xlsx, .xls) từ TikTok Shop, Shopee, Lazada
                      </p>
                    </Upload.Dragger>
                  </Form.Item>
                )}
              </Col>
            </Row>
          </Form>
        </Card>

        {/* Order Forms */}
        {showForms && orderForms.length > 0 && (
          <Card
            title={`🛒 Danh Sách Đơn Hàng (${orderForms.length} đơn)`}
            extra={
              <Space>
                <span style={{ color: '#666' }}>
                  Tổng: <strong style={{ color: '#52c41a', fontSize: 16 }}>
                    {formatCurrency(totalAmount)}
                  </strong>
                </span>
                <span style={{ color: '#666' }}>
                  Lợi nhuận: <strong style={{ color: '#1890ff', fontSize: 16 }}>
                    {formatCurrency(totalProfit)}
                  </strong>
                </span>
              </Space>
            }
          >
            <div className="orders-scrollable">
              {orderForms.map((form, index) => (
                <Card
                  key={form.id}
                  className="order-form-card"
                  size="small"
                  title={
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between',
                      alignItems: 'center'
                    }}>
                      <div>
                        <div>
                          <ShoppingCartOutlined /> Đơn Hàng Bán {form.id}
                          {form.orderId && (
                            <span style={{ marginLeft: 8, color: '#1890ff', fontSize: 13 }}>
                              (Mã: {form.orderId})
                            </span>
                          )}
                        </div>
                        {/* Hiển thị lợi nhuận */}
                        {orderProfits[form.id] && (
                          <div style={{ fontSize: 12, marginTop: 4 }}>
                            <span style={{ color: '#666' }}>Doanh thu: </span>
                            <span style={{ color: '#1890ff', fontWeight: 'bold' }}>
                              {formatCurrency(orderProfits[form.id].revenue)}
                            </span>
                            <span style={{ margin: '0 8px', color: '#666' }}>|</span>
                            <span style={{ color: '#666' }}>Lợi nhuận: </span>
                            <span style={{ 
                              color: orderProfits[form.id].netProfit >= 0 ? '#52c41a' : '#ff4d4f', 
                              fontWeight: 'bold' 
                            }}>
                              {formatCurrency(orderProfits[form.id].netProfit)}
                            </span>
                            <span style={{ 
                              color: orderProfits[form.id].profitMargin >= 0 ? '#52c41a' : '#ff4d4f',
                              marginLeft: 4,
                              fontSize: 11
                            }}>
                              ({orderProfits[form.id].profitMargin.toFixed(1)}%)
                            </span>
                          </div>
                        )}
                      </div>
                      {orderForms.length > 1 && (
                        <Button
                          danger
                          type="text"
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteForm(form.id)}
                        >
                          Xóa
                        </Button>
                      )}
                    </div>
                  }
                >
                  {/* Order Items Table */}
                  {form.items.length > 0 ? (
                    <div>
                      <div style={{ 
                        marginBottom: 12,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}>
                        <span style={{ fontSize: 13, color: '#666' }}>
                          {form.items.length} sản phẩm
                        </span>
                        <Button
                          type="dashed"
                          size="small"
                          icon={<PlusOutlined />}
                          onClick={() => handleAddProduct(form.id)}
                        >
                          Thêm Sản Phẩm
                        </Button>
                      </div>
                      
                      {form.items.map((item, itemIndex) => (
                        <div key={item.key} style={{ 
                          marginBottom: 16,
                          padding: 12,
                          background: '#fafafa',
                          borderRadius: 6,
                          border: '1px solid #f0f0f0'
                        }}>
                          <Row gutter={[8, 8]}>
                            <Col xs={24} md={10}>
                              <div style={{ marginBottom: 4 }}>
                                <label style={{ fontSize: 12, fontWeight: 600 }}>
                                  <span style={{ color: '#ff4d4f' }}>* </span>
                                  Sản Phẩm:
                                </label>
                              </div>
                              <Select
                                showSearch
                                size="small"
                                style={{ width: '100%' }}
                                placeholder="Chọn sản phẩm"
                                value={item.productId || undefined}
                                onChange={(value) => handleProductChange(form.id, item.key, value)}
                                filterOption={(input, option) =>
                                  (option?.label ?? '').toLowerCase().includes(input.toLowerCase())
                                }
                                options={sellingProducts.map(p => ({
                                  value: p.id,
                                  label: `${p.productName} (${p.sku})`
                                }))}
                              />
                            </Col>

                            <Col xs={8} md={3}>
                              <div style={{ marginBottom: 4 }}>
                                <label style={{ fontSize: 12, fontWeight: 600 }}>SKU:</label>
                              </div>
                              <Input
                                size="small"
                                value={item.sku}
                                readOnly
                                style={{ background: '#fff' }}
                              />
                            </Col>

                            <Col xs={8} md={2}>
                              <div style={{ marginBottom: 4 }}>
                                <label style={{ fontSize: 12, fontWeight: 600 }}>SL:</label>
                              </div>
                              <InputNumber
                                size="small"
                                style={{ width: '100%' }}
                                min={1}
                                value={item.quantity}
                                onChange={(value) => handleQuantityChange(form.id, item.key, value)}
                              />
                            </Col>

                            <Col xs={8} md={3}>
                              <div style={{ marginBottom: 4 }}>
                                <label style={{ fontSize: 12, fontWeight: 600 }}>Giá Nhập:</label>
                              </div>
                              <div style={{ 
                                fontSize: 12,
                                padding: '4px 8px',
                                background: '#fff',
                                border: '1px solid #d9d9d9',
                                borderRadius: 4
                              }}>
                                {item.importPrice > 0 ? formatCurrency(item.importPrice) : '-'}
                              </div>
                            </Col>

                            <Col xs={8} md={3}>
                              <div style={{ marginBottom: 4 }}>
                                <label style={{ fontSize: 12, fontWeight: 600 }}>Giá Bán:</label>
                              </div>
                              <div style={{ 
                                fontSize: 12,
                                padding: '4px 8px',
                                background: '#fff',
                                border: '1px solid #d9d9d9',
                                borderRadius: 4,
                                color: '#52c41a',
                                fontWeight: 600
                              }}>
                                {item.sellingPrice > 0 ? formatCurrency(item.sellingPrice) : '-'}
                              </div>
                            </Col>

                            <Col xs={8} md={2}>
                              <div style={{ marginBottom: 4 }}>
                                <label style={{ fontSize: 12, fontWeight: 600 }}>L.Nhuận:</label>
                              </div>
                              <div style={{ 
                                fontSize: 12,
                                padding: '4px 8px',
                                background: '#fff',
                                border: '1px solid #d9d9d9',
                                borderRadius: 4,
                                color: item.profit > 0 ? '#52c41a' : '#ff4d4f',
                                fontWeight: 600
                              }}>
                                {item.profit !== 0 ? formatCurrency(item.profit) : '-'}
                              </div>
                            </Col>

                            <Col xs={24} md={1} style={{ display: 'flex', alignItems: 'flex-end' }}>
                              <Button
                                danger
                                type="text"
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => handleRemoveProduct(form.id, item.key)}
                              />
                            </Col>
                          </Row>
                        </div>
                      ))}

                      {/* Order Summary */}
                      <div style={{ 
                        marginTop: 16,
                        padding: 12,
                        background: '#f0f9ff',
                        borderRadius: 6,
                        display: 'flex',
                        justifyContent: 'flex-end',
                        gap: 24
                      }}>
                        <div>
                          <span style={{ color: '#666' }}>Tổng tiền: </span>
                          <strong style={{ color: '#1890ff', fontSize: 16 }}>
                            {formatCurrency(calculateOrderTotals(form).totalAmount)}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: '#666' }}>Lợi nhuận: </span>
                          <strong style={{ 
                            color: calculateOrderTotals(form).totalProfit > 0 ? '#52c41a' : '#ff4d4f',
                            fontSize: 16
                          }}>
                            {formatCurrency(calculateOrderTotals(form).totalProfit)}
                          </strong>
                        </div>
                      </div>
                      
                      {/* Chi tiết phí */}
                      {orderProfits[form.id] && (
                        <div style={{ 
                          marginTop: 16, 
                          padding: '12px 16px',
                          background: '#f8f9fa',
                          borderRadius: '6px',
                          border: '1px solid #e8e8e8'
                        }}>
                          <div style={{ 
                            fontSize: 13, 
                            fontWeight: 'bold', 
                            marginBottom: 8,
                            color: '#666'
                          }}>
                            📊 Chi tiết phí và lợi nhuận:
                          </div>
                          
                          <Row gutter={[16, 8]} style={{ fontSize: 12 }}>
                            <Col span={8}>
                              <div>💰 Doanh thu: <strong style={{ color: '#1890ff' }}>
                                {formatCurrency(orderProfits[form.id].revenue)}
                              </strong></div>
                            </Col>
                            <Col span={8}>
                              <div>📦 Chi phí hàng: <strong style={{ color: '#ff7875' }}>
                                {formatCurrency(orderProfits[form.id].costOfGoods)}
                              </strong></div>
                            </Col>
                            <Col span={8}>
                              <div>📈 Lợi nhuận gốc: <strong style={{ color: '#52c41a' }}>
                                {formatCurrency(orderProfits[form.id].grossProfit)}
                              </strong></div>
                            </Col>
                            
                            {orderProfits[form.id].platformFeeCost > 0 && (
                              <Col span={8}>
                                <div>🏪 Phí sàn: <strong style={{ color: '#fa8c16' }}>
                                  {formatCurrency(orderProfits[form.id].platformFeeCost)}
                                </strong></div>
                              </Col>
                            )}
                            
                            {orderProfits[form.id].externalCostAmount > 0 && (
                              <Col span={8}>
                                <div>🏢 Chi phí ngoài: <strong style={{ color: '#fa8c16' }}>
                                  {formatCurrency(orderProfits[form.id].externalCostAmount)}
                                </strong></div>
                              </Col>
                            )}
                            
                            {orderProfits[form.id].packagingCostAmount > 0 && (
                              <Col span={8}>
                                <div>📦 Chi phí thùng: <strong style={{ color: '#fa8c16' }}>
                                  {formatCurrency(orderProfits[form.id].packagingCostAmount)}
                                </strong></div>
                              </Col>
                            )}
                            
                            <Col span={24}>
                              <div style={{ 
                                marginTop: 8, 
                                paddingTop: 8, 
                                borderTop: '1px solid #d9d9d9',
                                display: 'flex',
                                justifyContent: 'space-between'
                              }}>
                                <span>🎯 <strong>Lợi nhuận cuối:</strong></span>
                                <span style={{ 
                                  color: orderProfits[form.id].netProfit >= 0 ? '#52c41a' : '#ff4d4f',
                                  fontWeight: 'bold',
                                  fontSize: 14
                                }}>
                                  {formatCurrency(orderProfits[form.id].netProfit)} 
                                  ({orderProfits[form.id].profitMargin.toFixed(1)}%)
                                </span>
                              </div>
                            </Col>
                          </Row>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ textAlign: 'end', padding: '5px 0' }}>
                      <p style={{ color: '#999', marginBottom: 12 }}>Chưa có sản phẩm nào</p>
                      <Button
                        type="primary"
                        icon={<PlusOutlined />}
                        onClick={() => handleAddProduct(form.id)}
                        style={{ background: '#347e0fff', borderColor: '#327411ff', fontSize: 12 }}
                      >
                        Thêm Sản Phẩm Đầu 
                      </Button>
                    </div>
                  )}
                </Card>
              ))}
            </div>

            <Divider />

            {/* Submit Button */}
            <div style={{ textAlign: 'end' }}>
              <Space size="large">
                <Button
                  style={{
                  
                    minWidth: 20,
                    height: 35,
                    fontSize: 14,
                    fontWeight: 600
                  }}
                  size="large"
                  onClick={() => {
                    setShowForms(false);
                    setOrderForms([]);
                    setOrderCount('');
                  }}
                >
                  Hủy
                </Button>
                <Button
                  type="primary"
                  size="large"
                  icon={<SaveOutlined />}
                  onClick={handleCreateAllOrders}
                  style={{
                    background: '#007A33',
                    borderColor: '#007A33',
                    minWidth: 250,
                    height: 35,
                    fontSize: 14,
                    fontWeight: 600
                  }}
                >
                  Tạo Tất Cả {orderForms.length} Đơn Hàng Bán
                </Button>
              </Space>
            </div>
          </Card>
        )}

        {/* Info when no forms */}
        {!showForms && (
          <Card>
            <div style={{ 
              textAlign: 'center',
              padding: '48px 24px',
              color: '#999'
            }}>
              <ShoppingCartOutlined style={{ fontSize: 64, marginBottom: 16 }} />
              <h3 style={{ color: '#666' }}>Nhập số lượng đơn hàng và nhấn "Xác Nhận"</h3>
              <p>Hệ thống sẽ tạo các form đơn hàng để bạn điền thông tin</p>
            </div>
          </Card>
        )}

        
      </div>

      {/* Upload Progress Modal */}
      <Modal
        open={uploadProgress.show}
        footer={null}
        closable={false}
        centered
        width={400}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Spin size="large" />
          <h3 style={{ marginTop: 20, marginBottom: 10, color: '#007A33' }}>
            {uploadProgress.message}
          </h3>
          {uploadProgress.total > 0 && (
            <p style={{ fontSize: 16, color: '#666' }}>
              <strong style={{ color: '#52c41a', fontSize: 20 }}>{uploadProgress.current}</strong>
              <span style={{ margin: '0 8px' }}>/</span>
              <strong>{uploadProgress.total}</strong> đơn hàng
            </p>
          )}
        </div>
      </Modal>

      {/* Success Modal */}
      <Modal
        open={showSuccessModal}
        onOk={() => {
          setShowSuccessModal(false);
        }}
        onCancel={() => {
          setShowSuccessModal(false);
          navigate('/orders/manage/ecommerce');
        }}
        okText="Ở Lại Trang Này"
        cancelText="Quản Lý Đơn Hàng"
        okButtonProps={{
          style: { background: '#007A33', borderColor: '#007A33', minWidth: 120 }
        }}
        cancelButtonProps={{
          style: { minWidth: 120 }
        }}
        centered
        width={500}
      >
        <div style={{ padding: '20px 0' }}>
          <div style={{ textAlign: 'center', marginBottom: 20 }}>
            <CheckOutlined style={{ fontSize: 48, color: '#52c41a' }} />
          </div>
          <h3 style={{ textAlign: 'center', fontSize: 18, color: '#52c41a', marginBottom: 16 }}>
            Tạo Đơn Hàng Thành Công!
          </h3>
          <p style={{ fontSize: 16, textAlign: 'center', marginBottom: 8 }}>
            Đã tạo <strong style={{ color: '#52c41a', fontSize: 20 }}>{createdOrdersCount}</strong> đơn hàng TMĐT thành công!
          </p>
          <p style={{ color: '#666', fontSize: 14, textAlign: 'center' }}>
            Dữ liệu đã được lưu vào hệ thống.
          </p>
        </div>
      </Modal>
    </Spin>
  );
};

export default CreateOrderTMDT;
