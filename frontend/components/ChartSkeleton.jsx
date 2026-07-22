import { motion } from 'framer-motion';

export default function ChartSkeleton({ type = 'bar', height = 400 }) {
  const isDarkMode = typeof window !== 'undefined' ? document.documentElement.classList.contains('dark') : false;
  
  const skeletonVariants = {
    bar: (
      <div className="flex items-end justify-around h-full px-4 pt-8">
        {[...Array(8)].map((_, i) => (
          <div
            key={i}
            className="w-10 bg-slate-200 dark:bg-slate-700 rounded-t-lg animate-pulse"
            style={{
              height: `${20 + Math.random() * 60}%`,
              animationDelay: `${i * 0.1}s`
            }}
          />
        ))}
      </div>
    ),
    line: (
      <div className="relative h-full px-4 pt-8">
        <div className="absolute inset-0 flex items-end">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="flex-1 h-1 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"
              style={{ animationDelay: `${i * 0.1}s` }}
            />
          ))}
        </div>
        <div className="absolute inset-0 flex items-end px-4">
          {[...Array(10)].map((_, i) => (
            <div
              key={i}
              className="flex-1 flex flex-col items-center"
            >
              <div className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600 animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    ),
    pie: (
      <div className="flex items-center justify-center h-full">
        <div className="relative">
          <div className="w-48 h-48 rounded-full border-8 border-slate-200 dark:border-slate-700 animate-pulse" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-24 h-24 rounded-full border-4 border-slate-300 dark:border-slate-600 animate-pulse" />
          </div>
        </div>
      </div>
    )
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="relative bg-white dark:bg-slate-800 rounded-lg p-4 border border-slate-200 dark:border-slate-700"
      style={{ height }}
    >
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 w-32 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        <div className="flex gap-2">
          <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
          <div className="h-8 w-8 bg-slate-200 dark:bg-slate-700 rounded animate-pulse" />
        </div>
      </div>

      {/* Chart skeleton */}
      <div className="h-[calc(100%-60px)] relative">
        {skeletonVariants[type] || skeletonVariants.bar}
        
        {/* Axis labels skeleton */}
        <div className="absolute bottom-0 left-0 right-0 flex justify-between px-4">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-3 w-12 bg-slate-200 dark:bg-slate-700 rounded animate-pulse"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          ))}
        </div>
      </div>

      {/* Loading text */}
      <div className="absolute inset-0 flex items-center justify-center bg-white/50 dark:bg-slate-800/50 backdrop-blur-sm">
        <div className="flex flex-col items-center gap-2">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Generating chart...
          </p>
        </div>
      </div>
    </motion.div>
  );
}
