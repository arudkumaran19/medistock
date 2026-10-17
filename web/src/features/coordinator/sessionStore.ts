import type { ChatMessage, ChatSession } from "./types";

const STORAGE_PREFIX = "medistock_coordinator_sessions_v3";
const ACTIVE_SESSION_PREFIX = "medistock_coordinator_active_session_v3";

export const INITIAL_WELCOME_MESSAGE: ChatMessage = {
  id: "msg-welcome-001",
  sender: "coordinator",
  text: `**MediStock Autonomous Coordinator Agent Online**

I orchestrate 5 specialized sub-agents across the national healthcare supply chain:
- **Inventory Specialist**: Audits stock balances, batch lots, and FEFO expiry tracking.
- **Demand Specialist**: Forecasts burn rates, days of supply, and stockout risk.
- **Redistribution Specialist**: Identifies donor hospitals and calculates transit routes.
- **Procurement Specialist**: Evaluates verified suppliers and drafts purchase orders.
- **Policy & Safety Gate**: Enforces regulatory compliance and mandatory human authorization.

Ask a question about stock levels, shortage forecasts, supplier scores, or select an example below.`,
  timestamp: new Date().toISOString(),
  subAgentsInvoked: [
    "Inventory Specialist",
    "Demand Specialist",
    "Redistribution Specialist",
    "Procurement Specialist",
    "Policy & Safety Gate",
  ],
};

function getStorageKey(userId?: string): string {
  return `${STORAGE_PREFIX}_${userId || "default"}`;
}

function getActiveKey(userId?: string): string {
  return `${ACTIVE_SESSION_PREFIX}_${userId || "default"}`;
}

/** Generate a concise session title from the user's initial prompt */
export function generateSessionTitle(prompt: string): string {
  const clean = prompt.trim().replace(/^["']|["']$/g, "").replace(/\s+/g, " ");
  if (!clean) return "New Conversation";
  if (clean.length <= 36) return clean;
  const truncated = clean.substring(0, 36);
  const lastSpace = truncated.lastIndexOf(" ");
  return (lastSpace > 18 ? truncated.substring(0, lastSpace) : truncated) + "...";
}

/** Create a fresh empty chat session */
export function createNewSession(userId?: string, title = "New Conversation"): ChatSession {
  const now = new Date().toISOString();
  return {
    id: `session-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    title,
    createdAt: now,
    updatedAt: now,
    userId,
    messages: [INITIAL_WELCOME_MESSAGE],
    workflows: [],
    activeWorkflow: null,
  };
}

/** Load all persisted sessions for the given user */
export function loadSessions(userId?: string): ChatSession[] {
  try {
    const raw = localStorage.getItem(getStorageKey(userId));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        // Migrate legacy sessions that don't have the workflows array or missing availableStrategies
        return parsed.map((s: ChatSession) => ({
          ...s,
          workflows: s.workflows ?? (s.activeWorkflow ? [s.activeWorkflow] : []),
          messages: (s.messages ?? []).map((m: ChatMessage) => {
            if (m.sender === "coordinator" && (!m.availableStrategies || m.availableStrategies.length === 0)) {
              if (
                m.intent === "ShortageAnalysis" ||
                m.intent === "ShortageResolution" ||
                m.workflowRun?.workflowType === "ShortageAnalysis" ||
                m.workflowRun?.workflowType === "ShortageResolution" ||
                m.text?.toLowerCase().includes("choose a resolution strategy") ||
                m.text?.toLowerCase().includes("resolution strategy below") ||
                m.text?.toLowerCase().includes("resolution strategy") ||
                m.text?.toLowerCase().includes("potential deficit")
              ) {
                return {
                  ...m,
                  availableStrategies: ["Redistribution", "Procurement", "Both", "Neither"],
                };
              }
            }
            return m;
          }),
        }));
      }
    }
  } catch (e) {
    console.error("Failed to load sessions from storage:", e);
  }

  // Fallback: create initial session
  const initial = createNewSession(userId);
  saveSessions([initial], userId);
  return [initial];
}

/** Save sessions to localStorage */
export function saveSessions(sessions: ChatSession[], userId?: string): void {
  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(sessions));
  } catch (e) {
    console.error("Failed to persist sessions:", e);
  }
}

/** Get the last active session ID for this user */
export function loadActiveSessionId(userId?: string): string | null {
  try {
    return localStorage.getItem(getActiveKey(userId));
  } catch {
    return null;
  }
}

/** Persist the active session ID */
export function saveActiveSessionId(sessionId: string, userId?: string): void {
  try {
    localStorage.setItem(getActiveKey(userId), sessionId);
  } catch {
    // ignore
  }
}

/** Group sessions by recency (Today, Yesterday, Previous 7 Days, Older) */
export interface GroupedSessions {
  label: string;
  sessions: ChatSession[];
}

export function groupSessionsByDate(sessions: ChatSession[]): GroupedSessions[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 86400000;
  const last7DaysStart = todayStart - 86400000 * 7;

  const today: ChatSession[] = [];
  const yesterday: ChatSession[] = [];
  const last7Days: ChatSession[] = [];
  const older: ChatSession[] = [];

  for (const s of sessions) {
    const time = new Date(s.updatedAt || s.createdAt).getTime();
    if (time >= todayStart) {
      today.push(s);
    } else if (time >= yesterdayStart) {
      yesterday.push(s);
    } else if (time >= last7DaysStart) {
      last7Days.push(s);
    } else {
      older.push(s);
    }
  }

  const groups: GroupedSessions[] = [];
  if (today.length > 0) groups.push({ label: "Today", sessions: today });
  if (yesterday.length > 0) groups.push({ label: "Yesterday", sessions: yesterday });
  if (last7Days.length > 0) groups.push({ label: "Previous 7 Days", sessions: last7Days });
  if (older.length > 0) groups.push({ label: "Older", sessions: older });

  return groups;
}
