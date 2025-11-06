import { ref, get, set, update, remove, push } from 'firebase/database';
import { database } from './firebase.service';

// Lấy tất cả sản phẩm
export const getAllProducts = async () => {
  try {
    const productsRef = ref(database, 'products');
    const snapshot = await get(productsRef);
    
    if (snapshot.exists()) {
      const productsData = snapshot.val();
      return Object.keys(productsData).map(key => ({
        id: key,
        ...productsData[key]
      }));
    }
    return [];
  } catch (error) {
    console.error('Get products error:', error);
    throw error;
  }
};

// Lấy sản phẩm theo ID
export const getProductById = async (productId) => {
  try {
    const productRef = ref(database, `products/${productId}`);
    const snapshot = await get(productRef);
    
    if (snapshot.exists()) {
      return {
        id: productId,
        ...snapshot.val()
      };
    }
    return null;
  } catch (error) {
    console.error('Get product error:', error);
    throw error;
  }
};

// Thêm sản phẩm mới
export const addProduct = async (productData) => {
  try {
    const productsRef = ref(database, 'products');
    const newProductRef = push(productsRef);
    
    const product = {
      ...productData,
      id: newProductRef.key,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await set(newProductRef, product);
    return product;
  } catch (error) {
    console.error('Add product error:', error);
    throw error;
  }
};

// Cập nhật sản phẩm
export const updateProduct = async (productId, updateData) => {
  try {
    const productRef = ref(database, `products/${productId}`);
    const updates = {
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    await update(productRef, updates);
    return { id: productId, ...updates };
  } catch (error) {
    console.error('Update product error:', error);
    throw error;
  }
};

// Xóa sản phẩm
export const deleteProduct = async (productId) => {
  try {
    const productRef = ref(database, `products/${productId}`);
    await remove(productRef);
  } catch (error) {
    console.error('Delete product error:', error);
    throw error;
  }
};

// Cập nhật số lượng tồn kho
export const updateStock = async (productId, quantity) => {
  try {
    const product = await getProductById(productId);
    if (!product) {
      throw new Error('Product not found');
    }
    
    const newStock = (product.stock || 0) + quantity;
    return await updateProduct(productId, { stock: newStock });
  } catch (error) {
    console.error('Update stock error:', error);
    throw error;
  }
};

// Lấy sản phẩm sắp hết hàng
export const getLowStockProducts = async (threshold = 10) => {
  try {
    const products = await getAllProducts();
    return products.filter(product => (product.stock || 0) <= threshold);
  } catch (error) {
    console.error('Get low stock products error:', error);
    throw error;
  }
};
