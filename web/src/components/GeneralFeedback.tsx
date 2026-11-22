import {
  type RefObject,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useText } from "../i18n";
import { explainModeText } from "../text/explainMode";
import { generalFeedbackText } from "../text/generalFeedback";
import {
  type FeedbackIssue,
  feedbackText,
  GENERAL_NOTE_MAX,
  generalFeedbackIssue,
  readVersion,
} from "./explainFeedback";
import { Icon } from "./Icon";
import "./ExplainMode.css";
import "./GeneralFeedback.css";

/** A general report has no part context. The caller owns its entry point. */
export function GeneralFeedback({
  anchor,
  onClose,
  explain = false,
}: {
  anchor: RefObject<HTMLButtonElement | null>;
  onClose: () => void;
  explain?: boolean;
}) {
  const t = useText(generalFeedbackText);
  const f = useText(explainModeText).feedback;
  const id = useId();
  const panel = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  const outside = useRef(false);
  const [note, setNote] = useState("");
  const [need, setNeed] = useState(false);
  const [nudge, setNudge] = useState(false);
  const [version, setVersion] = useState<string>();
  const [done, setDone] = useState<FeedbackIssue>();
  const [copyStatus, setCopyStatus] = useState("");
  const close = () => {
    onClose();
    anchor.current?.focus({ preventScroll: true });
  };
  useEffect(() => {
    let active = true;
    void readVersion().then((v) => {
      if (active) setVersion(v);
    });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => {
    if (!nudge) return;
    const timer = setTimeout(() => setNudge(false), 2400);
    return () => clearTimeout(timer);
  }, [nudge]);
  useLayoutEffect(() => {
    field.current?.focus({ preventScroll: true });
  }, []);
  useLayoutEffect(() => {
    if (done)
      panel.current
        ?.querySelector<HTMLElement>('[data-testid="general-done"]')
        ?.focus();
  }, [done]);
  useLayoutEffect(() => {
    const place = () => {
      const el = panel.current;
      const r = anchor.current?.getBoundingClientRect();
      if (!el || !r) return;
      el.style.left = `${Math.max(8, Math.min(r.right - el.offsetWidth, innerWidth - el.offsetWidth - 8))}px`;
      el.style.top = `${r.bottom + 10}px`;
      el.style.maxHeight = `${Math.max(80, innerHeight - r.bottom - 18)}px`;
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchor]);
  useEffect(() => {
    const block = (e: Event) => {
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();
    };
    const down = (e: PointerEvent) => {
      outside.current = false;
      if (
        !(e.target instanceof Element) ||
        panel.current?.contains(e.target) ||
        anchor.current?.contains(e.target) ||
        (explain && e.target.closest(".ah-explain-bar"))
      )
        return;
      outside.current = true;
      block(e);
      if (note.trim() && !done) setNudge(true);
    };
    const swallow = (e: Event) => {
      if (outside.current) block(e);
    };
    const click = (e: Event) => {
      if (!outside.current) return;
      block(e);
      outside.current = false;
      if (!note.trim() || done) close();
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        block(e);
        close();
      }
    };
    const focus = (e: FocusEvent) => {
      if (
        !(e.target instanceof Element) ||
        panel.current?.contains(e.target) ||
        e.target === anchor.current ||
        e.target.closest(".ah-explain-bar")
      )
        return;
      if (!note.trim() || done) onClose();
    };
    window.addEventListener("focusin", focus);
    window.addEventListener("pointerdown", down, true);
    window.addEventListener("pointerup", swallow, true);
    window.addEventListener("mousedown", swallow, true);
    window.addEventListener("mouseup", swallow, true);
    window.addEventListener("click", click, true);
    window.addEventListener("keydown", key, true);
    return () => {
      window.removeEventListener("focusin", focus);
      window.removeEventListener("pointerdown", down, true);
      window.removeEventListener("pointerup", swallow, true);
      window.removeEventListener("mousedown", swallow, true);
      window.removeEventListener("mouseup", swallow, true);
      window.removeEventListener("click", click, true);
      window.removeEventListener("keydown", key, true);
    };
  });
  const empty = !note.trim();
  return (
    <div
      ref={panel}
      className="ah-explain-ui ah-general-feedback"
      role="dialog"
      aria-labelledby={`${id}-title`}
      data-testid="general-feedback"
    >
      <div className="ah-general-head">
        <h2 id={`${id}-title`}>{t.title}</h2>
        <button
          type="button"
          className="ah-explain-x"
          data-testid="general-close"
          aria-label={t.close}
          onClick={close}
        >
          ×
        </button>
      </div>
      {done ? (
        <div
          className="ah-explain-done"
          data-testid="general-done"
          tabIndex={-1}
        >
          <p>
            <Icon name="check" aria-hidden="true" />
            {t.done}
          </p>
          <p className="ah-explain-meta">{f.noAccount}</p>
          <button
            type="button"
            className="ah-explain-link"
            data-testid="general-copy"
            onClick={() => {
              void (
                navigator.clipboard?.writeText(feedbackText(done)) ??
                Promise.reject()
              )
                .then(() => setCopyStatus(f.copied))
                .catch(() => setCopyStatus(f.copyFailed));
            }}
          >
            {f.copy}
          </button>
          <p role="status">{copyStatus}</p>
        </div>
      ) : (
        <div className="ah-explain-report-note">
          <p className="ah-general-lead">{t.lead}</p>
          {explain ? <p className="ah-general-lead">{t.partHow}</p> : null}
          <label htmlFor={`${id}-note`}>{t.label}</label>
          <textarea
            ref={field}
            id={`${id}-note`}
            data-testid="general-text"
            required
            aria-invalid={(need && empty) || undefined}
            aria-describedby={`${id}-facts`}
            placeholder={t.placeholder}
            rows={3}
            maxLength={GENERAL_NOTE_MAX}
            value={note}
            onChange={(e) => {
              setNote(e.target.value);
              setNeed(false);
            }}
          />
          {need && empty ? (
            <p className="ah-explain-nudge" role="alert">
              {t.need}
            </p>
          ) : null}
          <div className="ah-explain-report-row">
            <button
              type="button"
              className="ah-explain-send"
              data-testid="general-send"
              data-empty={empty || undefined}
              onClick={() => {
                if (empty) {
                  setNeed(true);
                  field.current?.focus();
                  return;
                }
                const issue = generalFeedbackIssue(note, version);
                window.open(issue.url, "_blank", "noopener,noreferrer");
                setDone(issue);
                setNote("");
              }}
            >
              <Icon name="github" aria-hidden="true" />
              {f.send}
              <Icon name="external" aria-hidden="true" />
              <span className="ah-visually-hidden">{f.newTab}</span>
            </button>
            <button
              type="button"
              className="ah-general-cancel"
              data-testid="general-cancel"
              onClick={close}
            >
              {f.cancel} <kbd>Esc</kbd>
            </button>
          </div>
          {nudge ? (
            <p
              className="ah-explain-nudge"
              role="status"
              data-testid="general-nudge"
            >
              {t.finishFirst}
            </p>
          ) : null}
          <p className="ah-explain-meta" id={`${id}-facts`}>
            {t.facts}
          </p>
        </div>
      )}
    </div>
  );
}
