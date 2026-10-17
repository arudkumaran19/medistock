from __future__ import annotations

import logging
from typing import Any

from medistock_agents.llm.provider import LLMProvider
from medistock_agents.orchestration.graph import CoordinatorWorkflow
from medistock_agents.orchestration.state import CoordinatorState

logger = logging.getLogger(__name__)


class CoordinatorAgent:
    """The central MediStock Multi-Agent Coordinator.
    
    Dynamically routes high-level operational objectives between:
    - Demand & Shortage Specialist
    - Redistribution Optimization Specialist
    - Procurement & Supplier Scoring Specialist
    - Healthcare Policy & Safety Gate
    """

    def __init__(self, llm_provider: LLMProvider | None = None):
        self.workflow = CoordinatorWorkflow(llm_provider=llm_provider)
        self.app = self.workflow.build_graph()

    @property
    def inventory_backend(self):
        return self.workflow.inventory_backend

    @inventory_backend.setter
    def inventory_backend(self, value):
        self.workflow.inventory_backend = value

    async def run(
        self,
        objective: str,
        facility_id: str | None = None,
        medicine_id: str | None = None,
        workflow_type: str = "ShortageResolution",
        parameters: dict[str, Any] | None = None,
    ) -> dict[str, Any]:
        """Executes the coordinator workflow asynchronously."""
        initial_state: CoordinatorState = {
            "objective": objective,
            "facility_id": facility_id,
            "medicine_id": medicine_id,
            "workflow_type": workflow_type,
            "parameters": parameters or {},
            "intent": "",
            "plan": [],
            "current_step": 0,
            "inventory_data": None,
            "shortage_analysis": None,
            "redistribution_proposal": None,
            "procurement_proposal": None,
            "policy_validation": None,
            "requires_approval": False,
            "approval_type": None,
            "approval_reason": None,
            "available_strategies": None,
            "final_recommendation": "",
            "response_detail": "standard",
            "execution_events": [],
            "status": "RUNNING",
            "errors": [],
        }

        try:
            final_state = await self.app.ainvoke(initial_state)

            sub_agents = []
            if final_state.get("inventory_data"):
                sub_agents.append("Inventory Audit Specialist")
            if final_state.get("shortage_analysis"):
                sub_agents.append("Demand & Shortage Specialist")
            if final_state.get("redistribution_proposal"):
                sub_agents.append("Stock Redistribution Specialist")
            if final_state.get("procurement_proposal"):
                sub_agents.append("Autonomous Procurement Specialist")
            if final_state.get("policy_validation"):
                sub_agents.append("Policy & Safety Gate")
            if not sub_agents:
                sub_agents = ["Coordinator Agent"]

            return {
                "intent": final_state.get("intent", "Clarification"),
                "plan": final_state.get("plan", []),
                "requires_approval": final_state.get("requires_approval", False),
                "approval_type": final_state.get("approval_type"),
                "approval_reason": final_state.get("approval_reason", ""),
                "available_strategies": final_state.get("available_strategies"),
                "final_recommendation": final_state.get("final_recommendation", ""),
                "inventory_data": final_state.get("inventory_data"),
                "shortage_analysis": final_state.get("shortage_analysis"),
                "redistribution_proposal": final_state.get("redistribution_proposal"),
                "procurement_proposal": final_state.get("procurement_proposal"),
                "policy_validation": final_state.get("policy_validation"),
                "sub_agents_involved": sub_agents,
                "response_detail": final_state.get("response_detail", "standard"),
                "execution_events": final_state.get("execution_events", []),
                "status": final_state.get("status", "SUCCESS"),
            }
        except Exception as ex:
            # Log the detail server-side only. The client receives a contextual
            # message that says what could not be done and why, never a stack trace,
            # an internal path or protected data.
            logger.error("CoordinatorAgent execution error: %s", ex, exc_info=True)
            return {
                "intent": "AgentFailure",
                "plan": [
                    "Step 1: Agent orchestration error detected",
                    "Step 2: Error reported to client without fabricating tool execution",
                ],
                "requires_approval": False,
                "approval_type": None,
                "approval_reason": "",
                "final_recommendation": (
                    "I could not complete that check because the MediStock AI service "
                    "encountered an internal error. No stock figures, forecasts or "
                    "shortage results are reported and nothing was changed. "
                    "Please try again shortly; if it persists, contact support."
                ),
                "status": "FAILED",
                "errors": ["The agent orchestration failed internally. See the service log for the trace."],
                "execution_events": [
                    {
                        "step_order": 1,
                        "step_name": "Agent execution failure",
                        "status": "FAILED",
                        "error": "The agent orchestration failed internally.",
                    }
                ],
            }
