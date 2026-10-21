import { useEffect, useId, useRef, useState } from "react";

/**
 * A single-value setting edited in place: it saves when focus leaves the field
 * or on Enter, Escape returns to the saved value, and a failed save keeps the
 * typed text with a short reason beside the field.
 */
export function InlineTextSetting({
  "data-testid": testId,
  label,
  description,
  value,
  unit,
  inputMode,
  maxLength,
  disabled = false,
  normalize = (draft) => draft.trim(),
  invalid,
  onSave,
}: {
  "data-testid"?: string;
  label: string;
  description?: string;
  value: string;
  unit?: string;
  inputMode?: "text" | "decimal";
  maxLength?: number;
  disabled?: boolean;
  /** The value that would be saved; equal to `value` means nothing to save. */
  normalize?: (draft: string) => string;
  /** A short reason when the draft cannot be saved, otherwise undefined. */
  invalid?: (draft: string) => string | undefined;
  onSave: (next: string) => Promise<void>;
}) {
  const id = useId();
  const [draft, setDraft] = useState(value);
  const [status, setStatus] = useState<
    "idle" | "saving" | "saved" | "failed" | "invalid"
  >("idle");
  const [reason, setReason] = useState("");
  const saving = useRef(false);
  const editing = useRef(false);
  // Follow the host's value unless the person is editing or has unsaved text.
  // biome-ignore lint/correctness/useExhaustiveDependencies: only a new saved value resets the draft.
  useEffect(() => {
    if (!editing.current && status !== "failed" && status !== "invalid")
      setDraft(value);
  }, [value]);
  const save = async () => {
    if (saving.current || disabled) return;
    const next = normalize(draft);
    if (next === value) {
      setDraft(value);
      setStatus("idle");
      return;
    }
    const problem = invalid?.(draft);
    if (problem) {
      setReason(problem);
      setStatus("invalid");
      return;
    }
    saving.current = true;
    setStatus("saving");
    try {
      await onSave(next);
      setStatus("saved");
    } catch {
      setReason("muutosta ei voitu vahvistaa.");
      setStatus("failed");
    } finally {
      saving.current = false;
    }
  };
  return (
    <div data-testid="inline-setting" className="s-row s-inline">
      <div className="s-lbl">
        <label htmlFor={id}>
          <strong>{label}</strong>
        </label>
        {description ? <span className="s-desc">{description}</span> : null}
      </div>
      <div className="s-val">
        <span className="s-inline-field">
          <input
            data-testid={testId}
            id={id}
            value={draft}
            inputMode={inputMode}
            maxLength={maxLength}
            disabled={disabled}
            // Text typed during a save would be overwritten by its reply.
            readOnly={status === "saving"}
            aria-invalid={status === "failed" || status === "invalid"}
            aria-describedby={`${id}-status`}
            onFocus={() => {
              editing.current = true;
            }}
            onChange={(e) => {
              setDraft(e.target.value);
              if (status === "saved") setStatus("idle");
            }}
            onBlur={() => {
              editing.current = false;
              void save();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                void save();
              } else if (e.key === "Escape") {
                setDraft(value);
                setStatus("idle");
              }
            }}
          />
          {unit ? <span className="s-inline-unit">{unit}</span> : null}
        </span>
        <span
          id={`${id}-status`}
          data-testid="inline-setting-status"
          data-state={status}
          className={`s-inline-status${status === "failed" || status === "invalid" ? " s-inline-failed" : ""}`}
          role={
            status === "failed" || status === "invalid" ? "alert" : "status"
          }
        >
          {status === "saving"
            ? "Tallennetaan…"
            : status === "saved"
              ? "Tallennettu"
              : status === "failed"
                ? `Ei tallennettu: ${reason} Teksti säilyi; yritä uudelleen Enterillä.`
                : status === "invalid"
                  ? `Ei tallennettu: ${reason}`
                  : ""}
        </span>
      </div>
    </div>
  );
}
