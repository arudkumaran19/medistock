import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router-dom";
import { router } from "./app/router";
import { AuthProvider } from "./features/auth/AuthContext";
import { ToastProvider } from "./components/Toast";
import { ProcurementAgentProvider } from "./context/ProcurementAgentContext";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AuthProvider>
      <ToastProvider>
        <ProcurementAgentProvider>
          <RouterProvider router={router} />
        </ProcurementAgentProvider>
      </ToastProvider>
    </AuthProvider>
  </React.StrictMode>
);
