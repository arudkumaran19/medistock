import { getStoredToken } from "./apiClient";

const AGENT_BASE_URL =
  import.meta.env.VITE_AGENT_API_URL ?? "http://127.0.0.1:8000";

export type ProcurementActionType = "ask" | "analyze" | "validate" | "approve" | "reject" | "revise";

export interface ProcurementAgentRequest {
  action_type: ProcurementActionType;
  payload?: Record<string, unknown>;
  approved?: boolean;
}

export interface ProcurementInsight {
  kind: string;
  message: string;
  purchase_order_id?: string | null;
  supplier_id?: string | null;
  severity: "info" | "warning" | "critical" | "success";
  details?: Record<string, unknown>;
}

export interface ProcurementAgentResponse {
  plan: string[];
  insights: ProcurementInsight[];
  validation_errors: string[];
  approval_required: boolean;
  executed: boolean;
  backend_result: Record<string, unknown> | null;
  answer: string | null;
}

export interface CoordinatorTaskRequest {
  task_id: string;
  intent: string;
  context?: Record<string, unknown>;
}

export interface CoordinatorTaskResponse {
  task_id: string;
  agent_name: string;
  status: "completed" | "requires_approval" | "failed";
  summary: string;
  recommendations: string[];
  requires_human_approval: boolean;
  approval_context?: Record<string, unknown>;
}

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getStoredToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

export const procurementAgentApi = {
  async run(request: ProcurementAgentRequest): Promise<ProcurementAgentResponse> {
    const controller = new AbortController();
    // Allow 120 s: LLM inference (~30 s) + two backend tool calls + LangGraph overhead
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const response = await fetch(`${AGENT_BASE_URL}/api/procurement-agent/run`, {
        method: "POST",
        headers: getAuthHeaders(),
        signal: controller.signal,
        body: JSON.stringify({
          action_type: request.action_type,
          payload: request.payload ?? {},
          approved: request.approved ?? false,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Your session has expired. Please sign in again.");
        }
        const errText = await response.text().catch(() => "");
        throw new Error(
          errText || `AI assistant encountered an issue (${response.status}). Manual procurement remains operational.`
        );
      }

      return (await response.json()) as ProcurementAgentResponse;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new Error("AI assistant timed out after 2 minutes. The LLM is under load — please try again in a moment.");
      }
      if (e instanceof Error && (e.message.includes("Failed to fetch") || e.message.includes("NetworkError") || e.message.includes("fetch failed"))) {
        throw new Error("AI assistant unavailable. The procurement system is still available. Try again later or continue manually.");
      }
      throw e;
    } finally {
      clearTimeout(timeoutId);
    }
  },

  async handleCoordinatorTask(
    request: CoordinatorTaskRequest,
    approved = false
  ): Promise<CoordinatorTaskResponse> {
    const response = await fetch(
      `${AGENT_BASE_URL}/api/procurement-agent/coordinator-task?approved=${approved}`,
      {
        method: "POST",
        headers: getAuthHeaders(),
        body: JSON.stringify(request),
      }
    );

    if (!response.ok) {
      throw new Error(`Coordinator task delegation error (${response.status})`);
    }

    return response.json() as Promise<CoordinatorTaskResponse>;
  },
};
