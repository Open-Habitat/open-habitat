import { useEffect, useRef } from "react";
import type { ContextDetail, ContextDetailState } from "../app/contextDetail";
import { contextFacts, type ContextUsage } from "./ContextRing";
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

const SECTION_NAMES: Record<string, string> = {
  preamble: "Pi:n perusohje",
  tools: "Työkalulista",
  rules: "Säännöt",
  docs: "Pi:n dokumentaatio",
  addendum: "Lisäohje",
  project_context: "AGENTS.md ja projektin ohjeet",
  skills: "Skillit",
  cwd: "Työhakemisto",
  open_habitat: "Habitatin ohje",
  prompt: "Kiinteä kehote",
};

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
      name: "Ohjeet ja järjestelmäkehote",
      tokens: p.instructions,
      rows: detail.instructions.map((s) => ({
        name: SECTION_NAMES[s.name] ?? s.name,
        mono: !SECTION_NAMES[s.name],
        tokens: s.tokens,
        note: s.replaced ? "Claude Coden oma kehote korvaa" : undefined,
      })),
      note: detail.instructions.length
        ? undefined
        : "Pi ei kirjannut kehotetta tähän sessioon.",
    },
    {
      key: "tools",
      name: "Työkalujen kuvaukset",
      tokens: p.tools,
      rows: detail.tools.map((t) => ({ ...t, mono: true })),
    },
    ...(p.summary
      ? [
          {
            key: "sum" as const,
            name: "Tiivistelmä",
            tokens: p.summary,
            rows: [],
          },
        ]
      : []),
    {
      key: "talk",
      name: "Keskustelu",
      tokens: p.conversation,
      rows: [
        { name: "Viestisi", tokens: c.user },
        { name: "Vastaukset", tokens: c.assistant },
        { name: "Ajattelu", tokens: c.thinking },
        { name: "Työkalukutsut", tokens: c.tool_calls },
        { name: "Laajennusten viestit", tokens: c.other },
      ].filter((r) => r.tokens > 0),
    },
    {
      key: "out",
      name: "Työkalujen tulosteet",
      tokens: p.tool_output,
      rows: detail.largest_outputs.map((o) => ({
        name: `${o.name} · vuoro ${o.turn}`,
        tokens: o.tokens,
        mono: true,
      })),
      note:
        detail.largest_outputs.length > 1 ? "Suurimmat tulosteet" : undefined,
    },
    ...(p.attachments
      ? [
          {
            key: "att" as const,
            name: "Liitteet",
            tokens: p.attachments,
            rows: [],
            note: "Kuvat Pi:n kiinteällä kuva-arviolla",
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
      name: "Erittelemätön",
      tokens: rest,
      rows: [],
      note:
        harness === "claude_code"
          ? "Mitatun ja arvioidun ero: Claude Coden oma järjestelmäkehote, jota sessiotiedostoon ei kirjata, ja merkki-arvion virhe."
          : "Mitatun ja arvioidun ero: merkkimäärästä arvioidut osat eivät vastaa mallin tokenointia tarkasti.",
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

const full = (n: number) => Math.round(n).toLocaleString("fi-FI");
const kt = (n: number) =>
  n >= 1000
    ? `${(n / 1000).toLocaleString("fi-FI", { maximumFractionDigits: n >= 100000 ? 0 : 1 })}k`
    : String(n);
const pc = (p: number) => `${p > 0 && p < 1 ? "<1" : Math.round(p)} %`;
function clock(at: string) {
  const d = new Date(at);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date().toDateString() === d.toDateString();
  return d.toLocaleString("fi-FI", {
    ...(today ? {} : { day: "numeric", month: "numeric" }),
    hour: "2-digit",
    minute: "2-digit",
  });
}
const turnRange = (from: number, to: number) =>
  to <= from ? `vuoro ${from}` : `vuorot ${from}–${to}`;

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
          <th scope="col">Osa</th>
          <th scope="col" className="num">
            Tokenia
          </th>
          <th scope="col" className="num">
            Osuus
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
      ? "Automaattinen tiivistys on pois päältä; tiivistys tapahtuu vain pyynnöstä."
      : view.threshold !== undefined
        ? `Pi tiivistää, kun käyttö ylittää ${full(view.threshold)} tokenia.`
        : "Tiivistyksen hetkeä ei voi laskea ilman mallin ikkunan kokoa.";
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
              Jo tiivistelmässä
            </span>
            <span>
              <i data-st="next" />
              Tiivistyy seuraavaksi
            </span>
            <span>
              <i data-st="kept" />
              Säilyy
            </span>
          </p>
        </>
      ) : null}
      <p className="ah-cd-text" data-testid="context-next">
        {when}{" "}
        {next
          ? `Silloin ${next.through_turn >= next.from_turn ? turnRange(next.from_turn, next.through_turn) : "keskustelun alku"} (noin ${kt(next.summarized_tokens)} tokenia) korvautuu yhteenvedolla${detail.compactions.length ? ", joka päivittää edellisen tiivistelmän" : ""}. ${next.split_turn ? `Vuoro ${next.kept_from_turn} jakautuu: sen alku tiivistyy ja loppu säilyy.` : `${turnRange(next.kept_from_turn, last)} säilyy sellaisenaan.`}`
          : detail.settings
            ? "Tiivistettävää ei vielä ole: Pi säilyttäisi koko keskustelun sellaisenaan."
            : "Pi:n tiivistysasetuksia ei voitu lukea, joten seuraavaa tiivistystä ei voi ennakoida."}
      </p>
      <p className="ah-cd-fine">
        Pi:n oma leikkaussääntö
        {detail.settings
          ? `: uusimmat noin ${full(detail.settings.keep_recent_tokens)} tokenia säilyvät vuoron alusta lähtien.`
          : "."}{" "}
        Tiivistetyt vuorot jäävät sessiotiedostoon ja keskusteluun, mutta malli
        ei enää näe niitä sellaisinaan.
      </p>
    </>
  );
}

function Compactions({ detail }: { detail: ContextDetail }) {
  if (!detail.compactions.length)
    return <p className="ah-cd-empty">Ei tiivistyksiä tässä keskustelussa.</p>;
  return (
    <ol className="ah-cd-comps" data-testid="context-compactions">
      {detail.compactions
        .map((c, i) => ({ c, n: i + 1 }))
        .reverse()
        .map(({ c, n }) => {
          return (
            <li key={n}>
              <p className="ah-cd-comp-h">
                <strong>Tiivistys {n}</strong>
                <span>
                  {clock(c.at)} ·{" "}
                  {c.kept_from_turn > 1
                    ? `${turnRange(1, c.kept_from_turn - 1)} tiivistelmään`
                    : "ei kokonaisia vuoroja"}
                </span>
              </p>
              <p className="ah-cd-comp-n num">
                {full(c.tokens_before)} →{" "}
                {c.tokens_after !== undefined
                  ? `${full(c.tokens_after)} seuraavassa vastauksessa`
                  : "koko seuraavasta vastauksesta"}
              </p>
              <p className="ah-cd-fine">
                Yhteenveto noin {full(c.summary_tokens)} tokenia
              </p>
              <pre className="ah-cd-summary">{c.summary}</pre>
              {c.summary_truncated ? (
                <p className="ah-cd-fine">
                  Tiivistelmä on katkaistu; koko teksti on sessiotiedostossa.
                </p>
              ) : null}
              {[
                ["Luetut", c.read_files],
                ["Muutetut", c.modified_files],
              ].map(([label, files]) =>
                files.length ? (
                  <p className="ah-cd-files" key={label as string}>
                    <span>
                      {label} {files.length}
                    </span>{" "}
                    <span className="mono">
                      {(files as string[]).join(", ")}
                    </span>
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
              <th scope="col">Aika</th>
              <th scope="col">Pyyntö</th>
              <th scope="col" className="num">
                Konteksti
              </th>
              <th scope="col" className="num">
                Muutos
              </th>
              <th scope="col" className="num opt">
                Uusi syöte
              </th>
              <th scope="col" className="num opt">
                Välimuistista
              </th>
              <th scope="col" className="num opt">
                Tuotos
              </th>
              {priced ? (
                <th scope="col" className="num opt">
                  Hinta
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
                      {t.cost.toLocaleString("fi-FI", {
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
                      Tiivistys {n}: {full(c.tokens_before)} tokenia →
                      yhteenveto noin {full(c.summary_tokens)}
                      {c.kept_from_turn <= c.after_turn
                        ? `; ${turnRange(c.kept_from_turn, c.after_turn)} ${c.after_turn > c.kept_from_turn ? "säilyivät" : "säilyi"} sellaisenaan`
                        : ""}
                    </td>
                  </tr>
                )),
              ];
            })}
          </tbody>
        </table>
      </div>
      <p className="ah-cd-fine">
        Konteksti on Pi:n mittaama vuoron viimeisestä vastauksesta. Syöte,
        välimuisti ja tuotos ovat vuoron kaikkien vastausten summia: jokainen
        työkalukutsun jälkeinen vastaus lukee koko kontekstin uudelleen.
        {priced
          ? " Hinta on Pi:n kirjaama."
          : " Pi kirjasi hinnaksi 0, mikä on tavallista tilauksen kautta käytetyille malleille."}
        {detail.turns_omitted
          ? ` ${detail.turns_omitted} vanhempaa vuoroa ei näytetä.`
          : ""}
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
          aria-label={`Takaisin keskusteluun: ${title}`}
          onPress={onClose}
        >
          <Icon name="back" />
          <span>{title}</span>
        </ControlButton>
        <h2 id="ah-cd-title" tabIndex={-1} ref={heading}>
          Konteksti
        </h2>
        {!detail ? (
          <p className="ah-cd-text" role="status">
            {read.state === "loading"
              ? "Luetaan Pi:n sessiota…"
              : "Kontekstin erittelyä ei voitu lukea. Keskustelu ja sen historia ovat ennallaan."}
          </p>
        ) : view ? (
          <>
            {read.state === "unavailable" ? (
              <p className="ah-cd-text" role="status">
                Uusinta erittelyä ei voitu lukea; näytetään edellinen.
              </p>
            ) : null}
            <div className="ah-cd-top" data-level={level}>
              <p className="ah-cd-big" data-testid="context-total">
                {view.measured === undefined ? (
                  <>
                    ? <span>arvio noin {full(view.total)} tokenia</span>
                  </>
                ) : view.percent !== undefined && view.window ? (
                  <>
                    {pc(view.percent)}{" "}
                    <span>
                      {full(view.measured)} / {full(view.window)} tokenia
                    </span>
                  </>
                ) : (
                  <>
                    {full(view.measured)}{" "}
                    <span>tokenia · ikkuna ei tiedossa</span>
                  </>
                )}
              </p>
              <Bar view={view} estimate={view.measured === undefined} />
              <p className="ah-cd-text">
                {view.measured === undefined
                  ? "Pi mittaa koon seuraavasta vastauksesta; siihen asti kokonaismääräkin on arvio."
                  : view.threshold !== undefined && view.window
                    ? view.threshold > view.measured
                      ? `${full(view.threshold - view.measured)} tokenia tilaa ennen tiivistystä (raja ${full(view.threshold)}).`
                      : `Käyttö on tiivistysrajan (${full(view.threshold)}) yli; Pi tiivistää seuraavan vuoron jälkeen.`
                    : detail.settings?.enabled === false
                      ? "Automaattinen tiivistys on pois päältä."
                      : "Tiivistysrajaa ei voi laskea ilman mallin ikkunan kokoa."}
                {detail.trailing_tokens && view.measured !== undefined
                  ? ` Viimeisen mittauksen jälkeen on tullut noin ${full(detail.trailing_tokens)} tokenia.`
                  : ""}
              </p>
              <p className="ah-cd-meta">
                <span className="mono">
                  {usage?.model ?? detail.model ?? "Malli ei tiedossa"}
                </span>
                {" · "}ikkuna {view.window ? full(view.window) : "ei tiedossa"}
                {detail.settings
                  ? ` · vara ${full(detail.settings.reserve_tokens)} · säilytettävä ${full(detail.settings.keep_recent_tokens)}`
                  : ""}
              </p>
              {detail.harness === "claude_code" ? (
                <p className="ah-cd-fine" data-testid="context-harness">
                  Keskustelu kulkee Pi:n Claude-sillan kautta. Claude Code
                  lähettää oman järjestelmäkehotteensa Pi:n perusohjeen tilalle,
                  eikä sen kokoa kirjata sessiotiedostoon; Pi:stä välittyvät
                  projektin ohjeet, skillit ja työkalut.
                </p>
              ) : null}
            </div>
            <div className="ah-cd-grid">
              <section aria-labelledby="ah-cd-parts">
                <h3 id="ah-cd-parts">Mistä se koostuu</h3>
                <Composition view={view} />
                <p className="ah-cd-fine">
                  {view.measured === undefined
                    ? "Tiivistyksen jälkeen kokonaismääräkin on arvio, kunnes Pi mittaa sen seuraavasta vastauksesta."
                    : "Kokonaismäärä on Pi:n mittaama viimeisestä vastauksesta."}{" "}
                  Osat ovat Pi:n omaa arviota sessiotiedoston sisällöstä (merkit
                  / 4).
                  {view.over
                    ? ` Arvio ylittää mitatun ${full(view.over)} tokenilla.`
                    : ""}
                </p>
              </section>
              <section aria-labelledby="ah-cd-next">
                <h3 id="ah-cd-next">Seuraava tiivistys</h3>
                <NextCompaction detail={detail} view={view} />
                <h3>Tiivistykset</h3>
                <Compactions detail={detail} />
              </section>
            </div>
            <section aria-labelledby="ah-cd-turns">
              <h3 id="ah-cd-turns">Vuorot</h3>
              <Turns detail={detail} view={view} />
            </section>
          </>
        ) : null}
      </div>
    </section>
  );
}
