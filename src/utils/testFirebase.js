import { ref, set, get } from 'firebase/database';
import { database } from '../services/firebase.service';

// Test Firebase Connection
export const testFirebaseConnection = async () => {
  try {
    console.log('🔄 Đang kiểm tra kết nối Firebase...');
    
    // Test write
    const testRef = ref(database, 'test/connection');
    await set(testRef, {
      message: 'Kết nối thành công!',
      timestamp: new Date().toISOString(),
      status: 'connected'
    });
    
    console.log('✅ Ghi dữ liệu thành công!');
    
    // Test read
    const snapshot = await get(testRef);
    if (snapshot.exists()) {
      console.log('✅ Đọc dữ liệu thành công!');
      console.log('📊 Dữ liệu:', snapshot.val());
      return {
        success: true,
        message: '🎉 Firebase đã kết nối thành công!',
        data: snapshot.val()
      };
    } else {
      throw new Error('Không thể đọc dữ liệu');
    }
  } catch (error) {
    console.error('❌ Lỗi kết nối Firebase:', error);
    return {
      success: false,
      message: '❌ Kết nối Firebase thất bại!',
      error: error.message
    };
  }
};
