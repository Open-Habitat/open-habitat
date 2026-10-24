import { type ReactNode, useState } from "react";
import { Dialog, Modal, ModalOverlay } from "react-aria-components";
import type { ProviderId } from "../app/integrations";
import {
  type AIOffer,
  hasRepositoryStep,
  maxDefaults,
  type OnboardingDocument,
  type OnboardingIntegration,
  type ProviderReadiness,
  providerOrder,
  type RepositoryMode,
  routeIntegrations,
} from "../app/onboardingConfig";
import {
  AIOfferList,
  type AIOption,
  aiOptionCatalog,
  aiStepLead,
  suggestionOf,
} from "./AIOfferList";
import { ControlButton, Segmented } from "./ControlElements";
import { Icon } from "./Icon";
import { ProviderMark, providerCopy } from "./Integrations";
import {
  OnboardingFrame,
  OnboardingRoute,
  type OnboardingRouteStep,
} from "./OnboardingFrame";
import "./OnboardingSettings.css";

// Asetukset › Käyttöönotto, as agreed in proto-admin-server-onboarding: the
// route as a list ("Lista reittinä", r2) beside the selected step's settings,
// the repositories as a mode and one list ("Tapa ja lista", r5), the AI
// account as "Kolme tapaa" (r3) and the person's view behind "Näytä henkilön
// näkymä" in a full preview with the settings docked (r4, r5). The order of
// the steps is fixed. Display only: the app saves every change as it is made.

export type OnboardingStep =
  | "github"
  | "repositories"
  | "add-integration"
  | "ai"
  | `integration:${ProviderId}`;

/** Whether this installation has a provider ready; undefined when unknown.
 * Only a ready integration can be added as a step, and only a ready one
 * shows to new people (Jari 2026-10-24). */
export type ProviderAvailability = ProviderReadiness;

/** What the admin's own GitHub catalog says about a default, when it knows. */
export type RepositoryFacts = { private: boolean; description: string };

const modeNames: Record<RepositoryMode, string> = {
  preselected: "Esivalitse",
  auto: "Hae automaattisesti",
  skip: "Ohita vaihe",
};
const listLabel: Record<RepositoryMode, string> = {
  preselected: "Esivalitut repot",
  auto: "Automaattisesti haettavat repot",
  skip: "Taustalla tuotavat repot",
};
const listHint: Record<RepositoryMode, string> = {
  preselected: "Valmiiksi valittuina henkilön repovalitsimessa.",
  auto: "Haetaan heti GitHub-kirjautumisen jälkeen. Henkilö voi valita lisää.",
  skip: "Valinnaisia. Tuodaan taustalla ilman repovaihetta.",
};
const repoWord = (n: number) =>
  `${n} ${n === 1 ? "oletusrepo" : "oletusrepoa"}`;

export function repositoryEffect(d: OnboardingDocument): string {
  const n = d.repositories.defaults.length;
  const w = repoWord(n);
  switch (d.repositories.mode) {
    case "preselected":
      return n
        ? `Repovalitsin avautuu, ja ${w} on valmiiksi valittuna. Henkilö voi poistaa valinnan ja valita muita.`
        : "Repovalitsin avautuu ilman esivalintoja.";
    case "auto":
      return n
        ? `${w} haetaan heti GitHub-kirjautumisen jälkeen. Repovalitsimessa henkilö voi valita lisää.`
        : "Mitään ei haeta automaattisesti. Lisää ainakin yksi repo, tai repovalitsin avautuu ilman haettavia.";
    case "skip":
      return n
        ? `Repovaihetta ei näytetä. ${w} tuodaan taustalla, ja reitin Repot-rivi kertoo sen.`
        : "Repovaihetta ei näytetä eikä mitään haeta. Repoja voi hakea myöhemmin työtilanäkymästä.";
  }
}
function repositoryHint(d: OnboardingDocument): string {
  const n = d.repositories.defaults.length;
  switch (d.repositories.mode) {
    case "preselected":
      return n ? `${n} esivalittuna` : "Henkilö valitsee";
    case "auto":
      return n ? `${n} haetaan automaattisesti` : "Ei mitään haettavaa";
    case "skip":
      return n ? `Ohitetaan · ${n} tuodaan` : "Ohitetaan";
  }
}

// The administrator reads each option as what the person will do.
const adminHow: Record<AIOption, string> = {
  chatgpt:
    "Kirjautuminen OpenAI:n sivulla lyhyellä koodilla. Käyttö kuuluu tilaukseen.",
  claude:
    "Kirjautuminen Clauden sivulla ja koodi takaisin tänne. Käyttö kuuluu tilaukseen.",
  openai_key: "Henkilö liittää oman avaimensa. OpenAI laskuttaa käytöstä.",
  anthropic_key:
    "Henkilö liittää oman avaimensa. Anthropic laskuttaa käytöstä.",
  deepseek_key: "Henkilö liittää oman avaimensa. DeepSeek laskuttaa käytöstä.",
};
const aiOptions = aiOptionCatalog.map((o) => ({ ...o, how: adminHow[o.id] }));
const optionName = (id: AIOffer) =>
  aiOptions.find((o) => o.id === id)?.name ?? "";
function aiHint(offer: AIOffer) {
  return offer === "all"
    ? "Henkilö valitsee"
    : offer === "site_key"
      ? "Ohitetaan · sivuston avain"
      : `Oletus: ${optionName(offer)}`;
}

function integrationHint(i: OnboardingIntegration, available?: boolean) {
  if (available !== true) return "Piilotettu · ei käytössä";
  return i.required ? "Pakollinen" : "Voi ohittaa";
}

const stepName = (step: OnboardingStep) =>
  step === "github"
    ? "GitHub"
    : step === "repositories"
      ? "Repot"
      : step === "ai"
        ? "AI-tili"
        : step === "add-integration"
          ? "Lisää integraatio"
          : providerCopy[step.slice("integration:".length) as ProviderId].name;

/** The administrator's list of the route: fixed order, one row per step. */
function RouteList({
  doc,
  availability,
  step,
  onStep,
}: {
  doc: OnboardingDocument;
  availability: ProviderAvailability;
  step: OnboardingStep;
  onStep: (step: OnboardingStep) => void;
}) {
  let n = 0;
  const row = (
    id: OnboardingStep,
    hint: string,
    counted: boolean,
    className?: string,
  ) => {
    if (counted) n += 1;
    return (
      <li key={id} className={className}>
        <button
          type="button"
          data-testid={`onboarding-route-${id}`}
          // Whether a new person sees this step.
          data-shown={id === "add-integration" ? undefined : counted}
          aria-current={step === id ? "step" : undefined}
          onClick={() => onStep(id)}
        >
          <span className="ob-num" aria-hidden="true">
            {id === "add-integration" ? (
              <Icon name="plus" width={14} height={14} />
            ) : counted ? (
              n
            ) : (
              "–"
            )}
          </span>
          <span className="ob-txt">
            <strong>{stepName(id)}</strong>
            <small data-testid={`onboarding-route-${id}-hint`}>{hint}</small>
          </span>
        </button>
      </li>
    );
  };
  return (
    <div className="s-card ob-listcol">
      <p className="ob-eyebrow">Uuden henkilön reitti</p>
      <ol
        className="ob-steplist"
        aria-label="Käyttöönoton vaiheet, kiinteä järjestys"
      >
        {row("github", "Kirjautuminen", true)}
        {row(
          "repositories",
          repositoryHint(doc),
          doc.repositories.mode !== "skip",
          doc.repositories.mode === "skip" ? "ob-skipped" : undefined,
        )}
        {doc.integrations.map((i) =>
          row(
            `integration:${i.provider}`,
            integrationHint(i, availability[i.provider]),
            availability[i.provider] === true,
            availability[i.provider] === true ? undefined : "ob-skipped",
          ),
        )}
        {doc.integrations.length < providerOrder.length &&
          row("add-integration", "Uusi vaihe ennen AI-tiliä", false, "ob-add")}
        {row(
          "ai",
          aiHint(doc.ai_account.offer),
          doc.ai_account.offer !== "site_key",
        )}
      </ol>
    </div>
  );
}

function Effect({ children }: { children: ReactNode }) {
  return (
    <p className="ob-effect" data-testid="onboarding-effect">
      <strong>Henkilö näkee:</strong> {children}
    </p>
  );
}

function RepositorySettings({
  doc,
  onChange,
  onAddRepository,
  facts,
  disabled,
}: {
  doc: OnboardingDocument;
  onChange: (doc: OnboardingDocument) => void;
  onAddRepository: () => void;
  facts: (name: string) => RepositoryFacts | undefined;
  disabled: boolean;
}) {
  const { mode, defaults } = doc.repositories;
  const set = (patch: Partial<OnboardingDocument["repositories"]>) =>
    onChange({ ...doc, repositories: { ...doc.repositories, ...patch } });
  return (
    <>
      <p className="ob-lbl">Repojen aloitustapa</p>
      <Segmented
        data-testid="onboarding-repository-mode"
        label="Repojen aloitustapa"
        size="row"
        isDisabled={disabled}
        options={(Object.keys(modeNames) as RepositoryMode[]).map((m) => ({
          id: m,
          label: modeNames[m],
        }))}
        value={mode}
        onChange={(m) => set({ mode: m })}
      />
      <p className="ob-lbl ob-list-lbl">
        Oletusrepot:&nbsp;
        <span data-testid="onboarding-list-label">{listLabel[mode]}</span>
      </p>
      <p className="ob-muted">{listHint[mode]}</p>
      <div className="ob-defaults" data-testid="onboarding-defaults">
        {defaults.length ? (
          <ul className="ob-repo-list">
            {defaults.map((name) => {
              const [owner, repo] = name.split("/");
              const f = facts(name);
              return (
                <li key={name} data-testid={`onboarding-default-${name}`}>
                  <span className="ob-repo-id">
                    <span className="ah-mono">
                      <span className="ah-clone-owner">{owner}/</span>
                      <b>{repo}</b>
                    </span>
                    {f?.private ? (
                      <span title="Yksityinen">
                        <Icon name="lock" width={12} height={12} />
                        <span className="ah-visually-hidden">Yksityinen</span>
                      </span>
                    ) : null}
                    {f?.description ? (
                      <span className="ob-muted ob-repo-desc">
                        {f.description}
                      </span>
                    ) : null}
                  </span>
                  <ControlButton
                    data-testid={`onboarding-remove-${name}`}
                    size="row"
                    variant="quiet"
                    isDisabled={disabled}
                    aria-label={`Poista ${name} oletusrepoista`}
                    onPress={() =>
                      set({ defaults: defaults.filter((d) => d !== name) })
                    }
                  >
                    <Icon name="cross" width={14} height={14} />
                    Poista
                  </ControlButton>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="ob-muted" data-testid="onboarding-no-defaults">
            Ei oletusrepoja.
          </p>
        )}
        <div>
          <ControlButton
            data-testid="onboarding-add-repository"
            size="row"
            variant="secondary"
            isDisabled={disabled || defaults.length >= maxDefaults}
            title={
              defaults.length >= maxDefaults
                ? `Oletusrepoja voi olla enintään ${maxDefaults}.`
                : undefined
            }
            onPress={onAddRepository}
          >
            <Icon name="plus" width={14} height={14} />
            Lisää oletusrepo…
          </ControlButton>
        </div>
      </div>
      <p className="ob-muted ob-access" data-testid="onboarding-access-rule">
        Repo haetaan vain, jos henkilöllä on siihen pääsy omalla
        GitHub-tilillään. Muuten se jätetään pois näyttämättä nimeä henkilölle.
      </p>
      <Effect>{repositoryEffect(doc)}</Effect>
    </>
  );
}

function IntegrationSettings({
  doc,
  provider,
  available,
  onChange,
  onRemoved,
  disabled,
}: {
  doc: OnboardingDocument;
  provider: ProviderId;
  available?: boolean;
  onChange: (doc: OnboardingDocument) => void;
  onRemoved: () => void;
  disabled: boolean;
}) {
  const item = doc.integrations.find((i) => i.provider === provider);
  if (!item) return null;
  const copy = providerCopy[provider];
  return (
    <>
      <div className="ig-tile ob-tile" data-testid="onboarding-integration">
        <ProviderMark provider={provider} />
        <div>
          <span className="ig-rn">{copy.name}</span>
          {available !== true ? (
            <span className="ig-meta" data-testid="onboarding-step-hidden">
              {available === false ? "Ei käytössä" : "Tila ei tiedossa"}
            </span>
          ) : null}
        </div>
        <Segmented
          data-testid="onboarding-integration-required"
          label={`${copy.name}: pakollisuus`}
          size="row"
          isDisabled={disabled}
          options={[
            { id: "optional", label: "Voi ohittaa" },
            { id: "required", label: "Pakollinen" },
          ]}
          value={item.required ? "required" : "optional"}
          onChange={(v) =>
            onChange({
              ...doc,
              integrations: doc.integrations.map((i) =>
                i.provider === provider
                  ? { ...i, required: v === "required" }
                  : i,
              ),
            })
          }
        />
        <ControlButton
          data-testid="onboarding-integration-remove"
          size="row"
          variant="quiet"
          isDisabled={disabled}
          aria-label={`Poista ${copy.name} käyttöönotosta`}
          onPress={() => {
            onChange({
              ...doc,
              integrations: doc.integrations.filter(
                (i) => i.provider !== provider,
              ),
            });
            onRemoved();
          }}
        >
          <Icon name="cross" width={14} height={14} />
          Poista
        </ControlButton>
      </div>
      {available !== true ? (
        <p className="ob-muted ob-access">
          {available === false
            ? "Integraatio ei ole käytössä tällä palvelimella, joten vaihe on piilotettu uusilta henkilöiltä. Se näkyy taas, kun integraatio on valmis käyttöön."
            : "Integraatioiden tilaa ei voitu lukea. Vaihe näkyy uusille henkilöille vain, kun integraatio on valmis käyttöön."}
        </p>
      ) : null}
      <Effect>
        {available !== true
          ? "Ei mitään. Vaihetta ei näytetä."
          : item.required
            ? `${copy.name} on oma vaiheensa, eikä sitä voi ohittaa. Vaihe ei estä työtilojen käyttöä.`
            : `${copy.name} ehdotetaan omana vaiheenaan; sen voi ohittaa.`}
      </Effect>
    </>
  );
}

function AddIntegration({
  doc,
  availability,
  onChange,
  onAdded,
  disabled,
}: {
  doc: OnboardingDocument;
  availability: ProviderAvailability;
  onChange: (doc: OnboardingDocument) => void;
  onAdded: (provider: ProviderId) => void;
  disabled: boolean;
}) {
  const left = providerOrder.filter(
    (p) => !doc.integrations.some((i) => i.provider === p),
  );
  // Only a ready integration can be added; the others are listed so the
  // administrator sees why they are not offered.
  const ready = left.filter((p) => availability[p] === true);
  const unready = left.filter((p) => availability[p] !== true);
  return (
    <>
      <p className="ob-muted">
        Jokainen lisätty integraatio on oma vaiheensa ennen AI-tiliä.
        Integraatiot ovat reitillä samassa järjestyksessä kuin Integraatiot-
        sivulla. Vain käyttöön valmiin integraation voi lisätä.
      </p>
      <div className="ob-tiles" data-testid="onboarding-integration-choices">
        {ready.length === 0 ? (
          <p className="ob-muted" data-testid="onboarding-no-ready">
            Yksikään lisäämätön integraatio ei ole valmis käyttöön.
          </p>
        ) : null}
        {ready.map((p) => (
          <div className="ig-tile ob-tile" key={p}>
            <ProviderMark provider={p} />
            <div>
              <span className="ig-rn">{providerCopy[p].name}</span>
            </div>
            <ControlButton
              data-testid={`onboarding-add-${p}`}
              size="row"
              variant="secondary"
              isDisabled={disabled}
              onPress={() => {
                onChange({
                  ...doc,
                  integrations: providerOrder.flatMap((q) =>
                    q === p
                      ? [{ provider: p, required: false }]
                      : doc.integrations.filter((i) => i.provider === q),
                  ),
                });
                onAdded(p);
              }}
            >
              Lisää
            </ControlButton>
          </div>
        ))}
      </div>
      {unready.length ? (
        <div className="ob-tiles" data-testid="onboarding-integration-unready">
          {unready.map((p) => (
            <div
              className="ig-tile ob-tile ob-unready"
              key={p}
              data-testid={`onboarding-unready-${p}`}
            >
              <ProviderMark provider={p} />
              <div>
                <span className="ig-rn">{providerCopy[p].name}</span>
                <span className="ig-meta">
                  {availability[p] === false
                    ? "Ei käytössä"
                    : "Tila ei tiedossa"}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}

function AISettings({
  doc,
  onChange,
  disabled,
}: {
  doc: OnboardingDocument;
  onChange: (doc: OnboardingDocument) => void;
  disabled: boolean;
}) {
  const offer = doc.ai_account.offer;
  // The last default stays in hand while the administrator flips the way.
  const [remembered, setRemembered] = useState<AIOption>(
    offer === "all" || offer === "site_key" ? "chatgpt" : offer,
  );
  const set = (next: AIOffer) =>
    onChange({ ...doc, ai_account: { offer: next } });
  return (
    <>
      <p className="ob-lbl">Tapa</p>
      <Segmented
        data-testid="onboarding-ai-way"
        label="AI-tilin tapa"
        size="row"
        isDisabled={disabled}
        options={[
          { id: "all", label: "Henkilö valitsee" },
          { id: "default", label: "Oletus" },
        ]}
        value={offer === "all" ? "all" : "default"}
        onChange={(v) => set(v === "all" ? "all" : remembered)}
      />
      {offer !== "all" && offer !== "site_key" ? (
        <fieldset
          className="ob-choices"
          aria-label="Oletus uudelle henkilölle"
          data-testid="onboarding-ai-default"
          disabled={disabled}
        >
          {aiOptions.map((o) => (
            <label key={o.id} className="ob-choice">
              <input
                type="radio"
                name="onboarding-ai-default"
                checked={offer === o.id}
                onChange={() => {
                  setRemembered(o.id);
                  set(o.id);
                }}
              />
              <span>
                <strong className="ob-choice-name">{o.name}</strong>
                <span className="ob-muted">{o.how}</span>
              </span>
            </label>
          ))}
        </fieldset>
      ) : null}
      <Effect>
        {offer === "all"
          ? "Kaikki AI-vaihtoehdot rinnakkain, ja henkilö valitsee niistä."
          : `Vain ${optionName(offer)}. Muut vaihtoehdot ovat linkin › Käytä muuta AI-palvelua takana.`}
      </Effect>
      <p className="ob-muted">
        Henkilö voi lisätä muita tilejä myöhemmin asetuksissa. AI-vaihe
        ohitetaan, jos henkilöllä on jo toimivat tunnukset.
      </p>
    </>
  );
}

/** The selected step's settings: the same panel on the page and in the
 * preview's side panel. */
export function OnboardingStepSettings({
  doc,
  step,
  availability,
  onChange,
  onStep,
  onAddRepository,
  facts,
  disabled = false,
}: {
  doc: OnboardingDocument;
  step: OnboardingStep;
  availability: ProviderAvailability;
  onChange: (doc: OnboardingDocument) => void;
  onStep: (step: OnboardingStep) => void;
  onAddRepository: () => void;
  facts: (name: string) => RepositoryFacts | undefined;
  disabled?: boolean;
}) {
  const provider = step.startsWith("integration:")
    ? (step.slice("integration:".length) as ProviderId)
    : undefined;
  return (
    <section
      className="ob-config"
      data-step={step}
      aria-label={`${stepName(step)}: asetukset`}
    >
      <p className="ob-eyebrow">Sinun asetuksesi</p>
      <h3>{stepName(step)}</h3>
      {step === "github" ? (
        <p className="ob-muted">
          Jokainen aloittaa kirjautumalla GitHub-tilillään. Kirjautuminen
          tunnistaa henkilön ja antaa hänen omille työkaluilleen pääsyn hänen
          repoihinsa. Vaihetta ei voi muuttaa.
        </p>
      ) : step === "repositories" ? (
        <RepositorySettings
          doc={doc}
          onChange={onChange}
          onAddRepository={onAddRepository}
          facts={facts}
          disabled={disabled}
        />
      ) : step === "add-integration" ? (
        <AddIntegration
          doc={doc}
          availability={availability}
          onChange={onChange}
          onAdded={(p) => onStep(`integration:${p}`)}
          disabled={disabled}
        />
      ) : step === "ai" ? (
        <AISettings doc={doc} onChange={onChange} disabled={disabled} />
      ) : provider && doc.integrations.some((i) => i.provider === provider) ? (
        <IntegrationSettings
          doc={doc}
          provider={provider}
          available={availability[provider]}
          onChange={onChange}
          onRemoved={() => onStep("add-integration")}
          disabled={disabled}
        />
      ) : (
        <p className="ob-muted">Integraatiota ei ole enää käyttöönotossa.</p>
      )}
    </section>
  );
}

export type SaveState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "saved" }
  /** The host refused the change; nothing was written. */
  | { kind: "refused"; text: string }
  /** Someone saved in between; nothing was written. */
  | { kind: "conflict" }
  /** The save may or may not have happened. */
  | { kind: "uncertain" };

/** Where the automatic save stands, and what to do when it failed. */
function SaveStatus({
  save,
  onReload,
}: {
  save: SaveState;
  onReload: () => void;
}) {
  return (
    <div className="ob-save">
      <p
        role="status"
        className="ob-save-state"
        data-testid="onboarding-save-state"
        data-state={save.kind}
      >
        {save.kind === "saving" ? (
          "Tallennetaan…"
        ) : save.kind === "saved" ? (
          <>
            <Icon name="check" width={14} height={14} />
            Tallennettu
          </>
        ) : save.kind === "idle" ? (
          "Muutokset tallentuvat heti."
        ) : (
          "Ei tallennettu"
        )}
      </p>
      {save.kind === "refused" ? (
        <p role="alert" className="ob-notice ob-notice-error">
          Muutosta ei tallennettu. {save.text}
        </p>
      ) : save.kind === "uncertain" || save.kind === "conflict" ? (
        <div
          role="alert"
          className="ob-notice ob-notice-error"
          data-testid="onboarding-save-failure"
          data-state={save.kind}
        >
          <p>
            {save.kind === "conflict"
              ? "Käyttöönottoa on muutettu toisaalla sen jälkeen, kun avasit sen. Viimeisintä muutostasi ei tallennettu. Lataa nykyinen versio ja tee muutos uudelleen."
              : "Tallennusta ei voitu vahvistaa. Muutos on voinut tallentua. Lataa nykyinen versio ennen kuin jatkat."}
          </p>
          <ControlButton
            size="row"
            data-testid="onboarding-reload"
            onPress={onReload}
          >
            Lataa nykyinen versio
          </ControlButton>
        </div>
      ) : null}
    </div>
  );
}

/** The whole Käyttöönotto tab. */
export function OnboardingSettings({
  doc,
  availability,
  step,
  onStep,
  onChange,
  onAddRepository,
  facts = () => undefined,
  save,
  onReload,
  disabled = false,
  preview,
  onPreview,
  host,
}: {
  doc: OnboardingDocument;
  availability: ProviderAvailability;
  step: OnboardingStep;
  onStep: (step: OnboardingStep) => void;
  /** Each change, saved by the app as it is made. */
  onChange: (doc: OnboardingDocument) => void;
  onAddRepository: () => void;
  facts?: (name: string) => RepositoryFacts | undefined;
  save: SaveState;
  onReload: () => void;
  disabled?: boolean;
  preview: boolean;
  onPreview: (open: boolean) => void;
  /** The site's host, for the preview's address bar. */
  host: string;
}) {
  const settings = (
    <OnboardingStepSettings
      doc={doc}
      step={step}
      availability={availability}
      onChange={onChange}
      onStep={onStep}
      onAddRepository={onAddRepository}
      facts={facts}
      disabled={disabled}
    />
  );
  const status = <SaveStatus save={save} onReload={onReload} />;
  return (
    <div className="ob-page" data-testid="onboarding-settings">
      <div className="ob-head">
        <p className="ob-lede">
          Mitä uusi henkilö käy läpi ensimmäisellä kirjautumisella. Vaiheiden
          järjestys on kiinteä. Muutos tallentuu heti ja koskee seuraavaa uutta
          käyttöönottoa; jo liittyneet eivät muutu.
        </p>
        <ControlButton
          data-testid="onboarding-preview-open"
          size="page"
          variant="secondary"
          onPress={() => onPreview(true)}
        >
          <Icon name="eye" width={16} height={16} />
          Näytä henkilön näkymä
        </ControlButton>
      </div>
      {preview ? null : status}
      <div className="ob-layout">
        <RouteList
          doc={doc}
          availability={availability}
          step={step}
          onStep={onStep}
        />
        <div className="s-card ob-cfg-card">
          {preview ? (
            <p className="ob-muted">
              Asetukset ovat esikatselun sivupaneelissa.
            </p>
          ) : (
            settings
          )}
        </div>
      </div>
      <OnboardingPreview
        open={preview}
        onClose={() => onPreview(false)}
        doc={doc}
        availability={availability}
        host={host}
      >
        {status}
        {settings}
        <p className="ob-muted">
          Muutos näkyy esikatselussa heti ja aloittaa sen alusta. Se myös
          tallentuu heti.
        </p>
      </OnboardingPreview>
    </div>
  );
}

// ---------- Preview mode ----------

type PreviewStep =
  | { id: "repositories" }
  | { id: "integration"; provider: ProviderId; required: boolean }
  | { id: "ai" }
  | { id: "done" };

/** The steps the person stops at, as this configuration makes them. The
 * integration steps come from the same rule as the person's own route. */
export function previewSteps(
  doc: OnboardingDocument,
  availability: ProviderAvailability,
): PreviewStep[] {
  return [
    ...(doc.repositories.mode === "skip"
      ? []
      : [{ id: "repositories" } as const]),
    ...routeIntegrations(doc.integrations, availability).map((i) => ({
      id: "integration" as const,
      provider: i.provider,
      required: i.required,
    })),
    ...(doc.ai_account.offer === "site_key" ? [] : [{ id: "ai" } as const]),
    { id: "done" },
  ];
}

/** The person's route for the shared Kartta frame: GitHub passed, the Repot
 * row also when the site fetches without a chooser, and the integrations
 * the preview passed without connecting marked skipped. */
function previewRoute(
  doc: OnboardingDocument,
  availability: ProviderAvailability,
  skipped: ProviderId[],
): OnboardingRouteStep[] {
  const { mode, defaults } = doc.repositories;
  const n = defaults.length;
  return [
    { id: "github", note: "Kirjautunut" },
    ...(hasRepositoryStep(mode, n)
      ? [
          {
            id: "repositories" as const,
            note:
              mode === "skip"
                ? `Sivusto hakee ${n} ${n === 1 ? "repon" : "repoa"}`
                : undefined,
          },
        ]
      : []),
    ...routeIntegrations(doc.integrations, availability).map(
      (i): OnboardingRouteStep => ({
        id: i.provider,
        required: i.required,
        skipped: skipped.includes(i.provider),
      }),
    ),
    ...(doc.ai_account.offer === "site_key" ? [] : [{ id: "ai" as const }]),
  ];
}

function PreviewStepCard({
  doc,
  step,
  onNext,
}: {
  doc: OnboardingDocument;
  step: PreviewStep;
  onNext: (skipped?: boolean) => void;
}) {
  const [choice, setChoice] = useState<AIOption>();
  const { mode, defaults } = doc.repositories;
  if (step.id === "repositories")
    return (
      <div className="ob-pv-card" data-testid="onboarding-preview-card">
        <h1>Valitse GitHub-repot haettaviksi</h1>
        <p>
          Valitse repot, joita haluat käyttää täällä. Ne haetaan työtiloiksi
          taustalla.
        </p>
        {defaults.length ? (
          <>
            <p className="ob-pv-note" data-testid="onboarding-preview-note">
              <Icon
                name={mode === "auto" ? "refresh" : "info"}
                width={14}
                height={14}
              />
              <span>
                {mode === "auto"
                  ? `Sivusto hakee sinulle jo ${defaults.length} ${defaults.length === 1 ? "repon" : "repoa"}. Valitse tästä vain lisää.`
                  : `Sivusto on valinnut valmiiksi ${defaults.length} ${defaults.length === 1 ? "repon" : "repoa"}. Voit poistaa valinnan.`}
              </span>
            </p>
            <ul className="ob-pv-repos">
              {defaults.map((name) => (
                <li key={name}>
                  <input
                    type="checkbox"
                    aria-label={name}
                    defaultChecked
                    disabled={mode === "auto"}
                  />
                  <span className="ah-mono">{name}</span>
                  {mode === "auto" ? (
                    <span className="ob-muted">Sivusto hakee</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="ob-muted">
          Esikatselu näyttää vain sivuston oletusrepot. Henkilö näkee myös omat
          repojensa, eikä hän näe oletusrepoa, johon hänellä ei ole pääsyä.
        </p>
        <div className="ob-pv-actions">
          <ControlButton
            data-testid="onboarding-preview-next"
            size="page"
            variant="primary"
            onPress={() => onNext()}
          >
            Jatka
          </ControlButton>
        </div>
      </div>
    );
  if (step.id === "integration") {
    const copy = providerCopy[step.provider];
    return (
      <div className="ob-pv-card" data-testid="onboarding-preview-card">
        <h1>{copy.name}</h1>
        <p>
          Yhdistä oma {copy.name}-tilisi, jos agenttisi pitää käyttää sen
          tietoja.
          {step.required ? "" : " Voit tehdä tämän myöhemmin asetuksissa."}
        </p>
        <div className="ig-tile ob-tile">
          <ProviderMark provider={step.provider} />
          <div>
            <span className="ig-rn">{copy.name}</span>
          </div>
          <ControlButton size="row" variant="secondary" isDisabled>
            Yhdistä…
          </ControlButton>
        </div>
        <div className="ob-pv-actions">
          {step.required ? (
            <ControlButton
              data-testid="onboarding-preview-next"
              size="page"
              variant="primary"
              onPress={() => onNext()}
            >
              Jatka (esikatselu)
            </ControlButton>
          ) : (
            <ControlButton
              data-testid="onboarding-preview-next"
              size="page"
              variant="secondary"
              onPress={() => onNext(true)}
            >
              Jatka ilman tiliä
            </ControlButton>
          )}
        </div>
      </div>
    );
  }
  if (step.id === "ai") {
    const offer = doc.ai_account.offer;
    // The person's own option list; each sign-in is a stand-in, since the
    // preview signs nobody in.
    return (
      <div className="ob-pv-card" data-testid="onboarding-preview-card">
        <h1>Kirjaudu AI-palveluun</h1>
        <p>{aiStepLead(suggestionOf(offer))}</p>
        <AIOfferList
          offer={offer}
          choice={choice ?? suggestionOf(offer)?.id ?? "chatgpt"}
          onChoose={setChoice}
          body={(o) => (
            <ControlButton size="row" variant="secondary" isDisabled>
              {o.key ? "Tallenna avain" : "Kirjaudu…"}
            </ControlButton>
          )}
        />
        <div className="ob-pv-actions">
          <ControlButton
            data-testid="onboarding-preview-next"
            size="page"
            variant="secondary"
            onPress={() => onNext()}
          >
            Jatka (esikatselu)
          </ControlButton>
        </div>
      </div>
    );
  }
  return (
    <div className="ob-pv-card" data-testid="onboarding-preview-card">
      <h1>Valmista</h1>
      <p>Seuraavaksi avautuvat henkilön työtilat.</p>
    </div>
  );
}

/** The person's screen, restarted whenever the configuration changes: the
 * production Kartta frame with a stand-in card for each step. */
function PreviewScreen({
  doc,
  availability,
}: {
  doc: OnboardingDocument;
  availability: ProviderAvailability;
}) {
  const steps = previewSteps(doc, availability);
  const [at, setAt] = useState(0);
  const [skipped, setSkipped] = useState<ProviderId[]>([]);
  const step = steps[Math.min(at, steps.length - 1)];
  return (
    <div
      className="ob-pv-screen"
      data-testid="onboarding-preview-screen"
      data-at={step.id === "integration" ? step.provider : step.id}
    >
      <OnboardingRoute steps={previewRoute(doc, availability, skipped)}>
        <OnboardingFrame
          step={step.id === "integration" ? step.provider : step.id}
        >
          <PreviewStepCard
            key={at}
            doc={doc}
            step={step}
            onNext={(skip) => {
              if (skip && step.id === "integration")
                setSkipped((old) => [...old, step.provider]);
              setAt((n) => Math.min(n + 1, steps.length - 1));
            }}
          />
        </OnboardingFrame>
      </OnboardingRoute>
    </div>
  );
}

/** Preview mode: a full-screen stage with the settings in a side panel.
 * Nothing in it is saved or sent anywhere. */
export function OnboardingPreview({
  open,
  onClose,
  doc,
  availability,
  host,
  children,
}: {
  open: boolean;
  onClose: () => void;
  doc: OnboardingDocument;
  availability: ProviderAvailability;
  host: string;
  children: ReactNode;
}) {
  const [device, setDevice] = useState<"desktop" | "phone">("desktop");
  const [run, setRun] = useState(0);
  return (
    <ModalOverlay
      className="ob-pm-overlay"
      isOpen={open}
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
      isDismissable={false}
    >
      <Modal className="ob-pm-modal">
        <Dialog
          className="ob-pm"
          aria-label="Esikatselu: uuden henkilön näkymä"
          data-testid="onboarding-preview"
        >
          <header className="ob-pm-bar">
            <span className="ob-pm-title">
              <Icon name="eye" width={16} height={16} />
              <strong className="ob-pm-name">Esikatselu</strong>
              <span>
                Näin uusi henkilö näkee käyttöönoton. Esikatselussa painetut
                eivät tallennu.
              </span>
            </span>
            <Segmented
              data-testid="onboarding-preview-device"
              label="Esikatselun laite"
              size="row"
              options={[
                { id: "desktop", label: "Tietokone" },
                { id: "phone", label: "Puhelin" },
              ]}
              value={device}
              onChange={setDevice}
            />
            <ControlButton
              data-testid="onboarding-preview-restart"
              size="row"
              variant="quiet"
              onPress={() => setRun((n) => n + 1)}
            >
              Aloita alusta
            </ControlButton>
            <ControlButton
              data-testid="onboarding-preview-close"
              size="row"
              variant="secondary"
              onPress={onClose}
            >
              Sulje esikatselu
            </ControlButton>
          </header>
          <div className="ob-pm-body">
            <div className="ob-pm-stage">
              <div
                className={`ob-dev ob-dev-${device}`}
                data-testid="onboarding-preview-frame"
                data-device={device}
              >
                {device === "desktop" ? (
                  <div className="ob-dev-chrome">
                    <span className="ob-dev-dots" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                    </span>
                    <span className="ob-dev-url">{host}</span>
                  </div>
                ) : (
                  <div className="ob-dev-notch" aria-hidden="true" />
                )}
                <div className="ob-dev-screen">
                  <PreviewScreen
                    key={`${JSON.stringify(doc)}|${run}`}
                    doc={doc}
                    availability={availability}
                  />
                </div>
              </div>
            </div>
            <aside className="ob-pm-drawer" aria-label="Asetuksesi">
              {children}
            </aside>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
