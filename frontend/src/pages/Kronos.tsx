import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import AgentProposals from '../components/calendar/AgentProposals';
import KronosDashboard from '../components/kronos/KronosDashboard';
import { useFocusItem } from '../hooks/useFocusItem';

export default function Kronos() {
  const focus = useFocusItem();

  return (
    <div className="max-w-6xl mx-auto">
      <Link
        to="/"
        className="inline-flex items-center gap-1 text-muted hover:text-white text-sm mb-6"
      >
        <ArrowLeft size={14} /> Dashboard
      </Link>

      <header className="mb-6">
        <div className="text-[11px] tracking-widest uppercase text-muted">KRONOS</div>
        <h1 className="text-2xl md:text-3xl font-semibold mt-0.5">Discipline & Consistency</h1>
        <p className="text-sm text-muted mt-1 inline-flex items-center gap-2">
          <ShieldCheck size={13} /> Streaks · patterns · plan vs execution
        </p>
      </header>

      {focus && (
        <div className="mb-4 rounded-md border border-accent-blue/40 bg-accent-blue/10 px-3 py-2 text-xs text-accent-blue">
          Z kalendarza: {focus.type ?? 'item'} <span className="font-mono">{focus.id}</span>
        </div>
      )}

      <div className="mb-6">
        <AgentProposals agentId="kronos" />
      </div>

      <KronosDashboard />
    </div>
  );
}
