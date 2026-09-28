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
import { AdminPage } from "../pages/AdminPage";
import { ShortageDashboard } from "../features/demand/ShortageDashboard";
import { ShortageDetail } from "../features/demand/ShortageDetail";
import { ShortageForm } from "../features/demand/ShortageForm";
import { ForecastPage } from "../features/demand/ForecastPage";
import { ConsumptionAnalytics } from "../features/demand/ConsumptionAnalytics";

export const router = createBrowserRouter([
  // Public routes
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },

  // Root redirect → dashboard
  { path: "/", element: <Navigate to="/dashboard" replace /> },

  // Role-based dashboard
  {
    path: "/dashboard",
    element: <ProtectedRoute><DashboardPage /></ProtectedRoute>,
  },

  // Inventory routes
  { path: "/inventory", element: <ProtectedRoute><InventoryPage /></ProtectedRoute> },
  { path: "/inventory/:id", element: <ProtectedRoute><InventoryDetailPage /></ProtectedRoute> },
  { path: "/batches/:id", element: <ProtectedRoute><BatchDetailPage /></ProtectedRoute> },
  { path: "/inventory/receive", element: <ProtectedRoute><ReceiveStockPage /></ProtectedRoute> },
  { path: "/inventory/expiry", element: <ProtectedRoute><ExpiryPage /></ProtectedRoute> },

  // Procurement routes (Member slice: Arudkumaran V.)
  {
    path: "/procurement/suppliers",
    element: <ProtectedRoute><SupplierDashboard /></ProtectedRoute>,
  },
  {
    path: "/procurement/suppliers/:id",
    element: <ProtectedRoute><SupplierDetail /></ProtectedRoute>,
  },
  {
    path: "/procurement/orders",
    element: <ProtectedRoute><PurchaseOrders /></ProtectedRoute>,
  },
  {
    path: "/procurement/priorities",
    element: <ProtectedRoute><ProcurementPriority /></ProtectedRoute>,
  },
  {
    path: "/procurement/approvals",
    element: (
      <ProtectedRoute requiredRole="FacilityManager">
        <ApprovalConsole />
      </ProtectedRoute>
    ),
  },
  {
    path: "/procurement/workflow",
    element: <ProtectedRoute><WorkflowMonitor /></ProtectedRoute>,
  },

  // Demand & Shortage routes (Member slice: Sathurstiga S.)
  {
    path: "/demand/shortages",
    element: <ProtectedRoute><ShortageDashboard /></ProtectedRoute>,
  },
  {
    path: "/demand/shortages/new",
    element: (
      <ProtectedRoute requiredRole="FacilityManager">
        <ShortageForm />
      </ProtectedRoute>
    ),
  },
  {
    path: "/demand/shortages/:id",
    element: <ProtectedRoute><ShortageDetail /></ProtectedRoute>,
  },
  {
    path: "/demand/shortages/:id/edit",
    element: (
      <ProtectedRoute requiredRole="FacilityManager">
        <ShortageForm />
      </ProtectedRoute>
    ),
  },
  {
    path: "/demand/forecasts",
    element: <ProtectedRoute><ForecastPage /></ProtectedRoute>,
  },
  {
    path: "/demand/consumption",
    element: <ProtectedRoute><ConsumptionAnalytics /></ProtectedRoute>,
  },

  // Admin routes
  {
    path: "/admin/users",
    element: (
      <ProtectedRoute requiredRole="Administrator">
        <AdminPage />
      </ProtectedRoute>
    ),
  },
]);
