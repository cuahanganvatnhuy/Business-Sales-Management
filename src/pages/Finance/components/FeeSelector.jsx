import React, { useState, useEffect } from 'react';
import { Card, Typography, Checkbox, Row, Col, Button, Space } from 'antd';
import { database } from '../../../services/firebase.service';
import { ref, onValue } from 'firebase/database';

const { Text } = Typography;

const FeeSelector = ({ expenseFilters, setExpenseFilters }) => {
  const [showFeeFilters, setShowFeeFilters] = useState(false);
  const [customCosts, setCustomCosts] = useState([]);
  
  const handleExpenseFilterChange = (key, checked) => {
    setExpenseFilters(prev => ({
      ...prev,
      [key]: checked
    }));
  };

  // Load custom costs from Firebase
  useEffect(() => {
    const loadCustomCosts = () => {
      // Thử load từ nhiều path có thể
      const paths = [
        'externalCostSettings',
        'customCosts',
        'settings/externalCosts'
      ];
      
      paths.forEach(path => {
        const settingsRef = ref(database, path);
        onValue(settingsRef, (snapshot) => {
          const data = snapshot.val();
          const allCustomCosts = [];
          
          console.log(`🔍 Loading from ${path}:`, data);
          
          if (data) {
            // Nếu data là object có các store
            if (typeof data === 'object' && !Array.isArray(data)) {
              Object.keys(data).forEach(storeId => {
                const storeData = data[storeId];
                console.log(`📋 Store ${storeId} data:`, storeData);
                
                // Thử nhiều cấu trúc có thể
                const customCostsArray = storeData.customCosts || storeData.costs?.customCosts || [];
                
                if (Array.isArray(customCostsArray)) {
                  customCostsArray.forEach((cost, index) => {
                    console.log(`💰 Processing cost:`, cost);
                    if (cost.name && cost.enabled) {
                      allCustomCosts.push({
                        key: `custom_${cost.id || index}`,
                        label: cost.name,
                        storeId: storeId
                      });
                    }
                  });
                }
              });
            }
          }
          
          if (allCustomCosts.length > 0) {
            console.log(`✅ Found ${allCustomCosts.length} custom costs from ${path}:`, allCustomCosts);
            setCustomCosts(allCustomCosts);
          }
        });
      });
    };
    
    loadCustomCosts();
  }, []);

  const handleSelectAll = () => {
    const allSelected = {};
    // Chọn tất cả chi phí cố định
    expenseOptions.forEach(option => {
      allSelected[option.key] = true;
    });
    // Chọn tất cả chi phí tùy chỉnh
    customCosts.forEach(cost => {
      allSelected[cost.key] = true;
    });
    setExpenseFilters(prev => ({ ...prev, ...allSelected }));
  };

  const handleHideAll = () => {
    const allHidden = {};
    // Ẩn tất cả chi phí cố định
    expenseOptions.forEach(option => {
      allHidden[option.key] = false;
    });
    // Ẩn tất cả chi phí tùy chỉnh
    customCosts.forEach(cost => {
      allHidden[cost.key] = false;
    });
    setExpenseFilters(prev => ({ ...prev, ...allHidden }));
  };

  const expenseOptions = [
    { key: 'phiGiaoDich', label: 'Phí Giao Dịch' },
    { key: 'phiHoaHong', label: 'Phí Hoa Hồng' },
    { key: 'phiVanChuyenThucTe', label: 'Phí Vận Chuyển Thực Tế' },
    { key: 'giamPhiVcNguoiBan', label: 'Giảm Phí VC Người Bán' },
    { key: 'giamPhiVcTikTokShop', label: 'Giảm Phí VC TikTok Shop' },
    { key: 'phiVcTaHang', label: 'Phí VC Tạ Hàng' },
    { key: 'troGiaVanChuyen', label: 'Trợ Giá Vận Chuyển' },
    { key: 'hoaHongLienKet', label: 'Hoa Hồng Liên Kết' },
    { key: 'phiVoucherXtra', label: 'Phí Voucher Xtra' },
    { key: 'thueTGTCT', label: 'Thuế GTGT' },
    { key: 'thueTNCN', label: 'Thuế TNCN' },
    { key: 'giamPhiNguoiBan', label: 'Giảm Phí Người Bán' },
    { key: 'chinhKhachPhiVanChuyen', label: 'Chỉnh Khách Phí Vận Chuyển' },
    { key: 'phiKhac', label: 'Phí Khác' },
    { key: 'chiPhiVanChuyen', label: 'Chi Phí Vận Chuyển' },
    { key: 'chiPhiDongGoi', label: 'Chi Phí Đóng Gói' },
    { key: 'chiPhiLuuKho', label: 'Chi Phí Lưu Kho' },
    { key: 'chiPhiNhanVien', label: 'Chi Phí Nhân Viên' },
    { key: 'chiPhiThueMat', label: 'Chi Phí Thuê Mặt Bằng' },
    { key: 'chiPhiDienNuoc', label: 'Chi Phí Điện Nước' },
    { key: 'chiPhiBaoHiem', label: 'Chi Phí Bảo Hiểm' },
    { key: 'chiPhiThietBi', label: 'Chi Phí Thiết Bị' },
    { key: 'chiPhiHanhChinh', label: 'Chi Phí Hành Chính' },
    { key: 'chiPhiMarketing', label: 'Chi Phí Marketing' }
  ];

  return (
    <Card style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0' }}>
        {/* Chữ bên trái - cũng có thể bấm */}
        <Text 
          strong 
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('📝 Title clicked! Current state:', showFeeFilters);
            setShowFeeFilters(!showFeeFilters);
          }}
        >
          {showFeeFilters ? '▲' : '▼'} Chọn Phí Hiển Thị chi tiết các khoản phí
        </Text>
        
        {/* Nút bấm ở giữa */}
        <div 
          style={{ 
            cursor: 'pointer',
            padding: '4px 12px',
            border: '1px dashed #d9d9d9',
            borderRadius: '4px',
            backgroundColor: '#fafafa',
            userSelect: 'none'
          }}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            console.log('🔘 Button clicked! Current state:', showFeeFilters);
            setShowFeeFilters(!showFeeFilters);
          }}
        >
          <Text type="secondary" style={{ fontSize: '12px', pointerEvents: 'none' }}>
            {showFeeFilters ? '▲ Ẩn' : '▼ Bấm để hiển thị'}
          </Text>
        </div>
      </div>
      
      {/* Debug info */}
     
      
      {showFeeFilters && (
        <div style={{ marginTop: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Space>
              <Button size="small" type="primary" onClick={handleSelectAll}>
                Chọn Tất Cả
              </Button>
              <Button size="small" onClick={handleHideAll}>
                Ẩn Tất Cả
              </Button>
            </Space>
          </div>
          <Row gutter={[16, 8]}>
            {/* Chi phí cố định */}
            {expenseOptions.map(option => (
              <Col span={6} key={option.key}>
                <Checkbox
                  checked={expenseFilters[option.key]}
                  onChange={(e) => handleExpenseFilterChange(option.key, e.target.checked)}
                >
                  {option.label}
                </Checkbox>
              </Col>
            ))}
            
            {/* Chi phí tùy chỉnh */}
            {customCosts.length > 0 && (
              <Col span={24} style={{ marginTop: 16 }}>
                <Text strong style={{ color: '#722ed1' }}>🔧 Chi Phí Tùy Chỉnh:</Text>
              </Col>
            )}
            {customCosts.map(cost => (
              <Col span={6} key={cost.key}>
                <Checkbox
                  checked={expenseFilters[cost.key]}
                  onChange={(e) => handleExpenseFilterChange(cost.key, e.target.checked)}
                >
                  <span style={{ color: '#722ed1' }}>
                    🔧 {cost.label}
                  </span>
                </Checkbox>
              </Col>
            ))}
            
            {/* Debug info */}
            {customCosts.length === 0 && (
              <Col span={24} style={{ marginTop: 16 }}>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  
                </Text>
              </Col>
            )}
          </Row>
        </div>
      )}
    </Card>
  );
};

export default FeeSelector;
