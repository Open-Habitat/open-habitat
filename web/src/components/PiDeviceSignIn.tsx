import { type ReactNode, useState } from "react";
import { liveText } from "../i18n";
import { piDeviceSignInText } from "../text/piDeviceSignIn";
import { ExternalLink, IconButton } from "./ControlElements";
import { Icon } from "./Icon";
import { OnboardingFrame } from "./OnboardingFrame";
import styles from "./PiDeviceSignIn.module.css";
import { Button } from "./Primitives";
import { InlineNotice, StatusMark } from "./Status";

const txt = liveText(piDeviceSignInText);

/** Display facts only. The caller owns the attempt, session binding, polling and native status. */
export type PiDeviceSignInView =
  | { phase: "ready" | "pending"; verificationUri: string; userCode: string }
  | { phase: "waiting" | "cancelling" | "start" }
  | {
      phase: "connected" | "expired" | "interrupted" | "failed" | "unavailable";
    };

export interface PiDeviceSignInProps {
  view: PiDeviceSignInView;
  /** Inside a step that owns the heading and the frame, such as the
   * onboarding AI step's ChatGPT row. */
  embedded?: boolean;
  checking?: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
  onRefresh?: () => void;
  onBack?: () => void;
}

// Match the native Pi adapter's verified device page, not an arbitrary URL or
// a provider URL with a prefilled code. A changed provider path needs review.
function safeVerificationUri(value: string): string | undefined {
  return value === "https://auth.openai.com/codex/device" ? value : undefined;
}

const tones = {
  waiting: "info",
  cancelling: "info",
  start: "warning",
  connected: "success",
  expired: "warning",
  interrupted: "danger",
  failed: "danger",
  unavailable: "danger",
} as const;

function outcomeOf(phase: PiDeviceSignInView["phase"]) {
  if (!(phase in tones)) return undefined;
  const key = phase as keyof typeof tones;
  return { ...txt.outcomes[key], tone: tones[key] };
}

export function PiDeviceSignIn({
  view,
  embedded = false,
  checking = false,
  onCancel,
  onRetry,
  onRefresh,
  onBack,
}: PiDeviceSignInProps) {
  // The feedback is associated with the code, so a replaced attempt never shows stale copy success.
  const [copy, setCopy] = useState<{ code: string; message: string }>();
  const active = view.phase === "ready" || view.phase === "pending";
  const cancellable = active || view.phase === "waiting";
  const uri = active ? safeVerificationUri(view.verificationUri) : undefined;
  const usable = active && Boolean(uri && view.userCode);
  const outcome = outcomeOf(view.phase);

  async function copyCode() {
    if (!active || !usable) return;
    const code = view.userCode;
    try {
      await navigator.clipboard.writeText(code);
      setCopy({ code, message: txt.copied });
    } catch {
      setCopy({
        code,
        message: txt.copyFailed,
      });
    }
  }

  const hint = <p className={styles.hint}>{txt.hint}</p>;
  const content = (
    <section
      className={`${styles.card}${embedded ? ` ${styles.embedded}` : ""}`}
      data-testid="pi-sign-in-card"
      data-phase={view.phase}
      aria-labelledby={embedded ? undefined : "pi-device-title"}
      aria-label={embedded ? txt.label : undefined}
    >
      {embedded ? null : (
        <header>
          <p className="ah-eyebrow">{txt.eyebrow}</p>
          <h1 data-testid="pi-sign-in-title" id="pi-device-title" tabIndex={-1}>
            {txt.title}
          </h1>
        </header>
      )}
      <div role="status" aria-live="polite" aria-atomic="true">
        {active || (embedded && view.phase === "start") ? null : outcome &&
          view.phase !== "interrupted" &&
          view.phase !== "unavailable" ? (
          <StatusMark label={outcome.label} tone={outcome.tone} />
        ) : checking ? (
          <StatusMark label={txt.checking} tone="info" animated="running" />
        ) : null}
      </div>
      {active ? (
        usable ? (
          <div className={styles.steps}>
            <div className={styles.instruction}>
              <span className={styles.number}>1</span>
              <div>
                <strong>{txt.step1}</strong>
                <div className={styles.code}>
                  <code data-testid="pi-device-code">{view.userCode}</code>
                  <span title={txt.copyCode}>
                    <IconButton
                      data-testid="pi-code-copy"
                      size="row"
                      aria-label={txt.copyCode}
                      variant="secondary"
                      onPress={() => {
                        void copyCode();
                      }}
                    >
                      <Icon name="copy" />
                    </IconButton>
                  </span>
                </div>
                {copy?.code === view.userCode ? (
                  <p data-testid="pi-code-copy-result" role="status">
                    {copy.message}
                  </p>
                ) : null}
              </div>
            </div>
            <div className={styles.instruction}>
              <span className={styles.number}>2</span>
              <div>
                <strong>{txt.step2}</strong>
                <ExternalLink
                  href={uri}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {txt.openPage}
                </ExternalLink>
              </div>
            </div>
            <div className={styles.instruction} role="status">
              <span className={styles.number}>3</span>
              <div>
                <strong>{txt.step3}</strong>
                <StatusMark
                  label={txt.waiting}
                  tone="info"
                  animated={view.phase === "pending" ? "running" : false}
                />
                <p>{txt.autoRefresh}</p>
              </div>
            </div>
          </div>
        ) : (
          <p role="alert">{txt.unsafe}</p>
        )
      ) : view.phase === "interrupted" || view.phase === "unavailable" ? (
        <>
          <h3 data-testid="pi-attempt-interrupted">{txt.interrupted}</h3>
          <InlineNotice
            data-testid="pi-attempt-uncertain"
            title={txt.unconfirmed}
            description={checking ? txt.checkingServer : outcome?.detail}
            tone="danger"
            actions={
              onRefresh && !checking
                ? [{ label: txt.check, onPress: onRefresh }]
                : []
            }
          />
        </>
      ) : embedded && view.phase === "start" ? null : (
        <p>{outcome?.detail}</p>
      )}
      {embedded ? null : hint}
      <div data-testid="device-actions" className={styles.actions}>
        {cancellable ? (
          onCancel ? (
            <Button
              data-testid="pi-attempt-cancel"
              size="row"
              label={txt.cancel}
              variant="quiet"
              onPress={onCancel}
            />
          ) : null
        ) : view.phase !== "connected" && onRetry ? (
          <Button
            size="page"
            data-testid="pi-attempt-start"
            label={view.phase === "start" ? txt.start : txt.retry}
            variant="primary"
            onPress={onRetry}
          />
        ) : null}
        {active && !usable && onRetry ? (
          <Button
            data-testid="pi-attempt-start"
            size="page"
            label={txt.retry}
            variant="secondary"
            onPress={onRetry}
          />
        ) : null}
        {onBack ? (
          <Button
            data-testid="pi-back-to-repositories"
            size="page"
            label={txt.back}
            variant="quiet"
            onPress={onBack}
          />
        ) : null}
      </div>
      {embedded ? hint : null}
    </section>
  );
  return embedded ? (
    content
  ) : (
    <OnboardingFrame step="ai">{content}</OnboardingFrame>
  );
}

/** The numbered instructions of a provider sign-in, so every provider in
 * the onboarding AI step reads the same way. */
export function SignInSteps({ children }: { children: ReactNode }) {
  return <div className={styles.steps}>{children}</div>;
}

export function SignInStep({
  number,
  title,
  children,
  status = false,
}: {
  number: number;
  title: string;
  children?: ReactNode;
  /** The step only reports progress, so it is announced. */
  status?: boolean;
}) {
  return (
    <div className={styles.instruction} role={status ? "status" : undefined}>
      <span className={styles.number}>{number}</span>
      <div>
        <strong>{title}</strong>
        {children}
      </div>
    </div>
  );
}
