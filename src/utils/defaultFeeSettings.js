// Default fee settings for different platforms
export const defaultFeeSettings = {
  'TikTok Shop': {
    'all': {
      // Chi phí sàn TMĐT
      phiGiaoDich: { enabled: true, type: 'percentage', value: 2.5 },
      phiHoaHong: { enabled: true, type: 'percentage', value: 5.0 },
      phiVanChuyenThucTe: { enabled: true, type: 'fixed', value: 25000 },
      giamPhiVcNguoiBan: { enabled: true, type: 'fixed', value: -15000 },
      phiVcTaHang: { enabled: false, type: 'fixed', value: 0 },
      troGiaVanChuyen: { enabled: true, type: 'fixed', value: -10000 },
      hoaHongLienKet: { enabled: false, type: 'percentage', value: 0 },
      phiVoucherXtra: { enabled: false, type: 'fixed', value: 0 },
      thueTGTCT: { enabled: true, type: 'percentage', value: 10 },
      thueTNCN: { enabled: false, type: 'percentage', value: 0 },
      giamPhiNguoiBan: { enabled: false, type: 'fixed', value: 0 },
      chinhKhachPhiVanChuyen: { enabled: false, type: 'fixed', value: 0 },
      phiKhac: { enabled: false, type: 'fixed', value: 0 },
      
      // Chi phí bên ngoài
      chiPhiVanChuyen: { enabled: true, type: 'fixed', value: 15000 },
      chiPhiDongGoi: { enabled: true, type: 'fixed', value: 5000 },
      chiPhiLuuKho: { enabled: false, type: 'fixed', value: 0 },
      chiPhiNhanVien: { enabled: true, type: 'fixed', value: 10000 },
      chiPhiThueMat: { enabled: false, type: 'fixed', value: 0 },
      chiPhiDienNuoc: { enabled: false, type: 'fixed', value: 0 },
      chiPhiBaoHiem: { enabled: false, type: 'fixed', value: 0 },
      chiPhiThietBi: { enabled: false, type: 'fixed', value: 0 },
      chiPhiHanhChinh: { enabled: false, type: 'fixed', value: 0 },
      chiPhiMarketing: { enabled: true, type: 'percentage', value: 3.0 }
    }
  },
  'Shopee': {
    'all': {
      // Chi phí sàn TMĐT
      phiGiaoDich: { enabled: true, type: 'percentage', value: 2.0 },
      phiHoaHong: { enabled: true, type: 'percentage', value: 4.5 },
      phiVanChuyenThucTe: { enabled: true, type: 'fixed', value: 20000 },
      giamPhiVcNguoiBan: { enabled: true, type: 'fixed', value: -12000 },
      phiVcTaHang: { enabled: false, type: 'fixed', value: 0 },
      troGiaVanChuyen: { enabled: true, type: 'fixed', value: -8000 },
      hoaHongLienKet: { enabled: false, type: 'percentage', value: 0 },
      phiVoucherXtra: { enabled: false, type: 'fixed', value: 0 },
      thueTGTCT: { enabled: true, type: 'percentage', value: 10 },
      thueTNCN: { enabled: false, type: 'percentage', value: 0 },
      giamPhiNguoiBan: { enabled: false, type: 'fixed', value: 0 },
      chinhKhachPhiVanChuyen: { enabled: false, type: 'fixed', value: 0 },
      phiKhac: { enabled: false, type: 'fixed', value: 0 },
      
      // Chi phí bên ngoài
      chiPhiVanChuyen: { enabled: true, type: 'fixed', value: 15000 },
      chiPhiDongGoi: { enabled: true, type: 'fixed', value: 5000 },
      chiPhiLuuKho: { enabled: false, type: 'fixed', value: 0 },
      chiPhiNhanVien: { enabled: true, type: 'fixed', value: 10000 },
      chiPhiThueMat: { enabled: false, type: 'fixed', value: 0 },
      chiPhiDienNuoc: { enabled: false, type: 'fixed', value: 0 },
      chiPhiBaoHiem: { enabled: false, type: 'fixed', value: 0 },
      chiPhiThietBi: { enabled: false, type: 'fixed', value: 0 },
      chiPhiHanhChinh: { enabled: false, type: 'fixed', value: 0 },
      chiPhiMarketing: { enabled: true, type: 'percentage', value: 2.5 }
    }
  }
};

// Function to initialize default fee settings in Firebase
export const initializeDefaultFeeSettings = async (database) => {
  const { ref, set } = await import('firebase/database');
  
  try {
    const feeRef = ref(database, 'platformFeeSettings');
    await set(feeRef, defaultFeeSettings);
    console.log('✅ Default fee settings initialized');
    return true;
  } catch (error) {
    console.error('❌ Error initializing fee settings:', error);
    return false;
  }
};
