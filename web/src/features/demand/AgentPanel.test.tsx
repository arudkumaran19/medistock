/**
 * Demand agent panel tests.
 * Sathurstiga S. (IT24103156).
 *
 * A safe failure is only described as a refusal when the agent actually refused the
 * objective; a tool that could not supply a figure is reported as such.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { AgentFinding, AgentRunResult } from '@/types/demand';
import { AgentPanel } from './AgentPanel';
import { renderWithProviders } from './testUtils';

vi.mock('@/services/demandApi', () => ({
  runAgentAnalysis: vi.fn(),
  getAgentHealth: vi.fn(),
}));

const { runAgentAnalysis } = await import('@/services/demandApi');
const mockRun = vi.mocked(runAgentAnalysis);

function safeFailure(finding: AgentFinding): AgentRunResult {
  return {
    intent: 'SHORTAGE_ASSESSMENT',
    plan: ['demand_shortage'],
    handledBy: 'demand_shortage',
    durationMs: 100,
    result: {
      agent: 'demand_shortage',
      status: 'SAFE_FAILURE',
      confidence: 0,
      findings: [finding],
      recommendations: [],
      requiredValidation: true,
      requestedAction: null,
      evidence: [],
    },
  };
}

async function runAgent() {
  const user = userEvent.setup();
  renderWithProviders(<AgentPanel facilityId="facility-1" medicineId="medicine-1" />);
  await user.click(screen.getByRole('button', { name: 'Run agent' }));
}

describe('AgentPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls a refused objective a refusal', async () => {
    mockRun.mockResolvedValue(
      safeFailure({ code: 'OBJECTIVE_REFUSED', summary: 'Refused.', value: null, unit: null }),
    );

    await runAgent();

    expect(await screen.findByText(/refused this objective/)).toBeInTheDocument();
    expect(screen.queryByTestId('agent-tool-failure')).not.toBeInTheDocument();
  });

  it('reports a failed tool as a stop, not a refusal', async () => {
    mockRun.mockResolvedValue(
      safeFailure({
        code: 'TOOL_REQUEST_REJECTED',
        summary: 'getShortageThreshold was unavailable: Backend returned 400.',
        value: null,
        unit: null,
      }),
    );

    await runAgent();

    expect(await screen.findByTestId('agent-tool-failure')).toHaveTextContent(
      'a backend tool could not supply a figure',
    );
    expect(screen.queryByText(/refused this objective/)).not.toBeInTheDocument();
  });

  it('does not repeat the "nothing was changed" sentence from the backend', async () => {
    mockRun.mockRejectedValue(
      new Error(
        'The agent service is not running or refused the request. No analysis was produced and nothing was changed.',
      ),
    );

    await runAgent();

    const alert = await screen.findByRole('alert');
    expect(alert.textContent?.match(/nothing was changed/g)).toHaveLength(1);
  });

  it('adds the reassurance when the error does not already say it', async () => {
    mockRun.mockRejectedValue(new Error('Failed to fetch'));

    await runAgent();

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Failed to fetch. No analysis was produced and nothing was changed.',
    );
  });
});
