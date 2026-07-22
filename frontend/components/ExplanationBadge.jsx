import { Sparkles } from 'lucide-react';

export default function ExplanationBadge({ hasExplanation }) {
  if (!hasExplanation) return null;
  
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 text-xs rounded-full ml-2">
      <Sparkles size={12} />
      AI Explained
    </span>
  );
}
