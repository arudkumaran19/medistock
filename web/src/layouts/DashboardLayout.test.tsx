import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { DashboardLayout } from "./DashboardLayout";
import { AuthProvider } from "@/features/auth/AuthContext";
import { ProcurementAgentProvider } from "@/features/procurement/ProcurementAgentContext";
import { CoordinatorProvider } from "@/features/coordinator/CoordinatorContext";

// Mock authApi
vi.mock("@/services/authApi", () => ({
  logout: vi.fn(),
  authApi: {
    getCurrentUser: vi.fn().mockResolvedValue({
      userId: "test-user-id",
      email: "manager@medistock.com",
      roles: ["FacilityManager", "Administrator"],
    }),
    logout: vi.fn().mockResolvedValue(undefined),
  },
}));

// Mock apiClient
vi.mock("@/services/apiClient", () => ({
  apiRequest: vi.fn(),
  getStoredToken: vi.fn(() => "mock-token"),
  clearStoredAuth: vi.fn(),
}));

describe("DashboardLayout Global Navigation Sidebar", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1280 });
    localStorage.setItem("medistock_global_sidebar_collapsed", "false");
    localStorage.setItem(
      "medistock_user",
      JSON.stringify({
        userId: "test-user-id",
        email: "manager@medistock.com",
        roles: ["FacilityManager", "Administrator"],
      })
    );
  });

  it("renders global sidebar with brand, section headings and collapse toggle button", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <ProcurementAgentProvider>
            <CoordinatorProvider>
              <DashboardLayout>
                <div>Page Content</div>
              </DashboardLayout>
            </CoordinatorProvider>
          </ProcurementAgentProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    // Should render brand logo and text in expanded state
    expect(screen.getAllByText("MediStock")[0]).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();

    // Collapse toggle button should be present
    const collapseBtn = screen.getByRole("button", { name: /Collapse navigation sidebar/i });
    expect(collapseBtn).toBeInTheDocument();

    // Clicking collapse should switch to compact rail mode
    fireEvent.click(collapseBtn);

    // In collapsed rail mode, the expand button should appear
    const expandBtn = screen.getByRole("button", { name: /Expand navigation sidebar/i });
    expect(expandBtn).toBeInTheDocument();

    // Tooltip and accessible labels remain on nav links
    const dashboardLink = screen.getByRole("link", { name: /Dashboard/i });
    expect(dashboardLink).toHaveAttribute("title", "Dashboard");

    // Clicking expand brings back full labels
    fireEvent.click(expandBtn);
    expect(screen.getByText("Overview")).toBeInTheDocument();
  });

  it("renders profile section at bottom of sidebar with user identity", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <ProcurementAgentProvider>
            <CoordinatorProvider>
              <DashboardLayout>
                <div>Page Content</div>
              </DashboardLayout>
            </CoordinatorProvider>
          </ProcurementAgentProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    // Profile section should be present
    const userMenuBtn = screen.getByRole("button", { name: /User menu/i });
    expect(userMenuBtn).toBeInTheDocument();

    // Should display user initials
    expect(userMenuBtn).toHaveTextContent(/M/i);
  });

  it("opens profile dropdown on click and closes on outside click", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <ProcurementAgentProvider>
            <CoordinatorProvider>
              <DashboardLayout>
                <div>Page Content</div>
              </DashboardLayout>
            </CoordinatorProvider>
          </ProcurementAgentProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    const userMenuBtn = screen.getByRole("button", { name: /User menu/i });
    
    // Initially dropdown should not be visible
    expect(screen.queryByText("Profile")).not.toBeInTheDocument();
    expect(screen.queryByText("Sign out")).not.toBeInTheDocument();

    // Click to open dropdown
    fireEvent.click(userMenuBtn);

    // Dropdown items should now be visible
    expect(screen.getByText("Profile")).toBeInTheDocument();
    expect(screen.getByText("Role Information")).toBeInTheDocument();
    expect(screen.getByText("Sign out")).toBeInTheDocument();

    // Click outside to close
    fireEvent.mouseDown(document.body);

    // Dropdown should close
    expect(screen.queryByText("Profile")).not.toBeInTheDocument();
  });

  it("logout button is present in dropdown", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <ProcurementAgentProvider>
            <CoordinatorProvider>
              <DashboardLayout>
                <div>Page Content</div>
              </DashboardLayout>
            </CoordinatorProvider>
          </ProcurementAgentProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    const userMenuBtn = screen.getByRole("button", { name: /User menu/i });
    fireEvent.click(userMenuBtn);

    const signOutBtn = screen.getByText("Sign out");
    expect(signOutBtn).toBeInTheDocument();
  });

  it("profile section works in collapsed sidebar mode", () => {
    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <ProcurementAgentProvider>
            <CoordinatorProvider>
              <DashboardLayout>
                <div>Page Content</div>
              </DashboardLayout>
            </CoordinatorProvider>
          </ProcurementAgentProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    // Collapse sidebar
    const collapseBtn = screen.getByRole("button", { name: /Collapse navigation sidebar/i });
    fireEvent.click(collapseBtn);

    // Profile button should still be accessible
    const userMenuBtn = screen.getByRole("button", { name: /User menu/i });
    expect(userMenuBtn).toBeInTheDocument();

    // Should have tooltip showing full user info
    expect(userMenuBtn).toHaveAttribute("title");
  });

  it("renders single-facility user with clear email, role, and facility", async () => {
    localStorage.setItem(
      "medistock_user",
      JSON.stringify({
        userId: "manager-id",
        email: "manager@medistock.com",
        roles: ["FacilityManager"],
        facilities: [{ id: "f1", name: "Central Facility" }],
      })
    );

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <ProcurementAgentProvider>
            <CoordinatorProvider>
              <DashboardLayout>
                <div>Page Content</div>
              </DashboardLayout>
            </CoordinatorProvider>
          </ProcurementAgentProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    const userMenuBtn = screen.getByRole("button", { name: /User menu/i });
    fireEvent.click(userMenuBtn);

    const menu = screen.getByRole("menu");
    expect(menu).toBeInTheDocument();
    expect(within(menu).getByText("manager@medistock.com")).toBeInTheDocument();
    expect(within(menu).getByText("Facility Manager")).toBeInTheDocument();
    expect(within(menu).getByText("Assigned Facility:")).toBeInTheDocument();
    expect(within(menu).getByText("Central Facility")).toBeInTheDocument();
  });

  it("distinguishes administrator scope from personal unassigned facility", async () => {
    localStorage.setItem(
      "medistock_user",
      JSON.stringify({
        userId: "admin-id",
        email: "admin@medistock.com",
        roles: ["Administrator", "ADMIN"],
        facilities: [],
      })
    );

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <ProcurementAgentProvider>
            <CoordinatorProvider>
              <DashboardLayout>
                <div>Page Content</div>
              </DashboardLayout>
            </CoordinatorProvider>
          </ProcurementAgentProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    const userMenuBtn = screen.getByRole("button", { name: /User menu/i });
    fireEvent.click(userMenuBtn);

    const menu = screen.getByRole("menu");
    expect(menu).toBeInTheDocument();
    expect(within(menu).getByText("admin@medistock.com")).toBeInTheDocument();
    expect(within(menu).getByText("Administrator")).toBeInTheDocument();
    expect(within(menu).getByText("System-wide (All Facilities)")).toBeInTheDocument();
    expect(within(menu).getByText("Personal Facility:")).toBeInTheDocument();
    expect(within(menu).getByText("No facility assigned")).toBeInTheDocument();
  });

  it("displays multiple facilities as separate readable entries without concatenation", async () => {
    localStorage.setItem(
      "medistock_user",
      JSON.stringify({
        userId: "multi-id",
        email: "user@medistock.com",
        roles: ["FacilityManager"],
        facilities: [
          { id: "f1", name: "Central Facility" },
          { id: "f2", name: "Northside Community Clinic" },
        ],
      })
    );

    render(
      <MemoryRouter initialEntries={["/dashboard"]}>
        <AuthProvider>
          <ProcurementAgentProvider>
            <CoordinatorProvider>
              <DashboardLayout>
                <div>Page Content</div>
              </DashboardLayout>
            </CoordinatorProvider>
          </ProcurementAgentProvider>
        </AuthProvider>
      </MemoryRouter>
    );

    const userMenuBtn = screen.getByRole("button", { name: /User menu/i });
    fireEvent.click(userMenuBtn);

    const menu = screen.getByRole("menu");
    expect(menu).toBeInTheDocument();
    expect(within(menu).getByText("user@medistock.com")).toBeInTheDocument();
    expect(within(menu).getByText("2 assigned")).toBeInTheDocument();
    expect(within(menu).getByText("Central Facility")).toBeInTheDocument();
    expect(within(menu).getByText("Northside Community Clinic")).toBeInTheDocument();
  });
});
