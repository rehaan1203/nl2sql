// frontend/components/LoadingSkeleton.jsx

import { motion } from 'framer-motion';

export default function LoadingSkeleton({ type = 'table', count = 5 }) {
  const skeletons = {
    table: (
      <div className="animate-pulse">
        <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded mb-4"></div>
        {[...Array(count)].map((_, i) => (
          <div key={i} className="flex gap-4 mb-2">
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded flex-1"></div>
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded flex-1"></div>
            <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded flex-1"></div>
          </div>
        ))}
      </div>
    ),
    card: (
      <div className="animate-pulse bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
        <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3"></div>
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
        <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
      </div>
    ),
    grid: (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(count)].map((_, i) => (
          <div key={i} className="animate-pulse bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-3/4 mb-3"></div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-1/2 mb-2"></div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-2/3"></div>
          </div>
        ))}
      </div>
    ),
    chat: (
      <div className="space-y-3">
        <div className="animate-pulse flex items-start gap-3">
          <div className="w-8 h-8 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
          <div className="flex-1">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-24 mb-2"></div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4"></div>
          </div>
        </div>
        <div className="animate-pulse flex items-start gap-3 justify-end">
          <div className="flex-1 text-right">
            <div className="h-4 bg-blue-200 dark:bg-blue-900/30 rounded w-24 ml-auto mb-2"></div>
            <div className="h-3 bg-blue-200 dark:bg-blue-900/30 rounded w-2/3 ml-auto"></div>
          </div>
          <div className="w-8 h-8 bg-blue-200 dark:bg-blue-900/30 rounded-full"></div>
        </div>
      </div>
    )
  };
  
  return skeletons[type] || skeletons.table;
}
