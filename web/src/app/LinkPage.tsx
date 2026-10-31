import { useEffect, useState } from "react";
import { PhoneLink, type PhoneLinkState } from "../components/DeviceLink";
import { setPersonalLanguage, useLanguage } from "../i18n";
import { describeLink, redeemLink } from "./deviceLink";

/**
 * Takes the token out of the /link fragment before anything else runs, so it
 * stays out of history; the fragment never reaches the server or Referer.
 */
export function takeLinkToken(): string {
  const token = window.location.hash.slice(1);
  window.history.replaceState(null, "", "/link");
  return /^[A-Za-z0-9_-]{43}$/.test(token) ? token : "";
}

/** The phone confirms the account, signs in and moves on to the home view. */
export function LinkPage({ token }: { token: string }) {
  const [state, setState] = useState<PhoneLinkState>(
    token ? { kind: "checking" } : { kind: "dead" },
  );
  // Nobody is signed in on this phone yet: the server default and the
  // browser choose the language, and the page follows it.
  useLanguage();
  useEffect(() => setPersonalLanguage(undefined), []);
  useEffect(() => {
    if (!token) return;
    let live = true;
    void describeLink(token)
      .then((profile) => live && setState({ kind: "ask", profile }))
      .catch(() => live && setState({ kind: "dead" }));
    return () => {
      live = false;
    };
  }, [token]);
  useEffect(() => {
    if (state.kind !== "in") return;
    const timer = window.setTimeout(() => window.location.replace("/"), 1200);
    return () => window.clearTimeout(timer);
  }, [state.kind]);
  return (
    <PhoneLink
      state={state}
      host={window.location.host}
      onSignIn={() => {
        if (state.kind !== "ask") return;
        setState({ ...state, busy: true });
        void redeemLink(token)
          .then(() => setState({ kind: "in" }))
          .catch(() => setState({ kind: "dead" }));
      }}
      onCancel={() => setState({ kind: "no" })}
    />
  );
}
