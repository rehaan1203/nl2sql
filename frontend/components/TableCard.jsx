'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Key, Database, Users, Package, Tag, Table2, Circle } from 'lucide-react';

const getTableIcon = (name) => {
  const n = name.toLowerCase();
  if (n.includes('user')) return <Users size={16} className="text-blue-500 dark:text-blue-400" />;
  if (n.includes('order')) return <Package size={16} className="text-amber-500 dark:text-amber-400" />;
  if (n.includes('product')) return <Tag size={16} className="text-green-500 dark:text-green-400" />;
  return <Table2 size={16} className="text-slate-400 dark:text-slate-500" />;
};

const formatType = (type) => {
  if (!type) return 'Unknown';
  return type.charAt(0).toUpperCase() + type.slice(1).toLowerCase();
};

export default function TableCard({ name, columns, rowCount, onPreviewTable, isActive = false }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const hasData = columns && columns.length > 0;

  return (
    <div className="w-full relative mb-2 overflow-hidden transition-all duration-300">
      <div className={`flex items-center justify-between p-2.5 group/table relative rounded-xl border transition-all duration-300 backdrop-blur-sm ${
        isActive 
          ? 'border-indigo-200/50 dark:border-indigo-500/30 bg-white/80 dark:bg-slate-800/60 shadow-md shadow-indigo-500/5'
          : 'border-transparent hover:border-indigo-200/50 dark:hover:border-indigo-500/30 hover:bg-white/80 dark:hover:bg-slate-800/60 hover:shadow-md hover:shadow-indigo-500/5'
      }`}>
        {/* Glow indicator on hover / active */}
        <div className={`absolute left-0 top-1/2 -translate-y-1/2 w-1 transition-all duration-300 ease-out shadow-[0_0_8px_rgba(99,102,241,0.6)] ${
          isActive 
            ? 'h-3/4 opacity-100 bg-indigo-500 rounded-r-full' 
            : 'h-0 opacity-0 bg-indigo-500 rounded-r-full group-hover/table:h-3/4 group-hover/table:opacity-100'
        }`}></div>
        
        {/* Click area for previewing data */}
        <div 
          className="flex-1 flex items-center gap-3 cursor-pointer relative z-10 min-w-0"
          onClick={() => {
            if (onPreviewTable) onPreviewTable(name);
          }}
        >
          <div className={`flex items-center justify-center w-8 h-8 rounded-lg border shadow-sm flex-shrink-0 transition-all duration-300 ${
            isActive
              ? 'bg-indigo-50 dark:bg-indigo-500/20 border-indigo-200/50 dark:border-indigo-500/30 shadow-indigo-500/10'
              : 'bg-slate-100/80 dark:bg-slate-800/80 border-slate-200/50 dark:border-slate-700/50 group-hover/table:bg-indigo-50 dark:group-hover/table:bg-indigo-500/10 group-hover/table:border-indigo-200/50 dark:group-hover/table:border-indigo-500/30 group-hover/table:shadow-indigo-500/10'
          }`}>
            {getTableIcon(name)}
          </div>
          <div className="min-w-0 flex-1 flex flex-col justify-center group-hover/table:translate-x-0.5 transition-transform duration-300">
            <h4 className={`font-bold text-sm tracking-tight truncate transition-colors ${
              isActive
                ? 'text-indigo-700 dark:text-indigo-300'
                : 'text-slate-700 dark:text-slate-200 group-hover/table:text-indigo-700 dark:group-hover/table:text-indigo-300'
            }`}>{name}</h4>
            {hasData && (
              <div className="mt-1 flex items-center">
                <span className="whitespace-nowrap text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                  {rowCount} rows <span className="opacity-50 mx-0.5">•</span> {columns.length} cols
                </span>
              </div>
            )}
          </div>
        </div>
        
        {/* Click area for expanding columns */}
        {hasData && (
          <button 
            className="flex items-center gap-2 pl-2 py-1 cursor-pointer relative z-10 hover:opacity-80 transition-opacity flex-shrink-0"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            <div className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-slate-400">
              <ChevronDown 
                size={16} 
                className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} 
              />
            </div>
          </button>
        )}
      </div>

      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-slate-50/50 dark:bg-slate-900/30 ml-8 pl-1 mb-2 border-l border-slate-200 dark:border-slate-800"
          >
            <div className="space-y-0.5">
              {columns.map((col, idx) => (
                <div key={idx} className="flex items-center justify-between py-1.5 px-2 hover:bg-slate-50 dark:hover:bg-slate-900 rounded group transition-colors">
                  <div className="flex items-center gap-2">
                    {col.primary_key ? (
                      <div className="flex items-center justify-center w-5 h-5 rounded bg-amber-100/80 dark:bg-amber-900/40 border border-amber-200 dark:border-amber-800/50 flex-shrink-0 shadow-sm shadow-amber-500/10" title="Primary Key">
                        <Key size={11} className="text-amber-600 dark:text-amber-400" strokeWidth={2.5} />
                      </div>
                    ) : (
                      <div className="flex items-center justify-center w-5 h-5 flex-shrink-0" title={col.nullable ? 'Nullable' : 'Not Null'}>
                        {col.nullable ? (
                          <Circle size={11} className="text-slate-300 dark:text-slate-600" strokeWidth={2.5} />
                        ) : (
                          <Circle size={11} className="text-slate-400 dark:text-slate-500 fill-slate-400 dark:fill-slate-500" strokeWidth={2} />
                        )}
                      </div>
                    )}
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">{col.name}</span>
                  </div>
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md opacity-70 group-hover:opacity-100 transition-opacity">
                    {formatType(col.type)}
                  </span>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
