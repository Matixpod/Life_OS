// `computeCutoff` lives in `tasks/staminaCutoff.ts` to keep this file
// component-only (react-refresh/only-export-components).

interface StaminaCutoffLineProps {
  /** How many minutes the user is over their stamina budget. */
  overMinutes: number;
}

export default function StaminaCutoffLine({ overMinutes }: StaminaCutoffLineProps) {
  return (
    <div className="my-3 flex items-center gap-2 text-[11px] text-red-400">
      <div className="h-px flex-1 border-t border-dashed border-red-500/60" />
      <span className="rounded bg-red-500/15 px-2 py-0.5 font-mono">
        ⚠️ Przekroczono Staminę (+{overMinutes} min)
      </span>
      <div className="h-px flex-1 border-t border-dashed border-red-500/60" />
    </div>
  );
}
