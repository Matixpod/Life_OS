import { Bot, Check, Clock, X } from 'lucide-react';
import { useState } from 'react';
import { proposalsApi, ProposalExpiredError } from '../../api/proposals';
import type { AgentTaskProposal } from '../../types';
import { CATEGORY_COLORS, CATEGORY_LABELS_PL } from '../../types';

interface Props {
  proposal: AgentTaskProposal;
  onResolved: (id: string) => void;
}

function hoursUntil(iso: string): number {
  const ms = new Date(iso).getTime() - Date.now();
  return Math.max(0, Math.round(ms / 3_600_000));
}

export default function ProposalCard({ proposal, onResolved }: Props) {
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null);
  const [exiting, setExiting] = useState<'left' | 'right' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const color = CATEGORY_COLORS[proposal.proposed_category].hex;
  const remaining = hoursUntil(proposal.expires_at);
  const expiresSoon = remaining < 24;

  async function handleApprove(): Promise<void> {
    setBusy('approve');
    setError(null);
    try {
      await proposalsApi.approve(proposal.id);
      setExiting('right');
      setTimeout(() => onResolved(proposal.id), 220);
    } catch (e) {
      if (e instanceof ProposalExpiredError) {
        setError('Propozycja wygasła.');
        setTimeout(() => onResolved(proposal.id), 1500);
      } else {
        setError(e instanceof Error ? e.message : 'Błąd');
      }
      setBusy(null);
    }
  }

  async function handleReject(): Promise<void> {
    setBusy('reject');
    setError(null);
    try {
      await proposalsApi.reject(proposal.id);
      setExiting('left');
      setTimeout(() => onResolved(proposal.id), 220);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
      setBusy(null);
    }
  }

  return (
    <div
      className={`rounded-md border-2 border-dashed bg-surface/60 px-3 py-2 transition-all duration-200 ${
        exiting === 'right' ? 'translate-x-12 opacity-0' : exiting === 'left' ? '-translate-x-12 opacity-0' : ''
      }`}
      style={{ borderColor: `${color}60` }}
    >
      <div className="mb-1 flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted">
        <Bot size={12} style={{ color }} />
        <span>{proposal.agent_id.toUpperCase()} sugeruje</span>
        <span className="ml-auto rounded bg-surface2 px-1.5 py-0.5 text-[10px] font-mono">
          {CATEGORY_LABELS_PL[proposal.proposed_category]}
        </span>
        {expiresSoon && (
          <span
            className="inline-flex items-center gap-1 rounded bg-accent-amber/15 px-1.5 py-0.5 text-[10px] text-accent-amber"
            title="Wygasa wkrótce"
          >
            <Clock size={10} /> {remaining}h
          </span>
        )}
      </div>
      <div className="text-sm font-medium">{proposal.proposed_title}</div>
      <div className="mt-1 text-[11px] text-muted">{proposal.reason}</div>
      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => void handleApprove()}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 rounded-md bg-accent-emerald/15 border border-accent-emerald/40 hover:bg-accent-emerald/25 text-accent-emerald px-2.5 py-1 text-xs font-medium disabled:opacity-50"
        >
          <Check size={12} /> Dodaj
        </button>
        <button
          type="button"
          onClick={() => void handleReject()}
          disabled={busy !== null}
          className="inline-flex items-center gap-1 rounded-md bg-surface2 border border-border hover:border-accent-red/40 hover:text-accent-red text-muted px-2.5 py-1 text-xs disabled:opacity-50"
        >
          <X size={12} /> Odrzuć
        </button>
        <span className="ml-auto font-mono text-[10px] text-muted">{proposal.proposed_date}</span>
      </div>
      {error && <div className="mt-1 text-[11px] text-accent-red">{error}</div>}
    </div>
  );
}
