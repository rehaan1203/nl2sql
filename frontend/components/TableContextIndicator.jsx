import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TableProperties, CheckCircle2, FileText, ChevronDown } from 'lucide-react';

export default function TableContextIndicator({ 
  currentTable, 
  availableTables = [], 
  onSwitchTable,
  className = '' 
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const dropdownRef = useRef(null);
  
  // Auto-close dropdown when switching
  useEffect(() => {
    if (!isSwitching) return;
    const timer = setTimeout(() => setIsSwitching(false), 500);
    return () => clearTimeout(timer);
  }, [isSwitching]);

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);
  
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
    <div className={`relative ${className}`} ref={dropdownRef}>
      {/* Current table display */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
      >
        <TableProperties className="w-4 h-4 text-blue-600 dark:text-blue-400 shrink-0" />
        <span className="font-medium text-blue-700 dark:text-blue-300 text-sm uppercase tracking-wider truncate max-w-[120px]">
          {currentTable}
        </span>
        <span className="text-xs text-blue-500 dark:text-blue-400 ml-1 shrink-0">
          {availableTables.length} tables
        </span>
        <ChevronDown className={`w-4 h-4 text-blue-500 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {/* Dropdown for table switching */}
      <AnimatePresence>
        {isOpen && availableTables.length > 1 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-full left-0 mb-2 min-w-[18rem] w-auto max-w-sm bg-white dark:bg-slate-800 rounded-lg shadow-lg border border-slate-200 dark:border-slate-700 overflow-hidden z-50 flex flex-col"
          >
            <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/95">
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                Switch to another table:
              </p>
            </div>
            <div className="max-h-60 overflow-y-auto overflow-x-hidden p-2">
              {availableTables.map((table) => (
                <button
                  key={table}
                  onClick={() => handleSwitch(table)}
                  disabled={isSwitching}
                  className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2 mb-1 last:mb-0 ${
                    table === currentTable
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
                      : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="shrink-0">
                    {table === currentTable ? (
                      <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <FileText className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                  <span className="uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis flex-1">{table}</span>
                  {table === currentTable && (
                    <span className="ml-2 text-xs text-blue-500 dark:text-blue-400 shrink-0">(current)</span>
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
