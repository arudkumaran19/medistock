"""Workflow orchestration models for agent integration."""

from __future__ import annotations

from typing import List, Optional
from uuid import UUID
from pydantic import BaseModel, Field, ConfigDict


class WorkflowRunContext(BaseModel):
    """Execution context provided by ASP.NET Core WorkflowController."""
    model_config = ConfigDict(populate_by_name=True)

    workflow_run_id: UUID = Field(..., alias="workflowRunId")
    transfer_id: Optional[UUID] = Field(None, alias="transferId")
    status: str = "Running"
    current_step: str = Field("RedistributionPlanning", alias="currentStep")
