'use client';

import { Toaster } from 'react-hot-toast';

export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        style: {
          background: '#fff',
          color: '#0f172a',
          border: '1px solid #e2e8f0',
          borderRadius: '8px',
          padding: '12px 16px',
        },
        success: {
          icon: '✅',
          style: {
            background: '#f0fdf4',
            borderColor: '#86efac',
          },
        },
        error: {
          icon: '❌',
          style: {
            background: '#fef2f2',
            borderColor: '#fca5a5',
          },
        },
      }}
    />
  );
}
