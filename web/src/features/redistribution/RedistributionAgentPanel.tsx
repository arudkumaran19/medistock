/**
 * Redistribution agent panel. Redistribution vertical (Member 3).
 *
 * Asks the agent which facility should supply this transfer. Advisory: the agent's
 * recommendation is shown with the tool calls behind it, and a manager can propose the
 * recommended source with one click - but proposing, approving and reserving remain
 * the manager's actions, and reservation is still gated by the deterministic rules.
 */
import { useMutation } from '@tanstack/react-query';

import { ErrorState } from '@/components/ErrorState';
import { Panel } from '@/features/demand/components/Panel';
import { apiRequest } from '@/services/apiClient';

import { type Transfer, transferApi, useTransferMutation } from './api';

interface AgentResult {
  agent: string;
  status: string;
  confidence: number;
  recommendedSourceFacilityId: string | null;
  recommendedSourceFacilityName: string | null;
  findings: Array<{ code: string; summary: string }>;
  recommendations: Array<{ code: string; summary: string; priority: string }>;
  aiAssessment: string | null;
  toolCalls: Array<{ tool: string; status: string }>;
}

export function RedistributionAgentPanel({ transfer }: { transfer: Transfer }) {
  const run = useMutation({
    mutationFn: () =>
      apiRequest<AgentResult>(`/api/transfers/${transfer.id}/agent`, { method: 'POST', body: JSON.stringify({}) }),
  });
  const propose = useTransferMutation((sourceId: string) =>
    transferApi.propose(transfer.id, sourceId, 'Proposed from the redistribution agent recommendation.'),
  );

  const result = run.data;

  return (
    <Panel
      title="Redistribution agent"
      description="Recommends a source facility from the ranked candidates. Advisory only."
      icon="shield"
      actions={
        <button type="button" className="button button--primary" disabled={run.isPending} onClick={() => run.mutate()}>
          {run.isPending ? 'Running agent…' : 'Ask the agent'}
        </button>
      }
    >
      {run.isError && <ErrorState title="Agent unavailable" message={(run.error as Error).message} />}

      {!result && !run.isError && (
        <p className="cell-secondary" style={{ margin: 0 }}>
          The agent loads this request, ranks every facility that can spare stock, checks the best one's
          inventory and distance, and explains its choice. Nothing changes until a manager acts.
        </p>
      )}

      {result && (
        <div className="stack" style={{ gap: 12 }}>
          <div className="row-actions" style={{ flexWrap: 'wrap' }}>
            <span className="badge">{result.status}</span>
            <span className="badge">confidence {Math.round(result.confidence * 100)}%</span>
            <span className="badge">plan: {result.toolCalls.map((c) => c.tool).join(' → ')}</span>
          </div>

          {result.aiAssessment && (
            <div className="panel" style={{ padding: 14, background: 'var(--accent-wash, #f0fdfa)' }}>
              <div className="cell-primary">AI assessment</div>
              <p style={{ margin: '6px 0' }}>{result.aiAssessment}</p>
              <div className="cell-secondary">Written by the model from tool figures; every number is checked against them.</div>
            </div>
          )}

          <ul style={{ margin: 0, paddingLeft: 18 }}>
            {result.findings.map((f) => (
              <li key={f.code}>
                <span className="cell-secondary">{f.code}</span> — {f.summary}
              </li>
            ))}
          </ul>

          {result.recommendations.map((r) => (
            <div key={r.code} className="cell-primary">
              <span className="badge">{r.priority}</span> {r.summary}
            </div>
          ))}

          {result.recommendedSourceFacilityId && (
            <div className="row-actions">
              <button
                type="button"
                className="button"
                disabled={propose.isPending}
                onClick={() => propose.mutate(result.recommendedSourceFacilityId!)}
              >
                Propose {result.recommendedSourceFacilityName}
              </button>
            </div>
          )}
          {propose.isError && <ErrorState title="Could not propose" message={(propose.error as Error).message} />}
        </div>
      )}
    </Panel>
  );
}
