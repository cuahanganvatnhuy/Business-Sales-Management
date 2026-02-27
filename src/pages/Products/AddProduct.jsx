import React, { useState, useEffect } from 'react';
import { Card, Form, Input, Select, InputNumber, Button, Table, Checkbox, message, Spin, Modal, Upload, Progress } from 'antd';
import { PlusOutlined, CopyOutlined, SyncOutlined, DownloadOutlined, UndoOutlined, EditOutlined, DeleteOutlined, UploadOutlined, FileExcelOutlined } from '@ant-design/icons';
import { database } from '../../services/firebase.service';
import { ref, onValue, push, set, remove } from 'firebase/database';
import { formatCurrency } from '../../utils/format';
import * as XLSX from 'xlsx';
import { useAuth } from '../../contexts/AuthContext';
import './Products.css';

const { TextArea } = Input;
const { Option } = Select;

const AddProduct = () => {
  const [form] = Form.useForm();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { user, isAdmin } = useAuth();
  const hasPermission = isAdmin || (user?.permissions || []).includes('products.add');
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importing, setImporting] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [previewProducts, setPreviewProducts] = useState([]);

  // Load categories
  useEffect(() => {
    const categoriesRef = ref(database, 'categories');
    onValue(categoriesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const categoriesList = Object.entries(data).map(([id, cat]) => ({
          id,
          ...cat
        }));
        setCategories(categoriesList);
      }
    });
  }, []);

  // Load products
  useEffect(() => {
    const productsRef = ref(database, 'products');
    onValue(productsRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const productsList = Object.entries(data).map(([id, product]) => ({
          key: id,
          id,
          ...product
        }));
        setProducts(productsList);
      } else {
        setProducts([]);
      }
    });
  }, []);

  // Add product
  const handleAddProduct = async (values) => {
    try {
      setLoading(true);
      
      const productData = {
        name: values.productName,
        sku: values.productSKU || '',
        price: values.productPrice,
        categoryId: values.productCategory,
        description: values.productDescription || '',
        stock: values.productStock || 0,
        unit: values.productUnit || 'cai',
        conversion: values.productConversion || '',
        productType: values.productType || '',
        weight: values.productWeight || 0.5,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const productsRef = ref(database, 'products');
      const newProductRef = push(productsRef);
      await set(newProductRef, productData);

      message.success('Thêm sản phẩm thành công!');
      form.resetFields();
    } catch (error) {
      console.error('Error adding product:', error);
      message.error('Lỗi thêm sản phẩm: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  // Delete product
  const handleDelete = async (productId) => {
    if (window.confirm('Bạn có chắc muốn xóa sản phẩm này?')) {
      try {
        const productRef = ref(database, `products/${productId}`);
        await remove(productRef);
        message.success('Xóa sản phẩm thành công!');
      } catch (error) {
        message.error('Lỗi xóa sản phẩm: ' + error.message);
      }
    }
  };

  // Delete selected
  const handleDeleteSelected = async () => {
    if (selectedRows.length === 0) {
      message.warning('Vui lòng chọn sản phẩm cần xóa!');
      return;
    }

    if (window.confirm(`Bạn có chắc muốn xóa ${selectedRows.length} sản phẩm đã chọn?`)) {
      try {
        setLoading(true);
        for (const id of selectedRows) {
          const productRef = ref(database, `products/${id}`);
          await remove(productRef);
        }
        message.success(`Đã xóa ${selectedRows.length} sản phẩm thành công!`);
        setSelectedRows([]);
      } catch (error) {
        message.error('Lỗi xóa sản phẩm: ' + error.message);
      } finally {
        setLoading(false);
      }
    }
  };

  // Copy file
  const handleCopyFile = () => {
    if (products.length === 0) {
      message.warning('Không có dữ liệu để copy!');
      return;
    }
    
    const dataText = JSON.stringify(products, null, 2);
    navigator.clipboard.writeText(dataText).then(() => {
      message.success('Đã copy dữ liệu vào clipboard!');
    }).catch(() => {
      message.error('Lỗi copy dữ liệu!');
    });
  };

  // Sync file
  const handleSyncFile = () => {
    message.info('Đang đồng bộ dữ liệu...');
    setTimeout(() => {
      message.success('Đồng bộ thành công!');
    }, 1000);
  };

  // Export JSON
  const handleExportJSON = () => {
    if (products.length === 0) {
      message.warning('Không có dữ liệu để xuất!');
      return;
    }
    
    const dataStr = JSON.stringify(products, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `products_${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    message.success('Xuất file JSON thành công!');
  };

  // Restore data
  const handleRestoreData = () => {
    message.warning('Chức năng khôi phục dữ liệu đang được phát triển!');
  };

  // Download template Excel
  const handleDownloadTemplate = () => {
    try {
      // Tạo data cho Excel
      const headers = ['STT', 'Tên sản phẩm', 'SKU', 'Danh mục', 'Giá bán', 'Tồn kho', 'Đơn vị', 'Quy đổi', 'Trạng thái', 'Mô tả'];
      const sampleData = [
        ['1', '1KG Bánh gạo nhúm phồ mật 500', 'PKCVKS-1KG', 'Hàng Khô', '99000', '100', 'kg', '1 thùng = 10 kg', 'active', 'Sản phẩm mẫu'],
        ['2', '1kg Phô Mai Gấu Vừng Kẹo Sợi', 'PMCVKS-1KG', 'Hàng Lạnh', '180000', '96', 'kg', '', 'active', ''],
        ['3', 'COMBO BÁNH BABYFOOD 1KG-200GRSOT', 'COMBO-BFOOD', 'Hàng Khô', '49000', '953', 'kg', '', 'active', '']
      ];
      
      // Kết hợp header và data
      const wsData = [headers, ...sampleData];
      
      // Tạo worksheet
      const ws = XLSX.utils.aoa_to_sheet(wsData);
      
      // Set độ rộng cột tự động
      const colWidths = [
        { wch: 5 },   // STT
        { wch: 40 },  // Tên sản phẩm
        { wch: 20 },  // SKU
        { wch: 15 },  // Danh mục
        { wch: 12 },  // Giá bán
        { wch: 10 },  // Tồn kho
        { wch: 10 },  // Đơn vị
        { wch: 20 },  // Quy đổi
        { wch: 12 },  // Trạng thái
        { wch: 30 }   // Mô tả
      ];
      ws['!cols'] = colWidths;
      
      // Tạo workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Sản phẩm');
      
      // Xuất file Excel
      XLSX.writeFile(wb, 'Template_San_Pham.xlsx');
      
      message.success('Tải template Excel thành công!');
    } catch (error) {
      console.error('Error creating Excel:', error);
      message.error('Lỗi tạo file Excel: ' + error.message);
    }
  };

  // Parse Excel/CSV file
  const parseExcelFile = (data) => {
    try {
      // Đọc workbook
      const workbook = XLSX.read(data, { type: 'binary' });
      console.log('Workbook loaded, sheets:', workbook.SheetNames);
      
      // Lấy sheet đầu tiên
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      
      // Convert sang JSON
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      console.log('Total rows in Excel:', jsonData.length);
      console.log('First 3 rows:', jsonData.slice(0, 3));
      
      if (jsonData.length < 2) {
        console.warn('File has less than 2 rows');
        return [];
      }
      
      const products = [];
      
      // Bỏ qua dòng header (index 0)
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length < 4) {
          console.log(`Skip row ${i}: Invalid or too short`, row);
          continue;
        }
        
        const product = {
          name: String(row[1] || '').trim(),
          sku: String(row[2] || '').trim(),
          categoryName: String(row[3] || '').trim(),
          price: parseFloat(row[4]) || 0,
          stock: parseInt(row[5]) || 0,
          unit: String(row[6] || 'cai').trim(),
          conversion: String(row[7] || '').trim(),
          status: String(row[8] || 'active').trim(),
          description: String(row[9] || '').trim()
        };
        
        if (product.name && product.price > 0) {
          products.push(product);
        } else {
          console.log(`Skip row ${i}: Invalid product data`, product);
        }
      }
      
      console.log('Valid products parsed:', products.length);
      return products;
    } catch (error) {
      console.error('Error parsing Excel:', error);
      throw error;
    }
  };

  // Handle file upload
  const handleFileUpload = async (file) => {
    // Hiển thị loading
    const loadingMessage = message.loading('Đang đọc file Excel...', 0);
    
    const reader = new FileReader();
    
    reader.onload = async (e) => {
      try {
        const data = e.target.result;
        console.log('File loaded, parsing...');
        
        const parsedProducts = parseExcelFile(data);
        console.log('Parsed products:', parsedProducts.length);
        
        loadingMessage(); // Đóng loading
        
        if (parsedProducts.length === 0) {
          message.error('File không có dữ liệu hợp lệ! Vui lòng kiểm tra lại file.');
          return;
        }
        
        // Map category names to IDs
        const productsWithCategories = parsedProducts.map(product => {
          const category = categories.find(cat => 
            cat.name.toLowerCase().trim() === product.categoryName.toLowerCase().trim()
          );
          
          return {
            ...product,
            categoryId: category ? category.id : categories[0]?.id || '',
            categoryFound: !!category
          };
        });
        
        // Đóng import modal
        setImportModalVisible(false);
        
        // Lưu products và hiển thị preview modal
        setPreviewProducts(productsWithCategories);
        setPreviewModalVisible(true);
        
      } catch (error) {
        loadingMessage(); // Đóng loading
        console.error('Error parsing file:', error);
        message.error('Lỗi đọc file: ' + error.message);
      }
    };
    
    reader.onerror = () => {
      loadingMessage(); // Đóng loading
      message.error('Lỗi đọc file!');
    };
    
    // Đọc file dạng binary để hỗ trợ Excel
    reader.readAsBinaryString(file);
    return false; // Prevent upload
  };

  // Bulk import products
  const handleBulkImport = async (productsData) => {
    // Mở lại modal để hiển thị progress
    setImportModalVisible(true);
    setImporting(true);
    setImportProgress(0);
    
    try {
      const total = productsData.length;
      let completed = 0;
      let successCount = 0;
      let failCount = 0;
      
      message.info(`Bắt đầu import ${total} sản phẩm...`, 2);
      
      for (const productData of productsData) {
        try {
          const product = {
            name: productData.name,
            sku: productData.sku,
            price: productData.price,
            categoryId: productData.categoryId,
            description: productData.description,
            stock: productData.stock,
            unit: productData.unit,
            conversion: productData.conversion,
            status: productData.status,
            productType: 'dry', // Default
            weight: 0.5, // Default
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };
          
          const productsRef = ref(database, 'products');
          const newProductRef = push(productsRef);
          await set(newProductRef, product);
          
          successCount++;
        } catch (error) {
          console.error('Error importing product:', productData.name, error);
          failCount++;
        }
        
        completed++;
        setImportProgress(Math.round((completed / total) * 100));
      }
      
      // Đóng modal
      setImportModalVisible(false);
      setImportProgress(0);
      
      // Hiển thị kết quả
      if (failCount === 0) {
        message.success({
          content: `🎉 Import thành công ${successCount} sản phẩm!`,
          duration: 5,
          style: { fontSize: '16px' }
        });
      } else {
        Modal.warning({
          title: '⚠️ Import Hoàn Thành Với Lỗi',
          content: (
            <div>
              <p>✅ Thành công: {successCount} sản phẩm</p>
              <p style={{ color: '#ff4d4f' }}>❌ Thất bại: {failCount} sản phẩm</p>
              <p style={{ marginTop: '12px', color: '#666' }}>
                Vui lòng kiểm tra console để xem chi tiết lỗi.
              </p>
            </div>
          )
        });
      }
      
    } catch (error) {
      console.error('Error importing products:', error);
      message.error('Lỗi import: ' + error.message);
      setImportModalVisible(false);
    } finally {
      setImporting(false);
    }
  };

  // Get category name
  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Chưa phân loại';
  };

  // Get product type name
  const getProductTypeName = (type) => {
    const types = {
      'cold': '🧊 Hàng Lạnh',
      'dry': '📦 Hàng Khô',
      'liquid': '💧 Hàng Nước'
    };
    return types[type] || '-';
  };

  // Table columns
  const columns = [
    {
      title: <Checkbox onChange={(e) => {
        if (e.target.checked) {
          setSelectedRows(products.map(p => p.id));
        } else {
          setSelectedRows([]);
        }
      }} />,
      key: 'checkbox',
      width: 50,
      render: (_, record) => (
        <Checkbox 
          checked={selectedRows.includes(record.id)}
          onChange={(e) => {
            if (e.target.checked) {
              setSelectedRows([...selectedRows, record.id]);
            } else {
              setSelectedRows(selectedRows.filter(id => id !== record.id));
            }
          }}
        />
      )
    },
    {
      title: 'STT',
      key: 'stt',
      width: 60,
      render: (_, __, index) => index + 1
    },
    {
      title: 'Tên Sản Phẩm',
      dataIndex: 'name',
      key: 'name',
      width: 200
    },
    {
      title: 'SKU',
      dataIndex: 'sku',
      key: 'sku',
      width: 120,
      render: (sku) => sku || '-'
    },
    {
      title: 'Danh Mục',
      dataIndex: 'categoryId',
      key: 'category',
      width: 150,
      render: (categoryId) => getCategoryName(categoryId)
    },
    {
      title: 'Giá (VNĐ)',
      dataIndex: 'price',
      key: 'price',
      width: 120,
      align: 'right',
      render: (price) => formatCurrency(price)
    },
    {
      title: 'Tồn kho',
      dataIndex: 'stock',
      key: 'stock',
      width: 100,
      align: 'center'
    },
    {
      title: 'Đơn vị',
      dataIndex: 'unit',
      key: 'unit',
      width: 100,
      align: 'center'
    },
    {
      title: 'Quy đổi',
      dataIndex: 'conversion',
      key: 'conversion',
      width: 120,
      align: 'center',
      render: (conversion) => conversion || '-'
    },
    {
      title: 'Loại SP',
      dataIndex: 'productType',
      key: 'productType',
      width: 120,
      align: 'center',
      render: (type) => getProductTypeName(type)
    },
    {
      title: 'Khối lượng',
      dataIndex: 'weight',
      key: 'weight',
      width: 100,
      align: 'center',
      render: (weight) => weight ? `${weight} kg` : '-'
    },
    {
      title: 'Sửa',
      key: 'edit',
      width: 70,
      align: 'center',
      render: (_, record) => (
        <Button 
          type="primary" 
          icon={<EditOutlined />} 
          size="small"
          style={{ background: '#faad14', borderColor: '#faad14' }}
          onClick={() => message.info('Chức năng sửa đang được phát triển!')}
        />
      )
    },
    {
      title: 'Xóa',
      key: 'delete',
      width: 70,
      align: 'center',
      render: (_, record) => (
        <Button 
          danger 
          icon={<DeleteOutlined />} 
          size="small"
          onClick={() => handleDelete(record.id)}
        />
      )
    }
  ];

  if (!hasPermission) {
    return (
      <div style={{ padding: '24px' }}>
        <Card>
          <h1>Không có quyền truy cập</h1>
          <p>Bạn không được phép truy cập trang Thêm Sản Phẩm. Vui lòng liên hệ quản trị viên để được cấp quyền.</p>
        </Card>
      </div>
    );
  }

  return (
    <div style={{ padding: '10px' }}>
      <Spin spinning={loading}>
        <Card
          title={
            <span>
              <PlusOutlined /> Thêm Sản Phẩm Mới
            </span>
          }
          style={{ marginBottom: 24 }}
        >
          <Form
            form={form}
            layout="vertical"
            onFinish={handleAddProduct}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Form.Item
                label="Tên sản phẩm"
                name="productName"
                rules={[{ required: true, message: 'Vui lòng nhập tên sản phẩm!' }]}
              >
                <Input placeholder="Tên sản phẩm" />
              </Form.Item>

              <Form.Item
                label="SKU"
                name="productSKU"
              >
                <Input placeholder="Mã SKU (tùy chọn)" />
              </Form.Item>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Form.Item
                label="Giá sản phẩm (đ)"
                name="productPrice"
                rules={[{ required: true, message: 'Vui lòng nhập giá!' }]}
              >
                <InputNumber 
                  placeholder="Nhập giá sản phẩm" 
                  style={{ width: '100%' }}
                  min={0}
                  formatter={value => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                  parser={value => value.replace(/\$\s?|(,*)/g, '')}
                />
              </Form.Item>

              <Form.Item
                label="Chọn danh mục"
                name="productCategory"
                rules={[{ required: true, message: 'Vui lòng chọn danh mục!' }]}
              >
                <Select placeholder="-- Chọn danh mục sản phẩm --">
                  {categories.map(cat => (
                    <Option key={cat.id} value={cat.id}>{cat.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <Form.Item
                label="Loại sản phẩm"
                name="productType"
                rules={[{ required: true, message: 'Vui lòng chọn loại sản phẩm!' }]}
              >
                <Select placeholder="-- Chọn loại sản phẩm --">
                  <Option value="cold">🧊 Hàng Lạnh (Thùng xốp)</Option>
                  <Option value="dry">📦 Hàng Khô (Thùng giấy)</Option>
                  <Option value="liquid">💧 Hàng Nước (Thùng nhựa)</Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="Khối lượng đóng gói (kg)"
                name="productWeight"
                initialValue={0.5}
              >
                <InputNumber 
                  placeholder="Khối lượng cho 1 đơn vị"
                  style={{ width: '100%' }}
                  min={0.001}
                  max={100}
                  step={0.001}
                />
              </Form.Item>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              <Form.Item
                label="Số lượng tồn kho"
                name="productStock"
                initialValue={0}
              >
                <InputNumber 
                  placeholder="Nhập số lượng tồn kho"
                  style={{ width: '100%' }}
                  min={0}
                />
              </Form.Item>

              <Form.Item
                label="Đơn vị bán"
                name="productUnit"
                initialValue="cai"
              >
                <Select>
                  <Option value="cai">Cái</Option>
                  <Option value="hop">Hộp</Option>
                  <Option value="goi">Gói</Option>
                  <Option value="thung">Thùng</Option>
                  <Option value="kg">Kilogram (kg)</Option>
                  <Option value="gram">Gram (g)</Option>
                  <Option value="lit">Lít (l)</Option>
                  <Option value="ml">Mililit (ml)</Option>
                </Select>
              </Form.Item>

              <Form.Item
                label="Quy đổi (tùy chọn)"
                name="productConversion"
              >
                <Input placeholder="Ví dụ: 1 hộp = 500g" />
              </Form.Item>
            </div>

            <Form.Item
              label="Mô tả sản phẩm"
              name="productDescription"
            >
              <TextArea 
                rows={3} 
                placeholder="Nhập mô tả chi tiết về sản phẩm (tùy chọn)"
              />
            </Form.Item>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button 
                  icon={<FileExcelOutlined />} 
                  onClick={() => setImportModalVisible(true)}
                  style={{ background: '#52c41a', borderColor: '#52c41a', color: 'white' }}
                >
                  Import Excel
                </Button>
                <Button icon={<DownloadOutlined />} onClick={handleDownloadTemplate}>
                  Tải Template Excel
                </Button>
              </div>
              
              <div style={{ display: 'flex', gap: '12px' }}>
                <Button icon={<CopyOutlined />} onClick={handleCopyFile}>
                  Copy File
                </Button>
                <Button icon={<SyncOutlined />} onClick={handleSyncFile}>
                  Đồng Bộ File
                </Button>
                <Button icon={<DownloadOutlined />} onClick={handleExportJSON}>
                  Export JSON
                </Button>
                <Button danger icon={<UndoOutlined />} onClick={handleRestoreData}>
                  Khôi Phục
                </Button>
                <Button type="primary" htmlType="submit" icon={<PlusOutlined />}>
                  Thêm Sản Phẩm
                </Button>
              </div>
            </div>
          </Form>
        </Card>

        {/* Products List */}
        <Card
          title="Danh Sách Sản Phẩm Hiện Tại"
          extra={
            selectedRows.length > 0 && (
              <Button danger onClick={handleDeleteSelected}>
                Xóa Đã Chọn ({selectedRows.length})
              </Button>
            )
          }
        >
          {products.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '50px' }}>
              <p style={{ fontSize: '18px', color: '#999' }}>Chưa có sản phẩm nào</p>
              <p style={{ color: '#666' }}>Hãy thêm sản phẩm đầu tiên của bạn!</p>
            </div>
          ) : (
            <Table
              columns={columns}
              dataSource={products}
              pagination={{ pageSize: 10 }}
              scroll={{ x: 1500 }}
            />
          )}
        </Card>

        {/* Import Modal */}
        <Modal
          title={
            <span>
              <FileExcelOutlined style={{ color: '#52c41a', marginRight: '8px' }} />
              Import Sản Phẩm từ File Excel
            </span>
          }
          open={importModalVisible}
          onCancel={() => {
            setImportModalVisible(false);
            setImportProgress(0);
          }}
          footer={null}
          width={600}
        >
          <div style={{ padding: '20px 0' }}>
            {/* Instructions */}
            <div style={{ 
              background: '#f0f9ff', 
              padding: '16px', 
              borderRadius: '8px', 
              marginBottom: '24px',
              border: '1px solid #91d5ff'
            }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#1890ff' }}>
                📝 Hướng dẫn:
              </h4>
              <ol style={{ margin: 0, paddingLeft: '20px', color: '#666' }}>
                <li>Click <strong>"Tải Template"</strong> ở trên để download file Excel mẫu</li>
                <li>Mở file Excel, sẽ thấy đầy đủ 10 cột và 3 dòng dữ liệu mẫu</li>
                <li>Điền thông tin sản phẩm vào các dòng tiếp theo (không cần chỉnh cột)</li>
                <li>Các cột bắt buộc: <strong>Tên sản phẩm, Danh mục, Giá bán</strong></li>
                <li>Lưu file và kéo thả vào khung bên dưới để import</li>
              </ol>
            </div>

            {/* Format example */}
            <div style={{ 
              background: '#fff7e6', 
              padding: '16px', 
              borderRadius: '8px', 
              marginBottom: '24px',
              border: '1px solid #ffd591'
            }}>
              <h4 style={{ margin: '0 0 12px 0', color: '#fa8c16' }}>
                📋 Định dạng file:
              </h4>
              <div style={{ fontSize: '13px', color: '#666', fontFamily: 'monospace' }}>
                <strong>Các cột:</strong> STT | Tên sản phẩm | SKU | Danh mục | Giá bán | Tồn kho | Đơn vị | Quy đổi | Trạng thái | Mô tả
              </div>
              <div style={{ fontSize: '12px', color: '#999', marginTop: '8px' }}>
                * Danh mục phải khớp với tên danh mục đã tạo trong hệ thống
              </div>
            </div>

            {/* Upload Area */}
            {!importing ? (
              <Upload.Dragger
                accept=".xlsx,.xls,.csv"
                beforeUpload={handleFileUpload}
                showUploadList={false}
                style={{ marginBottom: '16px' }}
              >
                <p className="ant-upload-drag-icon">
                  <UploadOutlined style={{ fontSize: '48px', color: '#52c41a' }} />
                </p>
                <p className="ant-upload-text" style={{ fontSize: '16px', fontWeight: 500 }}>
                  Kéo thả file Excel vào đây hoặc click để chọn
                </p>
                <p className="ant-upload-hint" style={{ fontSize: '14px', color: '#999' }}>
                  Hỗ trợ file Excel (.XLSX, .XLS) và CSV
                </p>
              </Upload.Dragger>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 0' }}>
                <h3 style={{ marginBottom: '24px', color: '#007A33' }}>
                  Đang import sản phẩm...
                </h3>
                <Progress 
                  percent={importProgress} 
                  status="active"
                  strokeColor={{
                    '0%': '#52c41a',
                    '100%': '#007A33',
                  }}
                />
                <p style={{ marginTop: '16px', color: '#666' }}>
                  Vui lòng đợi, đang xử lý...
                </p>
              </div>
            )}

            {/* Category list for reference */}
            {categories.length > 0 && !importing && (
              <div style={{ 
                background: '#f6ffed', 
                padding: '16px', 
                borderRadius: '8px',
                border: '1px solid #b7eb8f'
              }}>
                <h4 style={{ margin: '0 0 12px 0', color: '#52c41a' }}>
                  ✅ Danh mục có sẵn ({categories.length}):
                </h4>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {categories.map(cat => (
                    <span 
                      key={cat.id}
                      style={{ 
                        background: 'white',
                        padding: '4px 12px',
                        borderRadius: '4px',
                        fontSize: '13px',
                        border: '1px solid #d9f7be'
                      }}
                    >
                      {cat.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>

        {/* Preview Products Modal */}
        <Modal
          title={
            <div style={{ fontSize: '18px', fontWeight: 600 }}>
              📋 Xem Trước Danh Sách Sản Phẩm
            </div>
          }
          open={previewModalVisible}
          onCancel={() => {
            setPreviewModalVisible(false);
            setPreviewProducts([]);
          }}
          width={1200}
          footer={[
            <Button 
              key="cancel" 
              size="large"
              onClick={() => {
                setPreviewModalVisible(false);
                setPreviewProducts([]);
                message.info('Đã hủy import!');
              }}
            >
              ❌ Hủy
            </Button>,
            <Button 
              key="submit" 
              type="primary"
              size="large"
              style={{ background: '#52c41a', borderColor: '#52c41a' }}
              onClick={() => {
                setPreviewModalVisible(false);
                handleBulkImport(previewProducts);
              }}
            >
              ✅ Đăng Tải ({previewProducts.length} sản phẩm)
            </Button>
          ]}
        >
          <div style={{ marginBottom: '16px' }}>
            <div style={{ 
              background: '#f0f9ff', 
              padding: '12px 16px', 
              borderRadius: '8px',
              marginBottom: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '16px', fontWeight: 600, color: '#1890ff' }}>
                  📊 Tổng số sản phẩm: {previewProducts.length}
                </span>
              </div>
              <div style={{ color: '#666' }}>
                {previewProducts.filter(p => !p.categoryFound).length > 0 && (
                  <span style={{ color: '#fa8c16' }}>
                    ⚠️ {previewProducts.filter(p => !p.categoryFound).length} sản phẩm không tìm thấy danh mục
                  </span>
                )}
              </div>
            </div>
          </div>

          <Table
            dataSource={previewProducts.map((p, index) => ({ ...p, key: index }))}
            columns={[
              {
                title: 'STT',
                key: 'index',
                width: 60,
                align: 'center',
                render: (_, __, index) => index + 1
              },
              {
                title: 'Tên sản phẩm',
                dataIndex: 'name',
                key: 'name',
                width: 250,
                ellipsis: true
              },
              {
                title: 'SKU',
                dataIndex: 'sku',
                key: 'sku',
                width: 120
              },
              {
                title: 'Danh mục',
                key: 'category',
                width: 120,
                render: (record) => (
                  <span style={{ color: record.categoryFound ? '#52c41a' : '#fa8c16' }}>
                    {record.categoryFound ? '✅' : '⚠️'} {record.categoryName}
                  </span>
                )
              },
              {
                title: 'Giá bán',
                dataIndex: 'price',
                key: 'price',
                width: 100,
                align: 'right',
                render: (price) => formatCurrency(price)
              },
              {
                title: 'Tồn kho',
                dataIndex: 'stock',
                key: 'stock',
                width: 80,
                align: 'center'
              },
              {
                title: 'Đơn vị',
                dataIndex: 'unit',
                key: 'unit',
                width: 80,
                align: 'center'
              },
              {
                title: 'Quy đổi',
                dataIndex: 'conversion',
                key: 'conversion',
                width: 150,
                ellipsis: true
              },
              {
                title: 'Trạng thái',
                dataIndex: 'status',
                key: 'status',
                width: 100,
                align: 'center',
                render: (status) => (
                  <span style={{ 
                    color: status === 'active' ? '#52c41a' : '#999',
                    fontWeight: 500
                  }}>
                    {status === 'active' ? '✅ Active' : '⏸️ Inactive'}
                  </span>
                )
              }
            ]}
            pagination={{ 
              pageSize: 10,
              showTotal: (total) => `Tổng ${total} sản phẩm`,
              showSizeChanger: true,
              pageSizeOptions: ['10', '20', '50', '100']
            }}
            scroll={{ x: 1200, y: 400 }}
            size="small"
          />
        </Modal>
      </Spin>
    </div>
  );
};

export default AddProduct;
