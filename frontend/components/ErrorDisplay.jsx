export default function ErrorDisplay({ error, onRetry, onSwitchTable }) {
  if (!error) return null;
  
  const getErrorConfig = () => {
    // Determine error details if they are nested
    const errorType = error.error_type || (error.details && error.details.error_type) || 'ai_failure';
    
    const configs = {
      table_not_found: {
        icon: '📋',
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-200 dark:border-amber-800',
        title: 'Table Not Found'
      },
      column_not_found: {
        icon: '📊',
        bg: 'bg-amber-50 dark:bg-amber-900/20',
        border: 'border-amber-200 dark:border-amber-800',
        title: 'Column Not Found'
      },
      ai_failure: {
        icon: '🤖',
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-200 dark:border-red-800',
        title: 'AI Failed to Generate Query'
      },
      cross_table_query: {
        icon: '🔄',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-800',
        title: 'Multiple Tables Required'
      },
      server_error: {
        icon: '⚠️',
        bg: 'bg-red-50 dark:bg-red-900/20',
        border: 'border-red-200 dark:border-red-800',
        title: 'Server Error'
      }
    };
    return configs[errorType] || configs.ai_failure;
  };
  
  const config = getErrorConfig();
  const errorMessage = error.message || error.error || 'An unknown error occurred.';
  const details = error.details || error;
  
  return (
    <div className={`rounded-lg border p-4 ${config.bg} ${config.border} mb-4`}>
      <div className="flex items-start gap-3">
        <span className="text-2xl">{config.icon}</span>
        <div className="flex-1">
          <h4 className="font-semibold text-slate-800 dark:text-slate-200">
            {config.title}
          </h4>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {errorMessage}
          </p>
          
          {details.available_tables && (
            <div className="mt-2 text-xs text-slate-500 dark:text-slate-500">
              Available tables: {details.available_tables.join(', ')}
            </div>
          )}
          
          {error.suggested_action && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-slate-500 dark:text-slate-400">💡</span>
              <span className="text-sm text-slate-600 dark:text-slate-400">
                {error.suggested_action}
              </span>
            </div>
          )}
          
          <div className="mt-3 flex gap-2">
            {onSwitchTable && (details.error_type === 'table_not_found' || details.error_type === 'cross_table_query') && details.suggested_tables && details.suggested_tables.length > 0 && (
              <button
                onClick={() => onSwitchTable(details.suggested_tables[0])}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
              >
                Switch to '{details.suggested_tables[0]}'
              </button>
            )}
            
            {onRetry && (
              <button
                onClick={onRetry}
                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-300 text-sm rounded-lg transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
