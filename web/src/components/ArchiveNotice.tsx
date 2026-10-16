import { useEffect, useRef, useState } from "react";
import { ControlButton } from "./ControlElements";

/** Transient undo offer; the archive itself remains native host state. */
export function ArchiveNotice({
  title,
  busy,
  problem,
  onRestore,
  onClose,
}: {
  title: string;
  busy: boolean;
  problem?: string;
  onRestore: () => void;
  onClose: () => void;
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
        Arkistoitu <b>{title}</b>
        {problem ? <span> · {problem}</span> : null}
      </span>
      <ControlButton variant="quiet" isDisabled={busy} onPress={onRestore}>
        Palauta
      </ControlButton>
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
