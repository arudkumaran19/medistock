import React, { useState } from "react";
import { Copy, Check, RotateCcw, Pencil, Clock } from "lucide-react";

interface MessageToolbarProps {
  textToCopy: string;
  timestamp: string;
  isUser: boolean;
  status?: string;
  isEdited?: boolean;
  onRetry?: () => void;
  onEdit?: () => void;
  className?: string;
}

export function MessageToolbar({
  textToCopy,
  timestamp,
  isUser,
  status,
  isEdited,
  onRetry,
  onEdit,
  className = "",
}: MessageToolbarProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is restricted
      const textarea = document.createElement("textarea");
      textarea.value = textToCopy;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formattedTime = new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <div
      className={className}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: isUser ? "flex-end" : "space-between",
        gap: 8,
        paddingTop: 6,
        fontSize: "0.6875rem",
        color: "#94a3b8",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Clock size={11} color="#94a3b8" />
        <span>{formattedTime}</span>
        {isEdited && (
          <span style={{ fontStyle: "italic", color: "#94a3b8" }}>
            {isUser ? "(edited)" : "(edited annotation)"}
          </span>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
            padding: "2px 8px",
            fontSize: "0.6875rem",
            color: copied ? "#059669" : "#64748b",
            background: copied ? "#ecfdf5" : "transparent",
            border: "1px solid",
            borderColor: copied ? "#a7f3d0" : "transparent",
            borderRadius: 6,
            cursor: "pointer",
            transition: "all 120ms ease",
          }}
          onMouseEnter={(e) => {
            if (!copied) {
              e.currentTarget.style.background = "#f1f5f9";
              e.currentTarget.style.color = "#1e293b";
            }
          }}
          onMouseLeave={(e) => {
            if (!copied) {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#64748b";
            }
          }}
          title={copied ? "Copied to clipboard" : "Copy response"}
        >
          {copied ? (
            <>
              <Check size={11} color="#059669" />
              <span style={{ fontWeight: 600 }}>Copied</span>
            </>
          ) : (
            <>
              <Copy size={11} />
              <span>Copy</span>
            </>
          )}
        </button>

        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              fontSize: "0.6875rem",
              color: "#64748b",
              background: "transparent",
              border: "1px solid transparent",
              borderRadius: 6,
              cursor: "pointer",
              transition: "all 120ms ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = "#f1f5f9";
              e.currentTarget.style.color = "#1e293b";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
              e.currentTarget.style.color = "#64748b";
            }}
            title={isUser ? "Edit prompt" : "Annotate message"}
          >
            <Pencil size={11} />
            <span>{isUser ? "Edit" : "Annotate"}</span>
          </button>
        )}

        {status === "error" && onRetry && (
          <button
            type="button"
            onClick={onRetry}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              padding: "2px 8px",
              fontSize: "0.6875rem",
              fontWeight: 600,
              color: "#e11d48",
              background: "#fff1f2",
              border: "1px solid #fecdd3",
              borderRadius: 6,
              cursor: "pointer",
            }}
            title="Retry failed query"
          >
            <RotateCcw size={11} />
            <span>Retry</span>
          </button>
        )}
      </div>
    </div>
  );
}
