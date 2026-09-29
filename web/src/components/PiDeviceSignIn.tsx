import { useState } from "react";
import { Button } from "./Primitives";
import { InlineNotice, StatusMark } from "./Status";
import styles from "./PiDeviceSignIn.module.css";

/** Display facts only. The caller owns the attempt, session binding, polling and native status. */
export type PiDeviceSignInView =
  | { phase: "ready" | "pending"; verificationUri: string; userCode: string }
  | { phase: "waiting" | "start" }
  | {
      phase: "connected" | "expired" | "interrupted" | "failed" | "unavailable";
    };

export interface PiDeviceSignInProps {
  view: PiDeviceSignInView;
  checking?: boolean;
  onCancel?: () => void;
  onRetry?: () => void;
  onRefresh?: () => void;
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
  checking = false,
  onCancel,
  onRetry,
  onRefresh,
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

  return (
    <section className={styles.card} aria-labelledby="pi-device-title">
      <header>
        <p className="ah-eyebrow">Käyttöönotto</p>
        <h1 id="pi-device-title" tabIndex={-1}>
          ChatGPT-kirjautuminen
        </h1>
      </header>
      <div role="status" aria-live="polite" aria-atomic="true">
        {active ? (
          <StatusMark
            label={
              view.phase === "pending"
                ? "Odotetaan vahvistusta"
                : "Odotetaan kirjautumista"
            }
            tone="info"
            animated={view.phase === "pending" ? "running" : false}
          />
        ) : outcome &&
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
            <p>1. Avaa OpenAI:n kirjautumissivu uuteen välilehteen.</p>
            <a href={uri} target="_blank" rel="noopener noreferrer">
              Avaa OpenAI:n vahvistussivu (uusi välilehti)
            </a>
            <p>2. Syötä siellä tämä koodi:</p>
            <div className={styles.code}>
              <code>{view.userCode}</code>
              <Button
                label="Kopioi koodi"
                variant="secondary"
                onPress={() => {
                  void copyCode();
                }}
              />
            </div>
            {copy?.code === view.userCode ? (
              <p role="status">{copy.message}</p>
            ) : null}
            <p>
              3. Palaa tänne vahvistuksen jälkeen. Kirjautumisen tila päivittyy
              automaattisesti. Pelkkä linkin avaaminen ei vielä kirjaa sisään.
            </p>
          </div>
        ) : (
          <p role="alert">
            Vahvistussivua tai koodia ei voi näyttää turvallisesti. Pyydä uusi
            kirjautumisyritys.
          </p>
        )
      ) : view.phase === "interrupted" || view.phase === "unavailable" ? (
        <>
          <h3>Kirjautuminen keskeytyi</h3>
          <InlineNotice
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
      <div className={styles.actions}>
        {cancellable ? (
          onCancel ? (
            <Button
              label="Peruuta kirjautumisyritys"
              variant="secondary"
              onPress={onCancel}
            />
          ) : null
        ) : view.phase !== "connected" && onRetry ? (
          <Button
            label={
              view.phase === "start"
                ? "Aloita kirjautuminen"
                : "Aloita uusi yritys"
            }
            variant={view.phase === "start" ? "primary" : "secondary"}
            onPress={onRetry}
          />
        ) : null}
        {active && !usable && onRetry ? (
          <Button
            label="Aloita uusi yritys"
            variant="secondary"
            onPress={onRetry}
          />
        ) : null}
      </div>
    </section>
  );
}
