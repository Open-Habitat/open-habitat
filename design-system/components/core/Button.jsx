import React from "react";

const BASE = {
  display: "inline-flex",
  alignItems: "center",
  gap: "7px",
  borderRadius: "var(--ah-r-md)",
  fontFamily: "var(--ah-font)",
  fontSize: "var(--ah-size-ui)",
  fontWeight: 500,
  cursor: "pointer",
  whiteSpace: "nowrap",
  transition: "background var(--ah-transition), border-color var(--ah-transition)",
};

const VARIANTS = {
  primary: { background: "var(--ah-accent)", color: "var(--ah-on-accent)", border: "1px solid var(--ah-accent)" },
  secondary: { background: "var(--ah-surface)", color: "var(--ah-ink)", border: "1px solid var(--ah-line)" },
  ghost: { background: "transparent", color: "var(--ah-muted)", border: "0" },
  danger: { background: "var(--ah-surface)", color: "var(--ah-ink)", border: "1px solid var(--ah-err-line)" },
};

const SIZES = {
  sm: { padding: "5px 11px", fontSize: "var(--ah-size-meta)" },
  md: { padding: "8px 16px" },
};

export function Button({ variant = "secondary", size = "md", disabled, shortcut, children, onClick, title, style }) {
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{ ...BASE, ...VARIANTS[variant], ...SIZES[size], opacity: disabled ? 0.45 : 1, ...style }}
    >
      {children}
      {shortcut ? (
        <span style={{ fontFamily: "var(--ah-mono)", fontSize: "11px", opacity: variant === "primary" ? 0.8 : 1, color: variant === "primary" ? "inherit" : "var(--ah-muted)" }}>
          {shortcut}
        </span>
      ) : null}
    </button>
  );
}
