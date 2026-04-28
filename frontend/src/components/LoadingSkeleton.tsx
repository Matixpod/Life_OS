interface LoadingSkeletonProps {
  variant?: 'card' | 'gauge' | 'banner';
}

export default function LoadingSkeleton({ variant = 'card' }: LoadingSkeletonProps) {
  if (variant === 'gauge') {
    return <div className="size-[220px] rounded-full bg-surface2 animate-pulse" />;
  }
  if (variant === 'banner') {
    return <div className="h-14 rounded-xl bg-surface2 animate-pulse" />;
  }
  return (
    <div className="h-[120px] rounded-xl bg-surface border border-border p-4 animate-pulse">
      <div className="size-8 rounded-md bg-surface2 mb-3" />
      <div className="h-3 w-24 rounded bg-surface2 mb-2" />
      <div className="h-5 w-16 rounded bg-surface2" />
    </div>
  );
}
