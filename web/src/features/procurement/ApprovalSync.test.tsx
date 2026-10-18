import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { ApprovalConsole } from "./ApprovalConsole";
import { procurementApi, type PurchaseOrder } from "../../services/procurementApi";
import { InChatApprovalCard } from "../coordinator/InChatApprovalCard";
import type { ChatMessage } from "../coordinator/types";
import type { WorkflowRun } from "@/types/workflow";

// Mock procurementApi
vi.mock("../../services/procurementApi", () => ({
  procurementApi: {
    getPendingApprovals: vi.fn(),
    getAuthorizationRules: vi.fn().mockResolvedValue([]),
    approvePurchaseOrder: vi.fn().mockResolvedValue({}),
    rejectPurchaseOrder: vi.fn().mockResolvedValue({}),
    requestRevision: vi.fn().mockResolvedValue({}),
  },
}));

const mockOrders: PurchaseOrder[] = [
  {
    id: "a1000000-0000-0000-0000-000000000001",
    supplierId: "s1",
    facilityId: "f1",
    status: "PendingApproval",
    requestedAt: new Date().toISOString(),
    items: [
      {
        id: "i1",
        medicineId: "Amoxicillin 500mg",
        requestedQuantity: 500,
        unitPrice: 8.5,
      },
    ],
  },
  {
    id: "b2000000-0000-0000-0000-000000000002",
    supplierId: "s2",
    facilityId: "f1",
    status: "PendingApproval",
    requestedAt: new Date().toISOString(),
    items: [
      {
        id: "i2",
        medicineId: "Paracetamol 500mg",
        requestedQuantity: 2000,
        unitPrice: 6.0,
      },
    ],
  },
];

describe("Procurement Approval & Rejection Synchronization Suite", () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    vi.clearAllMocks();
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
  });

  function renderApprovalConsole() {
    return render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <ApprovalConsole />
        </MemoryRouter>
      </QueryClientProvider>
    );
  }

  it("loads and displays pending purchase orders through TanStack Query", async () => {
    vi.mocked(procurementApi.getPendingApprovals).mockResolvedValueOnce(mockOrders);

    renderApprovalConsole();

    expect(screen.getByText(/Loading authoritative pending authorizations/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/PO-a1000000/i)).toBeInTheDocument();
      expect(screen.getByText(/PO-b2000000/i)).toBeInTheDocument();
    });

    expect(screen.getByText("All (2)")).toBeInTheDocument();
  });

  it("filters orders by category correctly", async () => {
    vi.mocked(procurementApi.getPendingApprovals).mockResolvedValue(mockOrders);

    renderApprovalConsole();

    await waitFor(() => {
      expect(screen.getByText(/PO-a1000000/i)).toBeInTheDocument();
    });

    // PO-b2000000 has 2000 * $6 = $12,000 (High Value and Bulk)
    const highValueBtn = screen.getByRole("button", { name: /High Value/i });
    fireEvent.click(highValueBtn);

    expect(screen.getByText(/PO-b2000000/i)).toBeInTheDocument();
    expect(screen.queryByText(/PO-a1000000/i)).not.toBeInTheDocument();
  });

  it("triggers reject workflow and invalidates server cache", async () => {
    vi.mocked(procurementApi.getPendingApprovals).mockResolvedValue(mockOrders);
    vi.mocked(procurementApi.rejectPurchaseOrder).mockResolvedValueOnce({} as unknown as PurchaseOrder);

    renderApprovalConsole();

    await waitFor(() => {
      expect(screen.getByText(/PO-a1000000/i)).toBeInTheDocument();
    });

    const rejectButtons = screen.getAllByRole("button", { name: /^Reject$/i });
    fireEvent.click(rejectButtons[0]);

    // Modal appears
    expect(screen.getByText("Reject Purchase Order")).toBeInTheDocument();

    const textarea = screen.getByPlaceholderText(/State the reason for rejection/i);
    fireEvent.change(textarea, { target: { value: "Exceeds monthly operational budget quota" } });

    const confirmBtn = screen.getByRole("button", { name: /Confirm Rejection/i });
    fireEvent.click(confirmBtn);

    await waitFor(() => {
      expect(procurementApi.rejectPurchaseOrder).toHaveBeenCalledWith(
        "a1000000-0000-0000-0000-000000000001",
        "Exceeds monthly operational budget quota"
      );
    });
  });

  it("reconciles state when a medistock:approval-updated event is dispatched", async () => {
    vi.mocked(procurementApi.getPendingApprovals)
      .mockResolvedValueOnce(mockOrders)
      .mockResolvedValueOnce([mockOrders[1]]); // After rejection in chat

    renderApprovalConsole();

    await waitFor(() => {
      expect(screen.getByText(/PO-a1000000/i)).toBeInTheDocument();
    });

    // Simulate approval event dispatched by CoordinatorContext
    window.dispatchEvent(
      new CustomEvent("medistock:approval-updated", {
        detail: { decision: "Rejected", comments: "Rejected via Coordinator AI" },
      })
    );

    await waitFor(() => {
      expect(screen.getByText(/Reconciled authoritative approval state: Rejected recorded via Coordinator/i)).toBeInTheDocument();
    });
  });

  it("InChatApprovalCard handles rejection decision and prevents duplicate actions", async () => {
    const onSubmitApproval = vi.fn().mockImplementation(() => new Promise((res) => setTimeout(res, 50)));

    const mockWorkflow = {
      id: "wf-123",
      status: "WaitingForApproval" as const,
      approvals: [
        {
          id: "app-1",
          decision: "Pending" as const,
          approvalType: "Tier 1: Facility Authorization",
        },
      ],
      resultJson: JSON.stringify({
        procurement_proposal: {
          medicine_name: "Amoxicillin 500mg",
          quantity: 300,
          estimated_cost: 2550,
        },
      }),
    };

    const mockMessage = {
      id: "msg-1",
      sender: "coordinator" as const,
      text: "Action Required: Requisition Approval",
      timestamp: new Date().toISOString(),
      workflowId: "wf-123",
      requiresApproval: true,
      approvalStatus: "Pending" as const,
    };

    render(
      <InChatApprovalCard
        message={mockMessage as unknown as ChatMessage}
        workflow={mockWorkflow as unknown as WorkflowRun}
        onSubmitApproval={onSubmitApproval}
      />
    );

    const rejectBtn = screen.getByRole("button", { name: /Reject Proposal/i });
    expect(rejectBtn).toBeInTheDocument();

    fireEvent.click(rejectBtn);

    expect(onSubmitApproval).toHaveBeenCalledWith("Rejected", undefined);
  });
});
