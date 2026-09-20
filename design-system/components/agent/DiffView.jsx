import React from "react";

const LINE = {
  meta: { background: "var(--ah-line-soft)", color: "var(--ah-muted)" },
  context: { background: "transparent", color: "var(--ah-ink-2)" },
  add: { background: "var(--ah-ok-soft)", color: "var(--ah-ink)" },
  del: { background: "var(--ah-err-soft)", color: "var(--ah-ink)" },
};

/** Yksinkertainen unified diff. Merkki ja väri, ei pelkkä väri. */
export function DiffView({ path, added, removed, lines = [], note = "Muutos on jo tehty — tämä on tarkastelua varten.", onCopy }) {
  return (
    <div style={{ background: "var(--ah-surface)", border: "1px solid var(--ah-line)", borderRadius: "var(--ah-r-lg)", overflow: "hidden" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px var(--ah-s4)", background: "var(--ah-surface-2)", borderBottom: "1px solid var(--ah-line-soft)" }}>
        <span style={{ fontFamily: "var(--ah-mono)", fontSize: "var(--ah-size-code)", flex: 1, color: "var(--ah-ink-2)" }}>{path}</span>
        <span style={{ fontFamily: "var(--ah-mono)", fontSize: "12px", fontWeight: 500, color: "var(--ah-ok)" }}>+{added}</span>
        <span style={{ fontFamily: "var(--ah-mono)", fontSize: "12px", fontWeight: 500, color: "var(--ah-err)" }}>−{removed}</span>
        {onCopy ? <button type="button" onClick={onCopy} style={{ border: 0, background: "transparent", color: "var(--ah-muted)", fontFamily: "var(--ah-font)", fontSize: "12px", fontWeight: 500, cursor: "pointer" }}>Kopioi koodi</button> : null}
      </div>
      <div style={{ fontFamily: "var(--ah-mono)", fontSize: "var(--ah-size-code)", lineHeight: 1.6 }}>
        {lines.map((l, i) => (
          <div key={i} style={{ padding: "1px var(--ah-s4)", whiteSpace: "pre", ...LINE[l.kind || "context"] }}>{l.text}</div>
        ))}
      </div>
      {note ? <div style={{ padding: "6px var(--ah-s4) 8px", borderTop: "1px solid var(--ah-line-soft)", fontFamily: "var(--ah-font)", fontSize: "12px", color: "var(--ah-faint)" }}>{note}</div> : null}
    </div>
  );
}
