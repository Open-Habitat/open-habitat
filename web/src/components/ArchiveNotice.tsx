import { useEffect, useRef, useState } from "react";
import { ControlButton } from "./ControlElements";

/** Transient undo offer; the archive itself remains native host state. */
export function ArchiveNotice({
  title,
  busy,
  problem,
  onRestore,
  onClose,
  message = "Arkistoitu",
  detail,
  restoreLabel = "Palauta",
  link,
}: {
  title: string;
  message?: string;
  detail?: string;
  restoreLabel?: string;
  busy: boolean;
  problem?: string;
  /** Absent when there is nothing to undo. */
  onRestore?: () => void;
  onClose: () => void;
  /** Where the thing can be found later. */
  link?: { label: string; onPress: () => void };
}) {
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const remaining = useRef(8000);
  useEffect(() => {
    if (hovered || focused || busy || problem) return;
    const start = Date.now();
    const timer = window.setTimeout(onClose, remaining.current);
    return () => {
      window.clearTimeout(timer);
      remaining.current = Math.max(0, remaining.current - (Date.now() - start));
    };
  }, [hovered, focused, busy, problem, onClose]);
  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onEscape);
    return () => document.removeEventListener("keydown", onEscape);
  }, [onClose]);
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: pointer/focus on the whole status pauses its lifetime; actions remain native buttons.
    <section
      className="ah-archive-notice"
      role="status"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocusCapture={() => setFocused(true)}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget))
          setFocused(false);
      }}
    >
      <span>
        {message} <b>{title}</b>
        {detail ? <span> · {detail}</span> : null}
        {problem ? <span> · {problem}</span> : null}
      </span>
      {link ? (
        <ControlButton variant="quiet" onPress={link.onPress}>
          {link.label}
        </ControlButton>
      ) : null}
      {onRestore ? (
        <ControlButton variant="quiet" isDisabled={busy} onPress={onRestore}>
          {restoreLabel}
        </ControlButton>
      ) : null}
      <ControlButton
        variant="quiet"
        aria-label="Sulje ilmoitus"
        onPress={onClose}
      >
        ×
      </ControlButton>
    </section>
  );
}
