import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  RewindMenu,
  RewindRow,
  RewindSheet,
  type RewindWhat,
} from "../components/Rewind";
import { formatDate, liveText } from "../i18n";
import { rewindText } from "../text/rewind";
import { continueConversation, status } from "./conversations";
import type { HistoryEntry } from "./history";
import {
  type RewindBranch,
  RewindFailed,
  type RewindPreview,
  type RewindRequest,
  readRewindBranch,
  readRewindPreview,
  sendRewind,
} from "./rewind";

const txt = liveText(rewindText);

/** What a timeline needs from Palaa tähän: the own message's menu and the
 * history row's actions. Absent where the feature is off or the view cannot
 * write (a read-only history still shows the rows, without actions). */
export type RewindControls = {
  menu: (entry: HistoryEntry) => ReactNode;
  row: (entry: HistoryEntry, entries: HistoryEntry[]) => ReactNode;
};
export const RewindContext = createContext<RewindControls | undefined>(
  undefined,
);

/** Timeline items that can reach Palaa tähän's controls. */
export function withRewind<T extends { content: ReactNode }>(
  items: T[],
  controls: RewindControls | undefined,
): T[] {
  if (!controls) return items;
  return items.map((item) => ({
    ...item,
    content: (
      <RewindContext.Provider value={controls}>
        {item.content}
      </RewindContext.Provider>
    ),
  }));
}

/** A message's time as the person reads it on the timeline. */
function timeOf(entry?: HistoryEntry): string | undefined {
  const at = entry?.timestamp ? Date.parse(entry.timestamp) : Number.NaN;
  return Number.isNaN(at)
    ? undefined
    : formatDate(at, { hour: "numeric", minute: "2-digit" });
}

/** The text that goes back into the field: what the person wrote. */
function draftText(entry: HistoryEntry): string {
  const text =
    entry.content.text ||
    (entry.blocks ?? [])
      .filter((b) => b.type === "text")
      .map((b) => b.text ?? "")
      .join("\n");
  return entry.skill
    ? `/skill:${entry.skill.name}${text ? ` ${text}` : ""}`
    : text;
}

/** The row for a marker entry, wherever a timeline is drawn. */
export function RewindEntryRow({
  entry,
  entries,
}: {
  entry: HistoryEntry;
  entries: HistoryEntry[];
}) {
  const controls = useContext(RewindContext);
  if (!entry.rewind) return null;
  if (controls) return <>{controls.row(entry, entries)}</>;
  return (
    <RewindRow
      marker={entry.rewind}
      time={timeOf(entries.find((e) => e.entry_key === entry.rewind?.at))}
    />
  );
}

type Sheet = {
  entry: HistoryEntry;
  preview?: RewindPreview;
  state: "loading" | "ready" | "failed";
};
type BranchView = {
  open: boolean;
  branch?: RewindBranch;
  state: "loading" | "ready" | "failed";
};

/** Palaa tähän in a writable conversation: the sheet, the rows' actions
 * and the one write. A resting conversation is woken first, as a send
 * would wake it; a running turn is stopped by the extension when the
 * person chose to (the go button says so). */
export function useRewind({
  id,
  csrf,
  enabled,
  busy,
  stopped,
  workspaceId,
  onLogin,
  onDraft,
  onChanged,
  renderEntries,
}: {
  id?: string;
  csrf?: string;
  enabled: boolean;
  busy: boolean;
  stopped: boolean;
  workspaceId: string;
  onLogin: () => void;
  /** Puts the chosen message back into the field. */
  onDraft: (text: string) => void;
  /** The active branch changed: the timeline reads it again. */
  onChanged: () => void;
  renderEntries: (entries: HistoryEntry[]) => ReactNode;
}): {
  controls?: RewindControls;
  sheet: ReactNode;
  /** The chosen message while the sheet is open; it and what follows dim. */
  target?: string;
} {
  const [sheet, setSheet] = useState<Sheet>();
  const [pending, setPending] = useState<string>();
  const [error, setError] = useState<{ key: string; text: string }>();
  const [branches, setBranches] = useState<Record<string, BranchView>>({});
  const reading = useRef<AbortController | null>(null);
  const live = useRef({ busy, stopped, workspaceId, id });
  live.current = { busy, stopped, workspaceId, id };
  // A different conversation, or the feature turned off, closes everything.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reset on the conversation and the switch only.
  useEffect(() => {
    reading.current?.abort();
    setSheet(undefined);
    setError(undefined);
    setBranches({});
  }, [id, enabled]);
  useEffect(() => () => reading.current?.abort(), []);
  // The chosen message comes to the top, the sheet over what follows it.
  const target = enabled ? sheet?.entry.entry_key : undefined;
  useEffect(() => {
    if (!target) return;
    const frame = requestAnimationFrame(() =>
      document
        .querySelector("[data-rewind-target]")
        ?.scrollIntoView({ block: "start" }),
    );
    return () => cancelAnimationFrame(frame);
  }, [target]);

  const fail = (key: string, e: unknown) => {
    if (e instanceof RewindFailed) {
      if (e.reason === "login") return onLogin();
      return setError({
        key,
        text: e.reason === "stopped" ? txt.failed.start : txt.failed[e.reason],
      });
    }
    if ((e as Error)?.message === "identity_lost") return onLogin();
    // The wake was refused or did not finish (ContinuationRefused and the
    // status reads); nothing was asked of Pi.
    setError({ key, text: txt.failed.start });
  };

  // Pi must be running for its extension to act. The wake is the same one
  // typing starts; the write follows once Pi is idle.
  const ready = async (conversation: string) => {
    if (!csrf) throw new RewindFailed("unavailable");
    await continueConversation(conversation, live.current.workspaceId, csrf);
    const until = Date.now() + 20000;
    while (Date.now() < until) {
      const now = await status(conversation);
      if (now.state === "idle") return;
      if (now.state === "start_failed" || now.state === "stopped")
        throw new RewindFailed("unavailable");
      await new Promise((r) => setTimeout(r, 400));
    }
    throw new RewindFailed("unavailable");
  };

  const act = async (key: string, body: RewindRequest): Promise<boolean> => {
    const conversation = live.current.id;
    if (!conversation || !csrf || pending) return false;
    setPending(key);
    setError(undefined);
    try {
      let woken = live.current.stopped;
      if (woken) await ready(conversation);
      try {
        await sendRewind(
          conversation,
          { ...body, stop: live.current.busy },
          csrf,
        );
      } catch (e) {
        // A definite refusal wrote nothing: Pi was not running after all.
        if (!(e instanceof RewindFailed) || e.reason !== "stopped" || woken)
          throw e;
        woken = true;
        await ready(conversation);
        await sendRewind(conversation, { ...body, stop: false }, csrf);
      }
      return true;
    } catch (e) {
      fail(key, e);
      return false;
    } finally {
      setPending(undefined);
      onChanged();
    }
  };

  const choose = (entry: HistoryEntry) => {
    if (!id) return;
    reading.current?.abort();
    const controller = new AbortController();
    reading.current = controller;
    setError(undefined);
    setSheet({ entry, state: "loading" });
    readRewindPreview(id, entry.entry_key, controller.signal)
      .then((preview) => {
        if (!controller.signal.aborted)
          setSheet((s) =>
            s?.entry.entry_key === entry.entry_key
              ? { ...s, preview, state: "ready" }
              : s,
          );
      })
      .catch((e) => {
        if (controller.signal.aborted) return;
        if ((e as Error).message === "identity_lost") onLogin();
        setSheet((s) =>
          s?.entry.entry_key === entry.entry_key
            ? { ...s, state: "failed" }
            : s,
        );
      });
  };

  const go = async (what: RewindWhat) => {
    if (!sheet) return;
    const entry = sheet.entry;
    const done = await act(entry.entry_key, {
      action: "rewind",
      entry_key: entry.entry_key,
      conversation: what !== "files",
      files: what !== "conversation",
    });
    if (!done) return;
    setSheet(undefined);
    if (what !== "files") onDraft(draftText(entry));
  };

  const toggle = (key: string) => {
    const old = branches[key];
    if (old?.open) {
      setBranches((b) => ({ ...b, [key]: { ...old, open: false } }));
      return;
    }
    setBranches((b) => ({
      ...b,
      [key]: {
        open: true,
        state: old?.branch ? "ready" : "loading",
        branch: old?.branch,
      },
    }));
    if (old?.branch || !id) return;
    readRewindBranch(id, key)
      .then((branch) =>
        setBranches((b) => ({
          ...b,
          [key]: { ...b[key], branch, state: "ready" },
        })),
      )
      .catch((e) => {
        if ((e as Error).message === "identity_lost") onLogin();
        setBranches((b) => ({ ...b, [key]: { ...b[key], state: "failed" } }));
      });
  };

  const controls: RewindControls | undefined = enabled
    ? {
        menu: (entry) => (
          <RewindMenu
            testId={`message-menu-${entry.entry_key}`}
            onChoose={() => choose(entry)}
          />
        ),
        row: (entry, entries) => {
          const marker = entry.rewind;
          if (!marker) return null;
          const key = entry.entry_key;
          const view = branches[key];
          const undone = entries.some(
            (e) => e.rewind?.action === "undo" && e.rewind.of === key,
          );
          const continuation =
            view?.state === "loading" ? (
              <p className="ah-rewind-meta">{txt.branchLoading}</p>
            ) : view?.state === "failed" ? (
              <p className="ah-rewind-meta">{txt.branchFailed}</p>
            ) : view?.branch ? (
              <>
                {!view.branch.complete ? (
                  <p className="ah-rewind-meta">{txt.branchPartial}</p>
                ) : null}
                {view.branch.entries.length ? (
                  // The replaced continuation is read, not gone back into.
                  <RewindContext.Provider value={undefined}>
                    {renderEntries(view.branch.entries)}
                  </RewindContext.Provider>
                ) : (
                  <p className="ah-rewind-meta">{txt.branchEmpty}</p>
                )}
              </>
            ) : null;
          return (
            <RewindRow
              marker={marker}
              time={timeOf(entries.find((e) => e.entry_key === marker.at))}
              undone={undone}
              open={!!view?.open}
              onToggle={marker.switchable ? () => toggle(key) : undefined}
              continuation={continuation}
              pending={pending === key}
              error={error?.key === key ? error.text : undefined}
              onSwitch={(files) =>
                void act(key, {
                  action: "switch",
                  marker_key: key,
                  files,
                }).then((done) => {
                  if (done) setBranches({});
                })
              }
              onUndo={() => void act(key, { action: "undo", marker_key: key })}
            />
          );
        },
      }
    : undefined;

  return {
    controls,
    target,
    sheet:
      enabled && sheet ? (
        <RewindSheet
          key={sheet.entry.entry_key}
          time={timeOf(sheet.entry)}
          preview={sheet.preview}
          previewState={sheet.state}
          busy={busy}
          pending={pending === sheet.entry.entry_key}
          error={error?.key === sheet.entry.entry_key ? error.text : undefined}
          onCancel={() => {
            reading.current?.abort();
            setSheet(undefined);
            setError(undefined);
          }}
          onGo={(what) => void go(what)}
        />
      ) : null,
  };
}
