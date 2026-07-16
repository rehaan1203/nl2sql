import { useState, useEffect } from 'react';
import { fetchDatabases, deleteDatabase, resetDatabase } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';

export default function DatabaseManager({ onSelect, currentDatabase, onClose }) {
  const [databases, setDatabases] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDatabases();
  }, []);

  const loadDatabases = async () => {
    setLoading(true);
    try {
      const data = await fetchDatabases();
      setDatabases(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (hash, filename, e) => {
    e.stopPropagation();
    if (window.confirm(`Are you sure you want to completely delete "${filename}"? This action cannot be undone.`)) {
      try {
        const result = await deleteDatabase(hash);
        if (result.was_active || currentDatabase === filename) {
          await resetDatabase();
          window.location.reload();
        } else {
          loadDatabases();
        }
      } catch (err) {
        alert(err.message || 'Failed to delete database');
      }
    }
  };

  return (
    <div className="w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/50 rounded-xl shadow-lg overflow-hidden">
      <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
        <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-200">Your Databases</h3>
        <button onClick={loadDatabases} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"></path></svg>
        </button>
      </div>
      
      <div className="max-h-80 overflow-y-auto p-2 space-y-1">
        {loading ? (
          <div className="p-4 text-center text-sm text-slate-500">Loading...</div>
        ) : databases.length === 0 ? (
          <div className="p-4 text-center text-sm text-slate-500">No databases uploaded yet.</div>
        ) : (
          databases.map((db, idx) => (
            <div key={db.hash || idx} className={`relative w-full rounded-lg flex items-center transition-colors ${currentDatabase === db.filename ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'}`}>
              <button
                onClick={() => {
                  onSelect(db.hash);
                  onClose();
                }}
                className="flex-1 text-left p-3 flex items-start gap-3"
              >
                <div className="text-xl mt-0.5">🗄️</div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{db.filename}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{db.tables?.length || 0} tables</span>
                    <span className="text-xs text-slate-300 dark:text-slate-600">•</span>
                    <span className="text-xs text-slate-500 dark:text-slate-400">{db.uploaded_at ? new Date(db.uploaded_at * 1000).toLocaleDateString() : 'Unknown'}</span>
                  </div>
                </div>
              </button>
              
              <button
                onClick={(e) => handleDelete(db.hash, db.filename, e)}
                className="p-2 mr-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-md transition-colors"
                title="Delete database"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
