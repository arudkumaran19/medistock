/**
 * Inventory Agent API
 *
 * All calls go through the .NET backend at /api/inventory/agent/run.
 * The backend enforces FacilityInventoryAccess RBAC before proxying to the
 * Python agent service with an internal service token.
 *
 * The agent service is NEVER called directly from the browser - doing so
 * would bypass authorization and expose the internal service token.
 */
import { apiRequest } from "./apiClient";

export type InventoryAgentRequest = {
  action_type: "analyze" | "ask" | "receive" | "adjust" | "reserve";
  payload?: Record<string, unknown>;
  approved?: boolean;
};

export type InventoryAgentResponse = {
  plan: string[];
  insights: Array<Record<string, unknown>>;
  validation_errors: string[];
  approval_required: boolean;
  executed: boolean;
  backend_result: Record<string, unknown> | null;
  answer: string | null;
};

export const inventoryAgentApi = {
  async run(request: InventoryAgentRequest): Promise<InventoryAgentResponse> {
    // Routes through .NET API → Python agent service (with X-Internal-Token).
    // JWT is automatically attached by apiRequest via getStoredToken().
    return apiRequest<InventoryAgentResponse>("/api/inventory/agent/run", {
      method: "POST",
      body: JSON.stringify({
        action_type: request.action_type,
        payload: request.payload ?? {},
        approved: request.approved ?? false,
      }),
    });
  },
};
