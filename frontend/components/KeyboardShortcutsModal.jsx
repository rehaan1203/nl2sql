// frontend/components/KeyboardShortcutsModal.jsx

import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Keyboard, X } from 'lucide-react';

export default function KeyboardShortcutsModal({ isOpen, onClose }) {
  const modalRef = useRef(null);
  
  useEffect(() => {
    if (isOpen) {
      // Trap focus inside modal
      const focusableElements = modalRef.current?.querySelectorAll('button, [tabindex], input, select, textarea, a[href]');
      if (focusableElements?.length) {
        focusableElements[0].focus();
      }
      
      const handleTabKey = (e) => {
        if (e.key === 'Tab') {
          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];
          
          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }
        }
      };
      
      document.addEventListener('keydown', handleTabKey);
      return () => document.removeEventListener('keydown', handleTabKey);
    }
  }, [isOpen]);

  if (!isOpen) return null;
  
  const shortcuts = [
    { keys: ['Enter'], description: 'Run query' },
    { keys: ['Ctrl', 'K'], description: 'Focus search input' },
    { keys: ['Ctrl', 'S'], description: 'Toggle schema sidebar' },
    { keys: ['Ctrl', 'H'], description: 'Toggle history sidebar' },
    { keys: ['Ctrl', 'Shift', 'C'], description: 'Clear results' },
    { keys: ['Ctrl', 'Shift', 'N'], description: 'New conversation thread' },
    { keys: ['Ctrl', 'Shift', 'D'], description: 'Toggle dark mode' },
    { keys: ['Ctrl', 'Shift', 'E'], description: 'Export results' },
    { keys: ['Ctrl', '/'], description: 'Show keyboard shortcuts' },
    { keys: ['Esc'], description: 'Close modal' },
  ];
  
  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div 
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 relative z-10"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="shortcuts-modal-title"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 id="shortcuts-modal-title" className="text-xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <Keyboard size={20} className="text-blue-500" /> Keyboard Shortcuts
              </h2>
              <button
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 focus:ring-2 focus:ring-blue-500 rounded p-1"
                aria-label="Close modal"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-2">
              {shortcuts.map(({ keys, description }) => (
                <div 
                  key={description}
                  className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0"
                >
                  <span className="text-sm text-slate-600 dark:text-slate-400">
                    {description}
                  </span>
                  <div className="flex items-center gap-1">
                    {keys.map((key, index) => (
                      <span key={key}>
                        {index > 0 && <span className="text-slate-400 mx-1">+</span>}
                        <kbd className="px-2 py-1 bg-slate-100 dark:bg-slate-700 rounded text-xs font-mono text-slate-700 dark:text-slate-300">
                          {key}
                        </kbd>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="mt-4 text-xs text-slate-400 dark:text-slate-500 text-center">
              Press <kbd className="px-1 py-0.5 bg-slate-100 dark:bg-slate-700 rounded">Ctrl+/</kbd> to reopen
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
