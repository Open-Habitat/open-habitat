import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { createPortal } from "react-dom";
import { AccountKeys } from "../app/AccountKeys";
import { AgentInstructionsSettings } from "../app/AgentInstructionsSettings";
import { useAISignIn } from "../app/AISignIn";
import {
  useExperimentalFeature,
  useSessionPreferences,
} from "../app/accountPreferences";
import { announceSignedIn } from "../app/aiSignIn";
import { EditorSettings } from "../app/EditorSettings";
import { ExperimentalFeatures } from "../app/ExperimentalFeatures";
import { OwnMachines } from "../app/OwnMachines";
import { serverSettingsText } from "../text/serverSettings";
import "./Settings.css";
import {
  nightHourLabel,
  type Silence,
  setDeviceMuted,
  silence,
  useDeviceNight,
  useDeviceSound,
} from "../app/attentionSound";
import { bundleChecks } from "../app/bundleRelease";
import { ClaudeSignIn } from "../app/ClaudeSignIn";
import {
  CodeHostSettings,
  type NativeState,
  type NativeUnknownReason,
} from "../app/CodeHostSettings";
import { Devices } from "../app/Devices";
import { GitIdentity } from "../app/GitIdentity";
import { IntegrationsSettings } from "../app/IntegrationsSettings";
import type { ProviderId } from "../app/integrations";
import { LanguageSettings } from "../app/LanguageSettings";
import { OnboardingAdministration } from "../app/OnboardingAdministration";
import { PersonalStorage } from "../app/PersonalStorage";
import {
  modelsLine,
  type OpenAIState,
  PiCredentials,
} from "../app/PiCredentials";
import { usePiModels } from "../app/PiModels";
import type { AccountProfile } from "../app/pi";
import { RecapSettingsSection } from "../app/RecapSettings";
import { ServerAdministration } from "../app/ServerAdministration";
import { ServerConversations } from "../app/ServerConversations";
import { ServerIntegrationsSettings } from "../app/ServerIntegrationsSettings";
import { ServerVersionLine } from "../app/ServerVersion";
import { SiteKeyAdministration } from "../app/SiteKeyAdministration";
import { SoundSettings } from "../app/SoundSettings";
import { SpeechKeyAdministration, SpeechSettings } from "../app/SpeechSettings";
import { type ServerInfo, serverInfo } from "../app/serverAdministration";
import {
  type SettingsHit,
  type SettingsRowId,
  searchSettings,
  settingsRowWithin,
  shownSettingsSections,
} from "../app/settingsIndex";
import { settingsHref } from "../app/settingsRoute";
import type { Workspace } from "../app/snapshot";
import { textNow, useLanguage, useText } from "../i18n";
import { accountText } from "../text/account";
import { attentionSoundText } from "../text/attentionSound";
import { getThemeChoice, setThemeChoice, type ThemeChoice } from "../theme";
import { getWorkPreference, setWorkPreference } from "../workPreference";
import { ChoiceMenu } from "./ChoiceMenu";
import { ControlButton, Segmented } from "./ControlElements";
import { DefaultModelRow } from "./DefaultModelRow";
import { useExplainEntry } from "./ExplainMode";
import { GeneralFeedback } from "./GeneralFeedback";
import { Icon } from "./Icon";
import { LetterMark } from "./Integrations";
import { Menu } from "./Overlays";
import { Button } from "./Primitives";
import {
  SettingsSearchField,
  SettingsSearchResults,
  settingsHitKey,
} from "./SettingsSearch";
import { StatusMark } from "./Status";
import { StatusBell } from "./StatusBell";

// Gitea and GitLab are code hosts: Koodipalvelut shows them beside GitHub.
const codeHosts: ProviderId[] = ["gitea", "gitlab"];

/** Provider subject numbers are not a useful person-facing name. */
export function accountLabel(displayName: string): string {
  const name = displayName.trim();
  return name && !/^GitHub user\s+\d+$/i.test(name) && !/^\d+$/.test(name)
    ? name
    : textNow(accountText).ownAccount;
}

export function AccountIdentity({
  profile,
  compact = false,
}: {
  profile: AccountProfile;
  compact?: boolean;
}) {
  const [failedURL, setFailedURL] = useState("");
  const t = useText(accountText);
  const name = accountLabel(profile.name);
  const shown = compact && name !== t.ownAccount ? name.split(/\s+/)[0] : name;
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
        ) : shown === t.ownAccount ? (
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
  const accountButton = useRef<HTMLButtonElement>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [workChoice, setWorkChoice] = useState(getWorkPreference);
  useEffect(() => {
    const sync = () => setWorkChoice(getWorkPreference());
    window.addEventListener("nah:work-change", sync);
    return () => window.removeEventListener("nah:work-change", sync);
  }, []);
  const t = useText(accountText);
  const soundText = useText(attentionSoundText);
  const explain = useExplainEntry();
  const soundsOn = useExperimentalFeature("attention-sound");
  const soundPreferences = useSessionPreferences();
  const deviceSound = useDeviceSound();
  const night = useDeviceNight(soundPreferences.sound);
  const soundStatus = silence({
    sound: soundPreferences.sound,
    muted: deviceSound.muted,
    night,
  });
  // A forgotten mute shows without opening anything; off and night are
  // standing choices and get no mark.
  const mutedMark = soundsOn && soundStatus === "muted";
  const person = profile ?? { name: name ?? "", email: "", avatar_url: "" };
  const compactName =
    accountLabel(person.name) === t.ownAccount
      ? t.ownAccount
      : accountLabel(person.name).split(/\s+/)[0];
  const themes: {
    id: ThemeChoice;
    label: string;
    icon: "system" | "sun" | "moon" | "contrast";
  }[] = [
    { id: "system", label: t.themeSystem, icon: "system" },
    { id: "light", label: t.themeLight, icon: "sun" },
    { id: "dark", label: t.themeDark, icon: "moon" },
    { id: "contrast", label: t.themeContrast, icon: "contrast" },
  ];
  return (
    <div className="ah-account-shelf" data-account-controls>
      <Menu
        label={t.accountMenu}
        buttonRef={accountButton}
        triggerLabel={
          mutedMark
            ? soundText.menuOf(
                t.accountMenuOf(compactName),
                soundText.stateMuted,
              )
            : t.accountMenuOf(compactName)
        }
        triggerPresentation="account"
        trigger={
          <span className="ah-account-trigger">
            <AccountIdentity profile={person} compact />
            {mutedMark ? (
              <span className="ah-sound-badge" data-testid="sound-muted-badge">
                <Speaker muted />
              </span>
            ) : null}
          </span>
        }
        heading={<AccountIdentity profile={person} />}
        betweenItems={
          <section className="ah-account-quick" aria-label={t.groupQuick}>
            <div className="ah-account-menu-theme-row">
              <span className="ah-account-row-label">
                <Icon
                  name={
                    themes.find((choice) => choice.id === theme)?.icon ??
                    "system"
                  }
                />
                {t.theme}
              </span>
              <Segmented
                data-testid="theme-choice"
                label={t.theme}
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
              <span className="ah-account-row-label">
                <Icon name="eye" />
                {t.agentWork}
              </span>
              <Segmented
                label={t.agentWork}
                className="ah-account-menu-theme"
                options={[
                  { id: "hidden", label: t.hidden },
                  { id: "visible", label: t.visible },
                ]}
                value={workChoice}
                onChange={setWorkPreference}
              />
            </div>
            {soundsOn ? (
              <SoundMenuRow
                status={soundStatus}
                nightEnd={soundPreferences.sound.night_end}
              />
            ) : null}
          </section>
        }
        popoverClassName="ah-account-menu"
        placement="top start"
        items={[
          {
            id: "settings",
            label: t.settings,
            icon: <Icon name="gear" />,
            section: t.groupPages,
          },
          ...(onAdministration
            ? [
                {
                  id: "administration",
                  label: t.administration,
                  icon: <Icon name="server" />,
                  section: t.groupPages,
                },
              ]
            : []),
          ...(explain
            ? [
                {
                  id: explain.id,
                  label: explain.label,
                  icon: (
                    <span className="ah-explain-q" aria-hidden="true">
                      ?
                    </span>
                  ),
                  section: t.groupHelp,
                },
              ]
            : []),
          {
            id: "feedback",
            label: t.feedback,
            icon: <Icon name="message" />,
            section: t.groupHelp,
          },
          {
            id: "logout",
            label: t.logout,
            icon: <Icon name="logout" />,
            danger: true,
          },
        ]}
        onAction={(id) => {
          if (id === "settings") onSettings();
          if (id === "explain") explain?.run();
          if (id === "feedback") setFeedbackOpen(true);
          if (id === "administration") onAdministration?.();
          if (id === "logout") onLogout();
        }}
      />
      {feedbackOpen
        ? createPortal(
            <GeneralFeedback
              anchor={accountButton}
              placement="above"
              onClose={() => setFeedbackOpen(false)}
            />,
            document.body,
          )
        : null}
    </div>
  );
}

/** A speaker in the icons' stroke; slashed when quiet. */
function Speaker({ muted }: { muted?: boolean }) {
  return (
    <svg
      className="ah-speaker"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z" />
      {muted ? (
        <path d="M10.5 6l3.5 4M14 6l-3.5 4" />
      ) : (
        <path d="M10.6 5.6a3.2 3.2 0 0 1 0 4.8M12.4 4a5.6 5.6 0 0 1 0 8" />
      )}
    </svg>
  );
}

/** Äänet in the account menu (attention-sound, experimental): this
 * device's Soi | Hiljaa, and under it what reaches this device now. The
 * row says before a press that Hiljaa is this device's alone. */
function SoundMenuRow({
  status,
  nightEnd,
}: {
  status: Silence | undefined;
  nightEnd: number;
}) {
  const t = useText(attentionSoundText);
  const deviceSound = useDeviceSound();
  const off = status === "off";
  const text =
    status === "off"
      ? t.stateOff
      : status === "muted"
        ? t.stateMuted
        : status === "night"
          ? t.stateNight(nightHourLabel(nightEnd))
          : t.menuScope;
  return (
    <div className="ah-sound-menu" data-testid="sound-menu-row">
      <div className="ah-account-menu-theme-row">
        <span className="ah-account-row-label">
          <Speaker muted={!!status} />
          {t.menuRow}
        </span>
        <Segmented
          data-testid="sound-menu-mute"
          label={`${t.menuRow}, ${t.menuScope}`}
          className="ah-account-menu-theme"
          isDisabled={off}
          options={[
            { id: "plays", label: t.plays },
            { id: "quiet", label: t.quiet },
          ]}
          value={deviceSound.muted ? "quiet" : "plays"}
          onChange={(v) => setDeviceMuted(v === "quiet")}
        />
      </div>
      <p
        className="ah-sound-state"
        data-testid="sound-menu-state"
        data-status={status ?? "plays"}
      >
        {status === "night" ? (
          <Icon name="moon" />
        ) : (
          <Speaker muted={!!status} />
        )}
        <span>
          {text}
          {off ? (
            <span className="ah-sound-why"> · {t.stateOffWhy}</span>
          ) : null}
        </span>
      </p>
    </div>
  );
}

/** A section and the row open in it, as one comparable value. */
const place = (id: string, row?: string) => `${id}#${row ?? ""}`;

/** Whether Esc belongs to what the person is typing in. */
function typedInto(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target instanceof HTMLInputElement)
    return ![
      "checkbox",
      "radio",
      "button",
      "submit",
      "reset",
      "range",
    ].includes(target.type);
  return (
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    !!target.closest("[role='textbox'], [role='combobox'], [role='searchbox']")
  );
}

export function AccountSettings({
  editorIdentity,
  profile,
  name,
  nativeState,
  nativeReason,
  nativeLogin,
  nativeScopes,
  onPiSignIn,
  modelSelector,
  onClose,
  onLogout,
  csrf,
  onDisconnect,
  onReconnect,
  onWorkspacesChanged,
  administration = false,
  routeSection,
  routeRow,
  onNavigate,
  workspaces,
  onNewWorkspace,
  onAskAgent,
}: {
  editorIdentity?: string;
  profile?: AccountProfile;
  name?: string;
  csrf?: string;
  onDisconnect?: () => void;
  /** Sign in with GitHub again; the sign-in replaces an expired gh login.
   * workflow asks for, or drops, the workflow scope; without it the app
   * keeps what the person has. */
  onReconnect?: (workflow?: boolean) => void;
  /** A workspace came back from the Trash: read the snapshot again. */
  onWorkspacesChanged?: () => void;
  nativeState?: NativeState;
  nativeReason?: NativeUnknownReason;
  nativeLogin?: string;
  /** The token's scopes with a working login: null when unread. */
  nativeScopes?: readonly string[] | null;
  onPiSignIn?: () => void;
  modelSelector?: React.ReactNode;
  /** Closes Settings: the X in the corner, or Esc outside a field. */
  onClose: () => void;
  onLogout?: () => void;
  administration?: boolean;
  routeSection?: string | null;
  /** The row a link named (the URL fragment): scrolled to and marked. */
  routeRow?: string;
  onNavigate?: (path: string, options?: { replace?: boolean }) => void;
  /** The snapshot's workspaces, for Koodipalvelut's imported list. */
  workspaces?: readonly Workspace[];
  onNewWorkspace?: () => void;
  /** Opens a new conversation in the workspace with text in its field,
   * unsent: Storage's clean-up request. */
  onAskAgent?: (workspaceId: string, text: string) => boolean;
}) {
  const theme = useThemeChoice();
  const language = useLanguage();
  const t = accountText[language];
  const instructionsOn = useExperimentalFeature("agent-instructions");
  const soundsOn = useExperimentalFeature("attention-sound");
  const serverText = useText(serverSettingsText);
  // A section of an experimental feature shows only while it is on.
  const settingsSections = shownSettingsSections(language).filter(
    (entry) => entry.id !== "aanet" || soundsOn,
  );
  const person = profile ?? { name: name ?? "", email: "", avatar_url: "" };
  const { data: piModels, refresh: refreshModels } = usePiModels();
  const [localSection, setLocalSection] = useState(
    administration ? "palvelin" : "tili",
  );
  const [localDetail, setLocalDetail] = useState(administration);
  const [localRow, setLocalRow] = useState<string>();
  const section = onNavigate ? (routeSection ?? "tili") : localSection;
  const detail = onNavigate ? routeSection != null : localDetail;
  const row = onNavigate ? routeRow : localRow;
  useEffect(() => {
    const folded = window.matchMedia("(max-width: 800px)");
    const preserveSection = (event: MediaQueryListEvent) => {
      // /settings shows Account beside the list on desktop. When that
      // visible section becomes a separate screen, give it its own route.
      // Entering /settings while already narrow still opens the list.
      if (!event.matches || detail) return;
      if (onNavigate) onNavigate(settingsHref(section), { replace: true });
      else setLocalDetail(true);
    };
    folded.addEventListener("change", preserveSection);
    return () => folded.removeEventListener("change", preserveSection);
  }, [detail, section, onNavigate]);
  /** The search opens results beside it as the selection moves: those
   * route changes move no focus out of the field. Typing outruns the route,
   * so this is one flag rather than the place last previewed. */
  const steering = useRef(false);
  const go = (
    id: string,
    target?: SettingsRowId,
    options?: { replace?: boolean },
  ) => {
    if (onNavigate) onNavigate(settingsHref(id, target), options);
    else {
      setLocalSection(id);
      setLocalDetail(true);
      setLocalRow(target);
    }
  };
  const openSection = (id: string) => {
    steering.current = false;
    go(id);
  };
  const toList = () =>
    onNavigate ? onNavigate("/settings") : setLocalDetail(false);
  const [release, setRelease] = useState<
    Partial<Pick<ServerInfo, "version" | "commit" | "name">>
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
  const [openAI, setOpenAI] = useState<OpenAIState>("checking");
  // A stored sign-in the provider refused is not "Kirjautunut".
  const aiRefused = useAISignIn().refused;
  const chatgptRefused =
    openAI === "signed_in" && aiRefused.includes("openai-codex");
  const heading = useRef<HTMLHeadingElement>(null);
  const navHeading = useRef<HTMLHeadingElement>(null);
  // Search (proto-settings-search, Sivupalkissa): while the field holds
  // text, its results stand in for the section list and the selected one is
  // open beside them.
  const [query, setQuery] = useState("");
  const [chosen, setSelected] = useState(0);
  const field = useRef<HTMLInputElement>(null);
  const searching = query.trim() !== "";
  // Keskustelut lives only in the server area, which is still experimental;
  // its route opens anyway, as the limit card's administrator link does.
  const listed = (hit: SettingsHit) =>
    hit.section !== "keskustelut" && (hit.section !== "aanet" || soundsOn);
  const hits = searching
    ? searchSettings(query, { admin: false }).filter(listed)
    : [];
  // The list can shrink under the selection (the administrator check).
  const selected = Math.max(0, Math.min(chosen, hits.length - 1));
  const queryRef = useRef(query);
  queryRef.current = query;
  /** Focus the field once the section list shows again (phone). */
  const fieldNext = useRef(false);
  // A chosen row that is already open lands again.
  const [landing, setLanding] = useState(0);
  // Match Settings.css: the folded layout shows list or section, not both.
  const narrow = () => window.matchMedia("(max-width: 800px)").matches;
  const preview = (hit: SettingsHit | undefined) => {
    if (!hit || narrow()) return;
    steering.current = true;
    // Compared with the URL, not the drawn section: the router draws a
    // navigation in a transition, which a loaded page holds back over
    // several arrow presses, and an arrow back to the place still drawn
    // would leave the preview where the route had already gone.
    const there = onNavigate
      ? `${window.location.pathname}${window.location.hash}` ===
        settingsHref(hit.section, hit.row)
      : place(section, detail ? row : undefined) ===
        place(hit.section, hit.row);
    if (!there) go(hit.section, hit.row, { replace: true });
  };
  const changeQuery = (next: string) => {
    setQuery(next);
    setSelected(0);
    if (!next.trim()) steering.current = false;
    else
      preview(
        searchSettings(next, {
          admin: false,
        }).filter(listed)[0],
      );
  };
  const choose = (index: number) => {
    const hit = hits[index];
    if (!hit) return;
    setSelected(index);
    steering.current = false;
    if (
      place(section, detail ? row : undefined) !== place(hit.section, hit.row)
    )
      go(hit.section, hit.row, narrow() ? undefined : { replace: true });
    else if (hit.row) setLanding((n) => n + 1);
    else heading.current?.focus();
  };
  const searchKeys = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.nativeEvent.isComposing) return;
    if (event.key === "Escape") {
      // Esc empties the search first and closes Settings only when empty.
      event.preventDefault();
      if (query) changeQuery("");
      else onClose();
    } else if (
      (event.key === "ArrowDown" || event.key === "ArrowUp") &&
      hits.length
    ) {
      event.preventDefault();
      const next =
        (selected + (event.key === "ArrowDown" ? 1 : hits.length - 1)) %
        hits.length;
      setSelected(next);
      preview(hits[next]);
      document
        .getElementById(`settings-search-results-${settingsHitKey(hits[next])}`)
        ?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter" && searching) {
      event.preventDefault();
      choose(selected);
    }
  };
  useEffect(() => {
    void checks;
    const controller = new AbortController();
    void serverInfo(controller.signal)
      .then((info) => {
        if (!controller.signal.aborted) {
          setAdmin(info.administrator);
          setRelease({
            version: info.version,
            commit: info.commit,
            name: info.name,
          });
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setAdmin(null);
      });
    return () => controller.abort();
  }, [checks]);
  useEffect(() => {
    void section;
    if (fieldNext.current && !detail) {
      fieldNext.current = false;
      field.current?.focus();
    } else if (steering.current) return;
    else if (detail) heading.current?.focus();
    else navHeading.current?.focus();
  }, [section, detail]);
  const main = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const keysRef = useRef({ detail, toList });
  keysRef.current = { detail, toList };
  useEffect(() => {
    const close = (event: globalThis.KeyboardEvent) => {
      const slash = event.key === "/" && !event.ctrlKey && !event.metaKey;
      if (
        (event.key !== "Escape" && !slash) ||
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey
      )
        return;
      // A field, a dialog, a menu or the phone's navigation keeps its keys;
      // the view kept under Settings has none of them open for the person.
      // The search's own results are not such a list.
      if (
        typedInto(event.target) ||
        [
          ...document.querySelectorAll(
            "[aria-modal='true'], [role='dialog']:not([hidden]), [role='menu'], [role='listbox']:not([hidden]):not(#settings-search-results), .ah-mobile-open",
          ),
        ].some((open) => !open.closest("[data-under-settings]"))
      )
        return;
      event.preventDefault();
      if (slash) {
        // "/" finds a setting from anywhere in Settings; on the phone the
        // field is on the section list.
        if (field.current && (field.current.checkVisibility?.() ?? true))
          field.current.focus();
        else if (keysRef.current.detail) {
          fieldNext.current = true;
          keysRef.current.toList();
        }
      } else if (queryRef.current) {
        setQuery("");
        setSelected(0);
        steering.current = false;
      } else closeRef.current();
    };
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, []);
  // A link to a row (the model selector's Claude link, the new-workspace
  // page's Gitea error, …) lands on it: the row is scrolled into view, takes
  // focus and is marked for a moment. Rows read by the daemon appear later,
  // so the page waits for the row a short while.
  // A search's preview lands the same way without taking focus from the
  // field. A row folded away (Oma's numbers) lands on the row that holds it.
  useEffect(() => {
    void section;
    void landing;
    if (!detail || !row) return;
    const focus = !steering.current;
    const within = settingsRowWithin(row);
    const find = (id: string) =>
      main.current?.querySelector<HTMLElement>(
        `[data-settings-row="${CSS.escape(id)}"]`,
      );
    let tries = 0;
    let target: HTMLElement | null | undefined;
    let unmark: number | undefined;
    const timer = window.setInterval(() => {
      target = find(row) ?? (within ? find(within) : undefined);
      if (!target && ++tries < 50) return;
      window.clearInterval(timer);
      if (!target) return;
      const landed = target;
      landed.scrollIntoView({ block: "center" });
      if (focus) landed.focus({ preventScroll: true });
      landed.dataset.landed = "";
      unmark = window.setTimeout(() => delete landed.dataset.landed, 2400);
    }, 100);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(unmark);
      if (target) delete target.dataset.landed;
    };
  }, [section, detail, row, landing]);
  // While a search is open, its matching rows in the open section keep a
  // quiet mark; rows that arrive later from the daemon get it too.
  const hitRows = hits
    .filter((hit) => hit.section === section && hit.row)
    .map((hit) => hit.row as string)
    .join(" ");
  useEffect(() => {
    const root = main.current;
    if (!root || !hitRows) return;
    const ids = new Set(hitRows.split(" "));
    const mark = () => {
      for (const el of root.querySelectorAll<HTMLElement>(
        "[data-settings-row]",
      ))
        if (ids.has(el.dataset.settingsRow ?? "")) el.dataset.hit = "";
        else delete el.dataset.hit;
    };
    mark();
    const observer = new MutationObserver(mark);
    observer.observe(root, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      for (const el of root.querySelectorAll<HTMLElement>("[data-hit]"))
        delete el.dataset.hit;
    };
  }, [hitRows]);
  const sections = settingsSections.filter((entry) => !("admin" in entry));
  const adminSections = settingsSections.filter((entry) => "admin" in entry);
  const adminLinks = adminSections;
  const inServerArea =
    detail && admin === true && adminSections.some(({ id }) => id === section);
  const sectionLabel = (id: string, label: string) =>
    inServerArea
      ? id === "palvelin"
        ? serverText.general
        : id === "palvelinintegraatiot"
          ? serverText.integrations
          : label
      : label;
  const serverLinks = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (inServerArea)
      serverLinks.current
        ?.querySelector<HTMLElement>(`[data-testid="settings-${section}"]`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [inServerArea, section]);
  const selectedSection = settingsSections.find(({ id }) => id === section);
  const title = selectedSection && sectionLabel(section, selectedSection.label);
  const nav = (items: typeof settingsSections) =>
    items.map(({ id, label, icon }) => {
      const content = (
        <>
          <Icon name={icon} />
          {sectionLabel(id, label)}
          {!inServerArea && id === "palvelin" && <Icon name="forward" />}
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
      // "/" finds a setting here; the switcher leaves the key to this page.
      data-owns-slash=""
      className={`ah-account-settings s-page${inServerArea ? " s-server-area" : ""}${detail ? " detail" : ""}${
        // Käyttöönotto puts the route beside the step's settings.
        section === "kayttoonotto" && admin ? " wide" : ""
      }`}
    >
      {/* Between the phone and the widest screens the app rail, and the
          bell in its head, give Settings their room (Settings.css). */}
      <span className="s-bell">
        <StatusBell />
      </span>
      <ControlButton
        data-testid="settings-close"
        className="s-close"
        size="row"
        variant="quiet"
        presentation="icon"
        aria-label={t.closeSettings}
        onPress={onClose}
      >
        <Icon name="cross" />
      </ControlButton>
      <nav
        data-testid="settings-navigation"
        className="s-nav"
        aria-label={inServerArea ? t.administration : t.sections}
      >
        {inServerArea && (
          <ControlButton
            data-testid="settings-own-back"
            className="s-own-back"
            variant="quiet"
            size="row"
            presentation="back"
            onPress={() => {
              setQuery("");
              if (narrow()) toList();
              else openSection("tili");
            }}
          >
            <Icon name="back" />
            {serverText.ownSettings}
          </ControlButton>
        )}
        <h1 data-testid="settings-title" ref={navHeading} tabIndex={-1}>
          {inServerArea ? t.administration : t.settings}
        </h1>
        {inServerArea ? (
          <>
            <p className="s-desc">
              {release.name ? `${release.name} · ` : ""}
              {serverText.affectsEveryone}
            </p>
            <div
              ref={serverLinks}
              className="s-server-links"
              data-testid="server-section-links"
            >
              {nav(adminLinks)}
            </div>
          </>
        ) : (
          <>
            <SettingsSearchField
              inputRef={field}
              query={query}
              hits={hits}
              selected={selected}
              onQuery={changeQuery}
              onKeyDown={searchKeys}
            />
            {searching ? (
              <SettingsSearchResults
                query={query}
                hits={hits}
                selected={selected}
                onPick={choose}
              />
            ) : (
              <>
                {nav(sections)}
                {admin && (
                  <>
                    <span className="s-nav-h">{t.administration}</span>
                    {nav(
                      settingsSections
                        .filter(({ id }) => id === "palvelin")
                        .map((entry) => ({
                          ...entry,
                          label: t.administration,
                        })),
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}
      </nav>
      <div className="s-main" ref={main} data-settings-page={section}>
        {!inServerArea && (
          <ControlButton
            data-testid="settings-list-back"
            className="s-back"
            variant="quiet"
            size="row"
            presentation="back"
            onPress={toList}
          >
            {searching ? t.backToResults : t.backToSettings}
          </ControlButton>
        )}
        <h2
          ref={heading}
          data-testid={`settings-section-${section}`}
          tabIndex={-1}
        >
          {title}
        </h2>
        {section === "tili" && (
          <div className="s-card">
            <div className="s-row" data-settings-row="account" tabIndex={-1}>
              <AccountIdentity profile={person} />
              <div className="s-val">
                {onLogout && (
                  <Button
                    data-testid="logout-open"
                    size="row"
                    label={t.logout}
                    variant="secondary"
                    onPress={onLogout}
                  />
                )}
              </div>
            </div>
            <GitIdentity csrf={csrf} />
          </div>
        )}
        {section === "tili" && instructionsOn && (
          <>
            <h3 className="s-h3">{t.agentInstructions}</h3>
            <div className="s-card">
              <AgentInstructionsSettings
                csrf={csrf}
                name={person?.name ?? ""}
              />
            </div>
          </>
        )}
        {section === "laitteet" && <Devices csrf={csrf} onLogout={onLogout} />}
        {section === "avaimet" && <AccountKeys csrf={csrf} />}
        {section === "omatkoneet" && <OwnMachines csrf={csrf} />}
        {section === "tekoaly" && (
          <div className="s-stack">
            <p className="s-intro">{t.aiIntro}</p>
            <div className="s-card">
              <DefaultModelRow
                provider={piModels?.default_provider}
                model={piModels?.default_model}
                thinking={piModels?.default_thinking}
                models={piModels?.models}
                loading={!piModels}
              >
                {modelSelector}
              </DefaultModelRow>
              <div
                className="s-row"
                data-settings-row="agent-work"
                tabIndex={-1}
              >
                <div className="s-lbl">
                  <strong>{t.agentWork}</strong>
                  <span className="s-desc">{t.agentWorkDesc}</span>
                </div>
                <div className="s-val">
                  <Segmented
                    size="row"
                    label={t.agentWork}
                    options={[
                      { id: "hidden", label: t.hidden },
                      { id: "visible", label: t.visible },
                    ]}
                    value={work}
                    onChange={(value) => {
                      setWork(value);
                      setWorkPreference(value);
                    }}
                  />
                </div>
              </div>
            </div>
            <h3 className="s-h3">{t.subscriptions}</h3>
            <div className="s-card">
              <div
                className="s-row s-marked"
                data-settings-row="chatgpt"
                tabIndex={-1}
              >
                <LetterMark mark="Ch" tone={1} />
                <div className="s-lbl">
                  <strong>{t.chatgpt}</strong>
                  <span
                    className="s-desc"
                    data-testid="openai-credential-state"
                    data-state={openAI}
                  >
                    {chatgptRefused
                      ? t.chatgptRefused
                      : openAI === "signed_in"
                        ? t.chatgptSignedIn(
                            modelsLine(piModels?.models, "openai-codex"),
                          )
                        : openAI === "checking"
                          ? t.chatgptChecking
                          : openAI === "unknown"
                            ? t.chatgptUnknown
                            : t.chatgptSignedOut}
                  </span>
                </div>
                <div className="s-val">
                  {chatgptRefused ? (
                    <StatusMark
                      data-testid="chatgpt-refused"
                      kind="error"
                      tone="danger"
                      label={t.refused}
                    />
                  ) : openAI === "signed_in" ? (
                    <StatusMark
                      kind="success"
                      tone="success"
                      label={t.signedIn}
                    />
                  ) : null}
                  {onPiSignIn && (
                    <Button
                      size="row"
                      data-testid="pi-sign-in"
                      label={
                        openAI === "signed_in" ? t.signInAgain : t.signInChatgpt
                      }
                      variant="secondary"
                      onPress={onPiSignIn}
                    />
                  )}
                </div>
              </div>
              <ClaudeSignIn
                csrf={csrf}
                onSignedIn={() => {
                  refreshModels();
                  announceSignedIn("claude-bridge");
                }}
                refused={aiRefused.includes("claude-bridge")}
              />
            </div>
            {/* A provider's first key makes its model Pi's default: the
                selector above reads Pi again after every key change. */}
            <PiCredentials
              csrf={csrf}
              onOpenAI={setOpenAI}
              onSaved={refreshModels}
            />
          </div>
        )}
        {section === "koodipalvelut" && (
          <CodeHostSettings
            identity={editorIdentity}
            csrf={csrf}
            nativeState={nativeState}
            nativeReason={nativeReason}
            nativeLogin={nativeLogin}
            nativeScopes={nativeScopes}
            onReconnect={onReconnect}
            onDisconnect={onDisconnect}
            workspaces={workspaces}
            onNewWorkspace={onNewWorkspace}
          />
        )}
        {section === "tiedot" && (
          <IntegrationsSettings csrf={csrf} except={codeHosts} />
        )}
        {section === "tilannekatsaus" && <RecapSettingsSection csrf={csrf} />}
        {section === "sanelu" && <SpeechSettings csrf={csrf} />}
        {section === "editori" && (
          <EditorSettings identity={editorIdentity} csrf={csrf} />
        )}
        {section === "kokeelliset" && (
          <ExperimentalFeatures identity={editorIdentity} csrf={csrf} />
        )}
        {section === "aanet" && soundsOn && (
          <SoundSettings
            identity={editorIdentity}
            csrf={csrf}
            workspaces={workspaces}
          />
        )}
        {section === "ulkoasu" && (
          <div className="s-card">
            <div
              className="s-row ah-account-theme-row"
              data-settings-row="theme"
              tabIndex={-1}
            >
              <div className="s-lbl">
                <strong>{t.theme}</strong>
                <span className="s-desc">{t.themeDesc}</span>
              </div>
              <div className="s-val">
                <ChoiceMenu
                  data-testid="theme-choice"
                  label={t.theme}
                  options={[
                    { id: "system", label: t.themeSystem },
                    { id: "light", label: t.themeLight },
                    { id: "dark", label: t.themeDark },
                    { id: "contrast", label: t.themeContrast },
                  ]}
                  value={theme}
                  onChange={setThemeChoice}
                />
              </div>
            </div>
            <LanguageSettings identity={editorIdentity} csrf={csrf} />
          </div>
        )}
        {section === "tila" && (
          <PersonalStorage
            csrf={csrf}
            onWorkspacesChanged={onWorkspacesChanged}
            workspaces={workspaces?.filter((w) => !w.place)}
            onAskAgent={onAskAgent}
          />
        )}
        {adminSections.some(({ id }) => id === section) &&
          (admin && section === "kayttoonotto" ? (
            <OnboardingAdministration
              csrf={csrf}
              nativeState={nativeState}
              onReconnect={onReconnect}
            />
          ) : admin && section === "palvelinintegraatiot" ? (
            <ServerIntegrationsSettings csrf={csrf} />
          ) : admin && section === "keskustelut" ? (
            <ServerConversations csrf={csrf} />
          ) : admin && section === "aiavain" ? (
            <SiteKeyAdministration csrf={csrf} />
          ) : admin && section === "saneluavain" ? (
            <SpeechKeyAdministration csrf={csrf} />
          ) : admin ? (
            <ServerAdministration
              csrf={csrf}
              section={section as "palvelin" | "kayttajat" | "levy"}
              version={release.version}
              commit={release.commit}
            />
          ) : admin === undefined ? (
            <p role="status" data-testid="administration-checking">
              {t.checkingAdmin}
            </p>
          ) : (
            <p role="alert" data-testid="administration-denied">
              {admin === false ? t.adminOnly : t.adminUnknown}
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
  const t = useText(accountText);
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
          aria-label={t.logoutQuestion}
        >
          <Heading slot="title">{t.logoutQuestion}</Heading>
          <div className="ah-logout-effects">
            <div>
              <h3>{t.leavesBrowser}</h3>
              <p>
                {t.browserSession}
                <br />
                {t.drafts}
                <br />
                {t.readContent}
              </p>
            </div>
            <div>
              <h3>{t.staysOnServer}</h3>
              <p>
                {t.workspaces}
                <br />
                {t.serverCredentials}
                <br />
                {t.runningWork}
              </p>
            </div>
          </div>
          <div className="ah-dialog-actions">
            <Button
              data-testid="cancel"
              size="page"
              label={t.cancel}
              variant="secondary"
              onPress={onClose}
            />
            <Button
              data-testid="logout-confirm"
              size="page"
              label={t.logoutConfirm}
              variant="danger"
              onPress={onConfirm}
            />
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}
