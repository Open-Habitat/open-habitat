import { useEffect, useRef } from "react";
import type { ContextDetail, ContextDetailState } from "../app/contextDetail";
import { formatDate, formatNumber, liveText, useLanguage } from "../i18n";
import { contextPageText } from "../text/contextPage";
import { type ContextUsage, contextFacts } from "./ContextRing";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import "./ContextPage.css";

// The detailed context status as its own page (Sivu, Jari 26.10.2026, issue
// proto-context-detail): what fills the context, the next and earlier
// compactions, and every turn. Only Pi's measured total is a measurement;
// every part is Pi's chars/4 estimate and says so.

type Key = "sys" | "tools" | "sum" | "talk" | "out" | "att" | "rest";
type Row = { name: string; tokens: number; mono?: boolean; note?: string };
type Category = {
  key: Key;
  name: string;
  tokens: number;
  rows: Row[];
  note?: string;
};

const txt = liveText(contextPageText);
const sectionName = (name: string) =>
  Object.hasOwn(txt.sections, name) ? txt.sections[name] : undefined;

/** What the page shows, derived from Pi's reading and the ring's limits. */
export function contextView(detail: ContextDetail, usage?: ContextUsage) {
  const measured = detail.measured_tokens;
  const window = usage?.window && usage.window > 0 ? usage.window : undefined;
  const threshold = usage ? contextFacts(usage).threshold : undefined;
  const p = detail.parts;
  const c = detail.conversation;
  const harness = detail.harness;
  const categories: Category[] = [
    {
      key: "sys",
      name: txt.instructions,
      tokens: p.instructions,
      rows: detail.instructions.map((s) => ({
        name: sectionName(s.name) ?? s.name,
        mono: !sectionName(s.name),
        tokens: s.tokens,
        note: s.replaced ? txt.replacedByClaude : undefined,
      })),
      note: detail.instructions.length ? undefined : txt.noPrompt,
    },
    {
      key: "tools",
      name: txt.toolDescriptions,
      tokens: p.tools,
      rows: detail.tools.map((t) => ({ ...t, mono: true })),
    },
    ...(p.summary
      ? [
          {
            key: "sum" as const,
            name: txt.summary,
            tokens: p.summary,
            rows: [],
          },
        ]
      : []),
    {
      key: "talk",
      name: txt.conversation,
      tokens: p.conversation,
      rows: [
        { name: txt.yourMessages, tokens: c.user },
        { name: txt.replies, tokens: c.assistant },
        { name: txt.thinking, tokens: c.thinking },
        { name: txt.toolCalls, tokens: c.tool_calls },
        { name: txt.extensionMessages, tokens: c.other },
      ].filter((r) => r.tokens > 0),
    },
    {
      key: "out",
      name: txt.toolOutputs,
      tokens: p.tool_output,
      rows: detail.largest_outputs.map((o) => ({
        name: txt.outputAtTurn(o.name, o.turn),
        tokens: o.tokens,
        mono: true,
      })),
      note: detail.largest_outputs.length > 1 ? txt.largestOutputs : undefined,
    },
    ...(p.attachments
      ? [
          {
            key: "att" as const,
            name: txt.attachments,
            tokens: p.attachments,
            rows: [],
            note: txt.attachmentsNote,
          },
        ]
      : []),
  ];
  const estimated = categories.reduce((a, k) => a + k.tokens, 0);
  // The total the model last saw, plus what was added after it.
  const total =
    measured !== undefined
      ? measured + detail.trailing_tokens
      : detail.estimated_tokens;
  const rest = measured !== undefined ? Math.max(0, total - estimated) : 0;
  if (rest > 0)
    categories.push({
      key: "rest",
      name: txt.unitemized,
      tokens: rest,
      rows: [],
      note: harness === "claude_code" ? txt.gapClaude : txt.gapPi,
    });
  const base = Math.max(total, estimated);
  const percent =
    measured !== undefined && window ? (measured / window) * 100 : undefined;
  return {
    categories,
    estimated,
    measured,
    total,
    base,
    window,
    threshold,
    percent,
    over: measured !== undefined && estimated > total ? estimated - total : 0,
  };
}

const full = (n: number) => formatNumber(Math.round(n));
const kt = (n: number) =>
  n >= 1000
    ? `${formatNumber(n / 1000, { maximumFractionDigits: n >= 100000 ? 0 : 1 })}k`
    : String(n);
const pc = (p: number) =>
  txt.percent(p > 0 && p < 1 ? "<1" : String(Math.round(p)));
function clock(at: string) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date().toDateString() === d.toDateString();
  return formatDate(d, {
    ...(today ? {} : { day: "numeric", month: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
  });
}

function Bar({
  view,
  estimate,
}: {
  view: ReturnType<typeof contextView>;
  estimate: boolean;
}) {
  const scale = view.window ?? view.base;
  if (!scale) return null;
  const reserve =
    view.window && view.threshold !== undefined
      ? view.window - view.threshold
      : 0;
  return (
    <div
      className="ah-cd-bar"
      data-estimate={estimate || undefined}
      aria-hidden="true"
    >
      <span className="ah-cd-segs">
        {view.categories
          .filter((k) => k.tokens > 0)
          .map((k) => (
            <i
              key={k.key}
              data-k={k.key}
              style={{ width: `${Math.min(100, (k.tokens / scale) * 100)}%` }}
            />
          ))}
      </span>
      {reserve > 0 && view.window ? (
        <i
          className="ah-cd-reserve"
          style={{ width: `${(reserve / view.window) * 100}%` }}
        />
      ) : null}
      {view.threshold !== undefined && view.window ? (
        <b
          className="ah-cd-at"
          style={{ left: `${(view.threshold / view.window) * 100}%` }}
        />
      ) : null}
    </div>
  );
}

function Composition({ view }: { view: ReturnType<typeof contextView> }) {
  return (
    <table className="ah-cd-table" data-testid="context-parts">
      <thead>
        <tr>
          <th scope="col">{txt.part}</th>
          <th scope="col" className="num">
            {txt.tokens}
          </th>
          <th scope="col" className="num">
            {txt.share}
          </th>
        </tr>
      </thead>
      <tbody>
        {view.categories.map((k) => (
          <CategoryRows key={k.key} k={k} base={view.base} />
        ))}
      </tbody>
    </table>
  );
}

function CategoryRows({ k, base }: { k: Category; base: number }) {
  return (
    <>
      <tr className="cat" data-k={k.key}>
        <th scope="row">
          <span className="ah-cd-sw" aria-hidden="true" />
          {k.name}
        </th>
        <td className="num">{full(k.tokens)}</td>
        <td className="num">{base ? pc((k.tokens / base) * 100) : ""}</td>
      </tr>
      {k.note ? (
        <tr className="part note">
          <th scope="row" colSpan={3}>
            {k.note}
          </th>
        </tr>
      ) : null}
      {k.rows.map((r, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: Native names can repeat.
        <tr className="part" key={i} data-replaced={r.note ? true : undefined}>
          <th scope="row">
            <span className={r.mono ? "mono" : undefined}>{r.name}</span>
            {r.note ? <span className="ah-cd-sub"> · {r.note}</span> : null}
          </th>
          <td className="num">{full(r.tokens)}</td>
          <td />
        </tr>
      ))}
    </>
  );
}

function NextCompaction({
  detail,
  view,
}: {
  detail: ContextDetail;
  view: ReturnType<typeof contextView>;
}) {
  const next = detail.next_compaction;
  const last = detail.turns.at(-1)?.n ?? 0;
  const keptFrom = detail.compactions.at(-1)?.kept_from_turn ?? 1;
  const enabled = detail.settings?.enabled;
  const when =
    enabled === false
      ? txt.autoOff
      : view.threshold !== undefined
        ? txt.compactsAbove(full(view.threshold))
        : txt.noWhenWithoutWindow;
  const strip = detail.turns.filter((t) => t.n > 0);
  return (
    <>
      {strip.length ? (
        <>
          <div className="ah-cd-strip" aria-hidden="true">
            {strip.map((t) => (
              <i
                key={t.n}
                data-st={
                  t.n < keptFrom
                    ? "gone"
                    : next && t.n <= next.through_turn
                      ? "next"
                      : "kept"
                }
              />
            ))}
          </div>
          <p className="ah-cd-keys">
            <span>
              <i data-st="gone" />
              {txt.alreadySummarized}
            </span>
            <span>
              <i data-st="next" />
              {txt.compactsNext}
            </span>
            <span>
              <i data-st="kept" />
              {txt.kept}
            </span>
          </p>
        </>
      ) : null}
      <p className="ah-cd-text" data-testid="context-next">
        {when}{" "}
        {next
          ? txt.nextCompaction({
              from: next.from_turn,
              through: next.through_turn,
              tokens: kt(next.summarized_tokens),
              updates: detail.compactions.length > 0,
              split: next.split_turn ? next.kept_from_turn : undefined,
              keptFrom: next.kept_from_turn,
              last,
            })
          : detail.settings
            ? txt.nothingToCompact
            : txt.settingsUnread}
      </p>
      <p className="ah-cd-fine">
        {txt.cutRule(
          detail.settings
            ? full(detail.settings.keep_recent_tokens)
            : undefined,
        )}
      </p>
    </>
  );
}

function Compactions({ detail }: { detail: ContextDetail }) {
  if (!detail.compactions.length)
    return <p className="ah-cd-empty">{txt.noCompactions}</p>;
  return (
    <ol className="ah-cd-comps" data-testid="context-compactions">
      {detail.compactions
        .map((c, i) => ({ c, n: i + 1 }))
        .reverse()
        .map(({ c, n }) => {
          return (
            <li key={n}>
              <p className="ah-cd-comp-h">
                <strong>{txt.compaction(n)}</strong>
                <span>
                  {clock(c.at)} · {txt.intoSummary(c.kept_from_turn - 1)}
                </span>
              </p>
              <p className="ah-cd-comp-n num">
                {full(c.tokens_before)} →{" "}
                {c.tokens_after !== undefined
                  ? txt.afterNextReply(full(c.tokens_after))
                  : txt.sizeFromNextReply}
              </p>
              <p className="ah-cd-fine">
                {txt.summarySize(full(c.summary_tokens))}
              </p>
              <pre className="ah-cd-summary">{c.summary}</pre>
              {c.summary_truncated ? (
                <p className="ah-cd-fine">{txt.summaryTruncated}</p>
              ) : null}
              {(
                [
                  ["read", txt.readFiles, c.read_files],
                  ["modified", txt.modifiedFiles, c.modified_files],
                ] as const
              ).map(([key, label, files]) =>
                files.length ? (
                  <p className="ah-cd-files" key={key}>
                    <span>{label(files.length)}</span>{" "}
                    <span className="mono">{files.join(", ")}</span>
                  </p>
                ) : null,
              )}
            </li>
          );
        })}
    </ol>
  );
}

function Chart({
  detail,
  view,
}: {
  detail: ContextDetail;
  view: ReturnType<typeof contextView>;
}) {
  const turns = detail.turns.filter((t) => t.context_tokens !== undefined);
  if (turns.length < 2) return null;
  const W = 900;
  const H = 110;
  const top =
    Math.max(view.window ?? 0, ...turns.map((t) => t.context_tokens ?? 0)) *
    1.02;
  const bw = W / turns.length;
  const y = (n: number) => H - (n / top) * (H - 4);
  return (
    <svg
      className="ah-cd-chart"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {turns.map((t, k) => (
        <rect
          key={t.n}
          className={
            detail.compactions.some((c) => c.after_turn === t.n)
              ? "c"
              : undefined
          }
          x={k * bw + 1}
          y={y(t.context_tokens ?? 0)}
          width={Math.max(1, bw - 2)}
          height={H - y(t.context_tokens ?? 0)}
        />
      ))}
      {view.threshold !== undefined && view.window ? (
        <line
          className="at"
          x1={0}
          x2={W}
          y1={y(view.threshold)}
          y2={y(view.threshold)}
        />
      ) : null}
    </svg>
  );
}

function Turns({
  detail,
  view,
}: {
  detail: ContextDetail;
  view: ReturnType<typeof contextView>;
}) {
  const priced = detail.turns.some((t) => t.cost > 0);
  let previous: number | undefined;
  return (
    <>
      <Chart detail={detail} view={view} />
      <div className="ah-cd-tablewrap">
        <table className="ah-cd-table turns" data-testid="context-turns">
          <thead>
            <tr>
              <th scope="col" className="num">
                #
              </th>
              <th scope="col">{txt.time}</th>
              <th scope="col">{txt.request}</th>
              <th scope="col" className="num">
                {txt.context}
              </th>
              <th scope="col" className="num">
                {txt.change}
              </th>
              <th scope="col" className="num opt">
                {txt.newInput}
              </th>
              <th scope="col" className="num opt">
                {txt.fromCache}
              </th>
              <th scope="col" className="num opt">
                {txt.output}
              </th>
              {priced ? (
                <th scope="col" className="num opt">
                  {txt.cost}
                </th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {detail.turns.map((t) => {
              const change =
                t.context_tokens !== undefined && previous !== undefined
                  ? t.context_tokens - previous
                  : undefined;
              if (t.context_tokens !== undefined) previous = t.context_tokens;
              const compactions = detail.compactions
                .map((c, i) => ({ c, n: i + 1 }))
                .filter(({ c }) => c.after_turn === t.n);
              return [
                <tr key={t.n}>
                  <th scope="row" className="num">
                    {t.n}
                  </th>
                  <td className="num">{clock(t.at)}</td>
                  <td className="ask" title={t.request}>
                    {t.request}
                  </td>
                  <td className="num">
                    {t.context_tokens !== undefined
                      ? full(t.context_tokens)
                      : "–"}
                  </td>
                  <td className="num">
                    {change === undefined
                      ? ""
                      : `${change >= 0 ? "+" : "−"}${kt(Math.abs(change))}`}
                  </td>
                  <td className="num opt">{full(t.input + t.cache_write)}</td>
                  <td className="num opt">{full(t.cache_read)}</td>
                  <td className="num opt">{full(t.output)}</td>
                  {priced ? (
                    <td className="num opt">
                      {formatNumber(t.cost, {
                        style: "currency",
                        currency: "USD",
                        maximumFractionDigits: 3,
                      })}
                    </td>
                  ) : null}
                </tr>,
                ...compactions.map(({ c, n }) => (
                  <tr className="cmp" key={`c${n}`}>
                    <td colSpan={priced ? 9 : 8}>
                      {txt.compactionRow({
                        n,
                        before: full(c.tokens_before),
                        summary: full(c.summary_tokens),
                        keptFrom: c.kept_from_turn,
                        after: c.after_turn,
                      })}
                    </td>
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
      <p className="ah-cd-fine">
        {txt.turnsFine(priced, detail.turns_omitted ?? 0)}
      </p>
    </>
  );
}

/** The page that replaces the conversation below the top bar. */
export function ContextPage({
  detail: read,
  usage,
  title,
  onClose,
}: {
  detail: ContextDetailState;
  usage?: ContextUsage;
  title: string;
  onClose: () => void;
}) {
  useLanguage();
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  const detail = read.detail;
  const view = detail ? contextView(detail, usage) : undefined;
  const level = usage ? contextFacts(usage).level : undefined;
  return (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: Escape bubbling from the page's controls closes it.
    <section
      className="ah-cd-page"
      data-testid="context-page"
      data-state={read.state}
      aria-labelledby="ah-cd-title"
      onKeyDown={(event) => {
        if (event.key === "Escape" && !event.defaultPrevented) {
          event.preventDefault();
          onClose();
        }
      }}
    >
      <div className="ah-cd-inner">
        <ControlButton
          data-testid="context-back"
          size="inline"
          variant="quiet"
          className="ah-cd-back"
          aria-label={txt.back(title)}
          onPress={onClose}
        >
          <Icon name="back" />
          <span>{title}</span>
        </ControlButton>
        <h2 id="ah-cd-title" tabIndex={-1} ref={heading}>
          {txt.title}
        </h2>
        {!detail ? (
          <p className="ah-cd-text" role="status">
            {read.state === "loading" ? txt.reading : txt.unreadable}
          </p>
        ) : view ? (
          <>
            {read.state === "unavailable" ? (
              <p className="ah-cd-text" role="status">
                {txt.showingPrevious}
              </p>
            ) : null}
            <div className="ah-cd-top" data-level={level}>
              <p
                className="ah-cd-big"
                data-testid="context-total"
                data-measured={view.measured}
              >
                {view.measured === undefined ? (
                  <>
                    ? <span>{txt.estimateAbout(full(view.total))}</span>
                  </>
                ) : view.percent !== undefined && view.window ? (
                  <>
                    {pc(view.percent)}{" "}
                    <span>
                      {txt.ofWindow(full(view.measured), full(view.window))}
                    </span>
                  </>
                ) : (
                  <>
                    {full(view.measured)} <span>{txt.windowUnknown}</span>
                  </>
                )}
              </p>
              <Bar view={view} estimate={view.measured === undefined} />
              <p className="ah-cd-text">
                {view.measured === undefined
                  ? txt.measuresNext
                  : view.threshold !== undefined && view.window
                    ? view.threshold > view.measured
                      ? txt.roomBefore(
                          full(view.threshold - view.measured),
                          full(view.threshold),
                        )
                      : txt.overThreshold(full(view.threshold))
                    : detail.settings?.enabled === false
                      ? txt.autoOffShort
                      : txt.noThresholdWithoutWindow}
                {detail.trailing_tokens && view.measured !== undefined
                  ? txt.trailing(full(detail.trailing_tokens))
                  : ""}
              </p>
              <p className="ah-cd-meta">
                <span className="mono">
                  {usage?.model ?? detail.model ?? txt.modelUnknown}
                </span>
                {" · "}
                {txt.windowMeta(view.window ? full(view.window) : undefined)}
                {detail.settings
                  ? txt.settingsMeta(
                      full(detail.settings.reserve_tokens),
                      full(detail.settings.keep_recent_tokens),
                    )
                  : ""}
              </p>
              {detail.harness === "claude_code" ? (
                <p className="ah-cd-fine" data-testid="context-harness">
                  {txt.claudeBridge}
                </p>
              ) : null}
            </div>
            <div className="ah-cd-grid">
              <section aria-labelledby="ah-cd-parts">
                <h3 id="ah-cd-parts">{txt.composedOf}</h3>
                <Composition view={view} />
                <p className="ah-cd-fine">
                  {txt.partsFine(
                    view.measured !== undefined,
                    view.over ? full(view.over) : undefined,
                  )}
                </p>
              </section>
              <section aria-labelledby="ah-cd-next">
                <h3 id="ah-cd-next">{txt.nextHeading}</h3>
                <NextCompaction detail={detail} view={view} />
                <h3>{txt.compactions}</h3>
                <Compactions detail={detail} />
              </section>
            </div>
            <section aria-labelledby="ah-cd-turns">
              <h3 id="ah-cd-turns">{txt.turns}</h3>
              <Turns detail={detail} view={view} />
            </section>
          </>
        ) : null}
      </div>
    </section>
  );
}
