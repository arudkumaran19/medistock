import React, { useState } from "react";
import type { ChatSession } from "./types";
import { groupSessionsByDate } from "./sessionStore";
import {
  Plus,
  Search,
  MessageSquare,
  Edit2,
  Trash2,
  Check,
  X,
  BrainCircuit,
  PanelRightClose,
  PanelRight,
} from "lucide-react";

interface SessionSidebarProps {
  sessions: ChatSession[];
  activeSessionId: string;
  onSelectSession: (id: string) => void;
  onNewSession: () => void;
  onRenameSession: (id: string, newTitle: string) => void;
  onDeleteSession: (id: string) => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  isMobile?: boolean;
}

export function SessionSidebar({
  sessions,
  activeSessionId,
  onSelectSession,
  onNewSession,
  onRenameSession,
  onDeleteSession,
  isCollapsed = false,
  onToggleCollapse,
  isMobile = false,
}: SessionSidebarProps) {
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");

  const filtered = sessions.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      s.title.toLowerCase().includes(q) ||
      s.messages.some((m) => m.text.toLowerCase().includes(q))
    );
  });

  const grouped = groupSessionsByDate(filtered);

  function startRename(s: ChatSession, e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(s.id);
    setEditTitle(s.title);
  }

  function saveRename(id: string, e: React.MouseEvent | React.FormEvent) {
    e.stopPropagation();
    e.preventDefault();
    if (editTitle.trim()) {
      onRenameSession(id, editTitle.trim());
    }
    setEditingId(null);
  }

  function cancelRename(e: React.MouseEvent) {
    e.stopPropagation();
    setEditingId(null);
  }

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    if (sessions.length <= 1) {
      if (window.confirm("Delete conversation and start fresh?")) {
        onDeleteSession(id);
      }
    } else {
      if (window.confirm("Are you sure you want to delete this chat session?")) {
        onDeleteSession(id);
      }
    }
  }

  // ── Collapsed state (56px icon strip with rich tooltips) ──
  if (isCollapsed && !isMobile) {
    return (
      <aside
        className="coord-session-sidebar"
        style={{
          width: 56,
          background: "#f8fafc",
          borderLeft: "1px solid #e2e8f0",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          padding: "12px 0",
          gap: 12,
          flexShrink: 0,
          zIndex: 20,
        }}
        aria-label="Collapsed session navigation"
      >
        {/* Expand toggle */}
        <button
          type="button"
          onClick={onToggleCollapse}
          title="Expand sidebar (shows full session titles)"
          aria-label="Expand session sidebar"
          style={{
            background: "none",
            border: "none",
            color: "#64748b",
            cursor: "pointer",
            padding: 8,
            borderRadius: 6,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <PanelRight size={18} />
        </button>

        {/* New Chat Icon */}
        <button
          type="button"
          onClick={onNewSession}
          title="New Chat conversation"
          aria-label="Create new conversation"
          style={{
            width: 36,
            height: 36,
            borderRadius: 8,
            background: "#0f766e",
            color: "#ffffff",
            border: "none",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(15,118,110,0.2)",
          }}
        >
          <Plus size={18} strokeWidth={2.5} />
        </button>

        <div style={{ width: 36, height: 1, background: "#e2e8f0", margin: "2px 0" }} />

        {/* Recent Session Icons with Tooltips */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 6,
            width: "100%",
          }}
        >
          {sessions.slice(0, 10).map((s) => {
            const isActive = s.id === activeSessionId;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onSelectSession(s.id)}
                title={`${s.title} (${new Date(s.updatedAt || s.createdAt).toLocaleDateString()})`}
                aria-label={`Switch to session: ${s.title}`}
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  background: isActive ? "#ccfbf1" : "transparent",
                  border: isActive ? "1px solid #0d9488" : "1px solid transparent",
                  color: isActive ? "#0f766e" : "#64748b",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  position: "relative",
                }}
              >
                <MessageSquare size={16} />
              </button>
            );
          })}
        </div>
      </aside>
    );
  }

  // ── Expanded state (Full width sidebar) ──
  return (
    <aside
      className="coord-session-sidebar"
      style={{
        width: 240,
        background: "#f8fafc",
        borderLeft: "1px solid #e2e8f0",
        display: "flex",
        flexDirection: "column",
        flexShrink: 0,
        color: "#0f172a",
        height: "100%",
        overflow: "hidden",
        position: isMobile ? "absolute" : "relative",
        top: 0,
        right: 0,
        bottom: 0,
        zIndex: isMobile ? 60 : 20,
        boxShadow: isMobile ? "-4px 0 20px rgba(0,0,0,0.3)" : "none",
      }}
      aria-label="Session sidebar"
    >
      {/* ── Top Header ── */}
      <div style={{ padding: "14px 14px 10px 14px", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                background: "rgba(20,184,166,0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <BrainCircuit size={15} color="#2dd4bf" />
            </div>
            <span style={{ fontSize: "0.8125rem", fontWeight: 700, color: "#0f172a" }}>
              MediStock AI
            </span>
          </div>
          {onToggleCollapse && (
            <button
              type="button"
              onClick={onToggleCollapse}
              title="Collapse sidebar"
              aria-label="Collapse session sidebar"
              style={{
                background: "none",
                border: "none",
                color: "#64748b",
                cursor: "pointer",
                padding: 4,
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
              }}
            >
              <PanelRightClose size={16} />
            </button>
          )}
        </div>

        {/* New Chat Button */}
        <button
          type="button"
          onClick={() => {
            onNewSession();
            if (isMobile && onToggleCollapse) onToggleCollapse();
          }}
          aria-label="Create new conversation"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            padding: "8px 12px",
            borderRadius: 8,
            background: "#0f766e",
            color: "#ffffff",
            border: "none",
            fontSize: "0.8125rem",
            fontWeight: 600,
            cursor: "pointer",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
            transition: "background 0.15s ease",
          }}
        >
          <Plus size={15} strokeWidth={2.5} />
          <span>New Chat</span>
        </button>

        {/* Search input */}
        <div style={{ position: "relative", marginTop: 10 }}>
          <Search
            size={13}
            color="#64748b"
            style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)" }}
          />
          <input
            type="text"
            placeholder="Search conversations..."
            aria-label="Search conversations"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              boxSizing: "border-box",
              padding: "6px 8px 6px 28px",
              background: "#ffffff",
              border: "1px solid #cbd5e1",
              borderRadius: 6,
              fontSize: "0.6875rem",
              color: "#0f172a",
              outline: "none",
            }}
          />
        </div>
      </div>

      {/* ── Sessions List ── */}
      <div style={{ flex: 1, overflowY: "auto", padding: "10px 8px", display: "flex", flexDirection: "column", gap: 14 }}>
        {grouped.length === 0 ? (
          <div style={{ padding: "20px 10px", textAlign: "center", color: "#64748b", fontSize: "0.6875rem" }}>
            No conversations found.
          </div>
        ) : (
          grouped.map((group) => (
            <div key={group.label}>
              <div
                style={{
                  padding: "4px 8px",
                  fontSize: "0.625rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#94a3b8",
                }}
              >
                {group.label}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {group.sessions.map((s) => {
                  const isActive = s.id === activeSessionId;
                  const isEditing = editingId === s.id;

                  return (
                    <div
                      key={s.id}
                      onClick={() => {
                        onSelectSession(s.id);
                        if (isMobile && onToggleCollapse) onToggleCollapse();
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        padding: "7px 10px",
                        borderRadius: 6,
                        background: isActive ? "#ccfbf1" : "transparent",
                        borderLeft: isActive ? "3px solid #0d9488" : "3px solid transparent",
                        cursor: "pointer",
                        color: isActive ? "#0f172a" : "#475569",
                        fontSize: "0.75rem",
                        position: "relative",
                        transition: "background 0.15s ease",
                      }}
                      className="session-list-item"
                    >
                      <MessageSquare
                        size={14}
                        color={isActive ? "#0f766e" : "#64748b"}
                        style={{ flexShrink: 0 }}
                      />

                      {isEditing ? (
                        <form
                          onSubmit={(e) => saveRename(s.id, e)}
                          style={{ display: "flex", alignItems: "center", gap: 4, flex: 1 }}
                        >
                          <input
                            type="text"
                            value={editTitle}
                            onChange={(e) => setEditTitle(e.target.value)}
                            autoFocus
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              flex: 1,
                              fontSize: "0.6875rem",
                              padding: "2px 6px",
                              background: "#0f172a",
                              border: "1px solid #14b8a6",
                              color: "#fff",
                              borderRadius: 4,
                              outline: "none",
                            }}
                          />
                          <button
                            type="submit"
                            title="Save"
                            style={{ background: "none", border: "none", color: "#14b8a6", cursor: "pointer", padding: 2 }}
                          >
                            <Check size={12} />
                          </button>
                          <button
                            type="button"
                            onClick={cancelRename}
                            title="Cancel"
                            style={{ background: "none", border: "none", color: "#94a3b8", cursor: "pointer", padding: 2 }}
                          >
                            <X size={12} />
                          </button>
                        </form>
                      ) : (
                        <>
                          <span
                            style={{
                              flex: 1,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontWeight: isActive ? 600 : 400,
                              color: isActive ? "#0f172a" : "#475569",
                            }}
                          >
                            {s.title}
                          </span>

                          <div style={{ display: "flex", alignItems: "center", gap: 2 }}>
                            <button
                              type="button"
                              onClick={(e) => startRename(s, e)}
                              title="Rename session"
                              style={{
                                background: "none",
                                border: "none",
                                color: "#64748b",
                                cursor: "pointer",
                                padding: 2,
                                borderRadius: 3,
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              <Edit2 size={11} />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => handleDelete(s.id, e)}
                              title="Delete session"
                              style={{
                                background: "none",
                                border: "none",
                                color: "#64748b",
                                cursor: "pointer",
                                padding: 2,
                                borderRadius: 3,
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </aside>
  );
}
