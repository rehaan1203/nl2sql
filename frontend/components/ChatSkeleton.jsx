export default function ChatSkeleton() {
  return (
    <div className="animate-pulse flex justify-start mb-4">
      <div className="w-full max-w-[85%] bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-6 h-6 bg-slate-200 dark:bg-slate-700 rounded-full"></div>
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
        </div>
        <div className="space-y-3">
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-full max-w-md"></div>
          <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded w-3/4 max-w-sm"></div>
          
          {/* Skeleton for tabs/content area */}
          <div className="mt-4 border border-slate-100 dark:border-slate-700 rounded-lg p-3">
             <div className="flex gap-2 mb-3">
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
                <div className="h-6 bg-slate-200 dark:bg-slate-700 rounded w-16"></div>
             </div>
             <div className="h-32 bg-slate-100 dark:bg-slate-700/50 rounded w-full"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
