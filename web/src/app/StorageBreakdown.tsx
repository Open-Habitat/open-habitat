import { useEffect, useMemo, useRef, useState } from "react";
import { Heading } from "react-aria-components";
import { ControlButton } from "../components/ControlElements";
import { Icon } from "../components/Icon";
import { Checkbox, Select, TextArea } from "../components/Primitives";
import { StatusMark } from "../components/Status";
import { WarningBannerView } from "../components/WarningBanner";
import { TrashModal } from "../components/WorkspaceTrash";
import { formatDate, useText } from "../i18n";
import { storageBreakdownText } from "../text/storageBreakdown";
import "./StorageBreakdown.css";
import {
  type StorageBreakdown as Breakdown,
  type BreakdownGroup,
  type BreakdownItem,
  cleanCommand,
  measureBreakdown,
  readBreakdown,
} from "./storageBreakdown";
import { bytes, type OwnStorage } from "./storageQuota";

// Storage with the storage-breakdown experiment (B1 "Esikatselu", round
// design-system/prototypes/rounds/2026-11-14-storage-breakdown-2): one bar
// previews the selection against the limit and the 85 % line above a
// plain-language checklist. The agent does the cleaning: the button opens a
// new conversation with a request built from the selection, unsent. The
// Trash stays production's own action below.

const NEAR = 85;
/** While the daemon measures, its result is read again this often. */
const pollMs = 3000;
/** The groups a person can choose from, in the list's order. */
const PICK: BreakdownGroup[] = ["caches", "finished", "own"];
const DEFAULT: BreakdownGroup[] = ["caches", "finished"];

const total = (items: readonly BreakdownItem[]) =>
  items.reduce((s, i) => s + i.bytes, 0);

export type CleanupWorkspace = { workspace_id: string; name: string };

/** Room and its bound: the quota, or the shared disk without limits. */
function room(s: OwnStorage) {
  return s.limits === "not_in_use"
    ? {
        used: s.filesystem.capacity_bytes - s.filesystem.free_bytes,
        bound: s.filesystem.capacity_bytes,
        shared: true,
      }
    : { used: s.usage_bytes, bound: s.limit_bytes, shared: false };
}

export function StorageBreakdown({
  quota,
  csrf,
  workspaces = [],
  onAskAgent,
}: {
  quota: OwnStorage;
  csrf?: string;
  workspaces?: readonly CleanupWorkspace[];
  /** Opens a new conversation in the workspace with text in its field. */
  onAskAgent?: (workspaceId: string, text: string) => boolean;
}) {
  const t = useText(storageBreakdownText);
  const [result, setResult] = useState<Breakdown>();
  const [failed, setFailed] = useState(false);
  const [read, setRead] = useState(0);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const seen = useRef(new Set<string>());
  const [asking, setAsking] = useState<BreakdownItem[] | null>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: read asks again.
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const once = () =>
      readBreakdown(controller.signal).then(
        (value) => {
          if (controller.signal.aborted) return;
          setResult(value);
          setFailed(false);
          if (value.measuring) timer = setTimeout(once, pollMs);
        },
        () => {
          if (!controller.signal.aborted) setFailed(true);
        },
      );
    void once();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [read]);

  // A new result keeps what the person chose and selects by default only
  // what they have not seen before.
  const measuredAt = result?.measured_at;
  // biome-ignore lint/correctness/useExhaustiveDependencies: a new measurement is a new result.
  useEffect(() => {
    if (!result) return;
    setSelected((old) => {
      const next = new Set<string>();
      for (const i of result.items) {
        if (!PICK.includes(i.group)) continue;
        if (seen.current.has(i.path)) {
          if (old.has(i.path)) next.add(i.path);
        } else if (DEFAULT.includes(i.group)) next.add(i.path);
      }
      for (const i of result.items) seen.current.add(i.path);
      return next;
    });
  }, [measuredAt]);

  const measured = !!result?.measured_at;
  const items = measured ? (result?.items ?? []) : [];
  const of = (g: BreakdownGroup) => items.filter((i) => i.group === g);
  const pickable = items.filter((i) => PICK.includes(i.group));
  const chosen = pickable.filter((i) => selected.has(i.path));
  const { used, bound, shared } = room(quota);
  // On a shared disk only what was measured is known to be the person's;
  // the rest of the disk is shown as other files, not as other people's.
  const own = shared ? total(items) : used;
  const chosenBytes = total(chosen);
  const after = Math.max(0, used - chosenBytes);
  const pct = (n: number) => Math.floor((100 * n) / bound);
  const pctNow = pct(used);
  const pctAfter = pct(after);
  const width = (n: number) =>
    `${Math.max(0, Math.min(100, (100 * n) / bound)).toFixed(2)}%`;
  const live = total(of("live"));
  const trash = total(of("trash"));
  const parts = measured
    ? [
        { key: "others", bytes: shared ? used - own : 0 },
        {
          key: "kept",
          bytes: Math.max(0, own - total(pickable) - live - trash),
        },
        { key: "trash", bytes: trash },
        { key: "live", bytes: live },
        { key: "freeable", bytes: total(pickable) - chosenBytes },
        { key: "chosen", bytes: chosenBytes },
      ].filter((p) => p.bytes > 0)
    : [{ key: "kept", bytes: used }];
  const line = shared ? t.diskOf : t.ofBound;

  const toggle = (paths: string[], on: boolean) =>
    setSelected((old) => {
      const next = new Set(old);
      for (const p of paths) on ? next.add(p) : next.delete(p);
      return next;
    });
  const stateOf = (g: BreakdownGroup) => {
    const list = of(g);
    const n = list.filter((i) => selected.has(i.path)).length;
    return n === 0 ? "none" : n === list.length ? "all" : "some";
  };
  const label = (i: BreakdownItem) => t.items[i.kind] ?? i.kind;
  const request = (list: BreakdownItem[]) =>
    t.requestText({
      percent: pctNow,
      used: bytes(used),
      bound: bytes(bound),
      shared,
      measured,
      items: list.map((i) => ({
        label: label(i),
        path: i.path,
        size: bytes(i.bytes),
        clean: cleanCommand[i.kind] ?? t.cleanRm,
      })),
      live: of("live").map((i) => i.path),
    });
  const remeasure = () => {
    if (!csrf) return;
    void measureBreakdown(csrf).then(
      (value) => {
        setResult(value);
        setRead((n) => n + 1);
      },
      () => setFailed(true),
    );
  };

  const warning =
    pctNow >= NEAR ? (
      <WarningBannerView
        data-testid="storage-warning"
        tone="danger"
        icon="disk"
        title={shared ? t.warnTitleShared(pctNow) : t.warnTitle(pctNow)}
        actions={
          onAskAgent ? (
            <ControlButton
              data-testid="warning-ask"
              size="row"
              variant="primary"
              onPress={() => setAsking(measured ? chosen : [])}
            >
              {t.askAgent}
            </ControlButton>
          ) : undefined
        }
      >
        <p>
          {!measured
            ? t.warnBodyUnmeasured
            : shared
              ? t.warnBodyShared(
                  bytes(total(pickable.filter((i) => i.group !== "own"))),
                )
              : t.warnBody(
                  bytes(total(pickable.filter((i) => i.group !== "own"))),
                )}
        </p>
      </WarningBannerView>
    ) : null;

  return (
    <>
      {warning}
      <div className="s-card ah-sb-card" data-testid="storage-breakdown">
        <section
          className="ah-sb"
          aria-label={t.freeable}
          data-settings-row="usage"
          tabIndex={-1}
        >
          <h3>{t.freeable}</h3>
          <div className="ah-sb-numbers" data-testid="numbers">
            <div>
              <span className="s-desc">{t.now}</span>
              <strong data-testid="now">
                {line(bytes(used), bytes(bound), pctNow)}
              </strong>
            </div>
            {measured ? (
              <>
                <Icon name="forward" />
                <div>
                  <span className="s-desc">{t.afterShort}</span>
                  <strong
                    data-testid="after"
                    className={pctAfter < NEAR ? "ah-sb-ok-ink" : undefined}
                  >
                    {line(bytes(after), bytes(bound), pctAfter)}
                  </strong>
                </div>
                <span className="ah-sb-frees" data-testid="frees">
                  {t.freesUp(bytes(chosenBytes))}
                </span>
              </>
            ) : null}
            {shared && measured ? (
              <span className="s-desc ah-sb-share">
                {t.yourShare(bytes(own))}
              </span>
            ) : null}
          </div>
          <div className="ah-sb-bar-wrap">
            <span
              className="ah-sb-bar"
              data-testid="usage-bar"
              role="img"
              aria-label={t.barLabel(bytes(used), bytes(after), bytes(bound))}
            >
              {parts.map((p) => (
                <span
                  key={p.key}
                  data-part={p.key}
                  className={`ah-sb-sw-${p.key}`}
                  style={{ width: width(p.bytes) }}
                />
              ))}
            </span>
            <span
              className="ah-sb-warnline"
              style={{ left: `${NEAR}%` }}
              data-testid="warn-line"
              aria-hidden="true"
            >
              <span className="ah-sb-warnline-label">{t.warnLine}</span>
            </span>
            {measured && chosenBytes ? (
              <span
                className="ah-sb-aftertick"
                style={{ left: width(after) }}
                aria-hidden="true"
              />
            ) : null}
          </div>
          <ul className="ah-trash-legend ah-sb-legend">
            {parts.map((p) => (
              <li key={p.key}>
                <span className={`ah-trash-swatch ah-sb-sw-${p.key}`} />
                <span>{t.legend[p.key]}</span>
              </li>
            ))}
          </ul>
          {measured ? (
            <p
              className={`ah-sb-verdict ${!chosenBytes ? "s-desc" : pctAfter < NEAR ? "ah-sb-verdict-ok" : "ah-sb-verdict-over"}`}
              data-testid="verdict"
              data-ok={(chosenBytes && pctAfter < NEAR) || undefined}
            >
              {!chosenBytes ? (
                t.nothingChosen
              ) : (
                <>
                  <Icon name={pctAfter < NEAR ? "check" : "disk"} />{" "}
                  {pctAfter < NEAR ? t.belowWarn : t.stillOver}
                </>
              )}
            </p>
          ) : null}
          {measured && result && !result.complete ? (
            <p className="s-desc" data-testid="breakdown-incomplete">
              {t.incomplete}
            </p>
          ) : null}
          {measured ? (
            <ul className="ah-sb-list" data-testid="group-list">
              {[...PICK, "live" as const].map((g) => {
                const list = of(g);
                if (!list.length) return null;
                const state = g === "live" ? "none" : stateOf(g);
                const some = total(list.filter((i) => selected.has(i.path)));
                return (
                  <li key={g} data-group-row={g} data-state={state}>
                    <div className="ah-sb-row">
                      <span
                        className={`ah-trash-swatch ah-sb-sw-${g === "live" ? "live" : state === "none" ? "freeable" : "chosen"}`}
                      />
                      <Checkbox
                        data-testid={`group-${g}`}
                        label={t.groups[g]}
                        checked={state !== "none"}
                        hint={
                          g === "live"
                            ? undefined
                            : state === "some"
                              ? `${t.groupNotes[g]} (${t.partial(bytes(some), bytes(total(list)))})`
                              : t.groupNotes[g]
                        }
                        onChange={() =>
                          toggle(
                            list.map((i) => i.path),
                            state !== "all",
                          )
                        }
                        availability={
                          g === "live"
                            ? { state: "disabled", reason: t.groupNotes.live }
                            : undefined
                        }
                      />
                      <code className="ah-sb-size">{bytes(total(list))}</code>
                    </div>
                    <Details
                      group={g}
                      list={list}
                      selected={selected}
                      label={label}
                      onToggle={(p, on) => toggle([p], on)}
                    />
                  </li>
                );
              })}
              {trash ? (
                <li data-group-row="trash" className="ah-sb-trash-row">
                  <div className="ah-sb-row">
                    <span className="ah-trash-swatch ah-sb-sw-trash" />
                    <span className="ah-sb-trash-name">
                      <span>{t.groups.trash}</span>
                      <small className="s-desc">{t.groupNotes.trash}</small>
                    </span>
                    <code className="ah-sb-size">{bytes(trash)}</code>
                  </div>
                  <ControlButton
                    size="inline"
                    variant="quiet"
                    data-testid="trash-below"
                    onPress={() =>
                      document
                        .querySelector('[data-settings-row="trash"]')
                        ?.scrollIntoView({ block: "start" })
                    }
                  >
                    {t.emptyTrashBelow}
                  </ControlButton>
                </li>
              ) : null}
            </ul>
          ) : null}
          <div className="ah-sb-actions">
            <p className="ah-sb-measured s-desc" data-testid="measured">
              {failed ? (
                <span role="alert">{t.readFailed}</span>
              ) : result?.measuring || !result ? (
                <StatusMark
                  kind="working"
                  tone="info"
                  label={measured ? t.measuring : t.measuringFirst}
                />
              ) : (
                <span>
                  {t.measuredAt(
                    formatDate(new Date(result.measured_at ?? 0), {
                      dateStyle: "short",
                      timeStyle: "short",
                    }),
                  )}
                </span>
              )}
              {failed || (csrf && result && !result.measuring) ? (
                <ControlButton
                  data-testid="remeasure"
                  size="inline"
                  variant="quiet"
                  onPress={() =>
                    failed || !csrf ? setRead((n) => n + 1) : remeasure()
                  }
                >
                  <Icon name="refresh" />
                  {t.remeasure}
                </ControlButton>
              ) : null}
            </p>
            {onAskAgent ? (
              <ControlButton
                data-testid="ask-agent"
                size="row"
                variant={pctNow >= NEAR ? "primary" : "secondary"}
                isDisabled={measured && !chosen.length}
                onPress={() => setAsking(measured ? chosen : [])}
              >
                {measured ? t.askAgentSelected(bytes(chosenBytes)) : t.askAgent}
              </ControlButton>
            ) : null}
          </div>
        </section>
      </div>
      {onAskAgent ? (
        <CleanupDialog
          key={asking ? "open" : "closed"}
          items={asking}
          text={asking ? request(asking) : ""}
          workspaces={workspaces}
          preferred={preferredWorkspace(workspaces, items)}
          onAskAgent={onAskAgent}
          onClose={() => setAsking(null)}
        />
      ) : null}
    </>
  );
}

/** "Näytä tarkemmin": the folders behind a group, each selectable. */
function Details({
  group,
  list,
  selected,
  label,
  onToggle,
}: {
  group: BreakdownGroup;
  list: BreakdownItem[];
  selected: Set<string>;
  label: (i: BreakdownItem) => string;
  onToggle: (path: string, on: boolean) => void;
}) {
  const t = useText(storageBreakdownText);
  const [open, setOpen] = useState(false);
  const tag = (i: BreakdownItem) =>
    i.group === "live"
      ? t.runLive(i.title ?? "")
      : i.group === "finished"
        ? i.merged
          ? t.merged
          : t.runEnded
        : i.group === "own"
          ? t.ownCheckout
          : undefined;
  return (
    <div className="ah-sb-details" data-details={group}>
      <ControlButton
        data-testid={`more-${group}`}
        size="inline"
        variant="quiet"
        aria-expanded={open}
        onPress={() => setOpen((o) => !o)}
      >
        <Icon name={open ? "up" : "down"} />
        {open ? t.less : t.more}
      </ControlButton>
      {open ? (
        <div className="ah-sb-details-panel">
          <p className="s-desc">{t.detailsNote}</p>
          <ul className="ah-sb-pick">
            {list.map((i) => {
              const text = tag(i);
              return (
                <li key={i.path} data-item={i.path} data-group={i.group}>
                  {group === "live" ? (
                    <span className="ah-sb-item-name">{label(i)}</span>
                  ) : (
                    <Checkbox
                      data-testid={`pick-${i.path}`}
                      label={label(i)}
                      checked={selected.has(i.path)}
                      onChange={(on) => onToggle(i.path, on)}
                    />
                  )}
                  {text ? (
                    <span className={`ah-sb-tag ah-sb-tag-${i.group}`}>
                      {text}
                    </span>
                  ) : (
                    <span />
                  )}
                  <code className="ah-sb-path">{i.path}</code>
                  <code className="ah-sb-size">
                    {i.complete ? "" : "≥ "}
                    {bytes(i.bytes)}
                  </code>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

/** The workspace holding the largest build directories, else the first. */
export function preferredWorkspace(
  workspaces: readonly CleanupWorkspace[],
  items: readonly BreakdownItem[],
): string | undefined {
  const sizes = new Map<string, number>();
  for (const i of items) {
    if (!i.workspace || !["finished", "own", "live"].includes(i.group))
      continue;
    const name = i.workspace.replace(/__worktrees$/, "");
    sizes.set(name, (sizes.get(name) ?? 0) + i.bytes);
  }
  let best: CleanupWorkspace | undefined;
  for (const w of workspaces)
    if ((sizes.get(w.name) ?? 0) > (best ? (sizes.get(best.name) ?? 0) : 0))
      best = w;
  return (best ?? workspaces[0])?.workspace_id;
}

/** The request as it will open in the new conversation's field, and the
 * workspace the conversation shows in. Nothing is sent from here. */
function CleanupDialog({
  items,
  text,
  workspaces,
  preferred,
  onAskAgent,
  onClose,
}: {
  items: BreakdownItem[] | null;
  text: string;
  workspaces: readonly CleanupWorkspace[];
  preferred?: string;
  onAskAgent: (workspaceId: string, text: string) => boolean;
  onClose: () => void;
}) {
  const t = useText(storageBreakdownText);
  const [ws, setWs] = useState(preferred ?? "");
  const [draft, setDraft] = useState(text);
  const [problem, setProblem] = useState("");
  const options = useMemo(
    () => workspaces.map((w) => ({ value: w.workspace_id, label: w.name })),
    [workspaces],
  );
  return (
    <TrashModal
      label={t.dialogTitle}
      testId="cleanup-dialog"
      isOpen={!!items}
      onClose={onClose}
    >
      <div className="ah-sb-dialog">
        <Heading slot="title">{t.dialogTitle}</Heading>
        <p className="s-desc">{t.dialogNote}</p>
        {options.length ? (
          <>
            <Select
              label={t.convIn}
              value={ws}
              onChange={setWs}
              options={options}
            />
            <p className="s-desc">{t.convInNote}</p>
          </>
        ) : (
          <p role="alert">{t.noWorkspace}</p>
        )}
        <TextArea
          data-testid="request-text"
          label={t.request}
          value={draft}
          onChange={setDraft}
          rows={12}
        />
        {problem ? <p role="alert">{problem}</p> : null}
        <div className="ah-dialog-actions">
          <ControlButton size="page" variant="secondary" onPress={onClose}>
            {t.cancel}
          </ControlButton>
          <ControlButton
            data-testid="cleanup-open"
            size="page"
            variant="primary"
            isDisabled={!ws || !draft.trim()}
            onPress={() => {
              if (onAskAgent(ws, draft)) onClose();
              else setProblem(t.cannotOpen);
            }}
          >
            {t.open}
          </ControlButton>
        </div>
      </div>
    </TrashModal>
  );
}
