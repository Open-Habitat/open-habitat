import { useEffect, useState } from "react";
import { useLocation } from "react-router";
import { AccountShelf } from "../components/Account";
import type { AccountProfile } from "./pi";
import { serverInfo } from "./serverAdministration";

/** Session controls remain available even when the daemon has no snapshot. */
export function FallbackAccount({
  profile,
  onSettings,
  onAdministration,
  onLogout,
}: {
  profile: AccountProfile;
  onSettings: () => void;
  onAdministration: () => void;
  onLogout: () => void;
}) {
  const { pathname } = useLocation();
  const [administrator, setAdministrator] = useState(false);
  // Match the rail's role source; a failed read never exposes the admin entry.
  // biome-ignore lint/correctness/useExhaustiveDependencies: Re-read the host role on route changes, as the rail does.
  useEffect(() => {
    const controller = new AbortController();
    setAdministrator(false);
    void serverInfo(controller.signal)
      .then((server) => {
        if (!controller.signal.aborted) setAdministrator(server.administrator);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [pathname]);
  return (
    <AccountShelf
      profile={profile}
      onSettings={onSettings}
      onAdministration={administrator ? onAdministration : undefined}
      onLogout={onLogout}
    />
  );
}
