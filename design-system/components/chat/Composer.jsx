import React from "react";
import { Button } from "../core/Button.jsx";

/** Monirivinen syöte. Työn aikana lähetykselle on kaksi kohdetta. */
export function Composer({ value, onChange, onSend, working, disabled, disabledReason, queue = [], onCancelQueued, onClearQueue, onInterrupt }) {
  const hint = disabled
    ? disabledReason
    : working
      ? "Enter lähettää jonoon · ⌘+Enter lähettää heti"
      : "Enter lähettää · Shift+Enter rivinvaihto";

  const key = (e) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    const now = e.metaKey || e.ctrlKey;
    if (!now && e.shiftKey) return;
    e.preventDefault();
    onSend && onSend(working ? (now ? "steer" : "after") : "now");
  };

  return (
    <div style={{ padding: "12px var(--ah-s6) var(--ah-s5)", borderTop: "1px solid var(--ah-line)", background: "var(--ah-surface)", display: "flex", flexDirection: "column", gap: "var(--ah-s3)", fontFamily: "var(--ah-font)" }}>
      {queue.length ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "var(--ah-size-label)", fontWeight: 500, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--ah-muted)" }}>
            <span>Jonossa {queue.length}</span>
            {onClearQueue ? <button type="button" onClick={onClearQueue} style={{ border: 0, background: "transparent", color: "var(--ah-muted)", font: "inherit", cursor: "pointer", textDecoration: "underline" }}>Tyhjennä</button> : null}
          </div>
          {queue.map((q, i) => (
            <div key={q.id || i} style={{ display: "flex", alignItems: "center", gap: "9px", background: "var(--ah-accent-soft)", border: "1px solid var(--ah-accent-line)", borderRadius: "var(--ah-r-md)", padding: "6px 10px", fontSize: "var(--ah-size-meta)", color: "var(--ah-accent-ink)", animation: "ah-appear var(--ah-appear) both" }}>
              <span style={{ fontFamily: "var(--ah-mono)", fontSize: "11px", background: "var(--ah-surface)", border: "1px solid var(--ah-accent-line)", borderRadius: "var(--ah-r-sm)", padding: "1px 5px" }}>{i + 1}</span>
              <span style={{ fontWeight: 500, flexShrink: 0 }}>{q.mode === "steer" ? "seuraavan työkalun jälkeen" : "kun agentti on valmis"}</span>
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", opacity: 0.85 }}>{q.text}</span>
              {onCancelQueued ? <button type="button" onClick={() => onCancelQueued(q)} style={{ marginLeft: "auto", border: 0, background: "transparent", color: "var(--ah-accent-ink)", font: "inherit", fontWeight: 500, cursor: "pointer", textDecoration: "underline" }}>Peru</button> : null}
            </div>
          ))}
        </div>
      ) : null}

      <textarea
        rows={2}
        value={value}
        onChange={(e) => onChange && onChange(e.target.value)}
        onKeyDown={key}
        placeholder="Kirjoita viesti — Enter lähettää, Shift+Enter rivinvaihto"
        style={{ width: "100%", boxSizing: "border-box", resize: "none", border: "1px solid var(--ah-line)", borderRadius: "var(--ah-r-lg)", padding: "10px var(--ah-s4)", fontFamily: "var(--ah-font)", fontSize: "var(--ah-size-body)", lineHeight: 1.5, background: "var(--ah-surface-2)", color: "var(--ah-ink)" }}
      />

      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        {working && onInterrupt ? <Button variant="danger" size="sm" shortcut="Esc Esc" onClick={onInterrupt}>Keskeytä</Button> : null}
        <span style={{ color: "var(--ah-muted)", fontSize: "var(--ah-size-meta)" }}>{hint}</span>
        {working ? (
          <span style={{ marginLeft: "auto", display: "flex", gap: "8px" }}>
            <Button variant="secondary" shortcut="⌘⏎" disabled={disabled || !value.trim()} onClick={() => onSend && onSend("steer")}>Lähetä heti</Button>
            <Button variant="primary" shortcut="⏎" disabled={disabled || !value.trim()} onClick={() => onSend && onSend("after")}>Lähetä jonoon</Button>
          </span>
        ) : (
          <Button variant="primary" style={{ marginLeft: "auto" }} disabled={disabled || !value.trim()} onClick={() => onSend && onSend("now")}>Lähetä</Button>
        )}
      </div>
    </div>
  );
}
