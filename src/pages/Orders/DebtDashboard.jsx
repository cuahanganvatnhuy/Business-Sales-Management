import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../../services/firebase.service';
import { useStore } from '../../contexts/StoreContext';
import { useAuth } from '../../contexts/AuthContext';
import { ref, onValue } from 'firebase/database';
import {
  Card,
  Row,
  Col,
  Statistic,
  Table,
  Progress,
  Tag,
  Button,
  Modal,
  Dropdown
} from 'antd';
import {
  DollarOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  EyeOutlined,
  EllipsisOutlined
} from '@ant-design/icons';
import { formatCurrency } from '../../utils/format';
import dayjs from 'dayjs';
import { Line, Column, Pie } from '@ant-design/plots';

const DebtDashboard = () => {
  const { selectedStore } = useStore();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const hasPermission = isAdmin || (user?.permissions || []).includes('orders.debt.dashboard.view');

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Dashboard Công Nợ. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  const [loading, setLoading] = useState(false);
  const [debtData, setDebtData] = useState({
    totalDebt: 0,
    totalCustomers: 0,
    customersWithDebt: 0,
    totalPaid: 0,
    overdueDebt: 0,
    thisMonthDebt: 0
  });
  const [topDebtors, setTopDebtors] = useState([]);
  const [debtTrend, setDebtTrend] = useState([]);
  const [debtByAge, setDebtByAge] = useState([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [customerOrders, setCustomerOrders] = useState([]);

  // Load data
  useEffect(() => {
    setLoading(true);
    const ordersRef = ref(database, 'salesOrders');
    
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        calculateDebtStats(data);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [selectedStore]);

  const calculateDebtStats = (ordersData) => {
    const customerMap = {};
    let totalDebt = 0;
    let totalPaid = 0;
    let overdueDebt = 0;
    let thisMonthDebt = 0;

    Object.keys(ordersData).forEach(key => {
      const order = ordersData[key];
      
      if (order.orderType === 'wholesale') {
        // Filter by store
        if (selectedStore && selectedStore.id !== 'all') {
          if (order.storeName !== selectedStore.name) {
            return; // Skip this order
          }
        }
        
        const customerId = order.customerId || order.customerName;
        const subtotal = order.subtotal || 0;
        const deposit = order.deposit || 0;
        const remaining = (order.remainingAmount !== undefined) 
          ? order.remainingAmount 
          : (subtotal - deposit);

        if (!customerMap[customerId]) {
          customerMap[customerId] = {
            customerId,
            customerName: order.customerName || 'N/A',
            customerPhone: order.customerPhone || '',
            totalDebt: 0,
            totalPaid: 0,
            totalOrders: 0
          };
        }

        customerMap[customerId].totalDebt += remaining;
        customerMap[customerId].totalPaid += deposit;
        customerMap[customerId].totalOrders += 1;

        totalDebt += remaining;
        totalPaid += deposit;

        // Check if this month
        const orderDate = dayjs(order.orderDate);
        if (orderDate.month() === dayjs().month() && orderDate.year() === dayjs().year()) {
          thisMonthDebt += remaining;
        }
      }
    });

    // Top debtors
    const topDebtorsArray = Object.values(customerMap)
      .filter(c => c.totalDebt > 0)
      .sort((a, b) => b.totalDebt - a.totalDebt)
      .slice(0, 10);

    // Store orders data for each customer
    Object.keys(customerMap).forEach(customerId => {
      customerMap[customerId].orders = [];
    });

    Object.keys(ordersData).forEach(key => {
      const order = ordersData[key];
      if (order.orderType === 'wholesale') {
        // Filter by store
        if (selectedStore && selectedStore.id !== 'all') {
          if (order.storeName !== selectedStore.name) {
            return; // Skip this order
          }
        }
        
        const customerId = order.customerId || order.customerName;
        if (customerMap[customerId]) {
          customerMap[customerId].orders.push({
            id: key,
            ...order,
            storeName: order.storeName || 'N/A'
          });
        }
      }
    });

    console.log('Top Debtors:', topDebtorsArray);
    console.log('Total Customers with Debt:', topDebtorsArray.length);
    
    setTopDebtors(topDebtorsArray);

    // Debt by age (simplified - real implementation would need order dates)
    setDebtByAge([
      { age: '0-30 ngày', value: totalDebt * 0.4 },
      { age: '30-60 ngày', value: totalDebt * 0.3 },
      { age: '60-90 ngày', value: totalDebt * 0.2 },
      { age: '>90 ngày', value: totalDebt * 0.1 }
    ]);

    // Trend (mock data - real would be historical)
    const months = [];
    for (let i = 5; i >= 0; i--) {
      months.push({
        month: dayjs().subtract(i, 'month').format('MM/YYYY'),
        debt: totalDebt * (0.8 + Math.random() * 0.4)
      });
    }
    setDebtTrend(months);

    setDebtData({
      totalDebt,
      totalCustomers: Object.keys(customerMap).length,
      customersWithDebt: Object.values(customerMap).filter(c => c.totalDebt > 0).length,
      totalPaid,
      overdueDebt: overdueDebt,
      thisMonthDebt
    });
  };

  // View customer orders detail
  const handleViewDetail = (customer) => {
    setSelectedCustomer(customer);
    setCustomerOrders(customer.orders || []);
    setDetailModalVisible(true);
  };

  const collectionRate = debtData.totalPaid > 0 
    ? ((debtData.totalPaid / (debtData.totalPaid + debtData.totalDebt)) * 100).toFixed(1)
    : 0;

  return (
    <div style={{ padding: '5px' }}>
      {/* Header */}
      <Card style={{ marginBottom: 24, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <DollarOutlined style={{ fontSize: 32, color: '#007A33' }} />
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h1 className="page-title" style={{ margin: 0, color: '#007A33' }}>Dashboard Công Nợ</h1>
              {selectedStore && (
                <Tag color={selectedStore.id === 'all' ? 'blue' : 'green'} style={{ fontSize: '14px', padding: '4px 12px' }}>
                  {selectedStore.id === 'all' ? '🏪 Toàn Bộ Cửa Hàng' : `📍 ${selectedStore.name}`}
                </Tag>
              )}
            </div>
            <p style={{ margin: 0, color: '#666' }}>
              {selectedStore && selectedStore.id === 'all' 
                ? 'Tổng quan công nợ tất cả cửa hàng' 
                : `Công nợ cửa hàng: ${selectedStore?.name || ''}`}
            </p>
          </div>
        </div>
      </Card>

      {/* Stats Overview */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tổng Công Nợ"
              value={formatCurrency(debtData.totalDebt)}
              valueStyle={{ color: '#ff4d4f', fontSize: 24 }}
              prefix={<DollarOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Khách Đang Nợ"
              value={debtData.customersWithDebt}
              suffix={`/ ${debtData.totalCustomers}`}
              valueStyle={{ color: '#faad14', fontSize: 24 }}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Đã Thu Hồi"
              value={formatCurrency(debtData.totalPaid)}
              valueStyle={{ color: '#52c41a', fontSize: 24 }}
              prefix={<CheckCircleOutlined />}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="Tỷ Lệ Thu Hồi"
              value={collectionRate}
              suffix="%"
              valueStyle={{ color: '#1890ff', fontSize: 24 }}
              prefix={<ClockCircleOutlined />}
            />
            <Progress 
              percent={parseFloat(collectionRate)} 
              strokeColor="#52c41a"
              size="small"
              style={{ marginTop: 8 }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        {/* Debt Trend Chart */}
        <Col xs={24} lg={16}>
          <Card 
            title="📈 Xu Hướng Công Nợ 6 Tháng"
            style={{ borderRadius: 12 }}
          >
            <Line
              data={debtTrend}
              xField="month"
              yField="debt"
              smooth
              color="#ff4d4f"
              point={{ size: 5, shape: 'diamond' }}
              yAxis={{
                label: {
                  formatter: (v) => `${(v / 1000000).toFixed(1)}M`
                }
              }}
              tooltip={{
                formatter: (datum) => {
                  return {
                    name: 'Công nợ',
                    value: formatCurrency(datum.debt)
                  };
                }
              }}
            />
          </Card>
        </Col>

        {/* Debt by Age */}
        <Col xs={24} lg={8}>
          <Card 
            title="⏰ Tuổi Nợ"
            style={{ borderRadius: 12 }}
          >
            <Pie
              data={debtByAge}
              angleField="value"
              colorField="age"
              radius={0.8}
              label={{
                type: 'outer',
                content: '{name} {percentage}'
              }}
              tooltip={{
                formatter: (datum) => {
                  return {
                    name: datum.age,
                    value: formatCurrency(datum.value)
                  };
                }
              }}
              interactions={[{ type: 'element-active' }]}
            />
          </Card>
        </Col>
      </Row>

      {/* Top Debtors */}
      <Card
        title={`🏆 Top 10 Khách Hàng Nợ Nhiều Nhất ${topDebtors.length > 0 ? `(${topDebtors.length} khách)` : ''}`}
        extra={
          <a onClick={() => navigate('/orders/debt')}>Xem Tất Cả →</a>
        }
        style={{ borderRadius: 12 }}
        loading={loading}
      >
        <Table
          size="small"
          dataSource={topDebtors}
          rowKey="customerId"
          pagination={false}
          locale={{
            emptyText: (
              <div style={{ padding: '40px', textAlign: 'center' }}>
                <WarningOutlined style={{ fontSize: 48, color: '#faad14', marginBottom: 16 }} />
                <p style={{ fontSize: 16, color: '#666' }}>Không có khách hàng nào đang nợ</p>
                <p style={{ fontSize: 14, color: '#999' }}>Tất cả đơn hàng sỉ đã được thanh toán</p>
              </div>
            )
          }}
          columns={[
            {
              title: 'Xếp Hạng',
              key: 'rank',
              width: 80,
              align: 'center',
              render: (_, __, index) => {
                const medals = ['🥇', '🥈', '🥉'];
                return medals[index] || index + 1;
              }
            },
            {
              title: 'Khách Hàng',
              dataIndex: 'customerName',
              key: 'customerName',
              render: (name, record) => (
                <div>
                  <div style={{ fontWeight: 600 }}>{name}</div>
                  <div style={{ fontSize: 12, color: '#666' }}>{record.customerPhone}</div>
                </div>
              )
            },
            {
              title: 'Số Đơn',
              dataIndex: 'totalOrders',
              key: 'totalOrders',
              width: 100,
              align: 'center',
              render: (count) => <Tag color="blue">{count} đơn</Tag>
            },
            {
              title: 'Đã TT',
              dataIndex: 'totalPaid',
              key: 'totalPaid',
              width: 130,
              align: 'right',
              render: (amount) => (
                <span style={{ color: '#52c41a' }}>
                  {formatCurrency(amount)}
                </span>
              )
            },
            {
              title: 'Công Nợ',
              dataIndex: 'totalDebt',
              key: 'totalDebt',
              width: 150,
              align: 'right',
              render: (amount) => (
                <span style={{ color: '#ff4d4f', fontWeight: 600, fontSize: 16 }}>
                  {formatCurrency(amount)}
                </span>
              )
            },
            {
              title: '% Tổng Nợ',
              key: 'percentage',
              width: 120,
              align: 'center',
              render: (_, record) => {
                const percentage = ((record.totalDebt / debtData.totalDebt) * 100).toFixed(1);
                return (
                  <div>
                    <Progress
                      percent={parseFloat(percentage)}
                      size="small"
                      strokeColor="#ff4d4f"
                    />
                  </div>
                );
              }
            },
            {
              title: 'Thao Tác',
              key: 'action',
              width: 100,
              align: 'center',
              render: (_, record) => {
                const menuItems = [
                  {
                    key: 'view',
                    icon: <EyeOutlined style={{ color: '#1890ff' }} />,
                    label: 'Xem chi tiết',
                    onClick: () => handleViewDetail(record)
                  }
                ];

                return (
                  <Dropdown
                    menu={{ items: menuItems }}
                    trigger={['click']}
                    placement="bottomRight"
                  >
                    <Button
                      icon={<EllipsisOutlined style={{ fontSize: 16, fontWeight: 'bold' }} />}
                      size="small"
                    />
                  </Dropdown>
                );
              }
            }
          ]}
        />
      </Card>

      {/* Customer Orders Detail Modal */}
      <Modal
        title={<><EyeOutlined style={{ marginRight: 8 }} />Chi Tiết Đơn Hàng - {selectedCustomer?.customerName}</>}
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            Đóng
          </Button>
        ]}
        width={1200}
      >
        {selectedCustomer && (
          <div>
            {/* Customer Info */}
            <Card size="small" style={{ marginBottom: 16, background: '#f0f9ff' }}>
              <Row gutter={16}>
                <Col span={12}>
                  <p style={{ margin: '4px 0' }}><strong>Khách Hàng:</strong> {selectedCustomer.customerName}</p>
                  <p style={{ margin: '4px 0' }}><strong>SĐT:</strong> {selectedCustomer.customerPhone}</p>
                </Col>
                <Col span={12}>
                  <p style={{ margin: '4px 0' }}><strong>Tổng Đơn:</strong> {selectedCustomer.totalOrders} đơn</p>
                  <p style={{ margin: '4px 0' }}><strong>Tổng Tiền:</strong> <span style={{ color: '#007A33', fontWeight: 600 }}>{formatCurrency(selectedCustomer.totalOrders > 0 ? customerOrders.reduce((sum, order) => sum + (order.subtotal || 0), 0) : 0)}</span></p>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 12, paddingTop: 12, borderTop: '1px dashed #d9d9d9' }}>
                <Col span={12}>
                  <p style={{ margin: '4px 0' }}><strong>Đã Thanh Toán:</strong> <span style={{ color: '#52c41a', fontWeight: 600 }}>{formatCurrency(selectedCustomer.totalPaid)}</span></p>
                </Col>
                <Col span={12}>
                  <p style={{ margin: '4px 0' }}><strong>Còn Nợ:</strong> <span style={{ color: '#ff4d4f', fontWeight: 600, fontSize: 16 }}>{formatCurrency(selectedCustomer.totalDebt)}</span></p>
                </Col>
              </Row>
            </Card>

            {/* Orders Table */}
            <Table
              size="small"
              dataSource={customerOrders}
              rowKey="id"
              pagination={false}
              expandable={{
                expandedRowRender: (record) => (
                  <div style={{ padding: '12px', background: '#fafafa' }}>
                    <strong style={{ marginBottom: 8, display: 'block' }}>📦 Sản phẩm trong đơn:</strong>
                    {record.items && record.items.length > 0 ? (
                      <Table
                        size="small"
                        dataSource={record.items}
                        rowKey={(item, index) => index}
                        pagination={false}
                        columns={[
                          {
                            title: 'Tên sản phẩm',
                            dataIndex: 'productName',
                            key: 'productName'
                          },
                          {
                            title: 'SKU',
                            dataIndex: 'sku',
                            key: 'sku',
                            width: 120
                          },
                          {
                            title: 'Số lượng',
                            dataIndex: 'quantity',
                            key: 'quantity',
                            width: 100,
                            align: 'center',
                            render: (qty, item) => `${qty} ${item.unit || 'kg'}`
                          },
                          {
                            title: 'Đơn giá',
                            dataIndex: 'priceAfterDiscount',
                            key: 'priceAfterDiscount',
                            width: 120,
                            align: 'right',
                            render: (price, item) => formatCurrency(price || item.sellingPrice || 0)
                          },
                          {
                            title: 'Thành tiền',
                            dataIndex: 'subtotal',
                            key: 'subtotal',
                            width: 120,
                            align: 'right',
                            render: (amount) => (
                              <span style={{ color: '#007A33', fontWeight: 600 }}>
                                {formatCurrency(amount || 0)}
                              </span>
                            )
                          }
                        ]}
                      />
                    ) : (
                      <p style={{ margin: 0, color: '#666' }}>Không có thông tin sản phẩm</p>
                    )}
                  </div>
                ),
                expandIcon: ({ expanded, onExpand, record }) =>
                  expanded ? (
                    <Button size="small" icon={<span>▼</span>} onClick={e => onExpand(record, e)} />
                  ) : (
                    <Button size="small" icon={<span>▶</span>} onClick={e => onExpand(record, e)} />
                  )
              }}
              columns={[
                {
                  title: 'STT',
                  key: 'stt',
                  width: 50,
                  render: (_, __, index) => index + 1
                },
                {
                  title: 'Mã Đơn',
                  dataIndex: 'orderId',
                  key: 'orderId',
                  width: 180
                },
                {
                  title: 'Ngày',
                  dataIndex: 'orderDate',
                  key: 'orderDate',
                  width: 100,
                  render: (date) => dayjs(date).format('DD/MM/YYYY')
                },
                {
                  title: 'Tổng Tiền',
                  dataIndex: 'subtotal',
                  key: 'subtotal',
                  width: 120,
                  align: 'right',
                  render: (amount) => formatCurrency(amount || 0)
                },
                {
                  title: 'Đặt Cọc',
                  dataIndex: 'deposit',
                  key: 'deposit',
                  width: 120,
                  align: 'right',
                  render: (amount) => (
                    <span style={{ color: '#52c41a' }}>
                      {formatCurrency(amount || 0)}
                    </span>
                  )
                },
                {
                  title: 'Còn Lại',
                  dataIndex: 'remainingAmount',
                  key: 'remainingAmount',
                  width: 120,
                  align: 'right',
                  render: (amount) => (
                    <span style={{ color: amount > 0 ? '#ff4d4f' : '#52c41a', fontWeight: 600 }}>
                      {formatCurrency(amount || 0)}
                    </span>
                  )
                },
                {
                  title: 'Trạng Thái Thanh Toán',
                  dataIndex: 'paymentStatus',
                  key: 'paymentStatus',
                  width: 130,
                  align: 'center',
                  render: (status) => {
                    const config = {
                      paid: { text: 'Đã thanh toán', color: 'green' },
                      partial: { text: 'Thanh toán 1 phần', color: 'orange' },
                      pending: { text: 'Chưa thanh toán', color: 'red' }
                    };
                    const statusConfig = config[status] || config.pending;
                    return <Tag color={statusConfig.color}>{statusConfig.text}</Tag>;
                  }
                }
              ]}
            />
          </div>
        )}
      </Modal>
    </div>
  );
};

export default DebtDashboard;
