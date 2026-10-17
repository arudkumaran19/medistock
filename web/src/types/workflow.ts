export type WorkflowStatus =
  | 'Pending'
  | 'Running'
  | 'WaitingForApproval'
  | 'Approved'
  | 'Completed'
  | 'Failed'
  | 'Rejected'
  | 'Cancelled';

export type ApprovalDecision = 'Pending' | 'Approved' | 'Rejected';

export interface WorkflowStep {
  id: string;
  stepOrder: number;
  stepKey: string;
  agentName: string;
  action: string;
  status: string;
  outputSummary?: string;
  outputJson?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface Approval {
  id: string;
  approvalType: string;
  requiredRole: string;
  decision: ApprovalDecision;
  decidedByUserId?: string;
  decidedByUserName?: string;
  comments?: string;
  requestedAt: string;
  decidedAt?: string;
}

export interface WorkflowRun {
  id: string;
  workflowType: string;
  objective: string;
  status: WorkflowStatus;
  facilityId?: string;
  medicineId?: string;
  initiatedByUserId?: string;
  requiresApproval: boolean;
  errorMessage?: string;
  resultJson?: string;
  sessionId?: string;
  messageId?: string;
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
  steps: WorkflowStep[];
  approvals: Approval[];
  currentStep?: string;
  destinationFacilityId?: string;
  shortageQuantity?: number;
  selectedFacilityId?: string;
  proposedQuantity?: number;
  provider?: string;
  reasoning?: string;
  initiatedAt?: string;
}



export interface StartWorkflowRequest {
  objective?: string;
  workflowType?: string;
  facilityId?: string;
  medicineId?: string;
  parameters?: Record<string, unknown>;
  sessionId?: string;
  messageId?: string;
  transferRequestId?: string;
  destinationFacilityId?: string;
  shortageQuantity?: number;
  initiatorUserId?: string;
  additionalContext?: string;
}


export interface SubmitApprovalRequest {
  decision: ApprovalDecision;
  comments?: string;
}

export type WorkflowRunDto = WorkflowRun;

export interface ApprovalRequest {
  approverUserId: string;
  decisionNotes?: string;
}

