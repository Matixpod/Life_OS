import AresDashboard from '../components/ares/AresDashboard';
import AgentProposals from '../components/calendar/AgentProposals';
import { useFocusItem } from '../hooks/useFocusItem';

export default function AresPage() {
  const focus = useFocusItem();

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4 md:p-6">
      <header>
        <div className="text-[11px] uppercase tracking-widest text-muted">Vitality agent</div>
        <h1 className="text-2xl font-semibold">ARES</h1>
        <p className="text-sm text-muted">
          Surowy analityk zdrowia fizycznego. Czyta Twoje zadania sportowe, dietetyczne,
          sen i nawodnienie z ostatnich 14 dni.
        </p>
      </header>
      {focus && (
        <div className="rounded-md border border-accent-blue/40 bg-accent-blue/10 px-3 py-2 text-xs text-accent-blue">
          Z kalendarza: {focus.type ?? 'item'} <span className="font-mono">{focus.id}</span>
        </div>
      )}
      <AgentProposals agentId="ares" />
      <AresDashboard />
    </div>
  );
}
