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
        if (response.status === 403) {
          throw new Error("Access restricted: Your account permissions do not permit running procurement AI actions. Manual procurement operations remain operational.");
        }
        if (response.status === 503) {
          throw new Error("The procurement AI assistant is temporarily busy or unavailable. Manual procurement remains fully operational.");
        }
        const errText = await response.text().catch(() => "");
        const isClean = errText && !errText.includes("Traceback") && !errText.includes("Exception") && !errText.startsWith("HTTP");
        throw new Error(
          isClean ? errText : "The AI assistant encountered an issue. Manual procurement remains fully operational."
        );
      }

      return (await response.json()) as ProcurementAgentResponse;
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") {
        throw new Error("The AI assistant took too long to respond. The system is under load — please try again in a moment.", { cause: e });
      }
      if (e instanceof Error && (e.message.includes("Failed to fetch") || e.message.includes("NetworkError") || e.message.includes("fetch failed"))) {
        throw new Error("Unable to connect to the procurement AI assistant. The manual procurement system is active and ready to use.", { cause: e });
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
    try {
      const response = await fetch(
        `${AGENT_BASE_URL}/api/procurement-agent/coordinator-task?approved=${approved}`,
        {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify(request),
        }
      );

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error("Your session has expired. Please sign in again.");
        }
        if (response.status === 403) {
          throw new Error("Access restricted: You do not have permission to execute this delegated procurement task.");
        }
        if (response.status === 503) {
          throw new Error("The procurement service is temporarily unavailable. Please try again shortly.");
        }
        throw new Error("The delegated procurement task could not be completed at this time.");
      }

      return response.json() as Promise<CoordinatorTaskResponse>;
    } catch (e) {
      if (e instanceof Error && (e.message.includes("Failed to fetch") || e.message.includes("NetworkError") || e.message.includes("fetch failed"))) {
        throw new Error("Unable to connect to the procurement service. Please check your network connection and try again.");
      }
      throw e;
    }
  },
};
