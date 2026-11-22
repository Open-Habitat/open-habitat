import {
  lazy,
  type ReactNode,
  Suspense,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  BrowserRailRow,
  BrowserRowMarks,
  BrowserSheet,
  BrowserWindows,
} from "../components/ServerBrowser";
import { useText } from "../i18n";
import { serverBrowserText } from "../text/serverBrowser";
import { useExperimentalFeature } from "./accountPreferences";
import {
  browserRowStates,
  noteBrowserUse,
  noteBrowserWindows,
  ownerOfWindow,
  settleBrowserUse,
  useBrowserConversations,
} from "./browserConversations";
import type { ToolReport } from "./editorChanges";
import {
  closeBrowserSheet,
  closeBrowserWindow,
  openBrowserSheet,
  setBrowserControl,
  startBrowser,
  stopBrowser,
  summarize,
  useServerBrowser,
  useServerBrowserState,
} from "./serverBrowser";
import { browserCallFacts } from "./turnBrowserVisits";

// noVNC is loaded only when the person opens the live view.
const BrowserViewer = lazy(() => import("./BrowserViewer"));

/** A finished tool call from the live stream of any of the person's
 * conversations: a browser command links the windows it acted in to its
 * conversation, for the rail's row marks. */
export function observeBrowserTool(report: ToolReport) {
  if (report.tool !== "bash" || !report.output) return;
  const facts = browserCallFacts(report.arguments ?? "", report.output);
  if (!facts.windows.length && facts.request === undefined) return;
  noteBrowserWindows(report.conversation, facts.windows);
  if (facts.request === undefined) noteBrowserUse(report.conversation);
}

/** The browser marks of the conversation rows, for the rail. `running` is
 * the conversations whose agent runs now; `on` is the experiment. */
export function ServerBrowserRowMarks({
  on,
  running,
  children,
}: {
  on: boolean;
  running: ReadonlySet<string>;
  children: ReactNode;
}) {
  const browser = useServerBrowserState();
  const version = useBrowserConversations();
  useEffect(() => settleBrowserUse(running), [running]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: version is the registry's change signal.
  const marks = useMemo(
    () => (on ? browserRowStates(browser.status, running) : new Map()),
    [on, browser.status, running, version],
  );
  return (
    <BrowserRowMarks.Provider value={marks}>
      {children}
    </BrowserRowMarks.Provider>
  );
}

/** What the rail's Oma selain shows and does, or nothing while the
 * experiment is off. `titleOf` names the conversation an open request
 * belongs to, when one of the conversation's own commands named its
 * window. A press opens the live view, and starts a stopped browser first. */
export function useServerBrowserRail({
  identity,
  csrf,
  titleOf,
}: {
  identity?: string;
  csrf?: string;
  titleOf?: (agentId: string) => string | undefined;
}): Parameters<typeof BrowserRailRow>[0] | undefined {
  const on = useExperimentalFeature("remote-browser", { identity, csrf });
  const browser = useServerBrowser(identity, csrf, on);
  useBrowserConversations();
  const summary = summarize(browser.status);
  if (!on) return undefined;
  const asked =
    summary.kind === "ask" ? browser.status?.request?.window : undefined;
  const owner = asked ? ownerOfWindow(asked) : undefined;
  return {
    summary,
    windows: browser.status?.windows.length ?? 0,
    busy: browser.busy,
    conversation: owner ? titleOf?.(owner) : undefined,
    onOpen: async () => {
      if (summary.kind === "stopped" && !(await startBrowser())) return;
      openBrowserSheet(
        browser.status?.control === "person" ? "control" : "view",
      );
    },
  };
}

/** The rail's Oma selain row. */
export function ServerBrowserRail(props: {
  identity?: string;
  csrf?: string;
  titleOf?: (agentId: string) => string | undefined;
}) {
  const row = useServerBrowserRail(props);
  return row ? <BrowserRailRow {...row} /> : null;
}

/** The live view, once for the whole app: the rail row and the Selain card
 * open it. Its read keeps the browser's state current for both. */
export function ServerBrowserSheetHost({
  identity,
  csrf,
}: {
  identity?: string;
  csrf?: string;
}) {
  const txt = useText(serverBrowserText);
  const on = useExperimentalFeature("remote-browser", { identity, csrf });
  const browser = useServerBrowser(identity, csrf, on);
  const viewer = useRef<{ focus: () => void }>(null);
  if (!on || !browser.sheet) return null;
  const running = browser.status?.state === "running";
  // The host decides who drives; the sheet follows it.
  const mode = browser.status?.control === "person" ? "control" : "view";
  return (
    <BrowserSheet
      mode={mode}
      running={running}
      busy={browser.busy}
      error={browser.error}
      windows={
        running ? (
          <BrowserWindows
            windows={browser.status?.windows ?? []}
            busy={!!browser.busy}
            onSelect={async (id) => {
              if (await setBrowserControl("person", id))
                viewer.current?.focus();
            }}
            onClose={async (id) => {
              if (await closeBrowserWindow(id)) viewer.current?.focus();
            }}
          />
        ) : undefined
      }
      onClose={closeBrowserSheet}
      onStop={async () => {
        if (await stopBrowser()) closeBrowserSheet();
      }}
    >
      {running && csrf && browser.status ? (
        <Suspense
          fallback={<p className="sb-viewer-note">{txt.sheet.connecting}</p>}
        >
          <BrowserViewer
            ref={viewer}
            csrf={csrf}
            status={browser.status}
            busy={!!browser.busy}
            onTake={() => setBrowserControl("person")}
            onGiveBack={() => setBrowserControl("agent")}
          />
        </Suspense>
      ) : (
        <p className="sb-viewer-note">{txt.sheet.notRunning}</p>
      )}
    </BrowserSheet>
  );
}
