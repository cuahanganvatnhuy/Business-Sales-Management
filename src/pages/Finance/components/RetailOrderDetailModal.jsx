import React from 'react';
import { Modal, Card, Row, Col, Typography, Divider } from 'antd';

const { Title, Text } = Typography;

const RetailOrderDetailModal = ({ visible, onClose, orderData }) => {
  if (!orderData) return null;

  const {
    orderId,
    orderDate,
    createdAt,
    storeName,
    customerName,
    productName,
    quantity,
    revenue,
    importCost,
    externalCost,
    totalCost,
    profit,
    externalCostBreakdown = {}
  } = orderData;

  const formatCurrency = (amount) =>
    new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount || 0);

  const detailRows = Object.entries(externalCostBreakdown);

  return (
    <Modal
      open={visible}
      onCancel={onClose}
      width={900}
      footer={null}
      title={
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Title level={4} style={{ margin: 0, color: '#007A33' }}>
            Chi Tiết Đơn Bán Lẻ
          </Title>
          <Text code>{orderId}</Text>
        </div>
      }
    >
      <Row gutter={24}>
        <Col span={24}>
          <Card
            size="small"
            title={<Text strong style={{ color: '#007A33' }}>Thông Tin Cơ Bản</Text>}
            style={{ marginBottom: 16 }}
          >
            <Row gutter={16}>
              <Col span={6}>
                <Text strong>Mã ĐH:</Text>
                <div>{orderId}</div>
              </Col>
              <Col span={6}>
                <Text strong>Ngày:</Text>
                <div>{new Date(orderDate || createdAt).toLocaleDateString('vi-VN')}</div>
              </Col>
              <Col span={6}>
                <Text strong>Cửa Hàng:</Text>
                <div>{storeName || '-'}</div>
              </Col>
              <Col span={6}>
                <Text strong>Khách Hàng:</Text>
                <div>{customerName || '-'}</div>
              </Col>
            </Row>
            <Row gutter={16} style={{ marginTop: 12 }}>
              <Col span={12}>
                <Text strong>Sản Phẩm:</Text>
                <div style={{ fontSize: 12 }}>{productName}</div>
              </Col>
              <Col span={4}>
                <Text strong>Số lượng:</Text>
                <div>{quantity}</div>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col span={12}>
          <Card
            size="small"
            title={<Text strong style={{ color: '#1890ff' }}>Doanh Thu & Chi Phí Nhập</Text>}
            style={{ marginBottom: 16 }}
          >
            <Row style={{ marginBottom: 8 }}>
              <Col span={12}>
                <Text>Doanh Thu:</Text>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                <Text strong style={{ color: '#1890ff' }}>{formatCurrency(revenue)}</Text>
              </Col>
            </Row>
            <Row>
              <Col span={12}>
                <Text>Chi Phí Nhập:</Text>
              </Col>
              <Col span={12} style={{ textAlign: 'right' }}>
                <Text strong style={{ color: '#fa541c' }}>{formatCurrency(importCost)}</Text>
              </Col>
            </Row>
          </Card>
        </Col>

        <Col span={12}>
          <Card
            size="small"
            title={<Text strong style={{ color: '#fa8c16' }}>Chi Phí Bên Ngoài</Text>}
            style={{ marginBottom: 16 }}
          >
            {detailRows.length === 0 && (
              <Text type="secondary">Không có chi phí bên ngoài nào được áp dụng.</Text>
            )}
            {detailRows.length > 0 && (
              <>
                {detailRows.map(([key, value]) => (
                  <Row key={key} style={{ marginBottom: 6 }}>
                    <Col span={14}>
                      <Text>{key}</Text>
                    </Col>
                    <Col span={10} style={{ textAlign: 'right' }}>
                      <Text strong>{formatCurrency(value)}</Text>
                    </Col>
                  </Row>
                ))}
                <Divider style={{ margin: '8px 0' }} />
                <Row>
                  <Col span={14}>
                    <Text strong>Tổng Chi Phí Bên Ngoài:</Text>
                  </Col>
                  <Col span={10} style={{ textAlign: 'right' }}>
                    <Text strong style={{ color: '#ff7a45' }}>
                      {formatCurrency(externalCost)}
                    </Text>
                  </Col>
                </Row>
              </>
            )}
          </Card>
        </Col>

        <Col span={24}>
          <Card
            size="small"
            title={<Text strong style={{ color: '#722ed1' }}>Tổng Kết Lợi Nhuận</Text>}
          >
            <Row gutter={16}>
              <Col span={8}>
                <Text strong>Tổng Chi Phí:</Text>
                <div>
                  <Text strong style={{ color: '#ff4d4f' }}>{formatCurrency(totalCost)}</Text>
                </div>
              </Col>
              <Col span={8}>
                <Text strong>Lợi Nhuận Ròng:</Text>
                <div>
                  <Text strong style={{ color: profit >= 0 ? '#52c41a' : '#ff4d4f' }}>
                    {formatCurrency(profit)}
                  </Text>
                </div>
              </Col>
            </Row>
          </Card>
        </Col>
      </Row>
    </Modal>
  );
};

export default RetailOrderDetailModal;


