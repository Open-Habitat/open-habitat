import { useMemo, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { providerCopy } from "../components/Integrations";
import { OnboardingFrame } from "../components/OnboardingFrame";
import { IntegrationsSettings } from "./IntegrationsSettings";
import {
  type IntegrationList,
  listedProvider,
  type ProviderId,
} from "./integrations";

export const connectedTo = (list: IntegrationList, provider: ProviderId) =>
  list.accounts.some((a) => listedProvider(a) === provider);

/** One integration step of onboarding: Asetukset › Integraatiot limited to
 * the provider the site added. An optional step can be passed without
 * connecting; a required one has no skip action, only Continue once an
 * account is connected. Required gates nothing else: the person's
 * workspaces stay reachable by URL and SSH (ADR 0030). */
export function IntegrationOnboarding({
  provider,
  required,
  csrf,
  initial,
  onList,
  onContinue,
  onBack,
  backLabel,
}: {
  provider: ProviderId;
  required: boolean;
  csrf: string;
  initial: IntegrationList;
  onList: (list: IntegrationList) => void;
  onContinue: () => void;
  onBack: () => void;
  backLabel: string;
}) {
  const [connected, setConnected] = useState(connectedTo(initial, provider));
  const name = providerCopy[provider].name;
  // A stable list: the settings view resumes its sign-in when it changes.
  const only = useMemo(() => [provider], [provider]);
  return (
    <OnboardingFrame step={provider}>
      <section
        className="ah-onboarding-step"
        data-testid="integration-onboarding"
        data-provider={provider}
        data-required={required}
        aria-labelledby="integration-onboarding-title"
      >
        <header>
          <p className="ah-eyebrow">Käyttöönotto</p>
          <h1
            data-testid="integration-onboarding-title"
            id="integration-onboarding-title"
            tabIndex={-1}
          >
            Yhdistä {name}
          </h1>
          <p>
            {required
              ? `Ylläpitäjä pyytää yhdistämään ${providerCopy[provider].gen} tilin ennen jatkamista, jotta agenttisi voivat käyttää sen tietoja.`
              : `Agenttisi voivat käyttää ${providerCopy[provider].gen} tietoja. Voit myös jatkaa ilman ja yhdistää tilin myöhemmin asetuksissa.`}
          </p>
        </header>
        <IntegrationsSettings
          csrf={csrf}
          only={only}
          initial={initial}
          compact
          onList={(list) => {
            setConnected(connectedTo(list, provider));
            onList(list);
          }}
        />
        <div className="ah-onboarding-actions">
          <ControlButton
            data-testid="integration-onboarding-back"
            size="page"
            variant="quiet"
            onPress={onBack}
          >
            {backLabel}
          </ControlButton>
          {connected || !required ? (
            <ControlButton
              data-testid="integration-onboarding-continue"
              data-connected={connected}
              size="page"
              variant={connected ? "primary" : "secondary"}
              onPress={onContinue}
            >
              {connected ? "Jatka" : "Jatka ilman tiliä"}
            </ControlButton>
          ) : null}
        </div>
      </section>
    </OnboardingFrame>
  );
}
