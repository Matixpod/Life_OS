import { ArrowLeft, Check, Plus, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { projectsApi } from '../../api/projects';
import type { ProjectFull, ProjectSectionWithTasks, ProjectTask } from '../../types';
import { CATEGORY_COLORS, CATEGORY_LABELS_PL } from '../../types';
import { PRIORITY_BORDER, PRIORITY_LABEL } from '../tasks/categories';
import ProjectForm from './ProjectForm';

interface ActionMenuProps {
  onEdit?: () => void;
  onDelete?: () => void;
}

function ActionMenu({ onEdit, onDelete }: ActionMenuProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative shrink-0" ref={ref}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        className="p-1 rounded text-muted hover:text-white hover:bg-surface2 opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 top-7 z-20 w-40 rounded-lg bg-surface2 border border-border shadow-lg py-1 animate-fade-in">
          {onEdit && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setOpen(false);
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
                setOpen(false);
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
  );
}

interface Props {
  projectId: string;
}

type Layout = 'list' | 'kanban';

export default function ProjectDetail({ projectId }: Props) {
  const [project, setProject] = useState<ProjectFull | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layout, setLayout] = useState<Layout>('list');
  const [editingProject, setEditingProject] = useState(false);
  const navigate = useNavigate();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const p = await projectsApi.get(projectId);
      setProject(p);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  if (loading && !project) {
    return <div className="h-64 animate-pulse rounded-xl border border-border bg-surface" />;
  }
  if (error) {
    return (
      <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
        {error}
      </div>
    );
  }
  if (!project) return null;

  const cat = project.category;
  const color = cat ? CATEGORY_COLORS[cat].hex : project.color;
  const pct = Math.round(project.progress.completion_percentage);

  async function addSection(): Promise<void> {
    const title = prompt('Nazwa sekcji:');
    if (!title?.trim()) return;
    await projectsApi.createSection(projectId, {
      title: title.trim(),
      position: (project?.sections.length ?? 0),
    });
    await load();
  }

  async function handleDeleteProject(): Promise<void> {
    if (!confirm('Czy na pewno chcesz usunąć ten projekt i wszystkie jego zadania?')) return;
    try {
      await projectsApi.deleteProject(projectId);
      navigate('/projects');
    } catch {
      alert('Błąd przy usuwaniu projektu');
    }
  }

  if (editingProject) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm">
          <button type="button" onClick={() => setEditingProject(false)} className="inline-flex items-center gap-1 text-muted hover:text-white">
            <ArrowLeft size={14} /> Wróć
          </button>
        </div>
        <ProjectForm 
          initial={project} 
          onCreated={() => {
            setEditingProject(false);
            void load();
          }}
          onCancel={() => setEditingProject(false)}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <Link to="/projects" className="inline-flex items-center gap-1 text-muted hover:text-white">
          <ArrowLeft size={14} /> Projekty
        </Link>
      </div>

      <header
        className="group overflow-hidden rounded-xl border border-border bg-surface relative"
        style={{ borderTopColor: color, borderTopWidth: 4 }}
      >
        <div className="absolute top-2 right-2">
          <ActionMenu 
            onEdit={() => setEditingProject(true)} 
            onDelete={() => void handleDeleteProject()} 
          />
        </div>
        <div className="flex flex-col gap-3 p-5 md:flex-row md:items-center">
          <div className="flex-1 min-w-0">
            <h1 className="text-xl font-semibold">{project.title}</h1>
            {project.description && (
              <p className="mt-1 text-sm text-muted">{project.description}</p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
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
                <span className="font-mono text-muted">do {project.due_date}</span>
              )}
            </div>
          </div>
          <ProgressRing pct={pct} color={color} />
          <div className="grid grid-cols-3 gap-3 text-center text-[11px]">
            <Stat label="Zadania" value={project.progress.total_tasks} />
            <Stat label="Zrobione" value={project.progress.completed_tasks} />
            <Stat label="Po terminie" value={project.progress.overdue_count} />
          </div>
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <div className="inline-flex rounded-md border border-border bg-surface p-0.5">
          {(['list', 'kanban'] as Layout[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setLayout(m)}
              className={`px-3 py-1 text-xs rounded-sm capitalize transition-colors ${
                layout === m ? 'bg-surface2 text-white' : 'text-muted hover:text-white'
              }`}
            >
              {m === 'list' ? 'Lista' : 'Kanban'}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => void addSection()}
          className="inline-flex items-center gap-1 rounded-md bg-accent-blue/15 border border-accent-blue/40 hover:bg-accent-blue/25 text-accent-blue px-3 py-1.5 text-xs font-medium"
        >
          <Plus size={12} /> Dodaj sekcję
        </button>
      </div>

      {project.sections.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 px-5 py-8 text-center text-sm text-muted">
          Brak sekcji. Dodaj sekcję — zadania można też dodać bezpośrednio (utworzy się
          „Sekcja domyślna”).
        </div>
      ) : layout === 'list' ? (
        <div className="space-y-4">
          {project.sections.map((sec) => (
            <SectionList
              key={sec.id}
              projectId={projectId}
              section={sec}
              color={color}
              onChanged={() => void load()}
            />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          {project.sections.map((sec) => (
            <SectionList
              key={sec.id}
              projectId={projectId}
              section={sec}
              color={color}
              onChanged={() => void load()}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="font-mono text-lg">{value}</div>
      <div className="uppercase tracking-widest text-muted">{label}</div>
    </div>
  );
}

function ProgressRing({ pct, color }: { pct: number; color: string }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const offset = c - (pct / 100) * c;
  return (
    <div className="relative size-16 shrink-0">
      <svg viewBox="0 0 60 60" className="size-16 -rotate-90">
        <circle cx="30" cy="30" r={r} stroke="#262636" strokeWidth="6" fill="none" />
        <circle
          cx="30"
          cy="30"
          r={r}
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={c}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center font-mono text-xs">
        {pct}%
      </div>
    </div>
  );
}

interface SectionListProps {
  projectId: string;
  section: ProjectSectionWithTasks;
  color: string;
  onChanged: () => void;
  compact?: boolean;
}

function SectionList({ projectId, section, color, onChanged, compact }: SectionListProps) {
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleAdd(): Promise<void> {
    const trimmed = newTitle.trim();
    if (!trimmed) return;
    setBusy(true);
    try {
      await projectsApi.createTask(projectId, {
        title: trimmed,
        section_id: section.id,
      });
      setNewTitle('');
      setAdding(false);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-lg border border-border bg-surface p-3">
      <div className="mb-2 flex items-center gap-2">
        <span className="size-2 rounded-full" style={{ backgroundColor: color }} aria-hidden />
        <div className="text-sm font-semibold">{section.title}</div>
        <div className="ml-auto font-mono text-[10px] text-muted">{section.tasks.length}</div>
      </div>
      <div className="space-y-1">
        {section.tasks.length === 0 ? (
          <div className="text-[11px] text-muted">Brak zadań w tej sekcji.</div>
        ) : (
          section.tasks.map((t) => (
            <TaskRow key={t.id} task={t} onChanged={onChanged} compact={compact} />
          ))
        )}
      </div>
      {adding ? (
        <div className="mt-2 flex items-center gap-2">
          <input
            type="text"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleAdd();
              if (e.key === 'Escape') {
                setAdding(false);
                setNewTitle('');
              }
            }}
            autoFocus
            placeholder="Tytuł zadania"
            className="flex-1 rounded-md border border-border bg-surface2 px-2 py-1 text-xs focus:border-accent-blue focus:outline-none"
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleAdd()}
            className="rounded-md bg-accent-blue/15 border border-accent-blue/40 text-accent-blue px-2 py-1 text-xs disabled:opacity-50"
          >
            Dodaj
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="mt-2 inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-1 text-[11px] text-muted hover:text-white"
        >
          <Plus size={11} /> Dodaj zadanie
        </button>
      )}
    </div>
  );
}

interface TaskRowProps {
  task: ProjectTask;
  onChanged: () => void;
  compact?: boolean;
}

function TaskRow({ task, onChanged, compact }: TaskRowProps) {
  const [busy, setBusy] = useState(false);
  const done = task.status === 'done';

  async function complete(): Promise<void> {
    if (done) return;
    setBusy(true);
    try {
      await projectsApi.completeTask(task.id);
      onChanged();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`group relative flex items-center gap-2 rounded-md border border-border bg-surface2/60 px-2 py-1.5 text-xs pr-8 ${
        done ? 'opacity-60' : ''
      }`}
      style={{ borderLeftColor: PRIORITY_BORDER[task.priority], borderLeftWidth: 3 }}
    >
      <button
        type="button"
        onClick={() => void complete()}
        disabled={busy || done}
        className={`inline-flex size-5 items-center justify-center rounded border transition-colors ${
          done
            ? 'border-accent-emerald/50 bg-accent-emerald/20 text-accent-emerald'
            : 'border-border hover:border-accent-emerald/40 hover:text-accent-emerald'
        }`}
        aria-label="Oznacz jako zrobione"
      >
        {done && <Check size={12} />}
      </button>
      <span className={`flex-1 min-w-0 truncate ${done ? 'line-through' : ''}`}>{task.title}</span>
      {!compact && (
        <span className="font-mono text-[10px] text-muted">{PRIORITY_LABEL[task.priority]}</span>
      )}
      {task.due_date && (
        <span className="font-mono text-[10px] text-muted">{task.due_date.slice(5)}</span>
      )}
      
      <div className="absolute right-2 top-1/2 -translate-y-1/2">
        <ActionMenu 
          onEdit={async () => {
            const title = prompt('Zmień nazwę zadania:', task.title);
            if (!title?.trim() || title === task.title) return;
            await projectsApi.updateTask(task.id, { title: title.trim() });
            onChanged();
          }}
          onDelete={async () => {
            await projectsApi.deleteTask(task.id);
            onChanged();
          }}
        />
      </div>
    </div>
  );
}
