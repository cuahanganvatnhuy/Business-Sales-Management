import React, { createContext, useContext, useState, useEffect } from 'react';
import { message, Modal, Spin } from 'antd';
import { CheckCircleOutlined, LoadingOutlined } from '@ant-design/icons';

const StoreContext = createContext();

export const useStore = () => {
  const context = useContext(StoreContext);
  if (!context) {
    throw new Error('useStore must be used within a StoreProvider');
  }
  return context;
};

export const StoreProvider = ({ children }) => {
  const [selectedStore, setSelectedStore] = useState(null);
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [switching, setSwitching] = useState(false);

  // Load selected store from localStorage on mount
  useEffect(() => {
    const savedStoreId = localStorage.getItem('selectedStoreId');
    const savedStoreName = localStorage.getItem('selectedStoreName');
    const justSwitched = localStorage.getItem('justSwitchedStore');
    
    if (savedStoreId && savedStoreName) {
      setSelectedStore({
        id: savedStoreId,
        name: savedStoreName
      });
      
      // Show success modal if just switched
      if (justSwitched === 'true') {
        setTimeout(() => {
          const modal = Modal.success({
            title: null,
            icon: null,
            centered: true,
            closable: false,
            maskClosable: false,
            content: (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <CheckCircleOutlined style={{ fontSize: 64, color: '#52c41a', marginBottom: 16 }} />
                <h2 style={{ fontSize: 20, fontWeight: 600, color: '#333', margin: 0 }}>
                  Chuyển thành công!
                </h2>
                <p style={{ fontSize: 16, color: '#666', marginTop: 12 }}>
                  Đã chuyển sang cửa hàng: <strong>{savedStoreName}</strong>
                </p>
              </div>
            ),
            footer: null,
            width: 400
          });
          
          // Auto close after 2 seconds
          setTimeout(() => {
            modal.destroy();
            localStorage.removeItem('justSwitchedStore');
          }, 2000);
        }, 300);
      }
    }
    setLoading(false);
  }, []);

  // Select store and save to localStorage with loading and notification
  const selectStore = (store, showNotification = true) => {
    if (store) {
      setSwitching(true);
      
      // Save to localStorage first
      setSelectedStore(store);
      localStorage.setItem('selectedStoreId', store.id);
      localStorage.setItem('selectedStoreName', store.name);
      
      // Show loading modal and reload page
      setTimeout(() => {
        if (showNotification) {
          // Set flag for showing success message after reload
          localStorage.setItem('justSwitchedStore', 'true');
          
          // Show loading modal
          Modal.info({
            title: null,
            icon: null,
            centered: true,
            closable: false,
            maskClosable: false,
            content: (
              <div style={{ textAlign: 'center', padding: '20px 0' }}>
                <Spin 
                  indicator={<LoadingOutlined style={{ fontSize: 48 }} spin />}
                  size="large"
                  style={{ marginBottom: 16 }}
                />
                <h2 style={{ fontSize: 20, fontWeight: 600, color: '#333', margin: 0, marginTop: 16 }}>
                  Đang chuyển...
                </h2>
                <p style={{ fontSize: 16, color: '#666', marginTop: 12 }}>
                  Đang chuyển sang cửa hàng: <strong>{store.name}</strong>
                </p>
              </div>
            ),
            footer: null,
            width: 400
          });
          
          // Reload page after 1.5 seconds
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        } else {
          setSwitching(false);
        }
      }, 200);
    } else {
      setSelectedStore(null);
      localStorage.removeItem('selectedStoreId');
      localStorage.removeItem('selectedStoreName');
    }
  };

  // Clear store selection (for logout)
  const clearStore = () => {
    setSelectedStore(null);
    localStorage.removeItem('selectedStoreId');
    localStorage.removeItem('selectedStoreName');
  };

  const value = {
    selectedStore,
    selectStore,
    clearStore,
    stores,
    setStores,
    loading,
    switching
  };

  return (
    <StoreContext.Provider value={value}>
      {children}
    </StoreContext.Provider>
  );
};
