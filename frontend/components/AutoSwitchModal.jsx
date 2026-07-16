import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shuffle, ArrowRight, RefreshCcw, Lock } from 'lucide-react';

export default function AutoSwitchModal({ 
  isOpen, 
  onClose, 
  onSwitch, 
  onForceCurrent,
  message, 
  currentTable,
  suggestedTables 
}) {
  if (!isOpen) return null;
  
  const displaySuggested = suggestedTables?.filter(t => t !== currentTable)?.[0] || 'Combined';
  
  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, y: 20 }}
          animate={{ scale: 1, y: 0 }}
          exit={{ scale: 0.95, y: 20 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 border border-slate-200 dark:border-slate-700"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-4 bg-blue-100 dark:bg-blue-900/30 rounded-full text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/50">
                <Shuffle size={32} />
              </div>
            </div>
            <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">
              Multi-Table Query Detected
            </h3>
            <p className="text-slate-600 dark:text-slate-400 text-sm mb-4">
              {message || "This question requires data from multiple tables."}
            </p>
            
            <div className="flex flex-col items-center justify-center gap-2 mb-4 text-sm bg-slate-50 dark:bg-slate-900/50 p-4 rounded-xl border border-slate-100 dark:border-slate-700/50">
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-slate-200 dark:bg-slate-700 rounded text-slate-700 dark:text-slate-300 font-mono text-xs">
                  {currentTable}
                </span>
                <ArrowRight size={16} className="text-slate-400" />
                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 rounded text-blue-700 dark:text-blue-300 font-medium font-mono text-xs border border-blue-200 dark:border-blue-800/50">
                  {displaySuggested}
                </span>
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 mt-2">
                Tables needed: {suggestedTables?.join(', ') || 'Multiple tables'}
              </div>
            </div>
            
            <div className="flex flex-col gap-3">
              <button
                onClick={onSwitch}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-blue-500/25 transition-all text-sm"
              >
                <div className="flex items-center justify-center gap-2">
                  <RefreshCcw size={16} /> Switch and Retry
                </div>
              </button>
              <div className="flex gap-3">
                <button
                  onClick={onForceCurrent}
                  className="flex-1 px-4 py-2.5 bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800/50 rounded-xl font-medium hover:bg-amber-200 dark:hover:bg-amber-800/40 transition-all text-sm"
                >
                  <div className="flex items-center justify-center gap-2">
                    <Lock size={16} /> Force Current
                  </div>
                </button>
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition-all text-sm"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
