import { ControlButton, controlClassName } from "../components/ControlElements";
import { Icon } from "../components/Icon";
import { WarningBanner } from "../components/WarningBanner";
import type {
  GitHubProgress,
  GitHubRecovery,
  GitHubWarning,
} from "./githubConnection";

function repairable(warning: GitHubWarning, onReconnect?: () => void) {
  return !!warning.fix && (!!warning.href || !!onReconnect);
}

/** The warning's one repair: a page on GitHub, or the reconnect. */
function Repair({
  warning,
  onReconnect,
  testId,
}: {
  warning: GitHubWarning;
  onReconnect?: () => void;
  testId: string;
}) {
  if (warning.href && warning.fix)
    return (
      // A page on GitHub, styled as the warning's button rather than as
      // an inline link.
      <a
        data-testid={testId}
        href={warning.href}
        target="_blank"
        rel="noopener noreferrer"
        referrerPolicy="no-referrer"
        className={controlClassName({
          variant: "primary",
          size: "row",
          text: true,
        })}
      >
        <Icon name="github" width={14} height={14} />
        {warning.fix}
      </a>
    );
  if (!warning.fix || !onReconnect) return null;
  return (
    <ControlButton
      data-testid={testId}
      size="row"
      variant="primary"
      onPress={onReconnect}
    >
      <Icon name="github" width={14} height={14} />
      {warning.fix}
    </ControlButton>
  );
}

/** The person's GitHub connection in the common warning: above the composer
 * in a conversation, or as the app-wide strip elsewhere. A confirmation
 * takes its place for a moment once the connection works again. */
export function GitHubConnectionNotice({
  warning,
  progress,
  recovery,
  placement,
  onReconnect,
}: {
  warning?: GitHubWarning;
  /** The host's own attempt, shown while there is no settled warning. */
  progress?: GitHubProgress;
  recovery?: GitHubRecovery;
  placement: "inline" | "page";
  onReconnect?: () => void;
}) {
  if (recovery)
    return (
      <WarningBanner
        data-testid="github-connection-ok"
        data-state={recovery.kind}
        tone="success"
        placement={placement}
      >
        {recovery.kind === "reconnected"
          ? `GitHub yhdistetty${recovery.login ? ` käyttäjänä ${recovery.login}` : ""}. ${placement === "inline" ? "Pyydä agenttia yrittämään uudelleen." : "Push ja gh toimivat taas."}`
          : "GitHub-yhteys palasi."}
      </WarningBanner>
    );
  if (!warning && progress)
    return (
      <WarningBanner
        data-testid="github-connection-progress"
        data-state={progress.kind}
        tone="progress"
        placement={placement}
      >
        {progress.kind === "verifying"
          ? "GitHub hylkäsi valtuutuksen · tarkistetaan uudelleen…"
          : `GitHub ei vastannut · yritetään uudelleen… (${progress.attempt}/${progress.attempts})`}
      </WarningBanner>
    );
  if (!warning) return null;
  return (
    <WarningBanner
      data-testid="github-connection-warning"
      data-state={warning.fault}
      tone={warning.tone}
      icon="warning"
      title={warning.title}
      short={warning.short}
      placement={placement}
      actions={
        repairable(warning, onReconnect) ? (
          <Repair
            warning={warning}
            onReconnect={onReconnect}
            testId="github-connection-fix"
          />
        ) : null
      }
    >
      {warning.text}
    </WarningBanner>
  );
}

/** Where GitHub is needed right now (a repository finder): why it cannot
 * be asked, and the repair. Without a known fault the connection could
 * still not be used; then the host's own recheck is all there is. */
export function GitHubPlaceNotice({
  warning,
  onReconnect,
  also,
}: {
  warning?: GitHubWarning;
  onReconnect?: () => void;
  /** What still works here, after the cause. */
  also?: string;
}) {
  return (
    <WarningBanner
      data-testid="github-place-warning"
      data-state={warning?.fault ?? "unavailable"}
      tone={warning?.tone ?? "neutral"}
      icon={warning ? "warning" : "info"}
      title={warning?.title ?? "GitHub-yhteyttä ei voitu käyttää"}
      actions={
        warning && repairable(warning, onReconnect) ? (
          <Repair
            warning={warning}
            onReconnect={onReconnect}
            testId="github-place-fix"
          />
        ) : null
      }
    >
      {warning?.place ??
        "Palvelin ei juuri nyt saanut GitHubista vastausta tunnuksillasi. Se tarkistaa yhteyden uudelleen itse; yritä hetken päästä."}
      {also ? ` ${also}` : ""}
    </WarningBanner>
  );
}
