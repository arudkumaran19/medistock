# MediStock Agent Contracts

## Agent Output Contract

All MediStock agents must return a schema-validated structured output.

```json
 {
  "agent": "redistribution_planning",
  "status": "SUCCESS",
  "confidence": 0.84,
  "findings": [],
  "recommendations": [],
  "requiredValidation": true,
  "requestedAction": null,
  "evidence": []
 }
 ```


## Workflow State

The following workflow state must be persisted:

- WorkflowRun
  - Workflow ID
  - Objective
  - Status
  - CreatedAt
  - CompletedAt

- PlanStep
  - Step
  - Agent
  - Status
  - StartedAt
  - CompletedAt

- AgentExecution
  - Agent
  - Input summary
  - Output summary
  - Status
  - Duration

- ToolExecution
  - Tool
  - Input summary
  - Output summary
  - Status
  - Duration

- ValidationResult
  - Rule
  - Result
  - Reason

- Approval
  - Approver
  - Decision
  - Comment
  - Timestamp

- FinalResult
  - Status
  - Summary
  - RelatedTransactionId

## Persistence Rules

- Do not persist hidden chain-of-thought.
- Do not persist passwords.
- Do not persist tokens.
- Do not persist unnecessary sensitive data.