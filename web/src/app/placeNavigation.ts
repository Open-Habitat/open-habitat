import { useEffect, useLayoutEffect, useRef } from "react";
import {
  type Location,
  useLocation,
  useNavigate,
  useSearchParams,
} from "react-router";

export const isPlace = (path: string) =>
  path === "/shares" || path === "/resources";

/** The return location is navigation state, not a second selected conversation. */
export function placeBackground(
  location: Pick<Location, "pathname"> & Partial<Pick<Location, "state">>,
): Location | undefined {
  const background = location.state?.placeBackground as Location | undefined;
  return isPlace(location.pathname) &&
    typeof background?.pathname === "string" &&
    (background.pathname.startsWith("/workspaces") ||
      background.pathname.startsWith("/agents/"))
    ? background
    : undefined;
}

export function usePlaceSearchParams() {
  const [params, update] = useSearchParams();
  const { state } = useLocation();
  const set = (next: Parameters<typeof update>[0]) =>
    update(next, { replace: true, state });
  return [params, set] as const;
}

export function usePlaceNavigation(origin?: Location) {
  const route = useLocation();
  const location = origin ?? route;
  const navigate = useNavigate();
  return (href: string) => {
    if (location.pathname === href) {
      const background = placeBackground(location);
      // Resolve the return explicitly: Settings or a linked detail may have
      // added history entries since this place opened. Back could reopen them.
      void navigate(background ?? "/workspaces", {
        replace: true,
        // The restored entry is a replacement, not the original context
        // entry whose close control could safely go Back.
        state: background?.state?.contextFrom
          ? { ...background.state, contextFrom: false }
          : background?.state,
      });
    } else if (isPlace(location.pathname)) {
      // The places share one history entry: Back closes the whole visit.
      void navigate(href, { replace: true, state: location.state });
    } else {
      void navigate(href, { state: { placeBackground: location } });
    }
  };
}

export function usePlaceEscape(enabled: boolean) {
  const location = useLocation();
  const open = usePlaceNavigation();
  const previous = useRef(location);
  useLayoutEffect(() => {
    const before = previous.current;
    previous.current = location;
    if (!enabled || before.pathname === location.pathname) return;
    if (isPlace(location.pathname)) {
      // The place may still be loading. Focus its stable container, not a
      // heading that might only appear after the host replies.
      document
        .querySelector<HTMLElement>(".ah-place-layer")
        ?.focus({ preventScroll: true });
    } else if (isPlace(before.pathname)) {
      const background = placeBackground(before);
      if (location.pathname !== (background?.pathname ?? "/workspaces")) return;
      document
        .querySelector<HTMLElement>(
          `[data-testid="rail-${before.pathname === "/shares" ? "shares" : "resources"}"]`,
        )
        ?.focus({ preventScroll: true });
    }
  }, [enabled, location]);
  useEffect(() => {
    if (!enabled || !isPlace(location.pathname)) return;
    const onKey = (event: KeyboardEvent) => {
      if (
        event.code !== "Escape" ||
        event.defaultPrevented ||
        event.isComposing ||
        event.altKey ||
        event.ctrlKey ||
        event.metaKey ||
        event.shiftKey
      )
        return;
      // Inner dialogs, menus and editors own Escape before the place does.
      if (
        document.querySelector(
          '[role="dialog"]:not([inert] *), [role="menu"], [role="listbox"]',
        )
      )
        return;
      if (
        event.target instanceof Element &&
        event.target.closest(
          'input, textarea, [contenteditable="true"], .cm-editor, .ah-terminal-surface, iframe',
        )
      )
        return;
      event.preventDefault();
      open(location.pathname);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [enabled, location.pathname, open]);
}
