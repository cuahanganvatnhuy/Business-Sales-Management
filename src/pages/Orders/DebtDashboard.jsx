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
  Tag
} from 'antd';
import {
  DollarOutlined,
  UserOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  WarningOutlined
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
            }
          ]}
        />
      </Card>
    </div>
  );
};

export default DebtDashboard;
