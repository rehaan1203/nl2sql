'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Table, LineChart, Code2, Lightbulb, Sparkles, X } from 'lucide-react';
import DataTable from './DataTable';
import EnhancedChartView from './EnhancedChartView';
import SQLEditor from './SQLEditor';
import ExportButton from './ExportButton';
import TypewriterText from './TypewriterText';
import ExplanationTab from './ExplanationTab';

export default function ResultsPanel({ result, isLoading, onExecuteSql, onClose }) {
  const isSelect = !result || !result.operation_type || result.operation_type === 'SELECT';
  const presentationMode = result?.presentation_mode || (isSelect ? 'data_viz' : 'crud');
  const isChatbot = presentationMode === 'chatbot';
  const isDataViz = presentationMode === 'data_viz';
  
  const [activeTab, setActiveTab] = useState(isChatbot ? null : (isDataViz ? 'table' : 'sql'));

  useEffect(() => {
    if (result) {
      const mode = result.presentation_mode || (isSelect ? 'data_viz' : 'crud');
      if (mode === 'chatbot') setActiveTab(null);
      else if (mode === 'data_viz') setActiveTab('table');
      else setActiveTab('sql');
    }
  }, [result]);

  if (isLoading) {
    return (
      <div className="w-full bg-white dark:bg-slate-950 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 p-6 transition-colors">
        <div className="animate-pulse flex flex-col gap-4">
          <div className="h-10 bg-slate-100 dark:bg-slate-900 rounded-md w-full mb-4"></div>
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-12 bg-slate-50 dark:bg-slate-900/50 rounded-md w-full"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!result) return null;

  const displayData = isDataViz ? result.data : (result.refreshed_data || []);
  const hasData = displayData && displayData.length > 0;

  if (isChatbot) {
    return (
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full bg-white dark:bg-slate-950 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 p-6 flex flex-col gap-4 transition-colors relative"
      >
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 flex items-center justify-center p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
            title="Close Result"
          >
            <X size={18} />
          </button>
        )}
        <div className="flex items-start gap-4">
          <div className="bg-blue-100 dark:bg-blue-900/50 p-3 rounded-full text-blue-600 dark:text-blue-400 mt-1">
            <Lightbulb size={24} />
          </div>
          <div className="flex-1 pr-8">
            <p className="text-slate-700 dark:text-slate-200 leading-relaxed text-lg font-medium">
              {result.explanation}
            </p>
          </div>
        </div>
        
        {/* SQL Toggle */}
        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-800">
          <button 
            onClick={() => setActiveTab(activeTab === 'sql' ? null : 'sql')}
            className="text-sm flex items-center gap-2 text-slate-500 hover:text-blue-600 transition-colors font-medium"
          >
            <Code2 size={16} />
            {activeTab === 'sql' ? 'Hide SQL Query' : 'View SQL Query'}
          </button>
          
          <AnimatePresence>
            {activeTab === 'sql' && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4"
              >
                <SQLEditor sql={result.sql || ''} readOnly={true} executionTime={result.execution_time_ms} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    );
  }

  if (!hasData && isDataViz) {
    return (
      <div className="bg-white dark:bg-slate-950 rounded-xl shadow-sm border border-slate-200 dark:border-slate-800 p-8 text-center transition-colors">
        <p className="text-slate-500 dark:text-slate-400">No results found for your query.</p>
        {result.sql && (
          <div className="mt-4 p-4 bg-slate-50 dark:bg-slate-900 rounded-lg text-left text-xs font-mono text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-800 overflow-x-auto">
            {result.sql}
          </div>
        )}
      </div>
    );
  }

  const tabs = [
    ...(isDataViz || hasData ? [{ id: 'table', label: 'Results Table', icon: Table }] : []),
    ...(isDataViz ? [{ id: 'chart', label: 'Chart', icon: LineChart }] : []),
    { id: 'sql', label: 'SQL Query', icon: Code2 },
    { id: 'explanation', label: 'AI Analysis', icon: Sparkles }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full bg-white dark:bg-slate-950 rounded-xl shadow-md border border-slate-200 dark:border-slate-800 overflow-hidden flex flex-col transition-colors"
    >
      <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 px-4 bg-white dark:bg-slate-950 transition-colors relative z-20">
        <div className="flex overflow-x-auto overflow-y-hidden hide-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`relative flex items-center gap-2 px-4 py-3.5 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-900'
              }`}
            >
              <tab.icon size={16} className={activeTab === tab.id ? 'text-blue-600 dark:text-blue-400' : 'text-slate-400 dark:text-slate-500'} />
              {tab.label}
              {activeTab === tab.id && (
                <motion.div 
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-[3px] bg-blue-600 rounded-t-sm"
                />
              )}
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-4 py-2">
          {result.execution_time_ms && (
            <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 rounded-md font-medium shadow-sm transition-colors">
              <Clock size={14} className="text-slate-400 dark:text-slate-500" />
              {result.execution_time_ms}ms
            </div>
          )}
          <ExportButton data={result.data} />
          {onClose && (
            <button
              onClick={onClose}
              className="flex items-center justify-center p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors border border-transparent hover:border-slate-200 dark:hover:border-slate-700"
              title="Close Result"
            >
              <X size={18} />
            </button>
          )}
        </div>
      </div>

      <div className="p-4 bg-slate-50/50 dark:bg-slate-900/50 flex-grow min-h-[350px] transition-colors">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            transition={{ duration: 0.15 }}
            className="h-full"
          >
            {activeTab === 'table' && <DataTable data={displayData} />}
            {activeTab === 'chart' && isDataViz && <EnhancedChartView data={displayData} columns={result.columns || (displayData.length > 0 ? Object.keys(displayData[0]) : [])} isLoading={isLoading} />}
            {activeTab === 'sql' && <SQLEditor sql={result.sql} executionTime={result.execution_time_ms} onExecuteSql={onExecuteSql} />}
            {activeTab === 'explanation' && (
              <ExplanationTab 
                explanation={result.explanation}
                isLoading={false}
                result={result}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
