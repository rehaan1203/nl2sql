// frontend/components/ToastContainer.jsx

import { AnimatePresence, motion } from 'framer-motion';
import { useWindowSize } from '../hooks/useWindowSize';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';

export default function ToastContainer({ toasts, onRemove }) {
  const { isMobile } = useWindowSize();
  const positionClasses = isMobile ? 'bottom-4 left-4 right-4' : 'bottom-4 right-4 max-w-md';

  return (
    <div className={`fixed z-50 flex flex-col gap-2 ${positionClasses}`}>
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.9 }}
            className={`
              px-4 py-3 rounded-xl shadow-lg border flex items-start gap-3
              ${toast.type === 'error' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : ''}
              ${toast.type === 'success' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' : ''}
              ${toast.type === 'warning' ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' : ''}
              ${toast.type === 'info' ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' : ''}
            `}
          >
            <span className="flex-shrink-0 mt-0.5">
              {toast.type === 'error' && <XCircle size={20} className="text-red-500" />}
              {toast.type === 'success' && <CheckCircle size={20} className="text-green-500" />}
              {toast.type === 'warning' && <AlertTriangle size={20} className="text-amber-500" />}
              {toast.type === 'info' && <Info size={20} className="text-blue-500" />}
            </span>
            <div className="flex-1">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                {toast.title}
              </p>
              {toast.message && (
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  {toast.message}
                </p>
              )}
            </div>
            <button
              onClick={() => onRemove(toast.id)}
              className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
