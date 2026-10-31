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
  type SiteKey,
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
import { ProviderMark, providerCopy, settingsPlace } from "./Integrations";
import {
  OnboardingFrame,
  OnboardingRoute,
  type OnboardingRouteStep,
} from "./OnboardingFrame";
import {
  keyNames,
  type SiteKeyActions,
  type SiteKeyLink,
  SiteKeyPageLink,
  SiteKeyRemoval,
} from "./SiteKeySettings";
import "./OnboardingSettings.css";
import { liveText } from "../i18n";
import { onboardingSettingsText } from "../text/onboardingSettings";

const txt = liveText(onboardingSettingsText);

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

const modeNames = new Proxy({} as Record<RepositoryMode, string>, {
  get: (_target, mode: RepositoryMode) => txt.modes[mode],
  ownKeys: () => ["preselected", "auto", "skip"],
  getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }),
});
const listLabel = new Proxy({} as Record<RepositoryMode, string>, {
  get: (_target, mode: RepositoryMode) => txt.listLabel[mode],
});
const listHint = new Proxy({} as Record<RepositoryMode, string>, {
  get: (_target, mode: RepositoryMode) => txt.listHint[mode],
});
const repoWord = (n: number) => txt.repos(n);

export function repositoryEffect(d: OnboardingDocument): string {
  const n = d.repositories.defaults.length;
  const w = repoWord(n);
  switch (d.repositories.mode) {
    case "preselected":
      return n ? txt.effectPreselected(w) : txt.effectPreselectedNone;
    case "auto":
      return n ? txt.effectAuto(w) : txt.effectAutoNone;
    case "skip":
      return n ? txt.effectSkip(w) : txt.effectSkipNone;
  }
}
function repositoryHint(d: OnboardingDocument): string {
  const n = d.repositories.defaults.length;
  switch (d.repositories.mode) {
    case "preselected":
      return n ? txt.hintPreselected(n) : txt.personChooses;
    case "auto":
      return n ? txt.hintAuto(n) : txt.nothingToFetch;
    case "skip":
      return n ? txt.hintSkip(n) : txt.skipped;
  }
}

// The administrator reads each option as what the person will do.
const adminHow = new Proxy({} as Record<AIOption, string>, {
  get: (_target, option: string) => txt.how[option],
});
const aiOptions = () =>
  aiOptionCatalog.map((o) => ({ ...o, how: adminHow[o.id] }));
const optionName = (id: AIOffer) =>
  aiOptions().find((o) => o.id === id)?.name ?? "";
function aiHint(offer: AIOffer, siteKey?: SiteKey) {
  return offer === "all"
    ? txt.personChooses
    : offer === "site_key"
      ? txt.aiSiteKey(siteKey ? keyNames[siteKey.provider] : "")
      : txt.aiDefault(optionName(offer));
}

function integrationHint(i: OnboardingIntegration, available?: boolean) {
  if (available !== true) return txt.hiddenUnoffered;
  return i.required ? txt.required : txt.optional;
}

const stepName = (step: OnboardingStep) =>
  step === "github"
    ? "GitHub"
    : step === "repositories"
      ? txt.repositories
      : step === "ai"
        ? txt.ai
        : step === "add-integration"
          ? txt.addIntegration
          : providerCopy[step.slice("integration:".length) as ProviderId].name;

/** The administrator's list of the route: fixed order, one row per step. */
function RouteList({
  doc,
  availability,
  step,
  onStep,
  siteKey,
}: {
  doc: OnboardingDocument;
  availability: ProviderAvailability;
  step: OnboardingStep;
  onStep: (step: OnboardingStep) => void;
  siteKey?: SiteKey;
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
      <p className="ob-eyebrow">{txt.route}</p>
      <ol className="ob-steplist" aria-label={txt.routeSteps}>
        {row("github", txt.signIn, true)}
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
          row("add-integration", txt.newStep, false, "ob-add")}
        {row(
          "ai",
          aiHint(doc.ai_account.offer, siteKey),
          doc.ai_account.offer !== "site_key",
        )}
      </ol>
    </div>
  );
}

function Effect({ children }: { children: ReactNode }) {
  return (
    <p className="ob-effect" data-testid="onboarding-effect">
      <strong>{txt.personSees}</strong> {children}
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
      <p className="ob-lbl">{txt.repoMode}</p>
      <Segmented
        data-testid="onboarding-repository-mode"
        label={txt.repoMode}
        size="row"
        isDisabled={disabled}
        options={(["preselected", "auto", "skip"] as RepositoryMode[]).map(
          (m) => ({
            id: m,
            label: modeNames[m],
          }),
        )}
        value={mode}
        onChange={(m) => set({ mode: m })}
      />
      <p className="ob-lbl ob-list-lbl">
        {txt.defaultRepos}&nbsp;
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
                      <span title={txt.private}>
                        <Icon name="lock" width={12} height={12} />
                        <span className="ah-visually-hidden">
                          {txt.private}
                        </span>
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
                    aria-label={txt.removeRepo(name)}
                    onPress={() =>
                      set({ defaults: defaults.filter((d) => d !== name) })
                    }
                  >
                    <Icon name="cross" width={14} height={14} />
                    {txt.remove}
                  </ControlButton>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="ob-muted" data-testid="onboarding-no-defaults">
            {txt.noDefaults}
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
                ? txt.maxDefaults(maxDefaults)
                : undefined
            }
            onPress={onAddRepository}
          >
            <Icon name="plus" width={14} height={14} />
            {txt.addRepo}
          </ControlButton>
        </div>
      </div>
      <p className="ob-muted ob-access" data-testid="onboarding-access-rule">
        {txt.accessRule}
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
              {available === false ? txt.notOffered : txt.unknown}
            </span>
          ) : null}
        </div>
        <Segmented
          data-testid="onboarding-integration-required"
          label={txt.requiredOf(copy.name)}
          size="row"
          isDisabled={disabled}
          options={[
            { id: "optional", label: txt.optional },
            { id: "required", label: txt.required },
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
          aria-label={txt.removeIntegration(copy.name)}
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
          {txt.remove}
        </ControlButton>
      </div>
      {available !== true ? (
        <p className="ob-muted ob-access">
          {available === false ? txt.hiddenNotOffered : txt.hiddenUnknown}
        </p>
      ) : null}
      <Effect>
        {available !== true
          ? txt.nothingShown
          : item.required
            ? txt.requiredEffect(copy.name)
            : txt.optionalEffect(copy.name)}
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
      <p className="ob-muted">{txt.addIntro}</p>
      <div className="ob-tiles" data-testid="onboarding-integration-choices">
        {ready.length === 0 ? (
          <p className="ob-muted" data-testid="onboarding-no-ready">
            {txt.noneReady}
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
              {txt.add}
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
                  {availability[p] === false ? txt.notOffered : txt.unknown}
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
  siteKey,
  keyActions,
  keyLink,
}: {
  doc: OnboardingDocument;
  onChange: (doc: OnboardingDocument) => void;
  disabled: boolean;
  siteKey?: SiteKey;
  keyActions?: Pick<SiteKeyActions, "remove">;
  keyLink?: SiteKeyLink;
}) {
  const offer = doc.ai_account.offer;
  // The last default stays in hand while the administrator flips the way.
  const [remembered, setRemembered] = useState<AIOption>(
    offer === "all" || offer === "site_key" ? "chatgpt" : offer,
  );
  // Sivuston avain before a key is stored: the way points to the AI-avain
  // tab, where the key is set; nothing changed yet.
  const [keyOpen, setKeyOpen] = useState(false);
  const [leaving, setLeaving] = useState<"all" | "default">();
  const keyWay = offer === "site_key" || keyOpen;
  const way = keyWay ? "key" : offer === "all" ? "all" : "default";
  const set = (next: AIOffer) =>
    onChange({ ...doc, ai_account: { offer: next } });
  const pick = (next: "all" | "default" | "key") => {
    if (next === way) return;
    if (offer === "site_key") {
      // Leaving the key removes it; that is asked first.
      if (next !== "key" && keyActions) setLeaving(next);
      return;
    }
    setKeyOpen(next === "key");
    if (next !== "key") set(next === "all" ? "all" : remembered);
  };
  return (
    <>
      <p className="ob-lbl">{txt.way}</p>
      <Segmented
        data-testid="onboarding-ai-way"
        label={txt.aiWay}
        size="row"
        isDisabled={disabled}
        options={[
          { id: "all", label: txt.personChooses },
          { id: "default", label: txt.wayDefault },
          { id: "key", label: txt.waySiteKey },
        ]}
        value={way}
        onChange={pick}
      />
      {way === "default" ? (
        <fieldset
          className="ob-choices"
          aria-label={txt.defaultFor}
          data-testid="onboarding-ai-default"
          disabled={disabled}
        >
          {aiOptions().map((o) => (
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
      {way === "key" ? (
        <p className="ob-muted" data-testid="site-key-terms">
          {siteKey
            ? txt.keySet(
                keyNames[siteKey.provider],
                <code data-testid="site-key-suffix">…{siteKey.suffix}</code>,
              )
            : txt.keyNotSet}
          <SiteKeyPageLink link={keyLink}>
            {siteKey ? txt.changeKey : txt.setKey}
          </SiteKeyPageLink>
        </p>
      ) : null}
      <Effect>
        {offer === "site_key"
          ? txt.noAiStep(siteKey ? keyNames[siteKey.provider] : "")
          : keyWay
            ? txt.untilStored
            : offer === "all"
              ? txt.allOptions
              : txt.onlyOption(optionName(offer))}
      </Effect>
      <p className="ob-muted">{txt.addLater}</p>
      <SiteKeyRemoval
        siteKey={siteKey}
        open={leaving !== undefined}
        disabled={!keyActions}
        onCancel={() => setLeaving(undefined)}
        onConfirm={() => {
          const next = leaving === "all" ? "all" : remembered;
          setLeaving(undefined);
          setKeyOpen(false);
          void keyActions?.remove(next);
        }}
      />
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
  siteKey,
  keyActions,
  keyLink,
}: {
  doc: OnboardingDocument;
  step: OnboardingStep;
  availability: ProviderAvailability;
  onChange: (doc: OnboardingDocument) => void;
  onStep: (step: OnboardingStep) => void;
  onAddRepository: () => void;
  facts: (name: string) => RepositoryFacts | undefined;
  disabled?: boolean;
  /** The stored site AI key, as it is ever read back. */
  siteKey?: SiteKey;
  keyActions?: Pick<SiteKeyActions, "remove">;
  /** Palvelimen ylläpito › AI-avain, where the key is set. */
  keyLink?: SiteKeyLink;
}) {
  const provider = step.startsWith("integration:")
    ? (step.slice("integration:".length) as ProviderId)
    : undefined;
  return (
    <section
      className="ob-config"
      data-step={step}
      aria-label={txt.stepSettings(stepName(step))}
    >
      <p className="ob-eyebrow">{txt.yourSettings}</p>
      <h3>{stepName(step)}</h3>
      {step === "github" ? (
        <p className="ob-muted">{txt.githubStep}</p>
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
        <AISettings
          doc={doc}
          onChange={onChange}
          disabled={disabled}
          siteKey={siteKey}
          keyActions={keyActions}
          keyLink={keyLink}
        />
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
        <p className="ob-muted">{txt.integrationGone}</p>
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
          txt.saving
        ) : save.kind === "saved" ? (
          <>
            <Icon name="check" width={14} height={14} />
            {txt.saved}
          </>
        ) : save.kind === "idle" ? (
          txt.savesAtOnce
        ) : (
          txt.notSaved
        )}
      </p>
      {save.kind === "refused" ? (
        <p role="alert" className="ob-notice ob-notice-error">
          {txt.refused(save.text)}
        </p>
      ) : save.kind === "uncertain" || save.kind === "conflict" ? (
        <div
          role="alert"
          className="ob-notice ob-notice-error"
          data-testid="onboarding-save-failure"
          data-state={save.kind}
        >
          <p>{save.kind === "conflict" ? txt.conflict : txt.uncertain}</p>
          <ControlButton
            size="row"
            data-testid="onboarding-reload"
            onPress={onReload}
          >
            {txt.reloadCurrent}
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
  siteKey,
  keyActions,
  keyLink,
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
  siteKey?: SiteKey;
  keyActions?: Pick<SiteKeyActions, "remove">;
  keyLink?: SiteKeyLink;
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
      siteKey={siteKey}
      keyActions={keyActions}
      keyLink={keyLink}
    />
  );
  const status = <SaveStatus save={save} onReload={onReload} />;
  return (
    <div className="ob-page" data-testid="onboarding-settings">
      <div
        className="ob-head"
        data-settings-row="onboarding-preview"
        tabIndex={-1}
      >
        <p className="ob-lede">{txt.lede}</p>
        <ControlButton
          data-testid="onboarding-preview-open"
          size="page"
          variant="secondary"
          onPress={() => onPreview(true)}
        >
          <Icon name="eye" width={16} height={16} />
          {txt.showPreview}
        </ControlButton>
      </div>
      {preview ? null : status}
      <div
        className="ob-layout"
        data-settings-row="onboarding-route"
        tabIndex={-1}
      >
        <RouteList
          doc={doc}
          availability={availability}
          step={step}
          onStep={onStep}
          siteKey={siteKey}
        />
        <div className="s-card ob-cfg-card">
          {preview ? <p className="ob-muted">{txt.inPanel}</p> : settings}
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
        <p className="ob-muted">{txt.previewNote}</p>
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
    { id: "github", note: txt.signedIn },
    ...(hasRepositoryStep(mode, n)
      ? [
          {
            id: "repositories" as const,
            note: mode === "skip" ? txt.siteFetches(n) : undefined,
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
        <h1>{txt.chooseRepos}</h1>
        <p>{txt.chooseReposLead}</p>
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
                  ? txt.alreadyFetches(defaults.length)
                  : txt.preselectedFor(defaults.length)}
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
                    <span className="ob-muted">{txt.siteFetchesShort}</span>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        ) : null}
        <p className="ob-muted">{txt.previewOnlyDefaults}</p>
        <div className="ob-pv-actions">
          <ControlButton
            data-testid="onboarding-preview-next"
            size="page"
            variant="primary"
            onPress={() => onNext()}
          >
            {txt.continue}
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
          {txt.connectOwn(copy.name)}
          {step.required ? "" : txt.later(settingsPlace(step.provider))}
        </p>
        <div className="ig-tile ob-tile">
          <ProviderMark provider={step.provider} />
          <div>
            <span className="ig-rn">{copy.name}</span>
          </div>
          <ControlButton size="row" variant="secondary" isDisabled>
            {txt.connect}
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
              {txt.continuePreview}
            </ControlButton>
          ) : (
            <ControlButton
              data-testid="onboarding-preview-next"
              size="page"
              variant="secondary"
              onPress={() => onNext(true)}
            >
              {txt.continueWithout}
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
        <h1>{txt.signInAi}</h1>
        <p>{aiStepLead(suggestionOf(offer))}</p>
        <AIOfferList
          offer={offer}
          choice={choice ?? suggestionOf(offer)?.id ?? "chatgpt"}
          onChoose={setChoice}
          body={(o) => (
            <ControlButton size="row" variant="secondary" isDisabled>
              {o.key ? txt.saveKey : txt.signInEllipsis}
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
            {txt.continuePreview}
          </ControlButton>
        </div>
      </div>
    );
  }
  return (
    <div className="ob-pv-card" data-testid="onboarding-preview-card">
      <h1>{txt.ready}</h1>
      <p>{txt.workspacesNext}</p>
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
          aria-label={txt.previewTitle}
          data-testid="onboarding-preview"
        >
          <header className="ob-pm-bar">
            <span className="ob-pm-title">
              <Icon name="eye" width={16} height={16} />
              <strong className="ob-pm-name">{txt.preview}</strong>
              <span>{txt.previewLead}</span>
            </span>
            <Segmented
              data-testid="onboarding-preview-device"
              label={txt.device}
              size="row"
              options={[
                { id: "desktop", label: txt.desktop },
                { id: "phone", label: txt.phone },
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
              {txt.restart}
            </ControlButton>
            <ControlButton
              data-testid="onboarding-preview-close"
              size="row"
              variant="secondary"
              onPress={onClose}
            >
              {txt.closePreview}
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
            <aside className="ob-pm-drawer" aria-label={txt.yourSettingsPanel}>
              {children}
            </aside>
          </div>
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
