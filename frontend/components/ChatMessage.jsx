import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lightbulb, Code2, Copy, RefreshCw } from 'lucide-react';
import DataTable from './DataTable';
import EnhancedChartView from './EnhancedChartView';
import SQLEditor from './SQLEditor';
import AutoFixBadge from './AutoFixBadge';
import RetryButton from './RetryButton';
import { formatTimeAgo } from '../utils/timeUtils';

export default function ChatMessage({
  type, // 'user' or 'assistant'
  content,
  timestamp,
  result, // Query result data
  error,
  isStreaming = false,
  onRegenerate,
  onRetry,
  originalQuery,
  suggestedFix
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
  };

  if (type === 'user') {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex justify-end mb-4"
      >
        <div className="max-w-[80%] bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm">
          <p className="text-sm">{content}</p>
          {timestamp && (
            <span className="text-[10px] text-blue-200 mt-1 block text-right">
              {formatTimeAgo(timestamp)}
            </span>
          )}
        </div>
      </motion.div>
    );
  }

  // Assistant Message
  const hasData = result?.data && result.data.length > 0;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex justify-start mb-6"
    >
      <div className="w-full max-w-[90%] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-sm px-5 py-4 shadow-sm">
        
        {/* Header / Avatar */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 flex items-center justify-center text-white text-xs font-bold shadow-inner">
              AI
            </div>
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
              Assistant
            </span>
            {timestamp && (
              <span className="text-xs text-slate-400">
                • {formatTimeAgo(timestamp)}
              </span>
            )}
          </div>
          
          {/* Action Buttons */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
              title="Copy response"
            >
              <Copy size={14} />
            </button>
            {onRegenerate && (
              <button
                onClick={onRegenerate}
                className="p-1.5 text-slate-400 hover:text-blue-500 transition-colors rounded-md hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Regenerate"
              >
                <RefreshCw size={14} />
              </button>
            )}
          </div>
        </div>
        
        {/* Main Content */}
        <div className="space-y-4 pl-9">
          
          {/* Error Message & Retry */}
          {error && (
            <div className="mb-2">
              <p className="text-sm text-red-700 dark:text-red-300 mb-2">{content}</p>
              <RetryButton
                originalQuery={originalQuery || content}
                error={error}
                onRetry={onRetry}
                suggestedFix={suggestedFix}
              />
            </div>
          )}
          
          {/* Auto-fix badge */}
          {result?.auto_fix_applied && (
            <AutoFixBadge
              originalSql={result.original_sql}
              fixedSql={result.sql}
            />
          )}

          {/* Explanation */}
          {!error && content && (
            <div className="flex items-start gap-3">
              <div className="text-yellow-500 mt-0.5">
                <Lightbulb size={18} />
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                {content}
              </p>
            </div>
          )}
          
          {/* SQL Query Toggle */}
          {result?.sql && (
            <div className="mt-2">
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="text-xs flex items-center gap-1.5 text-slate-500 hover:text-blue-600 transition-colors font-medium"
              >
                <Code2 size={14} />
                {isExpanded ? 'Hide SQL Query' : 'View SQL Query'}
              </button>
              
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mt-3 overflow-hidden"
                  >
                    <SQLEditor sql={result.sql} readOnly={true} executionTime={result.execution_time_ms} />
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          
          {/* Visualization (Chart / Table) */}
          {hasData && result.operation_type === 'SELECT' && (
             <div className="mt-4 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden">
                {/* Default to EnhancedChartView which will show either chart or table depending on data */}
                <div className="p-1 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-2">
                   <span className="text-xs font-semibold px-2 text-slate-500">Results</span>
                   <span className="text-xs text-slate-400 bg-white dark:bg-slate-800 px-2 py-0.5 rounded-full border border-slate-200 dark:border-slate-700">
                     {result.row_count} rows
                   </span>
                </div>
                <div className="p-3">
                   {/* Depending on how complex the data is, render the table or chart. For simplicity, we just use DataTable here as a fallback or if no chart is applicable. EnhancedChartView typically wraps Recharts. */}
                   {result.columns && result.columns.length <= 2 ? (
                      <EnhancedChartView data={result.data} columns={result.columns} />
                   ) : (
                      <DataTable data={result.data} columns={result.columns} />
                   )}
                </div>
             </div>
          )}


          
        </div>
      </div>
    </motion.div>
  );
}
