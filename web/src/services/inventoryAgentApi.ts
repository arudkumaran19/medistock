const AGENT_BASE_URL =
  import.meta.env.VITE_AGENT_API_URL ?? "http://127.0.0.1:8000";

export type InventoryAgentRequest = {
  action_type: "analyze" | "receive_stock" | "adjust_stock" | "reserve_stock";
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
};

export const inventoryAgentApi = {
  async run(
    request: InventoryAgentRequest
  ): Promise<InventoryAgentResponse> {
    const response = await fetch(`${AGENT_BASE_URL}/api/inventory-agent/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action_type: request.action_type,
        payload: request.payload ?? {},
        approved: request.approved ?? false,
      }),
    });

    if (!response.ok) {
      throw new Error(
        `Inventory Agent request failed (${response.status})`
      );
    }

    return response.json() as Promise<InventoryAgentResponse>;
  },
};