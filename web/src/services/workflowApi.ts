import { apiClient } from './apiClient';
import { ApprovalRequest, StartWorkflowRequest, WorkflowRunDto } from '../types/workflow';

export const workflowApi = {
  // POST /api/workflow/runs
  startWorkflow: async (payload: StartWorkflowRequest): Promise<WorkflowRunDto> => {
    const res = await apiClient.post<any>('/api/workflow/runs', payload);
    return res?.data || res;
  },

  // GET /api/workflow/runs/{id}
  getWorkflowRun: async (id: string): Promise<WorkflowRunDto> => {
    const res = await apiClient.get<any>(`/api/workflow/runs/${id}`);
    return res?.data || res;
  },

  // POST /api/workflow/runs/{id}/approve
  approveWorkflow: async (id: string, payload: ApprovalRequest): Promise<WorkflowRunDto> => {
    const res = await apiClient.post<any>(`/api/workflow/runs/${id}/approve`, payload);
    return res?.data || res;
  },

  // POST /api/workflow/runs/{id}/reject
  rejectWorkflow: async (id: string, payload: ApprovalRequest): Promise<WorkflowRunDto> => {
    const res = await apiClient.post<any>(`/api/workflow/runs/${id}/reject`, payload);
    return res?.data || res;
  },

  // GET /api/workflow/runs/{id}/audit
  getAuditTrail: async (id: string): Promise<any[]> => {
    const res = await apiClient.get<any>(`/api/workflow/runs/${id}/audit`);
    return res?.data || res;
  },
};
