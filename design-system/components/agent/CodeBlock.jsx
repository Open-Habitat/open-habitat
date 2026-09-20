import React from "react";

/** Koodi tai komennon output, otsikkopalkilla ja kopioinnilla. */
export function CodeBlock({ label, language, text, maxLines, truncationNote, onCopy, error }) {
  return (
    <div style={{ background: error ? "var(--ah-err-soft)" : "var(--ah-surface)", border: "1px solid " + (error ? "var(--ah-err-line)" : "var(--ah-line)"), borderRadius: "var(--ah-r-lg)", overflow: "hidden" }}>
      {label || language ? (
        <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "6px var(--ah-s4)", background: "var(--ah-surface-2)", borderBottom: "1px solid var(--ah-line-soft)", fontFamily: "var(--ah-mono)", fontSize: "11.5px", color: "var(--ah-muted)" }}>
          <span>{label || language}</span>
          {onCopy ? <button type="button" onClick={onCopy} style={{ marginLeft: "auto", border: 0, background: "transparent", color: "var(--ah-muted)", fontFamily: "var(--ah-font)", fontSize: "11.5px", fontWeight: 500, cursor: "pointer" }}>Kopioi koodi</button> : null}
        </div>
      ) : null}
      <pre style={{ margin: 0, padding: "10px var(--ah-s4)", fontFamily: "var(--ah-mono)", fontSize: "var(--ah-size-code)", lineHeight: 1.55, color: "var(--ah-ink-2)", whiteSpace: "pre-wrap", maxHeight: maxLines ? maxLines * 20 + "px" : undefined, overflow: maxLines ? "hidden" : undefined }}>{text}</pre>
      {truncationNote ? (
        <div style={{ padding: "6px var(--ah-s4) 8px", borderTop: "1px solid var(--ah-line-soft)", fontFamily: "var(--ah-font)", fontSize: "12px", color: "var(--ah-faint)" }}>{truncationNote}</div>
      ) : null}
    </div>
  );
}
