import { ArrowLeft, Plus, Sparkles, Target } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import AddProjectModal from '../components/goals/AddProjectModal';
import AddTaskModal from '../components/goals/AddTaskModal';
import AgentPlanBanner from '../components/goals/AgentPlanBanner';
import PostponeModal from '../components/goals/PostponeModal';
import ProjectCard from '../components/goals/ProjectCard';
import TaskCard from '../components/goals/TaskCard';
import ErrorBanner from '../components/ErrorBanner';
import { api } from '../services/api';
import type {
  CreateProjectPayload,
  CreateTaskPayload,
  DailyPlan,
  DailyTask,
  LifeArea,
  Project,
} from '../types';
import { formatLongDate, todayIso } from '../utils/date';

type Tab = 'today' | 'projects' | 'areas';

function tomorrowIso(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export default function Goals() {
  const [tab, setTab] = useState<Tab>('today');
  const [tasks, setTasks] = useState<DailyTask[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [lifeAreas, setLifeAreas] = useState<LifeArea[]>([]);
  const [plan, setPlan] = useState<DailyPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [postponeFor, setPostponeFor] = useState<DailyTask | null>(null);
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [addProjectOpen, setAddProjectOpen] = useState(false);

  const today = todayIso();

  const refreshTasks = async () => {
    const list = await api.getTasks(today);
    setTasks(list);
  };

  const refreshProjects = async () => {
    const list = await api.getProjects();
    setProjects(list);
  };

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    Promise.all([
      api.getTasks(today),
      api.getProjects(),
      api.getLifeAreas(),
      api.getPlan(today),
    ])
      .then(([t, p, a, pl]) => {
        if (cancelled) return;
        setTasks(t);
        setProjects(p);
        setLifeAreas(a);
        setPlan(pl);
        setLoading(false);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : 'Failed to load goals');
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [today]);

  const incomplete = useMemo(() => tasks.filter((t) => !t.completed), [tasks]);
  const completed = useMemo(() => tasks.filter((t) => t.completed), [tasks]);

  const projectsByArea = useMemo(() => {
    const map = new Map<string, { area: LifeArea | null; projects: Project[] }>();
    const noArea: Project[] = [];
    for (const project of projects) {
      if (!project.life_area_id) {
        noArea.push(project);
        continue;
      }
      const key = project.life_area_id;
      if (!map.has(key)) {
        const a = lifeAreas.find((la) => la.id === key) ?? null;
        map.set(key, { area: a, projects: [] });
      }
      map.get(key)!.projects.push(project);
    }
    const ordered = lifeAreas
      .map((la) => map.get(la.id))
      .filter((x): x is { area: LifeArea | null; projects: Project[] } => Boolean(x));
    if (noArea.length) ordered.push({ area: null, projects: noArea });
    return ordered;
  }, [projects, lifeAreas]);

  const handleComplete = async (id: string) => {
    setTasks((prev) =>
      prev.map((t) => (t.id === id ? { ...t, completed: true, completed_at: new Date().toISOString() } : t)),
    );
    try {
      await api.completeTask(id);
      await refreshProjects();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to complete task');
      await refreshTasks();
    }
  };

  const handlePostpone = async (taskId: string, reason: string, newDate: string) => {
    try {
      await api.postponeTask(taskId, { reason, new_date: newDate });
      await refreshTasks();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to postpone');
    }
  };

  const handleDelete = async (id: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== id));
    try {
      await api.deleteTask(id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete');
      await refreshTasks();
    }
  };

  const handleGeneratePlan = async () => {
    setGenerating(true);
    try {
      const p = await api.generatePlan(today, plan !== null);
      setPlan(p);
      await refreshTasks();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate plan');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateTask = async (payload: CreateTaskPayload) => {
    await api.createTask(payload);
    await refreshTasks();
  };

  const handleCreateProject = async (payload: CreateProjectPayload) => {
    await api.createProject(payload);
    await refreshProjects();
  };

  const handleResume = async (id: string) => {
    await api.updateProject(id, { status: 'active' });
    await refreshProjects();
  };
  const handlePause = async (id: string) => {
    await api.updateProject(id, { status: 'paused' });
    await refreshProjects();
  };
  const handleDrop = async (id: string) => {
    await api.updateProject(id, { status: 'dropped' });
    await refreshProjects();
  };

  return (
    <div className="max-w-5xl mx-auto animate-fade-in">
      <Link to="/" className="inline-flex items-center gap-1 text-muted hover:text-white text-sm mb-6">
        <ArrowLeft size={14} /> Dashboard
      </Link>

      <header className="flex items-start justify-between gap-4 mb-6">
        <div>
          <div className="text-[11px] tracking-widest uppercase text-muted">Goals</div>
          <h1 className="text-2xl md:text-3xl font-semibold mt-0.5">{formatLongDate()}</h1>
          <p className="text-sm text-muted mt-1 inline-flex items-center gap-2">
            <Target size={13} /> Life areas → Projects → Daily tasks
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          {tab === 'today' && (
            <button
              type="button"
              onClick={() => setAddTaskOpen(true)}
              className="px-3 py-2 rounded-md bg-accent-blue text-white text-sm font-medium inline-flex items-center gap-1.5 hover:bg-accent-blue/90"
            >
              <Plus size={14} /> Add task
            </button>
          )}
          {tab === 'projects' && (
            <button
              type="button"
              onClick={() => setAddProjectOpen(true)}
              className="px-3 py-2 rounded-md bg-accent-blue text-white text-sm font-medium inline-flex items-center gap-1.5 hover:bg-accent-blue/90"
            >
              <Plus size={14} /> New project
            </button>
          )}
        </div>
      </header>

      <div className="border-b border-border mb-6 flex gap-1 text-sm">
        {(['today', 'projects', 'areas'] as Tab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-4 py-2 -mb-px border-b-2 capitalize transition-colors ${
              tab === t
                ? 'border-accent-blue text-white'
                : 'border-transparent text-muted hover:text-white'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-6">
          <ErrorBanner message={error} />
        </div>
      )}

      {tab === 'today' && (
        <div className="space-y-5">
          <AgentPlanBanner plan={plan} generating={generating} onGenerate={handleGeneratePlan} />

          {loading ? (
            <SkeletonList />
          ) : incomplete.length === 0 && completed.length === 0 ? (
            <EmptyState
              title="No tasks yet"
              body="Use Generate to let the agent draft a plan, or Add task to write one yourself."
            />
          ) : (
            <>
              <ul className="space-y-3">
                {incomplete.map((t) => (
                  <li key={t.id}>
                    <TaskCard
                      task={t}
                      onComplete={handleComplete}
                      onPostpone={(task) => setPostponeFor(task)}
                      onDelete={handleDelete}
                    />
                  </li>
                ))}
              </ul>

              {completed.length > 0 && (
                <div>
                  <div className="text-[11px] tracking-widest uppercase text-muted mb-2 mt-6">
                    Completed ({completed.length})
                  </div>
                  <ul className="space-y-3">
                    {completed.map((t) => (
                      <li key={t.id}>
                        <TaskCard
                          task={t}
                          onComplete={handleComplete}
                          onPostpone={(task) => setPostponeFor(task)}
                          onDelete={handleDelete}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {tab === 'projects' && (
        <div className="space-y-8">
          {loading ? (
            <SkeletonList />
          ) : projects.length === 0 ? (
            <EmptyState title="No projects yet" body="Create your first project to anchor daily work." />
          ) : (
            projectsByArea.map(({ area, projects: list }) => (
              <section key={area?.id ?? 'no-area'}>
                <h2 className="text-sm font-medium mb-3 inline-flex items-center gap-2">
                  <span>{area?.icon ?? '•'}</span>
                  <span>{area?.name ?? 'No life area'}</span>
                </h2>
                <div className="grid gap-3 md:grid-cols-2">
                  {list.map((p) => (
                    <ProjectCard
                      key={p.id}
                      project={p}
                      onResume={handleResume}
                      onPause={handlePause}
                      onDrop={handleDrop}
                    />
                  ))}
                </div>
              </section>
            ))
          )}
        </div>
      )}

      {tab === 'areas' && (
        <div className="space-y-3">
          {loading ? (
            <SkeletonList />
          ) : (
            lifeAreas.map((area) => {
              const projectCount = projects.filter(
                (p) => p.life_area_id === area.id && p.status === 'active',
              ).length;
              return (
                <div
                  key={area.id}
                  className="rounded-xl bg-surface border border-border p-4 flex items-start gap-4"
                >
                  <div
                    className="size-10 rounded-lg flex items-center justify-center text-xl"
                    style={{ backgroundColor: `${area.color}25`, border: `1px solid ${area.color}55` }}
                  >
                    {area.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-medium">{area.name}</h3>
                      <span className="text-[11px] text-muted font-mono">
                        {projectCount} active
                      </span>
                    </div>
                    {area.description && (
                      <p className="text-xs text-muted mt-0.5">{area.description}</p>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <p className="text-[11px] text-muted inline-flex items-center gap-1.5 pt-2">
            <Sparkles size={11} /> Editing life areas will be available soon.
          </p>
        </div>
      )}

      <PostponeModal
        open={!!postponeFor}
        taskTitle={postponeFor?.title ?? ''}
        defaultDate={tomorrowIso()}
        onClose={() => setPostponeFor(null)}
        onConfirm={async (reason, newDate) => {
          if (postponeFor) {
            await handlePostpone(postponeFor.id, reason, newDate);
            setPostponeFor(null);
          }
        }}
      />

      <AddTaskModal
        open={addTaskOpen}
        date={today}
        projects={projects.filter((p) => p.status === 'active')}
        onClose={() => setAddTaskOpen(false)}
        onSubmit={handleCreateTask}
      />

      <AddProjectModal
        open={addProjectOpen}
        lifeAreas={lifeAreas}
        onClose={() => setAddProjectOpen(false)}
        onSubmit={handleCreateProject}
      />
    </div>
  );
}

function SkeletonList() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="h-20 rounded-xl bg-surface border border-border animate-pulse" />
      ))}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-10 text-center">
      <Target size={28} className="mx-auto text-muted mb-3" />
      <h3 className="font-medium">{title}</h3>
      <p className="text-sm text-muted mt-1">{body}</p>
    </div>
  );
}
