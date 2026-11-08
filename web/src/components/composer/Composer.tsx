import {
  type ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { uploadAttachment } from "../../app/attachments";
import type {
  CommandList,
  FileList,
  FilePreview,
  FileTree,
  TreeFolder,
} from "../../app/composerReads";
import { resolveSkillAlias } from "../../app/composerReads";
import {
  attachmentOverflow,
  messageAttachmentCount,
} from "../../app/largeContent";
import { blockAutomaticReload } from "../../app/reloadSafety";
import { useText } from "../../i18n";
import { composerText } from "../../text/composer";
import { fieldListText } from "../../text/fieldList";
import { largeContentText } from "../../text/largeContent";
import {
  AttachmentChips,
  attachmentsIn,
  joinAttachments,
  messageText,
  splitAttachments,
} from "../AttachmentChips";
import { Icon } from "../Icon";
import { TooltipButton } from "../QuickTooltip";
import { InlineNotice } from "../Status";
import { type Availability, enabled, unavailableReason } from "../types";
import { WarningBanner } from "../WarningBanner";
import { AttachmentMenu } from "./AttachmentMenu";
import {
  type Choice,
  type ChoiceGroup,
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
import {
  type ComposerSpeech,
  DictationBar,
  DictationCeiling,
  DictationLive,
  DictationNoticeView,
  DictationSlotControl,
  useDictation,
  useDictationShortcut,
} from "./Dictation";
import { FieldList } from "./FieldList";
import {
  autoSelect,
  type Folding,
  foldersToRead,
  revealFolding,
  searchChoices,
  sideways,
  toggleFolder,
  treeChoices,
  unfolded,
} from "./fieldTree";
import {
  type ComposerGoal,
  cutPreparedPlaceholder,
  GoalChip,
  joinGoal,
  splitGoal,
  unwrapGoal,
} from "./GoalChip";
import "./composer.css";

const isMac =
  typeof navigator !== "undefined" &&
  /Mac|iPhone|iPad/.test(navigator.platform);
export const MOD = isMac ? "⌘" : "Ctrl";
const ALT = isMac ? "⌥" : "Alt";
// A touch screen, where focusing the field opens the keyboard (the same
// query composer.css uses for the field's size there).
const touchScreen = () =>
  typeof window.matchMedia === "function" &&
  window.matchMedia("(pointer: coarse)").matches;
// After an attachment the person goes on writing or dictating about it. On
// a touch screen focusing would open the keyboard, so there the field takes
// the focus only if it had it.
const focusAfterAttach = (hadFocus: boolean) => !touchScreen() || hadFocus;

type Mode = "steer" | "follow_up";
const modeIcon: Record<Mode, "steer" | "queue"> = {
  steer: "steer",
  follow_up: "queue",
};
type Text = typeof composerText.fi;
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
  /** rank "name": the in-field search's order, the file's own name first. */
  files: (
    query: string,
    signal: AbortSignal,
    rank?: "name",
  ) => Promise<FileList>;
  preview?: (path: string, signal: AbortSignal) => Promise<FilePreview>;
  /** The in-field list's folders: the tree as it opens (null) or one folder
   * with the folders above it. */
  tree?: (folder: string | null, signal: AbortSignal) => Promise<FileTree>;
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

/** The in-field list's selection and expanded folders. */
type InField = {
  /** Marked paths in marking order; a folder's ends with a slash. */
  marks: string[];
  folding: Folding;
  /** Lista's → : the file the tree shows once the search is cleared. */
  reveal?: string;
  /** The row in hand by what it is, so a folder read that adds rows above
   * it does not move the selection to another row. */
  selKey?: string;
};
const fresh: InField = { marks: [], folding: unfolded, selKey: undefined };
/** A row's identity in the in-field list. */
const rowKey = (c: Choice | undefined) =>
  !c || c.type === "status"
    ? undefined
    : c.type === "command"
      ? `command:${c.tone}:${c.name}`
      : `${c.type}:${c.path}`;
/** The in-field list lets the rows pick where the selection rests. */
const AUTO = -2;

type Open =
  | ({ place: "caret"; sel: number } & CaretToken & InField)
  | ({
      place: "button";
      kind: "cmd" | "file";
      start: number;
      end: number;
      query: string;
      sel: number;
      /** Accepting replaces start..end (an `@token` carried into it). */
      replace?: boolean;
    } & InField);

const kindOf = (o: Open) => o.kind;

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

/** The caret's line top within the field as the field shows it now. */
function caretTop(field: HTMLTextAreaElement, pos: number) {
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
    width: `${field.clientWidth}px`,
    top: "0",
    left: "0",
  });
  mirror.textContent = field.value.slice(0, pos);
  const mark = document.createElement("span");
  mark.textContent = "\u200b";
  mirror.appendChild(mark);
  field.parentElement?.appendChild(mirror);
  const y = mark.offsetTop;
  mirror.remove();
  return {
    y,
    line: Number.parseFloat(style.lineHeight) || 22,
    pad: Number.parseFloat(style.paddingTop) || 0,
  };
}

/** Commands and files, read when a list opens. A command list is reused for
 * half a minute, then read again in the background while the old one shows.
 * The list reads its search ranked by name and browses
 * the folder tree, read when it opens and a folder at a time after that. */
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
  // The in-field list browses the tree without a search.
  const fileQuery = open && kind === "file" && open.query ? open.query : null;
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
      sources.files(fileQuery, abort.signal, "name").then(
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

  // The tree lives while the in-field file list is open; it is read the
  // first time the list browses, and forgotten when the list closes.
  const treeSource = sources?.tree;
  const treeOpen = !!treeSource && kind === "file";
  const browsing = treeOpen && !open?.query;
  const [tree, setTree] = useState<TreeState>(idleTree);
  const session = useRef<AbortController | null>(null);
  const inFlight = useRef(new Set<string>());
  const known = useRef(tree);
  known.current = tree;
  useEffect(() => {
    if (treeOpen) return;
    session.current?.abort();
    session.current = null;
    inFlight.current.clear();
    setTree(idleTree);
  }, [treeOpen]);
  useEffect(() => () => session.current?.abort(), []);
  const merge = useCallback((reply: FileTree) => {
    setTree((t) => {
      const listings = new Map(t.listings);
      for (const f of reply.folders) listings.set(f.path, f);
      return { ...t, state: "ready", listings, changed: reply.changed };
    });
  }, []);
  useEffect(() => {
    if (!browsing || !treeSource || session.current) return;
    const abort = new AbortController();
    session.current = abort;
    setTree({ ...idleTree, state: "loading" });
    treeSource(null, abort.signal).then(
      (reply) => {
        if (!abort.signal.aborted) merge(reply);
      },
      () => {
        if (!abort.signal.aborted) setTree((t) => ({ ...t, state: "failed" }));
      },
    );
  }, [browsing, treeSource, merge]);
  /** Reads folders the tree shows open, or the preview shows, unread. */
  const readFolders = useCallback(
    (folders: string[]) => {
      const abort = session.current;
      if (!abort || !treeSource) return;
      const t = known.current;
      for (const folder of folders) {
        if (
          inFlight.current.has(folder) ||
          t.failed.has(folder) ||
          t.listings.has(folder)
        )
          continue;
        inFlight.current.add(folder);
        treeSource(folder, abort.signal).then(
          (reply) => {
            inFlight.current.delete(folder);
            if (abort.signal.aborted) return;
            merge(reply);
            // A reply without the folder asked for will not bring it later.
            if (!reply.folders.some((f) => f.path === folder))
              setTree((u) => ({ ...u, failed: new Set(u.failed).add(folder) }));
          },
          () => {
            inFlight.current.delete(folder);
            if (!abort.signal.aborted)
              setTree((u) => ({
                ...u,
                failed: new Set(u.failed).add(folder),
              }));
          },
        );
      }
    },
    [treeSource, merge],
  );
  return { commands, files, tree, readFolders };
}

type TreeState = {
  state: "idle" | "loading" | "ready" | "failed";
  listings: Map<string, TreeFolder>;
  /** The workspace's changed files, as the last read said. */
  changed?: number;
  failed: Set<string>;
};
const idleTree: TreeState = {
  state: "idle",
  listings: new Map(),
  failed: new Set(),
};

function commandGroups(
  t: Text,
  sources: ComposerSources | undefined,
  state: ReturnType<typeof useSources>["commands"],
  query: string,
  runsAtStart: boolean,
  /** The in-field list browses commands by source: skills, templates,
   * extensions. */
  bySource?: Record<"skill" | "prompt" | "extension", string>,
): ChoiceGroup[] {
  const groups: ChoiceGroup[] = [];
  const by = <T extends { s: number }>(a: T, b: T) => b.s - a.s;
  if (runsAtStart && sources?.browserActions?.length)
    groups.push({
      label: t.browserGroup,
      choices: sources.browserActions
        .map((a) => ({ a, s: fuzzyScore(a.name, query) }))
        .filter((x) => x.s > 0)
        .sort(by)
        .map(
          ({ a }): Choice => ({
            type: "command",
            name: a.name,
            description: a.description,
            tag: t.browserTag,
            tone: "browser",
            run: a.run,
          }),
        ),
    });
  const label = runsAtStart ? t.agentAtStart : t.agentMention;
  if (!state.list) {
    groups.push({
      label: t.agent,
      choices: [
        state.state === "failed"
          ? {
              type: "status",
              text: t.commandsFailed,
            }
          : {
              type: "status",
              text: t.commandsLoading,
              loading: true,
            },
      ],
    });
    return groups;
  }
  // A native command inventory is not a browser capability list. Keep
  // known terminal dialogs out of every composer entry point (including
  // search), rather than offering disabled commands among runnable ones.
  const choices = state.list.commands
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
        tag: `${t.sources[c.source]} · ${t.scopes[c.scope]}`,
        tone: c.source,
        terminalOnly: c.terminal_only,
      }),
    );
  if (bySource && !query)
    for (const source of ["skill", "prompt", "extension"] as const)
      groups.push({
        label: bySource[source],
        choices: choices.filter(
          (c) => c.type === "command" && c.tone === source,
        ),
      });
  else groups.push({ label, choices });
  return groups;
}

/** The in-field file list: the folder tree while browsing, Lista while
 * searching (the daemon's name order, the folder after the name). */
function fieldFileGroups(
  t: Text,
  ft: typeof fieldListText.fi,
  files: ReturnType<typeof useSources>["files"],
  tree: TreeState,
  open: Open,
): ChoiceGroup[] {
  if (open.query) {
    const loaded = files.list && files.query === open.query;
    if (!loaded && files.state === "failed")
      return [
        { label: "", choices: [{ type: "status", text: t.filesFailed }] },
      ];
    if (!files.list)
      return [
        {
          label: "",
          choices: [{ type: "status", text: t.filesLoading, loading: true }],
        },
      ];
    return [{ label: "", choices: searchChoices(files.list.files) }];
  }
  const folding = open.folding;
  const rows =
    tree.state === "failed"
      ? null
      : treeChoices(tree.listings, folding, {
          loading: ft.folderLoading,
          more: ft.folderMore,
          failed: t.filesFailed,
          failedFolders: tree.failed,
        });
  if (!rows)
    return [
      {
        label: "",
        choices: [
          tree.state === "failed"
            ? { type: "status", text: t.filesFailed }
            : { type: "status", text: t.filesLoading, loading: true },
        ],
      },
    ];
  return [{ label: "", choices: rows }];
}

export function Composer({
  value: draftValue,
  csrf,
  availability = enabled,
  editorAvailability,
  activity,
  selectedWorkingMode,
  sendState,
  sendWhenReady = false,
  suppressAvailabilityReason = false,
  queue,
  queueKnown = true,
  onChange: onDraftChange,
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
  onActivity,
  idlePlaceholder,
  goals,
  preparedPlaceholder,
  speech,
  onDictating,
  waiting,
  field: purpose,
}: {
  value: string;
  csrf?: string;
  modelPicker?: ReactNode;
  availability?: Availability;
  editorAvailability?: Availability;
  activity: "idle" | "working" | "settling";
  selectedWorkingMode: Mode;
  sendState?: "idle" | "pending" | "rejected" | "uncertain";
  /** The view cannot tell yet whether a message can go (it is still opening,
   * or an earlier send is on its way) and keeps a message sent meanwhile
   * until it can. The send goes to it although `availability` is not
   * enabled; without this, a blocked send is refused with its reason. */
  sendWhenReady?: boolean;
  suppressAvailabilityReason?: boolean;
  /** Pi's queue while it works: shown as a card above the field. */
  queue?: { steering: string[]; followUp: string[] };
  queueKnown?: boolean;
  onChange: (value: string) => void;
  onSendNow: (text?: string) => void;
  onSteer: (text?: string) => void;
  onFollowUp: (text?: string) => void;
  onModeChange: (mode: Mode) => void;
  /** Stops Pi's turn (Stop beside Send, and Esc in the field). */
  onInterrupt?: () => void;
  /** rejected: the stop was refused and the work goes on; Stop works again. */
  stopState?: "pending" | "uncertain" | "rejected";
  /** Messages wait for Pi to start: Stop takes them back before Pi runs. */
  onStopWaiting?: () => void;
  /** Takes Pi's queued messages back into the field. */
  onRestoreQueue?: () => void;
  restoreAvailability?: Availability;
  /** `!` commands; without it a leading `!` is ordinary text. */
  shell?: ComposerShell;
  /** `/`, `@`, the buttons and Ctrl/⌘+P; without it they are absent. */
  sources?: ComposerSources;
  /** The person pressed or typed in the field. */
  onActivity?: () => void;
  /** The empty field's invitation while the agent is not working. */
  idlePlaceholder?: string;
  /** Start-page goals: a draft beginning with one's skill shows its chip. */
  goals?: ComposerGoal[];
  preparedPlaceholder?: string;
  /** Speech input: the mic beside Send. Needs csrf. */
  speech?: ComposerSpeech;
  /** A dictation is under way, or ending into a send: its text is not yet
   * in the draft or not yet sent. */
  onDictating?: (active: boolean) => void;
  /** A field that is not a message to the agent (the icon wish) has its own
   * name and hook, so the page's message field stays the only one: focus
   * returning to the work must not land in it. */
  field?: { label: string; testId: string };
  /** The field's message waits to go by itself, and what the person reads
   * about it under the field (an AI sign-in to renew). */
  waiting?: string;
}) {
  const t = useText(composerText);
  const ft = useText(fieldListText);
  const MODE = t.modes;
  // The draft is what the agent receives: the person's text with one
  // attachment reference per line after it. The field edits only the text;
  // the attachments show as chips (Jari 24.10.2026).
  const draft = useRef({ value: draftValue, onChange: onDraftChange, goals });
  // Upload replies belong to the mounted field, not a concurrent render
  // that may still be suspended or discarded during creation handover.
  useLayoutEffect(() => {
    draft.current = { value: draftValue, onChange: onDraftChange, goals };
  }, [draftValue, onDraftChange, goals]);
  const { text: whole, attachments } = splitAttachments(draftValue);
  const sizes = useText(largeContentText);
  // The pre-send check's refusal stays while the attachments still do not
  // fit, with their current numbers, and goes once they do.
  const [overflowShown, setOverflowShown] = useState(false);
  const overflow = overflowShown
    ? attachmentOverflow(attachmentsIn(draftValue).map((a) => a.url))
    : undefined;
  if (overflowShown && !overflow) setOverflowShown(false);
  const { goal, text: value } = splitGoal(whole, goals);
  // The field's text with the draft's goal chip and attachments kept.
  const setText = useCallback((text: string, keepGoal = true) => {
    const current = draft.current;
    const parts = splitAttachments(current.value);
    const kept = keepGoal
      ? splitGoal(parts.text, current.goals).goal
      : undefined;
    const next = joinAttachments(joinGoal(kept, text), parts.attachments);
    draft.current = { ...current, value: next };
    current.onChange(next);
  }, []);
  const onChange = useCallback((text: string) => setText(text), [setText]);
  const removeAttachment = (index: number) => {
    const current = draft.current;
    const parts = splitAttachments(current.value);
    const next = joinAttachments(
      parts.text,
      parts.attachments.filter((_, other) => other !== index),
    );
    draft.current = { ...current, value: next };
    current.onChange(next);
  };
  const [resolving, setResolving] = useState(false);
  const resolution = useRef<AbortController | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: cancel a lookup when its send context changes.
  useEffect(
    () => () => resolution.current?.abort(),
    [
      sources,
      value,
      csrf,
      availability.state,
      sendState,
      activity,
      selectedWorkingMode,
    ],
  );
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const uploadController = useRef<AbortController | null>(null);
  useEffect(() => blockAutomaticReload(() => !!uploadController.current), []);
  const picker = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLTextAreaElement>(null);
  // The reference of the attachment whose chip takes the focus to the field
  // once it shows, and whether the field had the focus when the picker was
  // opened from the paperclip.
  const attachFocus = useRef<string | null>(null);
  const pickedFromField = useRef(false);
  // An attachment goes into the draft, so it can be added whenever a message
  // could be kept; a paperclip disabled while the view opens would also drop
  // the focus of a person using it.
  const attachable = availability.state === "enabled" || sendWhenReady;
  const addFiles = useCallback(
    async (files: File[], focus: boolean) => {
      if (!csrf || uploadController.current || !attachable) return;
      const attached = new Set(
        draft.current.value.match(/\/api\/v1\/attachments\/[a-f0-9-]{36}/g) ??
          [],
      ).size;
      if (attached + files.length > messageAttachmentCount) {
        setUploadError(t.tooManyFiles(attached + files.length));
        return;
      }
      const controller = new AbortController();
      uploadController.current = controller;
      setUploading(true);
      setUploadError("");
      try {
        for (const file of files) {
          const uploaded = await uploadAttachment(
            file,
            csrf,
            controller.signal,
          );
          if (controller.signal.aborted) return;
          const current = draft.current;
          const next = `${current.value}${current.value ? "\n" : ""}${uploaded.reference}`;
          draft.current = { ...current, value: next };
          if (focus) attachFocus.current = uploaded.reference;
          current.onChange(next);
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setUploadError(
            error instanceof Error ? error.message : t.uploadFailed,
          );
      } finally {
        if (uploadController.current === controller) {
          uploadController.current = null;
          if (!controller.signal.aborted) setUploading(false);
        }
      }
    },
    [csrf, attachable, t],
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
      void addFiles(
        Array.from(event.dataTransfer.files),
        focusAfterAttach(document.activeElement === field.current),
      );
    };
    document.addEventListener("dragover", drag);
    document.addEventListener("drop", drop);
    return () => {
      document.removeEventListener("dragover", drag);
      document.removeEventListener("drop", drop);
    };
  }, [csrf, addFiles]);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId().replace(/:/g, "");
  const shellLabelId = `${listId}-shell`;
  const [open, setOpen] = useState<Open | null>(null);
  const [notice, setNotice] = useState("");
  const lastCaret = useRef<[number, number] | null>(null);
  const { commands, files, tree, readFolders } = useSources(sources, open);
  const working = activity === "working";
  // A goal chip makes the draft a skill call; its text is never a command.
  const shellOn = !!shell && !goal && isShell(value);
  const running = shell?.running;
  const now = useNow(running?.state === "running");
  const stopping = stopState ?? shell?.stopState;
  // An agent stop shows its progress on Stop itself: a row that appears for
  // the fraction of a second a stop takes moves the whole composer twice.
  const agentStopping = stopping === "pending" && working && !!onInterrupt;
  const commandNotice = shellOn && running ? t.previousRunning : "";
  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 6000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const groups = useMemo<ChoiceGroup[]>(() => {
    if (!open) return [];
    const runsAtStart = open.place !== "caret" || open.atStart;
    if (kindOf(open) === "cmd")
      return commandGroups(
        t,
        sources,
        commands,
        open.query,
        runsAtStart,
        runsAtStart ? ft.groups : undefined,
      );
    return fieldFileGroups(t, ft, files, tree, open);
  }, [t, ft, open, sources, commands, files, tree]);
  const flat = useMemo(() => flatChoices(groups), [groups]);
  // A selection past the end, or on a status row, moves to the first
  // pickable; the in-field list lets its rows choose (autoSelect).
  const sel = !open
    ? -1
    : open.selKey && flat.some((c) => rowKey(c) === open.selKey)
      ? flat.findIndex((c) => rowKey(c) === open.selKey)
      : open.sel === AUTO || (open.sel >= 0 && !pickable(flat[open.sel]))
        ? autoSelect(flat, {
            reveal: open.reveal,
            searching: kindOf(open) === "file" && !!open.query,
          })
        : open.sel;
  // The tree reads a folder it shows open but has not read, and the folder
  // whose contents the preview shows once the selection rests on it.
  const toRead = foldersToRead(flat).join("\n");
  useEffect(() => {
    if (toRead) readFolders(toRead.split("\n"));
  }, [toRead, readFolders]);
  const selected = flat[sel];
  const previewFolder = selected?.type === "folder" ? selected.path : "";
  useEffect(() => {
    if (!previewFolder) return;
    const timer = window.setTimeout(() => readFolders([previewFolder]), 150);
    return () => window.clearTimeout(timer);
  }, [previewFolder, readFolders]);

  const fieldAvailability = editorAvailability ?? availability;
  const fieldReason = unavailableReason(fieldAvailability);
  const fieldDisabled =
    Boolean(fieldReason) && fieldAvailability.state !== "read_only";
  const sendBlocked =
    resolving ||
    uploading ||
    (!sendWhenReady &&
      (sendState === "pending" || availability.state !== "enabled"));
  const shellText = shellOn ? shellCommand(value) : "";
  const runBlocked =
    !shell ||
    !shellText ||
    !!running ||
    (shell.runAvailability && shell.runAvailability.state !== "enabled");
  // A dictation that ends puts its text in the field where the caret was,
  // with the caret after it, and the field is ordinary text again.
  const dictatedCaret = useRef<number | null>(null);
  const dictation = useDictation(
    speech,
    csrf,
    (text, caret) => {
      onChange(text);
      lastCaret.current = [caret, caret];
      caretText.current = text;
      dictatedCaret.current = caret;
    },
    box,
  );
  const dictating = dictation.active;
  // Focus once the field shows again with the text in it. A frame scheduled
  // from the end could run before that render on a busy machine, find the
  // field still hidden and leave the focus nowhere.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the field shows again or takes the text in these renders.
  useLayoutEffect(() => {
    const caret = dictatedCaret.current;
    const el = field.current;
    if (caret === null || dictating || !el) return;
    dictatedCaret.current = null;
    el.focus({ preventScroll: true });
    el.setSelectionRange(caret, caret);
    // Restoring the selection alone does not undo the textarea's scroll to
    // its old end on focus. Reveal the insertion, not the untouched suffix.
    const c = caretTop(el, caret);
    el.scrollTop = Math.max(0, c.y - el.clientHeight + 2 * c.line);
  }, [dictating, value]);
  // Focus once the added attachment shows as a chip, with the caret at the
  // end of the text. The upload can take a while; a field elsewhere that the
  // person moved to meanwhile keeps the focus.
  // biome-ignore lint/correctness/useExhaustiveDependencies: the attachment shows in the render that takes it into the draft.
  useLayoutEffect(() => {
    const pending = attachFocus.current;
    const el = field.current;
    if (!pending || !el || !attachments.some((a) => a.source === pending))
      return;
    attachFocus.current = null;
    const active = document.activeElement;
    const elsewhere =
      active instanceof HTMLElement &&
      active !== el &&
      (active.isContentEditable ||
        active instanceof HTMLInputElement ||
        active instanceof HTMLTextAreaElement ||
        active instanceof HTMLSelectElement);
    if (dictating || el.disabled || elsewhere) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    el.scrollTop = el.scrollHeight;
  }, [draftValue]);
  const endingToSend = useRef(false);
  const [sendingDictation, setSendingDictation] = useState(false);
  const dictationBusy = dictating || sendingDictation;
  const reportDictating = useRef(onDictating);
  reportDictating.current = onDictating;
  useEffect(() => {
    reportDictating.current?.(dictationBusy);
  }, [dictationBusy]);
  useEffect(() => () => reportDictating.current?.(false), []);
  const dictatedText = dictating
    ? `${dictation.before}${dictation.view?.final ?? ""}${dictation.after}`
    : "";
  const sendReady = shellOn
    ? !runBlocked
    : !!(dictating ? dictatedText : draftValue).trim() && !sendBlocked;

  // ---- inserting text ----
  const replaceRange = useCallback(
    (
      start: number,
      end: number,
      text: string,
      onFallback?: (value: string, caret: number) => void,
    ) => {
      const el = field.current;
      if (!el) return;
      el.focus();
      el.setSelectionRange(start, end);
      // insertText keeps the browser's undo history, as typing does.
      if (!document.execCommand?.("insertText", false, text)) {
        const next = el.value.slice(0, start) + text + el.value.slice(end);
        onChange(next);
        onFallback?.(next, start + text.length);
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
        const at = had.place === "caret" || had.replace ? had.end : had.start;
        el.setSelectionRange(at, had.place === "caret" ? at : had.end);
      }
    },
    [open],
  );
  /** The in-field list: a folder opens or closes in place. */
  const toggleRow = (index: number) => {
    const row = flat[index];
    if (!open || row?.type !== "folder") return;
    setOpen({
      ...open,
      folding: toggleFolder(open.folding, row.path, row.changed),
      reveal: undefined,
      sel: index,
      selKey: rowKey(row),
    });
  };
  /** The in-field list: a file or folder is marked or unmarked; with Tab
   * the selection moves on to the next row. */
  const toggleMark = (index: number, advance: boolean) => {
    const row = flat[index];
    if (!open) return;
    if (row?.type !== "file" && row?.type !== "folder") return;
    const marks = open.marks.includes(row.path)
      ? open.marks.filter((p) => p !== row.path)
      : [...open.marks, row.path];
    let i = index;
    if (advance)
      do i = (i + 1) % flat.length;
      while (!pickable(flat[i]) && i !== index);
    setOpen({ ...open, marks, sel: i, selKey: rowKey(flat[i]) });
  };
  const accept = (index: number) => {
    if (!open) return;
    if (!open.marks.length && flat[index]?.type === "folder")
      return toggleRow(index);
    const marked = open.marks.length
      ? open.marks.map((path): Choice => ({ type: "file", path }))
      : [flat[index]].filter(Boolean);
    const first = marked[0];
    if (!first || first.type === "status" || first.type === "folder") return;
    if (first.type === "command" && first.terminalOnly) {
      setNotice(t.terminalOnly(first.name));
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
    if (o.place === "caret" || o.replace)
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
    setOpen({
      ...open,
      sel: i,
      selKey: rowKey(flat[i]),
    });
  };
  /** → and ← in the in-field file list's search line. */
  const sidewaysKey = (right: boolean) => {
    if (!open) return false;
    const step = sideways(flat, sel, right);
    if (!step) return false;
    if (step.do === "select")
      setOpen({ ...open, sel: step.index, selKey: rowKey(flat[step.index]) });
    else if (step.do === "toggle") toggleRow(sel);
    else if (open.place === "caret") {
      // Revealing a search result clears the query in its owning text token.
      shown.current = step.path;
      replaceRange(open.start, open.end, "@", fromText);
    } else
      setOpen({
        ...open,
        query: "",
        folding: revealFolding(step.path),
        reveal: step.path,
        sel: AUTO,
        selKey: undefined,
      });
    return true;
  };

  const shown = useRef<string | null>(null);
  // ---- opening ----
  const fromText = (text: string, caret: number) => {
    if (!sources) return;
    const t = caretToken(text, caret);
    if (open && open.place !== "caret" && t?.kind !== "file") return;
    if (!t) {
      if (open) setOpen(null);
      return;
    }
    const same =
      open?.place === "caret" && open.kind === t.kind && open.start === t.start;
    const revealing = shown.current;
    shown.current = null;
    // A mid-line `/` opens with nothing highlighted, so Enter still sends.
    setOpen({
      place: "caret",
      ...t,
      ...fresh,
      // Typing on in the same token keeps what was opened and marked.
      reveal: revealing ?? undefined,
      folding: revealing
        ? revealFolding(revealing)
        : same
          ? open.folding
          : unfolded,
      marks: same ? open.marks : [],
      sel: t.kind === "cmd" && !t.atStart ? (same ? open.sel : -1) : AUTO,
    });
  };
  const fieldCaret = (): [number, number] => {
    const el = field.current;
    if (el && document.activeElement === el)
      return [el.selectionStart, el.selectionEnd];
    return lastCaret.current ?? [value.length, value.length];
  };
  // A dictation writes at the caret the field last had, as long as the text
  // is still the one it had then; a draft changed since gets it at the end.
  const caretText = useRef<string | null>(null);
  const dictationCaret = (): [number, number] => {
    const el = field.current;
    if ((el && document.activeElement === el) || caretText.current === value)
      return fieldCaret();
    return [value.length, value.length];
  };
  const writeAt = () => {
    if (open?.place === "caret" && open.kind === "file") {
      if (!open.query) return replaceRange(open.start, open.end, "", fromText);
      return close(true);
    }
    const [start, end] = fieldCaret();
    const pad = start > 0 && !/\s/.test(value[start - 1]) ? " " : "";
    setOpen(null);
    replaceRange(start, end, `${pad}@`, fromText);
  };
  const fromButton = (kind: "cmd" | "file") => {
    if (kind === "file") return writeAt();
    if (open?.place === "button" && open.kind === kind) return close(true);
    // From one in-field list to the other keeps the place in the text.
    const [start, end] = open ? [open.start, open.end] : fieldCaret();
    setOpen({
      place: "button",
      kind,
      start,
      end,
      query: "",
      sel: AUTO,
      replace: open?.place === "button" ? open.replace : false,
      ...fresh,
    });
  };
  const openFiles = () => {
    if (sources) writeAt();
  };

  // ---- what Stop stops, what Send does ----
  const stopTarget: { label: string; tip: string; run: () => void } | null =
    working && onInterrupt
      ? {
          label: t.stopAgent,
          tip: t.stopAgentTip,
          run: onInterrupt,
        }
      : running && shell
        ? {
            label: t.stopCommand(running.command),
            tip: t.stopCommandTip(running.command),
            run: shell.onStop,
          }
        : onStopWaiting && !working
          ? {
              label: t.stopUnsent,
              tip: t.stopUnsent,
              run: onStopWaiting,
            }
          : null;
  const send = async (otherWay = false) => {
    if (dictating) {
      // Send during a dictation ends it first and sends what was said;
      // a second press while it ends sends nothing more.
      if (endingToSend.current) return;
      endingToSend.current = true;
      setSendingDictation(true);
      try {
        await dictation.stop().finally(() => {
          endingToSend.current = false;
        });
        // The ended dictation has already put its text in the draft, beside
        // the goal and the attachments.
        return await sendDraft(otherWay, draft.current.value);
      } finally {
        setSendingDictation(false);
      }
    }
    return sendDraft(otherWay, draftValue);
  };
  const sendDraft = async (otherWay: boolean, content: string) => {
    if (shellOn) {
      if (running) return;
      if (!runBlocked && shell) shell.onRun(shellText, shellExcluded(value));
      return;
    }
    if (!content.trim() || resolution.current) return;
    if (sendBlocked) {
      // A send the view cannot take says why rather than doing nothing.
      if (!resolving && !uploading && availability.state !== "enabled")
        setNotice(t.notSent(unavailableReason(availability) ?? ""));
      return;
    }
    // Attachments that cannot go in one message are refused here, before
    // anything is sent, with the numbers that did not fit.
    if (attachmentOverflow(attachmentsIn(content).map((a) => a.url))) {
      setOverflowShown(true);
      return;
    }
    const parts = splitAttachments(content);
    const selected = splitGoal(parts.text, goals).goal;
    const cut = cutPreparedPlaceholder(
      parts.text,
      selected?.placeholder ?? preparedPlaceholder,
    );
    let text =
      cut === parts.text ? content : joinAttachments(cut, parts.attachments);
    if (sources && /^\/[A-Za-z0-9][A-Za-z0-9._-]*(?=\s|$)/.test(content)) {
      const controller = new AbortController();
      resolution.current = controller;
      setResolving(true);
      setNotice("");
      try {
        const list = await sources.commands(controller.signal);
        if (controller.signal.aborted) return;
        text = resolveSkillAlias(text, list.commands);
      } catch {
        if (!controller.signal.aborted) setNotice(t.skillsUnchecked);
        return;
      } finally {
        resolution.current = null;
        setResolving(false);
      }
    }
    if (working) {
      const mode = otherWay ? other(selectedWorkingMode) : selectedWorkingMode;
      if (mode === "steer") onSteer(text);
      else onFollowUp(text);
    } else onSendNow(text);
  };
  const sendLabel = shellOn
    ? t.run
    : working
      ? MODE[selectedWorkingMode].label
      : t.send;
  const sendTip = shellOn
    ? running
      ? t.stillRunning
      : t.runIn(shell?.workspaceLabel ?? "")
    : working
      ? t.workingTip(
          MODE[selectedWorkingMode].label,
          MODE[selectedWorkingMode].long,
          ALT,
          MODE[other(selectedWorkingMode)].label.toLowerCase(),
        )
      : dictating
        ? t.dictateAndSend
        : t.sendTip;

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
      return openFiles();
    }
    if (e.nativeEvent.isComposing || e.keyCode === 229) return;
    if (open?.place === "caret" && open.kind === "file") {
      if (e.key === "Tab" && !e.shiftKey) {
        e.preventDefault();
        return toggleMark(sel, true);
      }
      const el = e.currentTarget;
      const atEnd =
        el.selectionStart === open.end && el.selectionEnd === open.end;
      const atStart =
        el.selectionStart === open.start + 1 &&
        el.selectionEnd === open.start + 1;
      if (
        ((e.key === "ArrowRight" && atEnd) ||
          (e.key === "ArrowLeft" && atStart)) &&
        sidewaysKey(e.key === "ArrowRight")
      ) {
        e.preventDefault();
        return;
      }
    }
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
      if (stopping !== "pending" && stopping !== "uncertain") stopTarget.run();
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
      return openFiles();
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
      if (open.place === "button" && open.kind === "file")
        return toggleMark(sel, true);
      return accept(sel < 0 ? 0 : sel);
    }
    if (e.key === "Enter") {
      e.preventDefault();
      return accept(sel);
    }
    // → at the end of the search and ← at its start move in the tree.
    const input = e.currentTarget;
    if (
      ((e.key === "ArrowRight" &&
        input.selectionStart === input.value.length) ||
        (e.key === "ArrowLeft" &&
          input.selectionStart === 0 &&
          input.selectionEnd === 0)) &&
      kindOf(open) === "file" &&
      sidewaysKey(e.key === "ArrowRight")
    )
      e.preventDefault();
  };
  // Ctrl/⌘+P from anywhere in the page that is not another text input.
  const fileShortcut = useRef(openFiles);
  fileShortcut.current = openFiles;
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
      if (target?.closest?.(".ah-choice-in")) return;
      if (
        target &&
        target !== field.current &&
        (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
          target.isContentEditable)
      )
        return;
      e.preventDefault();
      fileShortcut.current();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [sources]);
  // The dictation shortcut from anywhere in the page that is not another
  // text input or a dialog: it starts as the mic does and ends as Valmis.
  const dictationKey = useRef<(() => void) | null>(null);
  dictationKey.current =
    speech && csrf && !shellOn && !fieldDisabled && !fieldReason
      ? () => {
          if (sendingDictation) return;
          if (dictating) void dictation.stop();
          else dictation.start(value, dictationCaret());
        }
      : null;
  const dictationShortcut = useDictationShortcut();
  const shortcutMatches = useRef(dictationShortcut.matches);
  shortcutMatches.current = dictationShortcut.matches;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!shortcutMatches.current(e) || e.defaultPrevented) return;
      const run = dictationKey.current;
      const target = e.target as HTMLElement | null;
      // A dialog or list over the conversation keeps its own keys.
      const over = target?.closest?.('dialog, [role="dialog"], .ah-choice-in');
      if (!run || (over && !over.contains(box.current))) return;
      if (
        target &&
        target !== field.current &&
        (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) ||
          target.isContentEditable)
      )
        return;
      e.preventDefault();
      if (!e.repeat) run();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);
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
        ? t.commandsAndSkills
        : t.mentionCommand
      : shellOn
        ? t.filesToCommand
        : t.filesIn(sources?.workspaceName ?? "");
  const fieldList = open ? (
    <FieldList
      listId={listId}
      kind={open.kind}
      from={open.place}
      head={headText}
      note={
        open.kind !== "file" || shellOn
          ? undefined
          : open.query
            ? files.list && files.query === open.query
              ? ft.matchCount(files.list.matched)
              : undefined
            : tree.changed !== undefined
              ? ft.changedCount(tree.changed)
              : undefined
      }
      query={open.query}
      groups={groups}
      selected={sel}
      marks={open.marks}
      searchInput={open.place === "button"}
      emptyText={open.query ? t.noMatches(open.query) : ft.noFiles}
      preview={sources?.preview}
      folder={
        selected?.type === "folder"
          ? tree.listings.get(selected.path)
          : undefined
      }
      onQuery={(query) =>
        setOpen({
          ...open,
          query,
          reveal: undefined,
          sel: AUTO,
          selKey: undefined,
          // Into or out of a search, the folders start again as they open.
          folding: !query !== !open.query ? unfolded : open.folding,
        })
      }
      onKeyDown={listKeys}
      onPick={(i) =>
        flat[i]?.type === "folder"
          ? toggleRow(i)
          : open.marks.length && open.kind === "file"
            ? toggleMark(i, false)
            : accept(i)
      }
      onHover={(i) => {
        if (open.sel !== i)
          setOpen({ ...open, sel: i, selKey: rowKey(flat[i]) });
      }}
      onMark={(i) => toggleMark(i, false)}
      onClearMarks={() => setOpen({ ...open, marks: [] })}
      onAdd={() => accept(sel)}
    />
  ) : null;
  // While the in-field list is open the text keeps the caret's two lines,
  // scrolled so the line where the choice goes shows; closed, it scrolls
  // back to the caret.
  const listAt = fieldList && open ? open.start : -1;
  useLayoutEffect(() => {
    const el = field.current;
    const b = box.current;
    if (!el || !b) return;
    const c = caretTop(el, listAt >= 0 ? listAt : el.selectionStart);
    el.scrollTop =
      listAt >= 0
        ? Math.max(0, c.y - c.line - c.pad)
        : Math.max(0, c.y - el.clientHeight + 2 * c.line);
    b.dataset.clipped = String(listAt >= 0 && el.scrollTop > 0);
  }, [listAt]);

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
        aria-label={t.waitingForAgent}
      >
        <div className="ah-cq-head">
          <span>
            {t.waitingForAgent}{" "}
            {queueKnown ? (
              <span className="ah-cq-n">{queued.length}</span>
            ) : null}
          </span>
          {onRestoreQueue && queued.length ? (
            <button
              data-testid="composer-restore-queue"
              type="button"
              className="ah-cq-restore"
              title={t.restoreTip}
              disabled={restoreAvailability.state !== "enabled"}
              onClick={onRestoreQueue}
            >
              <Icon name="restore" />
              <span>{t.restore}</span>
            </button>
          ) : null}
        </div>
        {queueKnown ? (
          <ul className="ah-cq-list">
            {queued.map((q) => (
              <li key={q.key} className={`ah-cq-row ah-cq-${q.kind}`}>
                <span className="ah-cq-kind">
                  <Icon name={modeIcon[q.kind]} />
                  {MODE[q.kind].queued}
                </span>
                <div className="ah-cq-content">
                  <div className="ah-cq-text">{messageText(q.text)}</div>
                  <AttachmentChips attachments={attachmentsIn(q.text)} />
                </div>
                <span className="ah-cq-when">
                  {q.kind === "steer" ? (
                    <>
                      <span className="ah-choice-dot" aria-hidden="true" />
                      {t.atNextStep}
                    </>
                  ) : (
                    t.whenTurnEnds
                  )}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="ah-cq-unknown">{t.queueUnknown}</p>
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
        {t.commandIn(<code>{shell?.workspaceLabel}</code>)}
      </span>
      <span data-testid="command-context" className="ah-crow-ctx">
        {shellExcluded(value) ? t.onlyForYou : t.agentSeesOutput}
      </span>
    </span>
  ) : null;
  const listButton = (kind: "cmd" | "file") => (
    <TooltipButton
      data-testid={kind === "cmd" ? "command-palette" : "file-picker"}
      type="button"
      className="ah-crow-btn"
      data-composer-list={kind}
      aria-haspopup="listbox"
      aria-expanded={open?.place === "button" && open.kind === kind}
      aria-label={kind === "cmd" ? t.commands : t.file}
      title={kind === "cmd" ? t.commandsTip : t.fileTip(MOD)}
      disabled={fieldDisabled || dictating}
      onMouseDown={(e) => {
        lastCaret.current = fieldCaret();
        e.preventDefault();
      }}
      onClick={() => fromButton(kind)}
    >
      <Icon name={kind === "cmd" ? "slash" : "at"} />
      <span className="ah-crow-lbl">
        {kind === "cmd" ? t.commands : t.file}
      </span>
    </TooltipButton>
  );
  const busy = working || !!running;
  const placeholder = shellOn
    ? ""
    : !working
      ? (idlePlaceholder ?? t.idlePlaceholder)
      : `${selectedWorkingMode === "steer" ? t.steerPlaceholder : t.followUpPlaceholder}… · ${ALT}+Enter: ${MODE[other(selectedWorkingMode)].label.toLowerCase()}`;

  const rowAids = (
    <>
      {csrf ? (
        <span
          className="ah-crow-attach"
          // The paperclip takes the focus as it is pressed; whether the
          // field had it is read just before the file picker opens.
          onPointerDownCapture={(event) => {
            if (event.currentTarget.contains(event.target as Node))
              pickedFromField.current =
                document.activeElement === field.current;
          }}
          onKeyDownCapture={(event) => {
            if (event.currentTarget.contains(event.target as Node))
              pickedFromField.current = false;
          }}
        >
          <AttachmentMenu
            disabled={uploading || !attachable || dictating}
            onAttach={() => picker.current?.click()}
          />
        </span>
      ) : null}
      {sources ? (
        <>
          {shellOn ? shellLabel : listButton("cmd")}
          {listButton("file")}
        </>
      ) : (
        shellLabel
      )}
    </>
  );
  const rowModel = modelPicker ? (
    <div className="ah-composer-model">{modelPicker}</div>
  ) : null;
  const rowChip =
    working && !shellOn ? (
      <button
        data-testid="composer-mode"
        data-mode={selectedWorkingMode}
        type="button"
        className={`ah-crow-chip ah-crow-chip-${selectedWorkingMode}`}
        aria-label={t.modeLabel(
          MODE[selectedWorkingMode].label,
          MODE[other(selectedWorkingMode)].label,
        )}
        title={t.modeTip(
          MODE[selectedWorkingMode].label,
          MODE[selectedWorkingMode].long,
          ALT,
        )}
        onClick={() => onModeChange(other(selectedWorkingMode))}
      >
        <Icon name={modeIcon[selectedWorkingMode]} />
        <span>{MODE[selectedWorkingMode].label}</span>
        {selectedWorkingMode === "follow_up" ? (
          // A phone's row has room for the short label only.
          <span className="ah-crow-chip-short">{t.followUpShort}</span>
        ) : null}
        <Icon name="swap" className="ah-crow-swap" />
      </button>
    ) : null;
  const rowRun =
    running && !working ? (
      <span
        className="ah-crow-run"
        title={running.state === "held" ? t.waitingForStart : t.commandRunning}
      >
        <span className="ah-crow-bang" aria-hidden="true">
          {running.excludeFromContext ? "!!" : "!"}
        </span>
        <code>{running.command}</code>
        <span className="ah-crow-clock">
          {running.state === "held" || running.startedAt === undefined
            ? t.waiting
            : mmss(now - running.startedAt)}
        </span>
      </span>
    ) : null;
  const rowStop = stopTarget ? (
    <TooltipButton
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
      aria-busy={agentStopping || undefined}
      title={stopTarget.tip}
      disabled={stopping === "pending" || stopping === "uncertain"}
      onClick={stopTarget.run}
    >
      {agentStopping ? (
        <span className="ah-command-spinner" aria-hidden="true" />
      ) : (
        <Icon name="stop" />
      )}
    </TooltipButton>
  ) : null;
  const rowSend = (
    <TooltipButton
      data-mode={shellOn ? "shell" : working ? selectedWorkingMode : "send"}
      data-testid="send"
      type="button"
      className="ah-crow-send"
      aria-label={sendLabel}
      title={sendTip}
      aria-disabled={!sendReady || undefined}
      aria-busy={resolving || sendState === "pending" || undefined}
      onClick={() => {
        // A press on a blocked send hears why (sendDraft).
        if (sendReady || (shellOn && running) || (!shellOn && value.trim()))
          send();
      }}
    >
      <Icon name={shellOn ? "run" : "up"} />
    </TooltipButton>
  );
  const mic = !!speech && !!csrf && !shellOn;

  return (
    <section
      className={`ah-composer${!draftValue.trim() && availability.state === "enabled" ? " ah-composer-empty" : ""}${suppressAvailabilityReason ? " ah-composer-notice-explains-block" : ""}`}
      aria-label={t.writeMessage}
    >
      {queueCard}
      {goal ? (
        <GoalChip
          goal={goal}
          onRemove={
            fieldDisabled
              ? undefined
              : () => {
                  setText(value, false);
                  field.current?.focus();
                }
          }
          onUnwrap={
            fieldDisabled
              ? undefined
              : () => {
                  const text = unwrapGoal(goal, value);
                  setText(text, false);
                  requestAnimationFrame(() => {
                    field.current?.focus();
                    field.current?.setSelectionRange(text.length, text.length);
                  });
                }
          }
        />
      ) : null}
      <DictationCeiling view={dictation.view} />
      {overflow ? (
        <WarningBanner
          data-testid="attachment-overflow"
          data-reason={overflow.reason}
          tone="danger"
          title={sizes.notSent}
        >
          {overflow.reason === "count"
            ? sizes.overCount(overflow.count)
            : sizes.overBytes(overflow.count, sizes.size(overflow.bytes))}
        </WarningBanner>
      ) : null}
      <AttachmentChips
        attachments={attachments}
        onRemove={fieldDisabled ? undefined : removeAttachment}
      />
      {csrf ? (
        <>
          <input
            ref={picker}
            type="file"
            multiple
            hidden
            onChange={(event) => {
              void addFiles(
                Array.from(event.target.files ?? []),
                focusAfterAttach(pickedFromField.current),
              );
              event.target.value = "";
            }}
          />
          {uploading ? <p role="status">{t.savingAttachment}</p> : null}
          {uploadError ? <p role="alert">{uploadError}</p> : null}
        </>
      ) : null}
      <div
        ref={box}
        className={`ah-cbox${shellOn ? " ah-cbox-shell" : ""}${fieldDisabled ? " ah-cbox-disabled" : ""}${dictating ? " ah-cbox-dictating" : ""}${fieldList ? " ah-cbox-listing" : ""}`}
      >
        {dictating ? <DictationLive dictation={dictation} /> : null}
        <textarea
          hidden={dictating}
          data-testid={purpose?.testId ?? "message-input"}
          autoComplete="off"
          data-working={working}
          ref={field}
          className="ah-cbox-field"
          aria-label={purpose?.label ?? t.messageToAgent}
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
          onPointerDown={onActivity}
          // A press in the text closes an in-field button list, and writing
          // goes on where the press put the caret.
          onMouseDown={() => {
            if (open?.place === "button") setOpen(null);
          }}
          onChange={(e) => {
            onActivity?.();
            onChange(e.target.value);
            fromText(e.target.value, e.target.selectionStart);
          }}
          onPaste={(event) => {
            const images = Array.from(event.clipboardData.files).filter(
              (file) => file.type.startsWith("image/"),
            );
            if (csrf && images.length) {
              event.preventDefault();
              void addFiles(images, true);
            }
          }}
          onKeyDown={onFieldKey}
          onKeyUp={(e) => {
            if (
              ["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key) &&
              !(
                open?.place === "caret" &&
                e.currentTarget.selectionStart === open.end
              )
            )
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
            caretText.current = e.currentTarget.value;
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
        {fieldList}
        <div
          className={`ah-crow${busy ? " ah-crow-busy" : ""}${dictating ? " ah-crow-dictating" : ""}`}
        >
          <span className="ah-crow-lz">
            {rowAids}
            <span className="ah-crow-grow" />
            {rowModel}
            {dictating ? (
              <DictationBar dictation={dictation} onCancel={dictation.cancel} />
            ) : null}
          </span>
          {rowChip}
          {rowRun}
          {rowStop}
          {rowChip || rowRun || rowStop ? (
            <span className="ah-crow-sep" aria-hidden="true" />
          ) : null}
          {mic ? (
            <span className="ah-crow-mslot">
              <DictationSlotControl
                dictation={dictation}
                text={value}
                caret={dictationCaret}
                disabled={fieldDisabled || !!fieldReason}
              />
            </span>
          ) : null}
          {rowSend}
        </div>
      </div>
      {fieldReason && !suppressAvailabilityReason ? (
        <p className="ah-control-reason ah-composer-reason">{fieldReason}</p>
      ) : null}
      {waiting && draftValue.trim() ? (
        <p
          className="ah-composer-waiting"
          data-testid="composer-waiting"
          role="status"
        >
          <Icon
            name="clock"
            width={13}
            height={13}
            className="ah-composer-waiting-mark"
            aria-hidden="true"
          />
          {waiting}
        </p>
      ) : null}
      {agentStopping ? (
        <p
          data-testid="composer-notice"
          data-stopping={stopping}
          className="ah-visually-hidden"
          role="status"
        >
          {t.stopping}
        </p>
      ) : stopping || commandNotice || notice ? (
        <p
          data-testid="composer-notice"
          data-stopping={stopping}
          className="ah-composer-notice"
          role="status"
        >
          {stopping === "pending" ? (
            <>
              <span className="ah-command-spinner" aria-hidden="true" />{" "}
              {t.stopping}
            </>
          ) : stopping === "uncertain" ? (
            t.stopUncertain
          ) : stopping === "rejected" ? (
            t.stopRejected
          ) : (
            commandNotice || notice
          )}
        </p>
      ) : null}
      {speech ? (
        <DictationNoticeView
          dictation={dictation}
          text={value}
          caret={dictationCaret}
          onOpenSettings={speech.onOpenSettings}
        />
      ) : null}
      {sendState === "rejected" ? (
        <InlineNotice
          title={t.rejectedTitle}
          description={t.rejectedDetail}
          tone="danger"
        />
      ) : null}
    </section>
  );
}
