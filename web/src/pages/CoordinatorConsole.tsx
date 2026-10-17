import React, { useState, useEffect } from "react";
import { useCoordinator } from "../features/coordinator/CoordinatorContext";
import { SessionSidebar } from "../features/coordinator/SessionSidebar";
import { AgentChat } from "../features/coordinator/AgentChat";
import { WorkflowTimeline } from "../features/coordinator/WorkflowTimeline";
import { useAuth } from "../features/auth/AuthContext";
import "../features/coordinator/coordinator.css";
import {
  PanelRight,
  Sparkles,
  Workflow,
  X,
  CheckCircle2,
  AlertTriangle,
  Plus,
} from "lucide-react";

export function CoordinatorConsole() {
  const { user } = useAuth();
  const {
    sessions,
    activeSessionId,
    createSession,
    switchSession,
    renameSession,
    deleteSession,
    sessionWorkflows,
    activeWorkflow,
    isRunning,
    elapsedSeconds,
    currentPhase,
    error,
    actionSuccess,
    availableScenarios,
    selectScenario,
    sendMessage,
  } = useCoordinator();

  // Responsive state
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth : 1440
  );
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() =>
    typeof window !== "undefined" ? window.innerWidth < 1200 : false
  );
  const [showScenariosModal, setShowScenariosModal] = useState(false);
  const [showTimelineDrawer, setShowTimelineDrawer] = useState(false);

  // Resize listener
  useEffect(() => {
    function handleResize() {
      const w = window.innerWidth;
      setWindowWidth(w);
      if (w < 1100 && !sidebarCollapsed) {
        setSidebarCollapsed(true);
      }
    }
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sidebarCollapsed]);

  // Escape key listener to close overlay panels
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setShowTimelineDrawer(false);
        setShowScenariosModal(false);
        if (window.innerWidth < 1024) {
          setSidebarCollapsed(true);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // Status derived from workflow state
  const statusLabel = isRunning
    ? `Orchestrating (${elapsedSeconds}s)`
    : activeWorkflow?.status === "WaitingForApproval"
    ? "Awaiting Approval"
    : activeWorkflow?.status === "Completed"
    ? "Completed"
    : activeWorkflow?.status === "Failed"
    ? "Failed"
    : "Ready";

  const statusColor = isRunning
    ? "#0f766e"
    : activeWorkflow?.status === "WaitingForApproval"
    ? "#d97706"
    : activeWorkflow?.status === "Completed"
    ? "#16a34a"
    : activeWorkflow?.status === "Failed"
    ? "#dc2626"
    : "#64748b";

  function handleSelectScenario(sc: typeof availableScenarios[0]) {
    selectScenario(sc);
    setShowScenariosModal(false);
    sendMessage(sc.prompt);
  }

  const isWideScreen = windowWidth >= 1500;
  const isMobile = windowWidth < 768;

  return (
    <div
      style={{
          display: "flex",
          flex: 1,
          height: "100%",
          minHeight: 0,
          minWidth: 0,
          background: "#ffffff",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          overflow: "hidden",
          boxShadow: "0 4px 16px rgba(0,0,0,0.04)",
          position: "relative",
          margin: "8px 12px",
        }}
      >
        {/* ── Main Conversation Area (Center) ── */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            minHeight: 0,
            height: "100%",
            display: "flex",
            flexDirection: "column",
            background: "#ffffff",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {/* Header Bar */}
          <div
            style={{
              padding: "10px 18px",
              borderBottom: "1px solid #e2e8f0",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: 10,
              background: "#f8fafc",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              <div style={{ minWidth: 0 }}>
                <h1
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 700,
                    color: "#0f172a",
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: 340,
                  }}
                >
                  {activeSession?.title || "MediStock Coordinator"}
                </h1>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 1 }}>
                  <span
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: "50%",
                      background: statusColor,
                      display: "inline-block",
                    }}
                    className={isRunning ? "coord-pulse" : ""}
                  />
                  <span style={{ fontSize: "0.6875rem", color: statusColor, fontWeight: 600 }}>
                    {statusLabel}
                  </span>
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              {/* + New Chat */}
              <button
                type="button"
                onClick={() => createSession()}
                aria-label="Start new chat session"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 10px",
                  borderRadius: 6,
                  background: "#0f766e",
                  border: "none",
                  fontSize: "0.6875rem",
                  fontWeight: 700,
                  color: "#ffffff",
                  cursor: "pointer",
                }}
              >
                <Plus size={12} />
                <span>New Chat</span>
              </button>

              {/* Explore Scenarios */}
              <button
                type="button"
                onClick={() => setShowScenariosModal(true)}
                aria-label="Explore clinical tasks"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 10px",
                  borderRadius: 6,
                  background: "#ffffff",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  color: "#334155",
                  cursor: "pointer",
                }}
              >
                <Sparkles size={12} color="#0f766e" />
                <span>Explore Tasks</span>
              </button>

              {/* View Timeline toggle */}
              {activeWorkflow && (
                <button
                  type="button"
                  onClick={() => setShowTimelineDrawer((prev) => !prev)}
                  aria-label="Toggle workflow timeline"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 5,
                    padding: "5px 10px",
                    borderRadius: 6,
                    background: showTimelineDrawer ? "#f0fdfa" : "#ffffff",
                    border: `1px solid ${showTimelineDrawer ? "#0f766e" : "#cbd5e1"}`,
                    fontSize: "0.6875rem",
                    fontWeight: 600,
                    color: showTimelineDrawer ? "#0f766e" : "#334155",
                    cursor: "pointer",
                  }}
                >
                  <Workflow size={12} color={showTimelineDrawer ? "#0f766e" : "#64748b"} />
                  <span>Workflow Activity</span>
                </button>
              )}

              {/* Conversations Panel Toggle Button */}
              <button
                type="button"
                onClick={() => setSidebarCollapsed((prev) => !prev)}
                title={sidebarCollapsed ? "Open conversations panel" : "Collapse conversations panel"}
                aria-label={sidebarCollapsed ? "Expand session sidebar" : "Collapse session sidebar"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 10px",
                  borderRadius: 6,
                  background: !sidebarCollapsed ? "#f0fdfa" : "#ffffff",
                  border: `1px solid ${!sidebarCollapsed ? "#0f766e" : "#cbd5e1"}`,
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  color: !sidebarCollapsed ? "#0f766e" : "#334155",
                  cursor: "pointer",
                }}
              >
                <PanelRight size={12} color={!sidebarCollapsed ? "#0f766e" : "#64748b"} />
                <span>Conversations</span>
              </button>
            </div>
          </div>

          {/* Error / Success Notifications */}
          {error && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                background: "#fef2f2",
                borderBottom: "1px solid #fecaca",
                fontSize: "0.75rem",
                color: "#991b1b",
                flexShrink: 0,
              }}
            >
              <AlertTriangle size={13} color="#dc2626" style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}
          {actionSuccess && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                background: "#f0fdf4",
                borderBottom: "1px solid #bbf7d0",
                fontSize: "0.75rem",
                color: "#166534",
                flexShrink: 0,
              }}
            >
              <CheckCircle2 size={13} color="#16a34a" style={{ flexShrink: 0 }} />
              <span>{actionSuccess}</span>
            </div>
          )}

          {/* ── Main Chat Area (fills available height) ── */}
          <div style={{ flex: "1 1 0%", minHeight: 0, minWidth: 0, display: "flex", flexDirection: "column" }}>
            <AgentChat />
          </div>
        </div>

        {/* ── Wide Desktop (>= 1500px): Docked Timeline Inspector ── */}
        {showTimelineDrawer && (sessionWorkflows.length > 0 || isRunning) && isWideScreen && (
          <div
            style={{
              width: 360,
              borderLeft: "1px solid #e2e8f0",
              background: "#ffffff",
              display: "flex",
              flexDirection: "column",
              flexShrink: 0,
              minHeight: 0,
            }}
          >
            <div style={{ flex: 1, overflowY: "auto", padding: 12 }}>
              <WorkflowTimeline
                workflows={sessionWorkflows}
                isRunning={isRunning}
                elapsedSeconds={elapsedSeconds}
                currentPhase={currentPhase}
                onClose={() => setShowTimelineDrawer(false)}
              />
            </div>
          </div>
        )}

        {/* ── Right: AI Sessions Sidebar ── */}
        {/* Mobile backdrop for sidebar overlay when expanded */}
        {isMobile && !sidebarCollapsed && (
          <div
            onClick={() => setSidebarCollapsed(true)}
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15,23,42,0.45)",
              zIndex: 55,
              backdropFilter: "blur(2px)",
            }}
          />
        )}

        <SessionSidebar
          sessions={sessions}
          activeSessionId={activeSessionId}
          onSelectSession={switchSession}
          onNewSession={() => createSession()}
          onRenameSession={renameSession}
          onDeleteSession={deleteSession}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed((prev) => !prev)}
          isMobile={isMobile}
        />

        {/* ── Intermediate & Narrow Screens (< 1440px): Slide-over Drawer with Backdrop ── */}
        {showTimelineDrawer && (sessionWorkflows.length > 0 || isRunning) && !isWideScreen && (
          <>
            {/* Dark Backdrop */}
            <div
              onClick={() => setShowTimelineDrawer(false)}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                background: "rgba(15,23,42,0.45)",
                zIndex: 60,
                backdropFilter: "blur(2px)",
              }}
            />
            {/* Slide-out Drawer Panel */}
            <div
              style={{
                position: "absolute",
                top: 0,
                right: 0,
                bottom: 0,
                width: isMobile ? "100%" : 420,
                maxWidth: "100%",
                background: "#ffffff",
                boxShadow: "-4px 0 24px rgba(0,0,0,0.18)",
                display: "flex",
                flexDirection: "column",
                zIndex: 70,
              }}
              className="coord-slide-in-right"
            >
              <div
                style={{
                  padding: "12px 16px",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#f8fafc",
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
                  <Workflow size={15} color="#0f766e" />
                  <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#1e293b" }}>
                    Workflow Execution Timeline
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowTimelineDrawer(false)}
                  title="Close timeline (Esc)"
                  aria-label="Close timeline"
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    color: "#64748b",
                    padding: 4,
                    borderRadius: 4,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: 14 }}>
                <WorkflowTimeline
                  workflows={sessionWorkflows}
                  isRunning={isRunning}
                  elapsedSeconds={elapsedSeconds}
                  currentPhase={currentPhase}
                  onClose={() => setShowTimelineDrawer(false)}
                />
              </div>
            </div>
          </>
        )}

        {/* ── Clinical Scenarios Modal ── */}
        {showScenariosModal && (
          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: "rgba(15,23,42,0.45)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 99999,
              backdropFilter: "blur(2px)",
              padding: 16,
            }}
            onClick={() => setShowScenariosModal(false)}
          >
            <div
              style={{
                width: 600,
                maxWidth: "100%",
                background: "#ffffff",
                borderRadius: 14,
                boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
                overflow: "hidden",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid #e2e8f0",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "#f8fafc",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Sparkles size={16} color="#0f766e" />
                  <span style={{ fontSize: "0.875rem", fontWeight: 700, color: "#0f172a" }}>
                    Explore Role-Tailored Clinical Tasks
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowScenariosModal(false)}
                  title="Close (Esc)"
                  aria-label="Close modal"
                  style={{ background: "none", border: "none", cursor: "pointer", color: "#64748b" }}
                >
                  <X size={16} />
                </button>
              </div>

              <div style={{ padding: "16px", maxHeight: 420, overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                {availableScenarios.map((sc) => (
                  <div
                    key={sc.id}
                    onClick={() => handleSelectScenario(sc)}
                    style={{
                      padding: "10px 14px",
                      borderRadius: 8,
                      border: "1px solid #e2e8f0",
                      background: "#ffffff",
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    className="coord-scenario-btn"
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#1e293b" }}>
                        {sc.title}
                      </span>
                      <span
                        style={{
                          fontSize: "0.5625rem",
                          fontWeight: 700,
                          padding: "1px 6px",
                          borderRadius: 999,
                          background: "#f1f5f9",
                          color: "#475569",
                        }}
                      >
                        {sc.category}
                      </span>
                    </div>
                    <p style={{ margin: "0 0 6px 0", fontSize: "0.75rem", color: "#475569", lineHeight: 1.4 }}>
                      {sc.prompt}
                    </p>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                      {sc.subAgents.map((sa, i) => (
                        <span
                          key={i}
                          style={{
                            fontSize: "0.5625rem",
                            fontWeight: 600,
                            padding: "1px 5px",
                            borderRadius: 999,
                            background: "#f0fdfa",
                            color: "#0f766e",
                          }}
                        >
                          {sa}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
  );
}

export default CoordinatorConsole;
