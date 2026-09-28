import { useState } from "react";
import { Button } from "./Primitives";
import { StatusMark } from "./Status";
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
  onCancel?: () => void;
  onRetry?: () => void;
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
    detail: "Pi valmistelee vahvistuskoodia. Odota hetki.",
  },
  start: {
    label: "Pi-kirjautuminen tarvitaan",
    tone: "warning",
    detail: "Aloita Pi-kirjautuminen, jotta voit avata workspacet.",
  },
  connected: {
    label: "Pi-yhteys vahvistettu",
    tone: "success",
    detail:
      "Palvelin vahvisti Pi-kirjautumisen. Jatka vasta, kun palvelin näyttää seuraavan vaiheen.",
  },
  expired: {
    label: "Koodi vanheni",
    tone: "warning",
    detail: "Tätä koodia ei voi enää käyttää. Aloita uusi kirjautumisyritys.",
  },
  interrupted: {
    label: "Kirjautuminen keskeytyi",
    tone: "warning",
    detail:
      "Yhteyden tilaa ei voida vahvistaa. Tarkista tilanne ennen uuden yrityksen aloittamista.",
  },
  failed: {
    label: "Kirjautuminen epäonnistui",
    tone: "danger",
    detail:
      "Yritä uudelleen uudella koodilla. Jos virhe toistuu, ota yhteyttä ylläpitäjään.",
  },
  unavailable: {
    label: "Pi-kirjautuminen ei ole saatavilla",
    tone: "danger",
    detail: "Tilaa ei voida tarkistaa juuri nyt. Yritä myöhemmin uudelleen.",
  },
} as const;

export function PiDeviceSignIn({
  view,
  onCancel,
  onRetry,
}: PiDeviceSignInProps) {
  // The feedback is associated with the code, so a replaced attempt never shows stale copy success.
  const [copy, setCopy] = useState<{ code: string; message: string }>();
  const active = view.phase === "ready" || view.phase === "pending";
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
        <p className="ah-eyebrow">Ensimmäinen käyttökerta · Pi</p>
        <h2 id="pi-device-title">Yhdistä Pi ChatGPT-tilaukseen</h2>
      </header>
      <p>
        Vahvista kirjautuminen palveluntarjoajan sivulla. Älä syötä tunnusta tai
        salasanaa tähän sovellukseen.
      </p>
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
        ) : outcome ? (
          <StatusMark label={outcome.label} tone={outcome.tone} />
        ) : null}
      </div>
      {active ? (
        usable ? (
          <div className={styles.steps}>
            <p>1. Avaa palveluntarjoajan kirjautumissivu uuteen välilehteen.</p>
            <a href={uri} target="_blank" rel="noopener noreferrer">
              Avaa OpenAI:n vahvistussivu (uusi välilehti)
            </a>
            <p>2. Syötä sivulla tämä Pi:n antama koodi:</p>
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
              3. Palaa tähän välilehteen. Pi tarkistaa vahvistuksen; tämän sivun
              avaaminen ei vielä yhdistä tiliä.
            </p>
          </div>
        ) : (
          <p role="alert">
            Vahvistussivua tai koodia ei voi näyttää turvallisesti. Pyydä uusi
            kirjautumisyritys.
          </p>
        )
      ) : (
        <p>{outcome?.detail}</p>
      )}
      <div className={styles.actions}>
        {active ? (
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
            variant="secondary"
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
