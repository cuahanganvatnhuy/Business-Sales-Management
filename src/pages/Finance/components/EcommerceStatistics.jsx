import React from 'react';
import { Card, Row, Col, Statistic, Tag, Typography, Tooltip, Space } from 'antd';
import { 
  DollarOutlined, 
  ShoppingCartOutlined, 
  RiseOutlined,
  FallOutlined,
  PlusOutlined,
  MinusOutlined
} from '@ant-design/icons';

const { Text } = Typography;

const EcommerceStatistics = ({ statistics, selectedPlatformLabel = 'Tất Cả Sàn' }) => {
  const isAllPlatforms = selectedPlatformLabel === 'Tất Cả Sàn';
  const totalProfitTitle = isAllPlatforms
    ? 'Tổng Lợi Nhuận TMĐT'
    : `Tổng Lợi Nhuận - ${selectedPlatformLabel}`;
  const renderTitle = (label, tooltip) => ( 
    <Space size={4}>
      <span>{label}</span>
      {tooltip && (
        <Tooltip title={tooltip} placement="top">
          <RiseOutlined style={{ fontSize: 12, color: '#999' }} />
        </Tooltip>
      )}
    </Space>
  );

  return (
    <>
      <div style={{ marginBottom: 8 }}>
        <Text type="secondary">
          Đang xem dữ liệu cho:{' '}
        </Text>
        <Tag color="green" style={{ fontSize: 14, padding: '2px 12px' }}>
          {selectedPlatformLabel}
        </Tag>
      </div>
      <Row gutter={16} style={{ marginBottom: 24 }}>
      <Col span={4}>
        <Card>
          <Statistic
            title={renderTitle('Tổng Doanh Thu TMĐT', 'Tổng doanh thu của các đơn TMĐT trong phạm vi lọc hiện tại.')}
            value={statistics.totalRevenue}
            precision={0}
            valueStyle={{ color: '#1890ff' }}
            prefix={<DollarOutlined />}
            suffix="₫"
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title={renderTitle('Tổng Giá Nhập TMĐT', 'Tổng chi phí nhập hàng của các đơn TMĐT.')}
            value={statistics.totalImportCost}
            precision={0}
            valueStyle={{ color: '#722ed1' }}
            prefix={<ShoppingCartOutlined />}
            suffix="₫"
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title={renderTitle('Tổng Phí Sàn TMĐT', 'Bao gồm phí sàn + chi phí phụ bên ngoài + phí thùng (nếu có).')}
            value={statistics.totalPlatformFee}
            precision={0}
            valueStyle={{ color: '#ff4d4f' }}
            prefix={<MinusOutlined />}
            suffix="₫"
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title={renderTitle('Lợi Nhuận (Chưa tính Phí)', 'Doanh thu trừ giá nhập, chưa trừ phí sàn và chi phí ngoài.')}
            value={statistics.grossProfit}
            precision={0}
            valueStyle={{ color: '#52c41a' }}
            prefix={<PlusOutlined />}
            suffix="₫"
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title={renderTitle(totalProfitTitle, 'Lợi nhuận ròng của kênh TMĐT đang lọc (đã trừ mọi chi phí).')}
            value={statistics.totalProfit}
            precision={0}
            valueStyle={{ color: statistics.totalProfit >= 0 ? '#52c41a' : '#ff4d4f' }}
            prefix={<RiseOutlined />}
            suffix="₫"
          />
        </Card>
      </Col>
      <Col span={4}>
        <Card>
          <Statistic
            title={renderTitle('Lợi Nhuận Tất Cả Sàn', 'Tổng lợi nhuận ròng của toàn bộ TMĐT (bỏ qua bộ lọc sàn).')}
            value={statistics.netProfitAllPlatforms ?? statistics.netProfit}
            precision={0}
            valueStyle={{ color: (statistics.netProfitAllPlatforms ?? statistics.netProfit) >= 0 ? '#52c41a' : '#ff4d4f' }}
            prefix={<RiseOutlined />}
            suffix="₫"
          />
        </Card>
      </Col>
      </Row>
    </>
  );
};

export default EcommerceStatistics;
