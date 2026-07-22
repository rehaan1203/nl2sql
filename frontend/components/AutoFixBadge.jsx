import { motion } from 'framer-motion';
import { useState } from 'react';

export default function AutoFixBadge({ 
  originalSql, 
  fixedSql, 
  onViewOriginal 
}) {
  const [isExpanded, setIsExpanded] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, y: -10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.3 }}
      className="mb-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg"
    >
      <div className="flex items-start gap-2">
        <span className="text-amber-600 dark:text-amber-400 text-lg">🔧</span>
        <div className="flex-1">
          <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
            Query Auto-Corrected
          </p>
          <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
            The AI automatically fixed an issue with your query
          </p>
          
          <button
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-xs text-amber-600 dark:text-amber-400 hover:underline mt-1 flex items-center gap-1"
          >
            {isExpanded ? '▼' : '▶'} View changes
          </button>
          
          {isExpanded && (
            <div className="mt-2 space-y-1 text-xs font-mono">
              <div className="text-red-600 dark:text-red-400 line-through">
                {originalSql}
              </div>
              <div className="text-green-600 dark:text-green-400">
                → {fixedSql}
              </div>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
