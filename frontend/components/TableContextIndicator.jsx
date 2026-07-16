import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function TableContextIndicator({ 
  currentTable, 
  availableTables = [], 
  onSwitchTable,
  className = '' 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  
  // Auto-close dropdown when switching
  useEffect(() => {
    if (!isSwitching) return;
    const timer = setTimeout(() => setIsSwitching(false), 500);
    return () => clearTimeout(timer);
  }, [isSwitching]);
  
  if (!currentTable) {
    return null;
  }
  
  const handleSwitch = (tableName) => {
    if (tableName === currentTable) return;
    setIsSwitching(true);
    if (onSwitchTable) onSwitchTable(tableName);
    setIsOpen(false);
  };
  
  return (
    <div className={`relative ${className}`}>
      {/* Current table display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
      >
        <span className="text-blue-600 dark:text-blue-400">📋</span>
        <span className="font-medium text-blue-700 dark:text-blue-300 text-sm uppercase tracking-wider">
          {currentTable}
        </span>
        <span className="text-xs text-blue-500 dark:text-blue-400 ml-1">
          {availableTables.length} tables
        </span>
        <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {/* Dropdown for table switching */}
      <AnimatePresence>
        {isOpen && availableTables.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute top-full left-0 mt-1 w-56 bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50"
          >
            <div className="p-2">
              <p className="text-xs text-slate-500 dark:text-slate-400 px-2 py-1">
                Switch to another table:
              </p>
              {availableTables.map((table) => (
                <button
                  key={table}
                  onClick={() => handleSwitch(table)}
                  disabled={isSwitching}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 ${
                    table === currentTable
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <span>{table === currentTable ? '✅' : '📄'}</span>
                  <span className="uppercase tracking-wider">{table}</span>
                  {table === currentTable && (
                    <span className="ml-auto text-xs text-blue-500 dark:text-blue-400">(current)</span>
                  )}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Loading state during switch */}
      {isSwitching && (
        <div className="inline-flex items-center gap-2 ml-2 text-xs text-slate-500 dark:text-slate-400 absolute left-full top-1/2 -translate-y-1/2 ml-3">
          <div className="w-3 h-3 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          Switching...
        </div>
      )}
    </div>
  );
}
