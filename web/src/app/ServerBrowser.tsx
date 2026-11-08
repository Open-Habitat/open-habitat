import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  BrowserChip,
  BrowserRailRow,
  BrowserSheet,
  BrowserStrip,
} from "../components/ServerBrowser";
import { useText } from "../i18n";
import { serverBrowserText } from "../text/serverBrowser";
import { useExperimentalFeature } from "./accountPreferences";
import {
  browserWindowURL,
  closeBrowserSheet,
  openBrowserSheet,
  setBrowserControl,
  startBrowser,
  stopBrowser,
  summarize,
  useServerBrowser,
} from "./serverBrowser";

// noVNC is loaded only when the person opens the live view.
const BrowserViewer = lazy(() => import("./BrowserViewer"));

const pictureEvery = 2000;

/** Small live pictures of the windows while `active`: each window's JPEG
 * through the person's daemon, as object URLs that are released again. */
function useWindowPictures(ids: string[], active: boolean) {
  const [pictures, setPictures] = useState<Record<string, string>>({});
  const urls = useRef<Record<string, string>>({});
  const key = ids.join(",");
  useEffect(() => {
    if (!active || !key) return;
    let stop = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const wanted = key.split(",");
    const round = async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        wanted.map(async (id) => {
          try {
            const response = await fetch(browserWindowURL(id), {
              credentials: "same-origin",
              cache: "no-store",
            });
            const type = response.headers.get("Content-Type");
            if (!response.ok || type !== "image/jpeg") return;
            const blob = await response.blob();
            if (blob.size > 4 << 20) return;
            next[id] = URL.createObjectURL(blob);
          } catch {
            /* The previous picture stays. */
          }
        }),
      );
      if (stop) {
        for (const u of Object.values(next)) URL.revokeObjectURL(u);
        return;
      }
      const merged: Record<string, string> = {};
      for (const id of wanted) {
        const fresh = next[id];
        const old = urls.current[id];
        if (fresh && old) URL.revokeObjectURL(old);
        if (fresh ?? old) merged[id] = fresh ?? old;
      }
      for (const [id, u] of Object.entries(urls.current))
        if (!wanted.includes(id)) URL.revokeObjectURL(u);
      urls.current = merged;
      setPictures(merged);
      timer = setTimeout(round, pictureEvery);
    };
    void round();
    return () => {
      stop = true;
      clearTimeout(timer);
    };
  }, [key, active]);
  useEffect(
    () => () => {
      for (const u of Object.values(urls.current)) URL.revokeObjectURL(u);
      urls.current = {};
    },
    [],
  );
  return pictures;
}

/** The chip above the message field and the strip it opens. */
export function ServerBrowserDock({
  identity,
  csrf,
}: {
  identity?: string;
  csrf?: string;
}) {
  const on = useExperimentalFeature("remote-browser");
  const browser = useServerBrowser(identity, csrf, on);
  const [open, setOpen] = useState(false);
  const summary = summarize(browser.status);
  const running = browser.status?.state === "running";
  // A window that needs the person opens the strip by itself once.
  const asked = browser.status?.request?.window;
  const seen = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (asked && asked !== seen.current) setOpen(true);
    seen.current = asked;
  }, [asked]);
  const pictures = useWindowPictures(
    running ? (browser.status?.windows.map((w) => w.id) ?? []) : [],
    open && running && !browser.sheet,
  );
  if (!on || summary.kind === "off") return null;
  return (
    <div className="sb-dock" data-testid="browser-dock">
      {open && running && browser.status ? (
        <BrowserStrip
          status={browser.status}
          summary={summary}
          pictures={pictures}
          busy={browser.busy}
          error={browser.error}
          onLook={() => openBrowserSheet("view")}
          onTakeForRequest={async (window) => {
            if (await setBrowserControl("person", window))
              openBrowserSheet("control");
          }}
          onGiveBack={() => void setBrowserControl("agent")}
        />
      ) : null}
      <BrowserChip
        status={browser.status}
        summary={summary}
        open={open && running}
        busy={browser.busy}
        onToggle={() => setOpen((v) => !v)}
        onStart={async () => {
          if (await startBrowser()) setOpen(true);
        }}
      />
    </div>
  );
}

/** The browser as the top row of the sidebar; it opens the live view, and
 * starts a stopped browser first. */
export function ServerBrowserRail({
  identity,
  csrf,
}: {
  identity?: string;
  csrf?: string;
}) {
  const on = useExperimentalFeature("remote-browser", { identity, csrf });
  const browser = useServerBrowser(identity, csrf, on);
  const summary = summarize(browser.status);
  if (!on) return null;
  return (
    <BrowserRailRow
      summary={summary}
      windows={browser.status?.windows.length ?? 0}
      busy={browser.busy}
      onOpen={async () => {
        if (summary.kind === "stopped" && !(await startBrowser())) return;
        openBrowserSheet(
          browser.status?.control === "person" ? "control" : "view",
        );
      }}
    />
  );
}

/** The live view, once for the whole app: the rail and the chip open it. */
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
      onClose={closeBrowserSheet}
      onTakeControl={() => void setBrowserControl("person")}
      onGiveBack={() => void setBrowserControl("agent")}
      onStop={async () => {
        if (await stopBrowser()) closeBrowserSheet();
      }}
    >
      {running && csrf ? (
        <Suspense
          fallback={<p className="sb-viewer-note">{txt.sheet.connecting}</p>}
        >
          <BrowserViewer csrf={csrf} viewOnly={mode === "view"} />
        </Suspense>
      ) : (
        <p className="sb-viewer-note">{txt.sheet.notRunning}</p>
      )}
    </BrowserSheet>
  );
}
