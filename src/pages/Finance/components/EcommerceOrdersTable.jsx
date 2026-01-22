import React, { useState } from 'react';
import { Card, Table, Typography, Tag, Input, Button, Space } from 'antd';
import { SearchOutlined, FileExcelOutlined, EyeOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import OrderDetailModal from './OrderDetailModal';

const { Text } = Typography;

const EcommerceOrdersTable = ({ 
  orders, 
  loading, 
  searchText, 
  setSearchText,
  onExportExcel,
  selectedStore  // Nhận selectedStore từ parent
}) => {
  
  const [expandedRowKeys, setExpandedRowKeys] = useState([]);
  const [selectedOrder, setSelectedOrder] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  
  
  const columns = [
    {
      title: 'STT',
      key: 'index',
      width: 60,
      render: (_, __, index) => index + 1
    },
    {
      title: 'Mã ĐH',
      dataIndex: 'orderId',
      key: 'orderId',
      width: 150,
      render: (text, record) => text || record.id
    },
    {
      title: 'Sản Phẩm',
      dataIndex: 'productName',
      key: 'productName',
      ellipsis: true,
      render: (name, record) => {
        if (record.itemCount > 1) {
          return (
            <div>
              <div style={{ fontWeight: 600, color: '#007A33', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>{record.itemCount} sản phẩm</span>
                <span style={{ 
                  fontSize: '11px', 
                  color: '#1890ff', 
                  background: '#e6f7ff', 
                  padding: '2px 6px', 
                  borderRadius: '4px',
                  border: '1px solid #91d5ff'
                }}>
                  👆 Bấm để xem chi tiết
                </span>
              </div>
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
      width: 120
    },
    {
      title: 'Số Lượng',
      dataIndex: 'quantity',
      key: 'quantity',
      width: 100,
      align: 'center'
    },
    {
      title: 'Giá Nhập (VNĐ)',
      dataIndex: 'importPrice',
      key: 'importPrice',
      width: 130,
      align: 'right',
      render: (price) => (
        <Text>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price || 0)}
        </Text>
      )
    },
    {
      title: 'Giá Bán (VNĐ)',
      dataIndex: 'sellingPrice',
      key: 'sellingPrice',
      width: 130,
      align: 'right',
      render: (price) => (
        <Text >
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(price || 0)}
        </Text>
      )
    },
    {
      title: 'Lợi Nhuận',
      key: 'profit',
      width: 130,
      align: 'right',
      render: (_, record) => {
        const revenue = parseFloat(record.totalAmount) || 0;
        const importCost = parseFloat(record.importCost ?? record.importPrice) || 0;
        const totalFees = parseFloat(record.totalFees) || 0;
        const fallbackProfit = revenue - importCost - totalFees;
        const profit = record.netProfit ?? record.totalProfit ?? record.profit ?? fallbackProfit;

        return (
          <Text strong style={{ color: profit >= 0 ? '#52c41a' : '#ff4d4f' }}>
            {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(profit)}
          </Text>
        );
      }
    },
    {
      title: 'Tổng Tiền',
      dataIndex: 'totalAmount',
      key: 'totalAmount',
      width: 130,
      align: 'right',
      render: (amount) => (
        <Text strong style={{ color: '#007A33', fontWeight: 700, fontSize: '14px' }}>
          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount || 0)}
        </Text>
      )
    },
    {
      title: 'Sàn TMĐT',
      dataIndex: 'platform',
      key: 'platform',
      width: 100,
      render: (platform) => (
        <Tag color="blue">{platform || 'N/A'}</Tag>
      )
    },
    {
      title: 'Cửa Hàng',
      dataIndex: 'storeName',
      key: 'storeName',
      width: 120,
      ellipsis: true
    },
    {
      title: 'Ngày',
      dataIndex: 'orderDate',
      key: 'orderDate',
      width: 100,
      render: (date, record) => dayjs(date || record.createdAt).format('DD/MM/YYYY')
    },
    {
      title: 'Thao Tác',
      key: 'action',
      width: 100,
      render: (_, record) => (
        <Button 
          type="link" 
          size="small"
          icon={<EyeOutlined />}
          onClick={(e) => {
            e.stopPropagation(); // Prevent row expansion
            setSelectedOrder(record);
            setModalVisible(true);
          }}
          style={{ color: '#007A33' }}
        >
          Xem
        </Button>
      )
    }
  ];

  const filteredOrders = orders.filter(order => 
    !searchText || 
    (order.productName && order.productName.toLowerCase().includes(searchText.toLowerCase())) ||
    (order.sku && order.sku.toLowerCase().includes(searchText.toLowerCase())) ||
    (order.orderId && order.orderId.toLowerCase().includes(searchText.toLowerCase()))
  );

  return (
    <Card 
      title="Danh Sách Đơn Hàng TMĐT Chi Tiết"
      extra={
        <Button 
          icon={<FileExcelOutlined />} 
          onClick={onExportExcel}
          type="primary"
          style={{ backgroundColor: '#0a8f3a', borderColor: '#0a8f3a' }}
        >
          Xuất Báo Cáo Excel
        </Button>
      }
    >
      <div style={{ marginBottom: 16 }}>
        <Input
          placeholder="Tìm kiếm theo tên sản phẩm, SKU, mã đơn hàng"
          prefix={<SearchOutlined />}
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 400 }}
        />
      </div>
      
      <Table
        columns={columns}
        dataSource={filteredOrders}
        loading={loading}
        rowKey="id"
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
                    <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
                      <div style={{ minWidth: '200px' }}>
                        <strong>Sản phẩm:</strong> {item.productName}
                      </div>
                      <div style={{ minWidth: '100px' }}>
                        <strong>SKU:</strong> {item.sku}
                      </div>
                      <div style={{ minWidth: '80px' }}>
                        <strong>SL:</strong> {item.quantity} {item.unit}
                      </div>
                      <div style={{ minWidth: '120px' }}>
                        <strong>Giá nhập:</strong> {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.importPrice || 0)}
                      </div>
                      <div style={{ minWidth: '120px' }}>
                        <strong>Giá bán:</strong> <span style={{ color: '#007A33', fontWeight: 600 }}>
                          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.sellingPrice || 0)}
                        </span>
                      </div>
                      <div style={{ minWidth: '120px' }}>
                        <strong>Tổng:</strong> <span style={{ color: '#007A33', fontWeight: 700 }}>
                          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.subtotal || 0)}
                        </span>
                      </div>
                      <div style={{ minWidth: '120px' }}>
                        <strong>LN:</strong> <span style={{ color: (item.profit || 0) >= 0 ? '#52c41a' : '#ff4d4f', fontWeight: 600 }}>
                          {new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(item.profit || 0)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            );
          },
          rowExpandable: (record) => record.items && record.items.length > 1,
          showExpandColumn: false, // Ẩn cột nút expand (+)
          expandedRowKeys: expandedRowKeys,
          onExpandedRowsChange: setExpandedRowKeys,
        }}
        onRow={(record) => ({
          onClick: () => {
            // Chỉ expand nếu có nhiều hơn 1 sản phẩm
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
          },
          style: {
            cursor: record.items && record.items.length > 1 ? 'pointer' : 'default',
            backgroundColor: expandedRowKeys.includes(record.id) ? '#f0f9ff' : undefined,
            transition: 'background-color 0.3s'
          }
        })}
        pagination={{
          pageSize: 10,
          showSizeChanger: true,
          showTotal: (total) => `Tổng ${total} đơn hàng`
        }}
        scroll={{ x: 1200 }}
      />
      
      <OrderDetailModal
        visible={modalVisible}
        onClose={() => {
          setModalVisible(false);
          setSelectedOrder(null);
        }}
        orderData={selectedOrder}
        selectedStore={selectedStore}  // Truyền cửa hàng được chọn
      />
    </Card>
  );
};

export default EcommerceOrdersTable;
