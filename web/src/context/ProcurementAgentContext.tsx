import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import {
  procurementAgentApi,
  type ProcurementAgentResponse,
  type ProcurementActionType,
} from "../services/procurementAgentApi";

export type AgentStage = "analyzing" | "tools" | "reasoning" | "finalizing";

export interface AgentPhase {
  stage: AgentStage;
  label: string;
}

interface ProcurementAgentContextType {
  result: ProcurementAgentResponse | null;
  isLoading: boolean;
  isAgentLoading?: boolean;
  error: string;
  prompt: string;
  lastPrompt: string;
  elapsedSecs: number;
  agentElapsedSecs?: number;
  setPrompt: (value: string) => void;
  runAction: (
    actionType: ProcurementActionType,
    payload?: Record<string, unknown>,
    approved?: boolean,
    onOrderCreated?: () => void
  ) => Promise<void>;
  clearResult: () => void;
  getPhase: () => AgentPhase;
  getAgentPhase?: () => AgentPhase;
}

const STORAGE_RESULT_KEY = "medistock_agent_last_result";
const STORAGE_PROMPT_KEY = "medistock_agent_last_prompt";

const ProcurementAgentContext = createContext<ProcurementAgentContextType | undefined>(
  undefined
);

export function ProcurementAgentProvider({ children }: { children: ReactNode }) {
  const [result, setResult] = useState<ProcurementAgentResponse | null>(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_RESULT_KEY);
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [prompt, setPrompt] = useState("");
  const [lastPrompt, setLastPrompt] = useState<string>(() => {
    try {
      return sessionStorage.getItem(STORAGE_PROMPT_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [elapsedSecs, setElapsedSecs] = useState(0);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Keep timer running as long as isLoading is true
  useEffect(() => {
    if (!isLoading) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const timer = setInterval(() => {
      setElapsedSecs((s) => s + 1);
    }, 1000);
    timerRef.current = timer;

    return () => {
      clearInterval(timer);
      timerRef.current = null;
    };
  }, [isLoading]);

  // Persist result to sessionStorage whenever it updates
  useEffect(() => {
    try {
      if (result) {
        sessionStorage.setItem(STORAGE_RESULT_KEY, JSON.stringify(result));
      } else {
        sessionStorage.removeItem(STORAGE_RESULT_KEY);
      }
    } catch {
      // Ignore quota errors
    }
  }, [result]);

  useEffect(() => {
    try {
      if (lastPrompt) {
        sessionStorage.setItem(STORAGE_PROMPT_KEY, lastPrompt);
      }
    } catch {
      // Ignore quota errors
    }
  }, [lastPrompt]);

  function getPhase(): AgentPhase {
    if (elapsedSecs < 5) {
      return {
        stage: "analyzing",
        label: "Analyzing your request & intent...",
      };
    }
    if (elapsedSecs < 15) {
      return {
        stage: "tools",
        label: "Querying MediStock inventory, active suppliers & authorization rules...",
      };
    }
    if (elapsedSecs < 30) {
      return {
        stage: "reasoning",
        label: "Running LLM policy reasoning over backend tool results...",
      };
    }
    return {
      stage: "finalizing",
      label: `Finalizing structured recommendation (${elapsedSecs}s)...`,
    };
  }

  function clearResult() {
    setResult(null);
    setError("");
    try {
      sessionStorage.removeItem(STORAGE_RESULT_KEY);
    } catch {
      // Ignore
    }
  }

  async function runAction(
    actionType: ProcurementActionType,
    payload: Record<string, unknown> = {},
    approved = false,
    onOrderCreated?: () => void
  ) {
    if (isLoading) return; // Prevent duplicate concurrent requests
    setElapsedSecs(0);
    setIsLoading(true);
    setError("");

    if (payload.question && typeof payload.question === "string") {
      setLastPrompt(payload.question);
    }

    try {
      const response = await procurementAgentApi.run({
        action_type: actionType,
        payload,
        approved,
      });
      setResult(response);
      if (approved && onOrderCreated) {
        onOrderCreated();
      }
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Agent request failed. Make sure agent-service is running on port 8000."
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <ProcurementAgentContext.Provider
      value={{
        result,
        isLoading,
        isAgentLoading: isLoading,
        error,
        prompt,
        lastPrompt,
        elapsedSecs,
        agentElapsedSecs: elapsedSecs,
        setPrompt,
        runAction,
        clearResult,
        getPhase,
        getAgentPhase: getPhase,
      }}
    >
      {children}
    </ProcurementAgentContext.Provider>
  );
}

const defaultContextValue: ProcurementAgentContextType = {
  result: null,
  isLoading: false,
  isAgentLoading: false,
  error: "",
  prompt: "",
  lastPrompt: "",
  elapsedSecs: 0,
  agentElapsedSecs: 0,
  setPrompt: () => {},
  runAction: async () => {},
  clearResult: () => {},
  getPhase: () => ({ stage: "analyzing", label: "Ready" }),
  getAgentPhase: () => ({ stage: "analyzing", label: "Ready" }),
};

export function useProcurementAgent() {
  const context = useContext(ProcurementAgentContext);
  return context ?? defaultContextValue;
}
