"""LangGraph Workflow for the Procurement & Policy Validation Agent.

Orchestrates multi-step agentic execution:
1. Intent Understanding & Planning (LLM)
2. Dynamic Controlled Tool Selection (LLM)
3. Controlled Backend Tool Invocation (API only, never DB)
4. Result Interpretation & Recommendation Generation (LLM)
5. Approval Safety Gate (blocks unapproved mutations)
"""

from __future__ import annotations

import json
import logging
from typing import Any, TypedDict

from langgraph.graph import END, StateGraph

from medistock_agents.llm.provider import LLMProvider
from medistock_agents.models.agent_models import (
    AgentResult,
    ProcurementAction,
    ProcurementActionType,
    ProcurementInsight,
)

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# State Definition
# ---------------------------------------------------------------------------

class ProcurementGraphState(TypedDict):
    request_text: str
    action_type: str
    payload: dict[str, Any]
    approved: bool
    plan: list[str]
    intent: str
    tool_calls: list[dict[str, Any]]
    tool_results: list[dict[str, Any]]
    validation_results: dict[str, Any]
    insights: list[dict[str, Any]]
    recommendation: str
    approval_required: bool
    approval_context: dict[str, Any]
    backend_result: dict[str, Any] | None
    execution_status: str
    errors: list[str]
    fallback_triggered: bool


# ---------------------------------------------------------------------------
# Tool Catalog for LLM
# ---------------------------------------------------------------------------

CONTROLLED_TOOLS_PROMPT = """
You have access ONLY to the following controlled tools via the MediStock backend:
1. "get_inventory": Inspect current inventory balances, on-hand quantities, and stock status across facilities. Args: {"facilityId": str|null, "medicineId": str|null}
2. "get_medicines": Search medicine catalog for medicine ID, name, unit price, category. Args: {"search": str|null}
3. "get_suppliers": Get list of all suppliers, active status, contact details. Args: {"search": str|null, "is_active": bool|null}
4. "get_facilities": Get list of registered hospital/clinical facilities. Args: {}
5. "get_authorization_rules": Get policy rules, approval thresholds (e.g. $10,000 high-value threshold, 1,000 unit bulk threshold), and requirements. Args: {}
6. "get_purchase_orders": Get list of purchase orders. Args: {"status": str|null, "facilityId": str|null, "supplierId": str|null}
7. "get_pending_approvals": Get all purchase orders currently pending approval. Args: {}
8. "get_purchase_order": Get a single PO by ID. Args: {"purchaseOrderId": str}
9. "validate_procurement": Run policy validation for draft purchase order. Args: {"payload": dict}
10. "approve_purchase_order": Approve a purchase order. Args: {"purchaseOrderId": str} (MUTATION)
11. "reject_purchase_order": Reject a purchase order. Args: {"purchaseOrderId": str, "reason": str} (MUTATION)
12. "request_revision": Request revision for a purchase order. Args: {"purchaseOrderId": str, "reason": str} (MUTATION)

IMPORTANT RULES:
- When asked about stock levels, replenishment, or low inventory, invoke "get_inventory" (without filtering by a single medicine ID so all records are available), "get_suppliers", and "get_authorization_rules".
- CRITICAL: When the user asks about multiple medicines (e.g., "Azithromycin and Omeprazole", or "Paracetamol and Amoxicillin"), you MUST inspect stock levels and active suppliers for ALL requested medicines. Do NOT stop after the first medicine.
- You must NEVER invent database queries. All interactions must use these controlled tools.
- Respond in valid JSON only.
"""


# ---------------------------------------------------------------------------
# Graph Builder
# ---------------------------------------------------------------------------

def build_procurement_graph(
    llm: LLMProvider,
    backend: Any,
) -> StateGraph:
    """Build the LangGraph state graph for Procurement & Policy Validation."""

    # Node 1: Understand Intent & Plan
    async def understand_and_plan(state: ProcurementGraphState) -> dict[str, Any]:
        prompt = f"""
User Request: {state['request_text']}
Action Type: {state['action_type']}
Payload: {json.dumps(state['payload'])}

Analyze this procurement task. Determine the user's intent, produce a 2-4 step execution plan,
and choose which controlled tools need to be called.

Return ONLY a JSON object formatted as:
{{
  "intent": "<short summary of intent>",
  "plan": ["<step 1>", "<step 2>"],
  "tool_calls": [
    {{"tool": "<tool_name>", "args": {{...}}}}
  ]
}}
"""
        try:
            raw_response = await llm.generate(
                prompt=prompt,
                system_prompt="You are the MediStock Procurement & Policy Validation AI. " + CONTROLLED_TOOLS_PROMPT,
            )
            # Clean JSON markdown fences if present
            cleaned = raw_response.strip()
            if cleaned.startswith("```"):
                lines = cleaned.splitlines()
                cleaned = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
            data = json.loads(cleaned)

            return {
                "intent": data.get("intent", "Procurement processing"),
                "plan": data.get("plan", ["Inspect procurement context", "Run policy validation"]),
                "tool_calls": data.get("tool_calls", []),
                "fallback_triggered": False,
            }
        except Exception as ex:
            logger.warning("LLM planning failed, falling back: %s", ex)
            return {"fallback_triggered": True, "errors": [f"LLM planning fallback: {ex}"]}

    # Node 2: Execute Controlled Tools
    async def execute_tools(state: ProcurementGraphState) -> dict[str, Any]:
        if state.get("fallback_triggered"):
            return {}

        results: list[dict[str, Any]] = []
        validation_results: dict[str, Any] = {}
        backend_result: dict[str, Any] | None = None
        approval_required = False
        approval_context: dict[str, Any] = {}

        for call in state.get("tool_calls", []):
            tool_name = call.get("tool")
            args = call.get("args", {})

            try:
                if tool_name == "get_inventory":
                    res = await backend.get_inventory(
                        facility_id=args.get("facilityId"),
                        medicine_id=args.get("medicineId"),
                    )
                    results.append({"tool": tool_name, "output": res})

                elif tool_name == "get_medicines":
                    res = await backend.get_medicines(search=args.get("search"))
                    results.append({"tool": tool_name, "output": res})

                elif tool_name == "get_facilities":
                    res = await backend.get_facilities()
                    results.append({"tool": tool_name, "output": res})

                elif tool_name == "get_suppliers":
                    res = await backend.get_suppliers(
                        search=args.get("search"),
                        is_active=args.get("is_active") or args.get("isActive"),
                    )
                    results.append({"tool": tool_name, "output": res})

                elif tool_name == "get_purchase_orders":
                    res = await backend.get_purchase_orders(
                        status=args.get("status"),
                        facility_id=args.get("facilityId"),
                        supplier_id=args.get("supplierId"),
                    )
                    results.append({"tool": tool_name, "output": res})

                elif tool_name == "get_pending_approvals":
                    res = await backend.get_pending_approvals()
                    results.append({"tool": tool_name, "output": res})

                elif tool_name == "get_purchase_order":
                    po_id = args.get("purchaseOrderId") or state["payload"].get("purchaseOrderId")
                    res = await backend.get_purchase_order(str(po_id))
                    results.append({"tool": tool_name, "output": res})

                elif tool_name == "get_authorization_rules":
                    res = await backend.get_authorization_rules()
                    results.append({"tool": tool_name, "output": res})

                elif tool_name == "validate_procurement":
                    val_payload = args.get("payload") or state["payload"]
                    res = await backend.validate_procurement(val_payload)
                    validation_results = res
                    results.append({"tool": tool_name, "output": res})

                # Mutations: enforce human approval gate
                elif tool_name in {"approve_purchase_order", "reject_purchase_order", "request_revision"}:
                    approval_required = True
                    po_id = args.get("purchaseOrderId") or state["payload"].get("purchaseOrderId")
                    reason = args.get("reason") or state["payload"].get("reason", "")
                    approval_context = {"tool": tool_name, "purchaseOrderId": po_id, "reason": reason}

                    if not state["approved"]:
                        results.append({
                            "tool": tool_name,
                            "status": "blocked_pending_approval",
                            "message": f"Action '{tool_name}' on PO '{po_id}' requires explicit human approval."
                        })
                    else:
                        if tool_name == "approve_purchase_order":
                            backend_result = await backend.approve_purchase_order(str(po_id))
                        elif tool_name == "reject_purchase_order":
                            backend_result = await backend.reject_purchase_order(str(po_id), str(reason))
                        elif tool_name == "request_revision":
                            backend_result = await backend.request_revision(str(po_id), str(reason))
                        results.append({"tool": tool_name, "status": "executed", "output": backend_result})

            except Exception as ex:
                logger.error("Error executing tool %s: %s", tool_name, ex)
                results.append({"tool": tool_name, "error": str(ex)})

        return {
            "tool_results": results,
            "validation_results": validation_results,
            "backend_result": backend_result,
            "approval_required": approval_required or state.get("approval_required", False),
            "approval_context": approval_context or state.get("approval_context", {}),
        }

    # Node 3: Interpret & Recommend
    async def interpret_and_recommend(state: ProcurementGraphState) -> dict[str, Any]:
        if state.get("fallback_triggered"):
            return {}

        prompt = f"""
Original User Request: {state['request_text']}
Intent: {state['intent']}
Tool Execution Results: {json.dumps(state['tool_results'])}
Validation Results: {json.dumps(state['validation_results'])}
Approval Required: {state['approval_required']}
Approved by User: {state['approved']}

Synthesize these results accurately based on the backend data returned.
Address all parts of the user request:
- CRITICAL: If the user mentions or asks about multiple medicines (e.g. 2 or more medicines), you MUST evaluate and report on EACH requested medicine individually in your recommendation and provide structured insights for each medicine. Never omit any requested medicine or provide answers for only the first one.
- Current inventory on-hand and stock status (from get_inventory / get_medicines results) for each medicine.
- Recommended replenishment quantity (calculating a safe reorder amount based on current stock) for each medicine.
- Suitable active supplier (identifying active verified suppliers from get_suppliers results).
- Approval requirement determination (evaluating against authorization rules: e.g. orders > $10,000 or > 1,000 units require approval; state whether approval is needed for the recommended order).

Return ONLY a JSON object:
{{
  "recommendation": "<clear, comprehensive, and actionable answer addressing inventory status, recommended quantity, chosen active supplier, and whether approval is required>",
  "insights": [
    {{"kind": "recommendation"|"policy_violation"|"info", "message": "<insight message>", "severity": "info"|"warning"|"critical"}}
  ],
  "execution_status": "<success|pending_approval|failed>"
}}
"""
        try:
            raw_response = await llm.generate(
                prompt=prompt,
                system_prompt="You are the MediStock Procurement Specialist Agent. Provide structured, reliable recommendations.",
            )
            cleaned = raw_response.strip()
            if cleaned.startswith("```"):
                lines = cleaned.splitlines()
                cleaned = "\n".join(lines[1:-1] if lines[-1].startswith("```") else lines[1:])
            data = json.loads(cleaned)

            insights = data.get("insights", [])
            recommendation = data.get("recommendation", "")
            execution_status = data.get("execution_status", "success")

            if state["approval_required"] and not state["approved"]:
                execution_status = "pending_approval"
                if "approval" not in recommendation.lower():
                    recommendation += " This action requires human approval. Set approved=true to proceed."

            return {
                "recommendation": recommendation,
                "insights": insights,
                "execution_status": execution_status,
            }
        except Exception as ex:
            logger.warning("LLM interpretation failed: %s", ex)
            # Create a clean fallback summary from tool outputs
            summary_parts = []
            for tr in state["tool_results"]:
                if "output" in tr:
                    summary_parts.append(f"{tr['tool']}: success")
                elif "message" in tr:
                    summary_parts.append(tr["message"])
            return {
                "recommendation": "Execution completed. " + "; ".join(summary_parts),
                "execution_status": "pending_approval" if (state["approval_required"] and not state["approved"]) else "success",
            }

    # Build Graph
    workflow = StateGraph(ProcurementGraphState)

    workflow.add_node("understand_and_plan", understand_and_plan)
    workflow.add_node("execute_tools", execute_tools)
    workflow.add_node("interpret_and_recommend", interpret_and_recommend)

    workflow.set_entry_point("understand_and_plan")

    def route_after_planning(state: ProcurementGraphState) -> str:
        if state.get("fallback_triggered"):
            return END
        return "execute_tools"

    workflow.add_conditional_edges(
        "understand_and_plan",
        route_after_planning,
        {
            "execute_tools": "execute_tools",
            END: END,
        },
    )

    workflow.add_edge("execute_tools", "interpret_and_recommend")
    workflow.add_edge("interpret_and_recommend", END)

    return workflow.compile()
