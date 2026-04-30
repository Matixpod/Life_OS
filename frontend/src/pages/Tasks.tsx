import { Outlet, useLocation } from 'react-router-dom';
import TaskDashboard from '../components/tasks/TaskDashboard';
import { TaskProvider } from '../context/TaskContext';

/**
 * Tasks page — single component for all three tabs (today / week / backlog).
 * The path drives the inner view; `TaskProvider` wraps once so navigation
 * between tabs reuses the cached state instead of refetching.
 *
 * `<Outlet />` is rendered for compatibility with the `TasksLayout` route
 * pattern in App.tsx, though the same component is currently used at every
 * matching path.
 */
export default function Tasks() {
  const { pathname } = useLocation();
  const view = pathname.endsWith('/week')
    ? 'week'
    : pathname.endsWith('/backlog')
      ? 'backlog'
      : 'today';

  return (
    <TaskProvider>
      <TaskDashboard view={view} />
      <Outlet />
    </TaskProvider>
  );
}
