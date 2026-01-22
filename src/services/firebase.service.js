import { initializeApp, getApps, getApp, deleteApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getDatabase } from 'firebase/database';
import firebaseConfig from '../config/firebase.config';

// Hàm validate Firebase Database URL
const isValidDatabaseURL = (url) => {
  if (!url || typeof url !== 'string') {
    console.log('❌ URL không hợp lệ (null hoặc không phải string):', url);
    return false;
  }
  
  const trimmedUrl = url.trim();
  
  // Kiểm tra format URL Firebase Realtime Database
  // Format hợp lệ: https://<project-id>-default-rtdb.<region>.firebasedatabase.app
  // hoặc: https://<project-id>.firebaseio.com
  // Region có thể chứa: chữ, số, dấu gạch ngang (ví dụ: asia-southeast1, us-central1)
  const firebaseUrlPattern1 = /^https:\/\/[a-zA-Z0-9-]+-default-rtdb\.[a-zA-Z0-9-]+\.firebasedatabase\.app\/?$/;
  const firebaseUrlPattern2 = /^https:\/\/[a-zA-Z0-9-]+\.firebaseio\.com\/?$/;
  
  const result = firebaseUrlPattern1.test(trimmedUrl) || firebaseUrlPattern2.test(trimmedUrl);
  
  if (!result) {
    console.log('❌ URL không khớp pattern:', trimmedUrl);
    console.log('❌ Pattern 1 test:', firebaseUrlPattern1.test(trimmedUrl));
    console.log('❌ Pattern 2 test:', firebaseUrlPattern2.test(trimmedUrl));
  }
  
  return result;
};

// Hàm load cấu hình từ localStorage (được lưu từ Settings page)
const loadCustomConfigFromStorage = () => {
  try {
    const configStr = localStorage.getItem('firebase_custom_config');
    console.log('🔍 Đang load config từ localStorage...');
    
    if (!configStr) {
      console.log('ℹ️ Không tìm thấy firebase_custom_config trong localStorage');
      return null;
    }
    
    console.log('📦 Config string từ localStorage:', configStr.substring(0, 100) + '...');
    
    const config = JSON.parse(configStr);
    console.log('📋 Config đã parse:', {
      hasDatabaseUrl: !!config.databaseUrl,
      hasApiKey: !!config.apiKey,
      hasProjectId: !!config.projectId,
      databaseUrl: config.databaseUrl,
      projectId: config.projectId
    });
    
    // Kiểm tra xem có đủ thông tin không
    if (!config.databaseUrl || !config.apiKey || !config.projectId) {
      console.error('❌ Config thiếu thông tin bắt buộc:', {
        hasDatabaseUrl: !!config.databaseUrl,
        hasApiKey: !!config.apiKey,
        hasProjectId: !!config.projectId
      });
      return null;
    }
    
    // Validate Database URL format
    if (!isValidDatabaseURL(config.databaseUrl)) {
      console.error('❌ Database URL không hợp lệ:', config.databaseUrl);
      console.log('⚠️ Xóa cấu hình sai và sử dụng config mặc định');
      localStorage.removeItem('firebase_custom_config');
      return null;
    }
    
    const firebaseConfig = {
      apiKey: config.apiKey,
      authDomain: config.authDomain || `${config.projectId}.firebaseapp.com`,
      databaseURL: config.databaseUrl.trim(),
      projectId: config.projectId,
      storageBucket: config.storageBucket || `${config.projectId}.appspot.com`,
      messagingSenderId: config.messagingSenderId || '',
      appId: config.appId || ''
    };
    
    console.log('✅ Config hợp lệ, sẽ sử dụng:', {
      databaseURL: firebaseConfig.databaseURL,
      projectId: firebaseConfig.projectId
    });
    
    return firebaseConfig;
  } catch (error) {
    console.error('❌ Error loading custom config from localStorage:', error);
    console.error('❌ Error details:', error.message, error.stack);
    // Xóa config lỗi
    localStorage.removeItem('firebase_custom_config');
    return null;
  }
};

// Hàm xóa tất cả Firebase apps cũ
const clearOldFirebaseApps = () => {
  try {
    const existingApps = getApps();
    console.log('🔍 Tìm thấy', existingApps.length, 'Firebase app(s) đã khởi tạo');
    
    // Xóa tất cả apps cũ (đồng bộ)
    for (const existingApp of existingApps) {
      try {
        deleteApp(existingApp);
        console.log('🗑️ Đã xóa Firebase app:', existingApp.name || '[DEFAULT]');
      } catch (error) {
        // Nếu app đang được sử dụng, bỏ qua
        console.warn('⚠️ Không thể xóa app:', existingApp.name, error.message);
      }
    }
    
    // Xóa các localStorage keys cũ của Firebase
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith('firebase:host:')) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach(key => {
      localStorage.removeItem(key);
      console.log('🗑️ Đã xóa localStorage key:', key);
    });
  } catch (error) {
    console.warn('⚠️ Lỗi khi xóa Firebase apps cũ:', error);
  }
};

// Khởi tạo Firebase với cấu hình phù hợp
let app;
let auth;
let database;

// Load cấu hình tùy chỉnh từ localStorage
const customConfig = loadCustomConfigFromStorage();

// Xóa apps cũ trước khi khởi tạo app mới
clearOldFirebaseApps();

if (customConfig) {
  try {
    console.log('🔄 Khởi tạo Firebase với config tùy chỉnh...');
    // Khởi tạo app với cấu hình tùy chỉnh
    app = initializeApp(customConfig, 'custom');
    auth = getAuth(app);
    database = getDatabase(app);
    console.log('✅ Đã sử dụng cấu hình database tùy chỉnh từ localStorage');
    console.log('📊 Database URL:', customConfig.databaseURL);
    console.log('📊 Project ID:', customConfig.projectId);
  } catch (error) {
    console.error('❌ Error initializing custom Firebase app:', error);
    console.log('⚠️ Xóa cấu hình sai và sử dụng config mặc định');
    // Xóa config sai
    localStorage.removeItem('firebase_custom_config');
    // Fallback về config mặc định
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    database = getDatabase(app);
    console.log('ℹ️ Sử dụng cấu hình database mặc định (do lỗi load custom config)');
  }
} else {
  // Sử dụng config mặc định
  try {
    console.log('🔄 Khởi tạo Firebase với config mặc định...');
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    database = getDatabase(app);
    console.log('ℹ️ Sử dụng cấu hình database mặc định');
  } catch (error) {
    console.error('Error initializing default Firebase app:', error);
    throw error;
  }
}

// Export services
export { auth, database };
export default app;
