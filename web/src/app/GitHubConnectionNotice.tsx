import { ControlButton } from "../components/ControlElements";
import { Icon } from "../components/Icon";
import { WarningBanner } from "../components/WarningBanner";
import type { GitHubRecovery, GitHubWarning } from "./githubConnection";

/** The person's GitHub connection in the common warning: above the composer
 * in a conversation, or as the app-wide strip elsewhere. A confirmation
 * takes its place for a moment once the connection works again. */
export function GitHubConnectionNotice({
  warning,
  recovery,
  placement,
  onReconnect,
}: {
  warning?: GitHubWarning;
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
        onReconnect ? (
          <ControlButton
            data-testid="github-connection-fix"
            size="row"
            variant="primary"
            onPress={onReconnect}
          >
            <Icon name="github" width={14} height={14} />
            {warning.fix}
          </ControlButton>
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
        warning && onReconnect ? (
          <ControlButton
            data-testid="github-place-fix"
            size="row"
            variant="primary"
            onPress={onReconnect}
          >
            <Icon name="github" width={14} height={14} />
            {warning.fix}
          </ControlButton>
        ) : null
      }
    >
      {warning?.place ??
        "Palvelin ei juuri nyt saanut GitHubista vastausta tunnuksillasi. Se tarkistaa yhteyden uudelleen itse; yritä hetken päästä."}
      {also ? ` ${also}` : ""}
    </WarningBanner>
  );
}
