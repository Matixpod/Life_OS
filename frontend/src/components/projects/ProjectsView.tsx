import { Plus } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { projectsApi } from '../../api/projects';
import type { ProjectV2 } from '../../types';
import ProjectCard from './ProjectCard';
import ProjectForm from './ProjectForm';

export default function ProjectsView() {
  const [projects, setProjects] = useState<ProjectV2[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectV2 | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await projectsApi.list();
      setProjects(list.filter((p) => p.status !== 'archived' && p.status !== 'dropped'));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  async function handleDelete(project: ProjectV2) {
    if (!confirm('Czy na pewno chcesz usunąć ten projekt i wszystkie jego zadania?')) return;
    try {
      await projectsApi.deleteProject(project.id);
      void load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd przy usuwaniu projektu');
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center">
        <button
          type="button"
          onClick={() => {
            setEditingProject(null);
            setShowForm(true);
          }}
          className="ml-auto inline-flex items-center gap-1 rounded-md bg-accent-blue/15 border border-accent-blue/40 hover:bg-accent-blue/25 text-accent-blue px-3 py-1.5 text-sm font-medium"
        >
          <Plus size={14} /> Nowy projekt
        </button>
      </div>

      {showForm && (
        <ProjectForm
          initial={editingProject ?? undefined}
          onCreated={() => {
            setShowForm(false);
            setEditingProject(null);
            void load();
          }}
          onCancel={() => {
            setShowForm(false);
            setEditingProject(null);
          }}
        />
      )}

      {error && (
        <div className="rounded-md border border-accent-red/40 bg-accent-red/10 px-3 py-2 text-sm text-accent-red">
          {error}
        </div>
      )}

      {loading && projects.length === 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 animate-pulse rounded-xl border border-border bg-surface" />
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-surface/40 px-5 py-8 text-center text-sm text-muted">
          Brak projektów. Stwórz pierwszy, by trzymać sekcje i zadania w jednym miejscu.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard 
              key={p.id} 
              project={p} 
              onEdit={() => {
                setEditingProject(p);
                setShowForm(true);
              }}
              onDelete={() => void handleDelete(p)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
