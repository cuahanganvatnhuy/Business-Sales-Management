import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../../services/firebase.service';
import { useStore } from '../../contexts/StoreContext';
import { ref, onValue, push, set, get } from 'firebase/database';
import {
  Card,
  Form,
  Input,
  InputNumber,
  Button,
  Select,
  DatePicker,
  message,
  Modal,
  Spin,
  Space,
  Divider,
  Statistic,
  Row,
  Col,
  Checkbox,
  List
} from 'antd';
import {
  ShoppingOutlined,
  UserOutlined,
  PhoneOutlined,
  PlusOutlined,
  DeleteOutlined,
  SaveOutlined,
  ReloadOutlined,
  ShopOutlined,
  CheckCircleOutlined,
  DollarOutlined,
  PrinterOutlined,
  TeamOutlined,
  EnvironmentOutlined
} from '@ant-design/icons';
import { formatCurrency } from '../../utils/format';
import { printWholesaleInvoice } from '../../utils/printInvoice';
import { validateStock, deductStock, checkStockAvailability } from '../../utils/inventoryHelpers';
import dayjs from 'dayjs';
import { useAuth } from '../../contexts/AuthContext';
import './Orders.css';

const { Option } = Select;

// Platforms list
const platforms = [
  { value: 'shopee', label: '🛒 Shopee' },
  { value: 'lazada', label: '🛍️ Lazada' },
  { value: 'tiktok', label: '🎵 TikTok Shop' },
  { value: 'sendo', label: '📦 Sendo' },
  { value: 'tiki', label: '🎁 Tiki' },
  { value: 'facebook', label: '👥 Facebook' },
  { value: 'zalo', label: '💬 Zalo' },
  { value: 'other', label: '🔧 Khác' }
];

const CreateOrderWholesale = () => {
  const navigate = useNavigate();
  const { selectedStore } = useStore();
  const { user, isAdmin } = useAuth();
  const hasPermission = isAdmin || (user?.permissions || []).includes('orders.create.wholesale');
  const [mainForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [sellingProducts, setSellingProducts] = useState([]);
  const [products, setProducts] = useState([]); // Products with stock info
  const [customers, setCustomers] = useState([]);

  // Customer selection & info
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [saveCustomer, setSaveCustomer] = useState(true);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [customerPriceHistory, setCustomerPriceHistory] = useState({}); // Store customer's previous prices per product

  // Order info
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [deliveryDate, setDeliveryDate] = useState(null);

  // Product forms
  const [productForms, setProductForms] = useState([]);
  const [showForms, setShowForms] = useState(false);

  // Order totals
  const [discount, setDiscount] = useState(0);
  const [shipping, setShipping] = useState(0);
  const [deposit, setDeposit] = useState(0);

  // Success modal
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [createdProductCount, setCreatedProductCount] = useState(0);
  const [lastCreatedOrder, setLastCreatedOrder] = useState(null);

  // Load selling products
  useEffect(() => {
    const productsRef = ref(database, 'sellingProducts');
    
    const unsubscribe = onValue(productsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const productsArray = Object.keys(data)
          .filter(key => data[key].status === 'active')
          .map(key => ({
            id: key,
            ...data[key]
          }));
        setSellingProducts(productsArray);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load customers
  useEffect(() => {
    const customersRef = ref(database, 'wholesaleCustomers');
    
    const unsubscribe = onValue(customersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const customersArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        setCustomers(customersArray);
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
      } else {
        setProducts([]);
      }
    });

    return () => unsubscribe();
  }, []);

  // Load customer's previous orders to get price history
  const loadCustomerPriceHistory = async (customerId, customerName) => {
    try {
      const ordersRef = ref(database, 'salesOrders');
      const snapshot = await get(ordersRef);
      
      const ordersData = snapshot.val();
      if (!ordersData) {
        setCustomerPriceHistory({});
        return;
      }

      // Filter orders by customer and orderType
      const customerOrders = Object.values(ordersData)
        .filter(order => 
          order.orderType === 'wholesale' &&
          (order.customerId === customerId || order.customerName === customerName)
        )
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Latest first

      if (customerOrders.length === 0) {
        setCustomerPriceHistory({});
        return;
      }

      // Get most recent order's pricing for each product
      const priceHistory = {};
      const latestOrder = customerOrders[0]; // Most recent order

      if (latestOrder.items && Array.isArray(latestOrder.items)) {
        latestOrder.items.forEach(item => {
          priceHistory[item.productId] = {
            discountType: item.discountType || 'fixed',
            discountValue: item.discountValue || 0,
            priceAfterDiscount: item.priceAfterDiscount || item.sellingPrice
          };
        });
      }

      setCustomerPriceHistory(priceHistory);
      console.log('📊 Loaded price history for customer:', priceHistory);
      
      if (Object.keys(priceHistory).length > 0) {
        message.success(`Đã tải lịch sử giá cho ${Object.keys(priceHistory).length} sản phẩm từ đơn trước`);
      }
    } catch (error) {
      console.error('Error loading customer price history:', error);
      setCustomerPriceHistory({});
    }
  };

  // Add single product
  const handleAddProduct = () => {
    const newId = productForms.length > 0 
      ? Math.max(...productForms.map(f => f.id)) + 1 
      : 1;

    const newForm = {
      id: newId,
      productId: null,
      productName: '',
      sku: '',
      quantity: 1,
      sellingPrice: 0,
      importPrice: 0,
      discountType: 'fixed',
      discountValue: 0,
      priceAfterDiscount: 0,
      total: 0,
      profit: 0
    };

    setProductForms(prevForms => [...prevForms, newForm]);
    setShowForms(true);
    message.success('Đã thêm sản phẩm mới!');
  };

  // Update product selection
  const handleProductChange = (formId, productId) => {
    const product = sellingProducts.find(p => p.id === productId);
    if (!product) return;

    // Kiểm tra stock ngay khi chọn sản phẩm
    const form = productForms.find(f => f.id === formId);
    const quantity = form?.quantity || 1;
    const stockCheck = checkStockAvailability(productId, quantity, products, sellingProducts);
    
    // Cảnh báo nếu stock = 0 hoặc không đủ
    if (stockCheck.stock === 0) {
      message.error(`🚨 CẢNH BÁO: Sản phẩm "${product.productName}" (SKU: ${product.sku || 'N/A'}) ĐÃ HẾT HÀNG! Tồn kho: 0. Không thể tạo đơn hàng với sản phẩm này!`, 5);
    } else if (!stockCheck.available) {
      message.warning(`⚠️ Sản phẩm "${product.productName}" không đủ hàng! ${stockCheck.message}`, 4);
    }

    setProductForms(prevForms =>
      prevForms.map(form => {
        if (form.id === formId) {
          // Check if customer has price history for this product
          const priceHistory = customerPriceHistory[productId];
          
          let discountType = 'fixed';
          let discountValue = 0;
          let priceAfterDiscount = product.sellingPrice;

          if (priceHistory) {
            // Apply customer's previous pricing
            discountType = priceHistory.discountType;
            discountValue = priceHistory.discountValue;
            priceAfterDiscount = priceHistory.priceAfterDiscount;
            console.log(`✅ Áp dụng giá cũ cho ${product.productName}:`, priceHistory);
          }

          const total = priceAfterDiscount * form.quantity;
          const profit = (priceAfterDiscount - product.importPrice) * form.quantity;
          
          return {
            ...form,
            productId: product.id,
            productName: product.productName,
            sku: product.sku,
            unit: product.unit || 'lỗi',
            sellingPrice: product.sellingPrice,
            discountType: discountType,
            discountValue: discountValue,
            priceAfterDiscount: priceAfterDiscount,
            importPrice: product.importPrice,
            total: total,
            profit: profit
          };
        }
        return form;
      })
    );
  };

  // Update quantity
  const handleQuantityChange = (formId, quantity) => {
    // Kiểm tra stock khi thay đổi số lượng
    const form = productForms.find(f => f.id === formId);
    if (form && form.productId) {
      const stockCheck = checkStockAvailability(form.productId, quantity, products, sellingProducts);
      
      if (stockCheck.stock === 0) {
        message.error(`🚨 Sản phẩm "${form.productName}" (SKU: ${form.sku || 'N/A'}) ĐÃ HẾT HÀNG! Tồn kho: 0. Không thể tạo đơn hàng!`, 5);
      } else if (!stockCheck.available) {
        message.warning(`⚠️ ${stockCheck.message}`, 4);
      }
    }
    
    setProductForms(prevForms =>
      prevForms.map(form => {
        if (form.id === formId) {
          const total = form.priceAfterDiscount * quantity;
          const profit = (form.priceAfterDiscount - form.importPrice) * quantity;
          
          return {
            ...form,
            quantity: quantity,
            total: total,
            profit: profit
          };
        }
        return form;
      })
    );
  };

  // Update discount type
  const handleDiscountTypeChange = (formId, discountType) => {
    setProductForms(prevForms =>
      prevForms.map(form => {
        if (form.id === formId) {
          // Reset discount value when changing type
          return {
            ...form,
            discountType: discountType,
            discountValue: 0,
            priceAfterDiscount: form.sellingPrice,
            total: form.sellingPrice * form.quantity,
            profit: (form.sellingPrice - form.importPrice) * form.quantity
          };
        }
        return form;
      })
    );
  };

  // Update discount value
  const handleDiscountValueChange = (formId, value) => {
    setProductForms(prevForms =>
      prevForms.map(form => {
        if (form.id === formId) {
          let priceAfterDiscount = form.sellingPrice;
          
          if (form.discountType === 'fixed') {
            // Giảm theo giá cố định
            priceAfterDiscount = form.sellingPrice - value;
          } else {
            // Giảm theo %
            priceAfterDiscount = form.sellingPrice * (1 - value / 100);
          }

          // Đảm bảo giá sau giảm không âm
          priceAfterDiscount = Math.max(0, priceAfterDiscount);

          const total = priceAfterDiscount * form.quantity;
          const profit = (priceAfterDiscount - form.importPrice) * form.quantity;
          
          return {
            ...form,
            discountValue: value,
            priceAfterDiscount: priceAfterDiscount,
            total: total,
            profit: profit
          };
        }
        return form;
      })
    );
  };

  // Delete product form
  const handleDeleteForm = (formId) => {
    setProductForms(prevForms => {
      const newForms = prevForms.filter(form => form.id !== formId);
      if (newForms.length === 0) {
        setShowForms(false);
      }
      return newForms;
    });
    message.success('Đã xóa sản phẩm!');
  };

  // Generate Order ID
  const generateOrderId = async (orderType) => {
    const today = dayjs();
    const dateStr = today.format('DDMMYY'); // 091125
    const prefix = orderType === 'wholesale' ? 'WHOLESALE' : 'RETAIL';
    
    try {
      // Get all orders from salesOrders
      const ordersRef = ref(database, 'salesOrders');
      const snapshot = await get(ordersRef);
      const ordersData = snapshot.val();
      
      // Count orders with same prefix and date
      let maxSequence = 0;
      if (ordersData) {
        const searchPrefix = `${prefix}-${dateStr}-`;
        Object.values(ordersData).forEach(order => {
          if (order.orderId && order.orderId.startsWith(searchPrefix)) {
            // Extract sequence number from orderId
            const sequenceStr = order.orderId.substring(searchPrefix.length);
            const sequence = parseInt(sequenceStr, 10);
            if (!isNaN(sequence) && sequence > maxSequence) {
              maxSequence = sequence;
            }
          }
        });
      }
      
      // Next sequence number
      const nextSequence = maxSequence + 1;
      
      // Pad to 15 digits
      const sequenceStr = nextSequence.toString().padStart(15, '0');
      
      return `${prefix}-${dateStr}-${sequenceStr}`;
    } catch (error) {
      console.error('Error generating order ID:', error);
      // Fallback to timestamp-based ID
      return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }
  };

  // Calculate totals
  const calculateTotals = () => {
    const subtotal = productForms.reduce((sum, form) => sum + form.total, 0);
    const totalProfit = productForms.reduce((sum, form) => sum + form.profit, 0);
    const finalAmount = subtotal - discount + shipping;
    const remaining = finalAmount - deposit;

    return { subtotal, totalProfit, finalAmount, remaining };
  };

  // Create order
  const handleCreateOrder = async () => {
    // Validation
    if (!customerName || !customerName.trim()) {
      Modal.warning({
        title: 'Chưa nhập tên khách hàng',
        content: 'Vui lòng nhập tên khách hàng!',
        okText: 'Đã hiểu',
        centered: true
      });
      return;
    }

    if (productForms.length === 0) {
      Modal.warning({
        title: 'Chưa có sản phẩm',
        content: 'Vui lòng thêm ít nhất một sản phẩm!',
        okText: 'Đã hiểu',
        centered: true
      });
      return;
    }

    const invalidForms = productForms.filter(form => !form.productId || form.quantity <= 0);
    if (invalidForms.length > 0) {
      Modal.warning({
        title: 'Thông tin chưa đầy đủ',
        content: 'Vui lòng chọn sản phẩm và nhập số lượng cho tất cả các dòng!',
        okText: 'Đã hiểu',
        centered: true
      });
      return;
    }

    if (!customerAddress || !customerAddress.trim()) {
      Modal.warning({
        title: 'Chưa nhập địa chỉ',
        content: 'Vui lòng nhập địa chỉ khách hàng!',
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

    // Validate stock for all items
    const allItems = productForms.map(form => ({
      productId: form.productId,
      productName: form.productName,
      quantity: form.quantity,
      sku: form.sku
    }));
    
    console.log('🔍 [Wholesale] Validating stock...', { 
      allItemsCount: allItems.length, 
      productsCount: products.length 
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
    
    console.log('📊 [Wholesale] Validation result:', stockValidation);
    console.log('📊 [Wholesale] Errors:', stockValidation.errors);
    
    if (!stockValidation.valid) {
      // Kiểm tra xem có sản phẩm hết hàng không
      const hasOutOfStock = stockValidation.errors.some(err => err.includes('HẾT HÀNG') || err.includes('ĐÃ HẾT HÀNG'));
      
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
    
    console.log('✅ [Wholesale] Stock validation passed, creating order...');

    try {
      setLoading(true);

      const { subtotal, totalProfit, finalAmount, remaining } = calculateTotals();

      // Prepare order items
      const items = productForms.map(form => ({
        productId: form.productId,
        productName: form.productName,
        sku: form.sku,
        unit: form.unit || 'kg',
        quantity: form.quantity,
        sellingPrice: form.sellingPrice,
        discountType: form.discountType,
        discountValue: form.discountValue,
        priceAfterDiscount: form.priceAfterDiscount,
        discountAmount: form.sellingPrice - form.priceAfterDiscount,
        importPrice: form.importPrice,
        subtotal: form.total,
        profit: form.profit,
        profitPerUnit: form.priceAfterDiscount - form.importPrice
      }));

      // Generate orderId
      const orderId = await generateOrderId('wholesale');

      // Calculate total quantity
      const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

      // Create wholesale order object
      const wholesaleOrder = {
        orderId: orderId,
        items: items,
        orderDate: selectedDate.format('YYYY-MM-DD'),
        deliveryDate: deliveryDate ? deliveryDate.format('YYYY-MM-DD') : null,
        customerId: selectedCustomer ? selectedCustomer.id : null,
        customerName: customerName.trim(),
        customerPhone: customerPhone ? customerPhone.trim() : '',
        customerAddress: customerAddress.trim(),
        subtotal: subtotal,
        discount: discount,
        shipping: shipping,
        deposit: deposit,
        totalAmount: finalAmount,
        remainingAmount: remaining,
        totalProfit: totalProfit,
        totalQuantity: totalQuantity,
        totalItems: items.length,
        itemCount: items.length,
        source: 'wholesale_sales',
        orderType: 'wholesale',
        paymentStatus: deposit >= finalAmount ? 'paid' : deposit > 0 ? 'partial' : 'pending',
        storeName: selectedStore?.name || 'N/A',
        storeId: selectedStore?.id || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        status: 'pending'
      };

      // Save to Firebase
      const ordersRef = ref(database, 'salesOrders');
      await push(ordersRef, wholesaleOrder);

      // Deduct stock for all items
      await deductStock(items, products, orderId, 'wholesale', sellingProducts, selectedStore);
      console.log('✅ Stock deducted successfully for wholesale order');

      // Save customer if checkbox is checked and not already selected from list
      if (saveCustomer && !selectedCustomer) {
        const customersRef = ref(database, 'wholesaleCustomers');
        await push(customersRef, {
          name: customerName.trim(),
          phone: customerPhone ? customerPhone.trim() : '',
          address: customerAddress.trim(),
          createdAt: new Date().toISOString()
        });
        console.log('✅ Đã lưu thông tin khách hàng vào danh bạ');
      }

      // Save order data and product count before reset
      setCreatedProductCount(items.length);
      setLastCreatedOrder(wholesaleOrder);

      // Reset form
      setCustomerName('');
      setCustomerPhone('');
      setCustomerAddress('');
      setSelectedCustomer(null);
      setCustomerPriceHistory({});
      setSaveCustomer(true);
      setSelectedDate(dayjs());
      setDeliveryDate(null);
      setDeposit(0);
      setProductForms([]);
      setShowForms(false);
      setDiscount(0);
      setShipping(0);
      mainForm.resetFields();

      // Show success modal and ask for print
      setShowSuccessModal(true);
      
      // Ask if user wants to print invoice
      setTimeout(() => {
        Modal.confirm({
          title: '🖨️ In Hóa Đơn',
          content: 'Bạn có muốn in hóa đơn cho đơn hàng này không?',
          okText: 'In Hóa Đơn',
          cancelText: 'Không, Cảm Ơn',
          centered: true,
          onOk() {
            printWholesaleInvoice(wholesaleOrder);
            message.success('Đang mở cửa sổ in hóa đơn...');
          },
          onCancel() {
            console.log('User declined to print invoice');
          }
        });
      }, 500);
    } catch (error) {
      console.error('Error creating order:', error);
      message.error('Lỗi tạo đơn hàng: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const { subtotal, totalProfit, finalAmount, remaining } = calculateTotals();

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Tạo Đơn Hàng Bán Sỉ. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '5px' }}>
      <Spin spinning={loading} tip="Đang xử lý...">
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
              <h1 className="page-title" style={{ margin: 0, color: '#007A33' }}>Tạo Đơn Hàng Bán Sỉ</h1>
              <p style={{ margin: 0, color: '#666' }}>Tạo đơn hàng bán sỉ với giá ưu đãi</p>
            </div>
          </div>
        </Card>

        {/* Order Type Tabs */}
        <div style={{ marginBottom: 24 }}>
          <Space size="middle">
            <Button
              icon={<ShoppingOutlined />}
              size="large"
              onClick={() => navigate('/orders/create/ecommerce')}
              style={{
                borderColor: '#d9d9d9',
                background: 'white',
                color: '#666'
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
              type="primary"
              style={{
                background: '#007A33',
                borderColor: '#007A33'
              }}
            >
              Đơn Bán Sỉ
            </Button>
          </Space>
        </div>

        {/* Main Form */}
        <Card 
          title={<><UserOutlined /> Thông Tin Đơn Hàng</>}
          style={{ 
            marginBottom: 24,
            borderRadius: 12,
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
          }}
        >
          <Form form={mainForm} layout="vertical">
            {/* Row 1: Customer Name, Phone, Sales Channel */}
            <Divider orientation="left">Thông Tin Đơn Hàng</Divider>
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item label="Tên Khách Hàng" required>
                  <Space.Compact style={{ width: '100%' }}>
                    <Input
                      prefix={<UserOutlined />}
                      placeholder="Nhập tên khách hàng"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      size="large"
                    />
                    <Button
                      icon={<TeamOutlined />}
                      onClick={() => setShowCustomerModal(true)}
                      size="large"
                      style={{ background: '#007A33', color: 'white' }}
                      title="Chọn khách hàng"
                    />
                  </Space.Compact>
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="Số Điện Thoại">
                  <Input
                    prefix={<PhoneOutlined />}
                    placeholder="Nhập số điện thoại"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value)}
                    size="large"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="Địa Chỉ" required>
                  <Input
                    prefix={<ShopOutlined />}
                    placeholder="Nhập địa chỉ khách hàng"
                    value={customerAddress}
                    onChange={(e) => setCustomerAddress(e.target.value)}
                    size="large"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16}>
              <Col xs={24}>
                <Checkbox
                  checked={saveCustomer}
                  onChange={(e) => setSaveCustomer(e.target.checked)}
                  disabled={!!selectedCustomer}
                  style={{ marginBottom: 16 }}
                >
                  <span style={{ color: selectedCustomer ? '#999' : '#666' }}>
                    {selectedCustomer 
                      ? 'Khách hàng đã có trong danh bạ' 
                      : 'Lưu thông tin khách hàng vào danh bạ'}
                  </span>
                </Checkbox>
              </Col>
            </Row>

            {/* Row 2: Date, Time, Product Count */}
            <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item label="Ngày Bán" required>
                  <DatePicker
                    value={selectedDate}
                    onChange={setSelectedDate}
                    format="DD/MM/YYYY"
                    style={{ width: '100%' }}
                    size="large"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="Ngày Giao Hàng">
                  <DatePicker
                    value={deliveryDate}
                    onChange={setDeliveryDate}
                    format="DD/MM/YYYY"
                    style={{ width: '100%' }}
                    size="large"
                    placeholder="Chọn ngày giao hàng"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label=" " colon={false}>
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={handleAddProduct}
                    size="large"
                    style={{ 
                      background: '#007A33',
                      width: '100%'
                    }}
                  >
                    Thêm Sản Phẩm
                  </Button>
                </Form.Item>
              </Col>
            </Row>

          </Form>
        </Card>

        {/* Product Forms */}
        {showForms && productForms.length > 0 && (
          <Card 
            title={<><ShopOutlined /> Danh Sách Sản Phẩm ({productForms.length})</>}
            style={{ 
              marginBottom: 24,
              borderRadius: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
            {productForms.map((form, index) => (
              <Card
                key={form.id}
                type="inner"
                title={`Sản Phẩm ${form.id}`}
                extra={
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDeleteForm(form.id)}
                  >
                    Xóa
                  </Button>
                }
                style={{ marginBottom: 16 }}
              >
                <Row gutter={16}>
                  <Col xs={24} md={6}>
                    <Form.Item label="Sản Phẩm" required>
                      <Select
                        placeholder="Chọn sản phẩm"
                        value={form.productId}
                        onChange={(value) => handleProductChange(form.id, value)}
                        showSearch
                        filterOption={(input, option) =>
                          option.children.toLowerCase().includes(input.toLowerCase())
                        }
                        size="large"
                      >
                        {sellingProducts.map(product => (
                          <Option key={product.id} value={product.id}>
                            {product.productName}
                          </Option>
                        ))}
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={4}>
                    <Form.Item label="SKU">
                      <Input value={form.sku} disabled size="large" />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={4}>
                    <Form.Item label="Số Lượng" required>
                      <InputNumber
                        value={form.quantity}
                        onChange={(value) => handleQuantityChange(form.id, value)}
                        min={0.1}
                        step={0.1}
                        style={{ width: '100%' }}
                        size="large"
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={5}>
                    <Form.Item label="Giá Bán">
                      <Input
                        value={formatCurrency(form.sellingPrice)}
                        disabled
                        size="large"
                        style={{ color: '#007A33', fontWeight: 600 }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={5}>
                    <Form.Item label="Tổng Tiền">
                      <Input
                        value={formatCurrency(form.total)}
                        disabled
                        size="large"
                        style={{ color: '#007A33', fontWeight: 600 }}
                      />
                    </Form.Item>
                  </Col>
                </Row>

                {/* Discount Row */}
                <Row gutter={16} style={{ marginTop: 8 }}>
                  <Col xs={24} md={6}>
                    <Form.Item label="Loại Giảm Giá">
                      <Select
                        value={form.discountType}
                        onChange={(value) => handleDiscountTypeChange(form.id, value)}
                        size="large"
                      >
                        <Option value="fixed">💰 Giảm Giá Cố Định</Option>
                        <Option value="percent">% Giảm Theo Phần Trăm</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item label={form.discountType === 'fixed' ? 'Giảm Giá (₫)' : 'Giảm Giá (%)'}>
                      <InputNumber
                        value={form.discountValue}
                        onChange={(value) => handleDiscountValueChange(form.id, value)}
                        min={0}
                        max={form.discountType === 'percent' ? 100 : form.sellingPrice}
                        formatter={(value) => form.discountType === 'fixed' 
                          ? `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                          : `${value}`}
                        parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                        style={{ width: '100%' }}
                        size="large"
                        placeholder={form.discountType === 'fixed' ? 'Nhập số tiền giảm' : 'Nhập % giảm'}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item label="Giá Sau Giảm">
                      <Input
                        value={formatCurrency(form.priceAfterDiscount)}
                        disabled
                        size="large"
                        style={{ 
                          color: form.discountValue > 0 ? '#ff4d4f' : '#007A33', 
                          fontWeight: 600,
                          background: form.discountValue > 0 ? '#fff1f0' : '#f6ffed'
                        }}
                      />
                    </Form.Item>
                  </Col>
                  <Col xs={24} md={6}>
                    <Form.Item label="Tiết Kiệm">
                      <Input
                        value={formatCurrency(form.sellingPrice - form.priceAfterDiscount)}
                        disabled
                        size="large"
                        style={{ 
                          color: '#52c41a', 
                          fontWeight: 600,
                          background: '#f6ffed'
                        }}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Card>
            ))}

            <div style={{ textAlign: 'end', marginTop: 16 }}>
              <Button
                type="dashed"
                icon={<PlusOutlined />}
                onClick={handleAddProduct}
                size="large"
                style={{
                  borderColor: '#007A33',
                  color: '#007A33',
                  width: '150px',
                  fontSize:'12px'
                }}
              >
                Thêm Sản Phẩm
              </Button>
            </div>
          </Card>
        )}

        {/* Order Summary */}
        {showForms && productForms.length > 0 && (
          <Card 
            title={<><DollarOutlined /> Tổng Kết Đơn Hàng</>}
            style={{ 
              marginBottom: 24,
              borderRadius: 12,
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
            }}
          >
             <Row gutter={16}>
              <Col xs={24} md={8}>
                <Form.Item label="Giảm Giá">
                  <InputNumber
                    value={discount}
                    onChange={setDiscount}
                    min={0}
                    formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                    style={{ width: '100%' }}
                    size="large"
                    placeholder="Nhập số tiền giảm giá"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="Phí Vận Chuyển">
                  <InputNumber
                    value={shipping}
                    onChange={setShipping}
                    min={0}
                    formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                    style={{ width: '100%' }}
                    size="large"
                    placeholder="Nhập phí vận chuyển"
                  />
                </Form.Item>
              </Col>
              <Col xs={24} md={8}>
                <Form.Item label="Tiền Cọc">
                  <InputNumber
                    value={deposit}
                    onChange={setDeposit}
                    min={0}
                    formatter={(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={(value) => value.replace(/\$\s?|(,*)/g, '')}
                    style={{ width: '100%' }}
                    size="large"
                    placeholder="Nhập số tiền cọc"
                  />
                </Form.Item>
              </Col>
            </Row>

            <Row gutter={16} style={{ marginBottom: 24 }}>
              <Col xs={24} md={8}>
                <Statistic
                  title="Tạm Tính"
                  value={subtotal}
                  precision={0}
                  valueStyle={{ color: '#666' }}
                  formatter={(value) => formatCurrency(value)}
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title="Tổng Cộng"
                  value={finalAmount}
                  precision={0}
                  valueStyle={{ color: '#007A33', fontWeight: 'bold' }}
                  formatter={(value) => formatCurrency(value)}
                />
              </Col>
              <Col xs={24} md={8}>
                <Statistic
                  title="Còn Phải Trả"
                  value={remaining}
                  precision={0}
                  valueStyle={{ color: remaining > 0 ? '#ff4d4f' : '#52c41a', fontWeight: 'bold' }}
                  formatter={(value) => formatCurrency(value)}
                />
              </Col>
            </Row>

           
            <Divider />

            <div style={{ display: 'flex', gap: 16, justifyContent: 'flex-end' }}>
              <Button
                icon={<ReloadOutlined />}
                size="large"
                onClick={() => {
                  setCustomerName('');
                  setCustomerPhone('');
                  setCustomerAddress('');
                  setSelectedCustomer(null);
                  setCustomerPriceHistory({});
                  setSaveCustomer(true);
                  setDeliveryDate(null);
                  setProductForms([]);
                  setShowForms(false);
                  setDiscount(0);
                  setShipping(0);
                  setDeposit(0);
                  mainForm.resetFields();
                }}
              >
                Làm Mới
              </Button>
              <Button
                type="primary"
                icon={<SaveOutlined />}
                size="large"
                onClick={handleCreateOrder}
                style={{ 
                  background: '#007A33',
                  minWidth: 200
                }}
              >
                Tạo Đơn Hàng Bán Sỉ
              </Button>
            </div>
          </Card>
        )}

        {/* Customer Selection Modal */}
        <Modal
          title={
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <TeamOutlined style={{ color: '#007A33' }} />
              <span>Chọn Khách Hàng</span>
            </div>
          }
          open={showCustomerModal}
          onCancel={() => {
            setShowCustomerModal(false);
            setCustomerSearch('');
          }}
          footer={null}
          width={700}
          centered
        >
          <div style={{ marginBottom: 16 }}>
            <Input
              prefix={<UserOutlined style={{ color: '#999' }} />}
              placeholder="Tìm kiếm khách hàng theo tên, số điện thoại..."
              value={customerSearch}
              onChange={(e) => setCustomerSearch(e.target.value)}
              size="large"
              allowClear
            />
          </div>

          <div style={{ maxHeight: 400, overflow: 'auto' }}>
            {customers
              .filter(c => 
                c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                (c.phone && c.phone.includes(customerSearch))
              )
              .length > 0 ? (
              <List
                dataSource={customers.filter(c => 
                  c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
                  (c.phone && c.phone.includes(customerSearch))
                )}
                renderItem={(customer) => (
                  <List.Item
                    style={{ 
                      cursor: 'pointer',
                      padding: '16px',
                      borderRadius: 8,
                      marginBottom: 8,
                      border: '1px solid #f0f0f0',
                      transition: 'all 0.3s'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#f0f9ff';
                      e.currentTarget.style.borderColor = '#007A33';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.borderColor = '#f0f0f0';
                    }}
                    onClick={() => {
                      setSelectedCustomer(customer);
                      setCustomerName(customer.name);
                      setCustomerPhone(customer.phone || '');
                      setCustomerAddress(customer.address || '');
                      setShowCustomerModal(false);
                      setCustomerSearch('');
                      
                      // Load customer's price history from previous orders
                      loadCustomerPriceHistory(customer.id, customer.name);
                      
                      message.success(`Đã chọn khách hàng: ${customer.name}`);
                    }}
                  >
                    <List.Item.Meta
                      avatar={
                        <div style={{
                          width: 48,
                          height: 48,
                          borderRadius: '50%',
                          background: '#007A33',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'white',
                          fontSize: 20,
                          fontWeight: 'bold'
                        }}>
                          {customer.name.charAt(0).toUpperCase()}
                        </div>
                      }
                      title={
                        <div style={{ fontSize: 16, fontWeight: 600, color: '#333' }}>
                          {customer.name}
                        </div>
                      }
                      description={
                        <div style={{ color: '#666' }}>
                          <div><PhoneOutlined /> {customer.phone || 'Chưa có SĐT'}</div>
                          <div style={{ marginTop: 4 }}>
                            <EnvironmentOutlined /> {customer.address || 'Chưa có địa chỉ'}
                          </div>
                        </div>
                      }
                    />
                  </List.Item>
                )}
              />
            ) : (
              <div style={{ 
                textAlign: 'center', 
                padding: '60px 20px',
                color: '#999'
              }}>
                <UserOutlined style={{ fontSize: 48, marginBottom: 16, opacity: 0.3 }} />
                <div style={{ fontSize: 16 }}>Không tìm thấy khách hàng nào</div>
                {customerSearch && (
                  <div style={{ marginTop: 8, fontSize: 14 }}>
                    Không có kết quả cho "{customerSearch}"
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ 
            marginTop: 16, 
            paddingTop: 16, 
            borderTop: '1px solid #f0f0f0',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: 8
          }}>
            <Button
              onClick={() => {
                setShowCustomerModal(false);
                setCustomerSearch('');
              }}
            >
              Hủy
            </Button>
          </div>
        </Modal>

        {/* Success Modal */}
        <Modal
          open={showSuccessModal}
          onCancel={() => setShowSuccessModal(false)}
          footer={null}
          centered
          width={500}
        >
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 16 }} />
            <h2 style={{ color: '#007A33', marginBottom: 8 }}>Tạo Đơn Hàng Thành Công!</h2>
            <p style={{ fontSize: 16, color: '#666', marginBottom: 24 }}>
              Đơn hàng bán sỉ với <strong>{createdProductCount} sản phẩm</strong> đã được tạo thành công.
            </p>
            <Space size="middle" direction="vertical" style={{ width: '100%' }}>
              <Space size="middle">
                <Button
                  size="large"
                  onClick={() => setShowSuccessModal(false)}
                >
                  Ở Lại Trang Này
                </Button>
                <Button
                  type="primary"
                  size="large"
                  onClick={() => navigate('/orders/manage/wholesale')}
                  style={{ background: '#007A33' }}
                >
                  Quản Lý Đơn Hàng
                </Button>
              </Space>
              {lastCreatedOrder && (
                <Button
                  size="large"
                  icon={<PrinterOutlined />}
                  onClick={() => {
                    printWholesaleInvoice(lastCreatedOrder);
                    message.success('Đang mở cửa sổ in hóa đơn...');
                  }}
                  style={{ 
                    borderColor: '#007A33',
                    color: '#007A33'
                  }}
                >
                  In Hóa Đơn
                </Button>
              )}
            </Space>
          </div>
        </Modal>
      </Spin>
    </div>
  );
};

export default CreateOrderWholesale;
