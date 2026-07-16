// frontend/hooks/useToast.js

import { useState, useCallback } from 'react';

export function useToast() {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback(({ type, title, message, duration = 3000 }) => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, type, title, message }]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const clearToasts = useCallback(() => {
    setToasts([]);
  }, []);

  return {
    toasts,
    addToast,
    removeToast,
    clearToasts,
    success: (title, message, duration) => 
      addToast({ type: 'success', title, message, duration }),
    error: (title, message, duration) => 
      addToast({ type: 'error', title, message, duration }),
    warning: (title, message, duration) => 
      addToast({ type: 'warning', title, message, duration }),
    info: (title, message, duration) => 
      addToast({ type: 'info', title, message, duration }),
  };
}
