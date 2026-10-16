import type { WorkflowRun } from "@/types/workflow";

export interface SampleScenario {
  id: string;
  category: string;
  title: string;
  subAgents: string[];
  prompt: string;
  rolesAllowed?: string[];
}

export interface ChatMessage {
  id: string;
  sender: "user" | "coordinator";
  text: string;
  timestamp: string;
  status?: "sending" | "success" | "error";
  workflowId?: string;
  workflowRun?: WorkflowRun;
  subAgentsInvoked?: string[];
  intent?: string;
  requiresApproval?: boolean;
  approvalStatus?: "Pending" | "Approved" | "Rejected";
  approvalComment?: string;
  approvalDecidedBy?: string;
  approvalDecidedAt?: string;
  executionDurationSeconds?: number;
  isEdited?: boolean;
  editedAt?: string;
  originalText?: string;
  /** Phase 3: available resolution strategies offered to the user */
  availableStrategies?: string[];
}

export interface ChatSession {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;
  messages: ChatMessage[];
  /** All workflow runs triggered in this session, in chronological order */
  workflows: WorkflowRun[];
  activeScenarioId?: string;
  // Deprecated – kept for backwards-compat with persisted localStorage data
  activeWorkflowId?: string;
  activeWorkflow?: WorkflowRun | null;
}

export interface SubAgentInfo {
  name: string;
  key: "inventory" | "demand" | "redistribution" | "procurement" | "policy";
  role: string;
  color: string;
  badge: string;
}
