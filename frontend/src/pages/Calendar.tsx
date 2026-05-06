import CalendarView from '../components/calendar/CalendarView';
import QuickAdd from '../components/tasks/QuickAdd';
import { TaskProvider } from '../context/TaskContext';

export default function CalendarPage() {
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
        <QuickAdd />
        <CalendarView />
      </div>
    </TaskProvider>
  );
}
