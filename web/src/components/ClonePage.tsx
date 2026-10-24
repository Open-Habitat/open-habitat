import { type ReactNode, useId, useState } from "react";
import { ControlButton, LinkRow, Segmented } from "./ControlElements";
import { cloneProgressText } from "./cloneProgress";
import { Icon } from "./Icon";
import {
  type Arrangement,
  type CatalogRepo,
  largeKiB,
  repoKey,
  type Since,
  sectionLimit,
  sinceChoices,
  size,
  when,
} from "./repoCatalog";
import "./ClonePage.css";

// Display only. The app owns the catalog, the route that selects a repo, the
// clone jobs and every write; these components say what they are given.

export type RepoChoice = CatalogRepo & {
  /** The route that selects this repository. */
  href: string;
  selected?: boolean;
  /** A short word beside the name: already a workspace, or its clone's state. */
  mark?: { label: string; tone: "ok" | "run" | "warn" };
};
export type LookupView =
  | { state: "searching"; name: string }
  | { state: "found"; name: string; repo: RepoChoice }
  | { state: "not_found"; name: string }
  | { state: "failed"; name: string };

const kib = (n: number) => size(n * 1024);

function RepoRow({ repo, now }: { repo: RepoChoice; now: number }) {
  const [owner, name] = repo.full_name.split("/");
  return (
    <li>
      <LinkRow
        data-testid={`repository-option-${repo.full_name}`}
        data-source={repo.source ? "gitea" : "github"}
        data-connection={repo.source?.id}
        href={repo.href}
        kind="nav"
        current={repo.selected}
        className="ah-clone-row"
      >
        <span className="ah-clone-row-name">
          <span className="ah-mono">
            <span className="ah-clone-owner">{owner}/</span>
            <b>{name}</b>
          </span>
          {repo.private ? (
            <span className="ah-clone-lock" title="Yksityinen">
              <Icon name="lock" width={12} height={12} />
              <span className="ah-visually-hidden">Yksityinen</span>
            </span>
          ) : null}
          {repo.source ? (
            <span className="ah-clone-chip ah-clone-source ah-mono">
              {repo.source.label}
            </span>
          ) : null}
          {repo.mark ? (
            <span className={`ah-clone-chip ah-clone-chip-${repo.mark.tone}`}>
              {repo.mark.label}
            </span>
          ) : null}
        </span>
        {repo.description ? (
          <span className="ah-clone-row-desc">{repo.description}</span>
        ) : null}
        <span className="ah-clone-row-meta">
          <span>{when(repo.pushed_at, now)}</span>
          <span>{kib(repo.size_kib)}</span>
          {repo.size_kib >= largeKiB ? (
            <span className="ah-clone-big">suuri</span>
          ) : null}
        </span>
      </LinkRow>
    </li>
  );
}

export function RepoFinder({
  arrangement,
  query,
  onQuery,
  since,
  onSince,
  now,
  lookup,
  incomplete,
  state,
  sourceNotes = [],
}: {
  arrangement: Arrangement<RepoChoice>;
  query: string;
  onQuery: (value: string) => void;
  since: Since;
  onSince: (value: Since) => void;
  now: number;
  /** The exact owner/repo typed in the search, looked up on GitHub. */
  lookup?: LookupView;
  /** The daemon's page bound was reached: some repositories are not listed. */
  incomplete?: boolean;
  /** The catalog itself: loading, failed or read. */
  state: "loading" | "failed" | "ready";
  /** What each connected Gitea's own list says beside GitHub's: a failed or
   * incomplete source, already in words. */
  sourceNotes?: { key: string; text: string; failed: boolean }[];
}) {
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const searchId = useId();
  const hiddenNote = (n: number) =>
    n ? <span>{n} ei päivitetty valitulla aikavälillä</span> : null;
  return (
    <div className="ah-clone-finder">
      <div className="ah-clone-find">
        <label className="ah-clone-search" htmlFor={searchId}>
          <Icon name="search" width={15} height={15} />
          <span className="ah-visually-hidden">Hae repoa</span>
          <input
            data-testid="repository-search"
            id={searchId}
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Hae nimellä tai kirjoita omistaja/repo"
            autoComplete="off"
            spellCheck={false}
          />
        </label>
        <Segmented
          label="Päivitetty"
          className="ah-clone-since"
          options={sinceChoices}
          value={since}
          onChange={onSince}
        />
      </div>
      {state === "loading" ? (
        <p className="ah-clone-empty" role="status">
          Haetaan repoja GitHubista…
        </p>
      ) : state === "failed" ? (
        <p className="ah-clone-empty" role="alert">
          Repolistaa ei saatu GitHubista. Voit silti kirjoittaa repon nimen
          muodossa omistaja/repo.
        </p>
      ) : null}
      {sourceNotes.map((n) => (
        <p
          key={n.key}
          data-testid="repository-source-note"
          data-failed={n.failed ? "" : undefined}
          className={n.failed ? "ah-clone-empty" : "ah-clone-hint"}
          role={n.failed ? "alert" : undefined}
        >
          {n.text}
        </p>
      ))}
      {lookup ? (
        <section
          data-testid="repository-lookup"
          data-state={lookup.state}
          className="ah-clone-sec"
          aria-label="GitHub-haku"
        >
          <h3>
            <span className="ah-mono ah-clone-sec-owner">{lookup.name}</span>
            <span className="ah-clone-kind">GitHubista</span>
          </h3>
          {lookup.state === "found" ? (
            <ul>
              <RepoRow repo={lookup.repo} now={now} />
            </ul>
          ) : (
            <p
              data-testid="repo-lookup"
              data-state={lookup.state}
              className="ah-clone-empty"
              role={lookup.state === "searching" ? "status" : undefined}
            >
              {lookup.state === "searching"
                ? "Haetaan GitHubista…"
                : lookup.state === "not_found"
                  ? "Repoa ei ole, tai sinulla ei ole siihen pääsyä."
                  : "GitHubiin ei saatu yhteyttä. Yritä hetken päästä uudelleen."}
            </p>
          )}
        </section>
      ) : null}
      {arrangement.kind === "search" ? (
        arrangement.hits.length ? (
          <section className="ah-clone-sec">
            <h3>
              Hakutulokset{" "}
              <span className="ah-clone-n">{arrangement.hits.length}</span>
            </h3>
            <ul>
              {arrangement.hits.map((r) => (
                <RepoRow key={repoKey(r)} repo={r} now={now} />
              ))}
            </ul>
            <p className="ah-clone-secfoot">{hiddenNote(arrangement.hidden)}</p>
          </section>
        ) : state === "ready" && !lookup ? (
          <p className="ah-clone-empty">
            Ei osumia haulle <b>{query.trim()}</b>
            {arrangement.hidden
              ? ` valitulla aikavälillä. ${arrangement.hidden} vanhempaa osumaa piilossa.`
              : "."}{" "}
            Kirjoita omistaja/repo, niin haemme sen GitHubista.
          </p>
        ) : null
      ) : (
        <>
          {arrangement.recent.length ? (
            <section className="ah-clone-sec">
              <h3>Viimeksi päivitetyt</h3>
              <ul>
                {arrangement.recent.map((r) => (
                  <RepoRow key={repoKey(r)} repo={r} now={now} />
                ))}
              </ul>
            </section>
          ) : null}
          {arrangement.sections.map((s) => {
            const all = open[s.key];
            const shown = all ? s.fresh : s.fresh.slice(0, sectionLimit);
            return (
              <section className="ah-clone-sec" key={s.key}>
                <h3
                  data-testid={`repo-owner-${s.owner}`}
                  data-source={s.source ? "gitea" : "github"}
                >
                  <span className="ah-mono ah-clone-sec-owner">{s.owner}</span>
                  {s.source ? (
                    <span className="ah-clone-chip ah-clone-source ah-mono">
                      {s.source.label}
                    </span>
                  ) : null}
                  <span className="ah-clone-kind">{s.kind}</span>
                  <span className="ah-clone-n">{s.total}</span>
                </h3>
                {shown.length ? (
                  <ul>
                    {shown.map((r) => (
                      <RepoRow key={repoKey(r)} repo={r} now={now} />
                    ))}
                  </ul>
                ) : null}
                <p className="ah-clone-secfoot">
                  {s.fresh.length > sectionLimit ? (
                    <ControlButton
                      data-testid="expand-repos"
                      size="inline"
                      variant="quiet"
                      aria-expanded={!!all}
                      onPress={() => setOpen({ ...open, [s.key]: !all })}
                    >
                      {all
                        ? "Näytä vähemmän"
                        : `Näytä kaikki ${s.fresh.length}`}
                    </ControlButton>
                  ) : null}
                  {hiddenNote(s.hidden)}
                </p>
              </section>
            );
          })}
        </>
      )}
      {incomplete ? (
        <p className="ah-clone-hint">
          Lista on katkaistu tuhanteen repoon. Kirjoita muun repon nimi muodossa
          omistaja/repo.
        </p>
      ) : null}
    </div>
  );
}

export type DetailsState =
  | { kind: "ready" }
  | { kind: "workspace"; onOpen: () => void; path: string }
  | { kind: "taken"; path: string }
  | { kind: "job" };

export function CloneMode({
  name,
  repo,
  mode,
  onMode,
  legend = "Kloonataan",
}: {
  name: string;
  repo?: Pick<CatalogRepo, "size_kib">;
  mode: "full" | "blobless";
  onMode: (mode: "full" | "blobless") => void;
  legend?: string;
}) {
  return (
    <fieldset className="ah-clone-mode">
      <legend>{legend}</legend>
      <label>
        <input
          type="radio"
          name={name}
          checked={mode === "full"}
          onChange={() => onMode("full")}
        />
        <span>
          <b>Koko historia</b>
          {repo ? `noin ${kib(repo.size_kib)}. ` : ""}Kaikki tiedostoversiot
          heti levylle.
        </span>
      </label>
      <label>
        <input
          data-testid="blobless-clone"
          type="radio"
          name={name}
          checked={mode === "blobless"}
          onChange={() => onMode("blobless")}
        />
        <span>
          <b>Kevyt klooni</b>
          Kaikki commitit, mutta vanhat tiedostoversiot haetaan GitHubista
          vasta, kun niitä tarvitaan (<code>--filter=blob:none</code>). Nopeampi
          ja pienempi; <code>git log -p</code> ja <code>blame</code> vaativat
          yhteyden.
        </span>
      </label>
    </fieldset>
  );
}

export function RepoDetails({
  repo,
  now,
  back,
  free,
  state,
  mode,
  onMode,
  onClone,
  cloneReason,
  problem,
}: {
  repo?: CatalogRepo;
  now: number;
  /** On a phone the list and the details are shown one at a time. */
  back?: string;
  /** limit_bytes is absent when the installation has no per-user limits. */
  free?: { free_bytes: number; limit_bytes?: number };
  state: DetailsState;
  mode: "full" | "blobless";
  onMode: (mode: "full" | "blobless") => void;
  onClone: () => void;
  /** Why Kloonaa cannot be pressed now, said beside it. */
  cloneReason?: string;
  problem?: string;
}) {
  if (!repo)
    return (
      <aside
        data-testid="repo-details"
        className="ah-clone-detail ah-clone-none"
        aria-label="Repon tiedot"
      >
        <p>Valitse repo nähdäksesi sen tiedot ennen kloonausta.</p>
      </aside>
    );
  const [owner, name] = repo.full_name.split("/");
  const gitea = repo.source;
  // A Gitea clone is always full: no partial-clone assumptions for it.
  const big = !gitea && repo.size_kib >= largeKiB;
  const reasonId = `clone-reason-${name}`;
  return (
    <aside
      data-testid="repo-details"
      className="ah-clone-detail"
      aria-label="Repon tiedot"
    >
      {back ? (
        <LinkRow
          data-testid="all-repos"
          href={back}
          kind="inline"
          className="ah-clone-back"
        >
          <Icon name="back" width={15} height={15} />
          Kaikki repot
        </LinkRow>
      ) : null}
      <h2 className="ah-mono">
        <span className="ah-clone-owner">{owner}/</span>
        {name}
      </h2>
      {repo.description ? (
        <p className="ah-clone-desc">{repo.description}</p>
      ) : null}
      <dl className="ah-clone-facts">
        {gitea ? (
          <>
            <dt>Lähde</dt>
            <dd>
              <span className="ah-mono" data-testid="repo-details-source">
                {gitea.login} · {gitea.label}
              </span>
            </dd>
          </>
        ) : null}
        <dt>Näkyvyys</dt>
        <dd>
          {repo.private ? (
            <>
              <Icon
                name="lock"
                width={12}
                height={12}
                className="ah-clone-ic-muted"
              />
              Yksityinen
            </>
          ) : (
            "Julkinen"
          )}
        </dd>
        <dt>Oletushaara</dt>
        <dd>
          <span className="ah-mono">{repo.default_branch ?? "ei haaraa"}</span>
        </dd>
        <dt>Viimeisin push</dt>
        <dd>{when(repo.pushed_at, now)}</dd>
        <dt>Koko</dt>
        <dd>
          {kib(repo.size_kib)}{" "}
          <span className="ah-clone-sub">
            {gitea
              ? "Gitean ilmoittama koko"
              : "GitHubin arvio pakatusta historiasta"}
          </span>
        </dd>
        <dt>Kohde</dt>
        <dd>
          <span className="ah-mono">~/src/{name}</span>
        </dd>
        {free ? (
          <>
            <dt>Vapaata</dt>
            <dd>
              {size(free.free_bytes)}{" "}
              <span className="ah-clone-sub">
                {free.limit_bytes === undefined
                  ? "palvelimen yhteisellä levyllä"
                  : `kiintiöstä ${size(free.limit_bytes)}`}
              </span>
            </dd>
          </>
        ) : null}
      </dl>
      {state.kind === "workspace" ? (
        <>
          <p className="ah-clone-note ah-clone-note-ok">
            <Icon
              name="check"
              width={15}
              height={15}
              className="ah-clone-ic-ok"
            />
            <span>
              Repo on jo työtilana <span className="ah-mono">{state.path}</span>
              .
            </span>
          </p>
          <div className="ah-clone-actions">
            <ControlButton
              data-testid="cloned-workspace-open"
              size="row"
              variant="primary"
              onPress={state.onOpen}
            >
              Avaa työtila
            </ControlButton>
          </div>
        </>
      ) : state.kind === "taken" ? (
        <p className="ah-clone-note ah-clone-note-warn">
          <Icon
            name="warning"
            width={15}
            height={15}
            className="ah-clone-ic-warn"
          />
          <span>
            Hakemisto <span className="ah-mono">{state.path}</span> on jo
            olemassa, joten tätä repoa ei voi kloonata sinne. Nimeä tai poista
            nykyinen työtila ensin.
          </span>
        </p>
      ) : state.kind === "job" ? (
        <p className="ah-clone-note">
          <Icon
            name="info"
            width={15}
            height={15}
            className="ah-clone-ic-muted"
          />
          <span>Tämän repon kloonaus näkyy sivun yläosassa.</span>
        </p>
      ) : (
        <>
          {big ? (
            <>
              <p className="ah-clone-note ah-clone-note-warn">
                <Icon
                  name="warning"
                  width={15}
                  height={15}
                  className="ah-clone-ic-warn"
                />
                <span>
                  <b>Suuri repo.</b> Täysi klooni vie noin {kib(repo.size_kib)}
                  {free && free.free_bytes > 0
                    ? `, ${Math.round((100 * repo.size_kib * 1024) / free.free_bytes)} % vapaasta tilasta`
                    : ""}
                  , ja haku kestää yhteydestä riippuen kymmeniä minuutteja.
                </span>
              </p>
              <CloneMode
                name={`mode-${repo.full_name}`}
                repo={repo}
                mode={mode}
                onMode={onMode}
              />
            </>
          ) : null}
          {problem ? (
            <p className="ah-clone-problem" role="alert">
              {problem}
            </p>
          ) : null}
          <div className="ah-clone-actions">
            <ControlButton
              data-testid="repository-clone"
              size="page"
              variant="primary"
              isDisabled={!!cloneReason}
              aria-describedby={cloneReason ? reasonId : undefined}
              onPress={onClone}
            >
              <Icon name={gitea ? "branch" : "github"} />
              Kloonaa työtilaksi
            </ControlButton>
          </div>
          <p className="ah-clone-hint" id={reasonId}>
            {cloneReason ??
              (gitea
                ? "Kloonataan tämän Gitea-yhteyden tunnuksella. Kloonaus jatkuu palvelimella, vaikka poistut sivulta."
                : "Kloonataan sinun GitHub-tunnuksillasi. Kloonaus jatkuu palvelimella, vaikka poistut sivulta.")}
          </p>
        </>
      )}
    </aside>
  );
}

const stages = {
  reserving: "Varataan kohdetta",
  connecting: "Yhdistetään GitHubiin",
  receiving: "Vastaanotetaan objekteja",
  checkout: "Kirjoitetaan tiedostoja",
  verifying: "Tarkistetaan",
} as const;
const reasons: Record<string, string> = {
  native_failure:
    "Git keskeytti kloonauksen, esimerkiksi koska GitHub katkaisi yhteyden.",
  deadline_exceeded: "Kloonaus ei valmistunut 45 minuutissa.",
  verification_failed:
    "Git valmistui, mutta kloonia ei voitu vahvistaa (esimerkiksi tyhjä repo).",
  destination_exists: "Kohdehakemisto ilmestyi kloonauksen aikana.",
  source_unavailable: "Repoa ei saatu luettua GitHubista.",
  daemon_stopping: "Palvelin pysähtyi kesken kloonauksen.",
  cancelled: "Kloonaus keskeytettiin.",
};
// Bar position by stage: receiving is most of the work.
const bar = (stage: keyof typeof stages | undefined, percent = 0) =>
  stage === "receiving"
    ? percent * 0.85
    : stage === "checkout"
      ? 85 + percent * 0.13
      : stage === "verifying"
        ? 99
        : 2;

export type CloneCardView =
  | {
      kind: "job";
      full_name: string;
      /** A Gitea clone names its connection and repository. */
      source?: {
        provider: "gitea";
        connection_id: string;
        repository_id: number;
      };
      mode: "full" | "blobless";
      state: "running" | "confirmed" | "failed" | "cancelled";
      stage?: keyof typeof stages;
      percent?: number;
      received_bytes?: number;
      reason?: string;
      leftover?: "removed" | "kept";
    }
  | {
      kind: "interrupted";
      full_name: string;
      size_bytes: number;
      /** A Gitea clone; restart is offered only with its connection. */
      source?: { provider: "gitea"; connection_id?: string };
    }
  | {
      /** Asked for in this tab and not yet a job: the daemon runs one at a time. */
      kind: "queued";
      full_name: string;
      mode: "full" | "blobless";
      state: "waiting" | "refused";
      /** Why the start was refused, already in words. */
      refusal?: string;
      /** The start's reply was lost: whether it began is not yet known. */
      unsettled?: boolean;
    };

export function CloneCard({
  view,
  large,
  busy,
  problem,
  writeReason,
  onOpen,
  onCancel,
  onRetry,
  onDismiss,
  onRestart,
  onRemove,
}: {
  view: CloneCardView;
  /** The repository is large: a restart offers the light clone. */
  large?: boolean;
  /** An action of this card is on its way. */
  busy?: boolean;
  problem?: string;
  /** Why no write can be sent now (connection, read-only host). */
  writeReason?: string;
  /** Opens a confirmed clone's workspace, once the workspace list shows it. */
  onOpen?: () => void;
  onCancel?: () => void;
  onRetry?: (mode: "full" | "blobless") => void;
  onDismiss?: () => void;
  onRestart?: (mode: "full" | "blobless") => void;
  onRemove?: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const [mode, setMode] = useState<"full" | "blobless">(
    view.kind === "job" ? view.mode : "full",
  );
  const name = view.full_name.split("/")[1];
  const dest = `~/src/${name}`;
  const off = busy || !!writeReason;
  const state =
    view.kind === "interrupted"
      ? "interrupted"
      : view.kind === "queued"
        ? view.state === "waiting"
          ? "running"
          : "failed"
        : view.state === "cancelled"
          ? "failed"
          : view.state;
  let body: ReactNode = null;
  let actions: ReactNode = null;
  if (view.kind === "job" && view.state === "running") {
    const received = view.received_bytes;
    body = (
      <>
        <div
          className="ah-clone-bar"
          role="progressbar"
          aria-label={`Kloonauksen ${view.full_name} edistyminen`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={view.stage === "receiving" ? view.percent : undefined}
        >
          <span style={{ width: `${bar(view.stage, view.percent)}%` }} />
        </div>
        <p className="ah-clone-line" role="status">
          {cloneProgressText(view.stage, view.percent, received)}
        </p>
        <p className="ah-clone-hint">
          Kloonaus jatkuu palvelimella, vaikka poistut sivulta tai suljet
          selaimen.
        </p>
      </>
    );
    actions = confirm ? (
      <div className="ah-clone-confirm">
        <span>
          Keskeytetäänkö?{" "}
          {received
            ? `Vastaanotetut ${size(received)} poistetaan`
            : "Mitään ei ole vielä vastaanotettu"}
          , eikä keskeneräistä jää levylle.
        </span>
        <ControlButton
          data-testid="continue-clone"
          size="row"
          onPress={() => setConfirm(false)}
        >
          Jatka kloonausta
        </ControlButton>
        <ControlButton
          data-testid="cancel-clone"
          size="row"
          variant="danger"
          isDisabled={off}
          onPress={() => {
            setConfirm(false);
            onCancel?.();
          }}
        >
          Keskeytä
        </ControlButton>
      </div>
    ) : (
      <div className="ah-clone-actions">
        <ControlButton
          data-testid="cancel-clone"
          size="row"
          isDisabled={off}
          title={writeReason}
          onPress={() => setConfirm(true)}
        >
          Keskeytä
        </ControlButton>
      </div>
    );
  } else if (view.kind === "job" && view.state === "confirmed") {
    body = (
      <p>
        Valmis. Repo on kloonattu hakemistoon{" "}
        <span className="ah-mono">{dest}</span>.
      </p>
    );
    actions = (
      <div className="ah-clone-actions">
        <ControlButton
          data-testid="dialog-close"
          size="row"
          isDisabled={off}
          title={writeReason}
          onPress={onDismiss}
        >
          Sulje
        </ControlButton>
        {onOpen ? (
          <ControlButton
            data-testid="cloned-workspace-open"
            size="row"
            variant="primary"
            onPress={onOpen}
          >
            Avaa työtila
          </ControlButton>
        ) : (
          <span className="ah-clone-hint" role="status">
            Odotetaan työtilalistaa…
          </span>
        )}
      </div>
    );
  } else if (view.kind === "job") {
    const kept = view.leftover === "kept";
    body = (
      <>
        <p data-testid="clone-failed" className="ah-clone-title">
          {view.state === "cancelled"
            ? "Kloonaus keskeytettiin"
            : "Kloonaus epäonnistui"}
        </p>
        <p>
          {view.state === "cancelled"
            ? ""
            : `${reasons[view.reason ?? ""] ?? ""} `}
          {kept
            ? `Hakemisto ${dest} jäi levylle.`
            : "Keskeneräinen hakemisto poistettiin, joten levylle ei jäänyt mitään ja uusi yritys alkaa puhtaalta pöydältä."}
        </p>
      </>
    );
    actions = (
      <div className="ah-clone-actions">
        <ControlButton
          size="row"
          isDisabled={off}
          title={writeReason}
          onPress={onDismiss}
        >
          Poista ilmoitus
        </ControlButton>
        {kept ? null : (
          <ControlButton
            data-testid="retry"
            size="row"
            variant="primary"
            isDisabled={off}
            title={writeReason}
            onPress={() => onRetry?.(view.mode)}
          >
            <Icon name="refresh" />
            Yritä uudelleen
          </ControlButton>
        )}
      </div>
    );
  } else if (view.kind === "queued") {
    body =
      view.state === "waiting" ? (
        <p className="ah-clone-line" role="status">
          Jonossa. Alkaa, kun edellinen kloonaus valmistuu.
        </p>
      ) : (
        <>
          <p data-testid="clone-failed" className="ah-clone-title">
            Kloonaus ei alkanut
          </p>
          <p>
            {view.refusal}
            {view.unsettled ? "" : " Levylle ei kirjoitettu mitään."}
          </p>
        </>
      );
    actions = (
      <div className="ah-clone-actions">
        <ControlButton
          data-testid="unqueue-clone"
          size="row"
          isDisabled={busy}
          onPress={onDismiss}
        >
          {view.state === "waiting" ? "Poista jonosta" : "Poista ilmoitus"}
        </ControlButton>
        {view.state === "refused" ? (
          <ControlButton
            data-testid="retry"
            size="row"
            variant="primary"
            isDisabled={off}
            title={writeReason}
            onPress={() => onRetry?.(view.mode)}
          >
            <Icon name="refresh" />
            Yritä uudelleen
          </ControlButton>
        ) : null}
      </div>
    );
  } else if (view.kind === "interrupted") {
    body = (
      <>
        <p data-testid="clone-interrupted" className="ah-clone-title">
          Kloonaus keskeytyi
        </p>
        <p>
          Hakemistossa <span className="ah-mono">{dest}</span> on keskeneräinen{" "}
          <span className="ah-mono">.git</span> ({size(view.size_bytes)}) ilman
          yhtään committia tai tiedostoa, esimerkiksi koska palvelin käynnistyi
          uudelleen kesken kloonauksen. Git ei osaa jatkaa keskeytynyttä
          kloonausta, joten uusi yritys alkaa alusta.
        </p>
        {large && !view.source ? (
          <CloneMode
            name={`restart-${view.full_name}`}
            mode={mode}
            onMode={setMode}
            legend="Uusi yritys"
          />
        ) : null}
      </>
    );
    actions = (
      <div className="ah-clone-actions">
        <ControlButton
          data-testid="remove-clone"
          size="row"
          isDisabled={off}
          title={writeReason}
          onPress={onRemove}
        >
          Poista keskeneräinen ({size(view.size_bytes)})
        </ControlButton>
        {onRestart ? (
          <ControlButton
            data-testid="restart-clone"
            size="row"
            variant="primary"
            isDisabled={off}
            title={writeReason}
            onPress={() => onRestart(mode)}
          >
            <Icon name="refresh" />
            Aloita alusta
          </ControlButton>
        ) : null}
      </div>
    );
  }
  return (
    <article
      data-testid="clone-job"
      data-state={state}
      data-repository={view.full_name}
      className={`ah-clone-job ah-clone-job-${state}`}
      aria-label={`Kloonaus ${view.full_name}`}
    >
      <header className="ah-clone-jhead">
        <span className={`ah-clone-jic ah-clone-jic-${state}`}>
          {state === "running" ? (
            <span className="ah-clone-spin" aria-hidden="true" />
          ) : (
            <Icon
              name={state === "confirmed" ? "check" : "warning"}
              width={16}
              height={16}
            />
          )}
        </span>
        <div>
          <strong className="ah-mono">{view.full_name}</strong>
          <span className="ah-clone-sub">
            {view.kind !== "interrupted"
              ? view.mode === "blobless"
                ? "kevyt klooni"
                : "koko historia"
              : "keskeneräinen"}{" "}
            → <span className="ah-mono">{dest}</span>
          </span>
        </div>
      </header>
      {body}
      {problem ? (
        <p className="ah-clone-problem" role="alert">
          {problem}
        </p>
      ) : null}
      {writeReason ? <p className="ah-clone-hint">{writeReason}</p> : null}
      {actions}
    </article>
  );
}

/** The sidebar block above the workspaces: running and unfinished clones,
 * linking back to the clone page. */
export function RailClones({
  items,
  current,
}: {
  items: { name: string; label: string; live: boolean }[];
  current?: boolean;
}) {
  if (!items.length) return null;
  return (
    <LinkRow
      data-testid="clone-jobs"
      data-live={items.some((i) => i.live)}
      href="/workspaces/new"
      kind="nav"
      current={current}
      className="ah-rail-clones"
      aria-label={`Kloonaukset: ${items.map((i) => `${i.name} ${i.label}`).join(", ")}`}
    >
      {items.map((i) => (
        <span className="ah-rail-clone" key={i.name}>
          {i.live ? (
            <span
              className="ah-clone-spin ah-clone-spin-sm"
              aria-hidden="true"
            />
          ) : (
            <span className="ah-rail-clone-warn" aria-hidden="true">
              <Icon name="warning" width={12} height={12} />
            </span>
          )}
          <span className="ah-mono">{i.name}</span>
          <span className="ah-rail-clone-p">{i.label}</span>
        </span>
      ))}
    </LinkRow>
  );
}

export type CloneRowView = {
  full_name: string;
  state: "waiting" | "running" | "present" | "confirmed" | "failed";
  stage?: keyof typeof stages;
  percent?: number;
  received_bytes?: number;
  /** The job's reason code, when the daemon gave one. */
  reason?: string;
  /** Why a start was refused, already in words. */
  problem?: string;
  retryable: boolean;
};

/** What a clone row says in a word on the route. */
function routeState(r: CloneRowView): string {
  return r.state === "running"
    ? cloneProgressText(r.stage, r.percent, r.received_bytes)
    : r.state === "waiting"
      ? "jonossa"
      : r.state === "present"
        ? "oli jo haettu"
        : r.state === "confirmed"
          ? "valmis"
          : "epäonnistui";
}

/** The clones of onboarding on the route's Repot row: one short line per
 * repository with a thin bar while it runs. A failure only says so here; what
 * went wrong and the retry are in `OnboardingCloneProblems`, which has room. */
export function OnboardingClones({ rows }: { rows: readonly CloneRowView[] }) {
  if (!rows.length) return null;
  return (
    <ul
      className="ah-onboarding-clones"
      data-testid="onboarding-clones"
      aria-label="Repojen haku"
    >
      {rows.map((r) => (
        <li
          key={r.full_name}
          data-testid="onboarding-clone"
          data-name={r.full_name}
          data-state={r.state}
          className={`ah-onboarding-clone ah-onboarding-clone-${r.state}`}
        >
          <span className="ah-onboarding-clone-row">
            {r.state === "running" || r.state === "waiting" ? (
              <span className="ah-clone-spin ah-clone-spin-sm" aria-hidden />
            ) : r.state === "failed" ? (
              <span className="ah-rail-clone-warn" aria-hidden>
                <Icon name="warning" width={12} height={12} />
              </span>
            ) : (
              <span className="ah-onboarding-clone-ok" aria-hidden>
                <Icon name="check" width={12} height={12} />
              </span>
            )}
            <span className="ah-mono" title={r.full_name}>
              {r.full_name}
            </span>
          </span>
          <span className="ah-onboarding-clone-p">{routeState(r)}</span>
          {r.state === "running" ? (
            <div
              className="ah-clone-bar"
              role="progressbar"
              aria-label={`Repon ${r.full_name} haku`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={r.stage === "receiving" ? r.percent : undefined}
            >
              <span style={{ width: `${bar(r.stage, r.percent)}%` }} />
            </div>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** The failed onboarding clones under the step: why each failed and a retry
 * where nothing of the failed attempt remains. */
export function OnboardingCloneProblems({
  rows,
  onRetry,
  retryReason,
}: {
  rows: readonly CloneRowView[];
  onRetry?: (fullName: string) => void;
  /** Why a retry cannot be sent now. */
  retryReason?: string;
}) {
  const failed = rows.filter((r) => r.state === "failed");
  if (!failed.length) return null;
  return (
    <section
      className="ah-onboarding-clone-problems"
      data-testid="onboarding-clone-problems"
      aria-labelledby="onboarding-clone-problems-title"
    >
      <h3 id="onboarding-clone-problems-title">
        {failed.length === 1
          ? "Repon haku epäonnistui"
          : `${failed.length} repon haku epäonnistui`}
      </h3>
      <ul>
        {failed.map((r) => (
          <li
            key={r.full_name}
            data-testid="onboarding-clone-problem"
            data-name={r.full_name}
          >
            <span className="ah-mono">{r.full_name}</span>
            <span className="ah-onboarding-clone-fail">
              <span>
                {r.problem ??
                  (r.reason === "interrupted"
                    ? "Haku keskeytyi, ja keskeneräinen hakemisto jäi levylle. Jatka tai poista se myöhemmin kloonaussivulla."
                    : `${reasons[r.reason ?? ""] ?? "Haku ei onnistunut."}${
                        r.retryable
                          ? " Levylle ei jäänyt mitään."
                          : " Hakemisto jäi levylle; tarkista se myöhemmin kloonaussivulla."
                      }`)}
              </span>
              {r.retryable && onRetry ? (
                <ControlButton
                  data-testid="onboarding-clone-retry"
                  size="row"
                  isDisabled={!!retryReason}
                  title={retryReason}
                  onPress={() => onRetry(r.full_name)}
                >
                  <Icon name="refresh" />
                  Yritä uudelleen
                </ControlButton>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
      <p className="ah-clone-hint">
        Muut repot haetaan taustalla. Valmiit repot näkyvät työtiloina.
      </p>
    </section>
  );
}
