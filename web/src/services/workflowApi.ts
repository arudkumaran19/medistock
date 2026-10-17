import { apiClient, apiRequest } from '@/services/apiClient';
import type {
  Approval,
  ApprovalRequest,
  StartWorkflowRequest,
  SubmitApprovalRequest,
  WorkflowRun,
  WorkflowRunDto,
} from '@/types/workflow';

export const workflowApi = {
  startWorkflow: (request: StartWorkflowRequest) =>
    apiRequest<WorkflowRun>('/api/workflows', {
      method: 'POST',
      body: JSON.stringify(request),
    }),

  getWorkflow: (id: string) =>
    apiRequest<WorkflowRun>(`/api/workflows/${id}`),

  getWorkflowRun: async (id: string): Promise<WorkflowRunDto> => {
    const res = await apiClient.get<any>(`/api/workflow/runs/${id}`);
    return res?.data || res;
  },

  approveWorkflow: async (id: string, payload: ApprovalRequest): Promise<WorkflowRunDto> => {
    const res = await apiClient.post<any>(`/api/workflow/runs/${id}/approve`, payload);
    return res?.data || res;
  },

  rejectWorkflow: async (id: string, payload: ApprovalRequest): Promise<WorkflowRunDto> => {
    const res = await apiClient.post<any>(`/api/workflow/runs/${id}/reject`, payload);
    return res?.data || res;
  },

  getAuditTrail: async (id: string): Promise<any[]> => {
    const res = await apiClient.get<any>(`/api/workflow/runs/${id}/audit`);
    return res?.data || res;
  },

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

export default workflowApi;
