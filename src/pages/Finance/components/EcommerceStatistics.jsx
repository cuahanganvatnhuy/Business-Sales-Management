import React from 'react';
import { Card, Row, Col, Statistic, Tag, Typography } from 'antd';
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
            title="Tổng Lợi Nhuận TMĐT"
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
            title="Tổng Phí Sàn TMĐT"
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
            title="Tổng Giá Nhập TMĐT"
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
            title="Tổng Doanh Thu TMĐT"
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
            title="Lợi Nhuận Gộp (Chưa tính Phí)"
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
            title="Lợi Nhuận Tất Cả Sàn"
            value={statistics.netProfit}
            precision={0}
            valueStyle={{ color: statistics.netProfit >= 0 ? '#52c41a' : '#ff4d4f' }}
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
