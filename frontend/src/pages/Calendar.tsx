import { useState } from 'react';
import CalendarView, { type CalendarMode } from '../components/calendar/CalendarView';
import QuickAdd from '../components/tasks/QuickAdd';
import { TaskProvider } from '../context/TaskContext';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function CalendarPage() {
  const [mode, setMode] = useState<CalendarMode>('day');
  const [anchor, setAnchor] = useState<string>(() => todayIso());
  const [refreshKey, setRefreshKey] = useState(0);

  // In day mode the new task lands on the currently open day; in week/month
  // we don't know which day the user means, so we fall back to today.
  const targetDate = mode === 'day' ? anchor : undefined;

  return (
    <TaskProvider>
      <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
        <header>
          <div className="text-[11px] uppercase tracking-widest text-muted">Unified planner</div>
          <h1 className="text-2xl font-semibold">Kalendarz</h1>
          <p className="text-sm text-muted">
            Wszystko, co masz do zrobienia: zadania, habity i projekty w jednym widoku.
          </p>
        </header>
        <QuickAdd defaultDate={targetDate} onCreated={() => setRefreshKey((k) => k + 1)} />
        <CalendarView
          mode={mode}
          onModeChange={setMode}
          anchor={anchor}
          onAnchorChange={setAnchor}
          refreshKey={refreshKey}
        />
      </div>
    </TaskProvider>
  );
}
