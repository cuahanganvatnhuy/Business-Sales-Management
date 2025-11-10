import { ref, update } from 'firebase/database';
import { database } from '../services/firebase.service';

/**
 * Validate if there's enough stock for an order
 * @param {Array} items - Order items with productId and quantity
 * @param {Array} products - Products list with stock
 * @returns {Object} { valid: boolean, errors: Array }
 */
export const validateStock = (items, products) => {
  const errors = [];
  
  for (const item of items) {
    const product = products.find(p => p.id === item.productId);
    if (!product) {
      errors.push(
        `Sản phẩm "${item.productName}" không tồn tại trong kho! ` +
        `ProductID: ${item.productId || 'undefined'}. ` +
        `Vui lòng vào /selling-products và đồng bộ lại sản phẩm này.`
      );
      console.error('❌ Product not found:', {
        itemProductId: item.productId,
        itemProductName: item.productName,
        availableProductIds: products.map(p => p.id).slice(0, 5),
        totalProducts: products.length
      });
      continue;
    }
    
    const availableStock = product.stock || 0;
    if (item.quantity > availableStock) {
      errors.push(
        `Sản phẩm "${product.name}" không đủ hàng! ` +
        `Tồn kho: ${availableStock} ${product.unit || 'lỗi'}, ` +
        `Yêu cầu: ${item.quantity} ${product.unit || 'lỗi'}`
      );
    }
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
};

/**
 * Deduct stock from inventory and create transaction log
 * @param {Array} items - Order items with productId and quantity
 * @param {Array} products - Products list with stock
 * @param {String} orderId - Order ID for reference
 * @param {String} orderType - Order type (ecommerce, retail, wholesale)
 * @returns {Promise} Firebase update promise
 */
export const deductStock = async (items, products, orderId, orderType) => {
  const updates = {};
  const timestamp = Date.now();
  
  items.forEach((item, index) => {
    const product = products.find(p => p.id === item.productId);
    if (!product) return;
    
    const beforeStock = product.stock || 0;
    const afterStock = beforeStock - item.quantity;
    
    // Update product stock
    updates[`products/${item.productId}/stock`] = afterStock;
    updates[`products/${item.productId}/updatedAt`] = new Date().toISOString();
    
    // Create transaction log
    const txnId = `txn_${timestamp}_${index}`;
    updates[`warehouseTransactions/${txnId}`] = {
      productId: item.productId,
      productName: item.productName || product.name,
      sku: item.sku || product.sku,
      type: 'export',
      quantity: item.quantity,
      beforeQuantity: beforeStock,
      afterQuantity: afterStock,
      reason: `Bán hàng - ${orderType === 'ecommerce' ? 'TMĐT' : orderType === 'retail' ? 'Lẻ' : 'Sỉ'}`,
      orderId: orderId,
      createdAt: new Date().toISOString()
    };
  });
  
  return update(ref(database), updates);
};

/**
 * Check stock availability for a single product
 * @param {String} productId - Product ID
 * @param {Number} quantity - Required quantity
 * @param {Array} products - Products list
 * @returns {Object} { available: boolean, stock: number, message: string }
 */
export const checkStockAvailability = (productId, quantity, products) => {
  const product = products.find(p => p.id === productId);
  
  if (!product) {
    return {
      available: false,
      stock: 0,
      message: 'Sản phẩm không tồn tại trong kho!'
    };
  }
  
  const stock = product.stock || 0;
  const available = quantity <= stock;
  
  return {
    available,
    stock,
    message: available 
      ? `Tồn kho: ${stock} ${product.unit || 'lỗi'}`
      : `Không đủ hàng! Tồn kho chỉ còn: ${stock} ${product.unit || 'lỗi'}`
  };
};
