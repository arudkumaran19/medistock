import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { router } from "./app/router";
import { AuthProvider } from "./features/auth/AuthContext";
import { ToastProvider } from "./components/Toast";
import { ProcurementAgentProvider } from "./context/ProcurementAgentContext";
import "./styles/globals.css";
// Demand & Shortage vertical stylesheets (Sathurstiga S., IT24103156).
// Loaded after globals.css so the demand screens keep their own tokens.
import "./styles/variables.css";
import "./styles/components.css";

const queryClient = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <ProcurementAgentProvider>
            <RouterProvider router={router} />
          </ProcurementAgentProvider>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
