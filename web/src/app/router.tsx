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

  // Root layout with nested redistribution routes and direct routes
  {
    path: "/",
    element: <DashboardLayout />,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "transfers", element: <TransferDashboard /> },
      { path: "transfers/:id", element: <TransferDetail /> },
      { path: "transfers/:id/candidates", element: <CandidateFacilities /> },
      { path: "transfers/:id/route", element: <RouteComparison /> },
      { path: "history", element: <TransferHistory /> },
    ],
  },

  // Role-based dashboard
  {
    path: "/dashboard",
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <DashboardPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },

  // Inventory routes
  {
    path: "/inventory",
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <InventoryPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/inventory/:id",
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <InventoryDetailPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/batches/:id",
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <BatchDetailPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/inventory/receive",
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <ReceiveStockPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/inventory/expiry",
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <ExpiryPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },

  // Procurement routes
  {
    path: "/procurement/suppliers",
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <SupplierDashboard />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/procurement/suppliers/:id",
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <SupplierDetail />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/procurement/orders",
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <PurchaseOrders />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/procurement/priorities",
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <ProcurementPriority />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/procurement/approvals",
    element: (
      <ProtectedRoute requiredRole="FacilityManager">
        <DashboardLayout>
          <ApprovalConsole />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/procurement/workflow",
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <WorkflowMonitor />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },

  // Demand & Shortage routes
  {
    path: "/demand/shortages",
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <ShortageDashboard />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/demand/shortages/new",
    element: (
      <ProtectedRoute requiredRole="FacilityManager">
        <DashboardLayout>
          <ShortageForm />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/demand/shortages/:id",
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <ShortageDetail />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/demand/shortages/:id/edit",
    element: (
      <ProtectedRoute requiredRole="FacilityManager">
        <DashboardLayout>
          <ShortageForm />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/demand/forecasts",
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <ForecastPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },
  {
    path: "/demand/consumption",
    element: (
      <ProtectedRoute>
        <DashboardLayout>
          <ConsumptionAnalytics />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },

  // Admin routes
  {
    path: "/admin/users",
    element: (
      <ProtectedRoute requiredRole="Administrator">
        <DashboardLayout>
          <AdminPage />
        </DashboardLayout>
      </ProtectedRoute>
    ),
  },

  // Fallback
  {
    path: "*",
    element: <Navigate to="/dashboard" replace />,
  },
]);
