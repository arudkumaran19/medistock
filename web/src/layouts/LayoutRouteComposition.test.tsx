import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { RouterProvider, createMemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ProcurementAgentProvider } from "@/features/procurement/ProcurementAgentContext";
import { CoordinatorProvider } from "@/features/coordinator/CoordinatorContext";
import { router } from "@/app/router";

// Mock authApi
vi.mock("@/services/authApi", () => ({
  logout: vi.fn(),
  authApi: {
    getCurrentUser: vi.fn().mockResolvedValue({
      userId: "test-admin-id",
      email: "admin@medistock.com",
      roles: ["Administrator", "FacilityManager", "SupplierOfficer", "OperationalStaff"],
    }),
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock apiClient
vi.mock("@/services/apiClient", () => ({
  apiRequest: vi.fn().mockResolvedValue([]),
  getStoredToken: vi.fn(() => "mock-admin-token"),
  clearStoredAuth: vi.fn(),
}));

// Mock procurementApi
vi.mock("@/services/procurementApi", () => ({
  procurementApi: {
    getPurchaseOrders: vi.fn().mockResolvedValue([]),
    getPendingApprovals: vi.fn().mockResolvedValue([]),
    getSuppliers: vi.fn().mockResolvedValue([]),
    getPriorityAlerts: vi.fn().mockResolvedValue([]),
    getDeliveries: vi.fn().mockResolvedValue([]),
    getAuthorizationRules: vi.fn().mockResolvedValue([]),
  },
}));

// Mock inventoryApi
vi.mock("@/services/inventoryApi", () => ({
  inventoryApi: {
    list: vi.fn().mockResolvedValue([]),
    batches: vi.fn().mockResolvedValue([]),
    medicines: vi.fn().mockResolvedValue([]),
    facilities: vi.fn().mockResolvedValue([]),
    expiring: vi.fn().mockResolvedValue([]),
  },
  medicineApi: {
    create: vi.fn().mockResolvedValue({}),
  },
}));

describe("MediStock Layout Composition & Single Shell Architecture", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1280 });
    localStorage.setItem("medistock_global_sidebar_collapsed", "false");
    localStorage.setItem(
      "medistock_user",
      JSON.stringify({
        userId: "test-admin-id",
        email: "admin@medistock.com",
        roles: ["Administrator", "FacilityManager", "SupplierOfficer", "OperationalStaff"],
      })
    );
  });

  function renderRoute(initialPath: string) {
    const memoryRouter = createMemoryRouter(router.routes, {
      initialEntries: [initialPath],
    });

    const testQueryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    return render(
      <QueryClientProvider client={testQueryClient}>
        <AuthProvider>
          <ProcurementAgentProvider>
            <CoordinatorProvider>
              <RouterProvider router={memoryRouter} />
            </CoordinatorProvider>
          </ProcurementAgentProvider>
        </AuthProvider>
      </QueryClientProvider>
    );
  }

  it("renders exactly one desktop navigation sidebar on /dashboard", async () => {
    const { container } = renderRoute("/dashboard");
    await waitFor(() => {
      const sidebars = container.querySelectorAll("aside.sidebar-desktop");
      expect(sidebars.length).toBe(1);
    });

    const brandLogos = await screen.findAllByLabelText("MediStock Home");
    expect(brandLogos.length).toBe(1);
  });

  it("renders exactly one desktop navigation sidebar on /inventory", async () => {
    const { container } = renderRoute("/inventory");
    await waitFor(() => {
      const sidebars = container.querySelectorAll("aside.sidebar-desktop");
      expect(sidebars.length).toBe(1);
    });
  });

  it("renders exactly one desktop navigation sidebar on /inventory/receive", async () => {
    const { container } = renderRoute("/inventory/receive");
    await waitFor(() => {
      const sidebars = container.querySelectorAll("aside.sidebar-desktop");
      expect(sidebars.length).toBe(1);
    });
  });

  it("renders exactly one desktop navigation sidebar on /inventory/expiry", async () => {
    const { container } = renderRoute("/inventory/expiry");
    await waitFor(() => {
      const sidebars = container.querySelectorAll("aside.sidebar-desktop");
      expect(sidebars.length).toBe(1);
    });
  });

  it("renders exactly one desktop navigation sidebar on /procurement/orders", async () => {
    const { container } = renderRoute("/procurement/orders");
    await waitFor(() => {
      const sidebars = container.querySelectorAll("aside.sidebar-desktop");
      expect(sidebars.length).toBe(1);
    });
  });

  it("renders exactly one desktop navigation sidebar on /procurement/priorities", async () => {
    const { container } = renderRoute("/procurement/priorities");
    await waitFor(() => {
      const sidebars = container.querySelectorAll("aside.sidebar-desktop");
      expect(sidebars.length).toBe(1);
    });
  });

  it("renders exactly one desktop navigation sidebar on /procurement/approvals", async () => {
    const { container } = renderRoute("/procurement/approvals");
    await waitFor(() => {
      const sidebars = container.querySelectorAll("aside.sidebar-desktop");
      expect(sidebars.length).toBe(1);
    });
  });

  it("renders exactly one desktop navigation sidebar on /procurement/suppliers", async () => {
    const { container } = renderRoute("/procurement/suppliers");
    await waitFor(() => {
      const sidebars = container.querySelectorAll("aside.sidebar-desktop");
      expect(sidebars.length).toBe(1);
    });
  });

  it("renders exactly one desktop navigation sidebar on /procurement/workflow", async () => {
    const { container } = renderRoute("/procurement/workflow");
    await waitFor(() => {
      const sidebars = container.querySelectorAll("aside.sidebar-desktop");
      expect(sidebars.length).toBe(1);
    });
  });

  it("renders exactly one desktop navigation sidebar on /admin/users", async () => {
    const { container } = renderRoute("/admin/users");
    await waitFor(() => {
      const sidebars = container.querySelectorAll("aside.sidebar-desktop");
      expect(sidebars.length).toBe(1);
    });
  });

  it("renders exactly one normal sidebar plus exactly one history sidebar on /coordinator", async () => {
    const { container } = renderRoute("/coordinator");

    await waitFor(() => {
      // 1. Exactly one normal left application sidebar
      const globalSidebars = container.querySelectorAll("aside.sidebar-desktop");
      expect(globalSidebars.length).toBe(1);

      // 2. Exactly one right conversation history sidebar
      const historySidebars = container.querySelectorAll("aside.coord-session-sidebar, aside[aria-label='Collapsed session navigation']");
      expect(historySidebars.length).toBe(1);

      // 3. Central conversation workspace exists and is flexible
      const centerWorkspace = container.querySelector(".coord-chat-viewport");
      expect(centerWorkspace).toBeInTheDocument();
    });
  });
});
