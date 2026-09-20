import React from "react";

/** Viesti puhujatunnisteella. Kopiointi on tunnisteen perässä oleva painike. */
export function Message({ role = "user", time, children, onCopy }) {
  const isUser = role === "user";
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "5px", alignItems: "flex-start", fontFamily: "var(--ah-font)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <span style={{ fontSize: "var(--ah-size-label)", fontWeight: 500, letterSpacing: ".07em", textTransform: "uppercase", color: isUser ? "var(--ah-muted)" : "var(--ah-accent-ink)" }}>
          {(isUser ? "Jari" : "Pi") + (time ? " · " + time : "")}
        </span>
        {onCopy ? (
          <button type="button" title={isUser ? "Kopioi viesti" : "Kopioi vastaus"} onClick={onCopy} style={{ border: 0, background: "transparent", color: "var(--ah-faint)", padding: "1px 4px", borderRadius: "var(--ah-r-sm)", fontSize: "13px", lineHeight: 1, cursor: "pointer" }}>⧉</button>
        ) : null}
      </div>
      {isUser ? (
        <div style={{ background: "var(--ah-surface)", border: "1px solid var(--ah-line)", borderRadius: "var(--ah-r-lg)", padding: "10px var(--ah-s5)", fontSize: "var(--ah-size-body)", lineHeight: "var(--ah-lh-ui)", maxWidth: "78%", whiteSpace: "pre-wrap" }}>{children}</div>
      ) : (
        <div style={{ fontSize: "var(--ah-size-body)", lineHeight: "var(--ah-lh-body)", color: "var(--ah-ink-2)", maxWidth: "var(--ah-measure)", textWrap: "pretty" }}>{children}</div>
      )}
    </div>
  );
}
