'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import QueryInput from '../components/QueryInput';
import QuerySuggestions from '../components/QuerySuggestions';
import ResultsPanel from '../components/ResultsPanel';
import ChatContainer from '../components/ChatContainer';
import SchemaExplorer from '../components/SchemaExplorer';
import QueryHistory from '../components/QueryHistory';
import TableDataViewer from '../components/TableDataViewer';
import TableContextIndicator from '../components/TableContextIndicator';
import TableSkeleton from '../components/TableSkeleton';
import ErrorDisplay from '../components/ErrorDisplay';
import Tooltip from '../components/Tooltip';
import {
  runQuery,
  fetchSchema,
  checkHealth,
  fetchHistory,
  saveToHistory,
  clearHistoryAPI,
  executeSql,
  getDatabaseInfo,
  switchDatabase,
  getSuggestions,
  regenerateSuggestions,
  clearSuggestions
} from '../lib/api';
import UploadDatabase from '../components/UploadDatabase';
import DatabaseManager from '../components/DatabaseManager';
import { useTheme } from 'next-themes';
import toast from 'react-hot-toast';
import { AlertTriangle, Upload, LayoutPanelLeft, History, Sun, Moon, Server, Activity, Bot, ArrowLeft, Keyboard, CheckCircle } from 'lucide-react';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import KeyboardShortcutsModal from '../components/KeyboardShortcutsModal';

export default function Home() {
  const { theme, setTheme } = useTheme();
  // State
  const [query, setQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [schema, setSchema] = useState(null);
  const [schemaLoading, setSchemaLoading] = useState(true);
  const [history, setHistory] = useState([]);
  const [health, setHealth] = useState(null);
  const [showSchema, setShowSchema] = useState(true);
  const [showHistory, setShowHistory] = useState(false);
  const [isBackendReachable, setIsBackendReachable] = useState(true);
  const [dbUploadTrigger, setDbUploadTrigger] = useState(0);
  const [dbInfo, setDbInfo] = useState(null);
  const [uploadError, setUploadError] = useState(null);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showDbManager, setShowDbManager] = useState(false);
  const [isHistoryView, setIsHistoryView] = useState(false);
  // Add new state to track if user has interacted with the UI this session
  const [hasInteractedThisSession, setHasInteractedThisSession] = useState(false);
  const [activePreviewTable, setActivePreviewTable] = useState(null);
  const [tableRefreshTrigger, setTableRefreshTrigger] = useState(0);
  const [isEditingSql, setIsEditingSql] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState('');
  const [isChatMode, setIsChatMode] = useState(false);
  const isSplitView = !!activePreviewTable;
  const [activeDbName, setActiveDbName] = useState("Default Database");
  const [mounted, setMounted] = useState(false);
  const dbCacheRef = useRef({});
  // Dynamic Suggestions state
  const [dynamicSuggestions, setDynamicSuggestions] = useState([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [suggestionsSource, setSuggestionsSource] = useState(null);

  const shortcuts = {
    onRunQuery: () => {
      if (query.trim() && !isLoading && isBackendReachable && !schemaLoading && !isHistoryView) {
        handleSubmit(query);
      }
    },
    onToggleSchema: () => setShowSchema(prev => !prev),
    onToggleHistory: () => setShowHistory(prev => !prev),
  };

  const { showShortcuts, setShowShortcuts } = useKeyboardShortcuts(shortcuts);

  const loadTableSuggestions = useCallback(async (tableName = null, forceRefresh = false) => {
    if (!tableName) return;

    setSuggestionsLoading(true);
    try {
      const data = await getSuggestions(tableName, forceRefresh);
      if (data && data.suggestions) {
        setDynamicSuggestions(data.suggestions);
        setSuggestionsSource(data.source);
      }
    } catch (e) {
      console.error("Failed to load suggestions", e);
      toast.error(`Failed to load suggestions for ${tableName}`);
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  // Update suggestions when table changes in split view or schema updates
  useEffect(() => {
    if (activePreviewTable) {
      loadTableSuggestions(activePreviewTable);
    } else if (!schemaLoading && schema?.tables?.length > 0) {
      loadTableSuggestions(schema.tables[0].name);
    }
  }, [activePreviewTable, loadTableSuggestions, schema, schemaLoading]);

  // Load schema and health on mount
  useEffect(() => {
    setMounted(true);

    const initializeApp = async () => {
      // Check backend health
      const healthData = await checkHealth();
      setHealth(healthData);
      setIsBackendReachable(healthData?.status === 'healthy' || healthData?.status === 'degraded');

      // Load schema
      try {
        const schemaData = await fetchSchema();
        setSchema(schemaData);
        const info = await getDatabaseInfo();
        if (info && info.database_name) setActiveDbName(info.database_name);
      } catch (err) {
        console.error('Failed to load schema:', err);
        setError('Failed to load database schema. Please check backend connection.');
      } finally {
        setSchemaLoading(false);
      }

      // Load history from backend first, fallback to localStorage
      try {
        const backendHistory = await fetchHistory();
        const savedHistory = localStorage.getItem('queryHistory');
        let localHistory = [];
        if (savedHistory) {
          try { localHistory = JSON.parse(savedHistory); } catch (e) { }
        }

        if (backendHistory && backendHistory.length > 0) {
          // Merge to retain rich local cache (data, columns, explanation)
          const mergedHistory = backendHistory.map(bItem => {
            const lItem = localHistory.find(l => l.id === bItem.id || l.natural_language === bItem.natural_language);
            return lItem ? { ...bItem, ...lItem } : bItem;
          });
          setHistory(mergedHistory);
        } else {
          setHistory(localHistory);
        }
      } catch (err) {
        console.error('Failed to fetch backend history:', err);
        const savedHistory = localStorage.getItem('queryHistory');
        if (savedHistory) {
          try {
            setHistory(JSON.parse(savedHistory));
          } catch {
            setHistory([]);
          }
        }
      }
    };

    initializeApp();
  }, []);

  const handleDatabaseSelect = async (hash) => {
    try {
      // Save current state before switching
      dbCacheRef.current[activeDbName] = { result, query, isHistoryView, error, history, activePreviewTable };

      setSchemaLoading(true);
      await switchDatabase(hash);
      const schemaData = await fetchSchema();
      setSchema(schemaData);
      const info = await getDatabaseInfo();
      const newDbName = info?.database_name || "Custom Database";

      // Restore cached state for the new database, or reset if it's the first visit
      const cached = dbCacheRef.current[newDbName];
      setResult(cached?.result || null);
      setQuery(cached?.query || '');
      setIsHistoryView(cached?.isHistoryView || false);
      setError(cached?.error || null);
      setHistory(cached?.history || []);
      setActivePreviewTable(cached?.activePreviewTable || null);

      setActiveDbName(newDbName);
    } catch (e) {
      toast.error(e.message || "Failed to switch database");
    } finally {
      setSchemaLoading(false);
    }
  };

  // Poll health every 15 minutes
  useEffect(() => {
    const interval = setInterval(async () => {
      const healthData = await checkHealth();
      setHealth(healthData);
      setIsBackendReachable(healthData?.status === 'healthy' || healthData?.status === 'degraded');
    }, 900000); // 15 minutes in milliseconds

    return () => clearInterval(interval);
  }, []);

  // Save history to localStorage whenever it changes
  useEffect(() => {
    if (history.length > 0) {
      localStorage.setItem('queryHistory', JSON.stringify(history));
    }
  }, [history]);

  // Auto-scroll chat to bottom when history or loading state changes
  useEffect(() => {
    if (isChatMode) {
      const anchor = document.getElementById('chat-bottom-anchor');
      if (anchor) {
        anchor.scrollIntoView({ behavior: 'smooth' });
      }
    }
  }, [history, isLoading, isChatMode]);

  const handleSubmit = async (q = query) => {
    if (!q.trim()) return;

    setHasInteractedThisSession(true);
    setSubmittedQuery(q);
    setQuery('');
    setIsLoading(true);
    setError(null);
    setResult(null);
    setIsHistoryView(false);

    try {
      const response = await runQuery(q, { currentTable: activePreviewTable, autoSwitch: true });
      
      setResult(response);
      toast.success(`Query returned ${response.row_count} rows in ${response.execution_time_ms}ms`);

      // Add to history with all necessary display data cached for quick UI restoration
      const historyItem = {
        id: Date.now(),
        natural_language: q,
        sql: response.sql,
        row_count: response.row_count,
        execution_time_ms: response.execution_time_ms,
        created_at: new Date().toISOString(),
        success: true,
        // Cache these for local restoration when clicking history
        data: response.data,
        columns: response.columns,
        explanation: response.explanation,
        presentation_mode: response.presentation_mode,
        operation_type: response.operation_type,
        database_name: activeDbName,
        current_table: response.current_table || activePreviewTable || null
      };

      setHistory(prev => [historyItem, ...prev]);

      // If this query is a chatbot query, switch to Chat mode permanently for this session
      if (response.presentation_mode === 'chatbot') {
        setIsChatMode(true);
      }

      // Optionally save to backend history
      await saveToHistory(historyItem);

      // Auto-refresh schema and table viewer if data was modified
      if (['INSERT', 'UPDATE', 'DELETE'].includes(response.operation_type)) {
        fetchSchema().then(schemaData => setSchema(schemaData)).catch(console.error);
        setTableRefreshTrigger(prev => prev + 1);
      }

    } catch (err) {
      setError(err.message || 'Query failed. Please try again.');

      // Add failed query to history
      setHistory(prev => [
        {
          id: Date.now(),
          natural_language: q,
          sql: null,
          row_count: 0,
          created_at: new Date().toISOString(),
          success: false,
          error: err.message
        },
        ...prev
      ]);

    } finally {
      setIsLoading(false);
    }
  };


  const handleExecuteEditedSql = async (editedSql) => {
    setIsEditingSql(true);
    setError(null);
    try {
      const response = await executeSql(editedSql, query);
      setResult(response);
      toast.success(`SQL updated and executed successfully in ${response.execution_time_ms}ms`);

      if (['INSERT', 'UPDATE', 'DELETE'].includes(response.operation_type)) {
        fetchSchema().then(schemaData => setSchema(schemaData)).catch(console.error);
        setTableRefreshTrigger(prev => prev + 1);
      }
    } catch (err) {
      toast.error(err.message || 'Execution failed');
    } finally {
      setIsEditingSql(false);
    }
  };

  const handleSuggestionClick = (suggestion) => {
    setQuery(suggestion);
    handleSubmit(suggestion);
  };

  const handleHistoryClick = async (item) => {
    setHasInteractedThisSession(true);
    setSubmittedQuery(item.natural_language);
    setQuery('');

    // If the history item was successful, instantly restore the view from cache
    if (item.success !== false && item.sql) {
      setIsHistoryView(true);
      setError(null);

      let tableName = item.current_table;
      if (!tableName && item.sql) {
        const match = item.sql.match(/(?:FROM|INTO|UPDATE)\s+["']?([a-zA-Z0-9_]+)["']?/i);
        if (match && match[1]) {
          tableName = match[1];
        }
      }
      
      if (tableName && schema?.tables?.some(t => t.name.toLowerCase() === tableName.toLowerCase())) {
        const correctCaseName = schema.tables.find(t => t.name.toLowerCase() === tableName.toLowerCase()).name;
        setActivePreviewTable(correctCaseName);
      }

      // If we don't have the rich data (e.g. from an old backend history record), fetch it via executeSql
      if (!item.data || item.data.length === 0) {
        setIsLoading(true);
        try {
          const freshData = await executeSql(item.sql);
          setResult({
            sql: freshData.sql,
            data: freshData.data || [],
            columns: freshData.columns || [],
            row_count: freshData.row_count || 0,
            execution_time_ms: freshData.execution_time_ms || 0,
            explanation: item.explanation || 'No AI explanation available for this older historical query.',
            presentation_mode: item.presentation_mode
          });
        } catch (err) {
          setIsHistoryView(false);
          setResult(null);
          setError('Failed to fetch historical data: ' + err.message);
        } finally {
          setIsLoading(false);
        }
      } else {
        setResult({
          sql: item.sql,
          data: item.data || [],
          columns: item.columns || [],
          row_count: item.row_count || 0,
          execution_time_ms: item.execution_time_ms || 0,
          explanation: item.explanation || 'Historical execution restored from local history.',
          presentation_mode: item.presentation_mode
        });
      }
    } else {
      // If it previously failed, or doesn't have data, just populate the search bar
      setIsHistoryView(false);
      setResult(null);
      setError(item.error || 'This query previously failed. Edit and run again.');
    }
  };

  const clearHistory = async () => {
    const loadingToast = toast.loading('Deleting history from server...');
    try {
      await clearHistoryAPI();
      setHistory([]);
      localStorage.removeItem('queryHistory');
      toast.success('History deleted successfully', { id: loadingToast });
    } catch (error) {
      toast.error('Failed to delete history', { id: loadingToast });
    }
  };

  const retryConnection = async () => {
    setError(null);
    const healthData = await checkHealth();
    setHealth(healthData);
    setIsBackendReachable(healthData?.status === 'healthy' || healthData?.status === 'degraded');

    if (isBackendReachable) {
      // Reload schema
      try {
        const schemaData = await fetchSchema();
        setSchema(schemaData);
      } catch (err) {
        setError('Failed to load schema after reconnection.');
      }
    } else {
      setError('Still cannot connect to server. Please check if backend is running.');
    }
  };

  const handleUploadSuccess = async (data) => {
    // Cache current DB state before switching to new one
    if (activeDbName) {
      dbCacheRef.current[activeDbName] = { result, query, isHistoryView, error, history, activePreviewTable };
    }
    
    setDbInfo(data);
    setUploadError(null);
    setSchemaLoading(true);

    try {
      if (data.switched_active || !activeDbName || activeDbName === "Default Database") {
        // Refresh schema
        const schemaData = await fetchSchema();
        setSchema(schemaData);
        
        const info = await getDatabaseInfo();
        const newDbName = info?.database_name || "Custom Database";
        setActiveDbName(newDbName);
        
        // Clear current UI state for the newly uploaded DB
        setResult(null);
        setQuery('');
        setIsHistoryView(false);
        setError(null);
        setHistory([]);
        setActivePreviewTable(null);
      } else {
        // Did not switch active db, just trigger SchemaExplorer to refresh
        setDbUploadTrigger(prev => prev + 1);
      }
    } catch (err) {
      setError('Failed to refresh schema after upload');
    } finally {
      setSchemaLoading(false);
      setShowUploadModal(false);
    }
  };

  const handleUploadError = (error) => {
    setUploadError(error);
  };

  const handleDatabaseDeleted = async (deletedDbHash, result) => {
    // Refresh DB list and if the active one was deleted, reset state
    try {
      if (result && result.was_active) {
        setSchema(null);
        setActiveDbName("Default Database");
        setHistory([]);
        setResult(null);
        setQuery('');
        setActivePreviewTable(null);
        
        // Fetch new default schema if available
        const info = await getDatabaseInfo();
        setActiveDbName(info?.database_name || "Custom Database");
        const schemaData = await fetchSchema();
        setSchema(schemaData);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const chatMessages = useMemo(() => {
    const msgs = [];
    [...history].reverse().forEach(item => {
      msgs.push({
        type: 'user',
        content: item.natural_language,
        timestamp: item.created_at
      });
      msgs.push({
        type: 'assistant',
        content: item.success === false ? (item.error || 'Execution failed') : (item.explanation || 'Here are the results of your query.'),
        timestamp: item.created_at,
        result: item, // Pass the whole item even on error to access suggested_fix
        error: item.success === false ? (item.error || 'Execution failed') : null,
        originalQuery: item.natural_language
      });
    });
    
    if (isLoading && submittedQuery) {
      msgs.push({
        type: 'user',
        content: submittedQuery,
        timestamp: new Date().toISOString()
      });
    }
    
    return msgs;
  }, [history, isLoading, submittedQuery]);

  return (
    <div className="min-h-screen flex flex-col font-sans transition-colors text-slate-900 dark:text-slate-100">
      {/* Premium Floating Header */}
      <header className="sticky top-0 z-50 bg-white/80 dark:bg-slate-900/80 backdrop-blur-xl border-b border-slate-200/50 dark:border-slate-700/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo - Enhanced with Gradient */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/25">
                  <Bot size={20} strokeWidth={2.5} className="text-white" />
                </div>
                {/* Pulsing ring */}
                <div className="absolute inset-0 rounded-xl bg-blue-500/20 animate-pulse-ring"></div>
              </div>

              <div>
                <span className="text-xl font-extrabold bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-400 bg-clip-text text-transparent">
                  NL2SQL
                </span>
                <span className="ml-2 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/25">
                  AI
                </span>
              </div>

              {/* Status Indicator - Glowing */}
              <div className="flex items-center gap-2 ml-4">
                <div className={`relative ${isBackendReachable ? 'w-2.5 h-2.5' : 'w-2 h-2'}`}>
                  <div className={`absolute inset-0 rounded-full ${isBackendReachable ? 'bg-emerald-400' : 'bg-rose-400'}`}></div>
                  {isBackendReachable && (
                    <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75"></div>
                  )}
                </div>
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  {isBackendReachable ? 'Connected' : 'Disconnected'}
                </span>
              </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center gap-2">
              {/* Keyboard Shortcuts */}
              <div className="hidden sm:block">
                <Tooltip content="Keyboard Shortcuts (Ctrl+/)" position="bottom">
                  <button
                    onClick={() => setShowShortcuts(true)}
                    className="w-9 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center text-slate-600 dark:text-slate-400"
                  >
                    <Keyboard size={18} />
                  </button>
                </Tooltip>
              </div>
              {/* Upload DB Button - Enhanced */}
              <Tooltip content="Upload a SQLite database" position="bottom">
                <button
                  onClick={() => { setDbInfo(null); setUploadError(null); setShowUploadModal(true); }}
                  className="px-4 py-2 text-sm font-medium rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-lg shadow-emerald-500/25 hover:shadow-emerald-500/40 transition-all duration-200 hover:scale-105 flex items-center gap-2"
                >
                  <Upload size={16} />
                  <span className="hidden sm:inline">Upload DB</span>
                </button>
              </Tooltip>

              {/* Schema Toggle - Enhanced */}
              <Tooltip content="Toggle schema sidebar (Ctrl+S)" position="bottom">
                <button
                  onClick={() => setShowSchema(!showSchema)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${showSchema
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/25'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                >
                  <LayoutPanelLeft size={16} />
                  <span className="hidden sm:inline">Schema</span>
                </button>
              </Tooltip>

              {/* History Toggle - Enhanced */}
              <Tooltip content="Toggle history sidebar (Ctrl+H)" position="bottom">
                <button
                  onClick={() => setShowHistory(!showHistory)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 flex items-center gap-2 ${showHistory
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 text-white shadow-lg shadow-blue-500/25'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'
                    }`}
                >
                  <History size={16} />
                  <span className="hidden sm:inline">History</span>
                </button>
              </Tooltip>

              {/* Dark Mode Toggle - Enhanced */}
              <Tooltip content={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} position="bottom">
                <button
                  onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                  className="w-9 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors flex items-center justify-center text-slate-600 dark:text-slate-400"
                >
                  {mounted ? (theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />) : <Sun size={18} />}
                </button>
              </Tooltip>
            </div>
          </div>
        </div>
      </header>

      {/* Error Banner */}
      {error && (
        <div className="max-w-[1600px] mx-auto w-full px-4 pt-4 relative z-20">
          <ErrorDisplay 
            error={error} 
            onRetry={!isBackendReachable ? retryConnection : null} 
            onSwitchTable={(table) => setActivePreviewTable(table)}
          />
        </div>
      )}

      {/* Main Content Layout */}
      <div className="flex-1 flex overflow-hidden max-w-[1600px] mx-auto w-full relative">

        {/* Schema Sidebar */}
        <AnimatePresence initial={false}>
          {showSchema && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border-r border-white/40 dark:border-slate-700/50 h-[calc(100vh-104px)] hidden md:flex flex-col rounded-tr-3xl shadow-sm p-4 md:p-6"
            >
              <SchemaExplorer
                schema={schema}
                loading={schemaLoading}
                error={error && !isBackendReachable}
                onSelectDatabase={handleDatabaseSelect}
                activeDbName={activeDbName}
                onPreviewTable={(tableName) => setActivePreviewTable(tableName)}
                activePreviewTable={activePreviewTable}
                onDatabaseDeleted={handleDatabaseDeleted}
                refreshTrigger={dbUploadTrigger}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Content Area */}
        <motion.div layout transition={{ duration: 0.15, ease: 'easeOut' }} className="flex-1 flex flex-col h-[calc(100vh-104px)] overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key="page-content"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="flex-1 p-4 md:p-6 h-full overflow-hidden"
            >
              <motion.div layout className={`mx-auto h-full ${isSplitView ? 'max-w-none flex flex-row-reverse gap-6' : 'max-w-5xl flex flex-col'}`}>

                {/* Right Side: Query & Chat Area */}
                <motion.div layout className="flex-1 min-w-0 flex flex-col h-full relative">

                  {/* Scrollable Results Area */}
                  <div className="flex-1 overflow-y-auto pb-6 custom-scrollbar pr-2 flex flex-col">
                    {((!hasInteractedThisSession && !activePreviewTable) || (chatMessages.length === 0 && !isLoading)) && (
                      <div className="flex flex-col items-center justify-center flex-1 w-full">
                        <div className="mb-8 text-center animate-in fade-in slide-in-from-bottom-4 duration-700">
                          <h2 className="text-4xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-slate-800 to-slate-500 dark:from-slate-100 dark:to-slate-400 mb-3 tracking-tight py-1 leading-normal">
                            Talk to your database
                          </h2>
                          <p className="text-slate-500 dark:text-slate-400 text-lg">
                            Ask questions in plain English and get instant SQL insights.
                          </p>
                        </div>
                        {isSplitView && (
                          <QuerySuggestions
                            suggestions={dynamicSuggestions}
                            loading={suggestionsLoading}
                            onSuggestionClick={handleSuggestionClick}
                            disabled={isLoading || !isBackendReachable}
                            tableName={activePreviewTable}
                            onRefresh={() => loadTableSuggestions(activePreviewTable, true)}
                          />
                        )}
                      </div>
                    )}

                    {/* Render ChatContainer for all interactions once interacted */}
                    {(!(!hasInteractedThisSession && !activePreviewTable) && (chatMessages.length > 0 || isLoading)) && (
                      <div className="flex-1 flex flex-col h-full w-full">
                      <ChatContainer
                        messages={chatMessages}
                        isLoading={isLoading}
                        onRegenerate={() => {
                          if (history.length > 0) {
                             const lastQuery = history[0].natural_language;
                             handleSubmit(lastQuery);
                          }
                        }}
                        onRetry={(q) => handleSubmit(q)}
                      />
                    </div>
                    )}
                    
                    {/* Invisible div to scroll to bottom */}
                    <div id="chat-bottom-anchor" style={{ float:"left", clear: "both" }} />
                  </div>

                  {/* Anchored Input Area at bottom */}
                  <div className="pt-2 mt-auto">

                    <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.05)] dark:shadow-[0_0_40px_rgba(0,0,0,0.3)] border border-white/40 dark:border-slate-700/50 p-2">

                      <QueryInput
                        value={query}
                        onChange={(val) => {
                          setQuery(val);
                          setIsHistoryView(false);
                        }}
                        onSubmit={handleSubmit}
                        isLoading={isLoading}
                        disabled={schemaLoading || isHistoryView}
                        error={error}
                        tableSelector={
                          <TableContextIndicator 
                            currentTable={activePreviewTable}
                            availableTables={schema?.tables?.map(t => t.name) || []}
                            onSwitchTable={(table) => {
                              setActivePreviewTable(table);
                              setHasInteractedThisSession(true);
                            }}
                            className="z-50"
                          />
                        }
                      />
                      {!isBackendReachable && (
                        <div className="mt-3 px-4 py-2 bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm rounded-lg border border-red-100 dark:border-red-900/30 flex items-center gap-2">
                          <AlertTriangle size={16} /> Backend is not reachable. Please start the server on port 8000.
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>

                {/* Left Side: Table Data Viewer (Split View Only) */}
                {isSplitView && (
                  <motion.div
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="flex-1 min-w-0 h-full overflow-hidden bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border border-slate-200/50 dark:border-slate-800/50 rounded-2xl shadow-sm flex flex-col"
                  >
                    <TableDataViewer
                      tableName={activePreviewTable}
                      onClose={() => setActivePreviewTable(null)}
                      refreshTrigger={tableRefreshTrigger}
                      onSwitchTable={(newTableName) => setActivePreviewTable(newTableName)}
                    />
                  </motion.div>
                )}

              </motion.div>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        {/* History Sidebar */}
        <AnimatePresence initial={false}>
          {showHistory && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 340, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.15, ease: "easeOut" }}
              className="bg-white/60 dark:bg-slate-900/60 backdrop-blur-md border-l border-white/40 dark:border-slate-700/50 h-[calc(100vh-104px)] hidden lg:flex flex-col transition-colors rounded-tl-3xl shadow-sm p-4 md:p-6"
            >
              <QueryHistory
                history={history}
                onSelect={handleHistoryClick}
                onClearHistory={clearHistory}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Upload Modal */}
      <AnimatePresence>
        {showUploadModal && (
          <motion.div 
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm"
              onClick={() => setShowUploadModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.1)] dark:shadow-[0_8px_32px_rgba(0,0,0,0.4)] border border-white/50 dark:border-slate-700/50 max-w-md w-full p-6 transition-colors relative overflow-hidden z-10"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Ambient glow */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-emerald-500/20 dark:bg-emerald-500/10 blur-[50px] rounded-full pointer-events-none"></div>

              <div className="flex items-center justify-between mb-6 relative z-10">
                <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-slate-100 flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                </div>
                Database Upload
              </h2>
              <button
                onClick={() => setShowUploadModal(false)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
              </button>
            </div>

            <UploadDatabase
              onUploadSuccess={handleUploadSuccess}
              onUploadError={handleUploadError}
              isProcessing={schemaLoading}
            />

            {uploadError && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg flex items-start gap-2">
                <AlertTriangle size={16} className="text-red-500 mt-0.5" />
                <p className="text-red-600 dark:text-red-400 text-sm">{uploadError}</p>
              </div>
            )}

            {dbInfo && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-start gap-2">
                  <CheckCircle size={16} className="text-green-500 mt-0.5" />
                  <div>
                    <p className="text-green-700 dark:text-green-400 text-sm font-medium">{dbInfo.message}</p>
                    {dbInfo.tables && (
                      <p className="text-green-600 dark:text-green-500 text-xs mt-1">Tables: {dbInfo.tables.join(', ')}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </motion.div>
        </motion.div>
        )}
      </AnimatePresence>

      <KeyboardShortcutsModal 
        isOpen={showShortcuts} 
        onClose={() => setShowShortcuts(false)} 
      />
    </div>
  );
}
