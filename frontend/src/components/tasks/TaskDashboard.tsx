import { AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { api } from '../../services/api';
import type { KronosAlert } from '../../types';
import BacklogView from './BacklogView';
import DailyView from './DailyView';
import QuickAdd from './QuickAdd';
import WeeklyView from './WeeklyView';

interface TaskDashboardProps {
  /** Which tab to render. The page-level component reads the URL and
      forwards it so this component stays presentational. */
  view: 'today' | 'week' | 'backlog';
}

const TABS: { to: string; label: string; key: TaskDashboardProps['view'] }[] = [
  { to: '/tasks', label: 'Dziś', key: 'today' },
  { to: '/tasks/week', label: 'Tydzień', key: 'week' },
  { to: '/tasks/backlog', label: 'Backlog', key: 'backlog' },
];

export default function TaskDashboard({ view }: TaskDashboardProps) {
  const [alerts, setAlerts] = useState<KronosAlert[]>([]);

  useEffect(() => {
    let cancelled = false;
    api
      .getKronosDashboard()
      .then((d) => {
        if (cancelled) return;
        setAlerts(d.alerts);
      })
      .catch(() => {
        /* swallowed — alerts strip is best-effort */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-4">
      <header className="flex items-baseline justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Tasks</h1>
          <p className="text-xs text-muted mt-0.5">
            Wszystko przepływa stąd — KRONOS, ARES i ATHENA czytają to co tu wpiszesz.
          </p>
        </div>
        <nav className="flex items-center gap-1 rounded-lg bg-surface border border-border p-1">
          {TABS.map((tab) => (
            <NavLink
              key={tab.to}
              to={tab.to}
              end
              className={({ isActive }) =>
                `px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-surface2 text-white'
                    : 'text-muted hover:text-white hover:bg-surface2/60'
                }`
              }
            >
              {tab.label}
            </NavLink>
          ))}
        </nav>
      </header>

      {alerts.length > 0 && (
        <div className="rounded-xl border border-accent-amber/40 bg-accent-amber/5 p-3 space-y-1">
          <div className="flex items-center gap-2 text-accent-amber text-xs uppercase tracking-widest">
            <AlertTriangle size={14} /> KRONOS Alerts
          </div>
          <ul className="text-[11px] text-muted space-y-0.5">
            {alerts.slice(0, 3).map((a, i) => (
              <li key={i}>
                {a.category && (
                  <span className="font-mono text-white/80 mr-1">[{a.category}]</span>
                )}
                {a.message}
              </li>
            ))}
          </ul>
        </div>
      )}

      <QuickAdd />

      {view === 'today' && <DailyView />}
      {view === 'week' && <WeeklyView />}
      {view === 'backlog' && <BacklogView />}
    </div>
  );
}
