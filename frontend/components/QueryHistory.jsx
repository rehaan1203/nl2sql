'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trash2, PlayCircle, MessageSquare, AlertCircle, X, Check, History, Table, Database } from 'lucide-react';

export default function QueryHistory({ history, onSelect, onClearHistory }) {
  const [showConfirmClear, setShowConfirmClear] = useState(false);
  // A helper function to display relative time
  const formatTimeAgo = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now - date) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return `${Math.floor(diffInSeconds / 86400)}d ago`;
  };

  return (
    <div className="h-full flex flex-col bg-transparent w-full transition-colors">
      <div className="p-5 border-b border-white/20 dark:border-slate-700/30 flex items-center justify-between bg-transparent transition-colors">
        <h2 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <History size={14} className="text-white" strokeWidth={2.5} />
          </div>
          Query History
        </h2>
        <span className="px-2 py-0.5 bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 text-xs font-bold tracking-wider rounded-full border border-indigo-100 dark:border-indigo-800/50">
          {history.length}
        </span>
      </div>

      <div className="flex-grow overflow-y-auto px-2 py-3 custom-scrollbar">
        {history.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-slate-400 dark:text-slate-500 text-center gap-3">
            <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-900 flex items-center justify-center border border-slate-200 dark:border-slate-800 shadow-sm transition-colors">
              🕐
            </div>
            <div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No queries yet.</p>
              <p className="text-xs mt-1">Run your first query!</p>
            </div>
          </div>
        ) : (
          <motion.div 
            className="space-y-3"
            initial="hidden"
            animate="visible"
            variants={{
              visible: { transition: { staggerChildren: 0.05 } }
            }}
          >
            <AnimatePresence>
              {history.map((item) => (
                <motion.div
                  key={item.id}
                  variants={{
                    hidden: { opacity: 0, x: -20 },
                    visible: { opacity: 1, x: 0 }
                  }}
                  initial="hidden"
                  animate="visible"
                  exit={{ opacity: 0, scale: 0.95 }}
                  whileHover={{ scale: 1.02, y: -2 }}
                  className={`relative px-3 py-3 rounded-xl cursor-pointer group transition-all duration-300 border overflow-hidden ${
                    item.success === false 
                      ? 'border-red-200/50 dark:border-red-900/50 bg-red-50/40 dark:bg-red-900/20 hover:shadow-[0_4px_15px_rgba(239,68,68,0.1)] hover:border-red-300 dark:hover:border-red-700' 
                      : 'border-white/40 dark:border-slate-700/50 bg-white/50 dark:bg-slate-800/50 hover:shadow-[0_4px_15px_rgba(99,102,241,0.15)] hover:border-indigo-200 dark:hover:border-indigo-700/50'
                  }`}
                  onClick={() => {
                    if (onSelect) onSelect(item);
                  }}
                >
                  {/* Subtle left glow for success/fail */}
                  <div className={`absolute left-0 top-0 bottom-0 w-1 ${item.success === false ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]'} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                  
                  <div className="flex items-start gap-3 mb-2">
                    {item.presentation_mode === 'chatbot' ? (
                      <MessageSquare size={14} className={item.success === false ? "text-red-500 mt-0.5 flex-shrink-0" : "text-indigo-500 mt-0.5 flex-shrink-0"} />
                    ) : (
                      <Table size={14} className={item.success === false ? "text-red-500 mt-0.5 flex-shrink-0" : "text-indigo-500 mt-0.5 flex-shrink-0"} />
                    )}
                    <p className="text-sm text-slate-700 dark:text-slate-300 font-medium line-clamp-2 break-all leading-snug tracking-tight">
                      {item.natural_language}
                    </p>
                  </div>
                  
                  {item.database_name && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1 ml-6">
                      <Database size={12} />
                      <span className="truncate">{item.database_name}</span>
                    </div>
                  )}
                  
                  <div className="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-200/50 dark:border-slate-700/50">
                    <span className="font-medium opacity-80">{formatTimeAgo(item.created_at)}</span>
                    <div className="flex items-center gap-2">
                      {item.success !== false ? (
                        <span className="px-2 py-0.5 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 rounded-md text-xs font-bold tracking-wider uppercase border border-emerald-100/50 dark:border-emerald-800/30">
                          {item.row_count || 0} rows
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 rounded-md text-xs font-bold tracking-wider uppercase border border-red-100/50 dark:border-red-800/30">
                          Failed
                        </span>
                      )}
                      <PlayCircle size={14} className="text-slate-300 dark:text-slate-600 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors ml-1" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </div>

      {history.length > 0 && (
        <div className="p-4 border-t border-white/20 dark:border-slate-700/30 bg-transparent transition-colors">
          {showConfirmClear ? (
            <div className="flex flex-col gap-2">
              <div className="text-sm font-medium text-slate-700 dark:text-slate-300 text-center flex items-center justify-center gap-2 mb-2">
                <AlertCircle size={16} className="text-red-500" />
                Clear all query history?
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShowConfirmClear(false)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md transition-colors"
                >
                  <X size={16} /> Cancel
                </button>
                <button
                  onClick={() => {
                    setShowConfirmClear(false);
                    onClearHistory();
                  }}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors shadow-sm"
                >
                  <Check size={16} /> Confirm
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowConfirmClear(true)}
              className="w-full flex items-center justify-center gap-2 py-1.5 text-sm font-medium text-red-600 dark:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-900/50"
            >
              <Trash2 size={14} />
              Clear History
            </button>
          )}
        </div>
      )}
    </div>
  );
}
