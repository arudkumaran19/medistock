import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { AgentChat } from "./AgentChat";
import { useCoordinator } from "./CoordinatorContext";
import "./coordinator.css";
import {
  BrainCircuit,
  X,
  Minus,
  ExternalLink,
  Plus,
  ChevronDown,
  ChevronUp,
} from "lucide-react";

import { useAuth } from "../auth/AuthContext";

export function FloatingAIAssistant() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const { activeWorkflow, createSession } = useCoordinator();
  const { isCoordinatorAuthorized } = useAuth();

  // If user is already on the dedicated Coordinator Console page or unauthorized, suppress floating widget
  if (location.pathname.startsWith("/coordinator") || !isCoordinatorAuthorized()) {
    return null;
  }

  const isAwaitingApproval = activeWorkflow?.status === "WaitingForApproval";

  return (
    <>
      {/* ── Expanded Chat Popup Window ── */}
      {isOpen && (
        <div
          className="coord-float-panel"
          role="dialog"
          aria-modal="false"
          aria-label="MediStock Coordinator AI Assistant"
        >
          {/* Header */}
          <div
            style={{
              padding: "11px 14px",
              background: "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              borderBottom: "1px solid #1e293b",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
              <div
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 7,
                  background: "rgba(20,184,166,0.2)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <BrainCircuit size={16} strokeWidth={2} color="#2dd4bf" />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#f8fafc" }}>
                    MediStock Assistant
                  </span>
                  <span
                    style={{
                      fontSize: "0.5625rem",
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: 999,
                      background: isAwaitingApproval
                        ? "rgba(245,158,11,0.25)"
                        : "rgba(34,197,94,0.2)",
                      color: isAwaitingApproval ? "#fbbf24" : "#4ade80",
                    }}
                  >
                    {isAwaitingApproval ? "Action Needed" : "Online"}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: "0.625rem", color: "#94a3b8" }}>
                  Shared Coordinator Agent Session
                </p>
              </div>
            </div>

            {/* Header Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
              {/* New Chat */}
              <button
                type="button"
                onClick={() => createSession()}
                title="New chat session"
                aria-label="New chat session"
                style={{
                  background: "rgba(20,184,166,0.15)",
                  border: "none",
                  cursor: "pointer",
                  padding: "4px 8px",
                  borderRadius: 5,
                  color: "#2dd4bf",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 3,
                  fontSize: "0.625rem",
                  fontWeight: 700,
                }}
              >
                <Plus size={11} strokeWidth={2.5} /> New
              </button>
              <Link
                to="/coordinator"
                onClick={() => setIsOpen(false)}
                title="Open full Coordinator Console"
                aria-label="Open full Coordinator Console"
                style={{
                  color: "#94a3b8",
                  padding: 5,
                  borderRadius: 5,
                  display: "flex",
                  alignItems: "center",
                  textDecoration: "none",
                }}
              >
                <ExternalLink size={13} strokeWidth={2} />
              </Link>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Minimize assistant"
                aria-label="Minimize assistant"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 5,
                  borderRadius: 5,
                  color: "#94a3b8",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <Minus size={13} strokeWidth={2} />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                title="Close assistant"
                aria-label="Close assistant"
                style={{
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  padding: 5,
                  borderRadius: 5,
                  color: "#94a3b8",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={13} strokeWidth={2} />
              </button>
            </div>
          </div>

          {/* Body */}
          <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
            <AgentChat compact hideHeader />
          </div>
        </div>
      )}

      {/* ── Single Floating Launcher Pill (Bottom-Right) ── */}
      <button
        type="button"
        className={`coord-float-launcher${isOpen ? " is-open" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-label="Open MediStock AI Assistant"
        aria-expanded={isOpen}
      >
        <BrainCircuit size={16} strokeWidth={2} />
        <span>MediStock AI</span>
        {isAwaitingApproval && (
          <span
            style={{
              width: 7,
              height: 7,
              borderRadius: "50%",
              background: "#fbbf24",
              display: "inline-block",
            }}
            className="coord-pulse"
          />
        )}
        {isOpen ? (
          <ChevronDown size={13} strokeWidth={2} style={{ opacity: 0.7 }} />
        ) : (
          <ChevronUp size={13} strokeWidth={2} style={{ opacity: 0.7 }} />
        )}
      </button>
    </>
  );
}
