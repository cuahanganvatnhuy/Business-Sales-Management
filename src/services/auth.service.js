import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider
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
    const userSnapshot = await get(userRef);
    
    // Lấy thông tin nhân sự từ staffAccounts (nếu có)
    const staffRef = ref(database, `staffAccounts/${user.uid}`);
    const staffSnapshot = await get(staffRef);
    
    if (!userSnapshot.exists()) {
      throw new Error('User data not found');
    }
    
    const userData = userSnapshot.val();
    const staffData = staffSnapshot.exists() ? staffSnapshot.val() : null;
    
    // Kiểm tra trạng thái tài khoản nếu là nhân sự
    if (staffData) {
      if (staffData.status === 'inactive' || staffData.status === 'suspended') {
        throw new Error('Tài khoản đã bị vô hiệu hóa hoặc tạm khóa');
      }
      
      // Kiểm tra thời gian hết hạn của tài khoản
      if (staffData.expirationDate) {
        const expirationDate = new Date(staffData.expirationDate);
        const now = new Date();
        if (expirationDate < now) {
          throw new Error(`Tài khoản đã hết hạn từ ngày ${expirationDate.toLocaleDateString('vi-VN')}`);
        }
      }
      
      // Kiểm tra thời gian hết hạn của cửa hàng
      // Lấy danh sách cửa hàng mà tài khoản có quyền truy cập
      let storeIdsToCheck = [];
      if (staffData.allowedStoreIds) {
        if (staffData.allowedStoreIds === 'all') {
          // Nếu là 'all', cần kiểm tra tất cả cửa hàng
          const storesRef = ref(database, 'stores');
          const storesSnapshot = await get(storesRef);
          if (storesSnapshot.exists()) {
            storeIdsToCheck = Object.keys(storesSnapshot.val());
          }
        } else if (Array.isArray(staffData.allowedStoreIds)) {
          storeIdsToCheck = staffData.allowedStoreIds;
        } else if (staffData.allowedStoreIds) {
          storeIdsToCheck = [staffData.allowedStoreIds];
        }
      } else if (staffData.storeId) {
        storeIdsToCheck = [staffData.storeId];
      }
      
      // Kiểm tra từng cửa hàng
      for (const storeId of storeIdsToCheck) {
        try {
          const storeRef = ref(database, `stores/${storeId}`);
          const storeSnapshot = await get(storeRef);
          if (storeSnapshot.exists()) {
            const storeData = storeSnapshot.val();
            if (storeData.expirationDate) {
              const storeExpirationDate = new Date(storeData.expirationDate);
              const now = new Date();
              if (storeExpirationDate < now) {
                throw new Error(`Cửa hàng "${storeData.name || storeId}" đã hết hạn từ ngày ${storeExpirationDate.toLocaleDateString('vi-VN')}. Tất cả tài khoản thuộc cửa hàng này đã bị khóa.`);
              }
            }
          }
        } catch (error) {
          // Nếu lỗi là về hết hạn, throw lại
          if (error.message.includes('hết hạn')) {
            throw error;
          }
          // Các lỗi khác thì bỏ qua
        }
      }
    }
    
    // Lấy roleIds từ staffAccounts hoặc dùng role từ users
    let roleIds = [];
    if (staffData && staffData.roleIds && Array.isArray(staffData.roleIds)) {
      roleIds = staffData.roleIds;
    } else if (userData.role) {
      // Nếu không có roleIds, thử tìm role từ role name
      const rolesRef = ref(database, 'roles');
      const rolesSnapshot = await get(rolesRef);
      if (rolesSnapshot.exists()) {
        const rolesData = rolesSnapshot.val();
        const roleEntry = Object.entries(rolesData).find(([id, role]) => 
          role.name === userData.role || id === userData.role
        );
        if (roleEntry) {
          roleIds = [roleEntry[0]];
        }
      }
    }
    
    // Load permissions từ tất cả các roles
    let allPermissions = [];
    if (roleIds.length > 0) {
      for (const roleId of roleIds) {
        try {
          const roleRef = ref(database, `roles/${roleId}`);
          const roleSnapshot = await get(roleRef);
          if (roleSnapshot.exists()) {
            const roleData = roleSnapshot.val();
            let permissions = [];
            if (Array.isArray(roleData.permissions)) {
              permissions = roleData.permissions;
            } else if (roleData.permissions && typeof roleData.permissions === 'object') {
              permissions = Object.keys(roleData.permissions).filter(key => roleData.permissions[key]);
            }
            // Merge permissions, loại bỏ trùng lặp
            allPermissions = [...new Set([...allPermissions, ...permissions])];
          }
        } catch (error) {
          console.error(`Error loading role ${roleId}:`, error);
        }
      }
    }
    
    return {
      uid: user.uid,
      email: user.email,
      ...userData,
      ...(staffData ? {
        fullName: staffData.fullName,
        phone: staffData.phone,
        storeId: staffData.storeId,
        allowedStoreIds: staffData.allowedStoreIds || 'all',
        note: staffData.note
      } : {}),
      roleIds,
      permissions: allPermissions
    };
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
      try {
        // Lấy thông tin user từ database
        const userRef = ref(database, `users/${user.uid}`);
        const userSnapshot = await get(userRef);
        
        if (!userSnapshot.exists()) {
          callback(null);
          return;
        }
        
        const userData = userSnapshot.val();
        
        // Lấy thông tin nhân sự từ staffAccounts (nếu có)
        const staffRef = ref(database, `staffAccounts/${user.uid}`);
        const staffSnapshot = await get(staffRef);
        const staffData = staffSnapshot.exists() ? staffSnapshot.val() : null;
        
        // Kiểm tra trạng thái tài khoản nếu là nhân sự
        if (staffData) {
          if (staffData.status === 'inactive' || staffData.status === 'suspended') {
            // Không load dữ liệu nếu tài khoản bị vô hiệu hóa
            callback(null);
            return;
          }
          
          // Kiểm tra thời gian hết hạn của tài khoản
          if (staffData.expirationDate) {
            const expirationDate = new Date(staffData.expirationDate);
            const now = new Date();
            if (expirationDate < now) {
              // Tài khoản đã hết hạn
              callback(null);
              return;
            }
          }
          
          // Kiểm tra thời gian hết hạn của cửa hàng
          let storeIdsToCheck = [];
          if (staffData.allowedStoreIds) {
            if (staffData.allowedStoreIds === 'all') {
              // Nếu là 'all', cần kiểm tra tất cả cửa hàng
              try {
                const storesRef = ref(database, 'stores');
                const storesSnapshot = await get(storesRef);
                if (storesSnapshot.exists()) {
                  storeIdsToCheck = Object.keys(storesSnapshot.val());
                }
              } catch (error) {
                console.error('Error loading stores:', error);
              }
            } else if (Array.isArray(staffData.allowedStoreIds)) {
              storeIdsToCheck = staffData.allowedStoreIds;
            } else if (staffData.allowedStoreIds) {
              storeIdsToCheck = [staffData.allowedStoreIds];
            }
          } else if (staffData.storeId) {
            storeIdsToCheck = [staffData.storeId];
          }
          
          // Kiểm tra từng cửa hàng
          for (const storeId of storeIdsToCheck) {
            try {
              const storeRef = ref(database, `stores/${storeId}`);
              const storeSnapshot = await get(storeRef);
              if (storeSnapshot.exists()) {
                const storeData = storeSnapshot.val();
                if (storeData.expirationDate) {
                  const storeExpirationDate = new Date(storeData.expirationDate);
                  const now = new Date();
                  if (storeExpirationDate < now) {
                    // Cửa hàng đã hết hạn
                    callback(null);
                    return;
                  }
                }
              }
            } catch (error) {
              console.error(`Error checking store ${storeId}:`, error);
            }
          }
        }
        
        // Lấy roleIds từ staffAccounts hoặc dùng role từ users
        let roleIds = [];
        if (staffData && staffData.roleIds && Array.isArray(staffData.roleIds)) {
          roleIds = staffData.roleIds;
        } else if (userData.role) {
          // Nếu không có roleIds, thử tìm role từ role name
          try {
            const rolesRef = ref(database, 'roles');
            const rolesSnapshot = await get(rolesRef);
            if (rolesSnapshot.exists()) {
              const rolesData = rolesSnapshot.val();
              const roleEntry = Object.entries(rolesData).find(([id, role]) => 
                role.name === userData.role || id === userData.role
              );
              if (roleEntry) {
                roleIds = [roleEntry[0]];
              }
            }
          } catch (error) {
            console.error('Error finding role:', error);
          }
        }
        
        // Load permissions từ tất cả các roles
        let allPermissions = [];
        if (roleIds.length > 0) {
          for (const roleId of roleIds) {
            try {
              const roleRef = ref(database, `roles/${roleId}`);
              const roleSnapshot = await get(roleRef);
              if (roleSnapshot.exists()) {
                const roleData = roleSnapshot.val();
                let permissions = [];
                if (Array.isArray(roleData.permissions)) {
                  permissions = roleData.permissions;
                } else if (roleData.permissions && typeof roleData.permissions === 'object') {
                  permissions = Object.keys(roleData.permissions).filter(key => roleData.permissions[key]);
                }
                // Merge permissions, loại bỏ trùng lặp
                allPermissions = [...new Set([...allPermissions, ...permissions])];
              }
            } catch (error) {
              console.error(`Error loading role ${roleId}:`, error);
            }
          }
        }

        callback({
          uid: user.uid,
          email: user.email,
          ...userData,
          ...(staffData ? {
            fullName: staffData.fullName,
            phone: staffData.phone,
            storeId: staffData.storeId,
            allowedStoreIds: staffData.allowedStoreIds || 'all',
            note: staffData.note,
            status: staffData.status
          } : {}),
          roleIds,
          permissions: allPermissions
        });
      } catch (error) {
        console.error('onAuthStateChange error:', error);
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

// Đổi mật khẩu cho user (yêu cầu mật khẩu cũ để xác thực)
export const changeUserPassword = async (email, oldPassword, newPassword) => {
  try {
    if (!oldPassword || !newPassword) {
      throw new Error('Vui lòng nhập đầy đủ mật khẩu cũ và mật khẩu mới');
    }

    const currentUser = auth.currentUser;
    
    // Nếu user hiện tại đang đăng nhập và email khớp, dùng reauthenticate
    if (currentUser && currentUser.email === email) {
      // Reauthenticate với mật khẩu cũ
      const credential = EmailAuthProvider.credential(email, oldPassword);
      await reauthenticateWithCredential(currentUser, credential);
      
      // Đổi mật khẩu mới
      await updatePassword(currentUser, newPassword);
      
      return { success: true };
    } else {
      // Nếu là user khác (admin đổi mật khẩu cho nhân viên)
      // Tạm thời đăng nhập với mật khẩu cũ để xác thực
      const userCredential = await signInWithEmailAndPassword(auth, email, oldPassword);
      const user = userCredential.user;
      
      // Đổi mật khẩu mới
      await updatePassword(user, newPassword);
      
      // Đăng xuất sau khi đổi mật khẩu
      await signOut(auth);
      
      return { success: true };
    }
  } catch (error) {
    console.error('Change password error:', error);
    throw error;
  }
};

// Admin reset password cho user (không cần mật khẩu cũ)
export const adminResetPassword = async (email, newPassword) => {
  try {
    // Firebase không có API trực tiếp để admin đổi mật khẩu user khác
    // Cần dùng Firebase Admin SDK hoặc yêu cầu user reset qua email
    // Tạm thời throw error để thông báo cần dùng Admin SDK
    throw new Error('Chức năng này cần Firebase Admin SDK. Hiện tại vui lòng yêu cầu user đổi mật khẩu tự động qua email.');
  } catch (error) {
    console.error('Admin reset password error:', error);
    throw error;
  }
};
