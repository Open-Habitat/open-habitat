import { type ReactNode, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogTrigger,
  Heading,
  Modal,
  ModalOverlay,
  Popover,
} from "react-aria-components";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import "./GitStatus.css";

// Git status of the conversation's workspace (Yläpalkissa, Jari 18.10.2026,
// issue implement-git-status-topbar): a chip in the top bar beside the model,
// anchored details on desktop and a bottom sheet on a phone.

export type GitCommit = { hash: string; subject: string; timestamp: number };
export type GitBase = {
  name: string;
  ref: string;
  source: "recorded" | "origin_head" | "local";
  ahead: number;
  behind: number;
  merged: boolean;
};
export type GitFile = {
  status: string;
  path: string;
  previous_path?: string;
  added?: number;
  deleted?: number;
};
/** What the chip needs; the snapshot's git_summary has exactly this. */
export type GitSummaryFacts = {
  branch: string;
  dirty_count: number;
  upstream?: string;
  ahead?: number;
  behind?: number;
  base?: GitBase;
};
/** The details: the workspace Git observation read on demand. */
export type GitDetailFacts = GitSummaryFacts & {
  files: GitFile[];
  files_truncated: boolean;
  commits: (GitCommit & { pushed?: boolean })[];
  commits_available: boolean;
  fetched_at?: number;
  unpushed_commits?: GitCommit[];
  incoming_commits?: GitCommit[];
  base_ahead_commits?: GitCommit[];
  base_behind_commits?: GitCommit[];
};

const count = (n: number, one: string, many: string) =>
  `${n} ${n === 1 ? one : many}`;

/** The arrows the chip shows: against the upstream, or against the base
 * branch when there is no upstream (a fresh worktree branch). */
export function gitArrows(f: GitSummaryFacts) {
  if (f.upstream && f.ahead !== undefined && f.behind !== undefined)
    return { up: f.ahead, down: f.behind, against: f.upstream, base: false };
  if (f.base)
    return {
      up: f.base.ahead,
      down: f.base.behind,
      against: f.base.ref,
      base: true,
    };
  return undefined;
}

/** The chip's accessible name says in words what the marks say. */
export function gitSentence(f: GitSummaryFacts): string {
  const parts = [`Haara ${f.branch}`];
  if (f.upstream)
    parts.push(
      f.ahead !== undefined && f.behind !== undefined
        ? `${f.ahead} lähettämättä ja ${f.behind} tulossa ${f.upstream}-haarasta`
        : `seurantahaaran ${f.upstream} tila ei tiedossa`,
    );
  if (f.base)
    parts.push(
      f.base.merged
        ? `yhdistetty ${f.base.name}-haaraan, ${f.base.behind} jäljessä`
        : `${f.base.ahead} edellä ja ${f.base.behind} jäljessä ${f.base.name}-haaraa`,
    );
  parts.push(
    count(f.dirty_count, "muuttunut tiedosto", "muuttunutta tiedostoa"),
  );
  return `${parts.join(", ")}.`;
}

/** The chip's counts: only the ones that are not zero (round 2 of
 * proto-conversation-header); the sentence and the layer give all of them. */
function Arrows({
  up,
  down,
  title,
}: {
  up: number;
  down: number;
  title: [string, string];
}) {
  if (!up && !down) return null;
  return (
    <span className="ah-gs-ab">
      {up ? (
        <span className="ah-gs-n" title={title[0]}>
          <Icon name="arrowUp" />
          {up}
        </span>
      ) : null}
      {down ? (
        <span className="ah-gs-n" title={title[1]}>
          <Icon name="arrowDown" />
          {down}
        </span>
      ) : null}
    </span>
  );
}

/** Phone widths take details as a bottom sheet rather than an anchored layer. */
export function usePhone() {
  const [phone, setPhone] = useState(
    () =>
      typeof window.matchMedia === "function" &&
      window.matchMedia("(max-width: 700px)").matches,
  );
  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const media = window.matchMedia("(max-width: 700px)");
    const update = () => setPhone(media.matches);
    media.addEventListener("change", update);
    update();
    return () => media.removeEventListener("change", update);
  }, []);
  return phone;
}

/** The top-bar chip and its layer. The caller owns the facts and reads. */
export function GitStatusChip({
  facts,
  open,
  onOpenChange,
  worktree,
  children,
}: {
  facts: GitSummaryFacts;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The conversation runs in a worktree agent's own worktree; merged says
   * its work is in the base branch (ADR 0025). */
  worktree?: { merged: boolean };
  children: ReactNode;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const phone = usePhone();
  const arrows = gitArrows(facts);
  const merged = !!worktree?.merged && !!facts.base;
  const sentence = `${worktree ? "Worktree-agentin " : ""}${
    merged && facts.base
      ? `haara ${facts.branch}, yhdistetty ${facts.base.name}-haaraan.`
      : worktree
        ? // A fresh branch is also "in the base"; until its work is merged
          // the chip counts commits instead of saying so.
          gitSentence({
            ...facts,
            base: facts.base && { ...facts.base, merged: false },
          }).replace(/^Haara/, "haara")
        : gitSentence(facts)
  }`;
  // What the header's ⋯ menu shows when the counts no longer fit beside
  // the title: "main ↑3 ●2".
  const summary = [
    facts.branch,
    merged ? "yhdistetty" : "",
    !merged && arrows?.up ? `↑${arrows.up}` : "",
    !merged && arrows?.down ? `↓${arrows.down}` : "",
    !merged && facts.dirty_count ? `●${facts.dirty_count}` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const content = (
    <Dialog
      data-testid="git-dialog"
      className="ah-dialog ah-gs-dialog"
      aria-label="Git-tila"
    >
      {children}
    </Dialog>
  );
  return (
    <DialogTrigger
      isOpen={open}
      onOpenChange={(value) => {
        onOpenChange(value);
        if (!value) queueMicrotask(() => trigger.current?.focus());
      }}
    >
      <ControlButton
        data-testid="git-chip"
        data-merged={merged}
        data-branch={facts.branch}
        data-base-ahead={facts.base?.ahead}
        data-base-behind={facts.base?.behind}
        data-upstream-ahead={facts.ahead}
        data-upstream-behind={facts.behind}
        data-changes={facts.dirty_count}
        size="inline"
        presentation="pill"
        ref={trigger}
        className={`ah-gs-chip${worktree ? " ah-gs-worktree" : ""}${merged ? " merged" : ""}`}
        aria-label={`${sentence} Avaa Git-tiedot.`}
        data-menu-summary={summary}
        title={worktree ? "Worktree · avaa tiedot" : "Git-tila · avaa tiedot"}
      >
        <Icon name={merged ? "merge" : worktree ? "worktree" : "branch"} />
        {/* The branch is named in the layer's heading and the chip's name,
            not on the chip: a long one took the title's room. */}
        {merged || arrows?.up || arrows?.down || facts.dirty_count ? (
          <span className="ah-gs-counts">
            {merged ? (
              <span className="ah-gs-chip-merged">yhdistetty</span>
            ) : arrows ? (
              <Arrows
                up={arrows.up}
                down={arrows.down}
                title={
                  arrows.base
                    ? [
                        `${count(arrows.up, "commit", "committia")} edellä ${arrows.against}-haaraa`,
                        `${count(arrows.down, "commit", "committia")} jäljessä ${arrows.against}-haarasta`,
                      ]
                    : [
                        `${count(arrows.up, "commit", "committia")} lähettämättä`,
                        `${count(arrows.down, "commit", "committia")} tulossa`,
                      ]
                }
              />
            ) : null}
            {!merged && facts.dirty_count ? (
              <span
                className="ah-gs-dirty"
                title={count(
                  facts.dirty_count,
                  "muuttunut tiedosto",
                  "muuttunutta tiedostoa",
                )}
              >
                <span className="ah-gs-dot" aria-hidden="true" />
                {facts.dirty_count}
              </span>
            ) : null}
          </span>
        ) : null}
      </ControlButton>
      {phone ? (
        <ModalOverlay className="ah-overlay ah-gs-sheet" isDismissable>
          <Modal className="ah-modal">{content}</Modal>
        </ModalOverlay>
      ) : (
        <Popover placement="bottom end" className="ah-popover ah-gs-layer">
          {content}
        </Popover>
      )}
    </DialogTrigger>
  );
}

const statusLetter = (status: string) => {
  if (status === "??")
    return { letter: "U", kind: "u", word: "Uusi, ei seurannassa" };
  // Unmerged pairs (porcelain "u" records) are conflicts whatever the letters.
  if (["DD", "AU", "UD", "UA", "DU", "AA", "UU"].includes(status))
    return { letter: "U", kind: "d", word: "Ristiriita" };
  const x = status[0] !== " " ? status[0] : status[1];
  const staged = status[0] !== " " && status[1] === " ";
  const word =
    x === "D"
      ? "Poistettu"
      : x === "A"
        ? "Lisätty"
        : x === "R"
          ? "Nimetty uudelleen"
          : x === "C"
            ? "Kopioitu"
            : "Muutettu";
  const kind = x === "D" ? "d" : x === "A" ? "a" : "m";
  return { letter: x, kind, word: staged ? `${word} · indeksissä` : word };
};

const clock = (seconds: number) => {
  const d = new Date(seconds * 1000);
  return `${d.getHours()}.${String(d.getMinutes()).padStart(2, "0")}`;
};
const age = (seconds: number, now: number) => {
  const minutes = Math.max(0, Math.floor((now - seconds * 1000) / 60000));
  if (minutes < 1) return "juuri nyt";
  if (minutes < 60) return `${minutes} min sitten`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} t sitten`;
  return `${Math.floor(hours / 24)} pv sitten`;
};

function Commits({ list, kind }: { list: GitCommit[]; kind: "in" | "out" }) {
  return (
    <ul className="ah-gs-commits">
      {list.map((commit) => (
        <li key={commit.hash} className={`ah-gs-commit ${kind}`}>
          <code className="ah-gs-hash">{commit.hash.slice(0, 7)}</code>
          <span className="ah-gs-subject">{commit.subject}</span>
          <time dateTime={new Date(commit.timestamp * 1000).toISOString()}>
            {clock(commit.timestamp)}
          </time>
        </li>
      ))}
    </ul>
  );
}

/** A folded commit list; the count is the total even when the list is cut. */
function Fold({
  label,
  total,
  list,
  kind,
}: {
  label: string;
  total: number;
  list?: GitCommit[];
  kind: "in" | "out";
}) {
  if (!total)
    return (
      <div className="ah-gs-fold empty">
        <span>{label}</span>
        <span className="ah-gs-none">ei yhtään</span>
      </div>
    );
  return (
    <details data-testid={`git-commits-${kind}`} className="ah-gs-fold">
      <summary>
        <span>{label}</span>
        <span className="ah-gs-count">{total}</span>
      </summary>
      {list ? (
        <>
          <Commits list={list} kind={kind} />
          {list.length < total ? (
            <p className="ah-gs-note">
              Näytetään {list.length} uusinta {total}:stä.
            </p>
          ) : null}
        </>
      ) : (
        <p className="ah-gs-note">Committeja ei voitu lukea.</p>
      )}
    </details>
  );
}

function Comparison({
  name,
  sub,
  up,
  down,
  words,
}: {
  name: string;
  sub: string;
  up?: number;
  down?: number;
  words: [string, string];
}) {
  return (
    <div className="ah-gs-cmp">
      <div className="ah-gs-cmp-name">
        <span className="ah-gs-mono">{name}</span>
        <span className="ah-gs-sub">{sub}</span>
      </div>
      {up !== undefined && down !== undefined ? (
        <div className="ah-gs-cmp-n">
          <span className={`ah-gs-n${up ? "" : " zero"}`}>
            <Icon name="arrowUp" />
            {up} <span className="w">{words[0]}</span>
          </span>
          <span className={`ah-gs-n${down ? "" : " zero"}`}>
            <Icon name="arrowDown" />
            {down} <span className="w">{words[1]}</span>
          </span>
        </div>
      ) : (
        <span className="ah-gs-sub">ei löydy paikallisesti</span>
      )}
    </div>
  );
}

/** The details. `detail` is the latest on-demand reading; before it arrives
 * the summary draws the comparisons and the rest says it is loading. */
export function GitStatusDetails({
  summary,
  detail,
  path,
  readAt,
  now = Date.now(),
  loading,
  readError,
  fetching,
  fetchMessage,
  fetchFailed,
  onFetch,
  fetchUnavailable,
  embedded = false,
}: {
  summary: GitSummaryFacts;
  detail?: GitDetailFacts;
  path?: string;
  readAt?: number;
  now?: number;
  loading: boolean;
  readError: boolean;
  fetching: boolean;
  fetchMessage?: string;
  fetchFailed?: boolean;
  onFetch: () => void;
  fetchUnavailable?: string;
  /** Inside another layer that has its own heading and close. */
  embedded?: boolean;
}) {
  const heading = useRef<HTMLHeadingElement>(null);
  // Focus the heading once when the layer opens, not on every new reading.
  useEffect(() => heading.current?.focus(), []);
  const facts: GitSummaryFacts = detail ?? summary;
  const files = detail?.files ?? [];
  const base = facts.base;
  return (
    <div className="ah-gs-panel">
      {embedded ? null : (
        <div className="ah-gs-top">
          <Heading
            slot="title"
            className="ah-gs-head"
            tabIndex={-1}
            ref={heading}
          >
            <Icon name="branch" />
            <span className="ah-gs-branch">{facts.branch}</span>
            {path ? <span className="ah-gs-path">{path}</span> : null}
          </Heading>
          <ControlButton
            data-testid="dialog-close"
            size="inline"
            variant="quiet"
            slot="close"
            aria-label="Sulje"
            title="Sulje"
          >
            <Icon name="cross" />
          </ControlButton>
        </div>
      )}
      {facts.upstream ? (
        <section className="ah-gs-sec" aria-label="Seurantahaara">
          <Comparison
            name={facts.upstream}
            sub="seurantahaara"
            up={facts.ahead}
            down={facts.behind}
            words={["lähettämättä", "tulossa"]}
          />
          {facts.ahead !== undefined && facts.behind !== undefined ? (
            <>
              <Fold
                label="Lähettämättä"
                total={facts.ahead}
                list={detail?.unpushed_commits}
                kind="out"
              />
              <Fold
                label="Tulossa"
                total={facts.behind}
                list={detail?.incoming_commits}
                kind="in"
              />
            </>
          ) : null}
        </section>
      ) : (
        <p className="ah-gs-note">Haaralla ei ole seurantahaaraa.</p>
      )}
      {base ? (
        <section className="ah-gs-sec" aria-label="Pohjahaara">
          <Comparison
            name={base.name}
            sub={`pohjahaara · ${base.ref}${base.source === "recorded" ? " · haara tehty siitä" : ""}`}
            up={base.ahead}
            down={base.behind}
            words={["edellä", "jäljessä"]}
          />
          {base.merged ? (
            <p className="ah-gs-merged">
              <Icon name="check" />
              Kaikki commitit ovat {base.name}-haarassa.
            </p>
          ) : (
            <Fold
              label={`Edellä ${base.name}-haaraa`}
              total={base.ahead}
              list={detail?.base_ahead_commits}
              kind="out"
            />
          )}
          <Fold
            label={`Jäljessä ${base.name}-haarasta`}
            total={base.behind}
            list={detail?.base_behind_commits}
            kind="in"
          />
        </section>
      ) : null}
      {!facts.upstream && !base && detail?.commits.length ? (
        <section className="ah-gs-sec" aria-label="Viimeisimmät commitit">
          <h4>Viimeisimmät commitit</h4>
          <Commits list={detail.commits} kind="out" />
        </section>
      ) : null}
      <section className="ah-gs-sec" aria-label="Muutokset">
        <h4>
          Muutokset <span className="ah-gs-count">{facts.dirty_count}</span>
        </h4>
        {readError ? (
          <p className="ah-gs-note" role="status">
            Git-tilaa ei voitu lukea. Näkyvä tila ei ole vahvistettu.
          </p>
        ) : !detail ? (
          <p className="ah-gs-note">{loading ? "Luetaan Git-tilaa…" : ""}</p>
        ) : !files.length ? (
          <p className="ah-gs-note">Ei muutoksia viimeisimpään committiin.</p>
        ) : (
          <ul className="ah-gs-files">
            {files.map((file) => {
              const st = statusLetter(file.status);
              const slash = file.path.lastIndexOf("/");
              return (
                <li key={`${file.status}:${file.path}`} className="ah-gs-file">
                  <span className={`ah-gs-st ${st.kind}`} title={st.word}>
                    {st.letter}
                    <span className="ah-visually-hidden">{` ${st.word}`}</span>
                  </span>
                  <span
                    className="ah-gs-file-path"
                    title={
                      file.previous_path
                        ? `${file.previous_path} → ${file.path}`
                        : file.path
                    }
                  >
                    <span className="dir">{file.path.slice(0, slash + 1)}</span>
                    {file.path.slice(slash + 1)}
                  </span>
                  {file.added !== undefined ? (
                    <span className="ah-gs-stat">
                      <span className="add">+{file.added}</span>
                      {file.deleted ? (
                        <span className="del">−{file.deleted}</span>
                      ) : null}
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
        {detail?.files_truncated ? (
          <p className="ah-gs-note">
            Näytetään {files.length} ensimmäistä {facts.dirty_count}:stä.
          </p>
        ) : null}
      </section>
      <div className="ah-gs-foot">
        <p className="ah-gs-note">
          {detail?.fetched_at !== undefined ? (
            <>
              Etärepo haettu <strong>{age(detail.fetched_at, now)}</strong> (
              {clock(detail.fetched_at)}).{" "}
            </>
          ) : detail ? (
            "Viimeisintä hakua ei tiedetä. "
          ) : null}
          Tulossa olevat commitit ovat viimeisimmän haun tietoa
          {readAt ? `; tila on luettu ${clock(readAt / 1000)}` : ""}.
        </p>
        {fetchMessage ? (
          <p
            className={`ah-gs-note${fetchFailed ? " ah-gs-error" : ""}`}
            role={fetchFailed ? "alert" : "status"}
          >
            {fetchMessage}
          </p>
        ) : null}
        <div className="ah-gs-acts">
          <ControlButton
            data-testid="fetch-git"
            size="inline"
            variant="secondary"
            className="ah-gs-fetch"
            // Busy, not disabled: disabling the focused button would drop
            // focus out of the layer (and Escape with it).
            isDisabled={!!fetchUnavailable}
            aria-busy={fetching || undefined}
            title={
              fetchUnavailable ??
              "Ajaa git fetch -komennon omana käyttäjänäsi. Ei muuta haaraa eikä tiedostoja."
            }
            onPress={() => {
              if (!fetching) onFetch();
            }}
          >
            <Icon name="refresh" />
            {fetching ? "Päivitetään…" : "Päivitä tila"}
          </ControlButton>
        </div>
        <p className="ah-gs-note">
          Päivitys hakee etätiedot (git fetch) ja lukee paikallisen tilan. Se ei
          muuta työhaaraa tai tiedostoja. Pyydä agenttia tuomaan muutokset
          työhaaraan (pull --rebase).
        </p>
      </div>
    </div>
  );
}
