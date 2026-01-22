import { ref, get, set, update, remove, push } from 'firebase/database';
import { database } from './firebase.service';

// Lấy tất cả đơn hàng
export const getAllOrders = async () => {
  try {
    const ordersRef = ref(database, 'orders');
    const snapshot = await get(ordersRef);
    
    if (snapshot.exists()) {
      const ordersData = snapshot.val();
      return Object.keys(ordersData).map(key => ({
        id: key,
        ...ordersData[key]
      }));
    }
    return [];
  } catch (error) {
    console.error('Get orders error:', error);
    throw error;
  }
};

// Lấy đơn hàng theo loại
export const getOrdersByType = async (type) => {
  try {
    const orders = await getAllOrders();
    return orders.filter(order => order.type === type);
  } catch (error) {
    console.error('Get orders by type error:', error);
    throw error;
  }
};

// Lấy đơn hàng theo ID
export const getOrderById = async (orderId) => {
  try {
    const orderRef = ref(database, `orders/${orderId}`);
    const snapshot = await get(orderRef);
    
    if (snapshot.exists()) {
      return {
        id: orderId,
        ...snapshot.val()
      };
    }
    return null;
  } catch (error) {
    console.error('Get order error:', error);
    throw error;
  }
};

// Thêm đơn hàng mới
export const addOrder = async (orderData) => {
  try {
    const ordersRef = ref(database, 'orders');
    const newOrderRef = push(ordersRef);
    
    const order = {
      ...orderData,
      id: newOrderRef.key,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    await set(newOrderRef, order);
    return order;
  } catch (error) {
    console.error('Add order error:', error);
    throw error;
  }
};

// Cập nhật đơn hàng
export const updateOrder = async (orderId, updateData) => {
  try {
    const orderRef = ref(database, `orders/${orderId}`);
    const updates = {
      ...updateData,
      updatedAt: new Date().toISOString()
    };
    
    await update(orderRef, updates);
    return { id: orderId, ...updates };
  } catch (error) {
    console.error('Update order error:', error);
    throw error;
  }
};

// Xóa đơn hàng
export const deleteOrder = async (orderId) => {
  try {
    const orderRef = ref(database, `orders/${orderId}`);
    await remove(orderRef);
  } catch (error) {
    console.error('Delete order error:', error);
    throw error;
  }
};

// Cập nhật trạng thái đơn hàng
export const updateOrderStatus = async (orderId, status) => {
  try {
    return await updateOrder(orderId, { status });
  } catch (error) {
    console.error('Update order status error:', error);
    throw error;
  }
};
