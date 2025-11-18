import React, { useState, useEffect } from 'react';
import { Modal, Select, Checkbox, Row, Col, Button, message, Radio, Input, Card, Typography, Space } from 'antd';
import { database } from '../../../services/firebase.service';
import { ref, set, onValue, get } from 'firebase/database';

const { Option } = Select;
const { Text } = Typography;

const ExternalCostSettings = ({ 
  visible, 
  onClose, 
  selectedStore, 
  onSave,
  firebasePath = 'externalCostSettings'
}) => {
  console.log('🎯 ExternalCostSettings props:', { visible, selectedStore });
  
  const [currentStore, setCurrentStore] = useState('');
  const [stores, setStores] = useState([]);
  
  const [costConfigs, setCostConfigs] = useState({
    chiPhiVanChuyen: { enabled: false, type: 'fixed', value: 0 },
    chiPhiDongGoi: { enabled: false, type: 'fixed', value: 0 },
    chiPhiLuuKho: { enabled: false, type: 'fixed', value: 0 },
    chiPhiMarketing: { enabled: false, type: 'fixed', value: 0 },
    chiPhiNhanVien: { enabled: false, type: 'fixed', value: 0 },
    chiPhiThueMat: { enabled: false, type: 'fixed', value: 0 },
    chiPhiDienNuoc: { enabled: false, type: 'fixed', value: 0 },
    chiPhiBaoHiem: { enabled: false, type: 'fixed', value: 0 },
    chiPhiThietBi: { enabled: false, type: 'fixed', value: 0 },
    chiPhiHanhChinh: { enabled: false, type: 'fixed', value: 0 }
  });

  // Danh sách chi phí cơ bản (10 loại)
  const baseCostOptions = [
    { key: 'chiPhiVanChuyen', label: 'Chi Phí Vận Chuyển' },
    { key: 'chiPhiDongGoi', label: 'Chi Phí Đóng Gói' },
    { key: 'chiPhiLuuKho', label: 'Chi Phí Lưu Kho' },
    { key: 'chiPhiMarketing', label: 'Chi Phí Marketing' },
    { key: 'chiPhiNhanVien', label: 'Chi Phí Nhân Viên' },
    { key: 'chiPhiThueMat', label: 'Chi Phí Thuê Mặt Bằng' },
    { key: 'chiPhiDienNuoc', label: 'Chi Phí Điện Nước' },
    { key: 'chiPhiBaoHiem', label: 'Chi Phí Bảo Hiểm' },
    { key: 'chiPhiThietBi', label: 'Chi Phí Thiết Bị' },
    { key: 'chiPhiHanhChinh', label: 'Chi Phí Hành Chính' }
  ];

  // State cho chi phí tùy chỉnh
  const [customCosts, setCustomCosts] = useState([]);

  useEffect(() => {
    if (visible) {
      // Set store từ props hoặc để trống
      const initialStore = selectedStore && selectedStore !== 'all' ? selectedStore : '';
      setCurrentStore(initialStore);
      console.log('🏪 Setting initial store to:', initialStore);
      
      // Load danh sách cửa hàng
      loadStores();
    }
  }, [visible, selectedStore]);

  useEffect(() => {
    // Reset state và load settings khi store thay đổi
    if (currentStore) {
      // Reset về default trước khi load
      resetToDefaults();
      loadExternalCostSettings();
    }
  }, [currentStore]);

  // Reset về trạng thái mặc định
  const resetToDefaults = () => {
    console.log('🔄 Resetting external costs to defaults for', currentStore);
    setCostConfigs({
      chiPhiVanChuyen: { enabled: false, type: 'fixed', value: 0 },
      chiPhiDongGoi: { enabled: false, type: 'fixed', value: 0 },
      chiPhiLuuKho: { enabled: false, type: 'fixed', value: 0 },
      chiPhiMarketing: { enabled: false, type: 'fixed', value: 0 },
      chiPhiNhanVien: { enabled: false, type: 'fixed', value: 0 },
      chiPhiThueMat: { enabled: false, type: 'fixed', value: 0 },
      chiPhiDienNuoc: { enabled: false, type: 'fixed', value: 0 },
      chiPhiBaoHiem: { enabled: false, type: 'fixed', value: 0 },
      chiPhiThietBi: { enabled: false, type: 'fixed', value: 0 },
      chiPhiHanhChinh: { enabled: false, type: 'fixed', value: 0 }
    });
    setCustomCosts([]);
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
      }
    });
  };

  const loadExternalCostSettings = async () => {
    if (!currentStore) return;
    
    console.log('🔍 Loading external cost settings for store:', currentStore);
    const settingsPath = `${firebasePath}/${currentStore}`;
    const settingsRef = ref(database, settingsPath);
    
    try {
      const snapshot = await get(settingsRef);
      const data = snapshot.val();
      console.log('📦 Firebase data for', settingsPath, ':', data);
      
      if (data) {
        // Load cost configs
        if (data.costConfigs) {
          setCostConfigs(data.costConfigs);
          console.log('✅ Loaded cost configs:', data.costConfigs);
        }
        
        // Load custom costs
        if (data.customCosts) {
          setCustomCosts(data.customCosts);
          console.log('✅ Loaded custom costs:', data.customCosts);
        }
      } else {
        console.log('⚠️ No data found for', settingsPath, '- keeping defaults');
      }
    } catch (error) {
      console.error('❌ Error loading external cost settings:', error);
    }
  };

  const handleCostToggle = (key, enabled) => {
    setCostConfigs(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        enabled: enabled
      }
    }));
  };

  const handleCostConfigChange = (key, field, value) => {
    setCostConfigs(prev => ({
      ...prev,
      [key]: {
        ...prev[key],
        [field]: value
      }
    }));
  };

  // Thêm chi phí tùy chỉnh
  const addCustomCost = () => {
    const newCost = {
      id: Date.now(),
      key: `custom_${Date.now()}`,
      label: '',
      enabled: false,
      type: 'fixed',
      value: 0
    };
    setCustomCosts(prev => [...prev, newCost]);
  };

  // Cập nhật chi phí tùy chỉnh
  const updateCustomCost = (id, field, value) => {
    setCustomCosts(prev => prev.map(cost => 
      cost.id === id ? { ...cost, [field]: value } : cost
    ));
  };

  // Xóa chi phí tùy chỉnh
  const removeCustomCost = (id) => {
    setCustomCosts(prev => prev.filter(cost => cost.id !== id));
  };

  // Kết hợp chi phí cơ bản và tùy chỉnh
  const allCostOptions = [...baseCostOptions, ...customCosts];

  const handleSave = async () => {
    console.log('💾 Saving - Current store:', currentStore);
    console.log('💾 Saving - Cost configs:', costConfigs);
    
    if (!currentStore) {
      message.error('Vui lòng chọn cửa hàng');
      return;
    }

    try {
      const settingsPath = `${firebasePath}/${currentStore}`;
      const settingsRef = ref(database, settingsPath);
      console.log('💾 Firebase path:', settingsPath);
      
      // Lưu cả cost configs và custom costs
      const dataToSave = {
        costConfigs: costConfigs,
        customCosts: customCosts
      };
      
      await set(settingsRef, dataToSave);
      console.log('✅ Saved successfully to Firebase');
      
      message.success(`Đã lưu cài đặt chi phí bên ngoài cho ${stores.find(s => s.id === currentStore)?.name || currentStore}`);
      onSave && onSave(dataToSave);
      onClose();
    } catch (error) {
      console.error('❌ Save error:', error);
      message.error('Lỗi khi lưu cài đặt: ' + error.message);
    }
  };

  return (
    <Modal
      title="🏢 Cài Đặt Chi Phí Bên Ngoài"
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

      {currentStore && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text strong>Chọn Các Loại Chi Phí:</Text>
            <Button 
              type="dashed" 
              onClick={addCustomCost}
              style={{ marginBottom: 8 }}
            >
              ➕ Thêm Chi Phí Tùy Chỉnh
            </Button>
          </div>
          <div style={{ marginTop: 16 }}>
            <Row gutter={[16, 16]}>
              {allCostOptions.map(option => (
                <Col span={6} key={option.key}>
                  <Card 
                    size="small" 
                    style={{ 
                      backgroundColor: costConfigs[option.key]?.enabled ? '#f6ffed' : '#fafafa',
                      border: costConfigs[option.key]?.enabled ? '1px solid #52c41a' : '1px solid #d9d9d9',
                      cursor: 'pointer'
                    }}
                    onClick={() => {
                      const currentEnabled = costConfigs[option.key]?.enabled || false;
                      handleCostToggle(option.key, !currentEnabled);
                    }}
                  >
                    {/* Header với checkbox và nút xóa cho custom cost */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Checkbox
                        checked={costConfigs[option.key]?.enabled}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleCostToggle(option.key, e.target.checked);
                        }}
                      >
                        {option.id ? (
                          // Custom cost - có thể edit tên
                          <Input
                            value={option.label}
                            onChange={(e) => updateCustomCost(option.id, 'label', e.target.value)}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Nhập tên chi phí tùy chỉnh"
                            style={{ width: 180, marginLeft: 8 }}
                            size="small"
                          />
                        ) : (
                          // Base cost - tên cố định
                          <Text strong>{option.label}</Text>
                        )}
                      </Checkbox>
                      
                      {option.id && (
                        // Nút xóa cho custom cost
                        <Button 
                          type="text" 
                          danger 
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeCustomCost(option.id);
                          }}
                        >
                          🗑️
                        </Button>
                      )}
                    </div>
                    
                    {costConfigs[option.key]?.enabled && (
                      <div style={{ marginTop: 12, paddingLeft: 8, border: '1px dashed #ccc', padding: '12px', borderRadius: '4px' }}>
                        <div style={{ marginBottom: 12 }}>
                          <Text strong style={{ fontSize: '12px', color: '#666' }}>Loại tính phí:</Text>
                        </div>
                        
                        <Radio.Group
                          value={costConfigs[option.key]?.type || 'fixed'}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            console.log('Radio changed:', option.key, e.target.value);
                            handleCostConfigChange(option.key, 'type', e.target.value);
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
                          value={costConfigs[option.key]?.value || ''}
                          onClick={(e) => e.stopPropagation()}
                          onChange={(e) => {
                            const inputValue = e.target.value;
                            const numericValue = parseFloat(inputValue) || 0;
                            
                            // Validation giới hạn
                            if (costConfigs[option.key]?.type === 'percentage') {
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
                            
                            handleCostConfigChange(option.key, 'value', numericValue);
                          }}
                          placeholder={
                            costConfigs[option.key]?.type === 'percentage' 
                              ? 'VD: 2.5 (tối đa 100%)' 
                              : 'VD: 1500 (tối đa 999,999,999)'
                          }
                          suffix={costConfigs[option.key]?.type === 'percentage' ? '%' : 'VNĐ'}
                          style={{ width: '100%' }}
                          maxLength={costConfigs[option.key]?.type === 'percentage' ? 6 : 15}
                        />
                        
                        <div style={{ marginTop: 8 }}>
                          {costConfigs[option.key]?.type === 'percentage' ? (
                            <div>
                              <Text type="secondary" style={{ fontSize: '11px' }}>
                                💡 Ví dụ: 2.5 = 2.5% của doanh thu đơn hàng
                              </Text>
                              <div style={{ 
                                marginTop: 4, 
                                padding: '4px 8px', 
                                backgroundColor: '#f6ffed', 
                                border: '1px solid #52c41a',
                                borderRadius: '4px'
                              }}>
                                <Text style={{ fontSize: '10px', color: '#389e0d' }}>
                                  ✨ <strong>Tự động:</strong> Nhập 2.5 → Hiển thị 2.5%
                                </Text>
                              </div>
                            </div>
                          ) : (
                            <div>
                              <Text type="secondary" style={{ fontSize: '11px' }}>
                                💡 Ví dụ: Nhập 1500 → Chi phí 1,500 VNĐ
                              </Text>
                              <div style={{ 
                                marginTop: 4, 
                                padding: '4px 8px', 
                                backgroundColor: '#f6ffed', 
                                border: '1px solid #52c41a',
                                borderRadius: '4px'
                              }}>
                                <Text style={{ fontSize: '10px', color: '#389e0d' }}>
                                  ✨ <strong>Tự động:</strong> Nhập số tiền cố định cho chi phí này
                                </Text>
                              </div>
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
      
      {!currentStore && (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          <Text type="secondary">Vui lòng chọn cửa hàng để cấu hình chi phí</Text>
        </div>
      )}
    </Modal>
  );
};

export default ExternalCostSettings;
