import type { ReactNode } from "react";
import type { RailPlace } from "../components/AdaptiveRail";
import { browserRailWords } from "../components/ServerBrowser";
import { formatNumber, useText } from "../i18n";
import { serverBrowserText } from "../text/serverBrowser";
import { sharesText } from "../text/shares";
import { useServerBrowserRail } from "./ServerBrowser";
import { useSharesCount } from "./SharesPage";

/** The adaptive rail's middle places (adaptive-rail, experimental):
 * Tuotokset with its public addresses and, while the person's server
 * browser is on, Oma selain with its state. Etusivu and Agentin käytössä
 * come from the rail itself. Off, the rail is the fixed one and gets none.
 * A render prop, so the browser's and the addresses' changes rerender the
 * rail and not the whole app. */
export function AdaptiveRailPlaces({
  on,
  children,
  ...props
}: {
  on: boolean;
  identity?: string;
  csrf?: string;
  titleOf?: (agentId: string) => string | undefined;
  sharesCurrent: boolean;
  onNavigate?: (href: string) => void;
  children: (places: readonly RailPlace[] | undefined) => ReactNode;
}) {
  return on ? <Places {...props}>{children}</Places> : children(undefined);
}

function Places({
  identity,
  csrf,
  titleOf,
  sharesCurrent,
  onNavigate,
  children,
}: {
  identity?: string;
  csrf?: string;
  titleOf?: (agentId: string) => string | undefined;
  sharesCurrent: boolean;
  onNavigate?: (href: string) => void;
  children: (places: readonly RailPlace[]) => ReactNode;
}) {
  const shares = useText(sharesText);
  const browserTxt = useText(serverBrowserText);
  const count = useSharesCount();
  const browser = useServerBrowserRail({ identity, csrf, titleOf });
  const places: RailPlace[] = [
    {
      id: "shares",
      testId: "rail-shares",
      label: shares.title,
      href: "/shares",
      onNavigate,
      current: sharesCurrent,
      count: count ? formatNumber(count) : undefined,
    },
  ];
  if (browser && browser.summary.kind !== "off") {
    const words = browserRailWords(
      browserTxt,
      browser.summary,
      browser.windows,
      browser.busy,
      browser.conversation,
    );
    places.push({
      id: "browser",
      testId: "browser-rail-row",
      label: browserTxt.ownBrowser,
      onOpen: browser.onOpen,
      state: browser.summary.kind,
      stateText: words.shown,
      said: words.said,
    });
  }
  return children(places);
}
