import { useEffect, useRef, useState } from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import "./Settings.css";
import { bundleChecks } from "../app/bundleRelease";
import { ClaudeSignIn } from "../app/ClaudeSignIn";
import { GitIdentity } from "../app/GitIdentity";
import { PersonalStorage } from "../app/PersonalStorage";
import { PiCredentials } from "../app/PiCredentials";
import type { AccountProfile, PiState } from "../app/pi";
import { ServerAdministration } from "../app/ServerAdministration";
import { ServerVersionLine } from "../app/ServerVersion";
import { type ServerInfo, serverInfo } from "../app/serverAdministration";
import { getThemeChoice, setThemeChoice, type ThemeChoice } from "../theme";
import { getWorkPreference, setWorkPreference } from "../workPreference";
import { ControlButton } from "./ControlElements";
import { Icon, type IconName } from "./Icon";
import { NativeDisconnect } from "./NativeDisconnect";
import { Menu } from "./Overlays";
import { Button } from "./Primitives";
import { StatusMark } from "./Status";

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
  onSettings,
  onAdministration,
  onLogout,
}: {
  profile?: AccountProfile;
  name?: string;
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
        heading={<AccountIdentity profile={person} />}
        betweenItems={
          <>
            <div className="ah-account-menu-theme-row">
              <span>Teema</span>
              <fieldset className="ah-account-menu-theme" aria-label="Teema">
                {themes.map(({ id, label, icon }) => (
                  <span
                    key={id}
                    className="ah-account-theme-option"
                    title={label}
                  >
                    <ControlButton
                      variant="quiet"
                      size="micro"
                      type="button"
                      aria-label={label}
                      aria-pressed={theme === id}
                      onPress={() => setThemeChoice(id)}
                    >
                      <Icon name={icon} />
                    </ControlButton>
                  </span>
                ))}
              </fieldset>
            </div>
            <div className="ah-account-menu-theme-row">
              <span>Agentin työ</span>
              <fieldset
                className="ah-account-menu-theme ah-work-choice"
                aria-label="Agentin työ"
              >
                {(["hidden", "visible"] as const).map((choice) => (
                  <ControlButton
                    key={choice}
                    variant="quiet"
                    size="micro"
                    aria-pressed={workChoice === choice}
                    onPress={() => setWorkPreference(choice)}
                  >
                    {choice === "hidden" ? "Piilossa" : "Näkyvissä"}
                  </ControlButton>
                ))}
              </fieldset>
            </div>
          </>
        }
        popoverClassName="ah-account-menu"
        placement="top start"
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
  | "connected"
  | "disconnected"
  | "pending"
  | "partial"
  | "unknown";
const states: Record<NativeState, { label: string; description: string }> = {
  connected: {
    label: "Yhdistetty",
    description: "GitHub-yhteys toimii tällä hetkellä.",
  },
  disconnected: {
    label: "Ei yhdistetty",
    description:
      "GitHub-yhteyttä ei löytynyt. Git-toiminnot voivat vaatia uuden kirjautumisen.",
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
  profile,
  name,
  nativeState,
  nativeLogin,
  piState = "checking",
  onPiSignIn,
  modelSelector,
  onBack,
  onLogout,
  csrf,
  onDisconnect,
  administration = false,
}: {
  profile?: AccountProfile;
  name?: string;
  csrf?: string;
  onDisconnect?: () => void;
  nativeState?: NativeState;
  nativeLogin?: string;
  piState?: PiState | "checking" | "unavailable";
  onPiSignIn?: () => void;
  modelSelector?: React.ReactNode;
  onBack: () => void;
  onLogout?: () => void;
  administration?: boolean;
}) {
  const theme = useThemeChoice();
  const person = profile ?? { name: name ?? "", email: "", avatar_url: "" };
  const state = states[nativeState ?? "unknown"];
  const [section, setSection] = useState(administration ? "palvelin" : "tili");
  const [detail, setDetail] = useState(administration);
  useEffect(() => {
    const openConnections = () => {
      if (window.location.hash !== "#yhteydet") return;
      setSection("yhteydet");
      setDetail(true);
    };
    openConnections();
    window.addEventListener("hashchange", openConnections);
    return () => window.removeEventListener("hashchange", openConnections);
  }, []);
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
  const [admin, setAdmin] = useState(false);
  const [work, setWork] = useState(getWorkPreference);
  const [disconnectNotice, setDisconnectNotice] = useState(false);
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
      .catch(() => {});
    return () => controller.abort();
  }, [checks]);
  useEffect(() => {
    void section;
    if (detail) heading.current?.focus();
    else navHeading.current?.focus();
  }, [section, detail]);
  const sections = [
    ["tili", "Tili"],
    ["agentti", "Agentit"],
    ["yhteydet", "Yhteydet"],
    ["ulkoasu", "Ulkoasu"],
    ["tila", "Tallennustila"],
  ];
  const adminSections = [
    ["palvelin", "Palvelin"],
    ["kayttajat", "Käyttäjät"],
    ["levy", "Levytila"],
  ];
  const title = [...sections, ...adminSections].find(
    ([id]) => id === section,
  )?.[1];
  const sectionIcons: Record<string, IconName> = {
    tili: "user",
    agentti: "agent",
    yhteydet: "link",
    ulkoasu: "eye",
    tila: "disk",
    palvelin: "server",
    kayttajat: "users",
    levy: "disk",
  };
  const nav = (items: string[][]) =>
    items.map(([id, label]) => (
      <button
        type="button"
        className="s-nav-i"
        key={id}
        aria-current={section === id ? "page" : undefined}
        onClick={() => {
          setSection(id);
          setDetail(true);
        }}
      >
        <Icon name={sectionIcons[id]} />
        {label}
      </button>
    ));
  return (
    <section className={`ah-account-settings s-page${detail ? " detail" : ""}`}>
      <nav className="s-nav" aria-label="Asetusten osiot">
        <Button
          label="Takaisin"
          variant="quiet"
          presentation="back"
          size="compact"
          onPress={onBack}
        />
        <h1 ref={navHeading} tabIndex={-1}>
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
        <button
          className="s-back"
          type="button"
          onClick={() => setDetail(false)}
        >
          ← Asetukset
        </button>
        <h2 ref={heading} tabIndex={-1}>
          {title}
        </h2>
        {section === "tili" && (
          <div className="s-card">
            <div className="s-row">
              <AccountIdentity profile={person} />
              <div className="s-val">
                {onLogout && (
                  <Button
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
                  label="Hallitse kirjautumisia"
                  variant="secondary"
                  onPress={() => {
                    setSection("yhteydet");
                    setDetail(true);
                  }}
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
              <fieldset className="s-seg" aria-label="Agentin työ">
                {(["hidden", "visible"] as const).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={work === value}
                    onClick={() => {
                      setWork(value);
                      setWorkPreference(value);
                    }}
                  >
                    {value === "hidden" ? "Piilossa" : "Näkyvissä"}
                  </button>
                ))}
              </fieldset>
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
              <div className="s-val">
                <code>{nativeLogin}</code>
                <StatusMark
                  label={state.label}
                  kind={nativeState === "connected" ? "success" : "unknown"}
                  tone={nativeState === "connected" ? "success" : "warning"}
                />
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
                  Pi:n kirjautuminen tai API-avain tällä palvelimella. Tämä ei
                  vahvista käyttöoikeutta malliin.
                </span>
              </div>
              <div className="s-val">
                <span>
                  {piState === "usable"
                    ? "Pi-tunnukset käytettävissä"
                    : piState === "missing"
                      ? "Pi-kirjautuminen puuttuu"
                      : piState === "checking"
                        ? "Tarkistetaan Pi-tilaa"
                        : "Pi-tilaa ei voitu vahvistaa"}
                </span>
                {onPiSignIn && (
                  <Button
                    label={
                      piState === "missing"
                        ? "Kirjaudu Pi:hin"
                        : "Kirjaudu Pi:hin uudelleen"
                    }
                    variant="secondary"
                    onPress={onPiSignIn}
                  />
                )}
              </div>
            </div>
            <ClaudeSignIn csrf={csrf} />
            <PiCredentials csrf={csrf} />
          </div>
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
              <fieldset className="s-seg" aria-label="Teema">
                {(
                  [
                    { id: "system", label: "Järjestelmä", icon: "system" },
                    { id: "light", label: "Vaalea", icon: "sun" },
                    { id: "dark", label: "Tumma", icon: "moon" },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    aria-pressed={theme === t.id}
                    onClick={() => setThemeChoice(t.id)}
                  >
                    <Icon name={t.icon} />
                    {t.label}
                  </button>
                ))}
              </fieldset>
            </div>
          </div>
        )}
        {section === "tila" && (
          <div className="s-card">
            <PersonalStorage />
          </div>
        )}
        {adminSections.some(([id]) => id === section) &&
          (admin ? (
            <ServerAdministration
              csrf={csrf}
              section={section as "palvelin" | "kayttajat" | "levy"}
              version={release.version}
              commit={release.commit}
            />
          ) : (
            <p role="alert">Ylläpito on vain ylläpitäjille.</p>
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
            <Button label="Peruuta" variant="secondary" onPress={onClose} />
            <Button
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
