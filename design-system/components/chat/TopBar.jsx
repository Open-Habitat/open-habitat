import React from "react";
import { StatusDot } from "../core/StatusDot.jsx";

/** Näkymän konteksti: otsikko, projekti, havaittu tila, yhteys ja malli.
 *  Oletustiloja ei kirjoiteta auki — yhteys on pelkkä piste kunnes se muuttuu. */
export function TopBar({ title, project, working, workingDetail, connected = true, server, model, thinkingLevel = 2, thinkingLevels = 5, expanded, onHoverChange }) {
  const wide = { overflow: "hidden", whiteSpace: "nowrap", transition: "max-width var(--ah-expand), opacity var(--ah-fade)" };
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: "12px", padding: "12px var(--ah-s6)", background: "var(--ah-surface)", borderBottom: "1px solid var(--ah-line)", fontFamily: "var(--ah-font)", color: "var(--ah-ink)" }}>
      <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: "3px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
          <span style={{ fontSize: "var(--ah-size-title)", fontWeight: 600 }}>{title}</span>
          {working ? (
            <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", background: "var(--ah-accent-soft)", color: "var(--ah-accent-ink)", border: "1px solid var(--ah-accent-line)", borderRadius: "var(--ah-r-pill)", padding: "3px 10px", fontSize: "12px", fontWeight: 500, animation: "ah-appear var(--ah-appear) both" }}>
              <span style={{ width: 7, height: 7, borderRadius: "var(--ah-r-pill)", background: "var(--ah-accent)", animation: "ah-pulse var(--ah-pulse)" }} />
              Työskentelee
              {workingDetail ? <span style={{ fontWeight: 400 }}>· {workingDetail}</span> : null}
            </span>
          ) : null}
        </div>
        <div style={{ fontFamily: "var(--ah-mono)", fontSize: "11.5px", color: "var(--ah-muted)" }}>{project}</div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: "4px", flexShrink: 0 }}>
        <div onMouseEnter={() => onHoverChange && onHoverChange("conn", true)} onMouseLeave={() => onHoverChange && onHoverChange("conn", false)} style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: connected ? "var(--ah-muted)" : "var(--ah-err)" }}>
          <StatusDot tone={connected ? "ok" : "offline"} showMark={false} size={8} />
          <span style={{ ...wide, maxWidth: expanded === "conn" || !connected ? "125px" : "0px", opacity: expanded === "conn" || !connected ? 1 : 0 }}>
            {connected ? "Yhdistetty · " + server : "Yhteys poikki · " + server}
          </span>
        </div>
        <div onMouseEnter={() => onHoverChange && onHoverChange("model", true)} onMouseLeave={() => onHoverChange && onHoverChange("model", false)} style={{ display: "flex", alignItems: "center", gap: "5px", fontFamily: "var(--ah-mono)", fontSize: "11.5px", color: "var(--ah-faint)" }}>
          <span style={{ ...wide, maxWidth: expanded === "model" ? "90px" : "0px", opacity: expanded === "model" ? 1 : 0 }}>Model:</span>
          <span>{model.name}</span>
          <span style={{ ...wide, maxWidth: expanded === "model" ? "90px" : "0px", opacity: expanded === "model" ? 1 : 0 }}>· Thinking:</span>
          <span style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 11 }} title={"Thinking: " + model.thinking}>
            {Array.from({ length: thinkingLevels }).map((_, i) => (
              <span key={i} style={{ width: 3, height: 3 + i * 2, borderRadius: 1, background: i < thinkingLevel ? "var(--ah-ink-2)" : "var(--ah-line)" }} />
            ))}
          </span>
          <span style={{ ...wide, maxWidth: expanded === "model" ? "90px" : "0px", opacity: expanded === "model" ? 1 : 0 }}>{model.thinking}</span>
        </div>
      </div>
    </div>
  );
}
