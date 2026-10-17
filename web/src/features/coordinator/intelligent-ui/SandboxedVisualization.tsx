import React, { useRef, useState } from "react";
import { Shield, Maximize2, Minimize2, AlertCircle } from "lucide-react";

interface SandboxedVisualizationProps {
  title: string;
  htmlContent: string;
  initialHeight?: number;
  className?: string;
}

export function SandboxedVisualization({
  title,
  htmlContent,
  initialHeight = 220,
  className = "",
}: SandboxedVisualizationProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Secure HTML wrapper with responsive sandbox styling
  const wrappedHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 12px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      font-size: 12px;
      color: #1e293b;
      background: #ffffff;
      box-sizing: border-box;
    }
    * { box-sizing: border-box; }
  </style>
</head>
<body>
  ${htmlContent}
</body>
</html>
`;

  return (
    <div
      className={`my-3 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs ${className}`}
    >
      {/* Sandbox Header */}
      <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/80 px-3 py-2 text-xs">
        <div className="flex items-center gap-1.5">
          <Shield size={12} className="text-teal-700" />
          <span className="font-bold text-slate-800">{title}</span>
          <span className="rounded bg-slate-200/70 px-1.5 py-0.2 text-[9px] font-semibold text-slate-600">
            Isolated Sandbox
          </span>
        </div>

        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="inline-flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-800 transition-colors"
          title={expanded ? "Collapse sandbox" : "Expand sandbox"}
        >
          {expanded ? <Minimize2 size={11} /> : <Maximize2 size={11} />}
          <span>{expanded ? "Collapse" : "Expand"}</span>
        </button>
      </div>

      {hasError ? (
        <div className="flex items-center gap-2 p-4 text-xs text-rose-600 bg-rose-50/50">
          <AlertCircle size={14} />
          <span>Interactive widget failed to load safely.</span>
        </div>
      ) : (
        <div
          className="relative w-full transition-all duration-300"
          style={{ height: expanded ? 420 : initialHeight }}
        >
          <iframe
            ref={iframeRef}
            srcDoc={wrappedHtml}
            // Strict security boundary: allow scripts but DO NOT allow same-origin
            // This prevents iframe from reading host cookies, localStorage, or parent window DOM
            sandbox="allow-scripts"
            title={title}
            onError={() => setHasError(true)}
            className="w-full h-full border-0"
          />
        </div>
      )}
    </div>
  );
}
