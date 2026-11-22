import type { ReactNode } from "react";
import type { RailPlace } from "../components/AdaptiveRail";
import { browserRailWords } from "../components/ServerBrowser";
import { formatNumber, useText } from "../i18n";
import { serverBrowserText } from "../text/serverBrowser";
import { sharesText } from "../text/shares";
import { useServerBrowserRail } from "./ServerBrowser";
import { useSharesCount } from "./SharesPage";

/** The desktop rail's middle places:
 * Tuotokset with its public addresses and, while the person's server
 * browser is on, Oma selain with its state. Etusivu and Agentin käytössä
 * come from the rail itself. The phone drawer and collapsed rail use rows.
 * A render prop, so the browser's and the addresses' changes rerender the
 * rail and not the whole app. */
export function AdaptiveRailPlaces({
  on,
  identity,
  csrf,
  titleOf,
  sharesCurrent,
  onNavigate,
  children,
}: {
  on: boolean;
  identity?: string;
  csrf?: string;
  titleOf?: (agentId: string) => string | undefined;
  sharesCurrent: boolean;
  onNavigate?: (href: string) => void;
  children: (places: readonly RailPlace[] | undefined) => ReactNode;
}) {
  const shares = useText(sharesText);
  const browserTxt = useText(serverBrowserText);
  const count = useSharesCount();
  const browser = useServerBrowserRail({ identity, csrf, titleOf });
  // Keep the same child tree through layout changes: an extra wrapper on
  // desktop would remount the rail and lose focus on its collapse button.
  if (!on) return children(undefined);
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
