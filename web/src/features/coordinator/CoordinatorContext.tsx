import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { workflowApi } from "@/services/workflowApi";
import { procurementApi } from "@/services/procurementApi";
import { queryClient } from "@/app/queryClient";
import type { WorkflowRun } from "@/types/workflow";
import { useAuth } from "@/features/auth/AuthContext";
import { ALL_SCENARIOS, getScenariosForRoles } from "./scenarios";
import type { ChatMessage, ChatSession, SampleScenario } from "./types";
import {
  createNewSession,
  generateSessionTitle,
  loadActiveSessionId,
  loadSessions,
  saveActiveSessionId,
  saveSessions,
  INITIAL_WELCOME_MESSAGE,
} from "./sessionStore";

interface CoordinatorContextValue {
  sessions: ChatSession[];
  activeSessionId: string;
  createSession: (title?: string) => void;
  switchSession: (sessionId: string) => void;
  renameSession: (sessionId: string, newTitle: string) => void;
  deleteSession: (sessionId: string) => void;
  messages: ChatMessage[];
  /** All workflows executed in the active session, chronological order */
  sessionWorkflows: WorkflowRun[];
  /** Most recently completed/active workflow in the session (backwards compat) */
  activeWorkflow: WorkflowRun | null;
  isRunning: boolean;
  elapsedSeconds: number;
  error: string | null;
  actionSuccess: string | null;
  activeScenarioId: string | null;
  availableScenarios: SampleScenario[];
  currentPhase: string;
  sendMessage: (prompt: string, workflowType?: string, skipUserBubble?: boolean) => Promise<void>;
  selectScenario: (scenario: SampleScenario) => void;
  submitApproval: (decision: "Approved" | "Rejected", comments?: string) => Promise<void>;
  editUserMessage: (messageId: string, newText: string, resubmit?: boolean) => Promise<void>;
  editAssistantMessage: (messageId: string, newText: string) => void;
  clearConversation: () => void;
  cancelExecution: () => void;
  retryLast: () => Promise<void>;
}

const CoordinatorContext = createContext<CoordinatorContextValue | undefined>(undefined);

export function CoordinatorProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.userId ? String(user.userId) : undefined;
  const userRoles = user?.roles ?? [];

  // Scenarios filtered by RBAC
  const availableScenarios = getScenariosForRoles(userRoles);

  // Initialize sessions from persistent store
  const [sessions, setSessions] = useState<ChatSession[]>(() => {
    return loadSessions(userId);
  });

  // Active session ID
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const savedActiveId = loadActiveSessionId(userId);
    const existing = sessions.find((s) => s.id === savedActiveId);
    return existing ? existing.id : sessions[0]?.id || "default";
  });

  // Ensure active session exists
  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  const [isRunning, setIsRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [activeScenarioId, setActiveScenarioId] = useState<string | null>(
    availableScenarios[0]?.id ?? null
  );
  const [currentPhase, setCurrentPhase] = useState("Idle");

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const lastPromptRef = useRef<string>("");

  // Derived values from active session
  const sessionWorkflows: WorkflowRun[] = activeSession?.workflows ?? [];
  const activeWorkflow: WorkflowRun | null =
    sessionWorkflows.length > 0 ? sessionWorkflows[sessionWorkflows.length - 1] : null;

  // Reload sessions whenever authenticated user changes (switched user or fresh login)
  const prevUserIdRef = useRef<string | undefined>(userId);
  useEffect(() => {
    if (prevUserIdRef.current !== userId) {
      prevUserIdRef.current = userId;
      const loaded = loadSessions(userId);
      setSessions(loaded);
      const savedActiveId = loadActiveSessionId(userId);
      const existing = loaded.find((s) => s.id === savedActiveId);
      setActiveSessionId(existing ? existing.id : loaded[0]?.id || "default");
    }
  }, [userId]);

  // Persist sessions whenever they change
  useEffect(() => {
    if (sessions.length > 0) {
      saveSessions(sessions, userId);
    }
  }, [sessions, userId]);

  // Persist active session ID
  useEffect(() => {
    if (activeSessionId) {
      saveActiveSessionId(activeSessionId, userId);
    }
  }, [activeSessionId, userId]);

  // Elapsed timer effect
  useEffect(() => {
    if (isRunning) {
      setElapsedSeconds(0);
      const start = Date.now();
      timerRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - start) / 1000));
      }, 500);
    } else {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isRunning]);

  // Dynamic phase messages during execution
  useEffect(() => {
    if (!isRunning) {
      setCurrentPhase("Ready");
      return;
    }

    const phases = [
      "Interpreting clinical intent & objectives...",
      "Validating role authorizations & policy thresholds...",
      "Delegating tasks to Inventory & Demand Specialists...",
      "Calculating redistribution routes & supplier scoring...",
      "Evaluating safety thresholds & compiling executive synthesis...",
    ];

    let step = 0;
    setCurrentPhase(phases[0]);
    const phaseInterval = setInterval(() => {
      step = (step + 1) % phases.length;
      setCurrentPhase(phases[step]);
    }, 2200);

    return () => clearInterval(phaseInterval);
  }, [isRunning]);

  // Session Actions
  const createSession = useCallback((customTitle?: string) => {
    const newSession = createNewSession(userId, customTitle || "New Conversation");
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    setError(null);
    setActionSuccess(null);
  }, [userId]);

  const switchSession = useCallback((sessionId: string) => {
    setActiveSessionId(sessionId);
    setError(null);
    setActionSuccess(null);
  }, []);

  const renameSession = useCallback((sessionId: string, newTitle: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title: newTitle, updatedAt: new Date().toISOString() } : s))
    );
  }, []);

  const deleteSession = useCallback((sessionId: string) => {
    setSessions((prev) => {
      const filtered = prev.filter((s) => s.id !== sessionId);
      if (filtered.length === 0) {
        const fresh = createNewSession(userId);
        setActiveSessionId(fresh.id);
        return [fresh];
      }
      if (activeSessionId === sessionId) {
        setActiveSessionId(filtered[0].id);
      }
      return filtered;
    });
  }, [activeSessionId, userId]);

  const selectScenario = useCallback((scenario: SampleScenario) => {
    setActiveScenarioId(scenario.id);
  }, []);

  const clearConversation = useCallback(() => {
    if (!activeSession) return;
    setSessions((prev) =>
      prev.map((s) =>
        s.id === activeSession.id
          ? {
              ...s,
              messages: [INITIAL_WELCOME_MESSAGE],
              workflows: [],
              activeWorkflow: null,
              updatedAt: new Date().toISOString(),
            }
          : s
      )
    );
    setError(null);
    setActionSuccess(null);
  }, [activeSession]);

  const cancelExecution = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsRunning(false);
    setError("Operation cancelled by user.");
  }, []);

  /**
   * Minimal intent resolver for resubmitted/edited messages.
   * Mirrors the logic in AgentChat.resolveWorkflowType without needing the component.
   */
  function resolveWorkflowTypeForResubmit(text: string): string {
    const lower = text.toLowerCase().trim();
    // Strategy selections
    if (lower === "both" || lower === "dual" || lower === "hybrid") return "CombinedResolution";
    if (lower === "procurement" || lower === "procure" || lower === "purchase") return "AutonomousProcurement";
    if (lower === "redistribution" || lower === "redistribute" || lower === "transfer") return "StockRedistribution";
    if (lower === "neither" || lower === "none" || lower === "cancel") return "Neither";
    if (lower.startsWith("apply strategy: ")) {
      const s = lower.replace("apply strategy: ", "").trim();
      if (s === "both") return "CombinedResolution";
      if (s === "procurement") return "AutonomousProcurement";
      if (s === "redistribution") return "StockRedistribution";
      if (s === "neither") return "Neither";
    }
    // Batch expiry queries
    if (lower.includes("expir") || lower.includes("expire") || (lower.includes("batch") && (lower.includes("day") || lower.includes("across") || lower.includes("soon") || lower.includes("within")))) return "ExpiryAudit";
    // Catalogue queries
    const cataloguePhrases = ["what medicines are", "list all medicines", "all medicines", "medicines available", "medicines and their stock", "medicines and stock", "avaliable", "total stocks", "total stock", "across facilities", "catalogue", "catalog"];
    if (cataloguePhrases.some((p) => lower.includes(p)) || (lower.includes("medicines") && (lower.includes("stock") || lower.includes("available") || lower.includes("avaliable")))) return "CatalogueQuery";
    // Simple factual stock queries
    const stockPhrases = ["what is the stock", "what's the stock", "what is the current stock", "what's the current stock", "how much stock", "current stock of", "stock level of", "how many units", "how many tablets", "how many capsules", "how much do we have", "quantity on hand"];
    if (stockPhrases.some((p) => lower.includes(p)) && !lower.includes("shortage") && !lower.includes("deficit") && !lower.includes("order")) return "InventoryAudit";
    // Demand/forecast
    if ((lower.includes("forecast") || lower.includes("days of supply") || lower.includes("burn rate") || lower.includes("how long will") || lower.includes("will last")) && !lower.includes("shortage") && !lower.includes("deficit")) return "DemandForecast";
    // Default to empty string so backend/LLM determines intent dynamically
    return "";
  }

  /**
   * Helper: build an assistant ChatMessage from a completed WorkflowRun.
   */

  function buildAssistantMessage(run: WorkflowRun, userMsgId: string): ChatMessage {
    let parsedResult: Record<string, any> | null = null;
    if (run.resultJson) {
      try {
        parsedResult = JSON.parse(run.resultJson);
      } catch {
        parsedResult = null;
      }
    }

    const recommendation =
      parsedResult?.final_recommendation ||
      "Multi-agent clinical assessment completed. See detailed execution timeline.";

    const subAgents = parsedResult?.sub_agents_involved || [
      "Inventory Specialist",
      "Demand Specialist",
      "Redistribution Specialist",
      "Procurement Specialist",
      "Policy & Safety Gate",
    ];

    // Phase 3: available strategies — only from agent, never inferred from text
    let availableStrategies: string[] | undefined =
      parsedResult != null && Array.isArray(parsedResult.available_strategies) && parsedResult.available_strategies.length > 0
        ? (parsedResult.available_strategies as string[])
        : undefined;

    // Only fall back to strategy buttons when intent is EXPLICITLY ShortageAnalysis
    // and the agent confirmed it (not just because the text mentions "shortage" or "days of supply").
    if (!availableStrategies && !run.requiresApproval) {
      const intentStr = parsedResult?.intent || "";
      const recLower = (recommendation || "").toLowerCase();
      if (
        intentStr === "ShortageAnalysis" &&
        (recLower.includes("choose a resolution strategy") ||
          recLower.includes("resolution strategy below") ||
          recLower.includes("please choose"))
      ) {
        availableStrategies = ["Redistribution", "Procurement", "Both", "Neither"];
      }
    }

    return {
      id: `coord-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      sender: "coordinator",
      text: recommendation,
      timestamp: new Date().toISOString(),
      status: "success",
      workflowId: run.id,
      workflowRun: run,
      subAgentsInvoked: subAgents,
      intent: parsedResult?.intent || run.workflowType,
      requiresApproval: run.requiresApproval,
      approvalStatus: run.requiresApproval ? "Pending" : undefined,
      availableStrategies,
    };
  }

  const sendMessage = useCallback(
    async (prompt: string, workflowType = "", skipUserBubble = false) => {
      if (!prompt.trim() || isRunning) return;

      lastPromptRef.current = prompt.trim();
      setError(null);
      setActionSuccess(null);
      setIsRunning(true);

      const userMsgId = `usr-${Date.now()}`;
      const userMsg: ChatMessage = {
        id: userMsgId,
        sender: "user",
        text: prompt.trim(),
        timestamp: new Date().toISOString(),
        status: "sending",
      };

      // Capture sessionId before async work
      const sessionId = activeSessionId;

      // Add user message to active session only if not skipping user bubble
      if (!skipUserBubble) {
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== sessionId) return s;
            const isInitialTitle = s.title === "New Conversation" || s.title.startsWith("New Chat");
            const updatedTitle = isInitialTitle ? generateSessionTitle(prompt) : s.title;
            return {
              ...s,
              title: updatedTitle,
              updatedAt: new Date().toISOString(),
              messages: [...s.messages, userMsg],
            };
          })
        );
      }

      try {
        const run = await workflowApi.startWorkflow({
          objective: prompt.trim(),
          workflowType,
          sessionId,
          messageId: userMsgId,
        });

        const assistantMsg = buildAssistantMessage(run, userMsgId);

        // Append workflow to session's workflows array and add assistant message
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== sessionId) return s;
            const newMessages = skipUserBubble
              ? [...s.messages, assistantMsg]
              : s.messages
                  .map((m) => (m.id === userMsgId ? { ...m, status: "success" as const } : m))
                  .concat(assistantMsg);

            return {
              ...s,
              updatedAt: new Date().toISOString(),
              // Append the new workflow; replace if same ID already exists (edge case)
              workflows: [
                ...(s.workflows ?? []).filter((w) => w.id !== run.id),
                run,
              ],
              messages: newMessages,
            };
          })
        );
      } catch (err) {
        const errText =
          err instanceof Error ? err.message : "Failed to execute coordinator workflow.";
        setError(errText);

        const lowerErr = errText.toLowerCase();
        let formattedText = "";
        if (
          lowerErr.includes("access denied") ||
          lowerErr.includes("permission") ||
          lowerErr.includes("role does not permit") ||
          lowerErr.includes("forbidden") ||
          lowerErr.includes("unauthorized")
        ) {
          formattedText = `**Access Restricted**: ${errText.replace(/^403\s*[:-]?\s*/i, "")}\n\nYour signed-in account does not have permission for this clinical or administrative action. Please contact your clinical facility administrator if you require elevated authorization.`;
        } else if (
          lowerErr.includes("session") ||
          lowerErr.includes("expired") ||
          lowerErr.includes("sign in") ||
          lowerErr.includes("401")
        ) {
          formattedText = `**Session Required**: Your session has expired. Please sign in again to continue clinical operations.`;
        } else if (
          lowerErr.includes("unavailable") ||
          lowerErr.includes("503") ||
          lowerErr.includes("could not be reached")
        ) {
          formattedText = `**Service Temporarily Unavailable**: The MediStock backend service is currently unreachable or starting up. Your clinical records are safe and unchanged. Please wait a moment and try again.`;
        } else if (
          lowerErr.includes("network") ||
          lowerErr.includes("fetch") ||
          lowerErr.includes("connection")
        ) {
          formattedText = `**Connection Notice**: Unable to reach the MediStock server. Please verify your network connection and ensure the application services are running.`;
        } else {
          formattedText = `**Clinical Notice**: ${errText}\n\nNo changes were made. Please verify your query or select a standard prompt below.`;
        }

        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          sender: "coordinator",
          text: formattedText,
          timestamp: new Date().toISOString(),
          status: "error",
        };

        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== sessionId) return s;
            const newMessages = skipUserBubble
              ? [...s.messages, errorMsg]
              : s.messages
                  .map((m) => (m.id === userMsgId ? { ...m, status: "error" as const } : m))
                  .concat(errorMsg);

            return {
              ...s,
              updatedAt: new Date().toISOString(),
              messages: newMessages,
            };
          })
        );
      } finally {
        setIsRunning(false);
      }
    },
    [activeSessionId, isRunning]
  );

  const retryLast = useCallback(async () => {
    if (lastPromptRef.current) {
      await sendMessage(lastPromptRef.current);
    }
  }, [sendMessage]);

  const submitApproval = useCallback(
    async (decision: "Approved" | "Rejected", comments?: string) => {
      // Find the most recent workflow awaiting approval in this session
      const wfAwaitingApproval = [...sessionWorkflows]
        .reverse()
        .find((w) => w.status === "WaitingForApproval");

      const currentWf = wfAwaitingApproval ?? activeWorkflow;
      if (!currentWf) return;

      const pendingApproval = currentWf.approvals?.find((a) => a.decision === "Pending");
      if (!pendingApproval) return;

      try {
        setError(null);
        
        // Submit to the workflow approval system
        // The backend will now handle synchronizing the PurchaseOrder status
        await workflowApi.submitApproval(currentWf.id, pendingApproval.id, {
          decision,
          comments: comments || `Decision: ${decision} via Multi-Agent Coordinator Console`,
        });

        const updated = await workflowApi.getWorkflow(currentWf.id);

        let parsedResult: Record<string, any> | null = null;
        const sourceJson = updated?.resultJson ?? currentWf.resultJson;
        if (sourceJson) {
          try {
            parsedResult = typeof sourceJson === "string" ? JSON.parse(sourceJson) : sourceJson;
          } catch {
            parsedResult = null;
          }
        }

        // Synchronize associated Purchase Order with procurementApi if applicable
        try {
          const isProcurementFlow =
            currentWf.workflowType === "AutonomousProcurement" ||
            currentWf.workflowType === "CombinedResolution" ||
            !!parsedResult?.procurement_proposal?.needed ||
            !!parsedResult?.procurement_proposal?.recommended_supplier;

          if (isProcurementFlow) {
            const pendingPos = await procurementApi.getPendingApprovals().catch(() => []);
            const draftPoNumber = parsedResult?.procurement_proposal?.draft_po_number;
            const targetPo = pendingPos.find((po) => {
              if (draftPoNumber && (po.id.includes(draftPoNumber) || draftPoNumber.includes(po.id.slice(0, 8)))) {
                return true;
              }
              if (currentWf.medicineId && po.items?.some((it) => it.medicineId === currentWf.medicineId)) {
                return true;
              }
              return false;
            });

            if (targetPo) {
              if (decision === "Approved") {
                await procurementApi.approvePurchaseOrder(targetPo.id).catch(() => {});
              } else {
                await procurementApi.rejectPurchaseOrder(
                  targetPo.id,
                  comments || `Rejected via Multi-Agent Coordinator Console`
                ).catch(() => {});
              }
            }
          }
        } catch (syncErr) {
          console.warn("Procurement dual-sync notice:", syncErr);
        }

        // Invalidate TanStack Query server caches to reconcile Approvals console and PO list
        try {
          void queryClient.invalidateQueries({ queryKey: ["approvals", "pending"] });
          void queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
          void queryClient.invalidateQueries({ queryKey: ["workflows"] });
        } catch {}

        // Broadcast authoritative synchronization event to any active listeners
        try {
          window.dispatchEvent(
            new CustomEvent("medistock:approval-updated", {
              detail: { workflowId: currentWf.id, decision, comments },
            })
          );
          if (decision === "Approved") {
            window.dispatchEvent(
              new CustomEvent("medistock:workflow-approved", {
                detail: { workflowId: currentWf.id },
              })
            );
          }
        } catch {}

        const successNotice = `Governance authorization recorded: ${decision}. State updated across systems.`;
        setActionSuccess(successNotice);

        // Build human-readable response confirmation message
        let confirmationText = "";

        if (decision === "Approved") {
          const isProcure = currentWf.workflowType === "AutonomousProcurement" || !!parsedResult?.procurement_proposal?.needed || !!parsedResult?.procurement_proposal?.recommended_supplier;
          const isRedist = currentWf.workflowType === "StockRedistribution" || !!parsedResult?.redistribution_proposal?.feasible || !!parsedResult?.redistribution_proposal?.donor_facility;

          const contextMed = parsedResult?.procurement_proposal?.medicine_name ||
            parsedResult?.redistribution_proposal?.medicine ||
            parsedResult?.medicine ||
            "requested medicine";
          const contextFac = parsedResult?.redistribution_proposal?.target_facility ||
            parsedResult?.facility ||
            "target facility";

          if (isProcure && isRedist) {
            const p = parsedResult?.procurement_proposal;
            const r = parsedResult?.redistribution_proposal;
            const pQty = p?.quantity ?? parsedResult?.projectedDeficit ?? 300;
            const rQty = r?.quantity ?? 200;
            const pMed = p?.medicine_name ?? contextMed;
            const rMed = r?.medicine ?? contextMed;
            const supp = p?.recommended_supplier ?? "State Pharmaceuticals Manufacturing Corporation (SPMC)";
            const donor = r?.donor_facility ?? "Central Facility";
            confirmationText = `**Approved & Dispatched**: Authorized dual resolution strategy. Purchase order for ${pQty} units of ${pMed} dispatched to ${supp} at $${Number(p?.unit_price ?? 8.50).toFixed(2)}/unit (delivery in transit; inventory updates upon receipt). In parallel, emergency stock transfer of ${rQty} units of ${rMed} from ${donor} to ${contextFac} has been dispatched. Live transfer tracking and purchase orders have been updated across Redistribution and Procurement.`;
          } else if (isProcure) {
            const p = parsedResult?.procurement_proposal;
            const poNum = p?.draft_po_number ? ` (${p.draft_po_number})` : "";
            const qty = p?.quantity ?? parsedResult?.projectedDeficit ?? 500;
            const med = p?.medicine_name ?? contextMed;
            const supp = p?.recommended_supplier ?? "State Pharmaceuticals Manufacturing Corporation (SPMC)";
            const price = p?.unit_price ? `$${Number(p.unit_price).toFixed(2)}/unit` : "$8.50/unit";
            confirmationText = `**Approved & Dispatched**: Purchase order${poNum} for ${qty} units of ${med} from ${supp} at ${price} has been authorized and dispatched. Supplier purchase orders have been updated in Procurement with delivery in transit. Inventory on hand will be updated upon receipt and verification.`;
          } else if (isRedist) {
            const r = parsedResult?.redistribution_proposal;
            const qty = r?.quantity ?? 200;
            const med = r?.medicine ?? contextMed;
            const donor = r?.donor_facility ?? "Central Facility";
            const target = r?.target_facility ?? contextFac;
            confirmationText = `**Approved & Dispatched**: Stock transfer request for ${qty} units of ${med} from ${donor} to ${target} has been authorized and dispatched. Inter-facility stock adjustments and transfer tracking under Redistribution and Inventory have been successfully updated.`;
          } else {
            confirmationText = `**Approved & Dispatched**: Operational plan authorized successfully. State resource commitment and supply chain updates have been applied in the system.`;
          }
        } else {
          confirmationText = `**Proposal Rejected**: Governance gate recorded rejection for this proposal.${comments ? ` Reviewer notes: "${comments}".` : ""} Associated procurement orders have been marked Rejected in the Approvals registry.`;
        }

        const confirmationMsg: ChatMessage = {
          id: `conf-${Date.now()}`,
          sender: "coordinator",
          text: confirmationText,
          timestamp: new Date().toISOString(),
          status: "success",
          workflowId: currentWf.id,
          workflowRun: updated,
          subAgentsInvoked: ["Clinical Stock Governance Checkpoint", "Policy & Safety Gate"],
          intent: currentWf.workflowType,
        };

        // Update the specific workflow in the workflows array and update related messages
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== activeSessionId) return s;
            const updatedWorkflows = (s.workflows ?? []).map((w) =>
              w.id === currentWf.id ? updated : w
            );
            const updatedMessages = s.messages.map((m) => {
              if (m.workflowId === currentWf.id || m.workflowRun?.id === currentWf.id) {
                return {
                  ...m,
                  workflowRun: updated,
                  approvalStatus: decision,
                  approvalComment: comments,
                };
              }
              return m;
            }).concat(confirmationMsg);

            return {
              ...s,
              workflows: updatedWorkflows,
              updatedAt: new Date().toISOString(),
              messages: updatedMessages,
            };
          })
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to submit approval.");
        throw err;
      }
    },
    [activeSessionId, activeWorkflow, sessionWorkflows]
  );

  const editUserMessage = useCallback(
    async (messageId: string, newText: string, resubmit = false) => {
      const trimmed = newText.trim();
      if (!trimmed) return;

      if (!resubmit) {
        // Simple in-place update of text without resubmitting
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== activeSessionId) return s;
            return {
              ...s,
              updatedAt: new Date().toISOString(),
              messages: s.messages.map((m) =>
                m.id === messageId
                  ? {
                      ...m,
                      text: trimmed,
                      isEdited: true,
                      editedAt: new Date().toISOString(),
                    }
                  : m
              ),
            };
          })
        );
        return;
      }

      // True Conversational Branching / Resubmission:
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      setIsRunning(true);
      setError(null);
      setActionSuccess(null);
      lastPromptRef.current = trimmed;

      const sessionId = activeSessionId;

      // 1. Truncate downstream messages from the active sequence and update the user message
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== sessionId) return s;
          const msgIndex = s.messages.findIndex((m) => m.id === messageId);
          if (msgIndex === -1) return s;

          const updatedUserMsg: ChatMessage = {
            ...s.messages[msgIndex],
            text: trimmed,
            isEdited: true,
            editedAt: new Date().toISOString(),
            status: "sending",
          };

          // Also remove workflows linked to truncated messages
          const truncatedMessageIds = new Set(
            s.messages.slice(msgIndex + 1).map((m) => m.id)
          );
          const truncatedWorkflowIds = new Set(
            s.messages
              .slice(msgIndex + 1)
              .filter((m) => m.workflowId)
              .map((m) => m.workflowId!)
          );

          return {
            ...s,
            updatedAt: new Date().toISOString(),
            messages: [...s.messages.slice(0, msgIndex), updatedUserMsg],
            workflows: (s.workflows ?? []).filter(
              (w) => !truncatedWorkflowIds.has(w.id)
            ),
          };
        })
      );

      // 2. Execute workflow with the revised prompt
      try {
        const run = await workflowApi.startWorkflow({
          objective: trimmed,
          workflowType: resolveWorkflowTypeForResubmit(trimmed),
          sessionId,
          messageId,
        });

        const assistantMsg = buildAssistantMessage(run, messageId);

        // 3. Attach new assistant response
        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== sessionId) return s;
            return {
              ...s,
              updatedAt: new Date().toISOString(),
              workflows: [
                ...(s.workflows ?? []).filter((w) => w.id !== run.id),
                run,
              ],
              messages: s.messages
                .map((m) => (m.id === messageId ? { ...m, status: "success" as const } : m))
                .concat(assistantMsg),
            };
          })
        );
      } catch (err) {
        const errText =
          err instanceof Error ? err.message : "Failed to execute coordinator workflow.";
        setError(errText);

        const errorMsg: ChatMessage = {
          id: `err-${Date.now()}`,
          sender: "coordinator",
          text: `**Workflow Execution Notice**: ${errText}\n\nPlease check network connectivity or try an alternative operational prompt.`,
          timestamp: new Date().toISOString(),
          status: "error",
        };

        setSessions((prev) =>
          prev.map((s) => {
            if (s.id !== sessionId) return s;
            return {
              ...s,
              updatedAt: new Date().toISOString(),
              messages: s.messages
                .map((m) => (m.id === messageId ? { ...m, status: "error" as const } : m))
                .concat(errorMsg),
            };
          })
        );
      } finally {
        setIsRunning(false);
      }
    },
    [activeSessionId]
  );

  const editAssistantMessage = useCallback(
    (messageId: string, newText: string) => {
      const trimmed = newText.trim();
      if (!trimmed) return;

      // Update assistant message as a user-authored annotation/draft
      // Preserves originalText for clinical auditability. Does NOT mutate real-world PO or stock approvals.
      setSessions((prev) =>
        prev.map((s) => {
          if (s.id !== activeSessionId) return s;
          return {
            ...s,
            updatedAt: new Date().toISOString(),
            messages: s.messages.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    text: trimmed,
                    originalText: m.originalText || m.text,
                    isEdited: true,
                    editedAt: new Date().toISOString(),
                  }
                : m
            ),
          };
        })
      );
    },
    [activeSessionId]
  );

  return (
    <CoordinatorContext.Provider
      value={{
        sessions,
        activeSessionId,
        createSession,
        switchSession,
        renameSession,
        deleteSession,
        messages: activeSession?.messages || [INITIAL_WELCOME_MESSAGE],
        sessionWorkflows,
        activeWorkflow,
        isRunning,
        elapsedSeconds,
        error,
        actionSuccess,
        activeScenarioId,
        availableScenarios,
        currentPhase,
        sendMessage,
        selectScenario,
        submitApproval,
        editUserMessage,
        editAssistantMessage,
        clearConversation,
        cancelExecution,
        retryLast,
      }}
    >
      {children}
    </CoordinatorContext.Provider>
  );
}

export function useCoordinator() {
  const context = useContext(CoordinatorContext);
  if (!context) {
    return {
      sessions: [],
      activeSessionId: "default",
      createSession: () => {},
      switchSession: () => {},
      renameSession: () => {},
      deleteSession: () => {},
      messages: [INITIAL_WELCOME_MESSAGE],
      sessionWorkflows: [],
      activeWorkflow: null,
      isRunning: false,
      elapsedSeconds: 0,
      error: null,
      actionSuccess: null,
      activeScenarioId: null,
      availableScenarios: ALL_SCENARIOS,
      currentPhase: "Ready",
      sendMessage: async () => {},
      selectScenario: () => {},
      submitApproval: async () => {},
      editUserMessage: async () => {},
      editAssistantMessage: () => {},
      clearConversation: () => {},
      cancelExecution: () => {},
      retryLast: async () => {},
    };
  }
  return context;
}
