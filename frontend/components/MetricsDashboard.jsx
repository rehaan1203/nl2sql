import { useState, useEffect } from 'react';
import { API_URL } from '../lib/api';

export default function MetricsDashboard() {
  const [metrics, setMetrics] = useState(null);
  
  useEffect(() => {
    fetch(`${API_URL}/metrics`)
      .then(res => res.json())
      .then(setMetrics)
      .catch(console.error);
  }, []);
  
  if (!metrics) return null;
  
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
      <div>
        <p className="text-xs text-slate-500">Success Rate</p>
        <p className="text-lg font-semibold">
          {metrics.queries.success_rate.toFixed(1)}%
        </p>
      </div>
      <div>
        <p className="text-xs text-slate-500">Avg Response</p>
        <p className="text-lg font-semibold">
          {metrics.performance.avg_query_time.toFixed(2)}s
        </p>
      </div>
      <div>
        <p className="text-xs text-slate-500">Avg Tokens</p>
        <p className="text-lg font-semibold">
          {metrics.performance.avg_token_usage.toFixed(0)}
        </p>
      </div>
      <div>
        <p className="text-xs text-slate-500">Total Queries</p>
        <p className="text-lg font-semibold">
          {metrics.queries.total}
        </p>
      </div>
    </div>
  );
}
