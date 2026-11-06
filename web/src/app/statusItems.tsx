import { type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { StatusBellProvider, type StatusItem } from "../components/StatusBell";
import { liveText } from "../i18n";
import { statusText } from "../text/status";
import { aiBellItem, useAISignIn } from "./AISignIn";
import {
  dismissBundlePrompt,
  reloadForNewBundle,
  useBundleState,
} from "./bundleRelease";
import type { GitHubWarning } from "./githubConnection";
import { StoragePressureProvider, useStorageStatus } from "./StoragePressure";
import { serverInfo, serverInformationChanges } from "./serverAdministration";
import { settingsHref } from "./settingsRoute";
import {
  bytes,
  type StorageAdministration,
  storageAdministration,
  storageAdministrationChanges,
} from "./storageQuota";

const txt = liveText(statusText);

// What the bell says, each from a fact the browser already reads: the own
// storage poll, the served bundle, the snapshot's native_github, and for an
// administrator the server's storage read. Nothing here is stored; an item
// is there exactly while its fact says so.

const OVERCOMMIT_INTERVAL_MS = 60_000;

/** The person's role, read again on navigation and after an
 * administration write, as the rail does; nothing before sign-in. */
function useAdministrator(enabled: boolean, pathname: string) {
  const [administrator, setAdministrator] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Re-read the role on navigation, including after a role removal.
  useEffect(() => {
    if (!enabled) {
      setAdministrator(false);
      return;
    }
    let controller = new AbortController();
    const refresh = () => {
      controller.abort();
      controller = new AbortController();
      const { signal } = controller;
      void serverInfo(signal)
        .then((next) => {
          if (!signal.aborted) setAdministrator(next.administrator);
        })
        .catch(() => {});
    };
    serverInformationChanges.addEventListener("change", refresh);
    refresh();
    return () => {
      controller.abort();
      serverInformationChanges.removeEventListener("change", refresh);
    };
  }, [enabled, pathname]);
  return enabled && administrator;
}

/** The server's storage for an administrator, reread every minute and after
 * a limit change; a refused or failed read says nothing. */
function useServerStorage(administrator: boolean) {
  const [storage, setStorage] = useState<StorageAdministration>();
  useEffect(() => {
    if (!administrator) {
      setStorage(undefined);
      return;
    }
    let controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const read = () => {
      controller.abort();
      clearTimeout(timer);
      controller = new AbortController();
      const { signal } = controller;
      void storageAdministration(signal)
        .then((next) => {
          if (!signal.aborted) setStorage(next);
        })
        .catch(() => {
          if (!signal.aborted) setStorage(undefined);
        })
        .finally(() => {
          if (!signal.aborted) timer = setTimeout(read, OVERCOMMIT_INTERVAL_MS);
        });
    };
    read();
    storageAdministrationChanges.addEventListener("change", read);
    return () => {
      controller.abort();
      clearTimeout(timer);
      storageAdministrationChanges.removeEventListener("change", read);
    };
  }, [administrator]);
  return administrator ? storage : undefined;
}

function overcommitItem(
  storage: StorageAdministration | undefined,
  open: () => void,
): StatusItem | undefined {
  // Unknown (a limit could not be read) is not said: only a known excess is.
  if (storage?.overcommitted !== true) return undefined;
  const limits = storage.users.reduce((sum, u) => sum + u.limit_bytes, 0);
  return {
    key: "server-storage",
    tone: "warning",
    icon: "server",
    group: "server",
    short: txt.quotasShort,
    title: txt.quotasTitle,
    meta: txt.quotasMeta(
      bytes(limits),
      bytes(storage.filesystem.capacity_bytes),
    ),
    body: txt.quotasBody,
    actions: [
      {
        testId: "status-server-storage",
        label: txt.diskPlace,
        primary: true,
        onPress: open,
      },
    ],
  };
}

function githubItem(
  warning: GitHubWarning | undefined,
  onReconnect?: () => void,
): StatusItem | undefined {
  if (!warning) return undefined;
  const repair =
    warning.fix && (warning.href || onReconnect)
      ? [
          {
            testId: "status-github-fix",
            label: warning.fix,
            icon: "github" as const,
            primary: true,
            href: warning.href,
            onPress: warning.href ? undefined : onReconnect,
          },
        ]
      : [];
  return {
    key: "github",
    tone: warning.tone === "danger" ? "danger" : "warning",
    icon: "github",
    group: "own",
    short: warning.tone === "danger" ? txt.githubDown : "GitHub",
    title: warning.title,
    meta: warning.short,
    body: warning.text,
    data: { state: warning.fault },
    actions: repair,
  };
}

/** Everything the bell holds now, most serious first. */
export function useStatusItems({
  enabled,
  pathname,
  github,
  onReconnect,
}: {
  /** Signed in: before that there is nothing to read. */
  enabled: boolean;
  pathname: string;
  /** The settled fault that concerns this person, if any. */
  github?: GitHubWarning;
  onReconnect?: () => void;
}): StatusItem[] {
  const navigate = useNavigate();
  const storage = useStorageStatus();
  const bundle = useBundleState();
  const serverStorage = useServerStorage(useAdministrator(enabled, pathname));
  const aiSignIn = useAISignIn();
  const version: StatusItem | undefined =
    bundle.status === "newer" && !bundle.dismissed
      ? {
          key: "version",
          tone: "info",
          icon: "refresh",
          group: "own",
          short: txt.versionShort,
          title: txt.versionTitle,
          meta: txt.versionMeta,
          body: txt.versionBody,
          actions: [
            {
              testId: "version-reload",
              label: txt.reload,
              primary: true,
              onPress: reloadForNewBundle,
            },
            {
              testId: "version-later",
              label: txt.later,
              keepOpen: true,
              onPress: dismissBundlePrompt,
            },
          ],
        }
      : undefined;
  return [
    storage,
    ...aiSignIn.refused.map((p) => aiBellItem(p, () => aiSignIn.open(p))),
    githubItem(github, onReconnect),
    version,
    overcommitItem(serverStorage, () => navigate(settingsHref("levy"))),
  ].filter((i): i is StatusItem => !!i);
}

/** Observes the person's storage and provides what holds now to every bell
 * below it. Mounted inside the identity-keyed subtree. */
export function StatusSource({
  enabled,
  pathname,
  github,
  onReconnect,
  children,
}: {
  /** Signed in: before that there is nothing to read. */
  enabled: boolean;
  pathname: string;
  github?: GitHubWarning;
  onReconnect?: () => void;
  children: ReactNode;
}) {
  return (
    <StoragePressureProvider enabled={enabled}>
      <Items
        enabled={enabled}
        pathname={pathname}
        github={github}
        onReconnect={onReconnect}
      >
        {children}
      </Items>
    </StoragePressureProvider>
  );
}

function Items({
  children,
  ...facts
}: Parameters<typeof useStatusItems>[0] & { children: ReactNode }) {
  const items = useStatusItems(facts);
  return <StatusBellProvider items={items}>{children}</StatusBellProvider>;
}
