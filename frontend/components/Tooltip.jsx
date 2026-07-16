// frontend/components/Tooltip.jsx

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export default function Tooltip({ children, content, position = 'top' }) {
  const [isVisible, setIsVisible] = useState(false);
  
  const positionClasses = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };
  
  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <div className={`absolute z-50 whitespace-nowrap ${positionClasses[position]} pointer-events-none`}>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
            >
              <div className="px-3 py-1.5 bg-slate-800 dark:bg-slate-700 text-white text-xs rounded-lg shadow-lg relative">
                {content}
                <div className="absolute w-2.5 h-2.5 bg-slate-800 dark:bg-slate-700 rotate-45 -z-10 rounded-sm"
                  style={{
                    [position === 'top' ? 'bottom' : position === 'bottom' ? 'top' : position === 'left' ? 'right' : 'left']: '-4px',
                    [position === 'top' || position === 'bottom' ? 'left' : 'top']: '50%',
                    [position === 'top' || position === 'bottom' ? 'marginLeft' : 'marginTop']: '-5px'
                  }}
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
