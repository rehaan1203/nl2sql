import { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';

export default function RetryButton({ 
  originalQuery, 
  error, 
  onRetry,
  suggestedFix 
}) {
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryQuery, setRetryQuery] = useState(originalQuery);
  const [retryCount, setRetryCount] = useState(0);
  const maxRetries = 3;
  
  const handleRetry = async () => {
    if (retryCount >= maxRetries) {
      toast.error('Maximum retry attempts reached');
      return;
    }
    
    setIsRetrying(true);
    setRetryCount(prev => prev + 1);
    
    try {
      if (onRetry) {
        await onRetry(retryQuery);
      }
    } finally {
      setIsRetrying(false);
    }
  };
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
    >
      <div className="flex items-start gap-2">
        <span className="text-red-600 dark:text-red-400 text-lg">❌</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-red-800 dark:text-red-300">
            Query Failed
          </p>
          <p className="text-xs text-red-700 dark:text-red-400 mt-0.5">
            {error}
          </p>
          
          {/* Suggested fix */}
          {suggestedFix && (
            <div className="mt-2 p-2 bg-white dark:bg-slate-800 rounded border border-red-200 dark:border-red-800">
              <p className="text-xs font-medium text-red-700 dark:text-red-400">Suggested fix:</p>
              <p className="text-xs font-mono text-red-600 dark:text-red-300 mt-0.5">
                {suggestedFix}
              </p>
            </div>
          )}
          
          {/* Retry button */}
          <button
            onClick={handleRetry}
            disabled={isRetrying || retryCount >= maxRetries}
            className="mt-2 px-4 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm rounded-lg transition-colors flex items-center gap-2"
          >
            {isRetrying ? (
              <>
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Retrying...
              </>
            ) : (
              `🔄 Retry Query (${maxRetries - retryCount} left)`
            )}
          </button>
          
          {/* Edit query option */}
          <div className="mt-2">
            <input
              type="text"
              value={retryQuery}
              onChange={(e) => setRetryQuery(e.target.value)}
              placeholder="Edit your query before retrying..."
              className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-600 rounded bg-white dark:bg-slate-700 text-slate-800 dark:text-slate-200"
            />
          </div>
        </div>
      </div>
    </motion.div>
  );
}
