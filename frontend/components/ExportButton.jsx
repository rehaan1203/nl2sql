// frontend/components/ExportButton.jsx - Enhanced version

import { useState, useRef, useEffect } from 'react';
import { useToast } from '../hooks/useToast';
import { motion, AnimatePresence } from 'framer-motion';
import { Download, Table as TableIcon, FileJson, FileText, Globe, Copy, Printer } from 'lucide-react';

export default function ExportButton({ data, columns, filename = 'query-results' }) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const { success, error } = useToast();
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  if (!data || data.length === 0) {
    return (
      <button 
        disabled 
        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 text-slate-400 rounded-lg text-sm cursor-not-allowed flex items-center gap-2"
      >
        <Download size={16} /> No Data
      </button>
    );
  }

  const exportCSV = () => {
    setIsExporting(true);
    
    try {
      // Create CSV
      const header = columns.join(',');
      const rows = data.map(row => 
        columns.map(col => {
          const val = row[col] ?? '';
          return typeof val === 'string' ? `"${val.replace(/"/g, '""')}"` : val;
        }).join(',')
      );
      
      const csv = [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      downloadFile(url, `${filename}.csv`);
      success('CSV exported successfully');
    } catch (err) {
      error('Failed to export CSV');
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const exportJSON = () => {
    setIsExporting(true);
    
    try {
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      downloadFile(url, `${filename}.json`);
      success('JSON exported successfully');
    } catch (err) {
      error('Failed to export JSON');
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const exportMarkdown = () => {
    setIsExporting(true);
    
    try {
      // Create markdown table
      const header = `| ${columns.join(' | ')} |`;
      const separator = `| ${columns.map(() => '---').join(' | ')} |`;
      const rows = data.map(row => 
        `| ${columns.map(col => row[col] ?? '').join(' | ')} |`
      );
      
      const markdown = [header, separator, ...rows].join('\n');
      const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      downloadFile(url, `${filename}.md`);
      success('Markdown exported successfully');
    } catch (err) {
      error('Failed to export Markdown');
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const exportHTML = () => {
    setIsExporting(true);
    
    try {
      // Create HTML table
      let html = '<table border="1" cellpadding="5" cellspacing="0">';
      html += '<thead><tr>';
      columns.forEach(col => {
        html += `<th>${col}</th>`;
      });
      html += '</tr></thead><tbody>';
      data.forEach(row => {
        html += '<tr>';
        columns.forEach(col => {
          html += `<td>${row[col] ?? ''}</td>`;
        });
        html += '</tr>';
      });
      html += '</tbody></table>';
      
      const blob = new Blob([html], { type: 'text/html;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      
      downloadFile(url, `${filename}.html`);
      success('HTML exported successfully');
    } catch (err) {
      error('Failed to export HTML');
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const copyToClipboard = async () => {
    setIsExporting(true);
    
    try {
      // Create markdown table for clipboard
      const header = `| ${columns.join(' | ')} |`;
      const separator = `| ${columns.map(() => '---').join(' | ')} |`;
      const rows = data.map(row => 
        `| ${columns.map(col => row[col] ?? '').join(' | ')} |`
      );
      
      const markdown = [header, separator, ...rows].join('\n');
      await navigator.clipboard.writeText(markdown);
      
      success('Copied to clipboard as Markdown table');
    } catch (err) {
      error('Failed to copy to clipboard');
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const downloadFile = (url, filename) => {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        className="px-3 py-1.5 bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 rounded-lg text-sm transition-colors flex items-center gap-1 disabled:opacity-50"
      >
        {isExporting ? (
          <div className="w-4 h-4 border-2 border-slate-500 border-t-transparent rounded-full animate-spin"></div>
        ) : (
          <><Download size={16} /> Export</>
        )}
      </button>
      
      <AnimatePresence>
        {isOpen && !isExporting && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute right-0 mt-1 w-48 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg overflow-hidden z-50"
          >
            <button
              onClick={exportCSV}
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
            >
              <TableIcon size={16} className="text-emerald-500" /> CSV
            </button>
            <button
              onClick={exportJSON}
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
            >
              <FileJson size={16} className="text-amber-500" /> JSON
            </button>
            <button
              onClick={exportMarkdown}
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
            >
              <FileText size={16} className="text-blue-500" /> Markdown
            </button>
            <button
              onClick={exportHTML}
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2"
            >
              <Globe size={16} className="text-purple-500" /> HTML
            </button>
            <button
              onClick={copyToClipboard}
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 border-t border-slate-200 dark:border-slate-700"
            >
              <Copy size={16} className="text-slate-500" /> Copy to Clipboard
            </button>
            <button
              onClick={() => window.print()}
              className="w-full text-left px-4 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors flex items-center gap-2 border-t border-slate-200 dark:border-slate-700"
            >
              <Printer size={16} className="text-slate-500" /> Print
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
