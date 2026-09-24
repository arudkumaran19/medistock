import { useState, type FormEvent } from "react";
import {
  inventoryAgentApi,
  type InventoryAgentResponse,
} from "../services/inventoryAgentApi";
import styles from "./InventoryAgentPanel.module.css";

export function InventoryAgentPanel() {
  const [result, setResult] = useState<InventoryAgentResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [question, setQuestion] = useState("");
  const [submittedQuestion, setSubmittedQuestion] = useState("");

  async function analyzeInventory() {
    setIsLoading(true);
    setError("");

    try {
      const response = await inventoryAgentApi.run({
        action_type: "analyze",
        payload: {},
        approved: false,
      });

      setResult(response);
    } catch (e) {
      setError(
        e instanceof Error ? e.message : "Agent request failed."
      );
    } finally {
      setIsLoading(false);
    }
  }

  async function askInventory(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!question.trim()) return;
    setIsLoading(true); setError(""); setSubmittedQuestion(question.trim());
    try {
      setResult(await inventoryAgentApi.run({ action_type: "ask", payload: { question: question.trim() } }));
    } catch (e) { setError(e instanceof Error ? e.message : "Inventory question failed."); }
    finally { setIsLoading(false); }
  }

  async function approveMutation() {
    if (!submittedQuestion) return;
    setIsLoading(true); setError("");
    try {
      setResult(await inventoryAgentApi.run({ action_type: "ask", payload: { question: submittedQuestion }, approved: true }));
    } catch (e) { setError(e instanceof Error ? e.message : "Approved inventory action failed."); }
    finally { setIsLoading(false); }
  }

  return (
    <section className={styles.agentPanel}>
      <div className={styles.agentPanelHeader}>
        <div>
          <p className="eyebrow">AI ASSISTANT</p>
            <h2>Inventory Intelligence Agent</h2>
          <p className={styles.agentDescription}>
            Ask about stock, batches, expiry, and transaction history. Read-only answers use current inventory data.
          </p>
        </div>

        <button
          type="button"
          className={styles.analyzeButton}
          onClick={analyzeInventory}
          disabled={isLoading}
        >
          {isLoading ? "Analyzing..." : "Analyze Inventory"}
        </button>
      </div>

      <form className={styles.askForm} onSubmit={askInventory}>
        <label htmlFor="inventory-question">Ask about inventory</label>
        <div><input id="inventory-question" value={question} onChange={e => setQuestion(e.target.value)} placeholder="e.g. Which medicines are low in Central Facility?" /><button type="submit" disabled={isLoading || !question.trim()}>{isLoading ? "Checking…" : "Ask"}</button></div>
      </form>

      {error && <p className={styles.error}>{error}</p>}

      {result && (
        <>
          {submittedQuestion && <div className={styles.agentContext}><strong>Your request</strong><p>{submittedQuestion}</p></div>}
          {result.answer && <div className={styles.agentAnswer}><strong>Inventory insight</strong><p>{result.answer}</p></div>}
          <div className={styles.agentSummary}>
            <div className={styles.summaryCard}>
              <strong className={styles.summaryValue}>
                {result.insights.length}
              </strong>
              <span className={styles.summaryLabel}>
                insights found
              </span>
            </div>

            <div className={styles.summaryCard}>
              <strong className={styles.summaryValue}>
                {result.approval_required ? "Yes" : "No"}
              </strong>
              <span className={styles.summaryLabel}>
                approval required
              </span>
            </div>

            <div className={styles.summaryCard}>
              <strong className={styles.summaryValue}>
                {result.executed ? "Yes" : "No"}
              </strong>
              <span className={styles.summaryLabel}>
                executed
              </span>
            </div>
          </div>

          {result.insights.length > 0 && (
            <div className={styles.agentSection}>
              <h3>Agent Insights</h3>

              <div className={styles.agentInsights}>
                {result.insights.map((insight, index) => (
                  <article
                    className={styles.agentInsight}
                    key={index}
                  >
                    <span className={styles.agentInsightKind}>
                      {String(insight.kind ?? "inventory")}
                    </span>

                    <strong className={styles.agentInsightMessage}>
                      {String(
                        insight.message ??
                          "Inventory issue detected."
                      )}
                    </strong>

                    <span className={styles.agentInsightSeverity}>
                      Severity:{" "}
                      {String(insight.severity ?? "info")}
                    </span>
                  </article>
                ))}
              </div>
            </div>
          )}

          <div className={styles.agentSection}>
            <h3>Agent Workflow</h3>

            <ol className={styles.agentPlan}>
              {result.plan.map((step, index) => (
                <li key={index}>
                  <span className={styles.agentPlanCheck}>✓</span>
                  {step}
                </li>
              ))}
            </ol>
          </div>

          {result.validation_errors.length > 0 && (
            <div className={styles.agentValidation}>
              <h3>Validation Issues</h3>

              <ul>
                {result.validation_errors.map(
                  (message, index) => (
                    <li key={index}>{message}</li>
                  )
                )}
              </ul>
            </div>
          )}

          {result.approval_required && !result.executed && (
            <div className={styles.agentApproval}>
              <strong>Human approval required</strong>

              <p>
                The agent requires approval before any
                stock-changing action can be executed.
              </p>
              {result.validation_errors.length === 0 && submittedQuestion && (
                <button type="button" onClick={approveMutation} disabled={isLoading}>
                  {isLoading ? "Applying…" : "Approve and execute"}
                </button>
              )}
            </div>
          )}

          {result.executed && (
            <div className={styles.agentSuccess}>
              ✓ Agent action executed successfully.
            </div>
          )}
        </>
      )}
    </section>
  );
}
