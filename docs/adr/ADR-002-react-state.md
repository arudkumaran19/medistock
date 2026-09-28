# ADR-002: React State Management

## Status

Accepted

## Context

MediStock uses React for the web management application.

The React application is responsible for management-oriented workflows including:

- Manage
- Analyze
- Approve
- Monitor
- Report
- Configure

The React architecture is organized into:

```text
src/
├── app/
├── routes/
├── layouts/
├── components/
├── features/
│   ├── auth/
│   ├── inventory/
│   ├── demand/
│   ├── redistribution/
│   └── procurement/
├── services/
├── hooks/
├── stores/
├── types/
├── utils/
└── styles/
