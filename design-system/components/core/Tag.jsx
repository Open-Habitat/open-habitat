import React from "react";

const TONES = {
  neutral: { background: "transparent", color: "var(--ah-muted)", border: "1px solid var(--ah-line)" },
  accent: { background: "var(--ah-accent-soft)", color: "var(--ah-accent-ink)", border: "1px solid var(--ah-accent-line)" },
  error: { background: "var(--ah-err-soft)", color: "var(--ah-err)", border: "1px solid var(--ah-err-line)" },
  mono: { background: "var(--ah-surface-2)", color: "var(--ah-ink-2)", border: "1px solid var(--ah-line-soft)", fontFamily: "var(--ah-mono)" },
};

export function Tag({ tone = "neutral", pill = true, children }) {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: pill ? "3px 10px" : "1px 6px", borderRadius: pill ? "var(--ah-r-pill)" : "var(--ah-r-sm)", fontFamily: "var(--ah-font)", fontSize: "12px", fontWeight: 500, ...TONES[tone] }}>
      {children}
    </span>
  );
}
