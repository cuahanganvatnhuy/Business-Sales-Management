import React, { useState, useEffect } from 'react';
import { Typography, Card } from 'antd';
import { ShoppingOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import isBetween from 'dayjs/plugin/isBetween';
import { database } from '../../services/firebase.service';
import { ref, onValue } from 'firebase/database';
import * as XLSX from 'xlsx';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';

// Import components
import EcommerceFilters from './components/EcommerceFilters';
import EcommerceStatistics from './components/EcommerceStatistics';
import BestSellingProducts from './components/BestSellingProducts';
import EcommerceOrdersTable from './components/EcommerceOrdersTable';
import FeeDisplayCards from './components/FeeDisplayCards';
import FeeSelector from './components/FeeSelector';

const FEE_FIELD_MAPPINGS = {
  phiGiaoDich: ['phiGiaoDich', 'transactionFee'],
  phiHoaHong: ['phiHoaHong', 'commissionFee'],
  phiVanChuyenThucTe: ['phiVanChuyenThucTe', 'actualShippingFee', 'shippingFee'],
  giamPhiVcNguoiBan: ['giamPhiVcNguoiBan', 'sellerDiscountFee'],
  giamPhiVcTikTokShop: ['giamPhiVcTikTokShop', 'tiktokShippingDiscount'],
  phiVcTaHang: ['phiVcTaHang', 'warehouseShippingFee'],
  troGiaVanChuyen: ['troGiaVanChuyen', 'shippingSubsidy'],
  hoaHongLienKet: ['hoaHongLienKet', 'affiliateCommission'],
  phiVoucherXtra: ['phiVoucherXtra', 'voucherXtraFee'],
  thueTGTCT: ['thueTGTCT', 'vatTax'],
  thueTNCN: ['thueTNCN', 'incomeTax'],
  giamPhiNguoiBan: ['giamPhiNguoiBan', 'sellerFeeDiscount'],
  chinhKhachPhiVanChuyen: ['chinhKhachPhiVanChuyen', 'customerShippingAdjustment'],
  phiKhac: ['phiKhac', 'otherFees'],
  chiPhiVanChuyen: ['chiPhiVanChuyen', 'transportCost'],
  chiPhiDongGoi: ['chiPhiDongGoi', 'packagingCost'],
  chiPhiLuuKho: ['chiPhiLuuKho', 'storageCost'],
  chiPhiNhanVien: ['chiPhiNhanVien', 'laborCost'],
  chiPhiThueMat: ['chiPhiThueMat', 'rentCost'],
  chiPhiDienNuoc: ['chiPhiDienNuoc', 'utilityCost'],
  chiPhiBaoHiem: ['chiPhiBaoHiem', 'insuranceCost'],
  chiPhiThietBi: ['chiPhiThietBi', 'equipmentCost'],
  chiPhiHanhChinh: ['chiPhiHanhChinh', 'adminCost'],
  chiPhiMarketing: ['chiPhiMarketing', 'marketingCost'],
  chiPhiThungDongGoi: ['chiPhiThungDongGoi']
};

const FEE_LABELS = {
  phiGiaoDich: 'Phí Giao Dịch',
  phiHoaHong: 'Phí Hoa Hồng',
  phiVanChuyenThucTe: 'Phí Vận Chuyển Thực Tế',
  giamPhiVcNguoiBan: 'Giảm Phí VC Người Bán',
  giamPhiVcTikTokShop: 'Giảm Phí VC TikTok Shop',
  phiVcTaHang: 'Phí VC Trả Hàng',
  troGiaVanChuyen: 'Trợ Giá Vận Chuyển',
  hoaHongLienKet: 'Hoa Hồng Liên Kết',
  phiVoucherXtra: 'Phí Voucher Xtra',
  thueTGTCT: 'Thuế GTGT',
  thueTNCN: 'Thuế TNCN',
  giamPhiNguoiBan: 'Giảm Phí Người Bán',
  chinhKhachPhiVanChuyen: 'Chỉnh Khách Phí Vận Chuyển',
  phiKhac: 'Phí Khác',
  chiPhiVanChuyen: 'Chi Phí Vận Chuyển',
  chiPhiDongGoi: 'Chi Phí Đóng Gói',
  chiPhiLuuKho: 'Chi Phí Lưu Kho',
  chiPhiNhanVien: 'Chi Phí Nhân Viên',
  chiPhiThueMat: 'Chi Phí Thuê Mặt Bằng',
  chiPhiDienNuoc: 'Chi Phí Điện Nước',
  chiPhiBaoHiem: 'Chi Phí Bảo Hiểm',
  chiPhiThietBi: 'Chi Phí Thiết Bị',
  chiPhiHanhChinh: 'Chi Phí Hành Chính',
  chiPhiMarketing: 'Chi Phí Marketing',
  chiPhiThungDongGoi: 'Chi Phí Thùng Đóng Gói'
};

const PLATFORM_FEE_KEYS = [
  'phiGiaoDich',
  'phiHoaHong',
  'phiVanChuyenThucTe',
  'giamPhiVcNguoiBan',
  'giamPhiVcTikTokShop',
  'phiVcTaHang',
  'troGiaVanChuyen',
  'hoaHongLienKet',
  'phiVoucherXtra',
  'thueTGTCT',
  'thueTNCN',
  'giamPhiNguoiBan',
  'chinhKhachPhiVanChuyen',
  'phiKhac'
];

const EXTERNAL_FEE_KEYS = [
  'chiPhiVanChuyen',
  'chiPhiDongGoi',
  'chiPhiLuuKho',
  'chiPhiNhanVien',
  'chiPhiThueMat',
  'chiPhiDienNuoc',
  'chiPhiBaoHiem',
  'chiPhiThietBi',
  'chiPhiHanhChinh',
  'chiPhiMarketing'
];

const PACKAGING_FEE_KEYS = ['chiPhiThungDongGoi'];

const { Title, Text } = Typography;

dayjs.extend(isBetween);

const EcommerceProfit = () => {
  const { user, isAdmin } = useAuth();
  const hasPermission = isAdmin || (user?.permissions || []).includes('finance.profit.ecommerce.view');

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Lợi Nhuận Đơn TMĐT. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  // Global store state
  const { selectedStore, stores, setStores, selectStore } = useStore();
  
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [allPlatformOrders, setAllPlatformOrders] = useState([]);
  const [dateRange, setDateRange] = useState([
    dayjs().subtract(30, 'days'),
    dayjs()
  ]);
  const [selectedPlatform, setSelectedPlatform] = useState('all');
  const [searchText, setSearchText] = useState('');
  const [platforms, setPlatforms] = useState([]);
  const [bestSellingProducts, setBestSellingProducts] = useState([]);
  const [customCosts, setCustomCosts] = useState([]);
  const [feeData, setFeeData] = useState({
    phiGiaoDich: 6950,
    phiHoaHong: 15290,
    phiVanChuyenThucTe: 0,
    giamPhiVcNguoiBan: 0,
    chiPhiVanChuyen: 0
  });
  const [expenseFilters, setExpenseFilters] = useState({
    phiGiaoDich: false,
    phiHoaHong: false,
    phiVanChuyenThucTe: false,
    giamPhiVcNguoiBan: false,
    giamPhiVcTikTokShop: false,
    phiVcTaHang: false,
    troGiaVanChuyen: false,
    hoaHongLienKet: false,
    phiVoucherXtra: false,
    thueTGTCT: false,
    thueTNCN: false,
    giamPhiNguoiBan: false,
    chinhKhachPhiVanChuyen: false,
    phiKhac: false,
    chiPhiVanChuyen: false,
    chiPhiDongGoi: false,
    chiPhiLuuKho: false,
    chiPhiNhanVien: false,
    chiPhiThueMat: false,
    chiPhiDienNuoc: false,
    chiPhiBaoHiem: false,
    chiPhiThietBi: false,
    chiPhiHanhChinh: false,
    chiPhiMarketing: false
  });
  const [statistics, setStatistics] = useState({
    totalRevenue: 0,
    totalImportCost: 0,
    totalPlatformFee: 0,
    totalProfit: 0,
    grossProfit: 0,
    netProfit: 0,
    netProfitAllPlatforms: 0
  });
  const [feeSettings, setFeeSettings] = useState({
    platform: {},
    external: {},
    packaging: {}
  });
  const [ordersWithProfit, setOrdersWithProfit] = useState([]);
  const [ordersWithProfitAllPlatforms, setOrdersWithProfitAllPlatforms] = useState([]);

  useEffect(() => {
    loadStores();
    loadOrders();
  }, []);

  useEffect(() => {
    filterOrders();
  }, [orders, dateRange, selectedStore, selectedPlatform]);

  useEffect(() => {
    calculateStatistics();
    calculateBestSellingProducts();
    calculateFeeData();
  }, [ordersWithProfit]);

  useEffect(() => {
    // Extract unique platforms từ dữ liệu và luôn bao gồm danh sách mặc định
    const defaultPlatforms = [
      'TikTok Shop',
      'Shopee',
      'Lazada',
      'Sendo',
      'Tiki',
      'Facebook Shop',
      'Zalo Shop',
      'Instagram Shop',
      'TMĐT Khác'
    ];

    const platformFields = [
      'platform',
      'ecommercePlatform',
      'source',
      'channel',
      'marketplace'
    ];
    
    const detectedPlatforms = new Set();
    
    orders.forEach(order => {
      platformFields.forEach(field => {
        if (order[field]) {
          let platform = order[field].toString().toLowerCase();
          
          if (platform.includes('tiktok') || platform.includes('tik tok')) {
            detectedPlatforms.add('TikTok Shop');
          } else if (platform.includes('shopee')) {
            detectedPlatforms.add('Shopee');
          } else if (platform.includes('lazada')) {
            detectedPlatforms.add('Lazada');
          } else if (platform.includes('sendo')) {
            detectedPlatforms.add('Sendo');
          } else if (platform.includes('tiki')) {
            detectedPlatforms.add('Tiki');
          } else if (platform.includes('facebook') || platform.includes('fb')) {
            detectedPlatforms.add('Facebook Shop');
          } else if (platform.includes('zalo')) {
            detectedPlatforms.add('Zalo Shop');
          } else if (platform.includes('instagram') || platform.includes('ig')) {
            detectedPlatforms.add('Instagram Shop');
          } else if (platform.includes('tmdt') || platform.includes('ecommerce')) {
            detectedPlatforms.add('TMĐT Khác');
          } else if (platform && platform !== 'undefined' && platform !== 'null') {
            detectedPlatforms.add(platform.charAt(0).toUpperCase() + platform.slice(1));
          }
        }
      });
    });
    
    const mergedPlatforms = Array.from(new Set([
      ...defaultPlatforms,
      ...Array.from(detectedPlatforms).sort()
    ]));

    console.log('🏪 Available platforms:', mergedPlatforms);
    setPlatforms(mergedPlatforms);
  }, [orders]);

  useEffect(() => {
    const platformRef = ref(database, 'platformFeeSettings');
    const externalRef = ref(database, 'externalCostSettings');
    const packagingRef = ref(database, 'packagingCostSettings');

    const unsubscribePlatform = onValue(platformRef, snapshot => {
      setFeeSettings(prev => ({
        ...prev,
        platform: snapshot.val() || {}
      }));
    });

    const unsubscribeExternal = onValue(externalRef, snapshot => {
      setFeeSettings(prev => ({
        ...prev,
        external: snapshot.val() || {}
      }));
    });

    const unsubscribePackaging = onValue(packagingRef, snapshot => {
      setFeeSettings(prev => ({
        ...prev,
        packaging: snapshot.val() || {}
      }));
    });

    return () => {
      unsubscribePlatform();
      unsubscribeExternal();
      unsubscribePackaging();
    };
  }, []);

  const enrichOrdersWithProfit = (ordersList = []) => {
    if (!ordersList.length) return [];

    return ordersList.map(order => {
      const revenue = parseFloat(order.totalAmount) || parseFloat(order.subtotal) || 0;
      const importCost = (() => {
        if (order.importCost !== undefined && order.importCost !== null) {
          return parseFloat(order.importCost) || 0;
        }
        const perUnitImport = parseFloat(order.importPrice) || 0;
        return perUnitImport * (order.quantity || 1);
      })();

      const explicitBreakdown = buildExplicitFeeBreakdown(order);
      const configuredFees = calculateConfiguredFees(order, revenue);
      const combinedBreakdown = mergeBreakdowns(explicitBreakdown, configuredFees.breakdown);

      const explicitFees = sumBreakdownValues(explicitBreakdown);
      const settingsFees = configuredFees.totalAmount || sumBreakdownValues(configuredFees.breakdown);
      const totalFees = sumBreakdownValues(combinedBreakdown);
      const netProfit = revenue - importCost - totalFees;

      const platformCost = sumByKeys(combinedBreakdown, PLATFORM_FEE_KEYS);
      const externalCost = sumByKeys(combinedBreakdown, EXTERNAL_FEE_KEYS);
      const packagingCost = sumByKeys(combinedBreakdown, PACKAGING_FEE_KEYS);

      return {
        ...order,
        importCost,
        explicitFees,
        configuredFees,
        settingsFees,
        totalFees,
        netProfit,
        platformCost,
        externalCost,
        packagingCost,
        feeBreakdown: combinedBreakdown,
        explicitFeeBreakdown: explicitBreakdown,
        configuredFeeBreakdown: configuredFees.breakdown
      };
    });
  };

  useEffect(() => {
    const enrichedFiltered = enrichOrdersWithProfit(filteredOrders);
    setOrdersWithProfit(enrichedFiltered);

    const enrichedAllPlatforms = enrichOrdersWithProfit(allPlatformOrders);
    setOrdersWithProfitAllPlatforms(enrichedAllPlatforms);
  }, [filteredOrders, allPlatformOrders, feeSettings]);

  const loadStores = () => {
    const storesRef = ref(database, 'stores');
    onValue(storesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const storesArray = Object.keys(data).map(key => ({
          id: key,
          ...data[key]
        }));
        if (setStores) {
          setStores(storesArray);
        }
        
        // Set store đầu tiên làm mặc định nếu chưa chọn store nào
        if (!selectedStore && storesArray.length > 0 && selectStore) {
          const firstStore = storesArray[0];
          console.log('🏪 Setting default store to:', firstStore.id, firstStore.name);
          selectStore(firstStore, false);
        }
      }
    });
  };

  const loadOrders = () => {
    setLoading(true);
    const ordersRef = ref(database, 'salesOrders');
    onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (snapshot.exists()) {
        console.log('📊 [EcommerceProfit] Raw Firebase data:', Object.keys(data).length, 'orders');
        
        const ordersArray = Object.keys(data).map(key => {
          const order = { ...data[key], id: key };
          
          // Filter ecommerce orders first
          const isEcommerceOrder = order.orderType === 'ecommerce' ||
            order.platform ||
            order.ecommercePlatform ||
            order.source === 'ecommerce' ||
            order.source === 'tmdt' ||
            order.source === 'tmdt_sales' ||
            (order.orderId && order.orderId.includes('TMDT'));
            
          if (!isEcommerceOrder) return null;
          
          // Nếu order có items array, gộp thành 1 dòng với thông tin tổng hợp
          if (order.items && Array.isArray(order.items) && order.items.length > 0) {
            // Calculate totals for multi-item orders
            const totalQuantity = order.items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
            const totalSubtotal = order.totalAmount || order.items.reduce((sum, item) => sum + (Number(item.subtotal) || 0), 0);
            const totalProfit = order.totalProfit || order.items.reduce((sum, item) => sum + (Number(item.profit) || 0), 0);
            const totalImportCost = order.items.reduce((sum, item) => sum + ((item.importPrice || 0) * (item.quantity || 0)), 0);
            
            // Use first item's selling price for single-item orders, or calculate average
            const avgSellingPrice = order.items.length === 1 
              ? order.items[0].sellingPrice 
              : order.items.reduce((sum, item) => sum + (Number(item.sellingPrice) || 0), 0) / order.items.length;
            
            const avgImportPrice = order.items.reduce((sum, item) => sum + (Number(item.importPrice) || 0), 0) / order.items.length;
            
            // Get product names (comma separated)
            const productNames = order.items.map(item => item.productName).join(', ');
            const skus = order.items.map(item => item.sku).join(', ');
            
            console.log('🔧 Processing multi-item order:', order.orderId, {
              itemCount: order.items.length,
              totalQuantity,
              avgSellingPrice,
              totalSubtotal
            });
            
            return {
              ...order,
              // Aggregated item data
              productName: productNames,
              sku: skus,
              itemCount: order.items.length,
              quantity: totalQuantity,
              unit: order.items[0]?.unit || 'kg', // Use first item's unit
              sellingPrice: avgSellingPrice,
              importPrice: avgImportPrice,
              subtotal: totalSubtotal,
              profit: totalProfit,
              totalAmount: totalSubtotal,
              importCost: totalImportCost,
              // Store items for detail view
              items: order.items
            };
          } else {
            // Legacy format: single item order
            return {
              ...order,
              itemCount: 1,
              items: null
            };
          }
        }).filter(Boolean);
        
        console.log('📊 [EcommerceProfit] Filtered ecommerce orders:', ordersArray.length);
        console.log('📊 [EcommerceProfit] Sample orders:', ordersArray.slice(0, 3).map(o => ({
          orderId: o.orderId,
          platform: o.platform,
          orderDate: o.orderDate,
          orderType: o.orderType,
          hasItems: !!o.items,
          itemsCount: o.items?.length,
          firstItem: o.items?.[0]
        })));
        
        setOrders(ordersArray);
      } else {
        console.log('📊 [EcommerceProfit] No orders found in Firebase');
        setOrders([]);
      }
      setLoading(false);
    });
  };

  const filterOrders = () => {
    console.log('🔍 [EcommerceProfit] Filtering orders:', {
      totalOrders: orders.length,
      selectedStore,
      selectedPlatform,
      dateRange
    });
    
    let filtered = [];
    const filteredResult = [];
    const allPlatformResult = [];

    try {
      orders.forEach(order => {
        try {
          const selectedStoreId = typeof selectedStore === 'object'
            ? selectedStore?.id
            : selectedStore;
          const matchStore =
            !selectedStoreId ||
            selectedStoreId === 'all' ||
            order.storeId === selectedStoreId;
      
      // Kiểm tra platform từ nhiều field
      let matchPlatform = selectedPlatform === 'all';
      if (!matchPlatform && selectedPlatform !== 'all') {
        const platformFields = ['platform', 'ecommercePlatform', 'source', 'channel', 'marketplace'];
        matchPlatform = platformFields.some(field => {
          if (order[field]) {
            const orderPlatform = order[field].toString().toLowerCase();
            const selectedLower = selectedPlatform.toLowerCase();
            
            // Kiểm tra exact match hoặc contains
            const isMatch = orderPlatform === selectedLower || 
                           orderPlatform.includes(selectedLower.split(' ')[0]) ||
                           selectedLower.includes(orderPlatform) ||
                           // Thêm mapping cho TikTok
                           (orderPlatform === 'tiktok' && selectedLower.includes('tiktok')) ||
                           (selectedLower === 'tiktok' && orderPlatform.includes('tiktok'));
            
            if (isMatch) {
              console.log('🎯 [EcommerceProfit] Platform match found:', {
                orderId: order.orderId,
                orderPlatform,
                selectedLower,
                field
              });
            }
            
            return isMatch;
          }
          return false;
        });
      }

      const [startDate, endDate] = dateRange || [];
      const hasDateRange = startDate && endDate;
      let matchDate = true;
      if (hasDateRange) {
        const orderDateValue = order.orderDate || order.createdAt || order.updatedAt;
        if (orderDateValue) {
          const orderDate = dayjs(orderDateValue);
          matchDate = orderDate.isValid()
            ? orderDate.isBetween(
                startDate.startOf('day'),
                endDate.endOf('day'),
                null,
                '[]'
              )
            : true;
        }
      }

          const passesWithoutPlatform = matchStore && matchDate;
          if (passesWithoutPlatform) {
            allPlatformResult.push(order);
          }

          const passes = passesWithoutPlatform && matchPlatform;
          
          if (passes) {
            filteredResult.push(order);
          }
        } catch (orderError) {
          console.error('❌ Error processing order:', order.orderId, orderError);
        }
      });

      filtered = filteredResult;

      console.log('✅ [EcommerceProfit] Filtered orders:', {
        filteredCount: filtered.length,
        orders: filtered.map(o => ({ orderId: o.orderId, platform: o.platform }))
      });
    } catch (error) {
      console.error('❌ [EcommerceProfit] Error filtering orders:', error);
      filtered = [];
    }
    
    setFilteredOrders(filtered);
    setAllPlatformOrders(allPlatformResult);
  };

  const sumBreakdownValues = (breakdown = {}) => 
    Object.values(breakdown).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);

  const buildExplicitFeeBreakdown = (order) => {
    const breakdown = {};
    Object.entries(FEE_FIELD_MAPPINGS).forEach(([canonicalKey, aliases]) => {
      aliases.forEach(alias => {
        if (order[alias] !== undefined && order[alias] !== null) {
          const amount = parseFloat(order[alias]) || 0;
          if (!amount) return;
          breakdown[canonicalKey] = (breakdown[canonicalKey] || 0) + amount;
        }
      });
    });
    return breakdown;
  };

  const mergeBreakdowns = (primary = {}, secondary = {}) => {
    const merged = { ...primary };
    Object.entries(secondary).forEach(([key, value]) => {
      if (!value) return;
      merged[key] = (merged[key] || 0) + value;
    });
    return merged;
  };

  const sumByKeys = (breakdown = {}, keys = []) =>
    keys.reduce((sum, key) => sum + (parseFloat(breakdown[key]) || 0), 0);

  const resolveStoreKey = (order) => (
    order.storeId ||
    order.storeKey ||
    order.store ||
    order.storeName ||
    (typeof selectedStore === 'object' ? selectedStore?.id : selectedStore) ||
    'default'
  );

  const getPlatformVariations = (platformRaw = '') => {
    const lower = platformRaw.toLowerCase();
    const variations = [platformRaw, lower];

    if (lower.includes('tiktok')) {
      variations.push('TikTok Shop', 'tiktok', 'tik tok');
    } else if (lower.includes('shopee')) {
      variations.push('Shopee');
    } else if (lower.includes('lazada')) {
      variations.push('Lazada');
    } else if (lower.includes('sendo')) {
      variations.push('Sendo');
    } else if (lower.includes('facebook') || lower.includes('fb')) {
      variations.push('Facebook Shop');
    } else if (lower.includes('zalo')) {
      variations.push('Zalo Shop');
    } else if (lower.includes('instagram') || lower.includes('ig')) {
      variations.push('Instagram Shop');
    } else if (lower.includes('tmdt') || lower.includes('ecommerce')) {
      variations.push('TMĐT Khác');
    }

    const capitalized = platformRaw
      ? platformRaw.charAt(0).toUpperCase() + platformRaw.slice(1)
      : '';
    if (capitalized) variations.push(capitalized);

    return Array.from(new Set(variations.filter(Boolean)));
  };

  const getPlatformConfigs = (platformRaw, storeKey) => {
    const platformData = feeSettings.platform || {};
    const variations = getPlatformVariations(platformRaw);

    for (const name of variations) {
      if (platformData[name] && platformData[name][storeKey]) {
        const storeData = platformData[name][storeKey];
        return storeData.feeConfigs || storeData;
      }
    }
    return null;
  };

  const calculateConfiguredFees = (order, revenue) => {
    const storeKey = resolveStoreKey(order);
    const platformBreakdown = {};
    const externalBreakdown = {};
    const packagingBreakdown = {};

    const addAmount = (target, key, amount) => {
      if (!amount) return;
      target[key] = (target[key] || 0) + amount;
    };

    const platformConfigs = getPlatformConfigs(
      order.platform || order.ecommercePlatform || order.source || '',
      storeKey
    );

    if (platformConfigs) {
      Object.entries(platformConfigs).forEach(([key, config]) => {
        if (config && config.enabled) {
          const value = parseFloat(config.value) || 0;
          if (!value) return;
          const amount = config.type === 'percentage'
            ? (revenue * value) / 100
            : value;
          addAmount(platformBreakdown, key, amount);
        }
      });
    }

    const externalConfigs = feeSettings.external?.[storeKey];
    if (externalConfigs) {
      const costs = externalConfigs.costConfigs || externalConfigs;
      Object.entries(costs || {}).forEach(([key, config]) => {
        if (typeof config === 'object') {
          if (!config.enabled) return;
          const amount = parseFloat(config.value) || 0;
          addAmount(externalBreakdown, key, amount);
        } else if (config) {
          addAmount(externalBreakdown, key, parseFloat(config) || 0);
        }
      });
    }

    const packagingConfigs = feeSettings.packaging?.[storeKey];
    if (packagingConfigs) {
      Object.values(packagingConfigs).forEach(packages => {
        if (Array.isArray(packages)) {
          packages.forEach(pkg => {
            if (pkg && pkg.cost) {
              addAmount(packagingBreakdown, 'chiPhiThungDongGoi', pkg.cost);
            }
          });
        } else if (typeof packages === 'object' && packages !== null) {
          Object.values(packages).forEach(pkg => {
            if (pkg && pkg.cost) {
              addAmount(packagingBreakdown, 'chiPhiThungDongGoi', pkg.cost);
            }
          });
        }
      });
    }

    const breakdown = {};
    [platformBreakdown, externalBreakdown, packagingBreakdown].forEach(part => {
      Object.entries(part).forEach(([key, value]) => addAmount(breakdown, key, value));
    });

    return {
      breakdown,
      platformBreakdown,
      externalBreakdown,
      packagingBreakdown,
      totalAmount: sumBreakdownValues(breakdown)
    };
  };

  const calculateStatistics = () => {
    const filteredSource = ordersWithProfit.length ? ordersWithProfit : filteredOrders;
    const allSource = ordersWithProfitAllPlatforms.length ? ordersWithProfitAllPlatforms : allPlatformOrders;

    const sumRevenue = (ordersList) =>
      ordersList.reduce((sum, order) =>
        sum + (parseFloat(
          order.totalAmount !== undefined ? order.totalAmount :
          order.revenue !== undefined ? order.revenue :
          order.subtotal !== undefined ? order.subtotal : 0
        ) || 0), 0);

    const totalRevenue = sumRevenue(filteredSource);
    const totalImportCost = filteredSource.reduce((sum, order) => sum + (parseFloat(order.importCost) || 0), 0);
    const totalFees = filteredSource.reduce((sum, order) => sum + (parseFloat(order.totalFees) || 0), 0);

    const grossProfit = totalRevenue - totalImportCost;
    const netProfit = grossProfit - totalFees;

    const allRevenue = sumRevenue(allSource);
    const allImportCost = allSource.reduce((sum, order) => sum + (parseFloat(order.importCost) || 0), 0);
    const allFees = allSource.reduce((sum, order) => sum + (parseFloat(order.totalFees) || 0), 0);
    const allNetProfit = (allRevenue - allImportCost) - allFees;

    setStatistics({
      totalRevenue,
      totalImportCost,
      totalPlatformFee: totalFees,
      totalProfit: netProfit,
      grossProfit,
      netProfit,
      netProfitAllPlatforms: allNetProfit
    });
  };

  const calculateBestSellingProducts = () => {
    const productMap = {};
    const sourceOrders = ordersWithProfit.length ? ordersWithProfit : filteredOrders;
    
    sourceOrders.forEach(order => {
      const productName = order.productName || 'Sản phẩm không xác định';
      const platform = order.platform?.toLowerCase() || '';
      const key = `${productName}_${platform}`;
      
      if (!productMap[key]) {
        productMap[key] = {
          id: key,
          productName,
          platform: platform || 'N/A',
          soldCount: 0,
          revenue: 0,
          importCost: 0,
          totalFees: 0,
          profit: 0
        };
      }
      
      const revenue = parseFloat(order.totalAmount) || parseFloat(order.subtotal) || 0;
      const importCost = parseFloat(order.importCost) || 0;
      const totalFees = parseFloat(order.totalFees) || 0;
      const netProfit = order.netProfit !== undefined ? order.netProfit : revenue - importCost - totalFees;
      
      productMap[key].soldCount += order.quantity || 1;
      productMap[key].revenue += revenue;
      productMap[key].importCost += importCost;
      productMap[key].totalFees += totalFees;
      productMap[key].profit += netProfit;
    });
    
    const productsArray = Object.values(productMap)
      .map(product => ({
        ...product,
        profitMargin: product.revenue > 0 ? (product.profit / product.revenue) * 100 : 0
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
    
    console.log('📊 Best selling products with detailed profit:', productsArray);
    setBestSellingProducts(productsArray);
  };

  const calculateFeeData = () => {
    const sourceOrders = ordersWithProfit.length ? ordersWithProfit : filteredOrders;

    const aggregateFeeValue = (key) => {
      const aliases = FEE_FIELD_MAPPINGS[key] || [key];
      return sourceOrders.reduce((sum, order) => {
        if (order.feeBreakdown && order.feeBreakdown[key] !== undefined) {
          return sum + (parseFloat(order.feeBreakdown[key]) || 0);
        }
        for (const alias of aliases) {
          if (order[alias] !== undefined && order[alias] !== null) {
            return sum + (parseFloat(order[alias]) || 0);
          }
        }
        return sum;
      }, 0);
    };

    const feeCalculations = {
      phiGiaoDich: aggregateFeeValue('phiGiaoDich'),
      phiHoaHong: aggregateFeeValue('phiHoaHong'),
      phiVanChuyenThucTe: aggregateFeeValue('phiVanChuyenThucTe'),
      giamPhiVcNguoiBan: aggregateFeeValue('giamPhiVcNguoiBan'),
      giamPhiVcTikTokShop: aggregateFeeValue('giamPhiVcTikTokShop'),
      phiVcTaHang: aggregateFeeValue('phiVcTaHang'),
      troGiaVanChuyen: aggregateFeeValue('troGiaVanChuyen'),
      hoaHongLienKet: aggregateFeeValue('hoaHongLienKet'),
      phiVoucherXtra: aggregateFeeValue('phiVoucherXtra'),
      thueTGTCT: aggregateFeeValue('thueTGTCT'),
      thueTNCN: aggregateFeeValue('thueTNCN'),
      giamPhiNguoiBan: aggregateFeeValue('giamPhiNguoiBan'),
      chinhKhachPhiVanChuyen: aggregateFeeValue('chinhKhachPhiVanChuyen'),
      phiKhac: aggregateFeeValue('phiKhac'),
      chiPhiVanChuyen: aggregateFeeValue('chiPhiVanChuyen'),
      chiPhiDongGoi: aggregateFeeValue('chiPhiDongGoi'),
      chiPhiLuuKho: aggregateFeeValue('chiPhiLuuKho'),
      chiPhiNhanVien: aggregateFeeValue('chiPhiNhanVien'),
      chiPhiThueMat: aggregateFeeValue('chiPhiThueMat'),
      chiPhiDienNuoc: aggregateFeeValue('chiPhiDienNuoc'),
      chiPhiBaoHiem: aggregateFeeValue('chiPhiBaoHiem'),
      chiPhiThietBi: aggregateFeeValue('chiPhiThietBi'),
      chiPhiHanhChinh: aggregateFeeValue('chiPhiHanhChinh'),
      chiPhiMarketing: aggregateFeeValue('chiPhiMarketing')
    };

    setFeeData(feeCalculations);
  };

  const exportToExcel = () => {
    const sourceOrders = ordersWithProfit.length ? ordersWithProfit : filteredOrders;

    const totalRevenue = sourceOrders.reduce((sum, order) => 
      sum + (parseFloat(order.totalAmount) || 0), 0);
    const totalPlatformFee = sourceOrders.reduce((sum, order) => 
      sum + (parseFloat(order.platformCost) || 0), 0);
    const totalExternalFee = sourceOrders.reduce((sum, order) => 
      sum + (parseFloat(order.externalCost) || 0), 0);
    const totalPackagingFee = sourceOrders.reduce((sum, order) => 
      sum + (parseFloat(order.packagingCost) || 0), 0);

    const summaryRows = [
      { 'Chỉ tiêu': 'Tổng Doanh Thu TMĐT', 'Giá trị (₫)': totalRevenue },
      { 'Chỉ tiêu': 'Tổng Phí Sàn TMĐT', 'Giá trị (₫)': totalPlatformFee },
      { 'Chỉ tiêu': 'Tổng Chi Phí Bên Ngoài', 'Giá trị (₫)': totalExternalFee },
      { 'Chỉ tiêu': 'Tổng Chi Phí Thùng Đóng Gói', 'Giá trị (₫)': totalPackagingFee },
      {}
    ];

    const exportData = sourceOrders.map(order => ({
      'Mã đơn': order.orderId || order.id,
      'Ngày': dayjs(order.orderDate || order.createdAt).format('DD/MM/YYYY'),
      'Sàn TMĐT': order.platform || order.ecommercePlatform || '',
      'Cửa hàng': order.storeName || '',
      'Sản phẩm': order.productName || '',
      'Số lượng': order.quantity || 0,
      'Doanh thu (₫)': order.totalAmount || 0,
      'Chi phí Sàn TMĐT (₫)': order.platformCost || 0,
      'Chi phí Bên Ngoài (₫)': order.externalCost || 0,
      'Chi phí Thùng Đóng Gói (₫)': order.packagingCost || 0,
      'Chi phí nhập (₫)': order.importCost || 0
    }));

    const ws = XLSX.utils.json_to_sheet([...summaryRows, ...exportData]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Lợi nhuận TMĐT');
    XLSX.writeFile(wb, `loi-nuan-tmdt-${dayjs().format('YYYY-MM-DD')}.xlsx`);
  };

  const columns = [
    {
      title: 'Mã Đơn',
      dataIndex: 'orderId',
      key: 'orderId',
      width: 150,
      fixed: 'left',
      render: (text, record) => text || record.id
    },
    {
      title: 'Sản phẩm',
      dataIndex: 'productName',
      key: 'productName',
      ellipsis: true,
      render: (text, record) => {
        // Data đã được flatten, chỉ cần lấy direct property
        return record.productName || text || 'N/A';
      }
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
      render: (text, record) => record.sku || text || 'N/A'
    },
    {
      title: 'Số lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'center',
      render: (text, record) => record.quantity || text || 0
    },
    {
      title: 'Giá Nhập (VNĐ)',
      dataIndex: 'importPrice',
      key: 'importPrice',
      width: 130,
      align: 'right',
      render: (price) => {
        // Đảm bảo giá nhập là số dương
        const importPrice = Math.abs(price || 0);
        return new Intl.NumberFormat('vi-VN').format(importPrice) + ' ₫';
      }
    },
    {
      title: 'Giá Bán (VNĐ)',
      dataIndex: 'sellingPrice',
      key: 'sellingPrice',
      width: 130,
      align: 'right',
      render: (price, record) => {
        console.log('💰 Rendering sellingPrice:', {
          orderId: record.orderId,
          price,
          recordSellingPrice: record.sellingPrice,
          recordImportPrice: record.importPrice
        });
        return new Intl.NumberFormat('vi-VN').format(price || 0) + ' ₫';
      }
    },
    {
      title: 'Doanh Thu',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 150,
      align: 'right',
      render: (amount) => (
        <Text strong style={{ color: '#1890ff' }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0)}
        </Text>
      )
    },
    {
      title: 'Lợi Nhuận',
      key: 'profit',
      width: 150,
      align: 'right',
      render: (_, record) => {
        // Tính lợi nhuận từ giá bán và giá nhập
        let profit = record.totalProfit;
        if (!profit && record.sellingPrice && record.importPrice) {
          profit = record.sellingPrice - Math.abs(record.importPrice);
        }
        
        // Khác 0 thì mới hiển thị màu
        return (
          <Text strong style={{ color: profit > 0 ? '#52c41a' : (profit < 0 ? '#ff4d4f' : 'inherit') }}>
            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(profit || 0)}
          </Text>
        );
      }
    },
    {
      title: 'Tỷ lệ LN',
      key: 'profitMargin',
      width: 100,
      align: 'center',
      render: (_, record) => {
        // Tính lợi nhuận từ giá bán và giá nhập nếu không có sẵn
        let profit = record.totalProfit;
        if (!profit && record.sellingPrice && record.importPrice) {
          profit = record.sellingPrice - Math.abs(record.importPrice);
        }
        
        // Sử dụng giá bán thay vì totalAmount nếu có
        const total = record.sellingPrice || record.totalAmount || 1;
        const margin = (profit / total) * 100;
        
        return (
          <Tag color={margin >= 30 ? 'green' : margin >= 15 ? 'orange' : 'red'}>
            {margin.toFixed(1)}%
          </Tag>
        );
      }
    },
    {
      title: 'Sàn TMĐT',
      dataIndex: 'platform',
      key: 'platform',
      width: 120,
      render: (platform) => {
        const platformNames = {
          'tiktok': 'TikTok Shop',
          'shopee': 'Shopee',
          'lazada': 'Lazada',
          'sendo': 'Sendo'
        };
        return platformNames[platform] || platform || 'N/A';
      }
    },
    {
      title: 'Cửa Hàng',
      dataIndex: 'storeName',
      key: 'store',
      width: 120
    },
    {
      title: 'Ngày',
      dataIndex: 'orderDate',
      key: 'date',
      width: 110,
      render: (date) => dayjs(date).format('DD/MM/YYYY')
    },
    {
      title: 'Thao Tác',
      key: 'action',
      width: 80,
      align: 'center',
      render: () => (
        <Button type="link" size="small">
          Xem
        </Button>
      )
    }
  ];

  const displayedOrders = ordersWithProfit.length ? ordersWithProfit : filteredOrders;

  return (
    <div style={{ padding: '24px', background: '#f5f5f5', minHeight: '100vh' }}>
      {/* Page Header */}
      <div style={{ 
        background: 'white', 
        padding: '16px 24px', 
        marginBottom: '24px',
        borderRadius: '8px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <ShoppingOutlined style={{ fontSize: '24px', color: '#127e03ff' }} />
          <Title level={2} style={{ margin: 0, color: '#127e03ff' ,fontWeight: 'bold'}}>Lợi Nhuận Đơn TMĐT</Title>
        </div>
        <Text type="secondary">Phân tích lợi nhuận từ các đơn hàng thương mại điện tử</Text>
      </div>

      <div style={{ background: 'white', padding: '24px', borderRadius: '8px' }}>

      {/* Filters */}
      <EcommerceFilters
        dateRange={dateRange}
        setDateRange={setDateRange}
        selectedStore={selectedStore?.id || 'all'}
        selectedPlatform={selectedPlatform}
        setSelectedPlatform={setSelectedPlatform}
        stores={stores}
        platforms={platforms}
        expenseFilters={expenseFilters}
        setExpenseFilters={setExpenseFilters}
      />

      {/* Statistics */}
      <EcommerceStatistics 
        statistics={statistics} 
        selectedPlatformLabel={selectedPlatform === 'all' ? 'Tất Cả Sàn' : selectedPlatform}
      />

      {/* Fee Selector - Chọn Phí Hiển Thị chi tiết các khoản phí*/}
      <FeeSelector 
        expenseFilters={expenseFilters}
        setExpenseFilters={setExpenseFilters}
      />

      {/* Fee Display Cards */}
      <FeeDisplayCards 
        selectedFees={expenseFilters} 
        feeData={feeData}
        customCosts={customCosts}
      />

      {/* Best Selling Products */}
      <BestSellingProducts 
        products={bestSellingProducts} 
        loading={loading} 
      />

      {/* Orders Table */}
      <EcommerceOrdersTable
        orders={displayedOrders}
        loading={loading}
        searchText={searchText}
        setSearchText={setSearchText}
        onExportExcel={exportToExcel}
        selectedStore={selectedStore ? selectedStore.id : 'all'}  // Truyền ID hoặc 'all' nếu không chọn cửa hàng
      />
      </div>
    </div>
  );
};

export default EcommerceProfit;
