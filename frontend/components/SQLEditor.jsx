'use client';

import { useState, useEffect } from 'react';
import { Copy, Edit2, Check, Play, X } from 'lucide-react';

const highlightSQL = (sql) => {
  if (!sql) return '';
  
  let highlighted = sql
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\b(SELECT|FROM|WHERE|JOIN|LEFT|RIGHT|INNER|OUTER|GROUP BY|ORDER BY|LIMIT|OFFSET|HAVING|AS|ON|AND|OR|NOT|IN|IS|NULL|ASC|DESC|DISTINCT|SUM|COUNT|AVG|MIN|MAX|CURRENT_DATE|INTERVAL|DATE_TRUNC)\b/gi, '<span class="text-pink-500 font-medium">$1</span>')
    .replace(/('(?:[^'\\]|\\.)*')/g, '<span class="text-emerald-400">$1</span>')
    .replace(/(?<!-)\b(\d+(?:\.\d+)?)\b/g, '<span class="text-indigo-400">$1</span>')
    .replace(/(--.*$)/gm, '<span class="text-slate-500 italic">$1</span>');
    
  return <div dangerouslySetInnerHTML={{ __html: highlighted }} />;
};

export default function SQLEditor({ sql, executionTime, onExecuteSql }) {
  const [copied, setCopied] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editedSql, setEditedSql] = useState(sql);

  useEffect(() => {
    setEditedSql(sql);
    setIsEditing(false);
  }, [sql]);

  const handleCopy = () => {
    navigator.clipboard.writeText(isEditing ? editedSql : sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleRun = () => {
    if (onExecuteSql && editedSql.trim()) {
      onExecuteSql(editedSql);
      setIsEditing(false);
    }
  };

  return (
    <div className="flex flex-col h-full w-full rounded-xl overflow-hidden border border-[#333] bg-[#0A0A0A] text-[#EDEDED] shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 bg-[#111] border-b border-[#333]">
        <span className="text-xs font-mono text-slate-400">
          {isEditing ? 'Editing SQL' : 'Generated SQL'}
        </span>
        <div className="flex gap-2">
          {isEditing ? (
            <>
              <button 
                onClick={() => {
                  setIsEditing(false);
                  setEditedSql(sql);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md hover:bg-rose-500/20 text-rose-400 transition-colors"
              >
                <X size={14} />
                Cancel
              </button>
              <button 
                onClick={handleRun}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 transition-colors border border-emerald-500/20"
              >
                <Play size={14} />
                Save & Run
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md hover:bg-[#222] transition-colors text-slate-300"
              >
                {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button 
                onClick={() => setIsEditing(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md hover:bg-[#222] transition-colors text-slate-300"
              >
                <Edit2 size={14} />
                Edit SQL
              </button>
            </>
          )}
        </div>
      </div>
      <div className="flex-grow flex flex-col min-h-[250px]">
        {isEditing ? (
          <textarea
            value={editedSql}
            onChange={(e) => setEditedSql(e.target.value)}
            className="flex-1 w-full p-4 bg-transparent text-[#EDEDED] font-mono text-sm leading-relaxed resize-none focus:outline-none focus:ring-0 custom-scrollbar"
            spellCheck="false"
            autoFocus
          />
        ) : (
          <div className="p-4 overflow-auto h-full font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">
            {highlightSQL(sql)}
          </div>
        )}
      </div>
      {executionTime && (
        <div className="px-4 py-2 bg-[#111] border-t border-[#333] text-xs text-slate-500 text-right shrink-0">
          Executed in {executionTime}ms
        </div>
      )}
    </div>
  );
}
