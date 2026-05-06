import { CalendarDays, ChevronRight, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ProjectV2 } from '../../types';
import { CATEGORY_COLORS, CATEGORY_LABELS_PL } from '../../types';

interface Props {
  project: ProjectV2;
  progress?: { total: number; done: number };
  onEdit?: () => void;
  onDelete?: () => void;
}

export default function ProjectCard({ project, progress, onEdit, onDelete }: Props) {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const cat = project.category;
  const color = cat ? CATEGORY_COLORS[cat].hex : project.color;
  const total = progress?.total ?? 0;
  const done = progress?.done ?? 0;
  const pct = total > 0 ? Math.round((done * 100) / total) : 0;

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent): void {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [menuOpen]);

  return (
    <div
      onClick={() => navigate(`/projects/${project.id}`)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && navigate(`/projects/${project.id}`)}
      className="group relative block overflow-hidden rounded-xl border border-border bg-surface transition-colors hover:border-accent-blue/60 cursor-pointer"
    >
      <div className="h-1.5" style={{ backgroundColor: color }} />
      <div className="p-4 space-y-3 relative">
        <div className="flex items-start gap-2 pr-6">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold truncate">{project.title}</div>
            {project.description && (
              <div className="mt-1 text-[11px] text-muted line-clamp-2">{project.description}</div>
            )}
          </div>
          <ChevronRight size={16} className="text-muted group-hover:text-white" />
        </div>
        
        <div className="absolute top-2 right-2" ref={menuRef}>
          <button
            type="button"
            aria-label="Project actions"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
            className="p-1 rounded text-muted hover:text-white hover:bg-surface2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
          >
            <MoreHorizontal size={16} />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-7 z-20 w-40 rounded-lg bg-surface2 border border-border shadow-lg py-1 animate-fade-in">
              {onEdit && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onEdit();
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-surface flex items-center gap-2"
                >
                  <Pencil size={13} /> Edytuj
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onDelete();
                  }}
                  className="w-full text-left px-3 py-2 text-sm hover:bg-surface flex items-center gap-2 text-accent-red"
                >
                  <Trash2 size={13} /> Usuń
                </button>
              )}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          {cat && (
            <span
              className="rounded px-1.5 py-0.5 font-mono"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {CATEGORY_LABELS_PL[cat]}
            </span>
          )}
          <span className="rounded bg-surface2 px-1.5 py-0.5 text-muted">{project.status}</span>
          {project.due_date && (
            <span className="inline-flex items-center gap-1 text-muted">
              <CalendarDays size={11} />
              <span className="font-mono">{project.due_date}</span>
            </span>
          )}
        </div>
        {total > 0 && (
          <div className="space-y-1">
            <div className="h-1 w-full overflow-hidden rounded-full bg-surface2">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-muted">
              <span className="font-mono">
                {done}/{total} zadań
              </span>
              <span className="font-mono">{pct}%</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
