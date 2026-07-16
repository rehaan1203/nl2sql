// frontend/components/EmptyState.jsx - Enhanced version

import { motion } from 'framer-motion';
import { BarChart3, Search, ClipboardList, Sparkles } from 'lucide-react';

export default function EmptyState({ 
  type = 'no_data', 
  title, 
  description, 
  action, 
  actionLabel,
  icon 
}) {
  const configs = {
    no_data: {
      icon: <BarChart3 size={56} className="text-blue-500 mb-4 opacity-80" />,
      title: 'No Data Yet',
      description: 'Upload a database or run a query to get started.'
    },
    no_query: {
      icon: <Search size={56} className="text-blue-500 mb-4 opacity-80" />,
      title: 'No Queries Yet',
      description: 'Ask your first question about the data.'
    },
    no_results: {
      icon: <Search size={56} className="text-slate-400 mb-4 opacity-80" />,
      title: 'No Results Found',
      description: 'Try rephrasing your question or checking your data.'
    },
    no_tables: {
      icon: <ClipboardList size={56} className="text-slate-400 mb-4 opacity-80" />,
      title: 'No Tables Found',
      description: 'Upload a database with tables to start querying.'
    },
    welcome: {
      icon: <Sparkles size={56} className="text-purple-500 mb-4 opacity-80" />,
      title: 'Welcome to NL2SQL',
      description: 'Upload your database and start asking questions in plain English.'
    }
  };
  
  const config = configs[type] || configs.no_data;
  
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-4 text-center"
    >
      {icon || config.icon}
      <h3 className="text-xl font-semibold text-slate-800 dark:text-slate-200 mb-2">
        {title || config.title}
      </h3>
      <p className="text-slate-500 dark:text-slate-400 max-w-md mb-6">
        {description || config.description}
      </p>
      {action && (
        <button
          onClick={action}
          className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
        >
          {actionLabel || 'Get Started'}
        </button>
      )}
    </motion.div>
  );
}
