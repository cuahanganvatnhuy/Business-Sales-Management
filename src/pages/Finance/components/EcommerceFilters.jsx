import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Select, DatePicker, Button, Space, Typography, Tag, Checkbox, Collapse } from 'antd';
import { SettingOutlined, DownOutlined, UpOutlined, FilterOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import { useStore } from '../../../contexts/StoreContext';
import PlatformFeeSettings from './PlatformFeeSettings';
import ExternalCostSettings from './ExternalCostSettings';
import PackagingCostSettings from './PackagingCostSettings';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Text } = Typography;

const EcommerceFilters = ({ 
  dateRange, 
  setDateRange, 
  selectedStore, 
  setSelectedStore, // Không dùng nữa, sẽ dùng global selectStore
  selectedPlatform,
  setSelectedPlatform,
  stores,
  platforms,
  expenseFilters,
  setExpenseFilters
}) => {
  // Dùng global store functions
  const { selectStore, stores: globalStores } = useStore();
  
  console.log('🏪 EcommerceFilters received selectedStore:', selectedStore);
  
  const [showPlatformSettings, setShowPlatformSettings] = useState(false);
  const [showExternalSettings, setShowExternalSettings] = useState(false);
  const [showPackagingSettings, setShowPackagingSettings] = useState(false);
  
  const handleExpenseFilterChange = (key, checked) => {
    setExpenseFilters(prev => ({
      ...prev,
      [key]: checked
    }));
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
    <>
      <Card style={{ marginBottom: 24 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          {/* Bộ lọc chính */}
          <Row gutter={16}>
            <Col span={6}>
              <Text strong>Chọn Cửa Hàng:</Text>
              <Select 
                value={selectedStore} 
                onChange={(storeId) => {
                  // Dùng global selectStore function
                  if (storeId === 'all') {
                    selectStore(null); // Clear selection for "all"
                  } else {
                    const store = globalStores.find(s => s.id === storeId);
                    if (store) {
                      selectStore(store);
                    }
                  }
                }} 
                style={{ width: '100%', marginTop: 8 }}
              >
                <Option value="all">Tất Cả Cửa Hàng</Option>
                {stores.map(store => (
                  <Option key={store.id} value={store.id}>
                    {store.name || store.storeName}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col span={6}>
              <Text strong>Chọn Sàn TMĐT:</Text>
              <Select 
                value={selectedPlatform} 
                onChange={setSelectedPlatform} 
                style={{ width: '100%', marginTop: 8 }}
              >
                <Option value="all">Tất Cả Sàn</Option>
                {platforms.map(platform => (
                  <Option key={platform} value={platform}>
                    {platform}
                  </Option>
                ))}
              </Select>
            </Col>
            <Col span={6}>
              <Text strong>Từ Ngày:</Text>
              <RangePicker 
                value={dateRange} 
                onChange={setDateRange} 
                format="DD/MM/YYYY"
                style={{ width: '100%', marginTop: 8 }}
              />
            </Col>
            <Col span={6}>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Button 
                  type="primary" 
                  icon={<SettingOutlined />}
                  onClick={() => setShowPlatformSettings(true)}
                  style={{ width: '100%' }}
                >
                  🏪 Cài Đặt Phí Sàn
                </Button>
                <Button 
                  type="default" 
                  icon={<SettingOutlined />}
                  onClick={() => setShowExternalSettings(true)}
                  style={{ width: '100%' }}
                >
                  🌐 Cài Đặt Chi Phí Bên Ngoài
                </Button>
                <Button 
                  type="dashed" 
                  icon={<SettingOutlined />}
                  onClick={() => setShowPackagingSettings(true)}
                  style={{ width: '100%' }}
                >
                  📦 Cài Đặt Chi Phí Thùng Đóng Gói
                </Button>
              </Space>
            </Col>
          </Row>

        </Space>
      </Card>

      {/* Modals */}
      <PlatformFeeSettings
        visible={showPlatformSettings}
        onClose={() => setShowPlatformSettings(false)}
        selectedPlatform={selectedPlatform}
        selectedStore={selectedStore}
        onSave={(settings) => console.log('Platform settings saved:', settings)}
      />
      
      <ExternalCostSettings
        visible={showExternalSettings}
        onClose={() => setShowExternalSettings(false)}
        selectedStore={selectedStore}
        onSave={(settings) => console.log('External cost settings saved:', settings)}
      />
      
      <PackagingCostSettings
        visible={showPackagingSettings}
        onClose={() => setShowPackagingSettings(false)}
        selectedStore={selectedStore}
        onSave={(settings) => console.log('Packaging settings saved:', settings)}
      />
    </>
  );
};

export default EcommerceFilters;
