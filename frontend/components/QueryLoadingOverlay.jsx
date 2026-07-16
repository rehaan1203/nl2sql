// frontend/components/QueryLoadingOverlay.jsx

import { motion } from 'framer-motion';

export default function QueryLoadingOverlay({ message = 'Processing query...' }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-12"
    >
      <div className="relative">
        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-8 h-8 border-4 border-purple-500 border-b-transparent rounded-full animate-spin animate-delay-150"></div>
        </div>
      </div>
      <p className="mt-4 text-slate-600 dark:text-slate-400 font-medium">
        {message}
      </p>
      <p className="mt-1 text-sm text-slate-400 dark:text-slate-500">
        This may take a few seconds
      </p>
    </motion.div>
  );
}
