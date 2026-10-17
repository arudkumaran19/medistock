import React from "react";

interface MarkdownMessageProps {
  content: string;
  className?: string;
}

export function MarkdownMessage({ content, className = "" }: MarkdownMessageProps) {
  // Split content into paragraphs/blocks
  const lines = content.split("\n");

  const renderedBlocks: React.ReactNode[] = [];
  let currentList: { type: "ul" | "ol"; items: string[] } | null = null;
  let currentTable: string[] | null = null;

  function flushList() {
    if (!currentList) return;
    if (currentList.type === "ul") {
      renderedBlocks.push(
        <ul
          key={`ul-${renderedBlocks.length}`}
          style={{
            margin: "8px 0 8px 20px",
            padding: 0,
            listStyleType: "disc",
            color: "#334155",
            fontSize: "0.8125rem",
            lineHeight: 1.6,
          }}
        >
          {currentList.items.map((it, idx) => (
            <li key={idx} style={{ marginBottom: 3 }}>
              {formatInline(it)}
            </li>
          ))}
        </ul>
      );
    } else {
      renderedBlocks.push(
        <ol
          key={`ol-${renderedBlocks.length}`}
          style={{
            margin: "8px 0 8px 20px",
            padding: 0,
            listStyleType: "decimal",
            color: "#334155",
            fontSize: "0.8125rem",
            lineHeight: 1.6,
          }}
        >
          {currentList.items.map((it, idx) => (
            <li key={idx} style={{ marginBottom: 3 }}>
              {formatInline(it)}
            </li>
          ))}
        </ol>
      );
    }
    currentList = null;
  }

  function flushTable() {
    if (!currentTable || currentTable.length === 0) return;
    const headerRow = currentTable[0];
    const dataRows = currentTable.slice(2); // Skip separator row

    const headers = headerRow
      .split("|")
      .map((c) => c.trim())
      .filter(Boolean);

    renderedBlocks.push(
      <div
        key={`table-${renderedBlocks.length}`}
        style={{
          margin: "12px 0",
          overflowX: "auto",
          borderRadius: 12,
          border: "1px solid #e2e8f0",
          boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
          background: "#ffffff",
        }}
      >
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            fontSize: "0.8125rem",
            textAlign: "left",
          }}
        >
          <thead>
            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
              {headers.map((h, idx) => (
                <th
                  key={idx}
                  style={{
                    padding: "10px 14px",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    color: "#475569",
                    letterSpacing: "0.02em",
                    whiteSpace: "nowrap",
                  }}
                >
                  {formatInline(h)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, rIdx) => {
              const cells = row
                .split("|")
                .map((c) => c.trim())
                .filter(Boolean);
              return (
                <tr
                  key={rIdx}
                  style={{
                    borderBottom: rIdx === dataRows.length - 1 ? "none" : "1px solid #f1f5f9",
                    background: rIdx % 2 === 1 ? "#fafcfd" : "#ffffff",
                    transition: "background 120ms ease",
                  }}
                >
                  {cells.map((cell, cIdx) => (
                    <td
                      key={cIdx}
                      style={{
                        padding: "9px 14px",
                        color: "#1e293b",
                        fontSize: "0.8125rem",
                        verticalAlign: "middle",
                      }}
                    >
                      {formatInline(cell)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
    currentTable = null;
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Table row detection
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushList();
      if (!currentTable) currentTable = [];
      currentTable.push(trimmed);
      continue;
    } else {
      flushTable();
    }

    // Bullet list detection
    if (trimmed.startsWith("- ") || trimmed.startsWith("* ")) {
      const itemText = trimmed.substring(2);
      if (!currentList || currentList.type !== "ul") {
        flushList();
        currentList = { type: "ul", items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
      continue;
    }

    // Numbered list detection
    const matchNumbered = trimmed.match(/^(\d+)\.\s+(.*)$/);
    if (matchNumbered) {
      const itemText = matchNumbered[2];
      if (!currentList || currentList.type !== "ol") {
        flushList();
        currentList = { type: "ol", items: [itemText] };
      } else {
        currentList.items.push(itemText);
      }
      continue;
    }

    // Anything else terminates any active list
    flushList();

    if (!trimmed) {
      // Empty line / paragraph break
      renderedBlocks.push(<div key={`sp-${i}`} style={{ height: 6 }} />);
      continue;
    }

    // Headings
    if (trimmed.startsWith("### ")) {
      renderedBlocks.push(
        <h4
          key={`h3-${i}`}
          style={{
            margin: "12px 0 4px",
            fontSize: "0.875rem",
            fontWeight: 700,
            color: "#0f172a",
            letterSpacing: "-0.01em",
          }}
        >
          {formatInline(trimmed.substring(4))}
        </h4>
      );
      continue;
    }
    if (trimmed.startsWith("## ")) {
      renderedBlocks.push(
        <h3
          key={`h2-${i}`}
          style={{
            margin: "14px 0 6px",
            fontSize: "1rem",
            fontWeight: 700,
            color: "#0f172a",
            letterSpacing: "-0.01em",
          }}
        >
          {formatInline(trimmed.substring(3))}
        </h3>
      );
      continue;
    }
    if (trimmed.startsWith("# ")) {
      renderedBlocks.push(
        <h2
          key={`h1-${i}`}
          style={{
            margin: "16px 0 8px",
            fontSize: "1.125rem",
            fontWeight: 700,
            color: "#0f172a",
            letterSpacing: "-0.02em",
          }}
        >
          {formatInline(trimmed.substring(2))}
        </h2>
      );
      continue;
    }

    // Blockquote
    if (trimmed.startsWith("> ")) {
      renderedBlocks.push(
        <blockquote
          key={`bq-${i}`}
          style={{
            margin: "8px 0",
            borderLeft: "3px solid #0d9488",
            background: "#f0fdfa",
            padding: "8px 12px",
            fontSize: "0.8125rem",
            color: "#134e4a",
            fontStyle: "italic",
            borderRadius: "0 6px 6px 0",
          }}
        >
          {formatInline(trimmed.substring(2))}
        </blockquote>
      );
      continue;
    }

    // Standard paragraph
    renderedBlocks.push(
      <p
        key={`p-${i}`}
        style={{
          margin: "4px 0",
          lineHeight: 1.6,
          color: "#1e293b",
          fontSize: "0.8125rem",
        }}
      >
        {formatInline(trimmed)}
      </p>
    );
  }

  flushList();
  flushTable();

  return (
    <div
      className={className}
      style={{
        fontSize: "0.8125rem",
        lineHeight: 1.6,
        color: "#1e293b",
      }}
    >
      {renderedBlocks}
    </div>
  );
}

// Inline token parser for **bold**, *italic*, and `code`
function formatInline(text: string): React.ReactNode {
  // Split on bold, italic, and code tokens
  const parts = text.split(/(\*\*.*?\*\*|\*.*?\*|`.*?`)/g);

  return parts.map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={index} style={{ fontWeight: 600, color: "#0f172a" }}>
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return (
        <em key={index} style={{ fontStyle: "italic", color: "#334155" }}>
          {part.slice(1, -1)}
        </em>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={index}
          style={{
            background: "#f1f5f9",
            padding: "2px 6px",
            borderRadius: 4,
            fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            fontSize: "0.75rem",
            fontWeight: 500,
            color: "#0f766e",
            border: "1px solid #e2e8f0",
          }}
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}
