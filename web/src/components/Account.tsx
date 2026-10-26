import { useEffect, useRef, useState } from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { EditorSettings } from "../app/EditorSettings";
import "./Settings.css";
import { bundleChecks } from "../app/bundleRelease";
import { ClaudeSignIn } from "../app/ClaudeSignIn";
import { Devices } from "../app/Devices";
import { GitIdentity } from "../app/GitIdentity";
import { IntegrationsSettings } from "../app/IntegrationsSettings";
import { OnboardingAdministration } from "../app/OnboardingAdministration";
import { PersonalStorage } from "../app/PersonalStorage";
import { type OpenAIState, PiCredentials } from "../app/PiCredentials";
import type { AccountProfile } from "../app/pi";
import { ServerAdministration } from "../app/ServerAdministration";
import { ServerIntegrationsSettings } from "../app/ServerIntegrationsSettings";
import { ServerVersionLine } from "../app/ServerVersion";
import { SiteKeyAdministration } from "../app/SiteKeyAdministration";
import { type ServerInfo, serverInfo } from "../app/serverAdministration";
import { settingsHref } from "../app/settingsRoute";
import { getThemeChoice, setThemeChoice, type ThemeChoice } from "../theme";
import { getWorkPreference, setWorkPreference } from "../workPreference";
import { ControlButton, Segmented } from "./ControlElements";
import { Icon, type IconName } from "./Icon";
import { NativeDisconnect } from "./NativeDisconnect";
import { Menu } from "./Overlays";
import { Button } from "./Primitives";
import { StatusMark } from "./Status";
import type { Tone } from "./types";

/** Provider subject numbers are not a useful person-facing name. */
export function accountLabel(displayName: string): string {
  const name = displayName.trim();
  return name && !/^GitHub user\s+\d+$/i.test(name) && !/^\d+$/.test(name)
    ? name
    : "Oma tili";
}

export function AccountIdentity({
  profile,
  compact = false,
}: {
  profile: AccountProfile;
  compact?: boolean;
}) {
  const [failedURL, setFailedURL] = useState("");
  const name = accountLabel(profile.name);
  const shown = compact && name !== "Oma tili" ? name.split(/\s+/)[0] : name;
  const avatar =
    profile.avatar_url &&
    profile.avatar_url !== failedURL &&
    /^https:\/\/avatars\.githubusercontent\.com\//.test(profile.avatar_url);
  return (
    <span className="ah-account-presentation">
      <span className="ah-account-avatar" aria-hidden="true">
        {avatar ? (
          /* biome-ignore lint/a11y/noNoninteractiveElementInteractions: Image load failure swaps to the textual fallback. */
          <img
            src={profile.avatar_url}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setFailedURL(profile.avatar_url)}
          />
        ) : shown === "Oma tili" ? (
          "?"
        ) : (
          shown.slice(0, 1).toLocaleUpperCase()
        )}
      </span>
      <span className={compact ? "ah-rail-identity" : "ah-account-details"}>
        <strong>{shown}</strong>
        {!compact && profile.email && (
          <span className="ah-account-email">{profile.email}</span>
        )}
      </span>
    </span>
  );
}

function useThemeChoice() {
  const [theme, setTheme] = useState(getThemeChoice);
  useEffect(() => {
    const sync = () => setTheme(getThemeChoice());
    window.addEventListener("nah:theme-change", sync);
    return () => window.removeEventListener("nah:theme-change", sync);
  }, []);
  return theme;
}

export function AccountShelf({
  profile,
  name,
  server,
  placement = "top start",
  onSettings,
  onAdministration,
  onLogout,
}: {
  profile?: AccountProfile;
  name?: string;
  /** The server and its connection, when no sidebar head shows them. */
  server?: {
    name: string;
    version?: string;
    connectionLabel: string;
    tone: Tone;
  };
  placement?: "top start" | "bottom end";
  onSettings: () => void;
  onAdministration?: () => void;
  onLogout: () => void;
}) {
  const theme = useThemeChoice();
  const [workChoice, setWorkChoice] = useState(getWorkPreference);
  useEffect(() => {
    const sync = () => setWorkChoice(getWorkPreference());
    window.addEventListener("nah:work-change", sync);
    return () => window.removeEventListener("nah:work-change", sync);
  }, []);
  const person = profile ?? { name: name ?? "", email: "", avatar_url: "" };
  const compactName =
    accountLabel(person.name) === "Oma tili"
      ? "Oma tili"
      : accountLabel(person.name).split(/\s+/)[0];
  const themes: {
    id: ThemeChoice;
    label: string;
    icon: "system" | "sun" | "moon";
  }[] = [
    { id: "system", label: "Järjestelmä", icon: "system" },
    { id: "light", label: "Vaalea", icon: "sun" },
    { id: "dark", label: "Tumma", icon: "moon" },
  ];
  return (
    <div className="ah-account-shelf" data-account-controls>
      <Menu
        label="Tilivalikko"
        triggerLabel={`${compactName}, Tilivalikko`}
        triggerPresentation="account"
        trigger={
          <span className="ah-account-trigger">
            <AccountIdentity profile={person} compact />
          </span>
        }
        heading={
          <>
            <AccountIdentity profile={person} />
            {server ? (
              <span className={`ah-account-server ah-tone-${server.tone}`}>
                <span aria-hidden="true" className="ah-status-dot" />
                <span>{server.name}</span>
                {server.version ? (
                  <span className="ah-account-server-version">
                    {server.version}
                  </span>
                ) : null}
                <span className="ah-visually-hidden">
                  {server.connectionLabel}
                </span>
              </span>
            ) : null}
          </>
        }
        betweenItems={
          <>
            <div className="ah-account-menu-theme-row">
              <span>Teema</span>
              <Segmented
                data-testid="theme-choice"
                label="Teema"
                className="ah-account-menu-theme"
                options={themes.map(({ id, label, icon }) => ({
                  id,
                  label,
                  icon: <Icon name={icon} />,
                  iconOnly: true,
                }))}
                value={theme}
                onChange={setThemeChoice}
              />
            </div>
            <div className="ah-account-menu-theme-row">
              <span>Agentin työ</span>
              <Segmented
                label="Agentin työ"
                className="ah-account-menu-theme"
                options={[
                  { id: "hidden", label: "Piilossa" },
                  { id: "visible", label: "Näkyvissä" },
                ]}
                value={workChoice}
                onChange={setWorkPreference}
              />
            </div>
          </>
        }
        popoverClassName="ah-account-menu"
        placement={placement}
        items={[
          { id: "settings", label: "Asetukset" },
          ...(onAdministration
            ? [{ id: "administration", label: "Palvelimen ylläpito" }]
            : []),
          { id: "logout", label: "Kirjaudu ulos…", danger: true },
        ]}
        onAction={(id) => {
          if (id === "settings") onSettings();
          if (id === "administration") onAdministration?.();
          if (id === "logout") onLogout();
        }}
      />
    </div>
  );
}

type NativeState =
  "connected" | "disconnected" | "expired" | "pending" | "partial" | "unknown";
const states: Record<NativeState, { label: string; description: string }> = {
  connected: {
    label: "Yhdistetty",
    description: "GitHub-yhteys toimii tällä hetkellä.",
  },
  disconnected: {
    label: "Ei yhdistetty",
    description:
      "GitHub-yhteyttä ei löytynyt, joten git push ja gh eivät toimi. Yhdistä kirjautumalla GitHubilla.",
  },
  expired: {
    label: "Vanhentunut",
    description:
      "GitHub ei enää hyväksy palvelimelle tallennettua valtuutusta, joten git push ja gh eivät toimi. Yhdistä uudelleen kirjautumalla GitHubilla.",
  },
  pending: {
    label: "Yhdistäminen kesken",
    description:
      "GitHub-yhteyttä valmistellaan. Odota ennen Git-toimintojen käyttöä.",
  },
  partial: {
    label: "Osittainen yhteys",
    description:
      "GitHub-yhteys ei ole vielä kokonaan valmis. Git-toiminnot eivät välttämättä onnistu.",
  },
  unknown: {
    label: "Tilaa ei tiedetä",
    description: "GitHub-yhteyden tilaa ei juuri nyt voitu vahvistaa.",
  },
};
export function AccountSettings({
  editorIdentity,
  profile,
  name,
  nativeState,
  nativeLogin,
  onPiSignIn,
  modelSelector,
  onBack,
  onLogout,
  csrf,
  onDisconnect,
  onReconnect,
  onWorkspacesChanged,
  administration = false,
  routeSection,
  onNavigate,
}: {
  editorIdentity?: string;
  profile?: AccountProfile;
  name?: string;
  csrf?: string;
  onDisconnect?: () => void;
  /** Sign in with GitHub again; the sign-in replaces an expired gh login. */
  onReconnect?: () => void;
  /** A workspace came back from the Trash: read the snapshot again. */
  onWorkspacesChanged?: () => void;
  nativeState?: NativeState;
  nativeLogin?: string;
  onPiSignIn?: () => void;
  modelSelector?: React.ReactNode;
  onBack: () => void;
  onLogout?: () => void;
  administration?: boolean;
  routeSection?: string | null;
  onNavigate?: (path: string) => void;
}) {
  const theme = useThemeChoice();
  const person = profile ?? { name: name ?? "", email: "", avatar_url: "" };
  const state = states[nativeState ?? "unknown"];
  const [localSection, setLocalSection] = useState(
    administration ? "palvelin" : "tili",
  );
  const [localDetail, setLocalDetail] = useState(administration);
  const section = onNavigate ? (routeSection ?? "tili") : localSection;
  const detail = onNavigate ? routeSection != null : localDetail;
  const openSection = (id: string) => {
    if (onNavigate) onNavigate(settingsHref(id));
    else {
      setLocalSection(id);
      setLocalDetail(true);
    }
  };
  const [release, setRelease] = useState<
    Pick<ServerInfo, "version" | "commit">
  >({});
  // Each bundle check is also when the server may have been upgraded, with or
  // without a new bundle: read its version again.
  const [checks, setChecks] = useState(0);
  useEffect(() => {
    const next = () => setChecks((n) => n + 1);
    bundleChecks.addEventListener("checked", next);
    return () => bundleChecks.removeEventListener("checked", next);
  }, []);
  const [admin, setAdmin] = useState<boolean | null>();
  const [work, setWork] = useState(getWorkPreference);
  const [disconnectNotice, setDisconnectNotice] = useState(false);
  const [openAI, setOpenAI] = useState<OpenAIState>("checking");
  const heading = useRef<HTMLHeadingElement>(null);
  const navHeading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    void checks;
    const controller = new AbortController();
    void serverInfo(controller.signal)
      .then((info) => {
        if (!controller.signal.aborted) {
          setAdmin(info.administrator);
          setRelease({ version: info.version, commit: info.commit });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setAdmin(null);
      });
    return () => controller.abort();
  }, [checks]);
  useEffect(() => {
    void section;
    if (detail) heading.current?.focus();
    else navHeading.current?.focus();
  }, [section, detail]);
  const sections = [
    ["tili", "Tili"],
    ["laitteet", "Laitteet"],
    ["agentti", "Agentit"],
    ["yhteydet", "Yhteydet"],
    ["integraatiot", "Integraatiot"],
    ["ulkoasu", "Ulkoasu"],
    ["editori", "Editori"],
    ["tila", "Tallennustila"],
  ];
  const adminSections = [
    ["palvelin", "Palvelin"],
    // Not "Integraatiot": that is the person's own tab (Jari 24.10.2026).
    ["palvelinintegraatiot", "Palvelinintegraatiot"],
    ["aiavain", "AI-avain"],
    ["kayttoonotto", "Käyttöönotto"],
    ["kayttajat", "Käyttäjät ja pääsy"],
    ["levy", "Levytila"],
  ];
  const title = [...sections, ...adminSections].find(
    ([id]) => id === section,
  )?.[1];
  const sectionIcons: Record<string, IconName> = {
    tili: "user",
    laitteet: "devices",
    agentti: "agent",
    yhteydet: "link",
    integraatiot: "plug",
    ulkoasu: "eye",
    editori: "editor",
    tila: "disk",
    palvelin: "server",
    palvelinintegraatiot: "plug",
    aiavain: "key",
    // A turn on a route, not the chevron that marks a menu (Jari 24.10.2026).
    kayttoonotto: "steer",
    kayttajat: "users",
    levy: "disk",
  };
  const nav = (items: string[][]) =>
    items.map(([id, label]) => {
      const content = (
        <>
          <Icon name={sectionIcons[id]} />
          {label}
        </>
      );
      return onNavigate ? (
        <a
          className="s-nav-i"
          data-testid={`settings-${id}`}
          key={id}
          href={settingsHref(id)}
          aria-current={section === id ? "page" : undefined}
          onClick={(event) => {
            if (
              event.button ||
              event.metaKey ||
              event.ctrlKey ||
              event.shiftKey ||
              event.altKey
            )
              return;
            event.preventDefault();
            openSection(id);
          }}
        >
          {content}
        </a>
      ) : (
        <button
          type="button"
          className="s-nav-i"
          data-testid={`settings-${id}`}
          key={id}
          aria-current={section === id ? "page" : undefined}
          onClick={() => openSection(id)}
        >
          {content}
        </button>
      );
    });
  return (
    <section
      className={`ah-account-settings s-page${detail ? " detail" : ""}${
        // Käyttöönotto puts the route beside the step's settings.
        section === "kayttoonotto" && admin ? " wide" : ""
      }`}
    >
      <nav
        data-testid="settings-navigation"
        className="s-nav"
        aria-label="Asetusten osiot"
      >
        <Button
          data-testid="settings-back"
          label="Takaisin"
          variant="quiet"
          presentation="back"
          size="row"
          onPress={onBack}
        />
        <h1 data-testid="settings-title" ref={navHeading} tabIndex={-1}>
          Asetukset
        </h1>
        {nav(sections)}
        {admin && (
          <>
            <span className="s-nav-h">Palvelimen ylläpito</span>
            {nav(adminSections)}
          </>
        )}
      </nav>
      <div className="s-main">
        <ControlButton
          data-testid="settings-list-back"
          className="s-back"
          variant="quiet"
          size="row"
          presentation="back"
          onPress={() =>
            onNavigate ? onNavigate("/settings") : setLocalDetail(false)
          }
        >
          ← Asetukset
        </ControlButton>
        <h2
          ref={heading}
          data-testid={`settings-section-${section}`}
          tabIndex={-1}
        >
          {title}
        </h2>
        {section === "tili" && (
          <div className="s-card">
            <div className="s-row">
              <AccountIdentity profile={person} />
              <div className="s-val">
                {onLogout && (
                  <Button
                    data-testid="logout-open"
                    size="row"
                    label="Kirjaudu ulos…"
                    variant="secondary"
                    onPress={onLogout}
                  />
                )}
              </div>
            </div>
            <GitIdentity csrf={csrf} />
          </div>
        )}
        {section === "laitteet" && <Devices csrf={csrf} onLogout={onLogout} />}
        {section === "agentti" && (
          <div className="s-card">
            <div className="s-row">
              <div className="s-lbl">
                <strong>Kirjautumiset</strong>
                <span className="s-desc">
                  ChatGPT- ja Claude-tilaukset sekä API-avain ovat
                  Yhteydet-osiossa.
                </span>
              </div>
              <div className="s-val">
                <Button
                  data-testid="manage-credentials"
                  size="row"
                  label="Hallitse kirjautumisia"
                  variant="secondary"
                  onPress={() => openSection("yhteydet")}
                />
              </div>
            </div>
            <div className="s-model">
              <h3>Oletusmalli</h3>
              {modelSelector}
            </div>
            <div className="s-row">
              <div className="s-lbl">
                <strong>Agentin työ</strong>
                <span className="s-desc">
                  Ajattelu ja työkalut keskustelussa oletuksena.
                </span>
              </div>
              <Segmented
                label="Agentin työ"
                options={[
                  { id: "hidden", label: "Piilossa" },
                  { id: "visible", label: "Näkyvissä" },
                ]}
                value={work}
                onChange={(value) => {
                  setWork(value);
                  setWorkPreference(value);
                }}
              />
            </div>
          </div>
        )}
        {section === "yhteydet" && (
          <div className="s-card">
            <div className="s-row">
              <div className="s-lbl">
                <strong>GitHub</strong>
                <span className="s-desc">
                  {state.description} Selaimesta uloskirjautuminen ei poista
                  palvelimen valtuutusta.
                </span>
              </div>
              <div
                className="s-val"
                data-testid="github-native-state"
                data-state={nativeState ?? "unknown"}
              >
                <code>{nativeLogin}</code>
                <StatusMark
                  label={state.label}
                  kind={
                    nativeState === "connected"
                      ? "success"
                      : nativeState === "expired"
                        ? "error"
                        : "unknown"
                  }
                  tone={
                    nativeState === "connected"
                      ? "success"
                      : nativeState === "expired"
                        ? "danger"
                        : "warning"
                  }
                />
                {/* Every GitHub sign-in hands its token to the person's gh,
                    so the same sign-in also connects a missing login. */}
                {(nativeState === "expired" ||
                  nativeState === "disconnected") &&
                  onReconnect && (
                    <Button
                      size="row"
                      data-testid="github-reconnect"
                      label={
                        nativeState === "expired"
                          ? "Yhdistä GitHub uudelleen"
                          : "Yhdistä GitHub"
                      }
                      onPress={onReconnect}
                    />
                  )}
              </div>
              {csrf && nativeState === "connected" && (
                <div className="s-editor">
                  <NativeDisconnect
                    csrf={csrf}
                    onDisconnected={() => {
                      setDisconnectNotice(true);
                      onDisconnect?.();
                    }}
                  />
                </div>
              )}
              {disconnectNotice && (
                <p role="status">
                  Paikallinen gh-valtuutus poistettu. GitHubin OAuth-lupaa ei
                  peruttu.
                </p>
              )}
            </div>
            <div className="s-row">
              <div className="s-lbl">
                <strong>OpenAI (Pi)</strong>
                <span className="s-desc">
                  Käytä omaa ChatGPT-tilaustasi (Codex). Kirjautuminen tallentuu
                  vain omalle käyttäjällesi tällä palvelimella.
                </span>
              </div>
              <div className="s-val">
                <span data-testid="openai-credential-state" data-state={openAI}>
                  {openAI === "signed_in"
                    ? "ChatGPT-tilaus yhdistetty"
                    : openAI === "api_key"
                      ? "Käytössä OpenAI API-avain, ei ChatGPT-tilausta"
                      : openAI === "missing"
                        ? "ChatGPT-tilausta ei ole yhdistetty"
                        : openAI === "checking"
                          ? "Tarkistetaan OpenAI-kirjautumista"
                          : "OpenAI-kirjautumista ei voitu vahvistaa"}
                </span>
                {onPiSignIn && (
                  <Button
                    size="row"
                    data-testid="pi-sign-in"
                    label={
                      openAI === "signed_in"
                        ? "Kirjaudu ChatGPT:hen uudelleen"
                        : "Kirjaudu ChatGPT:hen"
                    }
                    variant="secondary"
                    onPress={onPiSignIn}
                  />
                )}
              </div>
            </div>
            <ClaudeSignIn csrf={csrf} />
            <PiCredentials csrf={csrf} onOpenAI={setOpenAI} />
          </div>
        )}
        {section === "integraatiot" && <IntegrationsSettings csrf={csrf} />}
        {section === "editori" && (
          <EditorSettings identity={editorIdentity} csrf={csrf} />
        )}
        {section === "ulkoasu" && (
          <div className="s-card">
            <div className="s-row ah-account-theme-row">
              <div className="s-lbl">
                <strong>Teema</strong>
                <span className="s-desc">
                  Järjestelmä seuraa laitteen asetusta. Koskee tätä selainta.
                </span>
              </div>
              <Segmented
                data-testid="theme-choice"
                label="Teema"
                options={(
                  [
                    { id: "system", label: "Järjestelmä", icon: "system" },
                    { id: "light", label: "Vaalea", icon: "sun" },
                    { id: "dark", label: "Tumma", icon: "moon" },
                  ] as const
                ).map((t) => ({ ...t, icon: <Icon name={t.icon} /> }))}
                value={theme}
                onChange={setThemeChoice}
              />
            </div>
          </div>
        )}
        {section === "tila" && (
          <PersonalStorage
            csrf={csrf}
            onWorkspacesChanged={onWorkspacesChanged}
          />
        )}
        {adminSections.some(([id]) => id === section) &&
          (admin && section === "kayttoonotto" ? (
            <OnboardingAdministration csrf={csrf} />
          ) : admin && section === "palvelinintegraatiot" ? (
            <div className="s-card ah-administration">
              <ServerIntegrationsSettings csrf={csrf} />
            </div>
          ) : admin && section === "aiavain" ? (
            <SiteKeyAdministration csrf={csrf} />
          ) : admin ? (
            <ServerAdministration
              csrf={csrf}
              section={section as "palvelin" | "kayttajat" | "levy"}
              version={release.version}
              commit={release.commit}
            />
          ) : admin === undefined ? (
            <p role="status" data-testid="administration-checking">
              Tarkistetaan ylläpito-oikeutta…
            </p>
          ) : (
            <p role="alert" data-testid="administration-denied">
              {admin === false
                ? "Ylläpito on vain ylläpitäjille."
                : "Ylläpito-oikeutta ei voitu vahvistaa."}
            </p>
          ))}
        {section === "palvelin" && admin ? null : (
          <ServerVersionLine
            version={release.version}
            commit={release.commit}
          />
        )}
      </div>
    </section>
  );
}

/** One confirmation for settings and the account menu; no native credential is revoked. */
export function AccountLogoutDialog({
  open,
  onClose,
  onConfirm,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <ModalOverlay
      isOpen={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
      className="ah-overlay"
      isDismissable
    >
      <Modal className="ah-modal ah-logout-modal">
        <AriaDialog
          data-testid="logout-dialog"
          className="ah-dialog"
          aria-label="Kirjaudutaanko ulos tästä selaimesta?"
        >
          <Heading slot="title">Kirjaudutaanko ulos tästä selaimesta?</Heading>
          <div className="ah-logout-effects">
            <div>
              <h3>Poistuu selaimesta</h3>
              <p>
                Selainistunto
                <br />
                Luonnokset
                <br />
                Luettu sisältö
              </p>
            </div>
            <div>
              <h3>Säilyy palvelimella</h3>
              <p>
                Työtilat
                <br />
                Palvelimen tunnukset
                <br />
                Agenttien käynnissä oleva työ
              </p>
            </div>
          </div>
          <div className="ah-dialog-actions">
            <Button
              data-testid="cancel"
              size="page"
              label="Peruuta"
              variant="secondary"
              onPress={onClose}
            />
            <Button
              data-testid="logout-confirm"
              size="page"
              label="Kirjaudu ulos"
              variant="danger"
              onPress={onConfirm}
            />
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
