import React from "react";
import { Button } from "../core/Button.jsx";

/** Harnessin välittämä kysymys. Näkyy aina omana korttinaan, ei ryhmän sisällä. */
export function ApprovalCard({ question, options = [], step, answer, supported = true, unsupportedReason, onAnswer, onFreeText, busy }) {
  const answered = Boolean(answer);
  return (
    <div style={{ background: "var(--ah-surface)", border: "2px solid " + (answered || !supported ? "var(--ah-line)" : "var(--ah-accent)"), borderRadius: "var(--ah-r-lg)", padding: "13px 15px", display: "flex", flexDirection: "column", gap: "10px", animation: "ah-appear var(--ah-appear) both" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontFamily: "var(--ah-font)", fontSize: "var(--ah-size-label)", fontWeight: 500, letterSpacing: ".07em", textTransform: "uppercase", color: "var(--ah-accent-ink)" }}>Pi kysyy</span>
        {step ? <span style={{ marginLeft: "auto", fontFamily: "var(--ah-mono)", fontSize: "11.5px", color: "var(--ah-faint)" }}>{step}</span> : null}
      </div>
      <div style={{ fontFamily: "var(--ah-font)", fontSize: "var(--ah-size-body)", lineHeight: "var(--ah-lh-ui)", color: "var(--ah-ink)" }}>{question}</div>

      {!supported ? (
        <div style={{ fontFamily: "var(--ah-font)", fontSize: "13px", lineHeight: 1.55, color: "var(--ah-muted)" }}>{unsupportedReason || "Tämä extension ei tarjoa selaimelle vastausrajapintaa. Kysymykseen vastataan istunnossa, jossa agentti käynnistettiin."}</div>
      ) : answered ? (
        <div style={{ fontFamily: "var(--ah-font)", fontSize: "13px", color: "var(--ah-ok)" }}>✓ Vastattu: {answer}</div>
      ) : (
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          {options.map((o, i) => (
            <Button key={o} variant={i === 0 ? "primary" : "secondary"} disabled={busy} onClick={() => onAnswer && onAnswer(o)}>{o}</Button>
          ))}
          {onFreeText ? <Button variant="ghost" onClick={onFreeText}>Vastaa tekstillä</Button> : null}
          <span style={{ fontFamily: "var(--ah-font)", fontSize: "12px", color: "var(--ah-faint)" }}>Työ on pysähtynyt tähän kysymykseen.</span>
        </div>
      )}
    </div>
  );
}
