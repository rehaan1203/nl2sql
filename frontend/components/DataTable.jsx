'use client';

import { useState, useMemo } from 'react';
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react';

const PAGE_SIZE = 20;


export default function DataTable({ data }) {
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });
  const [currentPage, setCurrentPage] = useState(1);

  const columns = useMemo(() => {
    if (!data || data.length === 0) return [];
    return Object.keys(data[0]).map(key => ({
      key
    }));
  }, [data]);

  const sortedData = useMemo(() => {
    if (!data) return [];
    if (!sortConfig.key) return data;

    return [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      
      if (aVal === null) return 1;
      if (bVal === null) return -1;
      
      if (aVal < bVal) return sortConfig.direction === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortConfig.direction === 'asc' ? 1 : -1;
      return 0;
    });
  }, [data, sortConfig]);

  const totalPages = Math.ceil(sortedData.length / PAGE_SIZE);
  const paginatedData = sortedData.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const requestSort = (key) => {
    let direction = 'asc';
    if (sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  if (!data || data.length === 0) return <div className="p-8 text-center text-slate-500 dark:text-slate-400">No data available</div>;

  return (
    <div className="flex flex-col h-full w-full max-h-[500px]">
      <div className="overflow-auto flex-grow rounded-t-xl border border-white/20 dark:border-slate-700/30 bg-white/40 dark:bg-slate-900/40 backdrop-blur-md transition-colors shadow-inner">
        <table className="w-full text-sm text-left">
          <thead className="text-xs text-slate-700 dark:text-slate-300 bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl sticky top-0 z-10 shadow-sm border-b border-slate-200/50 dark:border-slate-700/50 transition-colors">
            <tr>
              {columns.map(({ key }) => (
                <th 
                  key={key} 
                  className="px-4 py-3 font-medium cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap select-none text-center"
                  onClick={() => requestSort(key)}
                >
                  <div className="flex items-center justify-center gap-1.5 uppercase tracking-wider text-xs font-semibold">
                    <span>{key}</span>
                    <span className="w-4 flex justify-center text-slate-400 dark:text-slate-500">
                      {sortConfig.key === key ? (
                        sortConfig.direction === 'asc' ? <ChevronUp size={14} /> : <ChevronDown size={14} />
                      ) : null}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginatedData.map((row, rowIndex) => (
              <tr 
                key={rowIndex} 
                className={`border-b border-slate-100/50 dark:border-slate-800/30 hover:bg-indigo-50/80 dark:hover:bg-indigo-900/30 transition-all duration-200 hover:-translate-y-[1px] hover:shadow-md relative z-0 hover:z-10 ${rowIndex % 2 === 0 ? 'bg-white/40 dark:bg-slate-950/40' : 'bg-slate-50/20 dark:bg-slate-900/20'}`}
              >
                {columns.map(({ key }) => (
                  <td key={key} className="px-4 py-2.5 text-slate-600 dark:text-slate-300 whitespace-nowrap text-center">
                    {row[key] === null || row[key] === undefined ? (
                      <span className="text-slate-400 dark:text-slate-600">—</span>
                    ) : (
                      typeof row[key] === 'number' && !Number.isInteger(row[key]) 
                        ? row[key].toFixed(2) 
                        : String(row[key])
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      
      <div className="flex items-center justify-between p-4 border border-t-0 border-white/20 dark:border-slate-700/30 rounded-b-xl bg-white/60 dark:bg-slate-900/60 backdrop-blur-xl text-sm text-slate-600 dark:text-slate-400 transition-colors shadow-inner">
        <div>Showing {paginatedData.length} of {data.length} rows</div>
        
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="font-medium px-2">{currentPage} / {totalPages}</span>
            <button 
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
