import React from 'react';
import { Row, Col, Card, Typography } from 'antd';

const { Text } = Typography;

const FeeDisplayCards = ({ selectedFees, feeData, customCosts = [] }) => {
  const feeCards = [
    { key: 'phiGiaoDich', label: 'Phí Giao Dịch', color: '#1890ff', icon: '💳' },
    { key: 'phiHoaHong', label: 'Phí Hoa Hồng', color: '#52c41a', icon: '💰' },
    { key: 'phiVanChuyenThucTe', label: 'Phí Vận Chuyển Thực Tế', color: '#faad14', icon: '🚚' },
    { key: 'giamPhiVcNguoiBan', label: 'Giảm Phí VC Người Bán', color: '#13c2c2', icon: '👤' },
    { key: 'giamPhiVcTikTokShop', label: 'Giảm Phí VC TikTok Shop', color: '#eb2f96', icon: '🎯' },
    { key: 'phiVcTaHang', label: 'Phí VC Tạ Hàng', color: '#722ed1', icon: '🏪' },
    { key: 'troGiaVanChuyen', label: 'Trợ Giá Vận Chuyển', color: '#f5222d', icon: '🎁' },
    { key: 'hoaHongLienKet', label: 'Hoa Hồng Liên Kết', color: '#fa8c16', icon: '🔗' },
    { key: 'phiVoucherXtra', label: 'Phí Voucher Xtra', color: '#a0d911', icon: '🎫' },
    { key: 'thueTGTCT', label: 'Thuế GTGT', color: '#ff7a45', icon: '📊' },
    { key: 'thueTNCN', label: 'Thuế TNCN', color: '#ffadd6', icon: '📈' },
    { key: 'giamPhiNguoiBan', label: 'Giảm Phí Người Bán', color: '#87e8de', icon: '👥' },
    { key: 'chinhKhachPhiVanChuyen', label: 'Chỉnh Khách Phí Vận Chuyển', color: '#ffc069', icon: '✏️' },
    { key: 'phiKhac', label: 'Phí Khác', color: '#d3adf7', icon: '❓' },
    { key: 'chiPhiVanChuyen', label: 'Chi Phí Vận Chuyển', color: '#722ed1', icon: '🛻' },
    { key: 'chiPhiDongGoi', label: 'Chi Phí Đóng Gói', color: '#ffd666', icon: '📦' },
    { key: 'chiPhiLuuKho', label: 'Chi Phí Lưu Kho', color: '#95de64', icon: '🏭' },
    { key: 'chiPhiNhanVien', label: 'Chi Phí Nhân Viên', color: '#85a5ff', icon: '👷' },
    { key: 'chiPhiThueMat', label: 'Chi Phí Thuê Mặt Bằng', color: '#ffb37d', icon: '🏢' },
    { key: 'chiPhiDienNuoc', label: 'Chi Phí Điện Nước', color: '#b7eb8f', icon: '⚡' },
    { key: 'chiPhiBaoHiem', label: 'Chi Phí Bảo Hiểm', color: '#ffc53d', icon: '🛡️' },
    { key: 'chiPhiThietBi', label: 'Chi Phí Thiết Bị', color: '#ff9c6e', icon: '🔧' },
    { key: 'chiPhiHanhChinh', label: 'Chi Phí Hành Chính', color: '#d3f261', icon: '📋' },
    { key: 'chiPhiMarketing', label: 'Chi Phí Marketing', color: '#ffa39e', icon: '📢' }
  ];

  // Thêm chi phí tùy chỉnh vào danh sách cards
  const customFeeCards = customCosts.map(cost => ({
    key: cost.key,
    label: cost.label,
    color: '#722ed1',
    icon: '🔧'
  }));
  
  const allFeeCards = [...feeCards, ...customFeeCards];
  
  // Chỉ hiển thị các phí được chọn
  const displayCards = allFeeCards.filter(card => selectedFees[card.key]);

  if (displayCards.length === 0) {
    return null;
  }

  return (
    <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
      {displayCards.map(card => (
        <Col xs={12} sm={8} md={6} lg={4} xl={4} key={card.key}>
          <Card 
            size="small"
            style={{ 
              textAlign: 'center',
              border: `2px solid ${card.color}`,
              borderRadius: 8
            }}
          >
            <div style={{ 
              background: card.color, 
              color: 'white', 
              padding: '4px 8px',
              borderRadius: 4,
              fontSize: 12,
              marginBottom: 8,
              display: 'inline-block'
            }}>
              {card.icon}
            </div>
            <div>
              <Text strong style={{ fontSize: 12, display: 'block' }}>
                {card.label}
              </Text>
              <Text strong style={{ 
                fontSize: 16, 
                color: card.color,
                display: 'block',
                marginTop: 4
              }}>
                {new Intl.NumberFormat('vi-VN').format(feeData[card.key] || 0)} ₫
              </Text>
              <Text type="secondary" style={{ fontSize: 10 }}>
                -
              </Text>
            </div>
          </Card>
        </Col>
      ))}
    </Row>
  );
};

export default FeeDisplayCards;
