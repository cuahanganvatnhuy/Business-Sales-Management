import React, { useState, useEffect } from 'react';
import { Modal, Card, Row, Col, Typography, Divider, Button, Space, message } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { database } from '../../../services/firebase.service';
import { ref, onValue, update } from 'firebase/database';

const { Title, Text } = Typography;

const OrderDetailModal = ({ visible, onClose, orderData, selectedStore }) => {
  const [loading, setLoading] = useState(false);
  const [feeSettings, setFeeSettings] = useState({
    // Chi phí sàn TMĐT
    phiGiaoDich: 0,
    phiHoaHong: 0,
    phiVanChuyenThucTe: 0,
    giamPhiVcNguoiBan: 0,
    phiVcTaHang: 0,
    troGiaVanChuyen: 0,
    hoaHongLienKet: 0,
    phiVoucherXtra: 0,
    thueTGTCT: 0,
    thueTNCN: 0,
    giamPhiNguoiBan: 0,
    chinhKhachPhiVanChuyen: 0,
    phiKhac: 0,
    // Chi phí bên ngoài
    chiPhiVanChuyen: 0,
    chiPhiDongGoi: 0,
    chiPhiLuuKho: 0,
    chiPhiNhanVien: 0,
    chiPhiThueMat: 0,
    chiPhiDienNuoc: 0,
    chiPhiBaoHiem: 0,
    chiPhiThietBi: 0,
    chiPhiHanhChinh: 0,
    chiPhiMarketing: 0
  });

  useEffect(() => {
    if (visible && orderData) {
      loadFeeSettings().then(() => {
        // Sau khi load xong, tính và lưu netProfit vào database
        setTimeout(() => {
          const profit = calculateProfitDetails();
          
          if (orderData && profit.netProfit !== undefined) {
            // Thử nhiều path có thể có
            const paths = [
              `orders/${orderData.id}`,
              `orders/${orderData.orderId}`, 
              `ecommerceOrders/${orderData.id}`,
              `ecommerceOrders/${orderData.orderId}`
            ];
            
            paths.forEach(async (path) => {
              try {
                const orderRef = ref(database, path);
                await update(orderRef, { netProfit: profit.netProfit });
                console.log(`✅ Saved netProfit: ${profit.netProfit} to ${path}`);
              } catch (error) {
                console.log(`❌ Failed to save to ${path}:`, error.message);
              }
            });
          }
        }, 2000); // Tăng thời gian chờ lên 2s
      });
    }
  }, [visible, orderData]);

  const debugAllFeeData = async () => {
    console.log('🔍 === DEBUG: LOADING ALL FEE DATA FROM FIREBASE ===');
    
    try {
      // 1. Load toàn bộ platformFeeSettings
      console.log('📊 1. Loading ALL platformFeeSettings...');
      const platformSnapshot = await new Promise(resolve => {
        const ref1 = ref(database, 'platformFeeSettings');
        onValue(ref1, resolve, { onlyOnce: true });
      });
      const allPlatformData = platformSnapshot.val();
      console.log('📊 ALL PLATFORM DATA:', allPlatformData);
      
      // 2. Load toàn bộ externalCostSettings  
      console.log('📊 2. Loading ALL externalCostSettings...');
      const externalSnapshot = await new Promise(resolve => {
        const ref2 = ref(database, 'externalCostSettings');
        onValue(ref2, resolve, { onlyOnce: true });
      });
      const allExternalData = externalSnapshot.val();
      console.log('📊 ALL EXTERNAL DATA:', allExternalData);
      
      // 3. Load toàn bộ packagingCostSettings
      console.log('📊 3. Loading ALL packagingCostSettings...');
      const packagingSnapshot = await new Promise(resolve => {
        const ref3 = ref(database, 'packagingCostSettings');
        onValue(ref3, resolve, { onlyOnce: true });
      });
      const allPackagingData = packagingSnapshot.val();
      console.log('📊 ALL PACKAGING DATA:', allPackagingData);
      
      return { allPlatformData, allExternalData, allPackagingData };
    } catch (error) {
      console.error('❌ Error loading debug data:', error);
      return null;
    }
  };

  const loadFeeSettings = async () => {
    try {
      const platform = orderData?.platform || 'Unknown';
      // Dùng CÙNG LOGIC với bảng danh sách để đảm bảo consistency
      let mappedStore = selectedStore;
      
      // Chỉ sử dụng cửa hàng cụ thể được chọn (không còn fallback về "all")
      if (!selectedStore) {
        mappedStore = orderData?.storeName || orderData?.store || 'default'; // Dùng store từ record
      } else {
        mappedStore = selectedStore; // Dùng store được chọn
      }
      
      const store = mappedStore || orderData?.storeName || orderData?.store;
      const revenue = orderData?.totalAmount || 0;
      
      console.log('🔧 [MODAL] Loading fee settings for:', { platform, store, revenue });
      console.log('🔧 [MODAL] Store mapping:', {
        selectedStore,
        mappedStore,
        orderStoreName: orderData?.storeName,
        orderStore: orderData?.store,
        finalStore: store
      });
      console.log('🔧 [MODAL] Order data platform info:', {
        platform: orderData?.platform,
        storeName: orderData?.storeName,
        ecommercePlatform: orderData?.ecommercePlatform,
        source: orderData?.source,
        orderType: orderData?.orderType
      });
      
      console.log('🎯 LOGIC: Sẽ tìm chi phí tại đường dẫn:', `platformFeeSettings/${platform}/${store}`);
      
    
      
      // FIRST: Debug toàn bộ dữ liệu
      const debugData = await debugAllFeeData();
      if (!debugData) return;
      
      const { allPlatformData, allExternalData, allPackagingData } = debugData;
      
      // Sau khi có toàn bộ dữ liệu, tìm đúng path cho platform/store
      console.log('🔍 Analyzing data structure...');
      
      let platformData = null;
      let externalData = null;
      let packagingData = null;
      
      // Tìm platform data với nhiều variations
      if (allPlatformData) {
        console.log('🔍 Looking for platform data...');
        console.log('Available platforms in Firebase:', Object.keys(allPlatformData));
        
        // Thử platform gốc TRƯỚC, sau đó mới thử variations khác
        const platformVariations = [
          platform, // Giá trị gốc từ order data - ưu tiên cao nhất
        ];
        
    
        
        // Thêm case-insensitive matching cho platforms đã có
        if (!allPlatformData[platform]) {
          console.log(`🔍 Platform "${platform}" not found, trying case-insensitive match...`);
          
          // Chỉ thử match với platforms thực sự tồn tại
          const availablePlatforms = Object.keys(allPlatformData);
          console.log('📋 Available platforms:', availablePlatforms);
          
          // Thử match case-insensitive
          const lowerPlatform = platform.toLowerCase();
          for (const availablePlatform of availablePlatforms) {
            if (availablePlatform.toLowerCase() === lowerPlatform || 
                availablePlatform.toLowerCase().includes(lowerPlatform) ||
                lowerPlatform.includes(availablePlatform.toLowerCase())) {
              console.log(`✅ Found case-insensitive match: "${platform}" → "${availablePlatform}"`);
              platformVariations.push(availablePlatform);
              break;
            }
          }
          
          if (platformVariations.length === 1) {
            console.log(`❌ No match found for "${platform}"`);
            console.log('💡 Cần tạo cấu hình cho platform này trong Firebase');
          }
        }
        
        let foundPlatform = null;
        console.log(`🔍 Trying to match platform "${platform}" with variations:`, platformVariations);
        
        for (const platformName of platformVariations) {
          console.log(`  - Checking: "${platformName}" → exists: ${!!allPlatformData[platformName]}`);
          if (allPlatformData[platformName]) {
            foundPlatform = platformName;
            console.log(`✅ Found platform match: ${platformName} (searched for: ${platform})`);
            
            break;
          }
        }
        
        if (!foundPlatform) {
          console.log(`❌ NO MATCH for "${platform}"`);
          console.log('Available platforms:', Object.keys(allPlatformData));
        }
        
        if (foundPlatform) {
          console.log(`📊 Found platform ${foundPlatform}:`, allPlatformData[foundPlatform]);
          
          // Debug tất cả stores trong platform
          const allStores = Object.keys(allPlatformData[foundPlatform]);
          console.log(`🏪 Available stores in ${foundPlatform}:`, allStores);
          
          // DÙNG LOGIC GIỐNG BẢNG - CHỈ tìm kiếm store cụ thể
          console.log(`🔍 [MODAL] Looking for specific store: "${store}" in platform ${foundPlatform}`);
          
          // CHỈ tìm kiếm store cụ thể, KHÔNG fallback
          if (allPlatformData[foundPlatform][store]) {
            const storeData = allPlatformData[foundPlatform][store];
            platformData = storeData.feeConfigs || storeData;
            console.log(`✅ [MODAL] Using platform data from store: ${store}`);
            console.log('📊 [MODAL] Platform fee configs:', platformData);
            
            // Debug từng fee config
            Object.entries(platformData).forEach(([key, config]) => {
              if (config && config.enabled === true && config.type === 'fixed') {
                console.log(`✅ [MODAL] Added platform fee ${key}: ${config.value}`);
              }
            });
          } else {
            console.log(`❌ [MODAL] No platform data found for store: ${store}`);
            console.log(`🔍 [MODAL] Available stores in ${foundPlatform}:`, Object.keys(allPlatformData[foundPlatform]));
          }
        } else {
          console.log(`❌ No platform match found for ${platform}`);
          console.log('Available platforms:', Object.keys(allPlatformData));
          console.log('🔍 Tried variations:', platformVariations);
          
          // FORCE CLEAR - không có chi phí sàn nào
          console.log(`⚠️ Platform ${platform} chưa được cấu hình chi phí sàn - FORCE CLEAR tất cả chi phí sàn`);
          
          // Set empty fee settings ngay lập tức
          setFeeSettings({});
          return; // Thoát sớm, không xử lý gì thêm
        }
      }
      
      // Tìm external data - DÙNG LOGIC GIỐNG BẢNG
      if (allExternalData) {
        console.log('🔍 [MODAL] Looking for external data...');
        
        // CHỈ tìm kiếm store cụ thể, KHÔNG lấy store đầu tiên
        if (allExternalData[store]) {
          console.log(`✅ [MODAL] Found external data for store: ${store}`);
          const storeData = allExternalData[store];
          externalData = storeData.costConfigs || storeData;
          console.log('📊 [MODAL] External cost configs:', externalData);
        } else {
          console.log(`❌ [MODAL] No external data found for store: ${store}`);
          console.log(`� [MODAL] Available stores in external data:`, Object.keys(allExternalData));
        }
      }
      
      // Tìm packaging data - DÙNG LOGIC GIỐNG BẢNG
      if (allPackagingData) {
        console.log('🔍 [MODAL] Looking for packaging data...');
        
        // CHỈ tìm kiếm store cụ thể, KHÔNG lấy store đầu tiên
        if (allPackagingData[store]) {
          console.log(`✅ [MODAL] Found packaging data for store: ${store}`);
          packagingData = allPackagingData[store];
          console.log('📊 [MODAL] Packaging configs:', packagingData);
        } else {
          console.log(`❌ [MODAL] No packaging data found for store: ${store}`);
          console.log(`� [MODAL] Available stores in packaging data:`, Object.keys(allPackagingData));
        }
      }

      const actualFees = {};
      
      // 1. Process Platform Fees
      console.log('📊 Platform data:', platformData);
      if (platformData) {
        console.log('🔍 DETAILED PLATFORM ANALYSIS:');
        Object.entries(platformData).forEach(([key, config]) => {
          console.log(`  - Processing ${key}:`, config);
          console.log(`    - enabled: ${config?.enabled}`);
          console.log(`    - type: ${config?.type}`);
          console.log(`    - value: ${config?.value}`);
          
          if (config && config.enabled === true) {
            if (config.type === 'percentage') {
              const feeAmount = (revenue * config.value) / 100;
              actualFees[key] = feeAmount;
              console.log(`    ✅ ${key}: ${feeAmount} VNĐ (${config.value}% of ${revenue})`);
            } else if (config.type === 'fixed') {
              actualFees[key] = config.value || 0;
              console.log(`    ✅ ${key}: ${config.value} VNĐ (fixed)`);
            }
          } else {
            actualFees[key] = 0;
            console.log(`    ❌ ${key}: DISABLED (enabled=${config?.enabled})`);
          }
        });
      } else {
        console.log('❌ No platform fee data found');
        console.log('🔍 Trying to load platform data directly from Firebase...');
        
        // Try to load platform data directly
        try {
          const directSnapshot = await new Promise(resolve => {
            const ref1 = ref(database, 'platformFeeSettings');
            onValue(ref1, resolve, { onlyOnce: true });
          });
          const directData = directSnapshot.val();
          console.log('📊 Direct platform data:', directData);
          
          if (directData && directData[platform]) {
            const platformData = directData[platform];
            console.log(`📊 ${platform} data:`, platformData);
            
            // Find any store with feeConfigs
            for (const [storeKey, storeData] of Object.entries(platformData)) {
              if (storeData && storeData.feeConfigs) {
                console.log(`🎯 Found feeConfigs in store ${storeKey}:`, storeData.feeConfigs);
                
                Object.entries(storeData.feeConfigs).forEach(([key, config]) => {
                  console.log(`  - Processing direct ${key}:`, config);
                  if (config && config.enabled === true) {
                    if (config.type === 'percentage') {
                      const feeAmount = (revenue * config.value) / 100;
                      actualFees[key] = feeAmount;
                      console.log(`    ✅ Direct ${key}: ${feeAmount} VNĐ (${config.value}% of ${revenue})`);
                    } else if (config.type === 'fixed') {
                      actualFees[key] = config.value || 0;
                      console.log(`    ✅ Direct ${key}: ${config.value} VNĐ (fixed)`);
                    }
                  }
                });
                break; // Use first store found
              }
            }
          } else {
            console.log(`❌ No platform data found for ${platform}`);
            console.log('Available platforms:', Object.keys(directData || {}));
            
            // Nếu không tìm thấy platform cụ thể, không áp dụng chi phí sàn nào
            console.log(`⚠️ Platform ${platform} chưa được cấu hình chi phí sàn`);
          }
        } catch (error) {
          console.error('❌ Error loading direct platform data:', error);
        }
      }

      // 2. Process External Fees
      console.log('📊 [MODAL] External data:', externalData);
      console.log('📊 [MODAL] External data type:', typeof externalData);
      console.log('📊 [MODAL] External data keys:', externalData ? Object.keys(externalData) : 'null');
      if (externalData) {
        // Check if externalData has costConfigs property
        const costConfigs = externalData.costConfigs || externalData;
        console.log('📊 Cost configs:', costConfigs);
        
        if (costConfigs) {
          Object.entries(costConfigs).forEach(([key, config]) => {
            console.log(`  - Processing external ${key}:`, config);
            if (config && config.enabled) {
              if (config.type === 'percentage') {
                const feeAmount = (revenue * config.value) / 100;
                actualFees[key] = feeAmount;
                console.log(`    ✅ External ${key}: ${feeAmount} (${config.value}% of ${revenue})`);
              } else {
                actualFees[key] = config.value || 0;
                console.log(`    ✅ External ${key}: ${config.value} (fixed)`);
              }
            } else {
              actualFees[key] = 0;
              console.log(`    ❌ External ${key}: disabled or invalid config`);
            }
          });
        }
      } else {
        console.log('❌ No external fee data found');
      }

      // 3. Process Packaging Fees
      console.log('📊 [MODAL] Packaging data:', packagingData);
      console.log('📊 [MODAL] Packaging data type:', typeof packagingData);
      console.log('📊 [MODAL] Packaging data keys:', packagingData ? Object.keys(packagingData) : 'null');
      if (packagingData) {
        // Lấy chi phí thùng đóng gói từ cài đặt
        let packagingCost = 0;
        
        // Duyệt qua các loại thùng đã cài đặt (hangLanh, hangKho, etc.)
        Object.entries(packagingData).forEach(([packageType, packages]) => {
          console.log(`  - Package type ${packageType}:`, packages);
          if (packages && Array.isArray(packages)) {
            // packages là array, lấy item đầu tiên
            const firstPackage = packages[0];
            if (firstPackage && firstPackage.cost) {
              packagingCost = firstPackage.cost;
              // Lưu thông tin chi tiết thùng
              actualFees[`chiPhiThung_${packageType}`] = {
                cost: firstPackage.cost,
                description: firstPackage.description || 'Thùng đóng gói',
                type: packageType,
                weight: `${firstPackage.minWeight || 0} - ${firstPackage.maxWeight || 0} kg`
              };
              console.log(`    ✅ Using packaging cost from ${packageType}: ${packagingCost}`);
            }
          } else if (packages && typeof packages === 'object') {
            // packages là object, duyệt qua từng item
            Object.entries(packages).forEach(([packageName, packageInfo]) => {
              console.log(`    - Package ${packageName}:`, packageInfo);
              if (packageInfo && packageInfo.cost && packagingCost === 0) {
                packagingCost = packageInfo.cost;
                // Lưu thông tin chi tiết thùng
                actualFees[`chiPhiThung_${packageType}`] = {
                  cost: packageInfo.cost,
                  description: packageInfo.description || 'Thùng đóng gói',
                  type: packageType,
                  weight: `${packageInfo.minWeight || 0} - ${packageInfo.maxWeight || 0} kg`
                };
                console.log(`    ✅ Using packaging cost: ${packagingCost}`);
              }
            });
          }
        });
        
        // Không cần lưu chiPhiThung nữa vì đã lưu chi tiết
        console.log('📦 Final packaging cost (thùng):', packagingCost);
      } else {
        console.log('❌ No packaging data found');
      }

      console.log('💰 Final calculated fees:', actualFees);
      setFeeSettings(actualFees);
      
    } catch (error) {
      console.error('❌ Error loading fee settings:', error);
      // Không fallback về TikTok Shop nữa - để trống
      console.log('⚠️ Error occurred - setting empty fee settings');
      setFeeSettings({});
    }
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { 
      style: 'currency', 
      currency: 'VND' 
    }).format(amount || 0);
  };

  const calculateProfitDetails = () => {
    if (!orderData) return {};

    const revenue = orderData.totalAmount || 0;
    const importCost = orderData.importCost || 0;

    // Chi phí sàn TMĐT
    const platformFees = {
      phiGiaoDich: feeSettings.phiGiaoDich || 0,
      phiHoaHong: feeSettings.phiHoaHong || 0,
      phiVanChuyenThucTe: feeSettings.phiVanChuyenThucTe || 0,
      giamPhiVcNguoiBan: -(feeSettings.giamPhiVcNguoiBan || 0),
      phiVcTaHang: feeSettings.phiVcTaHang || 0,
      troGiaVanChuyen: -(feeSettings.troGiaVanChuyen || 0),
      hoaHongLienKet: feeSettings.hoaHongLienKet || 0,
      phiVoucherXtra: feeSettings.phiVoucherXtra || 0,
      thueTGTCT: feeSettings.thueTGTCT || 0,
      thueTNCN: feeSettings.thueTNCN || 0,
      giamPhiNguoiBan: -(feeSettings.giamPhiNguoiBan || 0),
      chinhKhachPhiVanChuyen: -(feeSettings.chinhKhachPhiVanChuyen || 0),
      phiKhac: feeSettings.phiKhac || 0
    };

    // Chi phí bên ngoài (không bao gồm chi phí thùng)
    const externalFees = {
      chiPhiVanChuyen: feeSettings.chiPhiVanChuyen || 0,
      chiPhiDongGoi: feeSettings.chiPhiDongGoi || 0, // Chi phí đóng gói bên ngoài (khác với thùng)
      chiPhiLuuKho: feeSettings.chiPhiLuuKho || 0,
      chiPhiNhanVien: feeSettings.chiPhiNhanVien || 0,
      chiPhiThueMat: feeSettings.chiPhiThueMat || 0,
      chiPhiDienNuoc: feeSettings.chiPhiDienNuoc || 0,
      chiPhiBaoHiem: feeSettings.chiPhiBaoHiem || 0,
      chiPhiThietBi: feeSettings.chiPhiThietBi || 0,
      chiPhiHanhChinh: feeSettings.chiPhiHanhChinh || 0,
      chiPhiMarketing: feeSettings.chiPhiMarketing || 0
    };

    // Chi phí thùng đóng gói (riêng biệt) - lấy từ chi tiết thùng
    const packagingFees = {};
    let totalPackagingCost = 0;
    
    // Tìm tất cả chi phí thùng từ feeSettings
    Object.entries(feeSettings).forEach(([key, value]) => {
      if (key.startsWith('chiPhiThung_')) {
        if (typeof value === 'object' && value.cost) {
          // Có thông tin chi tiết
          const packageType = value.type === 'hangLanh' ? 'Hàng Lạnh' : 
                             value.type === 'hangKho' ? 'Hàng Khô' : value.type;
          packagingFees[`${value.description} (${packageType})`] = value.cost;
          totalPackagingCost += value.cost;
        } else if (typeof value === 'number') {
          // Chỉ có giá
          packagingFees['Chi Phí Thùng Đóng Gói'] = value;
          totalPackagingCost += value;
        }
      }
    });

    const totalPlatformFees = Object.values(platformFees).reduce((sum, fee) => sum + fee, 0);
    const totalExternalFees = Object.values(externalFees).reduce((sum, fee) => sum + fee, 0);
    const totalPackagingFees = Object.values(packagingFees).reduce((sum, fee) => sum + fee, 0);
    const totalFees = totalPlatformFees + totalExternalFees + totalPackagingFees;
    const netProfit = revenue - importCost - totalFees;

    return {
      revenue,
      importCost,
      platformFees,
      externalFees,
      packagingFees,
      totalPlatformFees,
      totalExternalFees,
      totalPackagingFees,
      totalFees,
      netProfit
    };
  };

  const profit = calculateProfitDetails();

  const renderFeeSection = (title, fees, color) => (
    <Card 
      size="small" 
      title={<Text strong style={{ color }}>{title}</Text>}
      style={{ marginBottom: 16 }}
    >
      <Row gutter={[16, 8]}>
        {Object.entries(fees).map(([key, value]) => (
          <Col span={12} key={key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 12 }}>{getFeeLabel(key)}:</Text>
              <Text 
                strong 
                style={{ 
                  color: value >= 0 ? '#ff4d4f' : '#52c41a',
                  fontSize: 12
                }}
              >
                {formatCurrency(Math.abs(value))}
                {value < 0 && ' (Giảm)'}
              </Text>
            </div>
          </Col>
        ))}
      </Row>
      <Divider style={{ margin: '12px 0' }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text strong>Tổng {title.toLowerCase()}:</Text>
        <Text strong style={{ color, fontSize: 14 }}>
          {formatCurrency(Object.values(fees).reduce((sum, fee) => sum + fee, 0))}
        </Text>
      </div>
    </Card>
  );

  const getFeeLabel = (key) => {
    const labels = {
      phiGiaoDich: 'Phí Giao Dịch',
      phiHoaHong: 'Phí Hoa Hồng',
      phiVcThucTe: 'Phí VC Thực Tế',
      giamPhiVcNguoiBan: 'Giảm Phí VC Người Bán',
      giamPhiVcTikTokShop: 'Trợ Giá Vận Chuyển',
      troGiaVanChuyen: 'Phí Voucher Xtra',
      hoaHongLienKet: 'Hoa Hồng Liên Kết',
      phiVoucherXtra: 'Thuế TGTGT',
      thueTGTGT: 'Thuế TNCN',
      thueTNCN: 'Giảm Phí Người Bán',
      giamPhiNguoiBan: 'Chỉnh Khách Phí VC',
      chinhKhachPhiVanChuyen: 'Phí Khác',
      phiKhac: 'Phí Khác',
      
      // External costs
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
      
      // Packaging costs (separate from external costs)
      chiPhiThung: 'Chi Phí Thùng Đóng Gói'
    };
    return labels[key] || key;
  };

  if (!orderData) return null;

  return (
    <Modal
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Title level={4} style={{ margin: 0, color: '#007A33' }}>
            Chi Tiết Đơn Hàng
          </Title>
          <Text code>{orderData.orderId}</Text>
        </div>
      }
      open={visible}
      onCancel={onClose}
      width={1000}
      footer={[
        <Space key="actions">
          <Button 
            icon={<ReloadOutlined />}
            onClick={() => {
              setLoading(true);
              loadFeeSettings().finally(() => setLoading(false));
            }}
            loading={loading}
            type="primary"
            style={{ background: '#007A33', borderColor: '#007A33' }}
          >
            Tải Lại Chi Phí
          </Button>
          <Button key="close" onClick={onClose}>
            Đóng
          </Button>
        </Space>
      ]}
    >
      <Row gutter={24}>
        {/* Thông tin cơ bản */}
        <Col span={24}>
          <Card 
            size="small" 
            title={<Text strong style={{ color: '#007A33' }}>Thông Tin Cơ Bản</Text>}
            style={{ marginBottom: 16 }}
          >
            <Row gutter={16}>
              <Col span={6}>
                <Text strong>Mã ĐH:</Text>
                <div>{orderData.orderId}</div>
              </Col>
              <Col span={6}>
                <Text strong>Sản Phẩm:</Text>
                <div style={{ fontSize: 12 }}>
                  {orderData.items ? 
                    `${orderData.items.length} sản phẩm` : 
                    orderData.productName
                  }
                </div>
              </Col>
              <Col span={6}>
                <Text strong>Sàn TMĐT:</Text>
                <div>{orderData.platform || 'TikTok Shop'}</div>
              </Col>
              <Col span={6}>
                <Text strong>Cửa Hàng:</Text>
                <div>{selectedStore || orderData?.storeName}</div>
              </Col>
              <Col span={6}>
                <Text strong>Ngày Đặt:</Text>
                <div>{orderData.orderDate}</div>
              </Col>
            </Row>
          </Card>
        </Col>

        {/* Cột trái: Tất cả chi phí (50%) */}
        <Col span={12}>
          {/* Chi phí sàn TMĐT */}
          {renderFeeSection('Chi Phí Sàn TMĐT', profit.platformFees, '#ff7a45')}
          
          {/* Chi phí bên ngoài */}
          {renderFeeSection('Chi Phí Bên Ngoài', profit.externalFees, '#13c2c2')}
          
          {/* Chi phí thùng đóng gói */}
          {renderFeeSection('Chi Phí Thùng Đóng Gói', profit.packagingFees, '#722ed1')}
        </Col>

        {/* Cột phải: Doanh thu & Tổng kết (50%) */}
        <Col span={12}>
          {/* Doanh thu và chi phí nhập */}
              <Card 
                size="small" 
                title={<Text strong style={{ color: '#1890ff' }}>Doanh Thu & Chi Phí Nhập</Text>}
                style={{ marginBottom: 16 }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>Doanh Thu:</Text>
                  <Text strong style={{ color: '#52c41a', fontSize: 16 }}>
                    {formatCurrency(profit.revenue)}
                  </Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                  <Text>Chi Phí Nhập Hàng:</Text>
                  <Text strong style={{ color: '#ff4d4f', fontSize: 16 }}>
                    {formatCurrency(profit.importCost)}
                  </Text>
                </div>
                <Divider style={{ margin: '12px 0' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <Text strong>Lợi Nhuận Gộp:</Text>
                  <Text strong style={{ color: '#1890ff', fontSize: 16 }}>
                    {formatCurrency(profit.revenue - profit.importCost)}
                  </Text>
                </div>
              </Card>

          {/* Tổng kết lợi nhuận */}
          <Card 
            size="small" 
            title={<Text strong style={{ color: '#722ed1' }}>Tổng Kết Lợi Nhuận</Text>}
            style={{ marginBottom: 16 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text>Tổng Chi Phí Sàn:</Text>
              <Text strong style={{ color: '#ff4d4f' }}>
                {formatCurrency(profit.totalPlatformFees)}
              </Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text>Tổng Chi Phí Bên Ngoài:</Text>
              <Text strong style={{ color: '#ff4d4f' }}>
                {formatCurrency(profit.totalExternalFees)}
              </Text>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text>Tổng Chi Phí Thùng Đóng Gói:</Text>
              <Text strong style={{ color: '#ff4d4f' }}>
                {formatCurrency(profit.totalPackagingFees)}
              </Text>
            </div>
            <Divider style={{ margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <Text strong style={{ fontSize: 16 }}>Lợi Nhuận Ròng:</Text>
              <Text 
                strong 
                style={{ 
                  color: profit.netProfit >= 0 ? '#52c41a' : '#ff4d4f', 
                  fontSize: 18 
                }}
              >
                {formatCurrency(profit.netProfit)}
              </Text>
            </div>
          </Card>
        </Col>
        
      </Row>
    </Modal>
  );
};

export default OrderDetailModal;
