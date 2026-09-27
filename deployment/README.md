# Deployment evidence

This deployment folder is part of the Demand & Shortage shared responsibility assigned to Sathurstiga S. (IT24103156).

## Scope

This folder provides reproducible deployment configuration and evidence for React, ASP.NET Core, Agentic AI and PostgreSQL within the MediStock architecture.

## Key requirements from the final blueprint

- The Python Agentic AI service is internal and is called by ASP.NET Core.
- React and Flutter must never call the Agentic AI service directly.
- ASP.NET Core is the authoritative backend and PostgreSQL is the system source of truth.
- React is the management/approval application.
- Flutter is the operational/field application.
- Deployment must preserve secure configuration and safe failure behaviour.

## Not specified in the final blueprint

Not specified in the final blueprint. Do not assume or introduce a new decision without team-level confirmation.
