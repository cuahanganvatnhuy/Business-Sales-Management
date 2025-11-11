import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword
} from 'firebase/auth';
import { ref, set, get } from 'firebase/database';
import { auth, database } from './firebase.service';

// Đăng nhập
export const login = async (email, password) => {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Lấy thông tin user từ database
    const userRef = ref(database, `users/${user.uid}`);
    const snapshot = await get(userRef);
    
    if (snapshot.exists()) {
      return {
        uid: user.uid,
        email: user.email,
        ...snapshot.val()
      };
    } else {
      throw new Error('User data not found');
    }
  } catch (error) {
    console.error('Login error:', error);
    throw error;
  }
};

// Đăng xuất
export const logout = async () => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Logout error:', error);
    throw error;
  }
};

// Tạo tài khoản mới
export const register = async (email, password, userData) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    // Lưu thông tin user vào database
    await set(ref(database, `users/${user.uid}`), {
      email: user.email,
      displayName: userData.displayName || '',
      role: userData.role || 'staff',
      status: 'active',
      createdAt: new Date().toISOString()
    });
    
    return user;
  } catch (error) {
    console.error('Register error:', error);
    throw error;
  }
};

// Lắng nghe trạng thái đăng nhập
export const onAuthStateChange = (callback) => {
  return onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Lấy thông tin user từ database
      const userRef = ref(database, `users/${user.uid}`);
      const snapshot = await get(userRef);
      
      if (snapshot.exists()) {
        callback({
          uid: user.uid,
          email: user.email,
          ...snapshot.val()
        });
      } else {
        callback(null);
      }
    } else {
      callback(null);
    }
  });
};

// Kiểm tra quyền admin
export const isAdmin = (user) => {
  return user && user.role === 'admin';
};

// Kiểm tra quyền manager
export const isManager = (user) => {
  return user && (user.role === 'admin' || user.role === 'manager');
};
