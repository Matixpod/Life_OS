import { useCallback, useEffect, useState } from 'react';
import { proposalsApi } from '../../api/proposals';
import type { AgentTaskProposal } from '../../types';
import ProposalCard from './ProposalCard';

interface Props {
  agentId: string;
  emptyText?: string;
}

export default function AgentProposals({
  agentId,
  emptyText = 'Brak nowych propozycji.',
}: Props) {
  const [items, setItems] = useState<AgentTaskProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await proposalsApi.list(agentId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Błąd');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  function dropOne(id: string): void {
    setItems((list) => list.filter((p) => p.id !== id));
  }

  return (
    <section className="rounded-xl border border-border bg-surface p-4">
      <div className="mb-2 flex items-center gap-2">
        <span className="text-[11px] uppercase tracking-widest text-muted">
          Propozycje od {agentId.toUpperCase()}
        </span>
        <span className="ml-auto font-mono text-[11px] text-muted">
          {loading ? '…' : items.length}
        </span>
      </div>
      {error && <div className="text-xs text-accent-red">{error}</div>}
      {!loading && items.length === 0 ? (
        <div className="text-xs text-muted">{emptyText}</div>
      ) : (
        <div className="space-y-2">
          {items.map((p) => (
            <ProposalCard key={p.id} proposal={p} onResolved={dropOne} />
          ))}
        </div>
      )}
    </section>
  );
}
