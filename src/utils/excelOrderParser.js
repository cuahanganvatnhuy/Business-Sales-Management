// Excel Order Parser for TMDT Orders
// Parses Excel files and groups products by Order ID

import * as XLSX from 'xlsx';

/**
 * Parse Excel file and extract TMDT orders
 * @param {File} file - Excel file
 * @param {string} platform - Selected platform (shopee, tiktok, etc.)
 * @param {Array} sellingProducts - List of selling products from database
 * @returns {Promise<Array>} - Array of orders grouped by Order ID
 */
export async function parseExcelOrders(file, platform, sellingProducts) {
  try {
    // Read file
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    
    // Get first worksheet
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    
    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length < 2) {
      throw new Error('File Excel không có dữ liệu hoặc chỉ có header');
    }

    // Find headers
    const headerMapping = findExcelHeaders(jsonData);
    if (!headerMapping) {
      throw new Error('Không tìm thấy các cột bắt buộc. Cần có: Order ID, SKU, Product Name, Quantity');
    }

    // Parse rows
    const parsedRows = [];
    for (let i = headerMapping.headerRowIndex + 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      if (!row || row.length === 0) continue;
      
      const orderData = extractOrderDataFromRow(row, headerMapping, platform);
      if (orderData) {
        // Match with selling products
        const matchedProduct = matchProductBySKU(orderData.sku, sellingProducts);
        if (matchedProduct) {
          orderData.productId = matchedProduct.id;
          orderData.productName = matchedProduct.productName || matchedProduct.name;
          orderData.unit = matchedProduct.unit || 'kg';
          orderData.importPrice = matchedProduct.importPrice || 0;
          orderData.sellingPrice = matchedProduct.sellingPrice || 0;
          orderData.subtotal = orderData.sellingPrice * orderData.quantity;
          orderData.profit = (orderData.sellingPrice - orderData.importPrice) * orderData.quantity;
          
          parsedRows.push(orderData);
        }
      }
    }

    // Group by Order ID - KEY LOGIC
    const groupedOrders = groupByOrderId(parsedRows);
    
    return groupedOrders;
  } catch (error) {
    console.error('Error parsing Excel:', error);
    throw error;
  }
}

/**
 * Find Excel headers and their column indices
 */
function findExcelHeaders(jsonData) {
  for (let i = 0; i < Math.min(5, jsonData.length); i++) {
    const row = jsonData[i];
    if (!row) continue;
    
    const headerMap = {};
    
    row.forEach((cell, index) => {
      if (!cell) return;
      const cellText = cell.toString().toLowerCase().trim();
      
      if (cellText === 'order id' || cellText === 'mã đơn') {
        headerMap.orderId = index;
      } else if (cellText === 'sku id' || cellText === 'seller sku' || cellText === 'sku') {
        headerMap.sku = index;
      } else if (cellText === 'product name' || cellText === 'tên sản phẩm') {
        headerMap.productName = index;
      } else if (cellText === 'quantity' || cellText === 'số lượng') {
        headerMap.quantity = index;
      } else if (cellText === 'sku subtotal after discount') {
        headerMap.skuSubtotal = index;
      }
    });
    
    // Need at least: Order ID, SKU, Product Name, Quantity
    if (headerMap.orderId !== undefined && 
        headerMap.sku !== undefined &&
        headerMap.productName !== undefined && 
        headerMap.quantity !== undefined) {
      headerMap.headerRowIndex = i;
      return headerMap;
    }
  }
  
  return null;
}

/**
 * Extract order data from a single Excel row
 */
function extractOrderDataFromRow(row, headerMapping, platform) {
  try {
    const orderId = row[headerMapping.orderId]?.toString().trim();
    const sku = row[headerMapping.sku]?.toString().trim();
    const productName = row[headerMapping.productName]?.toString().trim();
    const quantity = parseFloat(row[headerMapping.quantity]) || 0;
    const skuSubtotal = headerMapping.skuSubtotal !== undefined ? 
      parseFloat(row[headerMapping.skuSubtotal]) || 0 : 0;
    
    if (!orderId || !sku || !productName || quantity <= 0) {
      return null;
    }
    
    return {
      orderId,
      sku,
      productName,
      quantity,
      skuSubtotal,
      platform
    };
  } catch (error) {
    console.error('Error extracting row:', error);
    return null;
  }
}

/**
 * Match product by SKU
 */
function matchProductBySKU(sku, products) {
  const skuLower = sku.toLowerCase().trim();
  
  // Exact match
  let match = products.find(p => 
    p.sku && p.sku.toLowerCase().trim() === skuLower
  );
  
  if (match) return match;
  
  // Partial match
  match = products.find(p => 
    p.sku && (
      p.sku.toLowerCase().includes(skuLower) ||
      skuLower.includes(p.sku.toLowerCase())
    )
  );
  
  return match || null;
}

/**
 * Group parsed rows by Order ID
 * KEY LOGIC: Products with same Order ID are grouped into one order
 */
function groupByOrderId(parsedRows) {
  const orderMap = {};
  
  parsedRows.forEach(row => {
    const orderId = row.orderId;
    
    if (!orderMap[orderId]) {
      // Create new order
      orderMap[orderId] = {
        orderId: orderId,
        platform: row.platform,
        items: [],
        totalAmount: 0,
        totalProfit: 0,
        totalItems: 0,
        totalQuantity: 0
      };
    }
    
    // Add item to order
    orderMap[orderId].items.push({
      productId: row.productId,
      productName: row.productName,
      sku: row.sku,
      unit: row.unit || 'kg',
      quantity: row.quantity,
      importPrice: row.importPrice,
      sellingPrice: row.sellingPrice,
      subtotal: row.subtotal,
      profit: row.profit
    });
    
    // Update totals
    orderMap[orderId].totalAmount += row.subtotal;
    orderMap[orderId].totalProfit += row.profit;
    orderMap[orderId].totalItems += 1;
    orderMap[orderId].totalQuantity += row.quantity;
  });
  
  // Convert map to array
  return Object.values(orderMap);
}
