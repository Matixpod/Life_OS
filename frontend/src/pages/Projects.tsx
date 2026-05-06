import ProjectsView from '../components/projects/ProjectsView';

export default function ProjectsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <header>
        <div className="text-[11px] uppercase tracking-widest text-muted">Long-running goals</div>
        <h1 className="text-2xl font-semibold">Projekty</h1>
        <p className="text-sm text-muted">Sekcje, zadania, postęp — wszystko w jednym miejscu.</p>
      </header>
      <ProjectsView />
    </div>
  );
}
