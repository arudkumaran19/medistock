# MediStock

This repository is structured around the final MediStock blueprint and the member-specific ownership model. This document captures the Demand & Shortage vertical slice owned by Sathurstiga S. (IT24103156).

## Scope

MediStock is a facility-to-facility medicine inventory and supply coordination platform that monitors stock levels, predicts potential shortages using historical consumption, identifies redistribution opportunities, and assists authorized managers in approving stock transfers or replenishment actions.

## Demand & Shortage vertical ownership

Primary areas:
- backend/src/MediStock.Api/Features/Demand/
- backend/src/MediStock.Api/Infrastructure/Persistence/
- agent-service/src/medistock_agents/agents/demand_shortage_agent.py
- web/src/features/demand/
- mobile/lib/features/demand/
- mobile/lib/shared/
- deployment/
- docs/deployment/
- docs/testing/
- docs/adr/ADR-003-flutter-state.md
- docs/adr/ADR-006-database-strategy.md

## Required individual demonstration

Consumption data
    ↓
forecast
    ↓
projected stockout
    ↓
shortage alert

## Authoritative rules

- ASP.NET Core is the authoritative backend.
- PostgreSQL is the system source of truth.
- React is the management/approval application.
- Flutter is the operational/field application.
- The Python Agentic AI service is internal and is called by ASP.NET Core.
- Authoritative business validation is deterministic backend code, not LLM reasoning.
- The final blueprint remains the only source of truth. Any gap must be declared as: Not specified in the final blueprint. Do not assume or introduce a new decision without team-level confirmation.
