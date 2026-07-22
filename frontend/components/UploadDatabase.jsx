// components/UploadDatabase.js - Database upload component

import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { uploadDatabase } from '../lib/api';
import { Database, UploadCloud, ArrowUp } from 'lucide-react';

export default function UploadDatabase({ onUploadSuccess, onUploadError, isProcessing = false }) {
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(0);
  const fileInputRef = useRef(null);

  const handleFileSelect = (event) => {
    const file = event.target.files[0];
    if (file) {
      const validExtensions = ['.db', '.sqlite', '.sqlite3'];
      const fileExt = file.name.split('.').pop().toLowerCase();
      
      if (!validExtensions.includes('.' + fileExt)) {
        onUploadError('Invalid file type. Please upload a .db, .sqlite, or .sqlite3 file.');
        return;
      }
      
      if (file.size > 50 * 1024 * 1024) {
        onUploadError('File too large. Maximum size is 50MB.');
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setIsUploading(true);
    setUploadProgress(0);

    try {
      // Simulate progress before the request finishes for better UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const data = await uploadDatabase(selectedFile);
      
      clearInterval(progressInterval);
      setUploadProgress(100);
      
      // Success callback
      if (onUploadSuccess) {
        await onUploadSuccess(data);
      }
      
      // We don't reset selectedFile immediately here anymore, 
      // as the parent will close the modal when processing finishes.
      setIsUploading(false);

    } catch (error) {
      onUploadError(error.message || 'Upload failed. Please try again.');
      setIsUploading(false);
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  return (
    <div className="glass-panel rounded-xl p-4 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-amber-500" />
          <h3 className="font-semibold text-slate-900 dark:text-slate-100">Upload Database</h3>
        </div>
        <span className="text-xs text-slate-500 dark:text-slate-400">SQLite only</span>
      </div>

      <div className="space-y-3">
        {/* File input */}
        <div className="relative">
          <input
            ref={fileInputRef}
            type="file"
            accept=".db,.sqlite,.sqlite3"
            onChange={handleFileSelect}
            className="hidden"
            id="db-upload"
          />
          <label
            htmlFor="db-upload"
            className="flex items-center justify-center w-full p-4 border-2 border-dashed border-slate-200 dark:border-slate-700/50 rounded-lg hover:border-indigo-400 dark:hover:border-indigo-500 transition-colors cursor-pointer bg-slate-50/50 dark:bg-slate-900/30 hover:bg-slate-100 dark:hover:bg-slate-800/50 group"
          >
            <div className="text-center">
              <div className="flex justify-center mb-2 transition-transform group-hover:scale-110">
                <UploadCloud className="w-10 h-10 text-indigo-500" strokeWidth={1.5} />
              </div>
              {selectedFile ? (
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300">{selectedFile.name}</p>
              ) : (
                <>
                  <p className="text-sm text-slate-600 dark:text-slate-400 group-hover:text-slate-700 dark:group-hover:text-slate-300 transition-colors">Click to upload a SQLite database</p>
                  <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">.db, .sqlite, .sqlite3 up to 50MB</p>
                </>
              )}
            </div>
          </label>
        </div>

        {/* Upload button */}
        {selectedFile && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleUpload}
              disabled={isUploading || isProcessing}
              className="flex-1 px-4 py-2 bg-gradient-to-r from-indigo-500 to-violet-500 hover:shadow-lg disabled:opacity-50 text-white rounded-lg font-medium transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95"
            >
              {(isUploading || isProcessing) ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  {isProcessing ? 'Analyzing schema...' : 'Uploading...'}
                </>
              ) : (
                <>
                  <ArrowUp className="w-4 h-4" />
                  Upload Database
                </>
              )}
            </button>
            <button
              onClick={() => {
                setSelectedFile(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              disabled={isUploading || isProcessing}
              className="px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 rounded-lg font-medium transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
          </div>
        )}

        {/* Progress bar */}
        {(isUploading || isProcessing) && (
          <div className="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2 overflow-hidden mt-3">
            <motion.div
              className="bg-indigo-500 h-full rounded-full"
              initial={{ width: 0 }}
              animate={{ width: isProcessing ? '100%' : `${uploadProgress}%` }}
              transition={{ duration: 0.2 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
