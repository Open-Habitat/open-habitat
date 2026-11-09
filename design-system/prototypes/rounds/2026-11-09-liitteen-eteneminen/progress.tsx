import { ControlButton } from "../../../../web/src/components/ControlElements";
import { Icon } from "../../../../web/src/components/Icon";
import { WarningBanner } from "../../../../web/src/components/WarningBanner";
import { useLanguage, useText } from "../../../../web/src/i18n";
import { batch, mt, progressText, speed, type Upload } from "./upload";

// proto-attachment-upload-progress, round 1: the three presentations of the
// same uploads, and what they share (a failed save, a send that waits).
// Rengas and Palkki show a file the moment it is chosen, as a chip in the
// attachment row; Erä shows the batch as one line and a file only once saved.

type T = ReturnType<typeof useText<typeof progressText.fi>>;
type Props = {
  uploads: Upload[];
  /** Files and bytes of this batch already saved, for the batch figure. */
  done: number;
  doneBytes: number;
  /** When the batch's first byte and its latest went, on the events' clock. */
  batchStarted?: number;
  batchLast?: number;
  onCancel: (key: string) => void;
  onCancelAll: () => void;
};

const percent = (u: Upload) => (u.phase === "saving" ? 100 : Math.floor((u.sent / u.file.size) * 100));
const fraction = (u: Upload) => (u.phase === "saving" ? 1 : u.file.size ? u.sent / u.file.size : 0);

/** The figure after a chip or in a line: "42 %", "odottaa", "tallennetaan". */
const state = (t: T, u: Upload) => (u.phase === "queued" ? t.queued : u.phase === "saving" ? t.saving : t.percent(percent(u)));

function Ring({ u }: { u: Upload }) {
  // The context ring's geometry and strokes (ContextRing.css): track and arc.
  const r = 7;
  const c = 2 * Math.PI * r;
  return (
    <svg className="ue-ring" viewBox="0 0 18 18" aria-hidden="true" data-phase={u.phase}>
      <circle className="ue-ring-track" cx="9" cy="9" r={r} />
      <circle
        className="ue-ring-arc"
        cx="9"
        cy="9"
        r={r}
        strokeDasharray={`${u.phase === "saving" ? c * 0.7 : c * fraction(u)} ${c}`}
        transform="rotate(-90 9 9)"
      />
    </svg>
  );
}

/** Rengas: each file is a chip at once. A ring with the percentage takes the
 * file icon's place until the host has saved it; ✕ cancels that file. */
export function RingChips({ uploads, onCancel }: Props) {
  const t = useText(progressText);
  useLanguage();
  if (!uploads.length) return null;
  return (
    <ul className="ah-attachment-chips ah-attachment-chips-draft ue-up-chips" aria-label={t.uploading} data-testid="upload-progress" data-state="ring">
      {uploads.map((u) => (
        <li
          key={u.key}
          className="ah-attachment-chip ue-up-chip"
          data-phase={u.phase}
          data-testid="upload-chip"
          role="progressbar"
          aria-label={t.progressOf(u.file.name)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={u.phase === "queued" ? 0 : percent(u)}
          aria-valuetext={state(t, u)}
        >
          <span className="ah-attachment-open ue-up-open">
            <Ring u={u} />
            <span className="ah-attachment-name">{u.file.name}</span>
            <span className="ue-figure">{state(t, u)}</span>
          </span>
          <ControlButton
            data-testid="upload-cancel"
            className="ah-attachment-remove"
            variant="quiet"
            size="inline"
            presentation="icon"
            aria-label={t.cancelOne(u.file.name)}
            onPress={() => onCancel(u.key)}
          >
            <Icon name="cross" />
          </ControlButton>
        </li>
      ))}
    </ul>
  );
}

/** Palkki: each file is a chip at once with a thin bar along its foot; the
 * file on the way is said under the row in megabytes and time left. */
export function BarChips({ uploads, onCancel }: Props) {
  const t = useText(progressText);
  useLanguage();
  if (!uploads.length) return null;
  return (
    <ul className="ah-attachment-chips ah-attachment-chips-draft ue-up-chips" aria-label={t.uploading} data-testid="upload-progress" data-state="bar">
      {uploads.map((u) => (
        <li
          key={u.key}
          className="ah-attachment-chip ue-up-chip ue-bar-chip"
          data-phase={u.phase}
          data-testid="upload-chip"
          role="progressbar"
          aria-label={t.progressOf(u.file.name)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={u.phase === "queued" ? 0 : percent(u)}
          aria-valuetext={state(t, u)}
        >
          <span className="ah-attachment-open ue-up-open">
            <Icon name="file" />
            <span className="ah-attachment-name">{u.file.name}</span>
          </span>
          <ControlButton
            data-testid="upload-cancel"
            className="ah-attachment-remove"
            variant="quiet"
            size="inline"
            presentation="icon"
            aria-label={t.cancelOne(u.file.name)}
            onPress={() => onCancel(u.key)}
          >
            <Icon name="cross" />
          </ControlButton>
          <span className="ue-chip-bar" aria-hidden="true">
            <span style={{ width: `${fraction(u) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Palkki's line under the row: the file on the way, megabytes, time left. */
export function BarLine({ uploads }: Props) {
  const t = useText(progressText);
  useLanguage();
  const u = uploads.find((x) => x.phase !== "queued");
  if (!u) return null;
  const waiting = uploads.filter((x) => x.phase === "queued").length;
  const rate = speed(u);
  const seen = u.started !== undefined && (u.samples.at(-1)?.[0] ?? 0) - u.started >= 2000;
  const left = rate > 0 && seen ? (u.file.size - u.sent) / rate : undefined;
  return (
    <p className="ue-line" data-testid="upload-line" aria-live="off">
      <span className="ue-line-name">{u.file.name}</span>
      <span className="ue-line-figures">
        {u.phase === "saving"
          ? `${t.saving}…`
          : [t.of(mt(u.sent, t.unit, 1), mt(u.file.size, t.unit, 1)), left !== undefined ? t.left(left) : null]
              .filter(Boolean)
              .join(" · ")}
        {waiting ? ` · ${t.waitingMore(waiting)}` : null}
      </span>
    </p>
  );
}

/** Erä: one line for the whole batch above the field, the files counted and
 * the megabytes summed, one bar and one Peru for all of it. Chips appear
 * only for saved files, as today. */
export function BatchLine({ uploads, done, doneBytes, batchStarted, batchLast, onCancelAll }: Props) {
  const t = useText(progressText);
  useLanguage();
  if (!uploads.length) return null;
  const b = batch(uploads, done, doneBytes, batchStarted, batchLast);
  const saving = b.current?.phase === "saving" && uploads.length === 1;
  const figures = saving
    ? t.savingAll
    : [t.of(mt(b.sent, t.unit, 1), mt(b.total, t.unit, 1)), b.left !== undefined ? t.left(b.left) : null].filter(Boolean).join(" · ");
  return (
    <div className="ue-batch" data-testid="upload-progress" data-state="batch">
      <div className="ue-batch-head">
        <span className="ue-batch-title">{t.attaching(b.done, b.files)}</span>
        <span className="ue-batch-figures">{figures}</span>
        <ControlButton data-testid="upload-cancel-all" size="inline" variant="quiet" aria-label={t.cancelAll} onPress={onCancelAll}>
          {t.cancel}
        </ControlButton>
      </div>
      <div
        className="ue-bar"
        role="progressbar"
        aria-label={t.progressAll}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.floor((b.sent / b.total) * 100)}
        aria-valuetext={`${t.attaching(b.done, b.files)}, ${figures}`}
      >
        <span style={{ width: `${(b.sent / b.total) * 100}%` }} />
      </div>
    </div>
  );
}

/** Lähetä pressed while files are on the way: the message waits for them. */
export function SendWaits({ onCancel }: { onCancel: () => void }) {
  const t = useText(progressText);
  useLanguage();
  return (
    <p className="ue-send-waits" data-testid="send-waits" role="status">
      <Icon name="clock" />
      <span>{t.sendWaits}</span>
      <ControlButton data-testid="send-waits-cancel" size="inline" variant="quiet" onPress={onCancel}>
        {t.dontSend}
      </ControlButton>
    </p>
  );
}

export type Failure = {
  file: File;
  sent: number;
  reason: "network" | "refused";
  /** Files of the batch that had not started; they wait for the retry. */
  rest: File[];
  /** Whether Lähetä was waiting, so the person knows nothing was sent. */
  sendCancelled: boolean;
};

/** A save that broke, in the refusal round's recommended form (Varoitus):
 * the shared danger warning with the file's name as its title, what
 * happened and how far it got, and one retry for it and the files after it. */
export function FailedBanner({ failure, onRetry, onDismiss }: { failure: Failure; onRetry: () => void; onDismiss: () => void }) {
  const t = useText(progressText);
  useLanguage();
  const f = failure;
  return (
    <WarningBanner
      data-testid="upload-failed"
      tone="danger"
      title={t.failedOne(f.file.name)}
      actions={
        <>
          <ControlButton data-testid="upload-retry" size="row" variant="secondary" onPress={onRetry}>
            <Icon name="refresh" />
            {t.retry}
          </ControlButton>
          <ControlButton size="inline" variant="quiet" presentation="icon" aria-label={t.dismiss} onPress={onDismiss}>
            <Icon name="cross" />
          </ControlButton>
        </>
      }
    >
      <p>
        {f.reason === "network" ? t.failedWhy(mt(f.sent, t.unit, 1), mt(f.file.size, t.unit, 1)) : t.failedRefused}
        {f.rest.length ? ` ${t.failedRest(f.rest.length)}` : ""}
        {f.sendCancelled ? ` ${t.failedSend}` : ""}
      </p>
    </WarningBanner>
  );
}
