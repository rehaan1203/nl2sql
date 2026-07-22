import { useEffect, useRef } from 'react';
import ChatMessage from './ChatMessage';
import ChatSkeleton from './ChatSkeleton';
import TypingIndicator from './TypingIndicator';

export default function ChatContainer({ messages, isLoading, onRegenerate, onRetry }) {
  const scrollRef = useRef(null);
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);
  
  if (messages.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-slate-500 dark:text-slate-400 min-h-[400px]">
        <div className="text-5xl mb-4 opacity-50">💬</div>
        <p className="text-lg font-medium text-slate-700 dark:text-slate-300">No messages yet</p>
        <p className="text-sm mt-2 max-w-md text-center">Ask a question about your data to get started. I can help you analyze tables, generate charts, and write SQL.</p>
      </div>
    );
  }
  
  return (
    <div 
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      style={{ height: 'calc(100vh - 220px)' }}
    >
      {messages.map((message, index) => (
        <ChatMessage
          key={index}
          type={message.type}
          content={message.content}
          timestamp={message.timestamp}
          result={message.result}
          isStreaming={message.isStreaming}
          onRegenerate={message.type === 'assistant' && index === messages.length - 1 ? onRegenerate : undefined}
          onRetry={onRetry}
          originalQuery={message.originalQuery}
          suggestedFix={message.result?.suggested_fix}
          error={message.error}
        />
      ))}
      
      {isLoading && (
        <div className="flex flex-col">
          <div className="flex justify-start mb-2">
            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl rounded-tl-sm shadow-sm inline-block">
               <TypingIndicator />
            </div>
          </div>
          <ChatSkeleton />
        </div>
      )}
    </div>
  );
}
