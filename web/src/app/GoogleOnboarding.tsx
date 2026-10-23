import { useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { OnboardingFrame } from "../components/OnboardingFrame";
import { IntegrationsSettings } from "./IntegrationsSettings";
import type { IntegrationList, ProviderId } from "./integrations";

const google: ProviderId[] = ["google"];

/** Whether this catalog offers Google: the server has it available, as
 * Asetukset › Integraatiot shows it. */
export const offersGoogle = (list: IntegrationList) =>
  list.providers.some((p) => p.id === "google" && p.available);
export const hasGoogle = (list: IntegrationList) =>
  list.accounts.some((a) => a.provider === "google");

/** Onboarding's Google step: Asetukset › Integraatiot limited to Google, and
 * a way on whether or not it was connected. */
export function GoogleOnboarding({
  csrf,
  initial,
  onList,
  onContinue,
  onBack,
}: {
  csrf: string;
  initial: IntegrationList;
  onList: (list: IntegrationList) => void;
  onContinue: () => void;
  onBack: () => void;
}) {
  const [connected, setConnected] = useState(hasGoogle(initial));
  return (
    <OnboardingFrame step="google">
      <section
        className="ah-onboarding-step"
        data-testid="google-onboarding"
        aria-labelledby="google-onboarding-title"
      >
        <header>
          <p className="ah-eyebrow">Käyttöönotto</p>
          <h1
            data-testid="google-onboarding-title"
            id="google-onboarding-title"
            tabIndex={-1}
          >
            Yhdistä Google
          </h1>
          <p>
            Posti, kalenteri, yhteystiedot ja Drive agenttiesi käyttöön. Voit
            myös jatkaa ilman ja yhdistää Googlen myöhemmin asetuksissa.
          </p>
        </header>
        <IntegrationsSettings
          csrf={csrf}
          only={google}
          initial={initial}
          compact
          onList={(list) => {
            setConnected(hasGoogle(list));
            onList(list);
          }}
        />
        <div className="ah-onboarding-actions">
          <ControlButton
            data-testid="google-onboarding-back"
            size="page"
            variant="quiet"
            onPress={onBack}
          >
            Takaisin repoihin
          </ControlButton>
          <ControlButton
            data-testid="google-onboarding-continue"
            data-connected={connected}
            size="page"
            variant={connected ? "primary" : "secondary"}
            onPress={onContinue}
          >
            {connected ? "Jatka AI-tiliin" : "Jatka ilman Googlea"}
          </ControlButton>
        </div>
      </section>
    </OnboardingFrame>
  );
}
