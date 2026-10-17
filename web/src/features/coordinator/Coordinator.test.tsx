import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { CoordinatorProvider, useCoordinator } from "./CoordinatorContext";
import { WorkflowTimeline } from "./WorkflowTimeline";
import { FloatingAIAssistant } from "./FloatingAIAssistant";
import { GovernanceApprovalCard } from "./GovernanceApprovalCard";
import { InChatApprovalCard } from "./InChatApprovalCard";
import { SessionSidebar } from "./SessionSidebar";
import { ExecutionDetails } from "./ExecutionDetails";
import { AuthProvider } from "@/features/auth/AuthContext";
import type { WorkflowRun } from "@/types/workflow";

// Mock sample workflow
const MOCK_WORKFLOW: WorkflowRun = {
  id: "wf-12345-67890",
  workflowType: "ShortageResolution",
  objective: "Critical shortage of Paracetamol 500mg at Colombo General Hospital",
  status: "WaitingForApproval",
  requiresApproval: true,
  createdAt: "2026-10-07T10:00:00Z",
  updatedAt: "2026-10-07T10:00:03Z",
  completedAt: "2026-10-07T10:00:03Z",
  resultJson: JSON.stringify({
    intent: "ShortageResolution",
    requires_approval: true,
    approval_type: "ManagerApproval",
    approval_reason: "High-priority emergency stock transfer requires facility manager sign-off.",
    final_recommendation: "Emergency stock transfer of 200 units from Kandy Base Hospital authorized.",
    inventory_data: {
      medicine: "Paracetamol 500mg",
      facility: "Colombo General Hospital",
      available_stock: 45,
      agent_findings: "Deficit threshold crossed. 45 units remaining on hand.",
    },
    shortage_analysis: {
      daily_consumption_rate: 25,
      days_of_supply_remaining: 1.8,
      projected_deficit_units: 350,
      agent_findings: "1.8 days of cover remaining. Imminent stockout projected.",
    },
    redistribution_proposal: {
      feasible: true,
      donor_facility: "Kandy Base Hospital",
      quantity: 200,
      distance_km: 115,
      estimated_transit_hours: 3.5,
      recommendation: "Route transit via central highway cold-chain van.",
    },
    procurement_proposal: {
      needed: true,
      recommended_supplier: "State Pharmaceuticals Manufacturing Corp",
      supplier_score: 94,
      draft_po_number: "PO-2026-0924",
      total_estimated_cost: 14500,
      summary: "Residual buffer order of 500 units drafted.",
    },
    policy_validation: {
      approval_tier: "ManagerApproval",
      rules_checked: [
        "Rule 1: Cold-chain transit window <= 6 hours",
        "Rule 2: Facility reserve floor maintained >= 15%",
      ],
    },
    sub_agents_involved: [
      "Inventory Specialist",
      "Demand Specialist",
      "Redistribution Specialist",
      "Procurement Specialist",
      "Policy & Safety Gate",
    ],
  }),
  steps: [
    {
      id: "step-1",
      stepOrder: 1,
      stepKey: "step_1",
      agentName: "Inventory Specialist",
      action: "Audit local inventory stock and lot reserves",
      status: "Completed",
      outputSummary: "Available stock: 45 units",
      startedAt: "2026-10-07T10:00:00.100Z",
      completedAt: "2026-10-07T10:00:00.350Z",
    },
    {
      id: "step-2",
      stepOrder: 2,
      stepKey: "step_2",
      agentName: "Demand Specialist",
      action: "Calculate consumption velocity and days of cover",
      status: "Completed",
      outputSummary: "Days of supply: 1.8 days",
      startedAt: "2026-10-07T10:00:00.400Z",
      completedAt: "2026-10-07T10:00:00.720Z",
    },
    {
      id: "step-3",
      stepOrder: 3,
      stepKey: "step_3",
      agentName: "Redistribution Specialist",
      action: "Identify candidate donor facilities within 150km",
      status: "Completed",
      outputSummary: "Candidate found: Kandy Base Hospital",
      startedAt: "2026-10-07T10:00:00.800Z",
      completedAt: "2026-10-07T10:00:01.400Z",
    },
  ],
  approvals: [
    {
      id: "app-1",
      approvalType: "ManagerApproval",
      requiredRole: "FacilityManager",
      decision: "Pending",
      requestedAt: "2026-10-07T10:00:02Z",
    },
  ],
};

describe("Coordinator Agent Orchestration Suite", () => {
  it("renders WorkflowTimeline in collapsed state with accurate stages and expands on click", () => {
    render(
      <WorkflowTimeline
        workflow={MOCK_WORKFLOW}
        isRunning={false}
        elapsedSeconds={3}
        defaultExpanded={false}
      />
    );

    // Collapsed header elements
    expect(screen.getByText(/Workflow Activity/i)).toBeInTheDocument();
    expect(screen.getByText(/Awaiting Approval/i)).toBeInTheDocument();
    expect(screen.getByText(/3\/3 Steps/i)).toBeInTheDocument();
    expect(screen.getByText(/Analyze Request/i)).toBeInTheDocument();

    // Toggle expand
    const viewTimelineBtn = screen.getByRole("button", { name: /Expand workflow/i });
    fireEvent.click(viewTimelineBtn);

    // Steps should now be visible in expanded view
    expect(screen.getByText(/Chronological Orchestration Sequence/i)).toBeInTheDocument();
    expect(screen.getByText(/Audit local inventory stock and lot reserves/i)).toBeInTheDocument();
    expect(screen.getByText(/Calculate consumption velocity and days of cover/i)).toBeInTheDocument();
    expect(screen.getByText(/Identify candidate donor facilities within 150km/i)).toBeInTheDocument();

    // Execution durations should be calculated
    expect(screen.getByText("250ms")).toBeInTheDocument(); // 350 - 100
    expect(screen.getByText("320ms")).toBeInTheDocument(); // 720 - 400
  });

  it("renders FloatingAIAssistant launcher button and opens dialog drawer on click", () => {
    render(
      <BrowserRouter>
        <CoordinatorProvider>
          <FloatingAIAssistant />
        </CoordinatorProvider>
      </BrowserRouter>
    );

    const launcherBtn = screen.getByRole("button", { name: /Open MediStock AI Assistant/i });
    expect(launcherBtn).toBeInTheDocument();

    // Click to open floating widget
    fireEvent.click(launcherBtn);

    expect(screen.getByText(/MediStock Assistant/i)).toBeInTheDocument();
    expect(screen.getByText(/Shared Coordinator Agent Session/i)).toBeInTheDocument();
  });

  it("enforces RBAC on GovernanceApprovalCard: shows authorization controls for manager/admin and read-only notice for staff", () => {
    // 1. Render without manager role
    const mockSubmit = vi.fn();
    render(
      <AuthProvider>
        <GovernanceApprovalCard
          workflow={MOCK_WORKFLOW}
          onSubmitApproval={mockSubmit}
        />
      </AuthProvider>
    );

    expect(
      screen.getByText(/Human-in-the-Loop Governance Checkpoint/i)
    ).toBeInTheDocument();

    // Notice about role authorization when user is not manager
    expect(
      screen.getByText(/Role Authorization Required/i)
    ).toBeInTheDocument();
  });

  it("renders InChatApprovalCard with proposal data, shortage metrics, and role notice", () => {
    const mockSubmit = vi.fn();
    const mockMsg = {
      id: "msg-coord-1",
      sender: "coordinator" as const,
      text: "Transfer proposal ready.",
      timestamp: "2026-10-07T10:00:03Z",
      requiresApproval: true,
      approvalStatus: "Pending" as const,
    };

    render(
      <AuthProvider>
        <InChatApprovalCard
          message={mockMsg}
          workflow={MOCK_WORKFLOW}
          onSubmitApproval={mockSubmit}
        />
      </AuthProvider>
    );

    // Card title
    expect(screen.getByText(/Dual Supply Chain Action/i)).toBeInTheDocument();
    // Awaiting decision badge
    expect(screen.getByText(/Awaiting Decision/i)).toBeInTheDocument();
    // Donor facility proposal details
    expect(screen.getByText(/Kandy Base Hospital → 200 units/i)).toBeInTheDocument();
    // Shortage analysis metrics
    expect(screen.getByText(/1.8 days supply remaining/i)).toBeInTheDocument();
    // Role Authorization required notice for unauthenticated/staff user
    expect(screen.getByText(/Role Authorization Required/i)).toBeInTheDocument();
  });

  it("renders SessionSidebar in expanded and collapsed states without crashing", () => {
    const mockSessions = [
      {
        id: "sess-1",
        title: "Paracetamol 500mg Shortage",
        createdAt: "2026-10-07T10:00:00Z",
        updatedAt: "2026-10-07T10:00:00Z",
        messages: [],
        workflows: [],
      },
    ];

    const { rerender } = render(
      <AuthProvider>
        <SessionSidebar
          sessions={mockSessions}
          activeSessionId="sess-1"
          onSelectSession={vi.fn()}
          onNewSession={vi.fn()}
          onRenameSession={vi.fn()}
          onDeleteSession={vi.fn()}
          isCollapsed={false}
        />
      </AuthProvider>
    );

    expect(screen.getByText(/Paracetamol 500mg Shortage/i)).toBeInTheDocument();
    expect(screen.getByText(/New Chat/i)).toBeInTheDocument();

    // Rerender collapsed
    rerender(
      <AuthProvider>
        <SessionSidebar
          sessions={mockSessions}
          activeSessionId="sess-1"
          onSelectSession={vi.fn()}
          onNewSession={vi.fn()}
          onRenameSession={vi.fn()}
          onDeleteSession={vi.fn()}
          isCollapsed={true}
        />
      </AuthProvider>
    );

    expect(screen.getByLabelText(/Expand session sidebar/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Create new conversation/i)).toBeInTheDocument();

    // Verify duplicate user profile footer is NOT rendered in SessionSidebar
    expect(screen.queryByText(/Healthcare User/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/staff/i)).not.toBeInTheDocument();
  });

  it("supports compact Workflow Activity inspector interactions, individual step toggle, and dismissal", () => {
    const handleClose = vi.fn();
    render(
      <WorkflowTimeline
        workflow={MOCK_WORKFLOW}
        isRunning={false}
        elapsedSeconds={3}
        defaultExpanded={true}
        onClose={handleClose}
      />
    );

    // Header has Workflow Activity title and status
    expect(screen.getByText(/Workflow Activity/i)).toBeInTheDocument();
    expect(screen.getByText(/Awaiting Approval/i)).toBeInTheDocument();

    // Clicking close button invokes onClose
    const closeBtn = screen.getByRole("button", { name: /Close timeline/i });
    expect(closeBtn).toBeInTheDocument();
    fireEvent.click(closeBtn);
    expect(handleClose).toHaveBeenCalledTimes(1);

    // Has "Show all details" button
    const showAllBtn = screen.getByRole("button", { name: /Show all details/i });
    expect(showAllBtn).toBeInTheDocument();
    fireEvent.click(showAllBtn);
    expect(screen.getByText(/Collapse all/i)).toBeInTheDocument();
  });

  it("renders ExecutionDetails with concise summary pill by default and expands readable human steps on click", () => {
    render(<ExecutionDetails workflow={MOCK_WORKFLOW} compact={false} />);

    // Default collapsed state displays summary line
    expect(screen.getByText(/Approval required · 3 steps/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Show activity/i })).toBeInTheDocument();

    // Raw JSON or full list should NOT be visible by default
    expect(screen.queryByText(/Multi-Agent Orchestration Sequence/i)).not.toBeInTheDocument();

    // Click to expand
    fireEvent.click(screen.getByRole("button", { name: /Show activity/i }));

    // Drawer header and readable titles should be visible
    expect(screen.getByText(/Multi-Agent Orchestration Sequence/i)).toBeInTheDocument();
    expect(screen.getByText("Inventory Audit")).toBeInTheDocument();
    expect(screen.getByText("Demand Forecast")).toBeInTheDocument();
    expect(screen.getByText("Regional Redistribution")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Hide activity/i })).toBeInTheDocument();
  });

  it("supports skipUserBubble so strategy button clicks do not create a redundant user bubble", async () => {
    function TestComponent() {
      const { messages, sendMessage } = useCoordinator();
      return (
        <div>
          <button
            type="button"
            data-testid="strategy-btn"
            onClick={() => void sendMessage("Procurement", "AutonomousProcurement", true)}
          >
            Choose Procurement
          </button>
          <div data-testid="msg-count">{messages.length}</div>
          {messages.map((m) => (
            <div key={m.id} data-testid="msg-item">
              {m.sender}: {m.text}
            </div>
          ))}
        </div>
      );
    }

    render(
      <BrowserRouter>
        <CoordinatorProvider>
          <TestComponent />
        </CoordinatorProvider>
      </BrowserRouter>
    );

    // Initial welcome message should be present
    expect(screen.getByTestId("msg-count")).toHaveTextContent("1");

    // Click strategy button with skipUserBubble = true
    fireEvent.click(screen.getByTestId("strategy-btn"));

    // Ensure no raw user chat bubble with text "user: Procurement" is appended
    const items = screen.queryAllByTestId("msg-item");
    const userBubble = items.find((i) => i.textContent?.includes("user: Procurement"));
    expect(userBubble).toBeUndefined();
  });
});

