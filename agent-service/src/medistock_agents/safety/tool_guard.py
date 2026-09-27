"""Tool allow-list enforcement.

Prompt-injection mitigation is assigned to Sathurstiga S. (IT24103156) in the
blueprint risk register: input, output and tool guards.

Every agent receives an allow-list. A tool that is not on it is refused before any
request leaves the agent service, so a crafted instruction cannot widen an agent's
reach (blueprint section 23).
"""

from __future__ import annotations


class ToolNotAllowedError(PermissionError):
    """Raised when an agent attempts a tool outside its allow-list."""

    def __init__(self, agent: str, tool: str) -> None:
        super().__init__(f"Agent '{agent}' is not permitted to call tool '{tool}'.")
        self.agent = agent
        self.tool = tool


# Allow-list for the Demand & Shortage Agent, exactly as the blueprint defines it.
DEMAND_SHORTAGE_TOOLS: frozenset[str] = frozenset(
    {
        "getConsumptionHistory",
        "calculateDailyConsumption",
        "calculateForecast",
        "calculateProjectedStockout",
        "getShortageThreshold",
    }
)

# Registry consulted by the guard. Other specialist agents are registered here by
# their owners through this same boundary.
AGENT_TOOL_ALLOW_LIST: dict[str, frozenset[str]] = {
    "demand_shortage": DEMAND_SHORTAGE_TOOLS,
}


class ToolGuard:
    """Refuses any tool call outside the calling agent's allow-list."""

    def __init__(self, agent: str, allowed_tools: frozenset[str] | None = None) -> None:
        self.agent = agent
        self.allowed_tools = (
            allowed_tools
            if allowed_tools is not None
            else AGENT_TOOL_ALLOW_LIST.get(agent, frozenset())
        )

    def is_allowed(self, tool: str) -> bool:
        return tool in self.allowed_tools

    def enforce(self, tool: str) -> None:
        """Raise unless the tool is on the allow-list."""
        if not self.is_allowed(tool):
            raise ToolNotAllowedError(self.agent, tool)
