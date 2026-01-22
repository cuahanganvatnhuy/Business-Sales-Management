import { ref, update } from 'firebase/database';
import { database } from '../services/firebase.service';

/**
 * Validate if there's enough stock for an order
 * @param {Array} items - Order items with productId and quantity
 * @param {Array} products - Products list with stock
 * @param {Array} sellingProducts - Optional selling products for mapping (for TMĐT orders)
 * @returns {Object} { valid: boolean, errors: Array }
 */
export const validateStock = (items, products, sellingProducts = null) => {
  const errors = [];
  
  for (const item of items) {
    // If sellingProducts provided, map sellingProduct.id -> product.id
    let actualProductId = item.productId;
    
    if (sellingProducts) {
      const sellingProduct = sellingProducts.find(sp => sp.id === item.productId);
      if (sellingProduct && sellingProduct.productId) {
        actualProductId = sellingProduct.productId;
      }
    }
    
    let product = products.find(p => p.id === actualProductId);
    
    // Nếu không tìm thấy bằng ID, thử tìm bằng SKU (quan trọng nhất)
    if (!product && item.sku) {
      product = products.find(p => {
        if (!p.sku) return false;
        // So sánh SKU không phân biệt hoa thường và bỏ qua khoảng trắng
        const normalizeSku = (sku) => (sku || '').toUpperCase().trim().replace(/\s+/g, '');
        return normalizeSku(p.sku) === normalizeSku(item.sku);
      });
      
      if (product) {
        console.log('✅ Tìm thấy product bằng SKU:', {
          itemSku: item.sku,
          productSku: product.sku,
          productId: product.id,
          productName: product.name,
          stock: product.stock
        });
      }
    }
    
    // Nếu vẫn không tìm thấy, thử tìm bằng tên sản phẩm
    if (!product && item.productName) {
      const searchName = item.productName.split('(')[0].trim().toLowerCase();
      product = products.find(p => {
        if (!p.name) return false;
        const productName = p.name.toLowerCase();
        return productName === searchName || productName.includes(searchName) || searchName.includes(productName);
      });
      
      if (product) {
        console.log('✅ Tìm thấy product bằng tên:', {
          itemName: item.productName,
          productName: product.name,
          productId: product.id,
          stock: product.stock
        });
      }
    }
    
    if (!product) {
      // Không tìm thấy product - báo lỗi nhưng vẫn tiếp tục kiểm tra các sản phẩm khác
      errors.push(
        `❌ Sản phẩm "${item.productName}" (SKU: ${item.sku || 'N/A'}) không tồn tại trong kho! ` +
        `Vui lòng vào /selling-products và đồng bộ lại sản phẩm này.`
      );
      console.error('❌ Product not found:', {
        itemProductId: item.productId,
        actualProductId: actualProductId,
        itemProductName: item.productName,
        itemSku: item.sku,
        availableProductIds: products.map(p => p.id).slice(0, 5),
        totalProducts: products.length,
        availableSkus: products.filter(p => p.sku).map(p => p.sku).slice(0, 10)
      });
      continue;
    }
    
    const availableStock = product.stock || 0;
    
    // Kiểm tra stock = 0 trước (quan trọng nhất)
    if (availableStock === 0) {
      errors.push(
        `🚨 Sản phẩm "${product.name || item.productName}" (SKU: ${product.sku || item.sku || 'N/A'}) ĐÃ HẾT HÀNG! ` +
        `Tồn kho: 0 ${product.unit || 'lỗi'}. ` +
        `Không thể tạo đơn hàng với sản phẩm này!`
      );
    } else if (item.quantity > availableStock) {
      // Stock > 0 nhưng không đủ
      errors.push(
        `⚠️ Sản phẩm "${product.name || item.productName}" (SKU: ${product.sku || item.sku || 'N/A'}) không đủ hàng! ` +
        `Tồn kho: ${availableStock} ${product.unit || 'lỗi'}, ` +
        `Yêu cầu: ${item.quantity} ${product.unit || 'lỗi'}. ` +
        `Còn thiếu: ${(item.quantity - availableStock).toFixed(2)} ${product.unit || 'lỗi'}`
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
 * @param {Array} sellingProducts - Optional selling products for mapping (for TMĐT orders)
 * @param {Object} store - Optional store object {id, name}
 * @returns {Promise} Firebase update promise
 */
export const deductStock = async (items, products, orderId, orderType, sellingProducts = null, store = null) => {
  const updates = {};
  const timestamp = Date.now();
  
  items.forEach((item, index) => {
    // If sellingProducts provided, map sellingProduct.id -> product.id
    let actualProductId = item.productId;
    
    if (sellingProducts) {
      const sellingProduct = sellingProducts.find(sp => sp.id === item.productId);
      if (sellingProduct && sellingProduct.productId) {
        actualProductId = sellingProduct.productId;
      }
    }
    
    const product = products.find(p => p.id === actualProductId);
    if (!product) return;
    
    const beforeStock = product.stock || 0;
    const afterStock = beforeStock - item.quantity;
    
    // Update product stock
    updates[`products/${actualProductId}/stock`] = afterStock;
    updates[`products/${actualProductId}/updatedAt`] = new Date().toISOString();
    
    // Create transaction log
    const txnId = `txn_${timestamp}_${index}`;
    updates[`warehouseTransactions/${txnId}`] = {
      productId: actualProductId,
      productName: item.productName || product.name,
      sku: item.sku || product.sku,
      type: 'export',
      quantity: item.quantity,
      beforeQuantity: beforeStock,
      afterQuantity: afterStock,
      reason: `Bán hàng - ${orderType === 'ecommerce' ? 'TMĐT' : orderType === 'retail' ? 'Lẻ' : 'Sỉ'}`,
      orderId: orderId,
      storeId: store?.id || null,
      storeName: store?.name || 'N/A',
      createdAt: new Date().toISOString()
    };
  });
  
  return update(ref(database), updates);
};

/**
 * Check stock availability for a single product
 * @param {String} productId - Product ID (or sellingProduct ID)
 * @param {Number} quantity - Required quantity
 * @param {Array} products - Products list
 * @param {Array} sellingProducts - Optional selling products for mapping
 * @returns {Object} { available: boolean, stock: number, message: string }
 */
export const checkStockAvailability = (productId, quantity, products, sellingProducts = null) => {
  // If sellingProducts provided, map sellingProduct.id -> product.id
  let actualProductId = productId;
  
  if (sellingProducts) {
    const sellingProduct = sellingProducts.find(sp => sp.id === productId);
    if (sellingProduct && sellingProduct.productId) {
      actualProductId = sellingProduct.productId;
    }
  }
  
  const product = products.find(p => p.id === actualProductId);
  
  if (!product) {
    return {
      available: false,
      stock: 0,
      message: 'Sản phẩm không tồn tại trong kho!'
    };
  }
  
  const stock = product.stock || 0;
  const available = quantity <= stock;
  
  // Thông báo rõ ràng hơn cho từng trường hợp
  let messageText = '';
  if (stock === 0) {
    messageText = `🚨 ĐÃ HẾT HÀNG! Tồn kho: 0 ${product.unit || 'lỗi'}. Không thể tạo đơn hàng!`;
  } else if (!available) {
    messageText = `⚠️ Không đủ hàng! Tồn kho chỉ còn: ${stock} ${product.unit || 'lỗi'}, yêu cầu: ${quantity} ${product.unit || 'lỗi'}`;
  } else {
    messageText = `✅ Tồn kho: ${stock} ${product.unit || 'lỗi'}`;
  }
  
  return {
    available,
    stock,
    message: messageText
  };
};
