import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "./app/router";
import { AuthProvider } from "./features/auth/AuthContext";
import { ToastProvider } from "./components/Toast";
import { ProcurementAgentProvider } from "./features/procurement/ProcurementAgentContext";
import { CoordinatorProvider } from "./features/coordinator/CoordinatorContext";
import "./styles/design-system-v2.css";
import "./styles/globals.css";
import "./styles/components.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <ProcurementAgentProvider>
            <CoordinatorProvider>
              <RouterProvider router={router} />
            </CoordinatorProvider>
          </ProcurementAgentProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
