import { useEffect, useRef, useState } from "react";
import { conversationName } from "../app/conversationName";
import { NameNotSaved } from "../app/namingRefusal";
import "./NameEditor.css";
import { liveText } from "../i18n";
import { overlaysText } from "../text/overlays";

const txt = liveText(overlaysText);

/**
 * A conversation's name edited in place of its title. Enter or leaving the
 * field saves, Escape keeps the old name. A failed save keeps the typed text
 * open with a short reason, so nothing the person wrote is lost or retried
 * behind their back.
 */
export function NameEditor({
  value,
  label,
  onSave,
  onClose,
  className,
}: {
  value: string;
  label: string;
  /** Resolves once the host has the name; rejects when it is not known to. */
  onSave: (name: string) => Promise<void>;
  /** Editing ended: saved (with the name) or kept as it was. */
  onClose: (saved?: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const [state, setState] = useState<"editing" | "saving" | "failed">(
    "editing",
  );
  // The host's reason for a refusal, when it gave one.
  const [reason, setReason] = useState("");
  const field = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => {
    field.current?.focus();
    field.current?.select();
  }, []);
  const close = (saved?: string) => {
    if (done.current) return;
    done.current = true;
    onClose(saved);
  };
  const save = async () => {
    if (state === "saving" || done.current) return;
    const name = conversationName(draft);
    if (!name || name === value) {
      close();
      return;
    }
    setState("saving");
    try {
      await onSave(name);
      close(name);
    } catch (error) {
      setReason(error instanceof NameNotSaved ? error.reason : "");
      setState("failed");
    }
  };
  return (
    <span className={`ah-name-editor ${className ?? ""}`}>
      <input
        ref={field}
        data-testid="conversation-name-field"
        className="ah-name-field"
        aria-label={label}
        aria-invalid={state === "failed" || undefined}
        aria-busy={state === "saving" || undefined}
        autoComplete="off"
        enterKeyHint="done"
        maxLength={160}
        value={draft}
        // Text typed during a save would not be what was saved.
        readOnly={state === "saving"}
        onChange={(event) => {
          setDraft(event.target.value);
          if (state === "failed") setState("editing");
        }}
        onBlur={() => {
          if (state !== "failed") void save();
        }}
        onKeyDown={(event) => {
          // The rail row and header must not act on keys meant for the field.
          event.stopPropagation();
          if (event.key === "Enter") {
            event.preventDefault();
            void save();
          } else if (event.key === "Escape") {
            event.preventDefault();
            if (state !== "saving") close();
          }
        }}
      />
      {state === "failed" ? (
        <span
          className="ah-name-problem"
          role="status"
          data-testid="conversation-name-problem"
        >
          {reason ? `${reason} ${txt.nameEscape}` : txt.nameNotSaved}
        </span>
      ) : null}
    </span>
  );
}
