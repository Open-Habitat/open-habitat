import { useState } from "react";
import { ExternalLink, IconButton } from "./ControlElements";
import { Icon } from "./Icon";
import { OnboardingFrame } from "./OnboardingFrame";
import styles from "./PiDeviceSignIn.module.css";
import { Button } from "./Primitives";
import { InlineNotice, StatusMark } from "./Status";

/** Display facts only. The caller owns the attempt, session binding, polling and native status. */
export type PiDeviceSignInView =
  | { phase: "ready" | "pending"; verificationUri: string; userCode: string }
  | { phase: "waiting" | "cancelling" | "start" }
  | {
      phase: "connected" | "expired" | "interrupted" | "failed" | "unavailable";
    };

export interface PiDeviceSignInProps {
  view: PiDeviceSignInView;
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

const outcomes = {
  waiting: {
    label: "Valmistellaan kirjautumista",
    tone: "info",
    detail: "Valmistellaan vahvistuskoodia. Odota hetki.",
  },
  cancelling: {
    label: "Peruutetaan kirjautumisyritystä",
    tone: "info",
    detail: "Odota hetki.",
  },
  start: {
    label: "ChatGPT-kirjautuminen tarvitaan",
    tone: "warning",
    detail: "Kirjaudu ChatGPT-tilillesi, niin voit aloittaa työtiloissa.",
  },
  connected: {
    label: "ChatGPT-kirjautuminen vahvistettu",
    tone: "success",
    detail: "Voit nyt siirtyä työtiloihin.",
  },
  expired: {
    label: "Kirjautumisyritys päättyi",
    tone: "warning",
    detail:
      "Tämä koodi ei ole enää käytössä. Kirjautumisen tulosta ei tiedetä. Voit aloittaa uudella koodilla.",
  },
  interrupted: {
    label: "Kirjautuminen keskeytyi",
    tone: "danger",
    detail: "Tarkista kirjautumisen tila ennen uutta yritystä.",
  },
  failed: {
    label: "Kirjautuminen epäonnistui",
    tone: "danger",
    detail:
      "Yritä uudelleen uudella koodilla. Jos virhe toistuu, ota yhteyttä ylläpitäjään.",
  },
  unavailable: {
    label: "Kirjautuminen keskeytyi",
    tone: "danger",
    detail: "Tilaa ei voitu tarkistaa. Yritä tarkistaa se uudelleen.",
  },
} as const;

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
  const outcome =
    view.phase in outcomes
      ? outcomes[view.phase as keyof typeof outcomes]
      : undefined;

  async function copyCode() {
    if (!active || !usable) return;
    const code = view.userCode;
    try {
      await navigator.clipboard.writeText(code);
      setCopy({ code, message: "Koodi kopioitu leikepöydälle." });
    } catch {
      setCopy({
        code,
        message: "Kopiointi ei onnistunut. Valitse ja kopioi koodi käsin.",
      });
    }
  }

  const content = (
    <section
      className={styles.card}
      data-testid="pi-sign-in-card"
      data-phase={view.phase}
      aria-labelledby="pi-device-title"
    >
      <header>
        <p className="ah-eyebrow">Käyttöönotto</p>
        <h1 data-testid="pi-sign-in-title" id="pi-device-title" tabIndex={-1}>
          Kirjaudu OpenAI-tiliisi
        </h1>
      </header>
      <div role="status" aria-live="polite" aria-atomic="true">
        {active ? null : outcome &&
          view.phase !== "interrupted" &&
          view.phase !== "unavailable" ? (
          <StatusMark label={outcome.label} tone={outcome.tone} />
        ) : checking ? (
          <StatusMark
            label="Tarkistetaan tilaa"
            tone="info"
            animated="running"
          />
        ) : null}
      </div>
      {active ? (
        usable ? (
          <div className={styles.steps}>
            <div className={styles.instruction}>
              <span className={styles.number}>1</span>
              <div>
                <strong>Kopioi koodi</strong>
                <div className={styles.code}>
                  <code data-testid="pi-device-code">{view.userCode}</code>
                  <span title="Kopioi koodi">
                    <IconButton
                      data-testid="pi-code-copy"
                      size="row"
                      aria-label="Kopioi koodi"
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
                  <p role="status">{copy.message}</p>
                ) : null}
              </div>
            </div>
            <div className={styles.instruction}>
              <span className={styles.number}>2</span>
              <div>
                <strong>Syötä koodi OpenAI:n sivulla</strong>
                <ExternalLink
                  href={uri}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Avaa OpenAI:n vahvistussivu (uusi välilehti)
                </ExternalLink>
              </div>
            </div>
            <div className={styles.instruction} role="status">
              <span className={styles.number}>3</span>
              <div>
                <strong>Palaa tänne ja odota</strong>
                <StatusMark
                  label="Odotetaan vahvistusta OpenAI:lta"
                  tone="info"
                  animated={view.phase === "pending" ? "running" : false}
                />
                <p>Sivu päivittyy automaattisesti, kun kirjaudut sisään.</p>
              </div>
            </div>
          </div>
        ) : (
          <p role="alert">
            Vahvistussivua tai koodia ei voi näyttää turvallisesti. Pyydä uusi
            kirjautumisyritys.
          </p>
        )
      ) : view.phase === "interrupted" || view.phase === "unavailable" ? (
        <>
          <h3 data-testid="pi-attempt-interrupted">Kirjautuminen keskeytyi</h3>
          <InlineNotice
            data-testid="pi-attempt-uncertain"
            title="Tilaa ei voitu vahvistaa"
            description={
              checking ? "Tarkistetaan palvelimen tilaa." : outcome?.detail
            }
            tone="danger"
            actions={
              onRefresh && !checking
                ? [{ label: "Tarkista tila", onPress: onRefresh }]
                : []
            }
          />
        </>
      ) : (
        <p>{outcome?.detail}</p>
      )}
      <p className={styles.hint}>
        Kirjautuminen tehdään OpenAI:n omalla sivulla. Salasanaa ei syötetä
        tänne.
      </p>
      <div data-testid="device-actions" className={styles.actions}>
        {cancellable ? (
          onCancel ? (
            <Button
              data-testid="pi-attempt-cancel"
              size="row"
              label="Peruuta kirjautumisyritys"
              variant="quiet"
              onPress={onCancel}
            />
          ) : null
        ) : view.phase !== "connected" && onRetry ? (
          <Button
            size="page"
            data-testid="pi-attempt-start"
            label={
              view.phase === "start"
                ? "Aloita kirjautuminen"
                : "Aloita uusi yritys"
            }
            variant="primary"
            onPress={onRetry}
          />
        ) : null}
        {active && !usable && onRetry ? (
          <Button
            data-testid="pi-attempt-start"
            size="page"
            label="Aloita uusi yritys"
            variant="secondary"
            onPress={onRetry}
          />
        ) : null}
        {onBack ? (
          <Button
            data-testid="pi-back-to-repositories"
            size="page"
            label="Takaisin valitsemaan GitHub-repoja"
            variant="quiet"
            onPress={onBack}
          />
        ) : null}
      </div>
    </section>
  );
  return embedded ? (
    content
  ) : (
    <OnboardingFrame step={3}>{content}</OnboardingFrame>
  );
}
