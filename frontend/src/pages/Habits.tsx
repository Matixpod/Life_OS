import HabitsView from '../components/habits/HabitsView';

export default function HabitsPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <header>
        <div className="text-[11px] uppercase tracking-widest text-muted">Recurring practice</div>
        <h1 className="text-2xl font-semibold">Habity</h1>
        <p className="text-sm text-muted">
          Codzienne, tygodniowe i miesięczne praktyki. Streak rośnie sam, dopóki klikniesz.
        </p>
      </header>
      <HabitsView />
    </div>
  );
}
