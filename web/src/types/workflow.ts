export interface WorkflowStepDto {
  id: string;
  stepName: string;
  status: string;
  agentProvider: string;
  promptTokens: number;
  completionTokens: number;
  executionTimeMs: number;
  outputSummary: string;
  toolCallsJson: string;
  startedAt: string;
  completedAt: string | null;
}

export interface WorkflowRunDto {
  id: string;
  workflowType: string;
  status: string;
  currentStep: string;
  destinationFacilityId: string;
  medicineId: string;
  shortageQuantity: number;
  selectedFacilityId: string | null;
  proposedQuantity: number;
  provider: string;
  reasoning: string;
  errorMessage?: string | null;
  initiatedAt: string;
  completedAt: string | null;
  steps: WorkflowStepDto[];
}

export interface StartWorkflowRequest {
  destinationFacilityId: string;
  medicineId: string;
  shortageQuantity: number;
  workflowType?: string;
  additionalContext?: string;
}

export interface ApprovalRequest {
  approverUserId?: string;
  reviewerUserId?: string;
  decisionNotes?: string;
  comments?: string;
  decision?: 'Approve' | 'Reject';
  modifiedQuantity?: number;
}
