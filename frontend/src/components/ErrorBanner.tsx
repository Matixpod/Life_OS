import { AlertTriangle } from 'lucide-react';

interface ErrorBannerProps {
  message: string;
  onRetry?: () => void;
}

export default function ErrorBanner({ message, onRetry }: ErrorBannerProps) {
  return (
    <div className="rounded-xl border border-accent-red/40 bg-accent-red/10 px-4 py-3 flex items-center gap-3">
      <AlertTriangle size={18} className="text-accent-red shrink-0" />
      <span className="text-sm flex-1">{message}</span>
      {onRetry && (
        <button
          onClick={onRetry}
          className="text-xs px-3 py-1 rounded-md bg-accent-red/20 hover:bg-accent-red/30"
        >
          Retry
        </button>
      )}
    </div>
  );
}
