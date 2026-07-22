import { ClipboardList, BarChart2, Bot, Hourglass, Lightbulb } from 'lucide-react';

export default function ErrorDisplay({ error }) {
  if (!error) return null;
  
  // Handle structured errors from backend
  if (error.error_type) {
    const configs = {
      table_not_found: {
        icon: <ClipboardList size={24} className="text-amber-500" />,
        title: 'Table Not Found',
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-200 dark:border-amber-800'
      },
      column_not_found: {
        icon: <BarChart2 size={24} className="text-amber-500" />,
        title: 'Column Not Found',
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-200 dark:border-amber-800'
      },
      ai_failure: {
        icon: <Bot size={24} className="text-red-500" />,
        title: 'AI Generation Failed',
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-200 dark:border-red-800'
      },
      rate_limit_error: {
        icon: <Hourglass size={24} className="text-blue-500" />,
        title: 'Rate Limit Exceeded',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-800'
      }
    };
    
    const config = configs[error.error_type] || configs.ai_failure;
    
    return (
      <div className={`p-4 rounded-lg border ${config.bg} ${config.border} mb-4`}>
        <div className="flex items-start gap-3">
          <div className="mt-0.5">{config.icon}</div>
          <div className="flex-1">
            <h4 className="font-semibold text-slate-800 dark:text-slate-200">
              {config.title}
            </h4>
            <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
              {error.error || error.message}
            </p>
            
            {error.details?.available_tables && (
              <div className="mt-2 text-xs text-slate-500">
                Available tables: {error.details.available_tables.join(', ')}
              </div>
            )}
            
            {error.suggested_action && (
              <div className="mt-2 flex items-start gap-2 bg-slate-100 dark:bg-slate-800/50 p-2 rounded-md">
                <Lightbulb size={14} className="text-blue-500 mt-0.5 shrink-0" />
                <span className="text-sm text-slate-700 dark:text-slate-300">
                  {error.suggested_action}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
  
  // Fallback for legacy errors
  return (
    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg mb-4">
      <p className="text-red-700 dark:text-red-300">{error.error || error.message || String(error)}</p>
    </div>
  );
}
