import React from 'react';
import { motion } from 'framer-motion';

export default function TableSkeleton() {
  return (
    <>
      <div className="w-full bg-white dark:bg-slate-950 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col transition-colors">
      {/* Header Tabs Skeleton */}
      <div className="flex items-center gap-4 border-b border-slate-200 dark:border-slate-800 px-4 py-3 bg-white dark:bg-slate-950">
        <div className="w-24 h-6 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse"></div>
        <div className="w-20 h-6 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse"></div>
        <div className="w-24 h-6 bg-slate-200 dark:bg-slate-800 rounded-md animate-pulse"></div>
        <div className="ml-auto w-24 h-8 bg-slate-200 dark:bg-slate-800 rounded-lg animate-pulse"></div>
      </div>

      {/* Main Content Area Skeleton */}
      <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 flex-grow min-h-[300px]">
        {/* Fake Header Row */}
        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
          <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
          <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
          <div className="h-6 bg-slate-200 dark:bg-slate-800 rounded animate-pulse"></div>
        </div>

        {/* Fake Data Rows */}
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="grid grid-cols-4 gap-4 py-3 border-b border-slate-100 dark:border-slate-800/50">
            <div className={`h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse opacity-${Math.max(20, 100 - i * 10)} w-3/4`}></div>
            <div className={`h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse opacity-${Math.max(20, 100 - i * 10)} w-1/2`}></div>
            <div className={`h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse opacity-${Math.max(20, 100 - i * 10)} w-5/6`}></div>
            <div className={`h-4 bg-slate-200 dark:bg-slate-800 rounded animate-pulse opacity-${Math.max(20, 100 - i * 10)} w-2/3`}></div>
          </div>
        ))}
        
        </div>
      </div>
      
      {/* Generating Indicator below skeleton */}
      <div className="flex justify-center mt-6">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm px-6 py-4 rounded-2xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] dark:shadow-[0_4px_20px_rgba(0,0,0,0.2)] border border-slate-200 dark:border-slate-800 flex items-center gap-4">
           <div className="flex gap-1.5 items-center">
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
              <span className="w-2.5 h-2.5 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
           </div>
           <span className="text-slate-700 dark:text-slate-300 font-medium tracking-wide">AI is analyzing and generating SQL...</span>
        </div>
      </div>
    </>
  );
}
