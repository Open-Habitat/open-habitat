import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { uploadAttachment } from "../../app/attachments";
import type {
  CommandList,
  FileList,
  FilePreview,
} from "../../app/composerReads";
import { AttachmentChips } from "../AttachmentChips";
import { Icon } from "../Icon";
import { InlineNotice } from "../Status";
import { type Availability, enabled, unavailableReason } from "../types";
import {
  type Choice,
  type ChoiceGroup,
  ChoiceList,
  flatChoices,
  optionId,
  pickable,
} from "./ChoiceList";
import {
  type CaretToken,
  caretToken,
  fileInsertion,
  fuzzyScore,
  isShell,
  shellCommand,
  shellExcluded,
  withLeadingCommand,
} from "./completion";
import { Palette, type PaletteTab } from "./Palette";
import "./composer.css";

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD = isMac ? "⌘" : "Ctrl";
const ALT = isMac ? "⌥" : "Alt";

type Mode = "steer" | "follow_up";
const MODE: Record<
  Mode,
  { label: string; queued: string; long: string; icon: "steer" | "queue" }
> = {
  steer: {
    label: "Ohjaa",
    queued: "Ohjaus",
    long: "Agentti saa viestin työn välivaiheessa",
    icon: "steer",
  },
  follow_up: {
    label: "Työn jälkeen",
    queued: "Työn jälkeen",
    long: "viesti lähtee, kun agentin vuoro päättyy",
    icon: "queue",
  },
};
const other = (m: Mode): Mode => (m === "steer" ? "follow_up" : "steer");

/** A browser action listed with Pi's commands; it runs at once. */
export type BrowserAction = {
  name: string;
  description: string;
  run: () => void;
};

/** What the field's lists read. The composer asks when a list opens. */
export type ComposerSources = {
  commands: (signal: AbortSignal) => Promise<CommandList>;
  files: (query: string, signal: AbortSignal) => Promise<FileList>;
  preview?: (path: string, signal: AbortSignal) => Promise<FilePreview>;
  browserActions?: BrowserAction[];
  /** For the list titles, e.g. the workspace's name. */
  workspaceName: string;
};

/** The conversation's `!` command as the host reports it. */
export type ComposerCommand = {
  command: string;
  excludeFromContext: boolean;
  state: "held" | "running";
  /** Epoch milliseconds the command started; absent while held. */
  startedAt?: number;
};

export type ComposerShell = {
  /** Where the command runs, shown in the field's label, e.g. ~/src/x. */
  workspaceLabel: string;
  running?: ComposerCommand;
  onRun: (command: string, excludeFromContext: boolean) => void;
  onStop: () => void;
  runAvailability?: Availability;
  stopState?: "pending" | "uncertain";
};

type Open =
  | ({ place: "caret"; sel: number } & CaretToken)
  | {
      place: "button";
      kind: "cmd" | "file";
      start: number;
      end: number;
      query: string;
      sel: number;
    }
  | {
      place: "palette";
      tab: PaletteTab;
      start: number;
      end: number;
      /** Accepting replaces start..end (an `@token` carried into it). */
      replace: boolean;
      query: string;
      sel: number;
      marks: Set<string>;
    };

const kindOf = (o: Open) =>
  o.place === "palette" ? (o.tab === "cmd" ? "cmd" : "file") : o.kind;

function mmss(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

/** The field's caret x within its box, for placing the caret list. */
function caretX(field: HTMLTextAreaElement, pos: number) {
  const style = getComputedStyle(field);
  const mirror = document.createElement("div");
  for (const k of [
    "font",
    "letterSpacing",
    "padding",
    "border",
    "boxSizing",
    "lineHeight",
  ] as const)
    mirror.style[k] = style[k];
  Object.assign(mirror.style, {
    position: "absolute",
    visibility: "hidden",
    whiteSpace: "pre-wrap",
    overflowWrap: "break-word",
    width: `${field.offsetWidth}px`,
    top: "0",
    left: "0",
  });
  mirror.textContent = field.value.slice(0, pos);
  const mark = document.createElement("span");
  mark.textContent = "​";
  mirror.appendChild(mark);
  field.parentElement?.appendChild(mirror);
  const x = mark.offsetLeft + field.offsetLeft;
  mirror.remove();
  return x;
}

/** Commands and files, read when a list opens. A command list is reused for
 * half a minute, then read again in the background while the old one shows. */
function useSources(sources: ComposerSources | undefined, open: Open | null) {
  const [commands, setCommands] = useState<{
    state: "idle" | "loading" | "ready" | "failed";
    list?: CommandList;
    at?: number;
  }>({ state: "idle" });
  const [files, setFiles] = useState<{
    state: "idle" | "loading" | "ready" | "failed";
    query: string;
    list?: FileList;
  }>({ state: "idle", query: "" });
  const kind = open ? kindOf(open) : null;
  const fileQuery = open && kind === "file" ? open.query : null;
  const wantCommands = kind === "cmd";
  // biome-ignore lint/correctness/useExhaustiveDependencies: reread only when a command list opens.
  useEffect(() => {
    if (!sources || !wantCommands) return;
    if (commands.at && Date.now() - commands.at < 30000) return;
    const abort = new AbortController();
    setCommands((c) => ({ ...c, state: c.list ? c.state : "loading" }));
    sources.commands(abort.signal).then(
      (list) => setCommands({ state: "ready", list, at: Date.now() }),
      () => {
        if (!abort.signal.aborted)
          setCommands((c) => (c.list ? c : { state: "failed" }));
      },
    );
    return () => abort.abort();
  }, [sources, wantCommands]);
  useEffect(() => {
    if (!sources || fileQuery === null) return;
    const abort = new AbortController();
    setFiles((f) => ({ ...f, state: "loading" }));
    const timer = window.setTimeout(() => {
      sources.files(fileQuery, abort.signal).then(
        (list) => setFiles({ state: "ready", query: fileQuery, list }),
        () => {
          if (!abort.signal.aborted)
            setFiles({ state: "failed", query: fileQuery });
        },
      );
    }, 120);
    return () => {
      window.clearTimeout(timer);
      abort.abort();
    };
  }, [sources, fileQuery]);
  return { commands, files };
}

const SOURCE: Record<string, string> = {
  skill: "Taito",
  prompt: "Pohja",
  extension: "Laajennus",
};
const SCOPE: Record<string, string> = {
  user: "oma",
  project: "projekti",
  builtin: "Agentti",
  temporary: "istunto",
};

function commandGroups(
  sources: ComposerSources | undefined,
  state: ReturnType<typeof useSources>["commands"],
  query: string,
  runsAtStart: boolean,
): ChoiceGroup[] {
  const groups: ChoiceGroup[] = [];
  const by = <T extends { s: number }>(a: T, b: T) => b.s - a.s;
  if (runsAtStart && sources?.browserActions?.length)
    groups.push({
      label: "Selain · ajetaan heti",
      choices: sources.browserActions
        .map((a) => ({ a, s: fuzzyScore(a.name, query) }))
        .filter((x) => x.s > 0)
        .sort(by)
        .map(
          ({ a }): Choice => ({
            type: "command",
            name: a.name,
            description: a.description,
            tag: "Selain",
            tone: "browser",
            run: a.run,
          }),
        ),
    });
  const label = runsAtStart
    ? "Agentti · lisätään viestin alkuun, ajetaan lähetettäessä"
    : "Agentti · mainitaan tekstinä";
  if (!state.list) {
    groups.push({
      label: "Agentti",
      choices: [
        state.state === "failed"
          ? {
              type: "status",
              text: "Agentin komentoja ei saatu. Kirjoita komento itse.",
            }
          : {
              type: "status",
              text: "Haetaan agentin komennot ja taidot työtilasta…",
              loading: true,
            },
      ],
    });
    return groups;
  }
  groups.push({
    label,
    // A native command inventory is not a browser capability list. Keep
    // known terminal dialogs out of every composer entry point (including
    // search), rather than offering disabled commands among runnable ones.
    choices: state.list.commands
      .filter((c) => !c.terminal_only)
      .map((c) => ({
        c,
        s: Math.max(
          fuzzyScore(c.name, query),
          fuzzyScore(c.description, query) * 0.4,
        ),
      }))
      .filter((x) => x.s > 0)
      .sort(by)
      .map(
        ({ c }): Choice => ({
          type: "command",
          name: c.name,
          description: c.description,
          tag: `${SOURCE[c.source]} · ${SCOPE[c.scope]}`,
          tone: c.source,
          terminalOnly: c.terminal_only,
        }),
      ),
  });
  return groups;
}

function fileGroups(
  state: ReturnType<typeof useSources>["files"],
  query: string,
  changedOnly: boolean,
): ChoiceGroup[] {
  if (!state.list || state.query !== query) {
    if (state.state === "failed")
      return [
        {
          label: "Tiedostot",
          choices: [
            { type: "status", text: "Tiedostolistaa ei saatu juuri nyt." },
          ],
        },
      ];
    if (!state.list)
      return [
        {
          label: "Tiedostot",
          choices: [
            { type: "status", text: "Haetaan tiedostoja…", loading: true },
          ],
        },
      ];
  }
  const files = (state.list?.files ?? []).filter((f) => !changedOnly || f.git);
  const choice = (f: (typeof files)[number]): Choice => ({
    type: "file",
    path: f.path,
    git: f.git,
  });
  return [
    {
      label: query ? "Osumat" : changedOnly ? "Muutetut" : "Tiedostot",
      choices: files.map(choice),
    },
  ];
}

export function Composer({
  value,
  csrf,
  availability = enabled,
  editorAvailability,
  activity,
  selectedWorkingMode,
  sendState,
  suppressAvailabilityReason = false,
  queue,
  queueKnown = true,
  onChange,
  onSendNow,
  onSteer,
  onFollowUp,
  onModeChange,
  onInterrupt,
  onStopWaiting,
  stopState,
  onRestoreQueue,
  restoreAvailability = enabled,
  modelPicker,
  shell,
  sources,
}: {
  value: string;
  csrf?: string;
  modelPicker?: ReactNode;
  availability?: Availability;
  editorAvailability?: Availability;
  activity: "idle" | "working" | "settling";
  selectedWorkingMode: Mode;
  sendState?: "idle" | "pending" | "rejected" | "uncertain";
  suppressAvailabilityReason?: boolean;
  /** Pi's queue while it works: shown as a card above the field. */
  queue?: { steering: string[]; followUp: string[] };
  queueKnown?: boolean;
  onChange: (value: string) => void;
  onSendNow: () => void;
  onSteer: () => void;
  onFollowUp: () => void;
  onModeChange: (mode: Mode) => void;
  /** Stops Pi's turn (Stop beside Send, and Esc in the field). */
  onInterrupt?: () => void;
  stopState?: "pending" | "uncertain";
  /** Messages wait for Pi to start: Stop takes them back before Pi runs. */
  onStopWaiting?: () => void;
  /** Takes Pi's queued messages back into the field. */
  onRestoreQueue?: () => void;
  restoreAvailability?: Availability;
  /** `!` commands; without it a leading `!` is ordinary text. */
  shell?: ComposerShell;
  /** `/`, `@`, the buttons and Ctrl/⌘+P; without it they are absent. */
  sources?: ComposerSources;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const uploadController = useRef<AbortController | null>(null);
  const draft = useRef({ value, onChange });
  draft.current = { value, onChange };
  const picker = useRef<HTMLInputElement>(null);
  const addFiles = useCallback(
    async (files: File[]) => {
      if (!csrf || uploadController.current || availability.state !== "enabled")
        return;
      if (
        files.length > 8 ||
        new Set(
          draft.current.value.match(/\/api\/v1\/attachments\/[a-f0-9-]{36}/g) ??
            [],
        ).size +
          files.length >
          8
      ) {
        setUploadError("Viestiin voi liittää enintään kahdeksan tiedostoa.");
        return;
      }
      const controller = new AbortController();
      uploadController.current = controller;
      setUploading(true);
      setUploadError("");
      try {
        for (const file of files.slice(0, 8)) {
          const uploaded = await uploadAttachment(
            file,
            csrf,
            controller.signal,
          );
          if (controller.signal.aborted) return;
          const current = draft.current;
          const next = `${current.value}${current.value ? "\n" : ""}${uploaded.reference}`;
          draft.current = { ...current, value: next };
          current.onChange(next);
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setUploadError(
            error instanceof Error
              ? error.message
              : "Liitteen tallennus epäonnistui.",
          );
      } finally {
        if (uploadController.current === controller) {
          uploadController.current = null;
          if (!controller.signal.aborted) setUploading(false);
        }
      }
    },
    [csrf, availability.state],
  );
  useEffect(() => {
    if (csrf) setUploading(false);
    return () => {
      uploadController.current?.abort();
      uploadController.current = null;
    };
  }, [csrf]);
  useEffect(() => {
    if (!csrf) return;
    const drag = (event: DragEvent) => {
      if (event.dataTransfer?.types.includes("Files")) event.preventDefault();
    };
    const drop = (event: DragEvent) => {
      if (!event.dataTransfer?.files.length) return;
      event.preventDefault();
      void addFiles(Array.from(event.dataTransfer.files));
    };
    document.addEventListener("dragover", drag);
    document.addEventListener("drop", drop);
    return () => {
      document.removeEventListener("dragover", drag);
      document.removeEventListener("drop", drop);
    };
  }, [csrf, addFiles]);
  const field = useRef<HTMLTextAreaElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId().replace(/:/g, "");
  const shellLabelId = `${listId}-shell`;
  const [open, setOpen] = useState<Open | null>(null);
  const [notice, setNotice] = useState("");
  const lastCaret = useRef<[number, number] | null>(null);
  const { commands, files } = useSources(sources, open);
  const working = activity === "working";
  const shellOn = !!shell && isShell(value);
  const running = shell?.running;
  const now = useNow(running?.state === "running");
  const stopping = stopState ?? shell?.stopState;
  const commandNotice =
    shellOn && running
      ? "Edellinen komento on vielä käynnissä. Pysäytä se ensin."
      : "";
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const groups = useMemo<ChoiceGroup[]>(() => {
    if (!open) return [];
    if (kindOf(open) === "cmd")
      return commandGroups(
        sources,
        commands,
        open.query,
        open.place !== "caret" || open.atStart,
      );
    return fileGroups(
      files,
      open.query,
      open.place === "palette" && open.tab === "changed",
    );
  }, [open, sources, commands, files]);
  const flat = useMemo(() => flatChoices(groups), [groups]);
  // A selection past the end, or on a status row, moves to the first pickable.
  const sel =
    open && open.sel >= 0 && !pickable(flat[open.sel])
      ? flat.findIndex(pickable)
      : (open?.sel ?? -1);

  const fieldAvailability = editorAvailability ?? availability;
  const fieldReason = unavailableReason(fieldAvailability);
  const fieldDisabled =
    Boolean(fieldReason) && fieldAvailability.state !== "read_only";
  const sendBlocked =
    uploading || sendState === "pending" || availability.state !== "enabled";
  const shellText = shellOn ? shellCommand(value) : "";
  const runBlocked =
    !shell ||
    !shellText ||
    !!running ||
    (shell.runAvailability && shell.runAvailability.state !== "enabled");
  const sendReady = shellOn ? !runBlocked : !!value.trim() && !sendBlocked;

  // ---- inserting text ----
  const replaceRange = useCallback(
    (start: number, end: number, text: string) => {
      const el = field.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start, end);
      // insertText keeps the browser's undo history, as typing does.
      if (!document.execCommand?.("insertText", false, text)) {
        const next = el.value.slice(0, start) + text + el.value.slice(end);
        onChange(next);
        requestAnimationFrame(() => {
          field.current?.setSelectionRange(
            start + text.length,
            start + text.length,
          );
        });
      }
    },
    [onChange],
  );
  const close = useCallback(
    (refocus?: boolean) => {
      const had = open;
      setOpen(null);
      if (refocus && had && field.current) {
        const el = field.current;
        el.focus();
        const at =
          had.place === "caret" || (had.place === "palette" && had.replace)
            ? had.end
            : had.start;
        el.setSelectionRange(at, had.place === "caret" ? at : had.end);
      }
    },
    [open],
  );
  const accept = (index: number) => {
    if (!open) return;
    const marked =
      open.place === "palette" && open.marks.size
        ? flat.filter((c) => c.type === "file" && open.marks.has(c.path))
        : [flat[index]].filter(Boolean);
    const first = marked[0];
    if (!first || first.type === "status") return;
    if (first.type === "command" && first.terminalOnly) {
      setNotice(
        `/${first.name} käyttää agentin päätteen valikkoja, joten sitä ei voi ajaa selaimesta.`,
      );
      return;
    }
    const o = open;
    setOpen(null);
    if (first.type === "command") {
      if (first.run) {
        if (o.place === "caret") replaceRange(o.start, o.end, "");
        first.run();
        return;
      }
      if (o.place === "caret" && o.atStart)
        return replaceRange(o.start, o.end, `/${first.name} `);
      if (o.place === "caret")
        return replaceRange(o.start, o.end, `/${first.name} `);
      const lead = withLeadingCommand(value, first.name);
      return replaceRange(lead.start, lead.end, lead.insert);
    }
    const paths = marked.flatMap((c) => (c.type === "file" ? [c.path] : []));
    const text = fileInsertion(paths, shellOn);
    if (o.place === "caret" || (o.place === "palette" && o.replace))
      return replaceRange(o.start, o.end, text);
    const pad = o.start > 0 && !/\s/.test(value[o.start - 1]) ? " " : "";
    replaceRange(o.start, o.end, pad + text);
  };
  const move = (d: number) => {
    if (!open || !flat.some((c) => c.type !== "status")) return;
    const n = flat.length;
    let i = sel < 0 ? (d > 0 ? -1 : n) : sel;
    do i = (i + d + n) % n;
    while (flat[i]?.type === "status");
    setOpen({ ...open, sel: i });
  };

  // ---- opening ----
  const fromText = (text: string, caret: number) => {
    if (!sources) return;
    if (open && open.place !== "caret") return;
    const t = caretToken(text, caret);
    if (!t) {
      if (open) setOpen(null);
      return;
    }
    const same =
      open?.place === "caret" && open.kind === t.kind && open.start === t.start;
    // A mid-line `/` opens with nothing highlighted, so Enter still sends.
    setOpen({
      place: "caret",
      ...t,
      sel: same ? open.sel : t.kind === "cmd" && !t.atStart ? -1 : 0,
    });
  };
  const fieldCaret = (): [number, number] => {
    const el = field.current;
    if (el && document.activeElement === el)
      return [el.selectionStart, el.selectionEnd];
    return lastCaret.current ?? [value.length, value.length];
  };
  const fromButton = (kind: "cmd" | "file") => {
    if (open?.place === "button" && open.kind === kind) return close(true);
    const [start, end] = fieldCaret();
    setOpen({ place: "button", kind, start, end, query: "", sel: 0 });
  };
  const toPalette = () => {
    if (!sources) return;
    const fromCaret = open?.place === "caret" && open.kind === "file";
    const [cs, ce] = fieldCaret();
    setOpen({
      place: "palette",
      tab: "all",
      start: fromCaret ? open.start : cs,
      end: fromCaret ? open.end : ce,
      replace: fromCaret,
      query: fromCaret ? open.query : "",
      sel: 0,
      marks: new Set(),
    });
  };

  // ---- what Stop stops, what Send does ----
  const stopTarget: { label: string; tip: string; run: () => void } | null =
    working && onInterrupt
      ? {
          label: "Pysäytä agentti",
          tip: "Pysäytä agentin työ heti (Esc kentässä)",
          run: onInterrupt,
        }
      : running && shell
        ? {
            label: `Pysäytä komento ${running.command}`,
            tip: `Pysäytä komento ${running.command} (Esc kentässä)`,
            run: shell.onStop,
          }
        : onStopWaiting && !working
          ? {
              label: "Pysäytä: viesti ei lähde",
              tip: "Pysäytä: viesti ei lähde",
              run: onStopWaiting,
            }
          : null;
  const send = (otherWay = false) => {
    if (shellOn) {
      if (running) return;
      if (!runBlocked && shell) shell.onRun(shellText, shellExcluded(value));
      return;
    }
    if (!value.trim() || sendBlocked) return;
    if (working) {
      const mode = otherWay ? other(selectedWorkingMode) : selectedWorkingMode;
      if (mode === "steer") onSteer();
      else onFollowUp();
    } else onSendNow();
  };
  const sendLabel = shellOn
    ? "Aja"
    : working
      ? MODE[selectedWorkingMode].label
      : "Lähetä";
  const sendTip = shellOn
    ? running
      ? "Edellinen komento on vielä käynnissä"
      : `Aja komento työtilassa ${shell?.workspaceLabel ?? ""} (Enter)`
    : working
      ? `${MODE[selectedWorkingMode].label}: ${MODE[selectedWorkingMode].long} (Enter). ${ALT}+Enter: ${MODE[other(selectedWorkingMode)].label.toLowerCase()}.`
      : "Lähetä (Enter)";

  // ---- keys ----
  const onFieldKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (
      mod &&
      !e.shiftKey &&
      !e.altKey &&
      e.key.toLowerCase() === "p" &&
      sources
    ) {
      e.preventDefault();
      return toPalette();
    }
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (open?.place === "caret") {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        return move(e.key === "ArrowDown" ? 1 : -1);
      }
      if (e.key === "Escape") {
        e.preventDefault();
        return setOpen(null);
      }
      if (
        (e.key === "Enter" && !e.shiftKey && !e.altKey && sel >= 0) ||
        (e.key === "Tab" && !e.shiftKey)
      ) {
        e.preventDefault();
        return accept(sel < 0 ? Math.max(0, flat.findIndex(pickable)) : sel);
      }
    }
    // Esc with nothing open stops what Stop stops, as Esc does in Pi's TUI.
    if (e.key === "Escape" && !e.defaultPrevented && stopTarget) {
      e.preventDefault();
      if (!stopping) stopTarget.run();
      return;
    }
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    // As in Pi's TUI: Enter sends the chosen way, Alt+Enter once the other way.
    send(e.altKey && working && !shellOn);
  };
  const listKeys = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || e.nativeEvent.isComposing) return;
    const mod = isMac ? e.metaKey : e.ctrlKey;
    if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "p") {
      e.preventDefault();
      e.stopPropagation();
      if (open.place === "palette") {
        const tabs: PaletteTab[] = ["all", "changed", "cmd"];
        const tab = tabs[(tabs.indexOf(open.tab) + 1) % tabs.length];
        return setOpen({ ...open, tab, sel: 0 });
      }
      return toPalette();
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      return move(e.key === "ArrowDown" ? 1 : -1);
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      return close(true);
    }
    if (e.key === "Tab" && !e.shiftKey) {
      e.preventDefault();
      if (open.place === "palette" && open.tab !== "cmd") {
        const c = flat[sel];
        if (c?.type !== "file") return;
        const marks = new Set(open.marks);
        if (marks.has(c.path)) marks.delete(c.path);
        else marks.add(c.path);
        const n = flat.length;
        let i = sel;
        do i = (i + 1) % n;
        while (flat[i]?.type === "status" && i !== sel);
        return setOpen({ ...open, marks, sel: i });
      }
      return accept(sel < 0 ? 0 : sel);
    }
    if (e.key === "Enter") {
      e.preventDefault();
      return accept(sel);
    }
  };
  // Ctrl/⌘+P from anywhere in the page that is not another text input.
  const palette = useRef(toPalette);
  palette.current = toPalette;
  useEffect(() => {
    if (!sources) return;
    const onKey = (e: KeyboardEvent) => {
      const mod = isMac ? e.metaKey : e.ctrlKey;
      if (
        !mod ||
        e.shiftKey ||
        e.altKey ||
        e.key.toLowerCase() !== "p" ||
        e.defaultPrevented
      )
        return;
      const target = e.target as HTMLElement | null;
      if (target?.closest?.(".ah-choice-pop, .ah-palette")) return;
      if (
        target &&
        target !== field.current &&
        (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
          target.isContentEditable)
      )
        return;
      e.preventDefault();
      palette.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sources]);
  // A button's list closes on a press outside the composer.
  useEffect(() => {
    if (open?.place !== "button") return;
    const down = (e: MouseEvent) => {
      if (!box.current?.closest(".ah-composer")?.contains(e.target as Node))
        setOpen(null);
    };
    document.addEventListener("mousedown", down);
    return () => document.removeEventListener("mousedown", down);
  }, [open?.place]);

  // ---- the list beside the field ----
  const headText = !open
    ? ""
    : kindOf(open) === "cmd"
      ? open.place !== "caret" || open.atStart
        ? "Komennot ja taidot"
        : "Mainitse komento: agentti ajaa komennon vain viestin alussa"
      : shellOn
        ? "Tiedostot · lisätään komentoon polkuna"
        : `Tiedostot · ${sources?.workspaceName ?? ""}`;
  const [popLeft, setPopLeft] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: placement follows the open token.
  useEffect(() => {
    if (!open || open.place === "palette" || !box.current || !field.current)
      return;
    const width = Math.min(
      box.current.clientWidth,
      kindOf(open) === "cmd" ? 460 : 400,
    );
    let left = 0;
    if (open.place === "button") {
      const b = box.current.querySelector<HTMLElement>(
        `[data-composer-list="${open.kind}"]`,
      );
      left = b ? b.offsetLeft - 4 : 0;
    } else left = caretX(field.current, open.start) - 14;
    setPopLeft(Math.max(0, Math.min(left, box.current.clientWidth - width)));
  }, [
    open?.place,
    open && kindOf(open),
    open?.place === "palette" ? 0 : open?.start,
  ]);
  const pop =
    open && open.place !== "palette" ? (
      // biome-ignore lint/a11y: a press inside the list keeps focus in the field; the list's keys stay with the field.
      <div
        className="ah-choice-pop"
        data-kind={open.kind}
        style={{ left: popLeft }}
        onMouseDown={(e) => {
          if (!(e.target as HTMLElement).closest("input")) e.preventDefault();
        }}
      >
        <div className="ah-choice-head">{headText}</div>
        {open.place === "button" ? (
          <label className="ah-choice-search">
            <Icon name={open.kind === "cmd" ? "slash" : "at"} />
            <input
              data-testid="command-search"
              // biome-ignore lint/a11y/noAutofocus: the button opened this search; focus goes to it as in the chosen round.
              autoFocus
              type="text"
              className="ah-choice-search-input"
              autoComplete="off"
              spellCheck={false}
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-activedescendant={
                sel >= 0 ? optionId(listId, sel) : undefined
              }
              aria-label={
                open.kind === "cmd"
                  ? "Hae komentoa tai taitoa"
                  : "Hae tiedostoa"
              }
              placeholder={
                open.kind === "cmd"
                  ? "Hae komentoa tai taitoa"
                  : "Hae tiedostoa"
              }
              value={open.query}
              onChange={(e) =>
                setOpen({ ...open, query: e.target.value, sel: 0 })
              }
              onKeyDown={listKeys}
            />
          </label>
        ) : null}
        <ChoiceList
          id={listId}
          label={headText}
          groups={groups}
          selected={sel}
          emptyText={`Ei osumia${open.query ? ` haulle “${open.query}”` : ""}.`}
          onPick={accept}
          onHover={(i) => setOpen({ ...open, sel: i })}
        />
        <div className="ah-choice-keys">
          {open.place === "caret" && sel < 0 ? (
            <>
              <kbd>Tab</kbd> lisää ylimmän · <kbd>↓</kbd> valitsee ·{" "}
              <kbd>Enter</kbd> lähettää tekstin sellaisenaan · <kbd>Esc</kbd>{" "}
              sulje
            </>
          ) : (
            <>
              <kbd>↑</kbd>
              <kbd>↓</kbd> valitse · <kbd>Enter</kbd> lisää · <kbd>Esc</kbd>{" "}
              sulje
              {open.kind === "file" ? (
                <>
                  {" "}
                  · <kbd>{MOD}</kbd>
                  <kbd>P</kbd> valitsin
                </>
              ) : null}
            </>
          )}
        </div>
      </div>
    ) : null;

  // ---- the area's parts ----
  // Equal texts may repeat in Pi's queue; the nth occurrence is the key.
  const seen = new Map<string, number>();
  const queued = [
    ...(queue?.steering ?? []).map((text) => ({ kind: "steer" as Mode, text })),
    ...(queue?.followUp ?? []).map((text) => ({
      kind: "follow_up" as Mode,
      text,
    })),
  ].map((q) => {
    const id = `${q.kind}:${q.text}`;
    const n = (seen.get(id) ?? 0) + 1;
    seen.set(id, n);
    return { ...q, key: `${id}:${n}` };
  });
  const queueCard =
    queued.length || (!queueKnown && working) ? (
      <section
        data-testid="composer-queue"
        className="ah-cq"
        aria-label="Odottaa agenttia"
      >
        <div className="ah-cq-head">
          <span>
            Odottaa agenttia{" "}
            {queueKnown ? (
              <span className="ah-cq-n">{queued.length}</span>
            ) : null}
          </span>
          {onRestoreQueue && queued.length ? (
            <button
              data-testid="composer-restore-queue"
              type="button"
              className="ah-cq-restore"
              title="Ottaa viestit pois agentin jonosta ja palauttaa ne kenttään muokattavaksi. Jo toimitettua ohjausta ei voi ottaa takaisin."
              disabled={restoreAvailability.state !== "enabled"}
              onClick={onRestoreQueue}
            >
              <Icon name="restore" />
              <span>Palauta kenttään</span>
            </button>
          ) : null}
        </div>
        {queueKnown ? (
          <ul className="ah-cq-list">
            {queued.map((q) => (
              <li key={q.key} className={`ah-cq-row ah-cq-${q.kind}`}>
                <span className="ah-cq-kind">
                  <Icon name={MODE[q.kind].icon} />
                  {MODE[q.kind].queued}
                </span>
                <span className="ah-cq-text">{q.text}</span>
                <span className="ah-cq-when">
                  {q.kind === "steer" ? (
                    <>
                      <span className="ah-choice-dot" aria-hidden="true" />
                      seuraavassa välivaiheessa
                    </>
                  ) : (
                    "kun vuoro päättyy"
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ah-cq-unknown">Jonon tila ei tiedossa</p>
        )}
      </section>
    ) : null;
  const shellLabel = shellOn ? (
    <span
      data-testid="command-mode"
      data-excluded={shellExcluded(value)}
      className="ah-crow-shell"
      id={shellLabelId}
    >
      <span className="ah-crow-bang" aria-hidden="true">
        {shellExcluded(value) ? "!!" : "!"}
      </span>
      <span className="ah-crow-shelltext">
        Komento työtilassa <code>{shell?.workspaceLabel}</code>
      </span>
      <span data-testid="command-context" className="ah-crow-ctx">
        {shellExcluded(value)
          ? "vain sinulle, ei agentille"
          : "Agentti näkee tulosteen"}
      </span>
    </span>
  ) : null;
  const listButton = (kind: "cmd" | "file") => (
    <button
      data-testid={kind === "cmd" ? "command-palette" : "file-picker"}
      type="button"
      className="ah-crow-btn"
      data-composer-list={kind}
      aria-haspopup="listbox"
      aria-expanded={open?.place === "button" && open.kind === kind}
      aria-label={kind === "cmd" ? "Komennot" : "Tiedosto"}
      title={
        kind === "cmd"
          ? "Komennot ja taidot · kirjoita myös / kentässä"
          : `Tiedosto · kirjoita myös @ kentässä, ${MOD}+P avaa valitsimen`
      }
      disabled={fieldDisabled}
      onMouseDown={(e) => {
        lastCaret.current = fieldCaret();
        e.preventDefault();
      }}
      onClick={() => fromButton(kind)}
    >
      <Icon name={kind === "cmd" ? "slash" : "at"} />
      <span className="ah-crow-lbl">
        {kind === "cmd" ? "Komennot" : "Tiedosto"}
      </span>
    </button>
  );
  const busy = working || !!running;
  const placeholder = shellOn
    ? ""
    : !working
      ? "Kirjoita agentille…"
      : `${selectedWorkingMode === "steer" ? "Ohjaa agenttia" : "Kirjoita, mitä agentti tekee työn jälkeen"}… · ${ALT}+Enter: ${MODE[other(selectedWorkingMode)].label.toLowerCase()}`;

  return (
    <section
      className={`ah-composer${!value.trim() && availability.state === "enabled" ? " ah-composer-empty" : ""}${suppressAvailabilityReason ? " ah-composer-notice-explains-block" : ""}`}
      aria-label="Kirjoita viesti"
    >
      {queueCard}
      <AttachmentChips text={value} />
      {csrf ? (
        <>
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              void addFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />
          {uploading ? <p role="status">Tallennetaan liitettä…</p> : null}
          {uploadError ? <p role="alert">{uploadError}</p> : null}
        </>
      ) : null}
      <div
        ref={box}
        className={`ah-cbox${shellOn ? " ah-cbox-shell" : ""}${fieldDisabled ? " ah-cbox-disabled" : ""}`}
      >
        <textarea
          data-testid="message-input"
          data-working={working}
          ref={field}
          className="ah-cbox-field"
          aria-label="Viesti agentille"
          aria-describedby={shellOn ? shellLabelId : undefined}
          aria-autocomplete={sources ? "list" : undefined}
          aria-controls={open && open.place === "caret" ? listId : undefined}
          aria-activedescendant={
            open?.place === "caret" && sel >= 0
              ? optionId(listId, sel)
              : undefined
          }
          placeholder={placeholder}
          rows={1}
          spellCheck={!shellOn}
          value={value}
          disabled={fieldDisabled}
          readOnly={fieldAvailability.state === "read_only"}
          onChange={(e) => {
            onChange(e.target.value);
            fromText(e.target.value, e.target.selectionStart);
          }}
          onPaste={(event) => {
            const images = Array.from(event.clipboardData.files).filter(
              (file) => file.type.startsWith("image/"),
            );
            if (csrf && images.length) {
              event.preventDefault();
              void addFiles(images);
            }
          }}
          onKeyDown={onFieldKey}
          onKeyUp={(e) => {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key))
              fromText(e.currentTarget.value, e.currentTarget.selectionStart);
          }}
          onClick={(e) =>
            fromText(e.currentTarget.value, e.currentTarget.selectionStart)
          }
          onBlur={(e) => {
            lastCaret.current = [
              e.currentTarget.selectionStart,
              e.currentTarget.selectionEnd,
            ];
            window.setTimeout(() => {
              setOpen((o) =>
                o?.place === "caret" &&
                !box.current?.contains(document.activeElement)
                  ? null
                  : o,
              );
            }, 120);
          }}
        />
        <div className={`ah-crow${busy ? " ah-crow-busy" : ""}`}>
          {csrf ? (
            <button
              data-testid="attach-file"
              type="button"
              className="ah-crow-btn"
              aria-label="Liitä tiedosto"
              title="Liitä tiedosto (enintään 20 MiB)"
              disabled={uploading || availability.state !== "enabled"}
              onClick={() => picker.current?.click()}
            >
              <Icon name="paperclip" />
              <span className="ah-crow-lbl">Liitä</span>
            </button>
          ) : null}
          {sources ? (
            <>
              {shellOn ? shellLabel : listButton("cmd")}
              {listButton("file")}
            </>
          ) : (
            shellLabel
          )}
          <span className="ah-crow-grow" />
          {modelPicker ? (
            <div className="ah-composer-model">{modelPicker}</div>
          ) : null}
          {working && !shellOn ? (
            <button
              data-testid="composer-mode"
              data-mode={selectedWorkingMode}
              type="button"
              className={`ah-crow-chip ah-crow-chip-${selectedWorkingMode}`}
              aria-label={`Viestin tapa: ${MODE[selectedWorkingMode].label}. Vaihda: ${MODE[other(selectedWorkingMode)].label}`}
              title={`${MODE[selectedWorkingMode].label}: ${MODE[selectedWorkingMode].long}. Vaihda: ${ALT}+Enter lähettää kerran toisella tavalla.`}
              onClick={() => onModeChange(other(selectedWorkingMode))}
            >
              <Icon name={MODE[selectedWorkingMode].icon} />
              <span>{MODE[selectedWorkingMode].label}</span>
              <Icon name="swap" className="ah-crow-swap" />
            </button>
          ) : null}
          {running && !working ? (
            <span
              className="ah-crow-run"
              title={
                running.state === "held"
                  ? "Odottaa agentin käynnistymistä"
                  : "Komento ajossa"
              }
            >
              <span className="ah-crow-bang" aria-hidden="true">
                {running.excludeFromContext ? "!!" : "!"}
              </span>
              <code>{running.command}</code>
              <span className="ah-crow-clock">
                {running.state === "held" || running.startedAt === undefined
                  ? "odottaa"
                  : mmss(now - running.startedAt)}
              </span>
            </span>
          ) : null}
          {stopTarget ? (
            <button
              data-testid="composer-stop"
              data-stop-target={
                working && onInterrupt
                  ? "agent"
                  : running && shell
                    ? "command"
                    : "unsent"
              }
              type="button"
              className="ah-crow-stop"
              aria-label={stopTarget.label}
              title={stopTarget.tip}
              disabled={!!stopping}
              onClick={stopTarget.run}
            >
              <Icon name="stop" />
            </button>
          ) : null}
          <button
            data-mode={
              shellOn ? "shell" : working ? selectedWorkingMode : "send"
            }
            data-testid="send"
            type="button"
            className="ah-crow-send"
            aria-label={sendLabel}
            title={sendTip}
            aria-disabled={!sendReady || undefined}
            aria-busy={sendState === "pending" || undefined}
            onClick={() => {
              if (sendReady) send();
              else if (shellOn && running) send();
            }}
          >
            <Icon name={shellOn ? "run" : "up"} />
          </button>
        </div>
        {pop}
      </div>
      {fieldReason && !suppressAvailabilityReason ? (
        <p className="ah-control-reason ah-composer-reason">{fieldReason}</p>
      ) : null}
      {stopping || commandNotice || notice ? (
        <p
          data-testid="composer-notice"
          data-stopping={stopping}
          className="ah-composer-notice"
          role="status"
        >
          {stopping === "pending" ? (
            <>
              <span className="ah-command-spinner" aria-hidden="true" />{" "}
              Keskeytetään…
            </>
          ) : stopping === "uncertain" ? (
            "Työn päättymistä ei tiedetä. Tarkista tila."
          ) : (
            commandNotice || notice
          )}
        </p>
      ) : null}
      {sendState === "rejected" ? (
        <InlineNotice
          title="Viesti hylättiin"
          description="Teksti säilytettiin. Korjaa syy ja lähetä tarkoituksella uudelleen."
          tone="danger"
        />
      ) : null}
      {open?.place === "palette" && sources ? (
        <Palette
          listId={listId}
          tab={open.tab}
          query={open.query}
          groups={groups}
          selected={sel}
          marks={open.marks}
          shell={shellOn}
          changedCount={
            files.list && !open.query
              ? files.list.files.filter((f) => f.git).length
              : undefined
          }
          preview={sources.preview}
          onQuery={(query) => setOpen({ ...open, query, sel: 0 })}
          onTab={(tab) => setOpen({ ...open, tab, sel: 0 })}
          onPick={accept}
          onHover={(i) => setOpen({ ...open, sel: i })}
          onKeyDown={listKeys}
          onClose={() => close(true)}
        />
      ) : null}
    </section>
  );
}
