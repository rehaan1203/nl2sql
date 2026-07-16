'use client';

import { XCircle, AlertTriangle, Database } from 'lucide-react';

export default function QueryErrorDisplay({ error, onRetry, isBackendReachable }) {
  if (!error) return null;

  // Check if it's a hallucination error (contains " | " from validate_tables_exist)
  const isHallucination = typeof error === 'string' && error.includes(' | ');
  
  if (isHallucination) {
    const parts = error.split(' | ');
    const notFound = parts[0];
    const available = parts[1];
    
    return (
      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800/50 rounded-xl p-4 flex flex-col gap-2 shadow-sm">
        <div className="flex items-center gap-2 text-orange-800 dark:text-orange-300 font-medium">
          <AlertTriangle size={18} />
          <span>AI Hallucination Detected</span>
        </div>
        <p className="text-orange-700 dark:text-orange-400 text-sm">{notFound.replace('❌ ', '')}</p>
        <p className="text-orange-600/80 dark:text-orange-400/80 text-sm">{available.replace('✅ ', '')}</p>
        {onRetry && (
          <button 
            onClick={onRetry}
            className="mt-2 self-start px-3 py-1.5 bg-orange-100 dark:bg-orange-800/40 hover:bg-orange-200 dark:hover:bg-orange-700/50 text-orange-700 dark:text-orange-300 rounded-lg text-sm font-medium transition-colors"
          >
            Try asking differently
          </button>
        )}
      </div>
    );
  }

  // Check for auto-switch or cross-table errors
  if (typeof error === 'object' && error.error_type === 'cross_table_query') {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-xl p-4 flex flex-col gap-2 shadow-sm">
        <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-medium">
          <Database size={18} />
          <span>Cross-Table Query Detected</span>
        </div>
        <p className="text-blue-700 dark:text-blue-400 text-sm">{error.error}</p>
        <p className="text-blue-600/80 dark:text-blue-400/80 text-sm">You asked about '{error.suggested_tables?.join(', ')}' but are currently viewing '{error.current_table}'.</p>
      </div>
    );
  }

  // Default error display
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-xl p-4 flex items-center justify-between shadow-sm w-full">
      <div className="flex items-center gap-3">
        <XCircle className="text-red-500" size={20} />
        <p className="text-red-800 dark:text-red-300 text-sm font-medium">
          {typeof error === 'string' ? error : error.message || 'An error occurred'}
        </p>
      </div>
      {!isBackendReachable && onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors shadow-sm"
        >
          Retry Connection
        </button>
      )}
    </div>
  );
}
