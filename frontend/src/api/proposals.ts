import type { AgentTaskProposal, ProposalApproveResult } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000';

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return (await res.json()) as T;
}

async function post<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, { method: 'POST' });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`);
  return (await res.json()) as T;
}

export class ProposalExpiredError extends Error {
  constructor() {
    super('Propozycja wygasła');
    this.name = 'ProposalExpiredError';
  }
}

export const proposalsApi = {
  list: (agentId?: string): Promise<AgentTaskProposal[]> =>
    get(`/api/v1/proposals${agentId ? `?agent_id=${agentId}` : ''}`),

  approve: async (id: string): Promise<ProposalApproveResult> => {
    const res = await fetch(`${BASE_URL}/api/v1/proposals/${id}/approve`, { method: 'POST' });
    if (res.status === 410) throw new ProposalExpiredError();
    if (!res.ok) throw new Error(`POST /proposals/${id}/approve → ${res.status}`);
    return (await res.json()) as ProposalApproveResult;
  },

  reject: (id: string): Promise<AgentTaskProposal> => post(`/api/v1/proposals/${id}/reject`),
};
