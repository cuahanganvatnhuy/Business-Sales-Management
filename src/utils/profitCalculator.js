import { database } from '../services/firebase.service';
import { ref, get } from 'firebase/database';

/**
 * Tính toán lợi nhuận chi tiết cho đơn hàng TMĐT
 * @param {Object} orderData - Dữ liệu đơn hàng
 * @param {string} platform - Sàn TMĐT (TikTok Shop, Shopee, etc.)
 * @param {string} storeId - ID cửa hàng
 * @returns {Object} Chi tiết lợi nhuận
 */
export const calculateOrderProfit = async (orderData, platform, storeId = 'all') => {
  try {
    console.log('🧮 [profitCalculator] Starting calculation:', { platform, storeId });
    console.log('🧮 [profitCalculator] Order data:', orderData);

    // 1. Tính doanh thu và chi phí hàng hóa cơ bản
    let revenue = 0;
    let costOfGoods = 0;
    let totalWeight = 0;

    orderData.items.forEach(item => {
      revenue += item.sellingPrice * item.quantity;
      costOfGoods += item.importPrice * item.quantity;
      // Tính khối lượng (giả sử có trường weight, nếu không thì dùng quantity * 0.5kg)
      totalWeight += (item.weight || 0.5) * item.quantity;
    });

    const grossProfit = revenue - costOfGoods;

    console.log('💰 [profitCalculator] Basic calculation:', { revenue, costOfGoods, grossProfit, totalWeight });

    // 2. Load cấu hình phí sàn
    console.log('🏪 [profitCalculator] Loading platform fees for:', platform, storeId);
    const platformFees = await loadPlatformFees(platform, storeId);
    const platformFeeCost = calculatePlatformFees(revenue, platformFees);
    console.log('🏪 [profitCalculator] Platform fees:', { platformFees, platformFeeCost });

    // 3. Load chi phí bên ngoài
    console.log('🏢 [profitCalculator] Loading external costs for:', storeId);
    const externalCosts = await loadExternalCosts(storeId);
    const externalCostAmount = calculateExternalCosts(revenue, externalCosts);
    console.log('🏢 [profitCalculator] External costs:', { externalCosts, externalCostAmount });

    // 4. Load chi phí thùng đóng gói
    console.log('📦 [profitCalculator] Loading packaging costs for:', storeId);
    const packagingCosts = await loadPackagingCosts(storeId);
    const packagingCostAmount = calculatePackagingCosts(totalWeight, orderData.productType || 'hangKho', packagingCosts);
    console.log('📦 [profitCalculator] Packaging costs:', { packagingCosts, packagingCostAmount });

    // 5. Tính tổng chi phí và lợi nhuận cuối
    const totalFees = platformFeeCost + externalCostAmount + packagingCostAmount;
    const netProfit = grossProfit - totalFees;
    const profitMargin = revenue > 0 ? (netProfit / revenue) * 100 : 0;

    const result = {
      // Doanh thu và chi phí cơ bản
      revenue,
      costOfGoods,
      grossProfit,
      
      // Chi phí chi tiết
      platformFeeCost,
      externalCostAmount,
      packagingCostAmount,
      totalFees,
      
      // Lợi nhuận cuối
      netProfit,
      profitMargin,
      
      // Thông tin bổ sung
      totalWeight,
      breakdown: {
        platformFees: platformFees.breakdown || [],
        externalCosts: externalCosts.breakdown || [],
        packagingCosts: packagingCosts.breakdown || []
      }
    };

    console.log('✅ Profit calculation result:', result);
    return result;

  } catch (error) {
    console.error('❌ Error calculating profit:', error);
    return {
      revenue: 0,
      costOfGoods: 0,
      grossProfit: 0,
      platformFeeCost: 0,
      externalCostAmount: 0,
      packagingCostAmount: 0,
      totalFees: 0,
      netProfit: 0,
      profitMargin: 0,
      totalWeight: 0,
      breakdown: { platformFees: [], externalCosts: [], packagingCosts: [] },
      error: error.message
    };
  }
};

/**
 * Load cấu hình phí sàn từ Firebase
 */
const loadPlatformFees = async (platform, storeId) => {
  try {
    // Map platform display name to key
    const platformKeyMap = {
      'TikTok Shop': 'tiktok',
      'Shopee': 'shopee',
      'Lazada': 'lazada',
      'Sendo': 'sendo',
      'Facebook Shop': 'facebook',
      'Zalo Shop': 'zalo',
      'Tiki': 'tiki',
      'Khác': 'other'
    };
    
    const platformKey = platformKeyMap[platform] || platform.toLowerCase();
    console.log('🔍 [loadPlatformFees] Platform mapping:', { platform, platformKey });
    
    const settingsRef = ref(database, `platformFeeSettings/${platformKey}/${storeId}`);
    const snapshot = await get(settingsRef);
    const data = snapshot.val();
    
    console.log('🔍 [loadPlatformFees] Firebase data:', data);
    
    if (!data) {
      console.log('⚠️ No platform fee settings found for', platformKey, storeId);
      return { feeConfigs: {}, customFees: [], breakdown: [] };
    }

    return {
      feeConfigs: data.feeConfigs || {},
      customFees: data.customFees || [],
      breakdown: []
    };
  } catch (error) {
    console.error('❌ Error loading platform fees:', error);
    return { feeConfigs: {}, customFees: [], breakdown: [] };
  }
};

/**
 * Tính phí sàn dựa trên cấu hình
 */
const calculatePlatformFees = (revenue, platformFees) => {
  let totalCost = 0;
  const breakdown = [];

  // Tính phí cơ bản
  Object.entries(platformFees.feeConfigs || {}).forEach(([key, config]) => {
    if (config.enabled && config.value > 0) {
      let cost = 0;
      if (config.type === 'percentage') {
        cost = (revenue * config.value) / 100;
      } else {
        cost = config.value;
      }
      
      totalCost += cost;
      breakdown.push({
        name: getFeeDisplayName(key),
        type: config.type,
        value: config.value,
        cost,
        isCustom: false
      });
    }
  });

  // Tính phí tùy chỉnh
  (platformFees.customFees || []).forEach(fee => {
    if (platformFees.feeConfigs[fee.key]?.enabled && fee.value > 0) {
      let cost = 0;
      if (fee.type === 'percentage') {
        cost = (revenue * fee.value) / 100;
      } else {
        cost = fee.value;
      }
      
      totalCost += cost;
      breakdown.push({
        name: fee.label,
        type: fee.type,
        value: fee.value,
        cost,
        isCustom: true
      });
    }
  });

  platformFees.breakdown = breakdown;
  return totalCost;
};

/**
 * Load chi phí bên ngoài từ Firebase
 */
const loadExternalCosts = async (storeId) => {
  try {
    const settingsRef = ref(database, `externalCostSettings/${storeId}`);
    const snapshot = await get(settingsRef);
    const data = snapshot.val();
    
    if (!data) {
      console.log('⚠️ No external cost settings found for', storeId);
      return { costConfigs: {}, customCosts: [], breakdown: [] };
    }

    return {
      costConfigs: data.costConfigs || {},
      customCosts: data.customCosts || [],
      breakdown: []
    };
  } catch (error) {
    console.error('❌ Error loading external costs:', error);
    return { costConfigs: {}, customCosts: [], breakdown: [] };
  }
};

/**
 * Tính chi phí bên ngoài
 */
const calculateExternalCosts = (revenue, externalCosts) => {
  let totalCost = 0;
  const breakdown = [];

  // Tính chi phí cơ bản
  Object.entries(externalCosts.costConfigs || {}).forEach(([key, config]) => {
    if (config.enabled && config.value > 0) {
      let cost = 0;
      if (config.type === 'percentage') {
        cost = (revenue * config.value) / 100;
      } else {
        cost = config.value;
      }
      
      totalCost += cost;
      breakdown.push({
        name: getCostDisplayName(key),
        type: config.type,
        value: config.value,
        cost,
        isCustom: false
      });
    }
  });

  // Tính chi phí tùy chỉnh
  (externalCosts.customCosts || []).forEach(cost => {
    if (externalCosts.costConfigs[cost.key]?.enabled && cost.value > 0) {
      let costAmount = 0;
      if (cost.type === 'percentage') {
        costAmount = (revenue * cost.value) / 100;
      } else {
        costAmount = cost.value;
      }
      
      totalCost += costAmount;
      breakdown.push({
        name: cost.label,
        type: cost.type,
        value: cost.value,
        cost: costAmount,
        isCustom: true
      });
    }
  });

  externalCosts.breakdown = breakdown;
  return totalCost;
};

/**
 * Load chi phí thùng đóng gói từ Firebase
 */
const loadPackagingCosts = async (storeId) => {
  try {
    const settingsRef = ref(database, `packagingCostSettings/${storeId}`);
    const snapshot = await get(settingsRef);
    const data = snapshot.val();
    
    if (!data) {
      console.log('⚠️ No packaging cost settings found for', storeId);
      return { hangLanh: [], hangKho: [], hangNuoc: [], breakdown: [] };
    }

    return {
      hangLanh: data.hangLanh || [],
      hangKho: data.hangKho || [],
      hangNuoc: data.hangNuoc || [],
      breakdown: []
    };
  } catch (error) {
    console.error('❌ Error loading packaging costs:', error);
    return { hangLanh: [], hangKho: [], hangNuoc: [], breakdown: [] };
  }
};

/**
 * Tính chi phí thùng đóng gói theo khối lượng
 */
const calculatePackagingCosts = (totalWeight, productType, packagingCosts) => {
  const rules = packagingCosts[productType] || packagingCosts.hangKho || [];
  
  // Tìm rule phù hợp với khối lượng
  const matchingRule = rules.find(rule => 
    totalWeight >= rule.minWeight && totalWeight <= rule.maxWeight
  );

  if (matchingRule) {
    packagingCosts.breakdown = [{
      name: `Thùng ${productType} (${matchingRule.minWeight}kg - ${matchingRule.maxWeight}kg)`,
      type: 'fixed',
      value: matchingRule.cost,
      cost: matchingRule.cost,
      description: matchingRule.description,
      note: matchingRule.note
    }];
    return matchingRule.cost;
  }

  packagingCosts.breakdown = [];
  return 0;
};

/**
 * Mapping tên hiển thị cho phí sàn
 */
const getFeeDisplayName = (key) => {
  const feeNames = {
    phiGiaoDich: 'Phí Giao Dịch',
    phiHoaHong: 'Phí Hoa Hồng',
    phiVanChuyenThucTe: 'Phí Vận Chuyển Thực Tế',
    chietKhauPhiVanChuyen: 'Chiết Khấu Phí Vận Chuyển',
    giamPhiVcNguoiBan: 'Giảm Phí VC Người Bán',
    giamPhiVcTikTokShop: 'Giảm Phí VC TikTok Shop',
    phiVcTraHang: 'Phí VC Trả Hàng',
    troGiaVanChuyen: 'Trợ Giá Vận Chuyển',
    hoaHongLienKet: 'Hoa Hồng Liên Kết',
    phiVoucherXtra: 'Phí Voucher Xtra',
    thueTGTCT: 'Thuế GTGT',
    thueTNCN: 'Thuế TNCN',
    giamGiaNguoiBan: 'Giảm Giá Người Bán'
  };
  return feeNames[key] || key;
};

/**
 * Mapping tên hiển thị cho chi phí bên ngoài
 */
const getCostDisplayName = (key) => {
  const costNames = {
    chiPhiVanChuyen: 'Chi Phí Vận Chuyển',
    chiPhiDongGoi: 'Chi Phí Đóng Gói',
    chiPhiLuuKho: 'Chi Phí Lưu Kho',
    chiPhiMarketing: 'Chi Phí Marketing',
    chiPhiNhanVien: 'Chi Phí Nhân Viên',
    chiPhiThueMat: 'Chi Phí Thuê Mặt Bằng',
    chiPhiDienNuoc: 'Chi Phí Điện Nước',
    chiPhiBaoHiem: 'Chi Phí Bảo Hiểm',
    chiPhiThietBi: 'Chi Phí Thiết Bị',
    chiPhiHanhChinh: 'Chi Phí Hành Chính'
  };
  return costNames[key] || key;
};

/**
 * Format tiền tệ
 */
export const formatCurrency = (amount) => {
  return new Intl.NumberFormat('vi-VN', {
    style: 'currency',
    currency: 'VND'
  }).format(amount);
};

/**
 * Format phần trăm
 */
export const formatPercentage = (value) => {
  return `${value.toFixed(2)}%`;
};
