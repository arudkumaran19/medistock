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
1. "get_suppliers": Get list of all suppliers, active status, lead times. Args: {}
2. "get_purchase_orders": Get list of purchase orders. Args: {"status": str|null, "facilityId": str|null, "supplierId": str|null}
3. "get_pending_approvals": Get all purchase orders currently pending approval. Args: {}
4. "get_purchase_order": Get a single PO by ID. Args: {"purchaseOrderId": str}
5. "get_authorization_rules": Get policy rules and approval thresholds. Args: {}
6. "validate_procurement": Run policy validation for draft purchase order. Args: {"payload": dict}
7. "approve_purchase_order": Approve a purchase order. Args: {"purchaseOrderId": str} (MUTATION)
8. "reject_purchase_order": Reject a purchase order. Args: {"purchaseOrderId": str, "reason": str} (MUTATION)
9. "request_revision": Request revision for a purchase order. Args: {"purchaseOrderId": str, "reason": str} (MUTATION)

IMPORTANT: You must NEVER invent database queries. All interactions must use these tools.
Respond in valid JSON only.
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
                if tool_name == "get_suppliers":
                    res = await backend.get_suppliers()
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

Synthesize these results.
Provide a clear, human-readable recommendation or answer, identify any policy insights or violations,
and clearly state if human approval is required before execution.

Return ONLY a JSON object:
{{
  "recommendation": "<detailed summary and actionable advice>",
  "insights": [
    {{"kind": "policy_violation"|"recommendation"|"info", "message": "<insight message>", "severity": "info"|"warning"|"critical"}}
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
