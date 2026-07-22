import { useState, useEffect } from 'react';
import { fetchDatabases, deleteDatabase, resetDatabase } from '../lib/api';
import { motion, AnimatePresence } from 'framer-motion';
import { Database, RefreshCw, Trash2 } from 'lucide-react';

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
          <RefreshCw className="w-4 h-4" />
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
                <div className="mt-0.5"><Database size={20} className="text-blue-500" /></div>
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
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
