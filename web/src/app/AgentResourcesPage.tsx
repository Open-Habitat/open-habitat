import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  AgentResourcesFailed,
  AgentResourcesFrame,
  FolderBrowser,
  type FolderState,
  ResourceDetail,
  ResourceList,
} from "../components/AgentResources";
import { useText } from "../i18n";
import { agentResourcesText } from "../text/agentResources";
import {
  buildResources,
  type FileRoot,
  type GitHubState,
  type Resources,
  readFileRoots,
  readFolder,
} from "./agentResources";
import { Refused, readIntegrations } from "./integrations";
import {
  type OwnMachines,
  ownMachinesPath,
  readOwnMachines,
} from "./ownMachines";
import { settingsHref } from "./settingsRoute";

// Agentin käytössä (experimental): the route is the record of the chosen
// source and folder (`/resources?source=…&folder=…`); the page reads the
// host's existing answers when it opens and the chosen folder when it is
// shown, keeps nothing, and drops a reply that is no longer for what is shown.

const phone = "(max-width: 800px)";
function useNarrow() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(phone).matches);
  useEffect(() => {
    const media = window.matchMedia(phone);
    const change = () => setNarrow(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return narrow;
}

type Loaded =
  | { phase: "loading" }
  | { phase: "failed" }
  | {
      phase: "ready";
      resources: Resources;
      machinesFailed: boolean;
      filesFailed: boolean;
    };

async function readMachines(signal: AbortSignal): Promise<OwnMachines> {
  const response = await fetch(ownMachinesPath, {
    credentials: "same-origin",
    cache: "no-store",
    signal,
  });
  return readOwnMachines(response);
}

export function AgentResourcesPage({ github }: { github: GitHubState }) {
  const t = useText(agentResourcesText);
  const narrow = useNarrow();
  const [params, setParams] = useSearchParams();
  const [loaded, setLoaded] = useState<Loaded>({ phase: "loading" });
  const [reload, setReload] = useState(0);
  const [folderReload, setFolderReload] = useState(0);
  const [folder, setFolder] = useState<FolderState & { key?: string }>({
    state: "loading",
  });
  const githubState = github?.state;
  const githubLogin = github?.login;

  useEffect(() => {
    void reload;
    const abort = new AbortController();
    setLoaded({ phase: "loading" });
    (async () => {
      const [list, roots, machines] = await Promise.allSettled([
        readIntegrations(abort.signal),
        readFileRoots(abort.signal),
        readMachines(abort.signal),
      ]);
      if (abort.signal.aborted) return;
      if (list.status === "rejected") {
        setLoaded({ phase: "failed" });
        return;
      }
      const fileRoots: FileRoot[] | undefined =
        roots.status === "fulfilled" ? roots.value : undefined;
      setLoaded({
        phase: "ready",
        resources: buildResources(
          list.value,
          fileRoots,
          machines.status === "fulfilled" ? machines.value : undefined,
          githubState ? { state: githubState, login: githubLogin } : undefined,
        ),
        machinesFailed: machines.status === "rejected",
        filesFailed: roots.status === "rejected",
      });
    })();
    return () => abort.abort();
  }, [reload, githubState, githubLogin]);

  const resources = loaded.phase === "ready" ? loaded.resources : undefined;
  const chosen = params.get("source");
  const source = useMemo(() => {
    if (!resources) return undefined;
    const found = resources.sources.find((s) => s.id === chosen);
    // A computer shows the first source until one is chosen; a phone shows
    // the list.
    return found ?? (narrow || chosen ? undefined : resources.sources[0]);
  }, [resources, chosen, narrow]);
  const path = useMemo(() => {
    const raw = params.get("folder");
    return raw ? raw.split("/").filter(Boolean) : [];
  }, [params]);
  const directory = source?.directory;
  const folderPath = path.join("/");
  const unavailable = source?.unavailable;

  useEffect(() => {
    void folderReload;
    if (!directory || unavailable) return;
    const key = `${directory}\n${folderPath}`;
    const abort = new AbortController();
    setFolder({ state: "loading", key });
    readFolder(directory, folderPath, abort.signal).then(
      (reply) => {
        if (abort.signal.aborted) return;
        setFolder({
          state: "ready",
          key,
          entries: reply.entries,
          truncated: reply.truncated,
          unlisted: reply.unlisted,
        });
      },
      (error) => {
        if (abort.signal.aborted) return;
        setFolder({
          state:
            error instanceof Refused && error.code === "folder_missing"
              ? "missing"
              : "failed",
          key,
        });
      },
    );
    return () => abort.abort();
  }, [directory, folderPath, unavailable, folderReload]);

  const pick = useCallback(
    (id: string) => setParams({ source: id }),
    [setParams],
  );
  const go = useCallback(
    (next: string[]) => {
      if (!source) return;
      setParams(
        next.length
          ? { source: source.id, folder: next.join("/") }
          : { source: source.id },
      );
    },
    [setParams, source],
  );

  const currentFolder: FolderState =
    folder.key === `${directory}\n${folderPath}`
      ? folder
      : { state: "loading" };
  const files =
    source?.kind === "files" ? (
      <FolderBrowser
        root={source.name}
        path={directory && !unavailable ? path : []}
        folder={
          !directory || unavailable
            ? {
                state: "unavailable",
                why: unavailable ?? t.files.unavailable,
              }
            : currentFolder
        }
        onGo={go}
        onRetry={() => setFolderReload((n) => n + 1)}
      />
    ) : undefined;

  const summary = resources
    ? t.summary(
        resources.connections,
        resources.sources.length,
        resources.sources.filter((s) => s.can === "change").length,
      )
    : undefined;

  return (
    <AgentResourcesFrame
      summary={summary}
      connectHref={settingsHref("tiedot")}
      narrow={narrow}
      notice={
        loaded.phase === "failed" ? (
          <AgentResourcesFailed onRetry={() => setReload((n) => n + 1)} />
        ) : loaded.phase === "loading" ? (
          <p className="ar-meta" role="status" data-testid="resource-loading">
            {t.loading}
          </p>
        ) : null
      }
      list={
        resources ? (
          <ResourceList
            resources={resources}
            selected={source?.id}
            onPick={pick}
            machinesFailed={
              loaded.phase === "ready" ? loaded.machinesFailed : false
            }
            filesFailed={loaded.phase === "ready" ? loaded.filesFailed : false}
            onRetry={() => setReload((n) => n + 1)}
          />
        ) : undefined
      }
      detail={
        source ? (
          <ResourceDetail
            key={source.id}
            source={source}
            files={files}
            onBack={narrow ? () => setParams({}) : undefined}
          />
        ) : undefined
      }
    />
  );
}
