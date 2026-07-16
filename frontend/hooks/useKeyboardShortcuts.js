// frontend/hooks/useKeyboardShortcuts.js - Enhanced version

import { useEffect, useState } from 'react';

export function useKeyboardShortcuts({
  onRunQuery,
  onFocusInput,
  onToggleSchema,
  onToggleHistory,
  onClearResults,
  onNewThread,
  onToggleDarkMode,
  onExportResults,
}) {
  const [showShortcuts, setShowShortcuts] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Enter: Run query (only if not holding modifier keys that would mean something else)
      // We don't prevent default here as it might break normal button clicks
      // But we will call onRunQuery if it's pressed. The actual component might want to 
      // check if it's in an input or not, but per requirements it's just 'Enter'.
      // Note: we'll use a specific check to avoid triggering on every enter if possible,
      // but the requirement is "enter only not ctrl + enter".
      if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
        // Only prevent default if we're going to handle it, but wait, usually Enter in a text area should be shift+enter for new line.
        // Let's just pass it to onRunQuery.
        // It's safer to only prevent default if we are sure it's the intended target, but we'll follow the exact instruction.
        // Actually we shouldn't prevent default indiscriminately for Enter.
        // e.preventDefault();
        onRunQuery?.();
      }
      
      // Ctrl+K or Cmd+K: Focus search input
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        onFocusInput?.();
      }
      
      // Ctrl+S or Cmd+S: Toggle schema
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onToggleSchema?.();
      }
      
      // Ctrl+H or Cmd+H: Toggle history
      if ((e.ctrlKey || e.metaKey) && e.key === 'h') {
        e.preventDefault();
        onToggleHistory?.();
      }
      
      // Ctrl+Shift+C or Cmd+Shift+C: Clear results
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        onClearResults?.();
      }
      
      // Ctrl+Shift+N or Cmd+Shift+N: New thread
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'n' || e.key === 'N')) {
        e.preventDefault();
        onNewThread?.();
      }
      
      // Ctrl+Shift+D or Cmd+Shift+D: Toggle dark mode
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        onToggleDarkMode?.();
      }
      
      // Ctrl+Shift+E or Cmd+Shift+E: Export results
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'e' || e.key === 'E')) {
        e.preventDefault();
        onExportResults?.();
      }
      
      // Ctrl+/ or Cmd+/: Show shortcuts help
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault();
        setShowShortcuts(prev => !prev);
      }
      
      // Escape: Close shortcuts modal
      if (e.key === 'Escape' && showShortcuts) {
        setShowShortcuts(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    onRunQuery,
    onFocusInput,
    onToggleSchema,
    onToggleHistory,
    onClearResults,
    onNewThread,
    onToggleDarkMode,
    onExportResults,
    showShortcuts
  ]);

  return { showShortcuts, setShowShortcuts };
}
