import React from "react";
import { StatusDot } from "../core/StatusDot.jsx";

/** Saman vuoron vierekkäiset työkalutapahtumat yhtenä avattavana yhteenvetona. */
export function ToolGroup({ title, counts = {}, meta, open, onToggle, children }) {
  const hasError = (counts.error || 0) > 0;
  return (
    <div style={{ background: "var(--ah-surface)", border: "1px solid " + (hasError ? "var(--ah-err-line)" : "var(--ah-line)"), borderRadius: "var(--ah-r-lg)", overflow: "hidden" }}>
      <div onClick={onToggle} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "var(--ah-s3) var(--ah-s4)", fontFamily: "var(--ah-font)", fontSize: "var(--ah-size-ui)", cursor: "pointer", color: "var(--ah-ink)" }}>
        <span style={{ fontFamily: "var(--ah-mono)", fontSize: "11px", color: "var(--ah-muted)", width: "10px" }}>{open ? "▾" : "▸"}</span>
        <span style={{ fontWeight: 500, flex: 1 }}>{title}</span>
        {counts.running ? <StatusDot tone="running" label={String(counts.running)} /> : null}
        {counts.done ? <StatusDot tone="ok" label={counts.done} /> : null}
        {counts.error ? <StatusDot tone="error" label={String(counts.error)} /> : null}
        {counts.stopped ? <StatusDot tone="stopped" label={String(counts.stopped)} /> : null}
        {meta ? <span style={{ fontSize: "var(--ah-size-meta)", color: "var(--ah-faint)" }}>{meta}</span> : null}
      </div>
      {open ? <div style={{ borderTop: "1px solid var(--ah-line-soft)", fontFamily: "var(--ah-mono)", fontSize: "var(--ah-size-code)", color: "var(--ah-ink-2)" }}>{children}</div> : null}
    </div>
  );
}
