import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { Link } from 'react-router-dom';
import KronosDashboard from '../components/kronos/KronosDashboard';

export default function Kronos() {
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

      <KronosDashboard />
    </div>
  );
}
