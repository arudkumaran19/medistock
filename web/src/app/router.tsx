import React from "react";
import { createBrowserRouter, Navigate } from "react-router-dom";
import { LoginPage } from "../pages/LoginPage";
import { RegisterPage } from "../pages/RegisterPage";
import { DashboardPage } from "../pages/DashboardPage";
import { InventoryPage } from "../pages/InventoryPage";
import { InventoryDetailPage } from "../pages/InventoryDetailPage";
import { BatchDetailPage } from "../pages/BatchDetailPage";
import { ReceiveStockPage } from "../pages/ReceiveStockPage";
import { ExpiryPage } from "../pages/ExpiryPage";
import { SupplierDashboard } from "../pages/procurement/SupplierDashboard";
import { SupplierDetail } from "../pages/procurement/SupplierDetail";
import { PurchaseOrders } from "../pages/procurement/PurchaseOrders";
import { ProcurementPriority } from "../pages/procurement/ProcurementPriority";
import { ApprovalConsole } from "../pages/procurement/ApprovalConsole";
import { WorkflowMonitor } from "../pages/procurement/WorkflowMonitor";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { DashboardLayout } from "../layouts/DashboardLayout";
import { AdminPage } from "../pages/AdminPage";
import { ShortageDashboard } from "../features/demand/ShortageDashboard";
import { ShortageDetail } from "../features/demand/ShortageDetail";
import { ShortageForm } from "../features/demand/ShortageForm";
import { ForecastPage } from "../features/demand/ForecastPage";
import { ConsumptionAnalytics } from "../features/demand/ConsumptionAnalytics";
import { TransferDashboard } from "../features/redistribution/TransferDashboard";
import { TransferDetail } from "../features/redistribution/TransferDetail";
import { CandidateFacilities } from "../features/redistribution/CandidateFacilities";
import { RouteComparison } from "../features/redistribution/RouteComparison";
import { TransferHistory } from "../features/redistribution/TransferHistory";

export const router = createBrowserRouter([
  // Public routes
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },

  // All protected application routes wrapped in single DashboardLayout
  {
    path: "/",
    element: (
      <ProtectedRoute>
        <DashboardLayout />
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
    path: "*",
    element: <Navigate to="/dashboard" replace />,
  },
]);
