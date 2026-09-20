import React from "react";
import { Button } from "../core/Button.jsx";

/** Näkymän laajuinen huomautus: yhteyskatkos, vain luku, resume. */
export function Banner({ tone = "info", children, actionLabel, onAction, busy }) {
  const tones = {
    info: { background: "var(--ah-surface-2)", border: "1px dashed var(--ah-line)", color: "var(--ah-ink-2)" },
    error: { background: "var(--ah-err-soft)", border: "1px solid var(--ah-err-line)", color: "var(--ah-err)" },
  };
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "10px", borderRadius: "var(--ah-r-md)", padding: "9px 11px", fontFamily: "var(--ah-font)", fontSize: "13px", lineHeight: 1.55, ...tones[tone] }}>
      {tone === "error" ? <span style={{ width: 8, height: 8, borderRadius: "var(--ah-r-pill)", background: "var(--ah-err)", flexShrink: 0 }} /> : null}
      <span>{children}</span>
      {actionLabel ? <Button size="sm" variant="secondary" disabled={busy} onClick={onAction} style={{ marginLeft: "auto", flexShrink: 0 }}>{actionLabel}</Button> : null}
    </div>
  );
}
