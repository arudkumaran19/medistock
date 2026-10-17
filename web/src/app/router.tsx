import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { DashboardPage } from "../pages/DashboardPage";
import { InventoryPage } from "../features/inventory/InventoryPage";
import { InventoryDetailPage } from "../features/inventory/InventoryDetailPage";
import { BatchDetailPage } from "../features/inventory/BatchDetailPage";
import { ReceiveStockPage } from "../features/inventory/ReceiveStockPage";
import { ExpiryPage } from "../features/inventory/ExpiryPage";
import { SupplierDashboard } from "../features/procurement/SupplierDashboard";
import { SupplierDetail } from "../features/procurement/SupplierDetail";
import { PurchaseOrders } from "../features/procurement/PurchaseOrders";
import { ProcurementPriority } from "../features/procurement/ProcurementPriority";
import { ApprovalConsole } from "../features/procurement/ApprovalConsole";
import { WorkflowMonitor } from "../features/procurement/WorkflowMonitor";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { AdminPage } from "../pages/AdminPage";
import { AuditConsolePage } from "../pages/AuditConsolePage";
import { ShortageDashboard } from "../features/demand/ShortageDashboard";
import { ShortageDetail } from "../features/demand/ShortageDetail";
import { ShortageForm } from "../features/demand/ShortageForm";
import { ForecastPage } from "../features/demand/ForecastPage";
import { ConsumptionAnalytics } from "../features/demand/ConsumptionAnalytics";
// Redistribution vertical (Member 3).
import { TransferDashboard } from "../features/redistribution/TransferDashboard";
import { TransferDetail } from "../features/redistribution/TransferDetail";
import { TransferForm } from "../features/redistribution/TransferForm";
import { CandidateFacilities } from "../features/redistribution/CandidateFacilities";
import { RouteComparison } from "../features/redistribution/RouteComparison";
import { TransferHistory } from "../features/redistribution/TransferHistory";
import { CoordinatorConsole } from "../pages/CoordinatorConsole";

import { HomePage } from "../pages/HomePage";
import { TrackingPage } from "../pages/TrackingPage";

export const router = createBrowserRouter([
  // Public routes
  { path: "/", element: <HomePage /> },
  { path: "/tracking", element: <TrackingPage /> },
  { path: "/deliveries", element: <TrackingPage /> },
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },

  // Role-based dashboard
  {
    path: "/dashboard",
    element: <ProtectedRoute><DashboardLayout><DashboardPage /></DashboardLayout></ProtectedRoute>,
  },

  // Inventory routes
  {
    path: "/inventory",
    element: (
      <ProtectedRoute policyCheck={(auth) => auth.hasAnyRole(["Administrator", "ADMIN", "FacilityManager", "FACILITY_MANAGER", "OperationalStaff", "STORE_OFFICER", "StoreOfficer", "StoreOperator"])}>
        <DashboardLayout><InventoryPage /></DashboardLayout>
      </ProtectedRoute>
    ),
  },
  { path: "/inventory/:id", element: <ProtectedRoute><DashboardLayout><InventoryDetailPage /></DashboardLayout></ProtectedRoute> },
  { path: "/batches/:id", element: <ProtectedRoute><DashboardLayout><BatchDetailPage /></DashboardLayout></ProtectedRoute> },
  {
    path: "/inventory/receive",
    element: (
      <ProtectedRoute policyCheck={(auth) => auth.canManageMedicineAndExpiry()}>
        <DashboardLayout><ReceiveStockPage /></DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/inventory/expiry",
    element: (
      <ProtectedRoute policyCheck={(auth) => auth.hasAnyRole(["Administrator", "ADMIN", "FacilityManager", "FACILITY_MANAGER", "OperationalStaff", "STORE_OFFICER", "StoreOfficer", "StoreOperator"])}>
        <DashboardLayout><ExpiryPage /></DashboardLayout>
      </ProtectedRoute>
    ),
  },

  // Procurement routes (Member slice: Arudkumaran V.)
  {
    path: "/procurement/suppliers",
    element: <ProtectedRoute><DashboardLayout><SupplierDashboard /></DashboardLayout></ProtectedRoute>,
  },
  {
    path: "/procurement/suppliers/:id",
    element: <ProtectedRoute><DashboardLayout><SupplierDetail /></DashboardLayout></ProtectedRoute>,
  },
  {
    path: "/procurement/orders",
    element: <ProtectedRoute><DashboardLayout><PurchaseOrders /></DashboardLayout></ProtectedRoute>,
  },
  {
    path: "/procurement/priorities",
    element: <ProtectedRoute><DashboardLayout><ProcurementPriority /></DashboardLayout></ProtectedRoute>,
  },
  {
    path: "/procurement/approvals",
    element: (
      <ProtectedRoute requiredRole="FacilityManager">
        <DashboardLayout><ApprovalConsole /></DashboardLayout>
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },

      // Inventory
      { path: "inventory", element: <InventoryPage /> },
      { path: "inventory/:id", element: <InventoryDetailPage /> },
      { path: "batches/:id", element: <BatchDetailPage /> },
      { path: "inventory/receive", element: <ReceiveStockPage /> },
      { path: "inventory/expiry", element: <ExpiryPage /> },

      // Redistribution
      { path: "transfers", element: <TransferDashboard /> },
      { path: "transfers/:id", element: <TransferDetail /> },
      { path: "transfers/:id/candidates", element: <CandidateFacilities /> },
      { path: "transfers/:id/route", element: <RouteComparison /> },
      { path: "history", element: <TransferHistory /> },

      // Procurement
      { path: "procurement/suppliers", element: <SupplierDashboard /> },
      { path: "procurement/suppliers/:id", element: <SupplierDetail /> },
      { path: "procurement/orders", element: <PurchaseOrders /> },
      { path: "procurement/priorities", element: <ProcurementPriority /> },
      {
        path: "procurement/approvals",
        element: (
          <ProtectedRoute requiredRole="FacilityManager">
            <ApprovalConsole />
          </ProtectedRoute>
        ),
      },
      { path: "procurement/workflow", element: <WorkflowMonitor /> },

      // Demand & Shortage
      { path: "demand/shortages", element: <ShortageDashboard /> },
      {
        path: "demand/shortages/new",
        element: (
          <ProtectedRoute requiredRole="FacilityManager">
            <ShortageForm />
          </ProtectedRoute>
        ),
      },
      { path: "demand/shortages/:id", element: <ShortageDetail /> },
      {
        path: "demand/shortages/:id/edit",
        element: (
          <ProtectedRoute requiredRole="FacilityManager">
            <ShortageForm />
          </ProtectedRoute>
        ),
      },
      { path: "demand/forecasts", element: <ForecastPage /> },
      { path: "demand/consumption", element: <ConsumptionAnalytics /> },

      // Admin
      {
        path: "admin/users",
        element: (
          <ProtectedRoute requiredRole="Administrator">
            <AdminPage />
          </ProtectedRoute>
        ),
      },
    ],
  },

  // Fallback
  {
    path: "/procurement/workflow",
    element: <ProtectedRoute><DashboardLayout><WorkflowMonitor /></DashboardLayout></ProtectedRoute>,
  },

  // Demand & Shortage routes (Member slice: Sathurstiga S.)
  {
    path: "/demand/shortages",
    element: <ProtectedRoute><DashboardLayout><ShortageDashboard /></DashboardLayout></ProtectedRoute>,
  },
  {
    path: "/demand/shortages/new",
    element: (
      <ProtectedRoute requiredRole="FacilityManager">
        <DashboardLayout><ShortageForm /></DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/demand/shortages/:id",
    element: <ProtectedRoute><DashboardLayout><ShortageDetail /></DashboardLayout></ProtectedRoute>,
  },
  {
    path: "/demand/shortages/:id/edit",
    element: (
      <ProtectedRoute requiredRole="FacilityManager">
        <DashboardLayout><ShortageForm /></DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/demand/forecasts",
    element: <ProtectedRoute><DashboardLayout><ForecastPage /></DashboardLayout></ProtectedRoute>,
  },
  {
    path: "/demand/consumption",
    element: <ProtectedRoute><DashboardLayout><ConsumptionAnalytics /></DashboardLayout></ProtectedRoute>,
  },

  // Redistribution routes (Member 3). Additive.
  {
    path: "/redistribution/transfers",
    element: <ProtectedRoute><DashboardLayout><TransferDashboard /></DashboardLayout></ProtectedRoute>,
  },
  {
    path: "/redistribution/transfers/new",
    element: <ProtectedRoute><DashboardLayout><TransferForm /></DashboardLayout></ProtectedRoute>,
  },
  {
    path: "/redistribution/transfers/:id",
    element: <ProtectedRoute><DashboardLayout><TransferDetail /></DashboardLayout></ProtectedRoute>,
  },
  {
    path: "/redistribution/transfers/:id/edit",
    element: <ProtectedRoute><DashboardLayout><TransferForm /></DashboardLayout></ProtectedRoute>,
  },

  // Coordinator Multi-Agent Console
  {
    path: "/coordinator",
    element: (
      <ProtectedRoute policyCheck={(auth) => auth.isCoordinatorAuthorized()}>
        <DashboardLayout><CoordinatorConsole /></DashboardLayout>
      </ProtectedRoute>
    ),
  },

  // Admin routes
  {
    path: "/admin/users",
    element: (
      <ProtectedRoute requiredRole="Administrator">
        <DashboardLayout><AdminPage /></DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/admin/audit-logs",
    element: (
      <ProtectedRoute requiredRole="Administrator">
        <DashboardLayout><AuditConsolePage /></DashboardLayout>
      </ProtectedRoute>
    ),
  },
]);
