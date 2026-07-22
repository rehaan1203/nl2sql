'use client';

import { useState, useEffect } from 'react';
import { Search, Database, Trash2, AlertCircle, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TableCard from './TableCard';
import { fetchDatabases, deleteDatabase } from '../lib/api';

export default function SchemaExplorer({ schema, loading = false, error = false, onSelectDatabase, activeDbName, onPreviewTable, activePreviewTable, onDatabaseDeleted, refreshTrigger }) {
  const [databases, setDatabases] = useState([]);
  const [dbsLoading, setDbsLoading] = useState(true);
  const [expandedDbs, setExpandedDbs] = useState([]);
  const [searchQueries, setSearchQueries] = useState({});
  const [dbToDelete, setDbToDelete] = useState(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteDb = async () => {
    if (!dbToDelete) return;
    setIsDeleting(true);
    try {
      const result = await deleteDatabase(dbToDelete);
      if (onDatabaseDeleted) {
        onDatabaseDeleted(dbToDelete, result);
      }
      loadDatabases();
    } catch (err) {
      alert(err.message || 'Failed to delete database');
    } finally {
      setIsDeleting(false);
      setDbToDelete(null);
    }
  };

  useEffect(() => {
    loadDatabases();
    if (activeDbName && !expandedDbs.includes(activeDbName)) {
      setExpandedDbs(prev => [...prev, activeDbName]);
    }
  }, [activeDbName, refreshTrigger]);

  const loadDatabases = async () => {
    try {
      const data = await fetchDatabases();
      setDatabases(data);
    } catch (e) {
      console.error(e);
    } finally {
      setDbsLoading(false);
    }
  };

  if (dbsLoading && databases.length === 0) {
    return (
      <div className="bg-white/50 dark:bg-slate-900/50 rounded-2xl shadow-sm border border-slate-200/50 dark:border-slate-800/50 p-5 m-4 transition-colors">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-slate-800 dark:text-slate-200 tracking-tight flex items-center gap-2">
            <Database size={18} className="text-indigo-500" />
            Schemas
          </h3>
          <div className="flex space-x-1">
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
            <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-bounce"></div>
          </div>
        </div>
        {/* Skeleton loaders */}
        {[1, 2, 3].map((i) => (
          <div key={i} className="mb-4 p-4 border border-slate-200/50 dark:border-slate-800/50 rounded-xl bg-white/30 dark:bg-slate-800/30">
            <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded-md animate-pulse w-32 mb-3"></div>
            <div className="h-3 bg-slate-200 dark:bg-slate-700 rounded-md animate-pulse w-20"></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-transparent w-full transition-colors">
      <div className="p-5 border-b border-white/20 dark:border-slate-700/30 flex items-center justify-between bg-transparent transition-colors">
        <h2 className="font-bold text-slate-800 dark:text-slate-100 text-sm flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
            <Database size={14} className="text-white" strokeWidth={2.5} />
          </div>
          Data Sources
        </h2>
        <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500/10 to-purple-500/10 text-blue-700 dark:text-blue-300 text-xs font-bold tracking-wider rounded-full border border-blue-200 dark:border-blue-800/50">
          {databases.length}
        </span>
      </div>
      <div className="flex-grow overflow-y-auto px-2 py-3 custom-scrollbar space-y-2">
        {databases.map((db, idx) => {
          const isActive = activeDbName === db.filename;
          const isExpanded = expandedDbs.includes(db.filename);

          let parsedTables = [];
          if (Array.isArray(db.tables)) {
            parsedTables = db.tables;
          } else if (typeof db.tables === 'string') {
            try {
              parsedTables = JSON.parse(db.tables.replace(/'/g, '"'));
            } catch (e) { }
          }

          let sq = (searchQueries[db.filename] || '').toLowerCase();
          let filteredSchemaTables = isActive && schema?.tables
            ? schema.tables.filter(t => t.name.toLowerCase().includes(sq))
            : [];
          let filteredParsedTables = parsedTables.filter(t => typeof t === 'string' && t.toLowerCase().includes(sq));

          return (
            <div key={db.hash || idx} className="relative group/db">
              {isActive && (
                <motion.div
                  layoutId="activeDbIndicator"
                  className="absolute left-0 top-0 bottom-0 w-1 bg-indigo-500 rounded-r-full shadow-[0_0_10px_rgba(99,102,241,0.5)] z-10"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                />
              )}

              <div className={`border border-transparent rounded-xl overflow-hidden transition-all duration-300 ${isActive
                  ? 'bg-indigo-50/50 dark:bg-indigo-900/20 border-indigo-100/50 dark:border-indigo-800/30 shadow-sm'
                  : 'hover:bg-white/40 dark:hover:bg-slate-800/40 hover:border-slate-200/50 dark:hover:border-slate-700/50'
                }`}>
                {/* Database Header */}
                <button
                  onClick={() => {
                    if (!isExpanded) {
                      setExpandedDbs(prev => [...prev, db.filename]);
                    } else {
                      setExpandedDbs(prev => prev.filter(name => name !== db.filename));
                    }
                  }}
                  className="w-full flex items-center justify-between px-2 py-2 transition-colors group"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 pr-1">
                    <div className={`shrink-0 p-1 rounded-lg transition-colors ${isActive ? 'bg-indigo-100 dark:bg-indigo-900/50 text-indigo-600 dark:text-indigo-400 shadow-[0_0_15px_rgba(99,102,241,0.2)]' : 'bg-slate-100 dark:bg-slate-800 text-slate-400 group-hover:text-slate-600 dark:group-hover:text-slate-300'}`}>
                      <Database size={14} />
                    </div>
                    <span className={`font-semibold line-clamp-2 break-all text-left text-sm tracking-tight transition-colors ${isActive ? "text-indigo-900 dark:text-indigo-300" : "text-slate-600 dark:text-slate-400 group-hover:text-slate-900 dark:group-hover:text-slate-200"}`} title={db.filename}>
                      {db.filename}
                    </span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setDbToDelete(db.hash || 'active');
                      }}
                      className="p-1 hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 rounded transition-colors"
                      title="Delete Database"
                    >
                      <Trash2 size={14} />
                    </button>
                    <div className={`flex items-center justify-center w-6 h-6 rounded-full transition-colors ${isActive ? 'bg-white dark:bg-slate-950/50 shadow-sm' : 'group-hover:bg-white dark:group-hover:bg-slate-800'}`}>
                      <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </button>

                {/* Tables */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2, ease: "easeInOut" }}
                      className="overflow-hidden"
                    >
                      <div className="pt-1 pb-3 pl-4 pr-3">
                        <div className="relative mb-3 group/search">
                          <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-xl opacity-0 group-hover/search:opacity-100 focus-within:opacity-100 transition-opacity blur-md"></div>
                          <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-blue-400/70 z-20 pointer-events-none" />
                          <input
                            type="text"
                            placeholder="Search tables..."
                            value={searchQueries[db.filename] || ''}
                            onChange={(e) => setSearchQueries(p => ({ ...p, [db.filename]: e.target.value }))}
                            className="w-full pl-10 pr-4 py-2.5 text-sm glass rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-transparent transition-all text-slate-800 dark:text-slate-100 placeholder-slate-400 shadow-sm relative z-10"
                          />
                        </div>

                        {(isActive && loading) ? (
                          <div className="p-3 text-center text-xs font-medium text-slate-500 flex items-center justify-center gap-2">
                            <div className="w-3 h-3 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
                            Loading tables...
                          </div>
                        ) : (isActive && error) ? (
                          <div className="p-3 text-center text-xs font-medium text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-100 dark:border-red-900/30">Failed to load schema</div>
                        ) : (
                          <div className="space-y-1.5 border-l border-slate-200/50 dark:border-slate-700/50 ml-1.5 pl-3 py-1">
                            {isActive && schema?.tables ? (
                              filteredSchemaTables.length > 0 ? (
                                filteredSchemaTables.map((table, idx) => (
                                  <motion.div
                                    key={table.name}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: idx * 0.05 }}
                                  >
                                    <TableCard name={table.name} columns={table.columns} rowCount={table.row_count} onPreviewTable={onPreviewTable} isActive={isActive && activePreviewTable === table.name} />
                                  </motion.div>
                                ))
                              ) : (
                                <div className="p-3 text-center text-xs font-medium text-slate-500">No tables match your search</div>
                              )
                            ) : filteredParsedTables.length > 0 ? (
                              filteredParsedTables.map((tableName, idx) => (
                                <motion.div
                                  key={tableName}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: idx * 0.05 }}
                                >
                                  <TableCard
                                    name={tableName}
                                    columns={[]}
                                    rowCount="?"
                                    onPreviewTable={async () => {
                                      if (!isActive && onSelectDatabase) {
                                        await onSelectDatabase(db.hash);
                                      }
                                      if (onPreviewTable) onPreviewTable(tableName);
                                    }}
                                    isActive={isActive && activePreviewTable === tableName}
                                  />
                                </motion.div>
                              ))
                            ) : (
                              <div className="p-3 text-center text-xs font-medium text-slate-500">{sq ? "No tables match your search" : "No tables found"}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          );
        })}
        {databases.length === 0 && !dbsLoading && (
          <div className="text-center p-8 text-slate-500">No databases available.</div>
        )}
      </div>

      {/* Delete Database Confirmation Modal */}
      <AnimatePresence>
        {dbToDelete && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setDbToDelete(null)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-sm border border-slate-200 dark:border-slate-700 overflow-hidden relative z-10"
            >
              <div className="p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4 text-red-600 dark:text-red-400">
                  <AlertCircle size={24} />
                </div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-2">Delete Database?</h3>
                <p className="text-slate-600 dark:text-slate-300 text-sm">
                  Are you sure you want to completely delete this database? This action cannot be undone.
                </p>
              </div>
              <div className="bg-slate-50 dark:bg-slate-900/50 px-6 py-4 flex justify-center gap-3 border-t border-slate-100 dark:border-slate-700">
                <button
                  onClick={() => setDbToDelete(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteDb}
                  disabled={isDeleting}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-xl transition-colors disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm shadow-red-500/20"
                >
                  {isDeleting ? 'Deleting...' : 'Delete Database'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
