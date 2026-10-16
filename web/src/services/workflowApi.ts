import { apiRequest } from '@/services/apiClient';
import type {
  Approval,
  StartWorkflowRequest,
  SubmitApprovalRequest,
  WorkflowRun,
} from '@/types/workflow';

export const workflowApi = {
  startWorkflow: (request: StartWorkflowRequest) =>
    apiRequest<WorkflowRun>('/api/workflows', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  getWorkflow: (id: string) =>
    apiRequest<WorkflowRun>(`/api/workflows/${id}`),

  getActiveWorkflows: () =>
    apiRequest<WorkflowRun[]>('/api/workflows'),

  getWorkflowsBySession: (sessionId: string) =>
    apiRequest<WorkflowRun[]>(`/api/workflows/session/${encodeURIComponent(sessionId)}`),

  getPendingApprovals: (requiredRole?: string) => {
    const query = requiredRole ? `?requiredRole=${encodeURIComponent(requiredRole)}` : '';
    return apiRequest<Approval[]>(`/api/workflows/approvals/pending${query}`);
  },

  submitApproval: (
    workflowId: string,
    approvalId: string,
    request: SubmitApprovalRequest
  ) =>
    apiRequest<Approval>(`/api/workflows/${workflowId}/approvals/${approvalId}`, {
      method: 'POST',
      body: JSON.stringify(request),
    }),
};
