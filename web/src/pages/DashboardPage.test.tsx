import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { DashboardPage } from "./DashboardPage";

const mockUseAuth = vi.fn();

vi.mock("../features/auth/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

vi.mock("../layouts/DashboardLayout", () => ({
  DashboardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PieChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Pie: () => null,
  Cell: () => null,
  BarChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Bar: () => null,
  XAxis: () => null,
  YAxis: () => null,
  Tooltip: () => null,
  Legend: () => null,
}));

vi.mock("../services/procurementApi", () => ({
  procurementApi: {
    getPurchaseOrders: vi.fn().mockResolvedValue([]),
    getPendingApprovals: vi.fn().mockResolvedValue([]),
    getSuppliers: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("../services/inventoryApi", () => ({
  inventoryApi: {
    list: vi.fn().mockResolvedValue([]),
    batches: vi.fn().mockResolvedValue([]),
    medicines: vi.fn().mockResolvedValue([]),
    facilities: vi.fn().mockResolvedValue([]),
  },
}));

describe("DashboardPage", () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue({
      user: { email: "admin@medistock.com", roles: ["Administrator"] },
      isLoading: false,
    });
  });

  it("shows a user management shortcut from the admin dashboard", async () => {
    render(
      <MemoryRouter>
        <DashboardPage />
      </MemoryRouter>
    );

    expect(await screen.findByText("Administrative Management")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: /user management/i }).length).toBeGreaterThan(0);
  });
});
