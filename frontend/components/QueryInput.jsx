'use client';

import { useState, useRef } from 'react';
import { Play, X, Zap, Lock, BookOpen, Sparkles, Search, Mic } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function QueryInput({ value, onChange, onSubmit, isLoading, disabled = false, isHistoryView = false, error = null }) {
  const inputRef = useRef(null);
  
  // Audio state and refs
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const maxVolumeRef = useRef(0);
  const animationFrameRef = useRef(null);

  const KNOWN_HALLUCINATIONS = [
    'thank you.', 'thank you', 'you.', 'you', 'bye.', 'bye', '[silence]', '[blank]', '.', '..', 'thank you for watching.'
  ];

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!isLoading && !disabled && !isTranscribing && value.trim() && !isHistoryView) {
        onSubmit(value.trim());
      }
    }
  };

  const clearInput = () => {
    onChange('');
    inputRef.current?.focus();
  };

  const checkVolume = () => {
    if (!analyserRef.current) return;
    const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
    analyserRef.current.getByteTimeDomainData(dataArray);
    
    // Find the max deviation from 128 (silence)
    let currentMax = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const deviation = Math.abs(dataArray[i] - 128);
      if (deviation > currentMax) {
        currentMax = deviation;
      }
    }
    
    if (currentMax > maxVolumeRef.current) {
      maxVolumeRef.current = currentMax;
    }
    
    animationFrameRef.current = requestAnimationFrame(checkVolume);
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      maxVolumeRef.current = 0;

      // Set up volume detection
      const audioContext = new (window.AudioContext || window.webkitAudioContext)();
      audioContextRef.current = audioContext;
      const analyser = audioContext.createAnalyser();
      analyserRef.current = analyser;
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      checkVolume();

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop volume checking
        if (animationFrameRef.current) {
          cancelAnimationFrame(animationFrameRef.current);
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
          audioContextRef.current.close();
        }

        const volumeThreshold = 3; // Out of 128 deviation
        if (maxVolumeRef.current < volumeThreshold) {
          console.log('No speech detected (volume too low). Max volume was:', maxVolumeRef.current);
          setIsTranscribing(false);
          stream.getTracks().forEach(track => track.stop());
          return;
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        setIsTranscribing(true);
        
        try {
          const formData = new FormData();
          formData.append('file', audioBlob, 'recording.webm');
          
          const response = await fetch('http://localhost:8000/api/audio/transcribe', {
            method: 'POST',
            body: formData,
          });
          
          if (response.ok) {
            const data = await response.json();
            if (data.text) {
              const cleanedText = data.text.trim();
              const lowerText = cleanedText.toLowerCase();
              
              if (cleanedText.length > 2 && !KNOWN_HALLUCINATIONS.includes(lowerText)) {
                onChange(cleanedText);
                onSubmit(cleanedText);
              } else {
                console.log('Transcription filtered (empty or hallucination):', cleanedText);
                onChange(''); // Clear the input if hallucinated
              }
            }
          } else {
            console.error('Transcription failed');
          }
        } catch (error) {
          console.error('Error during transcription:', error);
        } finally {
          setIsTranscribing(false);
          stream.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (error) {
      console.error('Error accessing microphone:', error);
      alert('Could not access the microphone. Please check your permissions.');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  const toggleRecording = () => {
    if (isRecording) {
      stopRecording();
    } else {
      startRecording();
    }
  };

  const isBusy = isLoading || isTranscribing;

  return (
    <div className="relative group w-full">
      {/* Glowing background effect */}
      <div className="absolute -inset-0.5 bg-gradient-to-r from-blue-500 to-purple-500 rounded-2xl opacity-20 group-focus-within:opacity-40 blur transition duration-500"></div>
      
      <div className={`relative bg-white dark:bg-slate-800 rounded-2xl shadow-lg shadow-slate-200/50 dark:shadow-slate-900/50 border ${
        error ? 'border-red-500/50' : isHistoryView ? 'border-blue-300 dark:border-blue-800/50 bg-blue-50/50 dark:bg-blue-950/40' : 'border-slate-200/50 dark:border-slate-700/50'
      }`}>
        <div className="flex items-center gap-2 p-1">
          {/* Search Icon */}
          <div className="pl-3 text-slate-400 dark:text-slate-500">
            {isHistoryView ? <Lock size={18} className="text-blue-500" /> : <Search size={18} strokeWidth={2.5} className="text-blue-500/70" />}
          </div>
          
          {/* Input */}
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isHistoryView ? "History view (read-only)" : (isRecording ? "Listening..." : "Ask anything about your data... e.g., 'How many users signed up from California last month?'")}
            className={`flex-1 min-w-0 py-3.5 bg-transparent text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none text-sm font-medium ${isHistoryView ? 'text-blue-900 dark:text-blue-400' : ''}`}
            disabled={isBusy || disabled || isHistoryView}
          />
          
          {/* Clear Button */}
          <AnimatePresence>
            {value && !isBusy && !isHistoryView && (
              <motion.button
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                onClick={clearInput}
                className="p-1.5 flex-shrink-0 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                title="Clear input"
              >
                <X size={18} />
              </motion.button>
            )}
          </AnimatePresence>
          
          {/* Mic Button */}
          {!isHistoryView && (
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={toggleRecording}
              disabled={isBusy || disabled}
              className={`p-3 flex-shrink-0 rounded-xl transition-all duration-300 relative ${
                isRecording 
                  ? 'bg-red-500 text-white shadow-[0_0_15px_rgba(239,68,68,0.5)]' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
              }`}
              title={isRecording ? 'Stop recording' : 'Speak your query'}
            >
              {isRecording && (
                <span className="absolute inset-0 rounded-xl bg-red-400 animate-ping opacity-75"></span>
              )}
              <Mic size={20} className={isRecording ? 'animate-pulse' : ''} />
            </motion.button>
          )}
          
          {/* Run Query Button - Enhanced */}
          <motion.button
            whileHover={(!value.trim() || isBusy || disabled || isHistoryView) ? {} : { scale: 1.02 }}
            whileTap={(!value.trim() || isBusy || disabled || isHistoryView) ? {} : { scale: 0.95 }}
            onClick={() => onSubmit(value)}
            disabled={!value.trim() || isBusy || disabled || isHistoryView}
            className={`px-6 py-3 flex-shrink-0 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 min-w-[120px] justify-center ${
              !value.trim() || isBusy || disabled || isHistoryView
                ? (isHistoryView ? 'bg-blue-100 dark:bg-blue-900/40 text-blue-500 dark:text-blue-400 cursor-not-allowed border border-blue-200 dark:border-blue-800' : 'bg-slate-100 dark:bg-slate-800/80 text-slate-400 cursor-not-allowed')
                : 'bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40'
            }`}
          >
            {isBusy ? (
              <>
                <div className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin"></div>
                <span>{isTranscribing ? 'Listening...' : 'Processing...'}</span>
              </>
            ) : isHistoryView ? (
              <>
                <Lock size={16} />
                <span>History</span>
              </>
            ) : (
              <>
                <Sparkles size={16} strokeWidth={2.5} />
                <span>Run Query</span>
              </>
            )}
          </motion.button>
        </div>
        
        {/* Footer Help Text */}
        <div className="flex items-center gap-4 px-4 pb-2.5 text-xs text-slate-400 dark:text-slate-500 flex-wrap">
          <span className="flex items-center gap-1">
            <span className="text-base">⚡</span> Powered by AI
          </span>
          <span className="w-px h-3 bg-slate-300 dark:bg-slate-700"></span>
          <span className="flex items-center gap-1">
            <span className="text-base">🔒</span> Private
          </span>
          <span className="w-px h-3 bg-slate-300 dark:bg-slate-700"></span>
          <span className="flex items-center gap-1">
            <span className="text-base">📖</span> Read-only mode
          </span>
        </div>
      </div>
    </div>
  );
}
