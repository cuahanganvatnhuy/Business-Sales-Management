import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { database } from '../../services/firebase.service';
import { ref, onValue, remove } from 'firebase/database';
import {
  Card,
  Table,
  Button,
  Input,
  DatePicker,
  Space,
  Tag,
  Select,
  Row,
  Col,
  Statistic,
  message,
  Popconfirm
} from 'antd';
import {
  ShoppingOutlined,
  ShopOutlined,
  TeamOutlined,
  SearchOutlined,
  DownloadOutlined,
  FilterOutlined,
  CloseCircleOutlined,
  CalendarOutlined,
  DeleteOutlined
} from '@ant-design/icons';
import { formatCurrency } from '../../utils/format';
import dayjs from 'dayjs';
import * as XLSX from 'xlsx';

const { RangePicker } = DatePicker;
const { Option } = Select;

const ManageOrdersTMDT = () => {
  const navigate = useNavigate();
  
  // States
  const [orders, setOrders] = useState([]);
  const [filteredOrders, setFilteredOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [dateRange, setDateRange] = useState([null, null]);
  const [platformFilter, setPlatformFilter] = useState('all');
  const [storeFilter, setStoreFilter] = useState('all');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);

  // Load orders from Firebase
  useEffect(() => {
    setLoading(true);
    const ordersRef = ref(database, 'salesOrders');
    
    const unsubscribe = onValue(ordersRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        // Group items by order instead of flattening
        const ordersArray = [];
        
        Object.keys(data).forEach(key => {
          const order = data[key];
          
          // Skip if not ecommerce order
          if (order.orderType !== 'ecommerce') return;
          
          // Group all items into order summary
          if (order.items && Array.isArray(order.items) && order.items.length > 0) {
            // Calculate totals from all items
            const totalQuantity = order.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
            const totalSubtotal = order.items.reduce((sum, item) => sum + (item.subtotal || 0), 0);
            const totalProfit = order.items.reduce((sum, item) => sum + (item.profit || 0), 0);
            
            // Get product names (comma separated)
            const productNames = order.items.map(item => item.productName).join(', ');
            const skus = order.items.map(item => item.sku).join(', ');
            
            ordersArray.push({
              id: key,
              orderId: order.orderId || key,
              orderDate: order.orderDate,
              platform: order.platform,
              otherPlatform: order.otherPlatform,
              createdAt: order.createdAt,
              updatedAt: order.updatedAt,
              // Aggregated item data
              productName: productNames,
              sku: skus,
              itemCount: order.items.length,
              quantity: totalQuantity,
              unit: order.items[0]?.unit || 'kg', // Use first item's unit
              subtotal: totalSubtotal,
              profit: totalProfit,
              // Store items for detail view
              items: order.items,
              _originalOrderKey: key
            });
          } else {
            // Legacy format: data directly on order object
            ordersArray.push({
              id: key,
              orderId: order.orderId || key,
              ...order,
              itemCount: 1,
              _originalOrderKey: key
            });
          }
        });
        
        // Sort by creation date
        ordersArray.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        
        console.log('📦 Loaded orders:', ordersArray.length);
        console.log('📊 Sample order:', ordersArray[0]);
        
        setOrders(ordersArray);
        setFilteredOrders(ordersArray);
      } else {
        setOrders([]);
        setFilteredOrders([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...orders];

    // Search filter
    if (searchText) {
      filtered = filtered.filter(order =>
        order.productName?.toLowerCase().includes(searchText.toLowerCase()) ||
        order.sku?.toLowerCase().includes(searchText.toLowerCase()) ||
        order.orderId?.toLowerCase().includes(searchText.toLowerCase())
      );
    }

    // Date range filter
    if (dateRange[0] && dateRange[1]) {
      filtered = filtered.filter(order => {
        const orderDate = dayjs(order.orderDate);
        return orderDate.isAfter(dateRange[0].startOf('day')) && 
               orderDate.isBefore(dateRange[1].endOf('day'));
      });
    }

    // Platform filter
    if (platformFilter !== 'all') {
      filtered = filtered.filter(order => order.platform === platformFilter);
    }

    setFilteredOrders(filtered);
  }, [searchText, dateRange, platformFilter, orders]);

  // Quick date filters
  const handleQuickFilter = (type) => {
    const today = dayjs();
    switch(type) {
      case 'today':
        setDateRange([today, today]);
        break;
      case 'week':
        setDateRange([today.startOf('week'), today.endOf('week')]);
        break;
      case 'month':
        setDateRange([today.startOf('month'), today.endOf('month')]);
        break;
      default:
        break;
    }
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchText('');
    setDateRange([null, null]);
    setPlatformFilter('all');
    setStoreFilter('all');
    message.success('Đã xóa tất cả bộ lọc');
  };

  // Delete single order
  const handleDeleteOrder = async (record) => {
    try {
      const orderRef = ref(database, `salesOrders/${record.id}`);
      await remove(orderRef);
      message.success('Đã xóa đơn hàng thành công!');
      setSelectedRowKeys(selectedRowKeys.filter(key => key !== record.id));
    } catch (error) {
      console.error('Error deleting order:', error);
      message.error('Lỗi khi xóa đơn hàng: ' + error.message);
    }
  };

  // Delete selected orders
  const handleDeleteSelected = async () => {
    if (selectedRowKeys.length === 0) {
      message.warning('Vui lòng chọn ít nhất 1 đơn hàng để xóa!');
      return;
    }

    try {
      setLoading(true);
      
      const deletePromises = selectedRowKeys.map(orderId => {
        const orderRef = ref(database, `salesOrders/${orderId}`);
        return remove(orderRef);
      });
      
      await Promise.all(deletePromises);
      message.success(`Đã xóa ${selectedRowKeys.length} đơn hàng thành công!`);
      setSelectedRowKeys([]);
    } catch (error) {
      console.error('Error deleting selected orders:', error);
      message.error('Lỗi khi xóa đơn hàng: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete all filtered orders
  const handleDeleteAll = async () => {
    if (filteredOrders.length === 0) {
      message.warning('Không có đơn hàng nào để xóa!');
      return;
    }

    try {
      setLoading(true);
      
      const deletePromises = filteredOrders.map(order => {
        const orderRef = ref(database, `salesOrders/${order.id}`);
        return remove(orderRef);
      });
      
      await Promise.all(deletePromises);
      message.success(`Đã xóa tất cả ${filteredOrders.length} đơn hàng!`);
      setSelectedRowKeys([]);
    } catch (error) {
      console.error('Error deleting all orders:', error);
      message.error('Lỗi khi xóa đơn hàng: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    const exportData = filteredOrders.map((order, index) => ({
      'STT': index + 1,
      'Mã Đơn': order.orderId,
      'Sản Phẩm': order.productName,
      'SKU': order.sku,
      'Sàn TMĐT': getPlatformName(order.platform),
      'Ngày Đặt': order.orderDate,
      'Số Lượng': order.quantity,
      'Đơn Vị': order.unit || 'kg',
      'Giá Bán': order.sellingPrice,
      'Tổng Tiền': order.subtotal,
      'Cửa Hàng': order.storeName || 'N/A'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Đơn Hàng TMĐT');
    XLSX.writeFile(wb, `DonHangTMDT_${dayjs().format('YYYYMMDD')}.xlsx`);
    message.success('Đã xuất file Excel thành công!');
  };

  // Get platform name
  const getPlatformName = (platform) => {
    const platforms = {
      'shopee': 'Shopee',
      'lazada': 'Lazada',
      'tiktok': 'TikTok Shop',
      'sendo': 'Sendo',
      'tiki': 'Tiki',
      'facebook': 'Facebook',
      'zalo': 'Zalo',
      'other': 'Khác'
    };
    return platforms[platform] || platform;
  };

  // Get platform color
  const getPlatformColor = (platform) => {
    const colors = {
      'shopee': 'orange',
      'lazada': 'blue',
      'tiktok': 'black',
      'sendo': 'red',
      'tiki': 'cyan',
      'facebook': 'blue',
      'zalo': 'blue',
      'other': 'default'
    };
    return colors[platform] || 'default';
  };

  // Table columns
  const columns = [
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      align: 'center',
      fixed: 'left',
      render: (_, __, index) => index + 1
    },
    {
      title: 'Mã Đơn',
      dataIndex: 'orderId',
      key: 'orderId',
      width: 180,
      fixed: 'left',
      render: (orderId) => orderId || 'N/A'
    },
    {
      title: 'Sản Phẩm',
      dataIndex: 'productName',
      key: 'productName',
      width: 250,
      render: (name, record) => {
        if (record.itemCount > 1) {
          return (
            <div>
              <div style={{ fontWeight: 600 }}>{record.itemCount} sản phẩm</div>
              <div style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {name}
              </div>
            </div>
          );
        }
        return name || 'N/A';
      }
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 150,
      render: (sku, record) => {
        if (record.itemCount > 1) {
          return (
            <div style={{ fontSize: 12, color: '#666', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {sku || 'N/A'}
            </div>
          );
        }
        return sku || 'N/A';
      }
    },
    {
      title: 'Sàn TMĐT',
      dataIndex: 'platform',
      key: 'platform',
      width: 120,
      render: (platform) => (
        <Tag color={getPlatformColor(platform)}>
          {getPlatformName(platform)}
        </Tag>
      )
    },
    {
      title: 'Ngày Đặt',
      dataIndex: 'orderDate',
      key: 'orderDate',
      width: 120,
      render: (date) => date ? dayjs(date).format('DD/MM/YYYY') : 'N/A'
    },
    {
      title: 'Số Lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'center',
      render: (qty) => qty || 0
    },
    {
      title: 'Đơn Vị',
      dataIndex: 'unit',
      key: 'unit',
      width: 80,
      align: 'center',
      render: (unit) => unit || 'kg'
    },
    {
      title: 'Giá Bán',
      dataIndex: 'sellingPrice',
      key: 'sellingPrice',
      width: 120,
      align: 'right',
      render: (price) => formatCurrency(price || 0)
    },
    {
      title: 'Tổng Tiền',
      dataIndex: 'subtotal',
      key: 'subtotal',
      width: 130,
      align: 'right',
      render: (amount) => (
        <span style={{ color: '#007A33', fontWeight: 600 }}>
          {formatCurrency(amount || 0)}
        </span>
      )
    },
    {
      title: 'Cửa Hàng',
      dataIndex: 'storeName',
      key: 'storeName',
      width: 130,
      align: 'center',
      render: (storeName) => (
        <span style={{ color: '#666' }}>
          {storeName || 'N/A'}
        </span>
      )
    },
    {
      title: 'Thao Tác',
      key: 'action',
      width: 100,
      align: 'center',
      fixed: 'right',
      render: (_, record) => (
        <Popconfirm
          title="Xóa đơn hàng này?"
          description="Bạn có chắc chắn muốn xóa đơn hàng này không?"
          onConfirm={() => handleDeleteOrder(record)}
          okText="Xóa"
          cancelText="Hủy"
          okButtonProps={{ danger: true }}
        >
          <Button 
            type="text" 
            danger 
            icon={<DeleteOutlined />}
            size="small"
          >
            Xóa
          </Button>
        </Popconfirm>
      )
    }
  ];

  // Calculate statistics
  const totalRevenue = filteredOrders.reduce((sum, order) => sum + (order.subtotal || 0), 0);
  const totalProfit = filteredOrders.reduce((sum, order) => sum + (order.profit || 0), 0);
  const totalOrders = filteredOrders.length;
  const totalQuantity = filteredOrders.reduce((sum, order) => sum + (order.quantity || 0), 0);

  return (
    <div style={{ padding: '24px' }}>
      {/* Header */}
      <Card 
        style={{ 
          marginBottom: 24,
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ShoppingOutlined style={{ fontSize: 32, color: '#007A33' }} />
          <div>
            <h1 style={{ margin: 0, fontSize: 24, color: '#007A33' }}>Quản Lý Đơn Hàng Bán</h1>
            <p style={{ margin: 0, color: '#666' }}>Quản lý các đơn hàng từ TMĐT, Bán Lẻ và Bán Sỉ</p>
          </div>
        </div>
      </Card>

      {/* Order Type Tabs */}
      <div style={{ marginBottom: 24 }}>
        <Space size="middle">
          <Button
            icon={<ShoppingOutlined />}
            size="large"
            type="primary"
            style={{
              background: '#007A33',
              borderColor: '#007A33'
            }}
          >
            Quản lý đơn hàng TMĐT
          </Button>
          <Button
            icon={<ShopOutlined />}
            size="large"
            onClick={() => navigate('/orders/manage/retail')}
            style={{
              borderColor: '#d9d9d9',
              background: 'white',
              color: '#666'
            }}
          >
            Quản lý đơn hàng lẻ
          </Button>
          <Button
            icon={<TeamOutlined />}
            size="large"
            onClick={() => navigate('/orders/manage/wholesale')}
            style={{
              borderColor: '#d9d9d9',
              background: 'white',
              color: '#666'
            }}
          >
            Quản lý đơn hàng sỉ
          </Button>
        </Space>
      </div>

      {/* Filters */}
      <Card
        style={{
          marginBottom: 24,
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>Từ ngày - Đến ngày:</div>
            <Space.Compact style={{ width: '100%' }}>
              <RangePicker
                value={dateRange}
                onChange={setDateRange}
                format="DD/MM/YYYY"
                style={{ width: '100%' }}
                placeholder={['Từ ngày', 'Đến ngày']}
              />
              <Button
                type="primary"
                icon={<FilterOutlined />}
                style={{ background: '#007A33' }}
              >
                Lọc
              </Button>
              <Button
                danger
                icon={<CloseCircleOutlined />}
                onClick={handleClearFilters}
              >
                Xóa Tất Cả
              </Button>
            </Space.Compact>
          </Col>
          <Col xs={24} lg={12}>
            <div style={{ marginBottom: 8, fontWeight: 600 }}>Lọc nhanh:</div>
            <Space>
              <Button
                icon={<CalendarOutlined />}
                onClick={() => handleQuickFilter('today')}
              >
                Hôm Nay
              </Button>
              <Button
                icon={<CalendarOutlined />}
                onClick={() => handleQuickFilter('week')}
              >
                Tuần Này
              </Button>
              <Button
                icon={<CalendarOutlined />}
                onClick={() => handleQuickFilter('month')}
              >
                Tháng Này
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Tổng Đơn Hàng"
              value={totalOrders}
              suffix="đơn"
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Tổng Số Lượng"
              value={totalQuantity}
              suffix="sp"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Tổng Doanh Thu"
              value={totalRevenue}
              precision={0}
              suffix="₫"
              valueStyle={{ color: '#007A33' }}
              formatter={(value) => formatCurrency(value)}
            />
          </Card>
        </Col>
        <Col xs={12} md={6}>
          <Card>
            <Statistic
              title="Tổng Lợi Nhuận"
              value={totalProfit}
              precision={0}
              suffix="₫"
              valueStyle={{ color: totalProfit >= 0 ? '#52c41a' : '#ff4d4f' }}
              formatter={(value) => formatCurrency(value)}
            />
          </Card>
        </Col>
      </Row>

      {/* Orders Table */}
      <Card
        title={<><ShoppingOutlined /> Danh Sách Đơn Hàng TMĐT</>}
        extra={
          <Space>
            <Popconfirm
              title={`Xóa ${selectedRowKeys.length} đơn hàng đã chọn?`}
              description="Bạn có chắc chắn muốn xóa các đơn hàng đã chọn không?"
              onConfirm={handleDeleteSelected}
              okText="Xóa"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              disabled={selectedRowKeys.length === 0}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={selectedRowKeys.length === 0}
              >
                Xóa Đã Chọn ({selectedRowKeys.length})
              </Button>
            </Popconfirm>
            <Popconfirm
              title={`Xóa tất cả ${filteredOrders.length} đơn hàng?`}
              description="CẢNH BÁO: Bạn sẽ xóa TẤT CẢ đơn hàng đang hiển thị. Không thể hoàn tác!"
              onConfirm={handleDeleteAll}
              okText="Xóa Tất Cả"
              cancelText="Hủy"
              okButtonProps={{ danger: true }}
              disabled={filteredOrders.length === 0}
            >
              <Button
                danger
                icon={<DeleteOutlined />}
                disabled={filteredOrders.length === 0}
              >
                Xóa Tất Cả
              </Button>
            </Popconfirm>
            <Button
              icon={<DownloadOutlined />}
              onClick={handleExportExcel}
              style={{ color: '#52c41a', borderColor: '#52c41a' }}
            >
              Xuất Excel
            </Button>
          </Space>
        }
        style={{
          borderRadius: 12,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
        }}
      >
        <Space style={{ marginBottom: 16, width: '100%' }} direction="vertical">
          <Row gutter={16}>
            <Col xs={24} md={8}>
              <Input
                placeholder="Nhập mã đơn hàng, SKU, tên sản phẩm..."
                prefix={<SearchOutlined />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                allowClear
              />
            </Col>
            <Col xs={24} md={8}>
              <Select
                placeholder="Tất cả sàn"
                value={platformFilter}
                onChange={setPlatformFilter}
                style={{ width: '100%' }}
              >
                <Option value="all">Tất cả sàn</Option>
                <Option value="shopee">Shopee</Option>
                <Option value="lazada">Lazada</Option>
                <Option value="tiktok">TikTok Shop</Option>
                <Option value="sendo">Sendo</Option>
                <Option value="tiki">Tiki</Option>
                <Option value="facebook">Facebook</Option>
                <Option value="zalo">Zalo</Option>
                <Option value="other">Khác</Option>
              </Select>
            </Col>
            <Col xs={24} md={8}>
              <Button
                icon={<CloseCircleOutlined />}
                onClick={handleClearFilters}
                block
              >
                Xóa Bộ Lọc
              </Button>
            </Col>
          </Row>
        </Space>

        <Table
          columns={columns}
          dataSource={filteredOrders}
          loading={loading}
          rowKey="id"
          rowSelection={{
            selectedRowKeys,
            onChange: setSelectedRowKeys,
            selections: [
              Table.SELECTION_ALL,
              Table.SELECTION_INVERT,
              Table.SELECTION_NONE,
            ],
          }}
          expandable={{
            expandedRowRender: (record) => {
              if (!record.items || record.items.length <= 1) return null;
              
              return (
                <div style={{ padding: '8px 48px', background: '#fafafa' }}>
                  <div style={{ fontWeight: 600, marginBottom: 8, color: '#007A33' }}>
                    Chi tiết {record.items.length} sản phẩm:
                  </div>
                  {record.items.map((item, index) => (
                    <div key={index} style={{ 
                      padding: '8px 12px', 
                      marginBottom: 4, 
                      background: 'white',
                      borderLeft: '3px solid #007A33',
                      borderRadius: 4
                    }}>
                      <Row gutter={16}>
                        <Col span={8}>
                          <strong>Sản phẩm:</strong> {item.productName}
                        </Col>
                        <Col span={4}>
                          <strong>SKU:</strong> {item.sku}
                        </Col>
                        <Col span={3}>
                          <strong>SL:</strong> {item.quantity} {item.unit}
                        </Col>
                        <Col span={3}>
                          <strong>Giá:</strong> {formatCurrency(item.sellingPrice)}
                        </Col>
                        <Col span={3}>
                          <strong>Tổng:</strong> <span style={{ color: '#007A33' }}>{formatCurrency(item.subtotal)}</span>
                        </Col>
                        <Col span={3}>
                          <strong>LN:</strong> <span style={{ color: item.profit >= 0 ? '#52c41a' : '#ff4d4f' }}>
                            {formatCurrency(item.profit)}
                          </span>
                        </Col>
                      </Row>
                    </div>
                  ))}
                </div>
              );
            },
            rowExpandable: (record) => record.items && record.items.length > 1,
            expandedRowKeys: expandedRowKeys,
            onExpandedRowsChange: setExpandedRowKeys,
            showExpandColumn: false, // Hide expand icon
          }}
          onRow={(record) => ({
            onClick: (e) => {
              // Don't expand if clicking on checkbox, delete button, or action column
              if (e.target.closest('.ant-checkbox-wrapper') || 
                  e.target.closest('.ant-btn') ||
                  e.target.closest('.ant-table-selection-column') ||
                  e.target.closest('.ant-popconfirm')) {
                return;
              }
              
              // Only expand if has multiple items
              if (record.items && record.items.length > 1) {
                setExpandedRowKeys(prevKeys => {
                  const isExpanded = prevKeys.includes(record.id);
                  if (isExpanded) {
                    return prevKeys.filter(key => key !== record.id);
                  } else {
                    return [...prevKeys, record.id];
                  }
                });
              }
            },
            style: {
              cursor: record.items && record.items.length > 1 ? 'pointer' : 'default',
              backgroundColor: expandedRowKeys.includes(record.id) ? '#f0f9ff' : undefined
            },
            onMouseEnter: (e) => {
              if (record.items && record.items.length > 1) {
                e.currentTarget.style.backgroundColor = '#fafafa';
              }
            },
            onMouseLeave: (e) => {
              if (!expandedRowKeys.includes(record.id)) {
                e.currentTarget.style.backgroundColor = '';
              } else {
                e.currentTarget.style.backgroundColor = '#f0f9ff';
              }
            }
          })}
          scroll={{ x: 1500 }}
          pagination={{
            total: filteredOrders.length,
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `Tổng ${total} đơn hàng`
          }}
        />
      </Card>
    </div>
  );
};

export default ManageOrdersTMDT;
