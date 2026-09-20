import React from "react";
import { StatusDot } from "../core/StatusDot.jsx";

/** Yksi työkalutapahtuma yhtenä rivinä. Ei korttia, ellei sisältö sitä vaadi. */
export function ToolRow({ name, detail, meta, tone = "ok", statusLabel, mono = true, open, onToggle, error, children }) {
  const collapsible = typeof onToggle === "function";
  return (
    <div style={{ background: error ? "var(--ah-err-soft)" : "var(--ah-surface)", border: "1px solid " + (error ? "var(--ah-err-line)" : "var(--ah-line)"), borderRadius: "var(--ah-r-lg)", overflow: "hidden" }}>
      <div
        onClick={onToggle}
        style={{ display: "flex", alignItems: "center", gap: "10px", padding: "var(--ah-s3) var(--ah-s4)", fontFamily: "var(--ah-font)", fontSize: "var(--ah-size-ui)", color: "var(--ah-ink)", cursor: collapsible ? "pointer" : "default" }}
      >
        {collapsible ? <span style={{ fontFamily: "var(--ah-mono)", fontSize: "11px", color: "var(--ah-muted)", width: "10px" }}>{open ? "▾" : "▸"}</span> : null}
        <span style={{ fontWeight: 500 }}>{name}</span>
        {detail ? <span style={{ fontFamily: mono ? "var(--ah-mono)" : "var(--ah-font)", fontSize: "var(--ah-size-code)", color: "var(--ah-ink-2)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{detail}</span> : <span style={{ flex: 1 }} />}
        {statusLabel ? <StatusDot tone={tone} label={statusLabel} /> : null}
        {meta ? <span style={{ fontSize: "var(--ah-size-meta)", color: "var(--ah-faint)" }}>{meta}</span> : null}
      </div>
      {open && children ? <div style={{ borderTop: "1px solid var(--ah-line-soft)" }}>{children}</div> : null}
    </div>
  );
}
