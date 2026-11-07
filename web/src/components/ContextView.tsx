import { type ReactNode, useContext, useState } from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import type { CompactionFailed } from "../app/compaction";
import type { ContextDetail, ContextItem } from "../app/contextDetail";
import { formatDate, formatNumber, liveText, useLanguage } from "../i18n";
import { contextViewText, type Moment } from "../text/contextView";
import { type ContextUsage, contextFacts } from "./ContextRing";
import { ControlButton, Segmented } from "./ControlElements";
import { FileLinkContext, parseFileRef } from "./fileRefs";
import { Icon, type IconName } from "./Icon";
import { TextArea } from "./Primitives";
import "./ContextView.css";

// The context view (Jari 7.11.2026, proto-conversation-context-view round 3,
// direction 2 without its own Open column): what fills the context, item by
// item, and Pi's own compaction with an instruction. Every fact and button
// says in plain words what it is and what pressing it does; the source of
// each is named in the prototype's result. Turned on in Settings ›
// Experimental, it replaces Pi's technical figures on the context page.

const txt = liveText(contextViewText);
const full = (n: number) => formatNumber(Math.round(n));

/** A clock time, with the date when it is not today. */
function clock(at: string | undefined): Moment | undefined {
  if (!at) return undefined;
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return undefined;
  const time = formatDate(d, { hour: "2-digit", minute: "2-digit" });
  return new Date().toDateString() === d.toDateString()
    ? { time }
    : { time, date: formatDate(d, { day: "numeric", month: "numeric" }) };
}

/** What the agent did with an item and when: "luki klo 10.02 ja 10.20". */
function didText(item: ContextItem) {
  const verbs = [...new Set(item.ops.map((o) => o.verb))];
  const text = verbs
    .map((verb) => {
      const ops = item.ops.filter((o) => o.verb === verb);
      const times = ops.map((o) => clock(o.at)).filter((t) => !!t) as Moment[];
      const lines = ops
        .map((o) => txt.lines(o.added, o.removed))
        .filter((l) => !!l);
      return times.length ? txt.did(txt.verbs[verb], times, lines) : "";
    })
    .filter((t) => !!t)
    .join(", ");
  return `${text}${item.ops_omitted ? txt.more(item.ops_omitted) : ""}`;
}

/** A file's folder as the row's source: the workspace for its own files. */
function folder(path: string) {
  const cut = path.lastIndexOf("/");
  if (cut < 0) return txt.workspace;
  return cut === 0 ? "/" : path.slice(0, cut);
}
const basename = (path: string) => path.slice(path.lastIndexOf("/") + 1);

type Row = {
  key: string;
  name: string;
  meta: string;
  tokens: number;
  icon: IconName;
  item?: ContextItem;
};

function itemRow(item: ContextItem): Row {
  const did = didText(item);
  if (item.kind === "file")
    return {
      key: `f:${item.name}`,
      name: basename(item.name) || item.name,
      meta: [folder(item.name), did].filter((x) => !!x).join(" · "),
      tokens: item.tokens,
      icon: "file",
      item,
    };
  return {
    key: `${item.kind}:${item.name}`,
    name: item.name,
    meta: [item.kind === "command" ? txt.commandOutput : txt.toolOutput, did]
      .filter((x) => !!x)
      .join(" · "),
    tokens: item.tokens,
    icon: item.kind === "command" ? "terminal" : "plug",
    item,
  };
}

function partRows(detail: ContextDetail): Row[] {
  const p = detail.parts;
  const last = detail.compactions.at(-1);
  const from = clock(detail.context_from_at);
  return [
    {
      key: "talk",
      name: txt.talk,
      meta: txt.talkMeta(from),
      tokens: p.conversation,
      icon: "message" as const,
    },
    {
      key: "system",
      name: txt.system,
      meta: txt.systemMeta,
      tokens: p.instructions + p.tools,
      icon: "gear" as const,
    },
    ...(p.summary && last
      ? [
          {
            key: "summary",
            name: txt.summary,
            meta: txt.summaryMeta(clock(last.at) ?? { time: "–" }, from),
            tokens: p.summary,
            icon: "recap" as const,
          },
        ]
      : []),
    ...(p.attachments
      ? [
          {
            key: "attachments",
            name: txt.attachments,
            meta: txt.attachmentsMeta,
            tokens: p.attachments,
            icon: "image" as const,
          },
        ]
      : []),
  ];
}

/** A file in the workspace opens the way a conversation's file link does;
 * elsewhere (no editor, a phone, outside the workspace) it is text. */
function RowName({ row }: { row: Row }) {
  const links = useContext(FileLinkContext);
  const ref =
    row.item?.kind === "file" && links ? parseFileRef(row.item.name) : null;
  const mono = row.item && row.item.kind !== "file";
  const name = (
    <span className={mono ? "mono" : undefined} title={row.item?.name}>
      {row.name}
    </span>
  );
  if (!links || !ref || !row.item) return name;
  const path = row.item.name;
  return (
    <a
      className={`ah-file-link${links.opened === path ? " ah-file-link-opened" : ""}`}
      href={`#${encodeURIComponent(path)}`}
      title={txt.opensInEditor(path)}
      data-testid="context-item-open"
      onClick={(event) => {
        event.preventDefault();
        links.open(ref, path);
      }}
    >
      {row.name}
    </a>
  );
}

function Rows({
  rows,
  empty,
  testid,
  sized,
}: {
  rows: Row[];
  empty: string;
  testid: string;
  sized: boolean;
}) {
  return (
    <ul className="ah-cv-rows" data-testid={testid}>
      {rows.map((r) => (
        <li key={r.key} className="ah-cv-row" data-testid="context-item">
          <span className="ah-cv-src" aria-hidden="true">
            <Icon name={r.icon} />
          </span>
          <span className="ah-cv-name">
            <RowName row={r} />
            {r.meta ? <span className="ah-cv-meta">{r.meta}</span> : null}
          </span>
          <span className="ah-cv-size">{sized ? full(r.tokens) : ""}</span>
        </li>
      ))}
      {rows.length ? null : (
        <li className="ah-cv-row ah-cv-empty">
          <span className="ah-cv-fine">{empty}</span>
        </li>
      )}
    </ul>
  );
}

/** What pressing Tiivistä nyt can do now. `none`: the page cannot compact
 * this conversation (it is not one the browser runs). */
export type CompactionControl = {
  offer: "ready" | "busy" | "none";
  running: boolean;
  /** The last attempt's answer, until the page closes or the next attempt. */
  outcome?:
    | { kind: "done"; after: number }
    | { kind: CompactionFailed["reason"] };
  onCompact: (instructions: string) => void;
};

function outcomeText(outcome: NonNullable<CompactionControl["outcome"]>) {
  if (outcome.kind === "done") return txt.outcome.done(full(outcome.after));
  if (outcome.kind === "login") return undefined;
  return txt.outcome[outcome.kind];
}

function CompactDialog({
  detail,
  open,
  onClose,
  onConfirm,
}: {
  detail: ContextDetail;
  open: boolean;
  onClose: () => void;
  onConfirm: (instructions: string) => void;
}) {
  const [instructions, setInstructions] = useState("");
  const next = detail.next_compaction;
  if (!next) return null;
  const from = clock(next.from_at);
  const through = clock(next.through_at);
  const keptFrom = clock(next.kept_from_at);
  const keep = detail.settings
    ? full(detail.settings.keep_recent_tokens)
    : undefined;
  const stays = detail.items
    .filter((i) => (i.kept_tokens ?? 0) > 0)
    .sort((a, b) => (b.kept_tokens ?? 0) - (a.kept_tokens ?? 0));
  const shown = stays.slice(0, 8);
  return (
    <ModalOverlay
      className="ah-overlay"
      isOpen={open}
      isDismissable
      onOpenChange={(o) => {
        if (!o) onClose();
      }}
    >
      <Modal className="ah-modal ah-cv-modal">
        <AriaDialog
          className="ah-dialog"
          data-testid="compact-dialog"
          aria-label={txt.dialogTitle}
        >
          <Heading slot="title">{txt.dialogTitle}</Heading>
          <p className="ah-cv-desc">
            {from && through
              ? txt.summarizes(from, through)
              : txt.summarizesOld}
          </p>
          <p className="ah-cv-desc">
            {txt.keeps(keptFrom, keep, shown.length > 0)}
          </p>
          {shown.length ? (
            <ul className="ah-cv-stay" data-testid="compact-kept">
              {shown.map((i) => {
                const row = itemRow(i);
                return (
                  <li key={row.key}>
                    <span className="ah-cv-src" aria-hidden="true">
                      <Icon name={row.icon} />
                    </span>
                    <span
                      className={i.kind === "file" ? undefined : "mono"}
                      title={i.name}
                    >
                      {row.name}
                    </span>
                    <span className="ah-cv-num">
                      {full(i.kept_tokens ?? 0)}
                    </span>
                  </li>
                );
              })}
              {stays.length > shown.length ? (
                <li className="ah-cv-fine">
                  {txt.keptMore(stays.length - shown.length)}
                </li>
              ) : null}
            </ul>
          ) : null}
          <TextArea
            data-testid="compact-instructions"
            label={txt.instruction}
            rows={2}
            value={instructions}
            onChange={setInstructions}
            placeholder={txt.instructionHint}
          />
          <p className="ah-cv-fine">
            {txt.after(full(next.estimated_tokens_after))}
          </p>
          <div className="ah-dialog-actions">
            <ControlButton size="row" variant="quiet" onPress={onClose}>
              {txt.cancel}
            </ControlButton>
            <ControlButton
              data-testid="compact-confirm"
              size="row"
              variant="primary"
              onPress={() => {
                onConfirm(instructions);
                setInstructions("");
              }}
            >
              {txt.confirm}
            </ControlButton>
          </div>
        </AriaDialog>
      </Modal>
    </ModalOverlay>
  );
}

function Compaction({
  detail,
  control,
}: {
  detail: ContextDetail;
  control?: CompactionControl;
}) {
  const [open, setOpen] = useState(false);
  if (!control || control.offer === "none") return null;
  const next = detail.next_compaction;
  const last = detail.compactions.at(-1);
  const notice = control.outcome ? outcomeText(control.outcome) : undefined;
  let state: ReactNode;
  if (control.running)
    state = (
      <p className="ah-cv-bar-note" data-testid="compacting" role="status">
        <span className="ah-cv-spin" aria-hidden="true" />
        {txt.compacting}
      </p>
    );
  else if (detail.just_compacted && last)
    state = (
      <p className="ah-cv-bar-note" data-testid="compacted" role="status">
        <Icon name="check" />
        <span>{txt.compacted(clock(last.at) ?? { time: "–" })}</span>
      </p>
    );
  else
    state = (
      <div className="ah-cv-compact" data-testid="compact-row">
        <ControlButton
          data-testid="compact-open"
          size="row"
          variant="secondary"
          isDisabled={control.offer !== "ready" || !next}
          onPress={() => setOpen(true)}
        >
          {txt.compact}
        </ControlButton>
        <p className="ah-cv-fine">
          {control.offer !== "ready"
            ? txt.compactWhenWaiting
            : next
              ? txt.compactDoes
              : txt.nothingYet(
                  detail.settings
                    ? full(detail.settings.keep_recent_tokens)
                    : undefined,
                )}
        </p>
      </div>
    );
  return (
    <>
      {state}
      {notice &&
      !control.running &&
      !(control.outcome?.kind === "done" && detail.just_compacted) ? (
        <p
          className="ah-cv-fine ah-cv-outcome"
          data-testid="compact-outcome"
          data-outcome={control.outcome?.kind}
          role="status"
        >
          {notice}
        </p>
      ) : null}
      <CompactDialog
        detail={detail}
        open={open && !control.running}
        onClose={() => setOpen(false)}
        onConfirm={(instructions) => {
          setOpen(false);
          control.onCompact(instructions);
        }}
      />
    </>
  );
}

/** The view that replaces the context page's technical sections. */
export function ContextView({
  detail,
  usage,
  compaction,
}: {
  detail: ContextDetail;
  usage?: ContextUsage;
  compaction?: CompactionControl;
}) {
  useLanguage();
  const [filter, setFilter] = useState<"all" | "files">("all");
  const files = filter === "files";
  const facts = usage ? contextFacts(usage) : undefined;
  const window = facts?.window;
  const measured = detail.measured_tokens;
  const total =
    measured !== undefined
      ? measured + detail.trailing_tokens
      : detail.estimated_tokens;
  const autoOff = detail.settings?.enabled === false;
  const threshold = autoOff ? undefined : facts?.threshold;
  const seen = [
    ...detail.items
      .filter((i) => i.in_context && (!files || i.kind === "file"))
      .map(itemRow),
    ...(files ? [] : partRows(detail)),
  ].sort((a, b) => b.tokens - a.tokens);
  const gone = detail.items
    .filter((i) => !i.in_context && (!files || i.kind === "file"))
    .map(itemRow);
  const fileCount = detail.items.filter((i) => i.kind === "file").length;
  const last = detail.compactions.at(-1);
  return (
    <section
      className="ah-cv"
      data-testid="context-view"
      aria-label={txt.label}
    >
      <p className="ah-cv-lead">{txt.lead}</p>
      <p
        className="ah-cv-big"
        data-testid="context-view-total"
        data-measured={measured}
      >
        {measured === undefined ? (
          <>
            {txt.about(full(total))}{" "}
            {window ? <span>{txt.ofWindowShort(full(window))}</span> : null}
          </>
        ) : window ? (
          <>
            {txt.percent(String(Math.round((measured / window) * 100)))}{" "}
            <span>{txt.ofWindow(full(measured), full(window))}</span>
          </>
        ) : (
          txt.tokensOnly(full(measured))
        )}
      </p>
      {window ? (
        <div className="ah-cv-meter" aria-hidden="true">
          <i style={{ width: `${Math.min(100, (total / window) * 100)}%` }} />
          {threshold !== undefined ? (
            <b style={{ left: `${(threshold / window) * 100}%` }} />
          ) : null}
        </div>
      ) : null}
      <p className="ah-cv-fine">
        {txt.tokenIs}
        {autoOff
          ? txt.autoOff
          : threshold !== undefined
            ? txt.autoAbove(full(threshold))
            : ""}
        {measured === undefined ? txt.estimated : ""}
      </p>
      <Compaction detail={detail} control={compaction} />

      <div className="ah-cv-head">
        <h3>{txt.where}</h3>
        <Segmented
          data-testid="context-files-filter"
          label={txt.show}
          value={filter}
          onChange={setFilter}
          size="row"
          options={[
            { id: "all", label: txt.all },
            { id: "files", label: txt.filesOnly(fileCount) },
          ]}
        />
      </div>
      {files ? (
        <p className="ah-cv-fine" data-testid="context-files-note">
          {txt.filesNote}
        </p>
      ) : null}
      <div className="ah-cv-group">
        <h4>
          <span>{txt.seen}</span>
          <span className="ah-cv-tok">{txt.tokens}</span>
        </h4>
        <p className="ah-cv-fine">{txt.seenNote}</p>
        <Rows
          rows={seen}
          empty={files ? txt.emptyFiles : txt.empty}
          testid="context-seen"
          sized
        />
      </div>
      {last ? (
        <div className="ah-cv-group">
          <h4>
            <span>{txt.summaryOnly}</span>
          </h4>
          <p className="ah-cv-fine">
            {txt.summaryNote(clock(last.at) ?? { time: "–" })}
          </p>
          <Rows
            rows={gone}
            empty={files ? txt.emptyFiles : txt.empty}
            testid="context-summary-only"
            sized={false}
          />
        </div>
      ) : null}
      <p className="ah-cv-fine">
        {txt.sizesNote}
        {detail.items_omitted ? txt.omitted(detail.items_omitted) : ""}
      </p>
    </section>
  );
}
