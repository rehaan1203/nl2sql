'use client';

import { motion } from 'framer-motion';
import { RefreshCw } from 'lucide-react';

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } }
};

export default function QuerySuggestions({ 
  suggestions = [], 
  loading = false, 
  onRefresh,
  onSuggestionClick, 
  onSelect, 
  disabled = false,
  tableName = null
}) {
  const clickHandler = onSuggestionClick || onSelect;
  
  if (loading) {
    return (
      <div className="flex flex-col gap-2 mt-6">
        <div className="flex items-center gap-2 mb-1 px-1 opacity-50">
           <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Analyzing {tableName || 'database'}...</span>
        </div>
        <motion.div 
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className="flex flex-wrap gap-3 p-2"
        >
          {[1, 2, 3, 4, 5].map((i) => (
            <motion.div key={i} variants={itemVariants} className="h-10 w-48 rounded-2xl bg-slate-200 dark:bg-slate-700/50 animate-pulse bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50"></motion.div>
          ))}
        </motion.div>
      </div>
    );
  }
  
  if (!suggestions || suggestions.length === 0) {
    return null;
  }
  
  return (
    <div className="flex flex-col gap-2 mt-6">
      <div className="flex items-center justify-between mb-1 px-1">
        <div className="flex items-center gap-3">
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            Suggested Queries
          </span>
        </div>
        
        {onRefresh && !loading && (
          <button
            onClick={onRefresh}
            className="p-1.5 text-slate-400 hover:text-indigo-600 dark:text-slate-500 dark:hover:text-indigo-400 rounded-md transition-colors hover:bg-slate-100 dark:hover:bg-slate-800"
            title="Regenerate suggestions"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        )}
      </div>
      
      <motion.div 
        variants={containerVariants}
        initial="hidden"
        animate="show"
        className="flex flex-wrap gap-3 p-2"
      >
        {suggestions.map((suggestion, index) => (
          <motion.button
            variants={itemVariants}
            key={index}
            onClick={() => !disabled && clickHandler(suggestion)}
            disabled={disabled}
            className={`px-4 py-2 bg-white/60 dark:bg-slate-800/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-700/50 hover:border-blue-400 dark:hover:border-blue-500 hover:shadow-md outline outline-2 outline-transparent outline-offset-2 hover:outline-blue-500/40 text-slate-700 dark:text-slate-300 text-sm rounded-2xl transition-all duration-300 whitespace-normal text-left break-words ${
              disabled ? 'opacity-50 cursor-not-allowed' : 'hover:-translate-y-0.5'
            }`}
          >
            {suggestion}
          </motion.button>
        ))}
      </motion.div>
    </div>
  );
}
