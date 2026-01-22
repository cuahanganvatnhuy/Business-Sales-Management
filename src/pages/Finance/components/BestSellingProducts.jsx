import React from 'react';
import { Card, Table, Typography, Tag } from 'antd';

const { Text } = Typography;

const BestSellingProducts = ({ products, loading }) => {
  const columns = [
    {
      title: 'STT',
      key: 'index',
      width: 60,
      render: (_, __, index) => index + 1
    },
    {
      title: 'Sản Phẩm',
      dataIndex: 'productName',
      key: 'productName',
      ellipsis: true,
      render: (text) => <Text strong>{text}</Text>
    },
    {
      title: 'Sàn',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      render: (platform) => (
        <Tag color="blue">{platform}</Tag>
      )
    },
    {
      title: 'Lượt Bán',
      dataIndex: 'soldCount',
      key: 'soldCount',
      width: 100,
      align: 'center',
      render: (count) => <Text strong>{count}</Text>
    },
    {
      title: 'Doanh Thu',
      dataIndex: 'revenue',
      key: 'revenue',
      width: 150,
      align: 'right',
      render: (revenue) => (
        <Text style={{ color: '#1890ff' }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(revenue)}
        </Text>
      )
    },
    {
      title: 'Lợi Nhuận',
      dataIndex: 'profit',
      key: 'profit',
      width: 150,
      align: 'right',
      render: (profit) => (
        <Text strong style={{ color: profit >= 0 ? '#52c41a' : '#ff4d4f' }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(profit)}
        </Text>
      )
    },
    {
      title: 'Tỷ Lệ (%)',
      key: 'profitMargin',
      width: 100,
      align: 'center',
      render: (_, record) => {
        const margin = record.revenue > 0 ? (record.profit / record.revenue) * 100 : 0;
        return (
          <Tag color={margin >= 30 ? 'green' : margin >= 15 ? 'orange' : 'red'}>
            {margin.toFixed(1)}%
          </Tag>
        );
      }
    }
  ];

  return (
    <Card title="🏃 Sản Phẩm Bán Chạy" style={{ marginBottom: 24 }}>
      <Table
        columns={columns}
        dataSource={products}
        loading={loading}
        pagination={{
          pageSize: 10,
          showSizeChanger: false,
          showTotal: (total) => `Tổng ${total} sản phẩm`
        }}
        scroll={{ x: 800 }}
        size="small"
      />
    </Card>
  );
};

export default BestSellingProducts;
