import { useEffect, useRef, useState } from "react";
import type { LookupView } from "../components/ClonePage";
import { liveText } from "../i18n";
import { githubText } from "../text/github";
import type { NativeState } from "./CodeHostSettings";
import type { Lookup } from "./github";

const txt = liveText(githubText);

// What the browser says about the person's own GitHub connection, read from
// the snapshot's native_github (proto-github-connection-warning, round 2,
// direction 2). The host rechecks that state by itself, so a warning appears
// only for a settled fault, and it leaves by itself once the snapshot says
// the connection works.
//
// The daemon tells an outage apart (unreachable) and retries it by itself:
// while it does, a one-line progress says so; once the retry is over the
// outage is a warning with nothing to press. A first rejection is verified
// before it is called expired. An organisation that keeps the app out is
// said only where its repositories are worked on.

export type GitHubFault =
  | "expired"
  | "disconnected"
  | "unreachable"
  | "org_oauth_app"
  | "org_saml";

export type GitHubWarning = {
  fault: GitHubFault;
  tone: "danger" | "neutral";
  title: string;
  /** Where GitHub is used anyway: the conversation and the app-wide strip. */
  text: string;
  short: string;
  /** Where GitHub is needed right now: the repository finders. */
  place: string;
  /** The one repair: a reconnect, or a page on GitHub (href). None when
   * the host repairs it by itself. */
  fix?: string;
  href?: string;
};

export type GitHubRetry = {
  attempt: number;
  attempts: number;
  since: string;
  next_at: string;
};

export type GitHubRestriction = {
  owner: string;
  restriction: "oauth_app" | "saml";
};

/** What the host is doing about the connection right now. */
export type GitHubProgress =
  | { kind: "verifying" }
  | { kind: "retrying"; attempt: number; attempts: number };

const warnings = new Proxy(
  {} as Record<"expired" | "disconnected" | "unreachable", GitHubWarning>,
  {
    get: (_target, fault: "expired" | "disconnected" | "unreachable") =>
      fault === "expired"
        ? { fault, tone: "danger", ...txt.expired }
        : fault === "disconnected"
          ? { fault, tone: "neutral", ...txt.disconnected }
          : fault === "unreachable"
            ? { fault, tone: "neutral", ...txt.unreachable }
            : undefined,
  },
);

/** The settled fault behind a state, if there is one to tell. An outage
 * is one only once the host's own retry is over. */
export function githubFault(
  state?: NativeState,
  retry?: GitHubRetry,
): GitHubWarning | undefined {
  if (state === "expired" || state === "disconnected") return warnings[state];
  if (state === "unreachable" && retry && retry.attempt >= retry.attempts)
    return warnings.unreachable;
  return undefined;
}

/** The host's own attempt in progress: the second check of a rejection, or
 * the retry of an outage before it becomes a warning. */
export function githubProgress(
  state?: NativeState,
  retry?: GitHubRetry,
): GitHubProgress | undefined {
  if (state === "verifying") return { kind: "verifying" };
  if (state === "unreachable" && retry && retry.attempt < retry.attempts)
    return {
      kind: "retrying",
      attempt: retry.attempt,
      attempts: retry.attempts,
    };
  return undefined;
}

/** The restriction of the organisation that owns repo ("owner/name"), as
 * the warning where that repository is worked on. */
export function githubOrgFault(
  restricted: readonly GitHubRestriction[] | undefined,
  repo: string | undefined,
): GitHubWarning | undefined {
  const owner = repo?.split("/")[0]?.toLowerCase();
  const found = owner
    ? restricted?.find((r) => r.owner.toLowerCase() === owner)
    : undefined;
  return found ? orgWarning(found.owner, found.restriction) : undefined;
}

/** A lookup's answer as the finders show it: GitHub's refusal for the
 * repository's organisation says why and what lifts it. */
export function lookupView(name: string, r: Lookup): LookupView {
  if (r.state === "restricted")
    return {
      state: "restricted",
      name,
      reason: orgWarning(name.split("/")[0], r.restriction).place,
    };
  return { state: "not_found", name };
}

/** What an organisation's restriction means and how it is lifted. */
export function orgWarning(
  owner: string,
  restriction: GitHubRestriction["restriction"],
): GitHubWarning {
  return restriction === "oauth_app"
    ? {
        fault: "org_oauth_app",
        tone: "neutral",
        title: txt.oauthTitle(owner),
        text: txt.oauthText(owner),
        short: txt.oauthShort(owner),
        place: txt.oauthPlace(owner),
        fix: txt.oauthFix,
        href: "https://github.com/settings/applications",
      }
    : {
        fault: "org_saml",
        tone: "neutral",
        title: txt.samlTitle(owner),
        text: txt.samlText(owner),
        short: txt.samlShort(owner),
        place: txt.samlPlace(owner),
        fix: txt.reconnect,
      };
}

/** Whether a fault concerns a place that is not itself about GitHub. A
 * GitHub sign-in that lost its gh login is broken everywhere; a person who
 * signed in with Google and never connected GitHub hears about it only
 * where GitHub is used: a workspace cloned from GitHub, or a repo finder. */
export function concerns(
  warning: GitHubWarning | undefined,
  where: { provider?: "github" | "google"; githubWorkspace?: boolean },
): warning is GitHubWarning {
  if (!warning) return false;
  // Only a person with a gh login can have it rejected or unanswered.
  return (
    warning.fault !== "disconnected" ||
    where.provider === "github" ||
    !!where.githubWorkspace
  );
}

// The reconnect leaves the page for GitHub and comes back to it. The tab
// remembers that it went, so that the page it returns to can say the
// connection works again (or keep the warning, if it still does not). The
// gateway returns only to a known path: a conversation's query, or a page
// such as Uusi työtila that is not a return path, is remembered here and
// restored once, onto exactly the path the gateway was asked to return to.
const reconnectKey = "oh.github-reconnect";
// A round trip that took longer than this is not the one just made.
const roundTrip = 10 * 60_000;
type Mark = { at: number; route: string; returnTo: string; restored?: true };
function readMark(): Mark | undefined {
  try {
    const value = JSON.parse(sessionStorage.getItem(reconnectKey) ?? "null");
    return typeof value?.at === "number" &&
      typeof value?.route === "string" &&
      typeof value?.returnTo === "string" &&
      Date.now() - value.at < roundTrip
      ? value
      : undefined;
  } catch {
    return undefined;
  }
}
function writeMark(mark: Mark | undefined) {
  try {
    if (mark) sessionStorage.setItem(reconnectKey, JSON.stringify(mark));
    else sessionStorage.removeItem(reconnectKey);
  } catch {
    // Storage refused: the return just shows no confirmation.
  }
}
/** route is the whole route the person is on; returnTo is the path the
 * gateway is asked to come back to. */
export function markReconnect(route: string, returnTo: string) {
  writeMark({ at: Date.now(), route, returnTo });
}
function takeReconnect(): boolean {
  const mark = readMark();
  writeMark(undefined);
  return !!mark;
}
/** The route to restore after the round trip, once: only on the path the
 * gateway returned to, before the person has gone anywhere else. */
export function takeReturnRoute(pathname: string, search: string) {
  const mark = readMark();
  if (!mark || mark.restored) return undefined;
  // Back on the very route it left (the browser's back button from
  // GitHub): nothing is left to restore.
  if (`${pathname}${search}` === mark.route)
    writeMark({ ...mark, restored: true });
  if (search || pathname !== mark.returnTo) return undefined;
  writeMark({ ...mark, restored: true });
  return mark.route !== pathname ? mark.route : undefined;
}

export type GitHubRecovery =
  | { kind: "reconnected"; login?: string }
  | { kind: "recovered" };

/** A short-lived confirmation when the connection works again: after the
 * reconnect round trip, or when this tab saw a fault clear by itself. It
 * belongs to the person it was observed for and is never shown to another
 * one signing in on the same tab. */
export function useGitHubRecovery(
  identity: string | undefined,
  state?: NativeState,
  login?: string,
  hold = 8000,
): GitHubRecovery | undefined {
  const [recovery, setRecovery] = useState<
    GitHubRecovery & { identity?: string }
  >();
  const last = useRef<{ identity?: string; state?: NativeState }>({});
  useEffect(() => {
    if (last.current.identity !== identity) last.current = { identity };
    // An unknown or pending moment between two settled states is not news,
    // nor is the host's second look at a rejection.
    if (
      !state ||
      state === "unknown" ||
      state === "pending" ||
      state === "verifying"
    )
      return;
    const before = last.current.state;
    last.current.state = state;
    if (state !== "connected") {
      // Back from GitHub, still broken: the warning stays and says so.
      if (readMark()) takeReconnect();
      setRecovery(undefined);
      return;
    }
    if (takeReconnect()) setRecovery({ kind: "reconnected", login, identity });
    else if (
      before === "expired" ||
      before === "disconnected" ||
      before === "unreachable"
    )
      setRecovery({ kind: "recovered", identity });
  }, [identity, state, login]);
  useEffect(() => {
    if (!recovery) return;
    const timer = setTimeout(() => setRecovery(undefined), hold);
    return () => clearTimeout(timer);
  }, [recovery, hold]);
  if (!recovery || recovery.identity !== identity) return undefined;
  const { identity: _, ...shown } = recovery;
  return shown;
}
