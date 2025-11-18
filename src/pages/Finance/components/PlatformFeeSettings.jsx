import React, { useState, useEffect } from 'react';
import { Modal, Select, Checkbox, Row, Col, Button, message, Radio, Input, Card, Typography, Space } from 'antd';
import { database } from '../../../services/firebase.service';
import { ref, set, onValue, get } from 'firebase/database';

const { Option } = Select;
const { Text } = Typography;

const PlatformFeeSettings = ({ visible, onClose, selectedPlatform, selectedStore, onSave }) => {
  console.log('🎯 PlatformFeeSettings props:', { visible, selectedPlatform, selectedStore });
  
  const [currentPlatform, setCurrentPlatform] = useState('');
  const [currentStore, setCurrentStore] = useState('');
  const [stores, setStores] = useState([]);
  const [availablePlatforms] = useState([
    'Shopee',
    'Lazada', 
    'TikTok Shop',
    'Sendo',
    'Tiki',
    'Facebook Shop',
    'Zalo Shop',
    'Khác'
  ]);
  
  const [feeConfigs, setFeeConfigs] = useState({
    phiGiaoDich: { enabled: false, type: 'percentage', value: 0 },
    phiHoaHong: { enabled: false, type: 'percentage', value: 0 },
    phiVanChuyenThucTe: { enabled: false, type: 'fixed', value: 0 },
    chinhKhachPhiVanChuyen: { enabled: false, type: 'fixed', value: 0 },
    giamPhiVcNguoiBan: { enabled: false, type: 'fixed', value: 0 },
    giamPhiVcTikTokShop: { enabled: false, type: 'fixed', value: 0 },
    phiVcTaHang: { enabled: false, type: 'fixed', value: 0 },
    troGiaVanChuyen: { enabled: false, type: 'fixed', value: 0 },
    hoaHongLienKet: { enabled: false, type: 'percentage', value: 0 },
    phiVoucherXtra: { enabled: false, type: 'fixed', value: 0 },
    thueTGTCT: { enabled: false, type: 'percentage', value: 0 },
    thueTNCN: { enabled: false, type: 'percentage', value: 0 },
    phiKhac: { enabled: false, type: 'fixed', value: 0 },
    chiPhiVanChuyen: { enabled: false, type: 'fixed', value: 0 },
    chiPhiDongGoi: { enabled: false, type: 'fixed', value: 0 },
    chiPhiLuuKho: { enabled: false, type: 'fixed', value: 0 },
    chiPhiNhanVien: { enabled: false, type: 'fixed', value: 0 },
    chiPhiThueMat: { enabled: false, type: 'fixed', value: 0 },
    chiPhiDienNuoc: { enabled: false, type: 'fixed', value: 0 },
    chiPhiBaoHiem: { enabled: false, type: 'fixed', value: 0 },
    chiPhiThietBi: { enabled: false, type: 'fixed', value: 0 },
    chiPhiHanhChinh: { enabled: false, type: 'fixed', value: 0 },
    chiPhiMarketing: { enabled: false, type: 'fixed', value: 0 },
    giamPhiNguoiBan: { enabled: false, type: 'fixed', value: 0 }
  });

  // Danh sách phí cơ bản của sàn (13 loại)
  const baseFeeOptions = [
    { key: 'phiGiaoDich', label: 'Phí Giao Dịch' },
    { key: 'phiHoaHong', label: 'Phí Hoa Hồng' },
    { key: 'phiVanChuyenThucTe', label: 'Phí Vận Chuyển Thực Tế' },
    { key: 'chietKhauPhiVanChuyen', label: 'Chiết Khấu Phí Vận Chuyển' },
    { key: 'giamPhiVcNguoiBan', label: 'Giảm Phí VC Người Bán' },
    { key: 'giamPhiVcTikTokShop', label: 'Giảm Phí VC TikTok Shop' },
    { key: 'phiVcTraHang', label: 'Phí VC Trả Hàng' },
    { key: 'troGiaVanChuyen', label: 'Trợ Giá Vận Chuyển' },
    { key: 'hoaHongLienKet', label: 'Hoa Hồng Liên Kết' },
    { key: 'phiVoucherXtra', label: 'Phí Voucher Xtra' },
    { key: 'thueTGTCT', label: 'Thuế GTGT' },
    { key: 'thueTNCN', label: 'Thuế TNCN' },
    { key: 'giamGiaNguoiBan', label: 'Giảm Giá Người Bán' }
  ];

  // State cho phí tùy chỉnh
  const [customFees, setCustomFees] = useState([]);

  useEffect(() => {
    if (visible) {
      // Set platform từ props hoặc reset về rỗng
      const initialPlatform = selectedPlatform && selectedPlatform !== 'all' ? selectedPlatform : '';
      setCurrentPlatform(initialPlatform);
      
      // Set store từ props hoặc để trống
      console.log('🔍 selectedStore from props:', selectedStore);
      console.log('🔍 selectedStore type:', typeof selectedStore);
      
      const initialStore = selectedStore && selectedStore !== 'all' ? selectedStore : '';
      setCurrentStore(initialStore);
      console.log('🏪 Setting initial store to:', initialStore);
      
      // Load danh sách cửa hàng
      loadStores();
    }
  }, [visible, selectedPlatform, selectedStore]);

  useEffect(() => {
    // Reset state và load settings khi platform hoặc store thay đổi
    if (currentPlatform && currentStore) {
      // Reset về default trước khi load
      resetToDefaults();
      loadPlatformFeeSettings();
    }
  }, [currentPlatform, currentStore]);

  // Reset về trạng thái mặc định
  const resetToDefaults = () => {
    console.log('🔄 Resetting to defaults for', currentPlatform, currentStore);
    setFeeConfigs({
      phiGiaoDich: { enabled: false, type: 'percentage', value: 0 },
      phiHoaHong: { enabled: false, type: 'percentage', value: 0 },
      phiVanChuyenThucTe: { enabled: false, type: 'fixed', value: 0 },
      chietKhauPhiVanChuyen: { enabled: false, type: 'fixed', value: 0 },
      giamPhiVcNguoiBan: { enabled: false, type: 'fixed', value: 0 },
      giamPhiVcTikTokShop: { enabled: false, type: 'fixed', value: 0 },
      phiVcTraHang: { enabled: false, type: 'fixed', value: 0 },
      troGiaVanChuyen: { enabled: false, type: 'fixed', value: 0 },
      hoaHongLienKet: { enabled: false, type: 'percentage', value: 0 },
      phiVoucherXtra: { enabled: false, type: 'fixed', value: 0 },
      thueTGTCT: { enabled: false, type: 'percentage', value: 0 },
      thueTNCN: { enabled: false, type: 'percentage', value: 0 },
      giamGiaNguoiBan: { enabled: false, type: 'fixed', value: 0 }
    });
    setCustomFees([]);
  };

  // Load danh sách cửa hàng từ Firebase
  const loadStores = () => {
    const storesRef = ref(database, 'stores');
    onValue(storesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const storesArray = Object.keys(data).map(key => ({
          id: key,
          name: data[key].name || key
        }));
        setStores(storesArray);
        console.log('🏪 Loaded stores:', storesArray);
        console.log('🔍 Current selectedStore after loading stores:', selectedStore);
      }
    });
  };

  const loadPlatformFeeSettings = async () => {
    if (!currentPlatform || !currentStore) return;
    
    console.log('🔍 Loading settings for platform:', currentPlatform, 'store:', currentStore);
    const settingsPath = `platformFeeSettings/${currentPlatform}/${currentStore}`;
    const settingsRef = ref(database, settingsPath);
    
    try {
      // Sử dụng get() thay vì onValue() để tránh multiple listeners
      const snapshot = await get(settingsRef);
      const data = snapshot.val();
      console.log('📦 Firebase data for', settingsPath, ':', data);
      
      if (data) {
        // Load fee configs
        if (data.feeConfigs) {
          setFeeConfigs(data.feeConfigs);
          console.log('✅ Loaded fee configs:', data.feeConfigs);
        } else if (!data.feeConfigs && !data.customFees) {
          // Old format - data trực tiếp là feeConfigs
          setFeeConfigs(data);
          console.log('✅ Loaded fee configs (old format):', data);
        }
        
        // Load custom fees
        if (data.customFees) {
          setCustomFees(data.customFees);
          console.log('✅ Loaded custom fees:', data.customFees);
        }
      } else {
        console.log('⚠️ No data found for', settingsPath, '- keeping defaults');
        // Không cần làm gì thêm vì đã reset về defaults
      }
    } catch (error) {
      console.error('❌ Error loading settings:', error);
    }
  };

  const handleFeeToggle = (key, enabled) => {
    setFeeConfigs(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        enabled: enabled
      }
    }));
  };

  // Format số để hiển thị đẹp
  const formatDisplayValue = (value, type) => {
    if (!value) return '';
    
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return '';
    
    if (type === 'percentage') {
      // Cho phần trăm: hiển thị số thập phân bình thường
      return numValue.toString();
    } else {
      // Cho số tiền: format với dấu phẩy phân cách hàng nghìn
      return new Intl.NumberFormat('vi-VN').format(numValue);
    }
  };

  // Parse giá trị từ display về số để lưu
  const parseInputValue = (displayValue, type) => {
    if (!displayValue && displayValue !== 0) return 0;
    
    // Loại bỏ dấu phẩy phân cách hàng nghìn và khoảng trắng
    const cleanValue = displayValue.toString().replace(/[,\s]/g, '');
    console.log('🔍 Parsing:', displayValue, '→', cleanValue);
    
    const numValue = parseFloat(cleanValue);
    console.log('🔢 Result:', numValue);
    
    return isNaN(numValue) ? 0 : numValue;
  };

  const handleFeeConfigChange = (key, field, value) => {
    setFeeConfigs(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  // Thêm phí tùy chỉnh
  const addCustomFee = () => {
    const newFee = {
      id: Date.now(),
      key: `custom_${Date.now()}`,
      label: '',
      enabled: false,
      type: 'fixed',
      value: 0
    };
    setCustomFees(prev => [...prev, newFee]);
  };

  // Cập nhật phí tùy chỉnh
  const updateCustomFee = (id, field, value) => {
    setCustomFees(prev => prev.map(fee => 
      fee.id === id ? { ...fee, [field]: value } : fee
    ));
  };

  // Xóa phí tùy chỉnh
  const removeCustomFee = (id) => {
    setCustomFees(prev => prev.filter(fee => fee.id !== id));
  };

  // Kết hợp phí cơ bản và tùy chỉnh
  const allFeeOptions = [...baseFeeOptions, ...customFees];

  const handleSave = async () => {
    console.log('💾 Saving - Current platform:', currentPlatform, 'store:', currentStore);
    console.log('💾 Saving - Fee configs:', feeConfigs);
    
    if (!currentPlatform) {
      message.error('Vui lòng chọn sàn TMĐT');
      return;
    }
    
    if (!currentStore) {
      message.error('Vui lòng chọn cửa hàng');
      return;
    }

    try {
      const settingsPath = `platformFeeSettings/${currentPlatform}/${currentStore}`;
      const settingsRef = ref(database, settingsPath);
      console.log('💾 Firebase path:', settingsPath);
      
      // Lưu cả fee configs và custom fees
      const dataToSave = {
        feeConfigs: feeConfigs,
        customFees: customFees
      };
      
      await set(settingsRef, dataToSave);
      console.log('✅ Saved successfully to Firebase');
      
      message.success(`Đã lưu cài đặt phí cho ${currentPlatform}`);
      onSave && onSave(dataToSave);
      onClose();
    } catch (error) {
      console.error('❌ Save error:', error);
      message.error('Lỗi khi lưu cài đặt: ' + error.message);
    }
  };

  return (
    <Modal
      title="🏪 Cài Đặt Phí Sàn TMĐT"
      open={visible}
      onCancel={onClose}
      width="70%"
      footer={[
        <Button key="cancel" onClick={onClose}>
          Hủy
        </Button>,
        <Button key="save" type="primary" onClick={handleSave}>
          Lưu Cài Đặt
        </Button>
      ]}
    >
      {/* Chọn Sàn TMĐT */}
      <div style={{ marginBottom: 24 }}>
        <Text strong>Chọn Sàn TMĐT:</Text>
        <Select 
          value={currentPlatform} 
          onChange={(value) => {
            console.log('🔄 Platform changed from', currentPlatform, 'to', value);
            setCurrentPlatform(value);
          }}
          style={{ width: '100%', marginTop: 8 }}
          placeholder="Chọn sàn TMĐT để cấu hình"
        >
          {availablePlatforms.map(platform => (
            <Option key={platform} value={platform}>{platform}</Option>
          ))}
        </Select>
      </div>

      {/* Chọn Cửa Hàng */}
      <div style={{ marginBottom: 24 }}>
        <Text strong>Chọn Cửa Hàng:</Text>
        <Select 
          value={currentStore} 
          onChange={(value) => {
            console.log('🔄 Store changed from', currentStore, 'to', value);
            setCurrentStore(value);
          }}
          style={{ width: '100%', marginTop: 8 }}
          placeholder="Chọn cửa hàng để cấu hình"
        >
          {stores.map(store => (
            <Option key={store.id} value={store.id}>
              🏬 {store.name}
            </Option>
          ))}
        </Select>
      </div>

      {currentPlatform && currentStore && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>Chọn Các Loại Phí:</Text>
            <Button 
              type="dashed" 
              onClick={addCustomFee}
              style={{ marginBottom: 8 }}
            >
              ➕ Thêm Phí Tùy Chỉnh
            </Button>
          </div>
          <div style={{ marginTop: 16 }}>
            <Row gutter={[16, 16]}>
              {allFeeOptions.map(option => (
                <Col span={6} key={option.key}>
                  <Card 
                    size="small" 
                    style={{ 
                      backgroundColor: feeConfigs[option.key]?.enabled ? '#f6ffed' : '#fafafa',
                      border: feeConfigs[option.key]?.enabled ? '1px solid #52c41a' : '1px solid #d9d9d9',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      const currentEnabled = feeConfigs[option.key]?.enabled || false;
                      handleFeeToggle(option.key, !currentEnabled);
                    }}
                  >
                    {/* Header với checkbox và nút xóa cho custom fee */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Checkbox
                        checked={feeConfigs[option.key]?.enabled}
                        onChange={(e) => {
                          e.stopPropagation(); // Ngăn event bubbling
                          handleFeeToggle(option.key, e.target.checked);
                        }}
                      >
                        {option.id ? (
                          // Custom fee - có thể edit tên
                          <Input
                            value={option.label}
                            onChange={(e) => updateCustomFee(option.id, 'label', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Nhập tên phí tùy chỉnh"
                            style={{ width: 200, marginLeft: 8 }}
                            size="small"
                          />
                        ) : (
                          // Base fee - tên cố định
                          <Text strong>{option.label}</Text>
                        )}
                      </Checkbox>
                      
                      {option.id && (
                        // Nút xóa cho custom fee
                        <Button 
                          type="text" 
                          danger 
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCustomFee(option.id);
                          }}
                        >
                          🗑️
                        </Button>
                      )}
                    </div>
                    
                    {feeConfigs[option.key]?.enabled && (
                      <div style={{ marginTop: 12, paddingLeft: 8, border: '1px dashed #ccc', padding: '12px', borderRadius: '4px' }}>
                        <div style={{ marginBottom: 12 }}>
                          <Text strong style={{ fontSize: '12px', color: '#666' }}>Loại tính phí:</Text>
                        </div>
                        
                        <Radio.Group
                          value={feeConfigs[option.key]?.type || 'fixed'}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            console.log('Radio changed:', option.key, e.target.value);
                            handleFeeConfigChange(option.key, 'type', e.target.value);
                          }}
                          style={{ marginBottom: 12, display: 'block' }}
                        >
                          <div style={{ marginBottom: 8 }}>
                            <Radio value="percentage" style={{ display: 'block', marginBottom: 4 }} onClick={(e) => e.stopPropagation()}>
                              <Text>💰 Phần trăm (%)</Text>
                            </Radio>
                          </div>
                          <div>
                            <Radio value="fixed" style={{ display: 'block' }} onClick={(e) => e.stopPropagation()}>
                              <Text>💵 Số tiền cố định (VNĐ)</Text>
                            </Radio>
                          </div>
                        </Radio.Group>
                        
                        <div style={{ marginBottom: 8 }}>
                          <Text strong style={{ fontSize: '12px', color: '#666' }}>Giá trị:</Text>
                        </div>
                        
                        <Input
                          type="number"
                          value={feeConfigs[option.key]?.value || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            console.log('📝 Input changed:', inputValue);
                            
                            const numericValue = parseFloat(inputValue) || 0;
                            console.log('🔢 Numeric value:', numericValue);
                            
                            // Validation giới hạn
                            if (feeConfigs[option.key]?.type === 'percentage') {
                              if (numericValue > 100) {
                                message.warning('Phần trăm không được vượt quá 100%');
                                return;
                              }
                            } else {
                              if (numericValue > 999999999) {
                                message.warning('Số tiền không được vượt quá 999,999,999 VNĐ');
                                return;
                              }
                            }
                            
                            console.log('✅ Saving value:', numericValue);
                            handleFeeConfigChange(option.key, 'value', numericValue);
                          }}
                          placeholder={
                            feeConfigs[option.key]?.type === 'percentage' 
                              ? 'VD: 2.5 (tối đa 100%)' 
                              : 'VD: 1500 (tối đa 999,999,999)'
                          }
                          suffix={feeConfigs[option.key]?.type === 'percentage' ? '%' : 'VNĐ'}
                          style={{ width: '100%' }}
                          maxLength={feeConfigs[option.key]?.type === 'percentage' ? 6 : 15}
                        />
                        
                        {/* Debug buttons */}
                        <div style={{ marginTop: 8, marginBottom: 8 }}>
                          <Space size="small">
                            <Button 
                              size="small" 
                              onClick={() => handleFeeConfigChange(option.key, 'value', 100000)}
                            >
                              giảm 100k
                            </Button>
                            <Button 
                              size="small" 
                              onClick={() => handleFeeConfigChange(option.key, 'value', 1000000)}
                            >
                              giảm 1M
                            </Button>
                           
                          </Space>
                        </div>
                        
                        <div style={{ marginTop: 8 }}>
                          {feeConfigs[option.key]?.type === 'percentage' ? (
                            <div>
                              
                              
                               
                              
                            </div>
                          ) : (
                            <div>
                              <Text type="secondary" style={{ fontSize: '11px' }}>
                                💡
                              </Text>
                             
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </Card>
                </Col>
              ))}
            </Row>
          </div>
        </>
      )}
      
      {(!currentPlatform || !currentStore) && (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          <Text type="secondary">
            {!currentPlatform 
              ? 'Vui lòng chọn sàn TMĐT để cấu hình phí'
              : 'Vui lòng chọn cửa hàng để cấu hình phí'
            }
          </Text>
        </div>
      )}
    </Modal>
  );
};

export default PlatformFeeSettings;
