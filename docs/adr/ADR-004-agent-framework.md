# ADR-004: Agent Framework Selection & Authoritative ASP.NET Core Boundary

## Status
Accepted

## Context
MediStock requires intelligent redistribution planning to identify optimal source facilities during medicine shortages. When a shortage occurs, candidate facilities must be evaluated across surplus availability, safety thresholds, and geographic road transit distances.

The team evaluated two architectural patterns:
1. Embedding LLM calls and orchestration directly into the ASP.NET Core backend.
2. Implementing an internal Python microservice leveraging LangGraph with ASP.NET Core as the authoritative gatekeeper.

## Decision
We adopt **Python + LangGraph** as an internal agentic AI service, isolated behind ASP.NET Core's `AgentGateway`:
- **Python + LangGraph** provides stateful agent execution, cyclic graph planning, and seamless tool composition (`getCandidateFacilities`, `getFacilityInventory`, `getFacilityLocation`, `calculateDistance`, `calculateTransferQuantity`).
- **ASP.NET Core Web API** remains the **sole authoritative backend and single source of truth**:
  - React and Flutter clients NEVER communicate directly with the Python service.
  - The Python agent proposes actions, but does not commit changes or make final authoritative state transitions.
  - All inventory reservations, state changes, and human approval gates are deterministically executed and enforced by ASP.NET Core and PostgreSQL.
  - If the agent service is offline or unreachable, ASP.NET Core falls back to deterministic rule-based candidate selection without halting business workflows.

## Consequences
- **Positive:** Clean separation between probabilistic reasoning (Python/LangGraph) and deterministic transaction integrity (C#/.NET 8 + EF Core).
- **Positive:** Frontends interact with a single, unified REST API with uniform JWT authentication and RBAC.
- **Negative:** Requires running a secondary Python service alongside ASP.NET Core during full end-to-end deployment.
