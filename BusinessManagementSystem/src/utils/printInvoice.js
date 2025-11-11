// Print Invoice Utility - From Legacy System
export const printRetailInvoice = (order) => {
  if (!order) {
    console.error('Không tìm thấy đơn hàng!');
    return;
  }

  console.log('🖨️ Printing invoice for order:', order.orderId);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount || 0);
  };

  // Store info (có thể lấy từ Firebase sau)
  const storeInfo = {
    name: 'CỬA HÀNG',
    address: 'Phú Yên',
    phone: '0123456789',
    email: 'info@cuahang.com'
  };

  // Create invoice HTML
  let invoiceHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Hóa Đơn Bán Lẻ - ${order.orderId}</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                background: white;
            }
            .invoice-container {
                max-width: 800px;
                margin: 0 auto;
                background: white;
                padding: 30px;
                border: 1px solid #ddd;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #007A33;
                padding-bottom: 20px;
            }
            .store-name {
                font-size: 24px;
                font-weight: bold;
                color: #007A33;
                margin-bottom: 10px;
            }
            .store-info {
                color: #666;
                font-size: 14px;
            }
            .invoice-title {
                font-size: 20px;
                font-weight: bold;
                margin: 20px 0;
                text-align: center;
            }
            .info-section {
                display: flex;
                justify-content: space-between;
                margin-bottom: 30px;
            }
            .customer-info, .order-info {
                width: 48%;
            }
            .info-title {
                font-weight: bold;
                color: #333;
                margin-bottom: 10px;
                border-bottom: 1px solid #eee;
                padding-bottom: 5px;
            }
            .info-item {
                margin-bottom: 8px;
                display: flex;
            }
            .info-label {
                font-weight: bold;
                width: 140px;
                color: #555;
            }
            .products-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
            }
            .products-table th,
            .products-table td {
                border: 1px solid #ddd;
                padding: 12px;
                text-align: left;
            }
            .products-table th {
                background-color: #f5f5f5;
                font-weight: bold;
                text-align: center;
            }
            .products-table td:last-child,
            .products-table th:last-child {
                text-align: right;
            }
            .total-section {
                margin-top: 20px;
                text-align: right;
            }
            .total-row {
                display: flex;
                justify-content: flex-end;
                margin-bottom: 8px;
            }
            .total-label {
                width: 150px;
                font-weight: bold;
                text-align: right;
                margin-right: 20px;
            }
            .total-value {
                width: 150px;
                text-align: right;
            }
            .grand-total {
                border-top: 2px solid #007A33;
                padding-top: 10px;
                font-size: 18px;
                font-weight: bold;
                color: #007A33;
            }
            .footer {
                margin-top: 40px;
                text-align: center;
                color: #666;
                font-size: 12px;
                border-top: 1px solid #eee;
                padding-top: 20px;
            }
            @media print {
                body { margin: 0; }
                .invoice-container { border: none; box-shadow: none; }
            }
        </style>
    </head>
    <body>
        <div class="invoice-container">
            <div class="header">
                <div class="store-name">${storeInfo.name}</div>
                <div class="store-info">
                    Địa chỉ: ${storeInfo.address}<br>
                    Điện thoại: ${storeInfo.phone} | Email: ${storeInfo.email}
                </div>
            </div>
            
            <div class="invoice-title">HÓA ĐƠN BÁN LẺ</div>
            
            <div class="info-section">
                <div class="customer-info">
                    <div class="info-title">THÔNG TIN KHÁCH HÀNG</div>
                    <div class="info-item">
                        <span class="info-label">Tên khách hàng:</span>
                        <span>${order.customerName || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Số điện thoại:</span>
                        <span>${order.customerPhone || 'N/A'}</span>
                    </div>
                </div>
                
                <div class="order-info">
                    <div class="info-title">THÔNG TIN ĐƠN HÀNG</div>
                    <div class="info-item">
                        <span class="info-label">Mã đơn hàng:</span>
                        <span>${order.orderId || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Ngày bán:</span>
                        <span>${order.orderDate || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Giờ bán:</span>
                        <span>${order.orderTime || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Kênh bán:</span>
                        <span>${order.salesChannel === 'tmdt' ? 'Sàn TMĐT' : 'Bán lẻ trực tiếp'}</span>
                    </div>
                </div>
            </div>
            
            <table class="products-table">
                <thead>
                    <tr>
                        <th>STT</th>
                        <th>Tên Sản Phẩm</th>
                        <th>Mã SKU</th>
                        <th>Số Lượng</th>
                        <th>Đơn Giá</th>
                        <th>Thành Tiền</th>
                    </tr>
                </thead>
                <tbody>`;

  // Add products to invoice
  if (order.items && Array.isArray(order.items)) {
    order.items.forEach((item, index) => {
      invoiceHTML += `
                <tr>
                    <td style="text-align: center;">${index + 1}</td>
                    <td>${item.productName || 'N/A'}</td>
                    <td style="text-align: center;">${item.sku || 'N/A'}</td>
                    <td style="text-align: center;">${item.quantity || 0}</td>
                    <td style="text-align: right;">${formatCurrency(item.sellingPrice || 0)}</td>
                    <td style="text-align: right;">${formatCurrency(item.totalAmount || 0)}</td>
                </tr>`;
    });
  }

  invoiceHTML += `
                </tbody>
            </table>
            
            <div class="total-section">
                <div class="total-row">
                    <span class="total-label">Tạm tính:</span>
                    <span class="total-value">${formatCurrency(order.subtotal || 0)}</span>
                </div>
                <div class="total-row">
                    <span class="total-label">Giảm giá:</span>
                    <span class="total-value">- ${formatCurrency(order.discount || 0)}</span>
                </div>
                <div class="total-row">
                    <span class="total-label">Phí vận chuyển:</span>
                    <span class="total-value">+ ${formatCurrency(order.shipping || 0)}</span>
                </div>
                <div class="total-row grand-total">
                    <span class="total-label">TỔNG CỘNG:</span>
                    <span class="total-value">${formatCurrency(order.totalAmount || 0)}</span>
                </div>
            </div>
            
            <div class="footer">
                Cảm ơn quý khách đã mua hàng!<br>
                Ngày in: ${new Date().toLocaleString('vi-VN')}
            </div>
        </div>
    </body>
    </html>`;

  // Open print window
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    console.error('Không thể mở cửa sổ in. Vui lòng kiểm tra popup blocker!');
    return;
  }

  printWindow.document.write(invoiceHTML);
  printWindow.document.close();

  // Auto print after content loads
  printWindow.onload = function() {
    printWindow.print();
    printWindow.onafterprint = function() {
      printWindow.close();
    };
  };

  console.log('✅ Đã mở cửa sổ in hóa đơn');
};

// Print Wholesale Invoice
export const printWholesaleInvoice = (order) => {
  if (!order) {
    console.error('Không tìm thấy đơn hàng!');
    return;
  }

  console.log('🖨️ Printing wholesale invoice for order:', order.orderId);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND'
    }).format(amount || 0);
  };

  // Store info
  const storeInfo = {
    name: 'CỬA HÀNG',
    address: 'Phú Yên',
    phone: '0123456789',
    email: 'info@cuahang.com'
  };

  // Create invoice HTML
  let invoiceHTML = `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <title>Hóa Đơn Bán Sỉ - ${order.orderId}</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                margin: 0;
                padding: 20px;
                background: white;
            }
            .invoice-container {
                max-width: 800px;
                margin: 0 auto;
                background: white;
                padding: 30px;
                border: 1px solid #ddd;
            }
            .header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #007A33;
                padding-bottom: 20px;
            }
            .store-name {
                font-size: 24px;
                font-weight: bold;
                color: #007A33;
                margin-bottom: 10px;
            }
            .store-info {
                color: #666;
                font-size: 14px;
            }
            .invoice-title {
                font-size: 20px;
                font-weight: bold;
                margin: 20px 0;
                text-align: center;
                color: #007A33;
            }
            .info-section {
                display: flex;
                justify-content: space-between;
                margin-bottom: 30px;
            }
            .customer-info, .order-info {
                width: 48%;
            }
            .info-title {
                font-weight: bold;
                color: #333;
                margin-bottom: 10px;
                border-bottom: 1px solid #eee;
                padding-bottom: 5px;
            }
            .info-item {
                margin-bottom: 8px;
                display: flex;
            }
            .info-label {
                font-weight: bold;
                width: 140px;
                color: #555;
            }
            .products-table {
                width: 100%;
                border-collapse: collapse;
                margin-bottom: 20px;
            }
            .products-table th,
            .products-table td {
                border: 1px solid #ddd;
                padding: 12px;
                text-align: left;
            }
            .products-table th {
                background-color: #f5f5f5;
                font-weight: bold;
                text-align: center;
            }
            .products-table td:last-child,
            .products-table th:last-child {
                text-align: right;
            }
            .total-section {
                margin-top: 20px;
                text-align: right;
            }
            .total-row {
                display: flex;
                justify-content: flex-end;
                margin-bottom: 8px;
            }
            .total-label {
                width: 150px;
                font-weight: bold;
                text-align: right;
                margin-right: 20px;
            }
            .total-value {
                width: 150px;
                text-align: right;
            }
            .grand-total {
                border-top: 2px solid #007A33;
                padding-top: 10px;
                font-size: 18px;
                font-weight: bold;
                color: #007A33;
            }
            .remaining-row {
                color: #ff4d4f;
                font-size: 16px;
                font-weight: bold;
            }
            .footer {
                margin-top: 40px;
                text-align: center;
                color: #666;
                font-size: 12px;
                border-top: 1px solid #eee;
                padding-top: 20px;
            }
            @media print {
                body { margin: 0; }
                .invoice-container { border: none; box-shadow: none; }
            }
        </style>
    </head>
    <body>
        <div class="invoice-container">
            <div class="header">
                <div class="store-name">${storeInfo.name}</div>
                <div class="store-info">
                    Địa chỉ: ${storeInfo.address}<br>
                    Điện thoại: ${storeInfo.phone} | Email: ${storeInfo.email}
                </div>
            </div>
            
            <div class="invoice-title">HÓA ĐƠN BÁN SỈ</div>
            
            <div class="info-section">
                <div class="customer-info">
                    <div class="info-title">THÔNG TIN KHÁCH HÀNG</div>
                    <div class="info-item">
                        <span class="info-label">Tên khách hàng:</span>
                        <span>${order.customerName || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Số điện thoại:</span>
                        <span>${order.customerPhone || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Địa chỉ:</span>
                        <span>${order.customerAddress || 'N/A'}</span>
                    </div>
                </div>
                
                <div class="order-info">
                    <div class="info-title">THÔNG TIN ĐƠN HÀNG</div>
                    <div class="info-item">
                        <span class="info-label">Mã đơn hàng:</span>
                        <span>${order.orderId || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Ngày đặt:</span>
                        <span>${order.orderDate || 'N/A'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Ngày giao:</span>
                        <span>${order.deliveryDate || 'Chưa xác định'}</span>
                    </div>
                    <div class="info-item">
                        <span class="info-label">Loại đơn:</span>
                        <span>Bán Sỉ</span>
                    </div>
                </div>
            </div>
            
            <table class="products-table">
                <thead>
                    <tr>
                        <th>STT</th>
                        <th>Tên Sản Phẩm</th>
                        <th>Mã SKU</th>
                        <th>Số Lượng</th>
                        <th>Đơn Giá</th>
                        <th>Thành Tiền</th>
                    </tr>
                </thead>
                <tbody>`;

  // Add products to invoice
  if (order.items && Array.isArray(order.items)) {
    order.items.forEach((item, index) => {
      invoiceHTML += `
                <tr>
                    <td style="text-align: center;">${index + 1}</td>
                    <td>${item.productName || 'N/A'}</td>
                    <td style="text-align: center;">${item.sku || 'N/A'}</td>
                    <td style="text-align: center;">${item.quantity || 0}</td>
                    <td style="text-align: right;">${formatCurrency(item.sellingPrice || 0)}</td>
                    <td style="text-align: right;">${formatCurrency(item.totalAmount || 0)}</td>
                </tr>`;
    });
  }

  invoiceHTML += `
                </tbody>
            </table>
            
            <div class="total-section">
                <div class="total-row">
                    <span class="total-label">Tạm tính:</span>
                    <span class="total-value">${formatCurrency(order.subtotal || 0)}</span>
                </div>
                <div class="total-row">
                    <span class="total-label">Giảm giá:</span>
                    <span class="total-value">- ${formatCurrency(order.discount || 0)}</span>
                </div>
                <div class="total-row">
                    <span class="total-label">Phí vận chuyển:</span>
                    <span class="total-value">+ ${formatCurrency(order.shipping || 0)}</span>
                </div>
                <div class="total-row grand-total">
                    <span class="total-label">TỔNG CỘNG:</span>
                    <span class="total-value">${formatCurrency(order.totalAmount || 0)}</span>
                </div>
                <div class="total-row">
                    <span class="total-label">Đã cọc:</span>
                    <span class="total-value">- ${formatCurrency(order.deposit || 0)}</span>
                </div>
                <div class="total-row remaining-row">
                    <span class="total-label">CÒN PHẢI TRẢ:</span>
                    <span class="total-value">${formatCurrency(order.remainingAmount || 0)}</span>
                </div>
            </div>
            
            <div class="footer">
                Cảm ơn quý khách đã mua hàng!<br>
                Ngày in: ${new Date().toLocaleString('vi-VN')}
            </div>
        </div>
    </body>
    </html>`;

  // Open print window
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    console.error('Không thể mở cửa sổ in. Vui lòng kiểm tra popup blocker!');
    return;
  }

  printWindow.document.write(invoiceHTML);
  printWindow.document.close();

  // Auto print after content loads
  printWindow.onload = function() {
    printWindow.print();
    printWindow.onafterprint = function() {
      printWindow.close();
    };
  };

  console.log('✅ Đã mở cửa sổ in hóa đơn bán sỉ');
};
