import { createBrowserRouter, Navigate } from "react-router-dom";
import { InventoryPage } from "../pages/InventoryPage";
import { InventoryDetailPage } from "../pages/InventoryDetailPage";
import { BatchDetailPage } from "../pages/BatchDetailPage";
import { ReceiveStockPage } from "../pages/ReceiveStockPage";
import { ExpiryPage } from "../pages/ExpiryPage";
export const router = createBrowserRouter([{ path: "/", element: <Navigate to="/inventory" replace /> }, { path: "/inventory", element: <InventoryPage /> }, { path: "/inventory/:id", element: <InventoryDetailPage /> }, { path: "/batches/:id", element: <BatchDetailPage /> }, { path: "/inventory/receive", element: <ReceiveStockPage /> }, { path: "/inventory/expiry", element: <ExpiryPage /> }]);
