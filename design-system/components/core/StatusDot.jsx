import React from "react";

const TONES = {
  running: "var(--ah-accent)",
  ok: "var(--ah-ok)",
  error: "var(--ah-err)",
  stopped: "var(--ah-muted)",
  idle: "var(--ah-muted)",
  offline: "var(--ah-err)",
};

const MARKS = { running: "", ok: "✓", error: "✕", stopped: "⃠", idle: "", offline: "" };

export function StatusDot({ tone = "idle", label, size = 7, showMark = true }) {
  const mark = showMark ? MARKS[tone] : "";
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "var(--ah-size-meta)", color: TONES[tone] }}>
      {mark ? (
        <span aria-hidden="true">{mark}</span>
      ) : (
        <span
          aria-hidden="true"
          style={{ width: size, height: size, borderRadius: "var(--ah-r-pill)", background: TONES[tone], animation: tone === "running" ? "ah-pulse var(--ah-pulse)" : "none", flexShrink: 0 }}
        />
      )}
      {label}
    </span>
  );
}
