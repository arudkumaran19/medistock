# ADR-007: Deployment with Neon and Render

## Status

Accepted

## Context

MediStock requires a deployment approach that supports the React web application, ASP.NET Core API, Agentic AI service, and PostgreSQL database while remaining suitable for the academic project and its free-tier constraints.

The deployment architecture must support the following production/demo components:

- React web application
- ASP.NET Core Web API
- LangGraph Agentic AI service
- PostgreSQL database
- Flutter mobile application

## Decision

MediStock will use **Render** for application and web deployment and **Neon** for the deployed PostgreSQL database.

The production/demo architecture will be:

```text
React
  ↓
Render Static Site

ASP.NET Core
  ↓
Render Web Service

LangGraph Agent Service
  ↓
Render Web Service

PostgreSQL
  ↓
Neon Free PostgreSQL

Flutter
  ↓
APK
