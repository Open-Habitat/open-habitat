import { useEffect, useRef, useState } from "react";
import type { NativeState } from "./CodeHostSettings";

// What the browser says about the person's own GitHub connection, read from
// the snapshot's native_github.state (proto-github-connection-warning,
// round 2, direction 2). The host already rechecks that state by itself, so
// a warning appears only for a settled fault the person has to repair, and
// it leaves by itself once the snapshot says the connection works.
//
// Only "expired" and "disconnected" are such faults today. An outage is
// still "unknown" in the snapshot, the same as a locked keyring, so the
// "yritetään uudelleen" line waits for the daemon to tell it apart.

export type GitHubFault = "expired" | "disconnected";

export type GitHubWarning = {
  fault: GitHubFault;
  tone: "danger" | "neutral";
  title: string;
  /** Where GitHub is used anyway: the conversation and the app-wide strip. */
  text: string;
  short: string;
  /** Where GitHub is needed right now: the repository finders. */
  place: string;
  fix: string;
};

const warnings: Record<GitHubFault, GitHubWarning> = {
  expired: {
    fault: "expired",
    tone: "danger",
    title: "GitHub-yhteys on vanhentunut tai peruttu",
    text: "GitHub ei enää hyväksy palvelimen valtuutusta, eikä palvelin voi uusia sitä itse. Yhdistä uudelleen: GitHub palauttaa sinut tänne, yleensä kysymättä mitään.",
    short: "Push ja gh eivät toimi. Palvelin ei voi uusia valtuutusta itse.",
    place:
      "GitHub ei enää hyväksy palvelimelle tallennettua valtuutusta: se on vanhentunut tai peruttu. Repolistaa ei voi hakea eikä repoja kloonata.",
    fix: "Yhdistä uudelleen",
  },
  disconnected: {
    fault: "disconnected",
    tone: "neutral",
    title: "GitHubia ei ole yhdistetty",
    text: "Palvelimella ei ole GitHub-kirjautumistasi, joten push, kloonaus ja gh eivät toimi. Paikallinen työ ja keskustelut toimivat.",
    short: "Push ja gh eivät toimi ennen yhdistämistä.",
    place:
      "Repolistaa ei voi hakea, koska palvelimella ei ole GitHub-kirjautumistasi.",
    fix: "Yhdistä GitHub",
  },
};

/** The settled fault behind a state, if the person can repair it. */
export function githubFault(state?: NativeState): GitHubWarning | undefined {
  return state === "expired" || state === "disconnected"
    ? warnings[state]
    : undefined;
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
  return (
    warning.fault === "expired" ||
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
    // An unknown or pending moment between two settled states is not news.
    if (!state || state === "unknown" || state === "pending") return;
    const before = last.current.state;
    last.current.state = state;
    if (state !== "connected") {
      // Back from GitHub, still broken: the warning stays and says so.
      if (readMark()) takeReconnect();
      setRecovery(undefined);
      return;
    }
    if (takeReconnect()) setRecovery({ kind: "reconnected", login, identity });
    else if (before === "expired" || before === "disconnected")
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
