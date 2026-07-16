import { useState, useEffect } from 'react';
import { fetchTableData, deleteTable, fetchSchema } from '../lib/api';
import { motion } from 'framer-motion';
import { Table2, RefreshCw, X, AlertCircle, Trash2 } from 'lucide-react';

export default function TableDataViewer({ tableName, onClose, refreshTrigger = 0, onSwitchTable }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (tableName) {
      loadData();
    }
  }, [tableName, refreshTrigger]);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await fetchTableData(tableName);
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteTable = async () => {
    setIsDeleting(true);
    try {
      await deleteTable(tableName);
      const schema = await fetchSchema();
      if (schema && schema.tables && schema.tables.length > 0) {
        if (onSwitchTable) {
          onSwitchTable(schema.tables[0].name);
          setIsDeleting(false);
          setShowDeleteConfirm(false);
        } else {
          window.location.reload();
        }
      } else {
        window.location.reload();
      }
    } catch (err) {
      alert(err.message || 'Failed to delete table');
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  if (!tableName) return null;

  return (
    <div className="h-full rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-white dark:bg-slate-800 shadow-sm flex flex-col">
      {/* Table Header with Gradient */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-slate-800 dark:to-slate-800 border-b border-slate-200 dark:border-slate-700 px-4 py-3 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <Table2 size={16} /> {tableName}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowDeleteConfirm(true)}
              className="p-1.5 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors text-slate-400 hover:text-red-500"
              title="Delete Active Table"
            >
              <Trash2 size={16} />
            </button>
            <button 
              onClick={loadData}
              className="p-1.5 hover:bg-white/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors text-slate-500 dark:text-slate-400 group"
              title="Refresh data"
            >
              <RefreshCw size={16} className="group-hover:rotate-180 transition-transform duration-500" />
            </button>
            <button 
              onClick={onClose}
              className="p-1.5 hover:bg-white/50 dark:hover:bg-slate-700/50 rounded-lg transition-colors text-slate-500 dark:text-slate-400"
              title="Close"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      </div>
      
      {/* Table - Enhanced Styling */}
      <div className="flex-1 overflow-auto custom-scrollbar relative">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/40 dark:bg-slate-800/40 backdrop-blur-[2px] z-20">
            <div className="w-8 h-8 border-4 border-slate-200 dark:border-slate-700 border-t-blue-500 rounded-full animate-spin mb-3"></div>
            <span className="text-sm font-medium text-slate-600 dark:text-slate-300">Fetching rows...</span>
          </div>
        ) : error ? (
          <div className="p-12 flex flex-col items-center text-center text-red-500">
            <AlertCircle size={40} className="mb-4 opacity-80" />
            <p className="font-medium text-lg">{error}</p>
          </div>
        ) : data && data.data.length > 0 ? (
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/50 sticky top-0 z-10 shadow-sm">
              <tr>
                {data.columns.map((col, idx) => (
                  <th
                    key={idx}
                    className="text-center px-4 py-3 font-semibold text-slate-600 dark:text-slate-400 text-xs uppercase tracking-wider border-b border-slate-200 dark:border-slate-700 whitespace-nowrap bg-slate-50 dark:bg-slate-900"
                  >
                    <div className="flex items-center justify-center gap-2">
                      <span>{col}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.data.map((row, idx) => (
                <tr
                  key={idx}
                  className={`border-b border-slate-100 dark:border-slate-700/50 transition-colors ${
                    idx % 2 === 0
                      ? 'bg-white dark:bg-slate-800/50'
                      : 'bg-slate-50/50 dark:bg-slate-800/30'
                  } hover:bg-blue-50 dark:hover:bg-slate-700/50`}
                >
                  {data.columns.map((column, colIdx) => {
                    const val = row[column];
                    let isNumeric = typeof val === 'number';
                    let displayVal = val;
                    if (val === null) displayVal = <span className="text-slate-400 dark:text-slate-500 italic">NULL</span>;
                    else if (typeof val === 'boolean') displayVal = val ? 'true' : 'false';
                    else if (typeof val === 'object') displayVal = JSON.stringify(val);
                    else if (isNumeric) displayVal = val.toFixed?.(2) || val;
                    
                    return (
                      <td key={colIdx} className="px-4 py-2.5 text-slate-700 dark:text-slate-300 font-medium whitespace-nowrap max-w-[200px] truncate text-center" title={String(val)}>
                        {val !== null && val !== undefined ? (
                          isNumeric ? (
                            <span className="font-mono text-blue-600 dark:text-blue-400">
                              {displayVal}
                            </span>
                          ) : (
                            <span>{displayVal}</span>
                          )
                        ) : (
                          <span className="text-slate-400 dark:text-slate-500">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="p-8 text-center text-slate-500">
            Table is empty.
          </div>
        )}
      </div>
      
      {/* Custom Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 dark:border-slate-700 overflow-hidden"
          >
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
                <AlertCircle size={24} />
              </div>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete Table?</h3>
              <p className="text-slate-600 dark:text-slate-300 text-sm">
                Are you sure you want to completely delete this table? This action cannot be undone.
              </p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 flex justify-center gap-3 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteTable}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm shadow-red-500/20"
              >
                {isDeleting ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Deleting...
                  </>
                ) : (
                  'Delete Table'
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
