import React, { useState, useEffect } from 'react';
import { Card, Input, Select, Button, Modal, Form, Tag, Row, Col, message } from 'antd';
import { 
  PlusOutlined, 
  SearchOutlined, 
  EditOutlined, 
  DeleteOutlined,
  TagsOutlined,
  CheckCircleOutlined,
  PauseCircleOutlined,
  ExclamationCircleOutlined
} from '@ant-design/icons';
import { database } from '../../services/firebase.service';
import { ref, onValue, push, set, update, remove } from 'firebase/database';
import { useAuth } from '../../contexts/AuthContext';
import './Categories.css';

const { Search } = Input;
const { Option } = Select;
const { TextArea } = Input;

// Icon suggestions
const iconSuggestions = [
  'TagsOutlined',
  'ShoppingOutlined', 
  'ShopOutlined',
  'MobileOutlined',
  'LaptopOutlined',
  'HomeOutlined',
  'CoffeeOutlined',
  'CarOutlined',
  'BookOutlined',
  'GiftOutlined',
  'HeartOutlined',
  'StarOutlined'
];

const Categories = () => {
  const [form] = Form.useForm();
  const { user, isAdmin } = useAuth();
  const userPermissions = user?.permissions || [];
  const canEditCategory = isAdmin || userPermissions.includes('categories.manage.edit');
  const canDeleteCategorySingle = isAdmin || userPermissions.includes('categories.manage.delete.single');
  const canDeleteCategoryBulk = isAdmin || userPermissions.includes('categories.manage.delete.bulk');
  const hasPermission = canEditCategory || canDeleteCategorySingle || canDeleteCategoryBulk;
  
  const [categories, setCategories] = useState([]);
  const [filteredCategories, setFilteredCategories] = useState([]);
  
  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  const [modalVisible, setModalVisible] = useState(false);
  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [deletingCategory, setDeletingCategory] = useState(null);
  
  const [selectedColor, setSelectedColor] = useState('#4CAF50');
  const [selectedIcon, setSelectedIcon] = useState('TagsOutlined');

  // Load categories
  useEffect(() => {
    const categoriesRef = ref(database, 'categories');
    onValue(categoriesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const categoriesList = Object.entries(data).map(([id, cat]) => ({
          key: id,
          id,
          ...cat
        }));
        setCategories(categoriesList);
        setFilteredCategories(categoriesList);
      } else {
        setCategories([]);
        setFilteredCategories([]);
      }
    });
  }, []);

  // Apply filters
  useEffect(() => {
    let filtered = [...categories];

    // Search filter
    if (searchText) {
      filtered = filtered.filter(cat => 
        cat.name.toLowerCase().includes(searchText.toLowerCase()) ||
        (cat.description && cat.description.toLowerCase().includes(searchText.toLowerCase()))
      );
    }

    // Status filter
    if (statusFilter) {
      filtered = filtered.filter(cat => cat.status === statusFilter);
    }

    setFilteredCategories(filtered);
  }, [searchText, statusFilter, categories]);

  // Open add modal
  const handleAdd = () => {
    setEditingCategory(null);
    form.resetFields();
    setSelectedColor('#4CAF50');
    setSelectedIcon('TagsOutlined');
    setModalVisible(true);
  };

  // Open edit modal
  const handleEdit = (category) => {
    if (!canEditCategory) {
      message.error('Bạn không có quyền chỉnh sửa danh mục.');
      return;
    }
    setEditingCategory(category);
    form.setFieldsValue({
      name: category.name,
      description: category.description,
      status: category.status || 'active'
    });
    setSelectedColor(category.color || '#4CAF50');
    setSelectedIcon(category.icon || 'TagsOutlined');
    setModalVisible(true);
  };

  // Save category
  const handleSave = async () => {
    try {
      const values = await form.validateFields();
      
      const categoryData = {
        name: values.name,
        description: values.description || '',
        color: selectedColor,
        icon: selectedIcon,
        status: values.status || 'active',
        updatedAt: new Date().toISOString()
      };

      if (editingCategory) {
        if (!canEditCategory) {
          message.error('Bạn không có quyền chỉnh sửa danh mục.');
          return;
        }
        // Update
        const categoryRef = ref(database, `categories/${editingCategory.id}`);
        await update(categoryRef, categoryData);
        message.success('Cập nhật danh mục thành công!');
      } else {
        // Add
        categoryData.createdAt = new Date().toISOString();
        categoryData.productCount = 0;
        
        const categoriesRef = ref(database, 'categories');
        const newCategoryRef = push(categoriesRef);
        await set(newCategoryRef, categoryData);
        message.success('Thêm danh mục thành công!');
      }

      setModalVisible(false);
      setEditingCategory(null);
      form.resetFields();
    } catch (error) {
      message.error('Lỗi: ' + error.message);
    }
  };

  // Delete category
  const handleDelete = (category) => {
    if (!canDeleteCategorySingle) {
      message.error('Bạn không có quyền xóa danh mục.');
      return;
    }
    setDeletingCategory(category);
    setDeleteModalVisible(true);
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    try {
      if (!canDeleteCategorySingle) {
        message.error('Bạn không có quyền xóa danh mục.');
        return;
      }
      const categoryRef = ref(database, `categories/${deletingCategory.id}`);
      await remove(categoryRef);
      
      message.success('Xóa danh mục thành công!');
      setDeleteModalVisible(false);
      setDeletingCategory(null);
    } catch (error) {
      message.error('Lỗi xóa danh mục: ' + error.message);
    }
  };

  // Get icon component
  const getIconComponent = (iconName) => {
    const iconMap = {
      'TagsOutlined': <TagsOutlined />,
      'ShoppingOutlined': <span>🛍️</span>,
      'ShopOutlined': <span>🏪</span>,
      'MobileOutlined': <span>📱</span>,
      'LaptopOutlined': <span>💻</span>,
      'HomeOutlined': <span>🏠</span>,
      'CoffeeOutlined': <span>☕</span>,
      'CarOutlined': <span>🚗</span>,
      'BookOutlined': <span>📚</span>,
      'GiftOutlined': <span>🎁</span>,
      'HeartOutlined': <span>❤️</span>,
      'StarOutlined': <span>⭐</span>
    };
    return iconMap[iconName] || <TagsOutlined />;
  };

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Danh Mục Sản Phẩm. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  const heroStyles = {
    card: {
      background: '#fff',
      padding: '18px 26px',
      borderRadius: 16,
      boxShadow: '0 10px 24px rgba(15, 157, 88, 0.12)',
      marginBottom: 24,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 16,
      flexWrap: 'wrap'
    },
    left: {
      display: 'flex',
      alignItems: 'center',
      gap: 16
    },
    icon: {
      width: 52,
      height: 52,
      borderRadius: '50%',
      background: '#e9f8ee',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color: '#0f9d58',
      fontSize: 23
    },
    title: {
      margin: 0,
      color: '#0d7c39',
      fontWeight: 700,
      fontSize: 22,
      lineHeight: 1.2
    },
    subtitle: {
      margin: 4,
      color: '#5f6b65'
    }
  };

  return (
    <div className="categories-page">
      {/* Page Header */}
      <div style={heroStyles.card}>
        <div style={heroStyles.left}>
          <div style={heroStyles.icon}>
            <TagsOutlined />
          </div>
          <div>
            <h1 style={heroStyles.title}>Quản Lý Danh Mục Sản Phẩm</h1>
            <p style={heroStyles.subtitle}>Sắp xếp sản phẩm theo nhóm và trạng thái hoạt động</p>
          </div>
        </div>
        <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd} style={{ height: 44 }}>
          Thêm Danh Mục
        </Button>
      </div>

      {/* Search and Filter */}
      <Card style={{ marginBottom: 24 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '16px' }}>
          <Search
            placeholder="Tìm kiếm danh mục..."
            allowClear
            prefix={<SearchOutlined />}
            onChange={(e) => setSearchText(e.target.value)}
          />
          <Select
            placeholder="Tất cả trạng thái"
            allowClear
            onChange={(value) => setStatusFilter(value || '')}
          >
            <Option value="active">Đang hoạt động</Option>
            <Option value="inactive">Tạm dừng</Option>
          </Select>
        </div>
      </Card>

      {/* Categories Grid */}
      {filteredCategories.length === 0 ? (
        <Card>
          <div style={{ textAlign: 'center', padding: '60px 20px' }}>
            <TagsOutlined style={{ fontSize: '64px', color: '#ccc' }} />
            <h3 style={{ marginTop: '16px', color: '#666' }}>Chưa có danh mục nào</h3>
            <p style={{ color: '#999', marginBottom: '24px' }}>
              Hãy thêm danh mục đầu tiên để bắt đầu phân loại sản phẩm
            </p>
            <Button type="primary" icon={<PlusOutlined />} onClick={handleAdd}>
              Thêm Danh Mục
            </Button>
          </div>
        </Card>
      ) : (
        <div className="categories-grid">
          {filteredCategories.map(category => (
            <Card
              key={category.id}
              className="category-card"
              style={{ borderTop: `4px solid ${category.color || '#4CAF50'}` }}
              hoverable
            >
              <div className="category-header">
                <div className="category-icon" style={{ background: category.color || '#4CAF50' }}>
                  {getIconComponent(category.icon)}
                </div>
                <div className="category-actions">
                  <Button
                    type="text"
                    icon={<EditOutlined />}
                    onClick={() => handleEdit(category)}
                    style={{ color: '#007A33' }}
                  />
                  <Button
                    type="text"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={() => handleDelete(category)}
                  />
                </div>
              </div>
              
              <h3 className="category-name">{category.name}</h3>
              <p className="category-description">
                {category.description || 'Không có mô tả'}
              </p>
              
              <div className="category-footer">
                <Tag 
                  color={category.status === 'active' ? 'green' : 'orange'}
                  icon={category.status === 'active' ? <CheckCircleOutlined /> : <PauseCircleOutlined />}
                >
                  {category.status === 'active' ? 'Hoạt động' : 'Tạm dừng'}
                </Tag>
                <span className="product-count">{category.productCount || 0} sản phẩm</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Add/Edit Modal */}
      <Modal
        title={editingCategory ? 'Chỉnh Sửa Danh Mục' : 'Thêm Danh Mục Mới'}
        open={modalVisible}
        onOk={handleSave}
        onCancel={() => {
          setModalVisible(false);
          setEditingCategory(null);
          form.resetFields();
        }}
        okText="Lưu"
        cancelText="Hủy"
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item
            label="Tên Danh Mục"
            name="name"
            rules={[{ required: true, message: 'Vui lòng nhập tên danh mục!' }]}
          >
            <Input placeholder="Nhập tên danh mục" />
          </Form.Item>

          <Form.Item
            label="Mô Tả"
            name="description"
          >
            <TextArea rows={3} placeholder="Mô tả về danh mục này" />
          </Form.Item>

          <Form.Item label="Màu Sắc">
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              <Input
                type="color"
                value={selectedColor}
                onChange={(e) => setSelectedColor(e.target.value)}
                style={{ width: '80px', height: '40px', cursor: 'pointer' }}
              />
              <div 
                style={{ 
                  width: '40px', 
                  height: '40px', 
                  background: selectedColor, 
                  borderRadius: '8px',
                  border: '2px solid #ddd'
                }}
              />
              <span style={{ color: '#666' }}>{selectedColor}</span>
            </div>
          </Form.Item>

          <Form.Item label="Biểu Tượng">
            <div className="icon-picker">
              {iconSuggestions.map(icon => (
                <div
                  key={icon}
                  className={`icon-option ${selectedIcon === icon ? 'selected' : ''}`}
                  onClick={() => setSelectedIcon(icon)}
                  style={{ 
                    background: selectedIcon === icon ? selectedColor : '#f5f5f5',
                    color: selectedIcon === icon ? 'white' : '#333'
                  }}
                >
                  {getIconComponent(icon)}
                </div>
              ))}
            </div>
          </Form.Item>

          <Form.Item
            label="Trạng Thái"
            name="status"
            initialValue="active"
          >
            <Select>
              <Option value="active">Đang hoạt động</Option>
              <Option value="inactive">Tạm dừng</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal
        title="Xác Nhận Xóa"
        open={deleteModalVisible}
        onOk={handleConfirmDelete}
        onCancel={() => {
          setDeleteModalVisible(false);
          setDeletingCategory(null);
        }}
        okText="Xóa"
        cancelText="Hủy"
        okButtonProps={{ danger: true }}
      >
        <div style={{ textAlign: 'center', padding: '20px' }}>
          <ExclamationCircleOutlined style={{ fontSize: '48px', color: '#ff4d4f' }} />
          <p style={{ marginTop: '16px', fontSize: '16px' }}>
            Bạn có chắc chắn muốn xóa danh mục này không?
          </p>
          <p style={{ color: '#ff4d4f', fontWeight: 'bold' }}>
            Hành động này không thể hoàn tác!
          </p>
        </div>
      </Modal>
    </div>
  );
};

export default Categories;
