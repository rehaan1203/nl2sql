import { Lightbulb, RefreshCw } from 'lucide-react';

export default function ExplanationTab({ explanation, isLoading, onRegenerate, result }) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Generating AI explanation...
          </p>
        </div>
      </div>
    );
  }
  
  if (!explanation) return null;
  
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Lightbulb size={16} className="text-blue-600 dark:text-blue-400" />
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300">
              Summary
            </h4>
            <span className="text-xs text-blue-500 bg-blue-100 dark:bg-blue-900/40 px-2 py-0.5 rounded-full">
              AI Generated
            </span>
          </div>
          {onRegenerate && (
            <button
              onClick={onRegenerate}
              className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300 flex items-center gap-1 transition-colors"
            >
              <RefreshCw size={14} /> Regenerate
            </button>
          )}
        </div>
        <p className="text-blue-800 dark:text-blue-200 leading-relaxed whitespace-pre-wrap">
          {explanation}
        </p>
      </div>
      
      {/* Additional stats */}
      <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center border border-slate-100 dark:border-slate-700/50">
          <p className="text-xs text-slate-500 dark:text-slate-400">Rows</p>
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            {result?.row_count || 0}
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center border border-slate-100 dark:border-slate-700/50">
          <p className="text-xs text-slate-500 dark:text-slate-400">Columns</p>
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            {result?.columns?.length || 0}
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center border border-slate-100 dark:border-slate-700/50">
          <p className="text-xs text-slate-500 dark:text-slate-400">Operation</p>
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-200 uppercase tracking-wider">
            {result?.operation_type || 'SELECT'}
          </p>
        </div>
        <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-center border border-slate-100 dark:border-slate-700/50">
          <p className="text-xs text-slate-500 dark:text-slate-400">Time</p>
          <p className="text-lg font-semibold text-slate-800 dark:text-slate-200">
            {result?.execution_time_ms || 0}ms
          </p>
        </div>
      </div>
    </div>
  );
}
