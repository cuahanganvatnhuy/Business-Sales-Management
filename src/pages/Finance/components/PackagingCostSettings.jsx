import React, { useState, useEffect } from 'react';
import { Modal, Select, Button, message, Card, Input, Tabs, Space, Typography } from 'antd';
import { EditOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { database } from '../../../services/firebase.service';
import { ref, set, onValue, get } from 'firebase/database';

const { Option } = Select;
const { TabPane } = Tabs;
const { Text } = Typography;

const PackagingCostSettings = ({ visible, onClose, selectedStore, onSave }) => {
  console.log('🎯 PackagingCostSettings props:', { visible, selectedStore });
  
  const [currentStore, setCurrentStore] = useState('');
  const [stores, setStores] = useState([]);
  const [activeTab, setActiveTab] = useState('hangLanh');
  
  const [packagingRules, setPackagingRules] = useState({
    hangLanh: [],
    hangKho: [],
    hangNuoc: []
  });

  const [editingRule, setEditingRule] = useState(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newRule, setNewRule] = useState({
    minWeight: '',
    maxWeight: '',
    cost: '',
    description: 'Thùng xốp',
    note: ''
  });

  useEffect(() => {
    if (visible) {
      // Set store từ props hoặc để trống
      const initialStore = selectedStore && selectedStore !== 'all' ? selectedStore : '';
      setCurrentStore(initialStore);
      console.log('🏪 Setting initial store to:', initialStore);
      
      // Load danh sách cửa hàng
      loadStores();
    }
  }, [visible, selectedStore]);

  useEffect(() => {
    // Load settings khi store thay đổi
    if (currentStore) {
      loadPackagingSettings();
    }
  }, [currentStore]);

  // Load danh sách cửa hàng từ Firebase
  const loadStores = () => {
    const storesRef = ref(database, 'stores');
    onValue(storesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const storesArray = Object.keys(data).map(key => ({
          id: key,
          name: data[key].name || key
        }));
        setStores(storesArray);
        console.log('🏪 Loaded stores:', storesArray);
      }
    });
  };

  const loadPackagingSettings = async () => {
    if (!currentStore) return;
    
    console.log('🔍 Loading packaging settings for store:', currentStore);
    const settingsPath = `packagingCostSettings/${currentStore}`;
    const settingsRef = ref(database, settingsPath);
    
    try {
      const snapshot = await get(settingsRef);
      const data = snapshot.val();
      console.log('📦 Firebase data for', settingsPath, ':', data);
      
      if (data) {
        setPackagingRules(data);
        console.log('✅ Loaded packaging rules:', data);
      } else {
        console.log('⚠️ No data found for', settingsPath, '- keeping defaults');
        // Reset về defaults (rỗng)
        setPackagingRules({
          hangLanh: [],
          hangKho: [],
          hangNuoc: []
        });
      }
    } catch (error) {
      console.error('❌ Error loading packaging settings:', error);
    }
  };

  const addNewRule = () => {
    if (!newRule.minWeight || !newRule.maxWeight || !newRule.cost) {
      message.error('Vui lòng điền đầy đủ thông tin');
      return;
    }

    const rule = {
      id: Date.now(),
      minWeight: parseFloat(newRule.minWeight),
      maxWeight: parseFloat(newRule.maxWeight),
      cost: parseFloat(newRule.cost),
      description: newRule.description || 'Thùng xốp',
      note: newRule.note || 'Không có mô tả'
    };

    setPackagingRules(prev => ({
      ...prev,
      [activeTab]: [...prev[activeTab], rule]
    }));

    // Reset form
    setNewRule({
      minWeight: '',
      maxWeight: '',
      cost: '',
      description: 'Thùng xốp',
      note: ''
    });
    setShowAddForm(false);
    message.success('Đã thêm khoảng khối lượng mới');
  };

  const deleteRule = (id) => {
    setPackagingRules(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].filter(rule => rule.id !== id)
    }));
    message.success('Đã xóa khoảng khối lượng');
  };

  const updateRule = (id, field, value) => {
    setPackagingRules(prev => ({
      ...prev,
      [activeTab]: prev[activeTab].map(rule => 
        rule.id === id ? { ...rule, [field]: value } : rule
      )
    }));
  };

  const handleSave = async () => {
    console.log('💾 Saving - Current store:', currentStore);
    console.log('💾 Saving - Packaging rules:', packagingRules);
    
    if (!currentStore) {
      message.error('Vui lòng chọn cửa hàng');
      return;
    }

    try {
      const settingsPath = `packagingCostSettings/${currentStore}`;
      const settingsRef = ref(database, settingsPath);
      console.log('💾 Firebase path:', settingsPath);
      
      await set(settingsRef, packagingRules);
      console.log('✅ Saved successfully to Firebase');
      
      message.success(`Đã lưu cài đặt chi phí thùng đóng gói cho ${stores.find(s => s.id === currentStore)?.name || currentStore}`);
      onSave && onSave(packagingRules);
      onClose();
    } catch (error) {
      console.error('❌ Save error:', error);
      message.error('Lỗi khi lưu cài đặt: ' + error.message);
    }
  };

  const resetToDefaults = () => {
    setPackagingRules({
      hangLanh: [],
      hangKho: [],
      hangNuoc: []
    });
    message.success('Đã xóa tất cả cấu hình thùng đóng gói');
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN').format(amount) + ' ₫';
  };

  const tabItems = [
    {
      key: 'hangLanh',
      label: (
        <span style={{ color: activeTab === 'hangLanh' ? '#fff' : '#666' }}>
          ❄️ Hàng Lạnh
        </span>
      )
    },
    {
      key: 'hangKho',
      label: (
        <span style={{ color: activeTab === 'hangKho' ? '#fff' : '#666' }}>
          📦 Hàng Khô
        </span>
      )
    },
    {
      key: 'hangNuoc',
      label: (
        <span style={{ color: activeTab === 'hangNuoc' ? '#fff' : '#666' }}>
          💧 Hàng Nước
        </span>
      )
    }
  ];

  return (
    <Modal
      title="📦 Cấu hình Chi phí Thùng Đóng Gói"
      open={visible}
      onCancel={onClose}
      width="80%"
      footer={[
        <Button key="cancel" onClick={onClose}>
          Hủy
        </Button>,
        <Button key="reset" onClick={resetToDefaults}>
          🗑️ Xóa Tất Cả
        </Button>,
        <Button key="save" type="primary" onClick={handleSave}>
          💾 Lưu Cấu Hình
        </Button>
      ]}
      style={{ top: 20 }}
    >
      {/* Chọn Cửa Hàng */}
      <div style={{ marginBottom: 24 }}>
        <Text strong>Chọn Cửa Hàng:</Text>
        <Select 
          value={currentStore} 
          onChange={(value) => {
            console.log('🔄 Store changed from', currentStore, 'to', value);
            setCurrentStore(value);
          }}
          style={{ width: '100%', marginTop: 8 }}
          placeholder="Chọn cửa hàng để cấu hình"
        >
          {stores.map(store => (
            <Option key={store.id} value={store.id}>
              🏬 {store.name}
            </Option>
          ))}
        </Select>
      </div>

      {currentStore && (
        <>
          {/* Tabs */}
          <Tabs
            activeKey={activeTab}
            onChange={setActiveTab}
            type="card"
            style={{ marginBottom: 16 }}
            items={tabItems.map(item => ({
              ...item,
              children: (
                <div>
                  {/* Header */}
                  <div style={{ 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center',
                    marginBottom: 16,
                    padding: '12px 16px',
                    background: '#f8f9fa',
                    borderRadius: '8px'
                  }}>
                    <Text strong style={{ fontSize: '16px' }}>
                      Cấu hình Chi phí Thùng - {item.label.props.children.slice(2)}
                    </Text>
                    <Button 
                      type="primary" 
                      icon={<PlusOutlined />}
                      onClick={() => setShowAddForm(true)}
                      style={{ background: '#52c41a', borderColor: '#52c41a' }}
                    >
                      Thêm Khoảng Khối Lượng
                    </Button>
                  </div>

                  {/* Add Form */}
                  {showAddForm && (
                    <Card 
                      title="Thêm Khoảng Khối Lượng" 
                      size="small" 
                      style={{ marginBottom: 16, background: '#f0f8ff' }}
                      extra={
                        <Button size="small" onClick={() => setShowAddForm(false)}>
                          ✕
                        </Button>
                      }
                    >
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 2fr 3fr', gap: '12px', alignItems: 'end' }}>
                        <div>
                          <Text strong style={{ fontSize: '12px' }}>Khối lượng tối thiểu (kg):</Text>
                          <Input
                            type="number"
                            value={newRule.minWeight}
                            onChange={(e) => setNewRule(prev => ({ ...prev, minWeight: e.target.value }))}
                            placeholder="0.1"
                            step="0.1"
                          />
                        </div>
                        <div>
                          <Text strong style={{ fontSize: '12px' }}>Khối lượng tối đa (kg):</Text>
                          <Input
                            type="number"
                            value={newRule.maxWeight}
                            onChange={(e) => setNewRule(prev => ({ ...prev, maxWeight: e.target.value }))}
                            placeholder="0.4"
                            step="0.1"
                          />
                        </div>
                        <div>
                          <Text strong style={{ fontSize: '12px' }}>Chi phí thùng (VNĐ):</Text>
                          <Input
                            type="number"
                            value={newRule.cost}
                            onChange={(e) => setNewRule(prev => ({ ...prev, cost: e.target.value }))}
                            placeholder="5000"
                          />
                        </div>
                        <div>
                          <Text strong style={{ fontSize: '12px' }}>Loại thùng:</Text>
                          <Select
                            value={newRule.description}
                            onChange={(value) => setNewRule(prev => ({ ...prev, description: value }))}
                            style={{ width: '100%' }}
                          >
                            <Option value="Thùng xốp">Thùng xốp</Option>
                            <Option value="Thùng carton">Thùng carton</Option>
                            <Option value="Thùng nhựa">Thùng nhựa</Option>
                            <Option value="Thùng giữ lạnh">Thùng giữ lạnh</Option>
                          </Select>
                        </div>
                        <div>
                          <Text strong style={{ fontSize: '12px' }}>Mô tả:</Text>
                          <Input.TextArea
                            value={newRule.note}
                            onChange={(e) => setNewRule(prev => ({ ...prev, note: e.target.value }))}
                            placeholder="Mô tả chi tiết về loại thùng và ứng dụng"
                            rows={2}
                          />
                        </div>
                      </div>
                      <div style={{ marginTop: 12, textAlign: 'right' }}>
                        <Space>
                          <Button onClick={() => setShowAddForm(false)}>Hủy</Button>
                          <Button type="primary" onClick={addNewRule}>Lưu</Button>
                        </Space>
                      </div>
                    </Card>
                  )}

                  {/* Rules List */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(350px, 1fr))', gap: '16px' }}>
                    {packagingRules[activeTab].map(rule => (
                      <Card 
                        key={rule.id}
                        size="small"
                        style={{ 
                          border: '2px solid #e8e8e8',
                          borderRadius: '12px',
                          background: 'linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%)'
                        }}
                        actions={[
                          <EditOutlined 
                            key="edit" 
                            onClick={() => setEditingRule(rule.id)}
                            style={{ color: '#1890ff' }}
                          />,
                          <DeleteOutlined 
                            key="delete" 
                            onClick={() => deleteRule(rule.id)}
                            style={{ color: '#ff4d4f' }}
                          />
                        ]}
                      >
                        {/* Weight Range Header */}
                        <div style={{ 
                          textAlign: 'center', 
                          marginBottom: '12px',
                          padding: '8px',
                          background: '#52c41a',
                          borderRadius: '8px',
                          color: 'white'
                        }}>
                          <Text strong style={{ color: 'white', fontSize: '14px' }}>
                            {rule.minWeight}kg - {rule.maxWeight}kg
                          </Text>
                        </div>

                        {/* Weight Details */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                          <div style={{ textAlign: 'center', flex: 1 }}>
                            <Text style={{ fontSize: '10px', color: '#666' }}>KHỐI LƯỢNG TỐI THIỂU</Text>
                            <div style={{ fontWeight: 'bold' }}>{rule.minWeight} kg</div>
                          </div>
                          <div style={{ textAlign: 'center', flex: 1 }}>
                            <Text style={{ fontSize: '10px', color: '#666' }}>KHỐI LƯỢNG TỐI ĐA</Text>
                            <div style={{ fontWeight: 'bold' }}>{rule.maxWeight} kg</div>
                          </div>
                        </div>

                        {/* Cost */}
                        <div style={{ 
                          textAlign: 'center',
                          padding: '12px',
                          background: '#52c41a',
                          borderRadius: '8px',
                          marginBottom: '12px'
                        }}>
                          {editingRule === rule.id ? (
                            <Input
                              type="number"
                              value={rule.cost}
                              onChange={(e) => updateRule(rule.id, 'cost', parseFloat(e.target.value))}
                              onBlur={() => setEditingRule(null)}
                              onPressEnter={() => setEditingRule(null)}
                              style={{ textAlign: 'center', fontWeight: 'bold' }}
                            />
                          ) : (
                            <Text strong style={{ color: 'white', fontSize: '16px' }}>
                              {formatCurrency(rule.cost)}
                            </Text>
                          )}
                        </div>

                        {/* Details */}
                        <div style={{ fontSize: '12px' }}>
                          <div style={{ marginBottom: '4px' }}>
                            <Text strong>Loại thùng:</Text> {rule.description}
                          </div>
                          <div>
                            <Text strong>Mô tả:</Text> {rule.note}
                          </div>
                        </div>
                      </Card>
                    ))}
                  </div>

                  {packagingRules[activeTab].length === 0 && (
                    <div style={{ 
                      textAlign: 'center', 
                      padding: '40px',
                      color: '#999',
                      background: '#f8f9fa',
                      borderRadius: '8px',
                      border: '2px dashed #ddd'
                    }}>
                      <Text type="secondary">
                        Chưa có khoảng khối lượng nào cho {item.label.props.children.slice(2)}
                      </Text>
                      <div style={{ marginTop: '8px' }}>
                        <Button 
                          type="dashed" 
                          icon={<PlusOutlined />}
                          onClick={() => setShowAddForm(true)}
                        >
                          Thêm khoảng khối lượng đầu tiên
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            }))}
          />
        </>
      )}
      
      {!currentStore && (
        <div style={{ textAlign: 'center', padding: 40, color: '#999' }}>
          <Text type="secondary">Vui lòng chọn cửa hàng để cấu hình chi phí thùng đóng gói</Text>
        </div>
      )}
    </Modal>
  );
};

export default PackagingCostSettings;
