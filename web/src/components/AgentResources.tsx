import { Fragment, type ReactNode } from "react";
import "./AgentResources.css";
import {
  type FolderEntry,
  fileSize,
  type Hidden,
  type Kind,
  kinds,
  type Offer,
  type Resources,
  type Source,
  type Verb,
} from "../app/agentResources";
import { syncedTime } from "../app/integrations";
import { useText } from "../i18n";
import { agentResourcesText } from "../text/agentResources";
import { ControlButton, ExternalLink, LinkRow } from "./ControlElements";
import { Icon } from "./Icon";
import { LetterMark } from "./Integrations";
import { InlineNotice } from "./Status";

// Agentin käytössä in the accepted directions of proto-agent-resources-view:
// round 1's B (a list by kind, every account's sources under each kind, the
// services still to connect at each kind's end) and round 3's C (a source
// says what is included, what is not and what the agent may do), with the
// synced folders browsable as the person sees them. These components draw
// what the page hands them; links lead to the settings that change things.

/** The account's level as the settings page shows it: a full grant in the
 * warning tone, a narrower one in the accent. */
function Pill({ pill }: { pill: Source["pill"] }) {
  if (!pill) return null;
  return (
    <span
      className={`ig-lv ${pill.full ? "full" : "narrow"}`}
      data-testid="resource-level"
    >
      <Icon className="ig-lv-icon" name={pill.full ? "key" : "lock"} />
      {pill.text}
    </span>
  );
}

function SourceRow({
  source,
  current,
  onPick,
}: {
  source: Source;
  current: boolean;
  onPick: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        className="ar-src"
        data-testid={`resource-source-${source.id}`}
        aria-current={current ? "true" : undefined}
        onClick={() => onPick(source.id)}
      >
        <LetterMark mark={source.mark} tone={source.tone} small />
        <span className="ar-text">
          <span className="ar-name">{source.name}</span>
          <span className="ar-meta">
            {[source.account, source.place].filter(Boolean).join(" · ")}
          </span>
        </span>
        <Pill pill={source.pill} />
      </button>
    </li>
  );
}

function OfferRow({ offer, kind }: { offer: Offer; kind: Kind }) {
  const t = useText(agentResourcesText);
  return (
    <li className="ar-offer" data-testid={`resource-offer-${offer.id}`}>
      <LetterMark mark={offer.mark} tone={offer.tone} small />
      <span className="ar-text">
        <span className="ar-name">{offer.name}</span>
        <span className="ar-meta">{offer.what[kind]}</span>
      </span>
      <LinkRow href={offer.href} kind="inline" className="ar-connect">
        {offer.add ? t.add : t.connect}
      </LinkRow>
    </li>
  );
}

/** Round 1's B: kinds of thing, with every account's sources under each. */
export function ResourceList({
  resources,
  selected,
  onPick,
  machinesFailed,
  filesFailed,
  onRetry,
}: {
  resources: Resources;
  selected?: string;
  onPick: (id: string) => void;
  machinesFailed?: boolean;
  /** The synced folders could not be read: the files are unknown, not none. */
  filesFailed?: boolean;
  onRetry?: () => void;
}) {
  const t = useText(agentResourcesText);
  return (
    <div className="ar-list" data-testid="resource-list">
      {kinds.map((k) => {
        const sources = resources.sources.filter((s) => s.kind === k.id);
        const offers = resources.offers.filter((o) => o.kinds.includes(k.id));
        if (!sources.length && !offers.length) return null;
        return (
          <section
            key={k.id}
            className="ar-kind"
            data-testid={`resource-kind-${k.id}`}
          >
            <h2 className="ar-h3 ar-kind-head">
              <Icon name={k.icon} />
              {t.kinds[k.id]}
            </h2>
            {k.id === "files" && filesFailed ? (
              <div className="ar-pad ar-files-failed" role="alert">
                <p className="ar-meta">{t.filesFailed}</p>
                {onRetry ? (
                  <ControlButton
                    size="row"
                    variant="secondary"
                    onPress={onRetry}
                    data-testid="resource-files-reload"
                  >
                    {t.retry}
                  </ControlButton>
                ) : null}
              </div>
            ) : null}
            {k.id === "machines" && machinesFailed ? (
              <p className="ar-meta ar-pad" role="status">
                {t.machinesFailed}
              </p>
            ) : null}
            <ul>
              {sources.map((s) => (
                <SourceRow
                  key={s.id}
                  source={s}
                  current={s.id === selected}
                  onPick={onPick}
                />
              ))}
              {offers.map((o) => (
                <OfferRow key={o.id} offer={o} kind={k.id} />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function Head({ source }: { source: Source }) {
  return (
    <header className="ar-head" data-testid="resource-head">
      <div className="ar-head-title">
        <LetterMark mark={source.mark} tone={source.tone} />
        <div className="ar-text">
          <h2>{source.name}</h2>
          <span className="ar-meta">
            {[source.account, source.who, source.place]
              .filter(Boolean)
              .join(" · ")}
          </span>
        </div>
        <Pill pill={source.pill} />
      </div>
      <div className="ar-actions">
        <LinkRow
          href={source.settings.href}
          kind="nav"
          className="ar-settings"
          data-testid="resource-settings"
        >
          <Icon name="gear" />
          {source.settings.label}
        </LinkRow>
        {source.web ? (
          <ExternalLink
            className="ar-ext"
            href={source.web.href}
            target="_blank"
            rel="noreferrer"
            data-testid="resource-web"
          >
            <Icon name="external" />
            {source.web.label}
          </ExternalLink>
        ) : null}
      </div>
    </header>
  );
}

function VerbList({ verbs }: { verbs: Verb[] }) {
  const t = useText(agentResourcesText);
  return (
    <ul className="ar-verbs" data-testid="resource-verbs">
      {verbs.map((v) => (
        <li key={v.label} data-yes={v.yes ? "true" : "false"}>
          <Icon name={v.yes ? "check" : "cross"} aria-hidden="true" />
          <span>
            <span className="ar-sr">{v.yes ? t.saa : t.eiSaa}: </span>
            <strong>{v.label}</strong>
            {v.note ? <span className="ar-meta"> · {v.note}</span> : null}
          </span>
          {v.cannotBlock ? (
            <span className="ar-warn">
              <Icon name="warning" />
              {t.cannotBlock}
            </span>
          ) : null}
        </li>
      ))}
    </ul>
  );
}

/** Something the agent does not see, greyed in its place. */
function HiddenRow({ hidden, icon }: { hidden: Hidden; icon: Kind }) {
  const t = useText(agentResourcesText);
  const glyph = kinds.find((k) => k.id === icon)?.icon ?? "folder";
  return (
    <li className="ar-grey" data-testid={`resource-hidden-${hidden.id}`}>
      <Icon name={glyph} className="ar-row-icon" />
      <span className="ar-text">
        <span className="ar-name">{hidden.what}</span>
        <span className="ar-meta">{hidden.why}</span>
      </span>
      {hidden.action ? (
        <LinkRow href={hidden.action.href} kind="inline" className="ar-connect">
          {hidden.action.label}
        </LinkRow>
      ) : (
        <span className="ar-chip-none">
          <Icon name="eyeOff" />
          {t.notSeen}
        </span>
      )}
    </li>
  );
}

/** Round 3's C: what is in, what is out and what the agent may do. */
function Scope({ source, files }: { source: Source; files?: ReactNode }) {
  const t = useText(agentResourcesText);
  return (
    <div className="ar-content" data-testid="resource-scope">
      {source.facts ? (
        <dl className="ar-facts" data-testid="resource-facts">
          {source.facts.map((f) => (
            <Fragment key={f.label}>
              <dt>{f.label}</dt>
              <dd>{f.mono ? <code>{f.value}</code> : f.value}</dd>
            </Fragment>
          ))}
        </dl>
      ) : null}
      {source.scope.length ? (
        <section data-testid="resource-in" aria-label={t.in}>
          <h3 className="ar-h3">
            <Icon name="check" />
            {t.in}
          </h3>
          <ul className="ar-rows">
            {source.scope.map((x) => (
              <li key={x.what} className="ar-row">
                <Icon name={x.icon} className="ar-row-icon" />
                <span className="ar-text">
                  <span className={`ar-name${x.mono ? " ar-mono" : ""}`}>
                    {x.what}
                  </span>
                  {x.meta ? <span className="ar-meta">{x.meta}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {files}
      {source.kind !== "machines" || source.hidden.length ? (
        <section data-testid="resource-out" aria-label={t.out}>
          <h3 className="ar-h3">
            <Icon name="eyeOff" />
            {t.out}
          </h3>
          {source.hidden.length ? (
            <ul className="ar-rows">
              {source.hidden.map((h) => (
                <HiddenRow key={h.id} hidden={h} icon={source.kind} />
              ))}
            </ul>
          ) : (
            <p className="ar-meta ar-pad">{t.noLimits}</p>
          )}
        </section>
      ) : null}
      <section aria-label={t.allowed}>
        <h3 className="ar-h3">
          <Icon name="agent" />
          {t.allowed}
        </h3>
        <VerbList verbs={source.verbs} />
      </section>
      {source.kind === "machines" ? (
        <p className="ar-meta">{t.machine.browse}</p>
      ) : source.elsewhere ? (
        <p className="ar-meta" data-testid="resource-elsewhere">
          {source.elsewhere.link
            ? t.elsewhere(
                source.elsewhere.what,
                <ExternalLink
                  href={source.elsewhere.link.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {source.elsewhere.link.label}
                </ExternalLink>,
              )
            : t.elsewhereService(source.elsewhere.what)}
        </p>
      ) : null}
    </div>
  );
}

/** One source: its head, then what it includes and allows. */
export function ResourceDetail({
  source,
  files,
  onBack,
}: {
  source: Source;
  /** The browsable folder of a synced files source. */
  files?: ReactNode;
  onBack?: () => void;
}) {
  const t = useText(agentResourcesText);
  return (
    <article
      className="ar-detail"
      data-testid="resource-detail"
      data-source={source.id}
      data-can={source.can}
    >
      {onBack ? (
        <ControlButton
          data-testid="resource-back"
          size="row"
          variant="quiet"
          onPress={onBack}
        >
          <Icon name="back" />
          {t.back}
        </ControlButton>
      ) : null}
      <Head source={source} />
      <Scope source={source} files={files} />
    </article>
  );
}

export type FolderState =
  | { state: "loading" }
  | { state: "failed" | "missing" }
  | { state: "unavailable"; why: string }
  | {
      state: "ready";
      entries: FolderEntry[];
      truncated: boolean;
      unlisted?: number;
    };

/** A synced folder as the person and the agent see it: folders first, each
 * opened in place; names, sizes and times only, never content. */
export function FolderBrowser({
  root,
  path,
  folder,
  onGo,
  onRetry,
}: {
  /** The source's name, the first crumb. */
  root: string;
  path: string[];
  folder: FolderState;
  onGo: (path: string[]) => void;
  onRetry?: () => void;
}) {
  const t = useText(agentResourcesText);
  const parts = [root, ...path];
  const ready = folder.state === "ready" ? folder : undefined;
  return (
    <section
      className="ar-files"
      data-testid="resource-files"
      data-state={folder.state}
      aria-label={t.files.heading}
    >
      <h3 className="ar-h3">
        <Icon name="folder" />
        {t.files.heading}
      </h3>
      {folder.state === "unavailable" ? (
        <p className="ar-meta ar-pad" data-testid="resource-files-unavailable">
          {folder.why}
        </p>
      ) : (
        <>
          <nav
            className="ar-crumbs"
            aria-label={t.files.crumbs}
            data-testid="resource-crumbs"
          >
            {parts.map((p, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: a crumb is its depth
              <Fragment key={i}>
                {i ? <span aria-hidden="true">›</span> : null}
                {i === parts.length - 1 ? (
                  <span aria-current="page">{p}</span>
                ) : (
                  <button
                    type="button"
                    className="ar-link"
                    onClick={() => onGo(path.slice(0, i))}
                  >
                    {p}
                  </button>
                )}
              </Fragment>
            ))}
          </nav>
          {folder.state === "loading" ? (
            <p className="ar-meta ar-pad" role="status">
              {t.files.loading}
            </p>
          ) : folder.state === "failed" || folder.state === "missing" ? (
            <div className="ar-pad" role="alert">
              <p className="ar-meta">
                {folder.state === "missing" ? t.files.missing : t.files.failed}
              </p>
              {onRetry ? (
                <ControlButton
                  size="row"
                  variant="secondary"
                  onPress={onRetry}
                  data-testid="resource-files-retry"
                >
                  {t.retry}
                </ControlButton>
              ) : null}
            </div>
          ) : ready?.entries.length ? (
            <ul className="ar-rows" data-testid="resource-entries">
              {ready.entries.map((e) => {
                const when = t.files.modified(syncedTime(e.modified_at));
                return e.kind === "folder" ? (
                  <li key={`d:${e.name}`}>
                    <button
                      type="button"
                      className="ar-row ar-row-open"
                      data-testid="resource-entry"
                      data-kind="folder"
                      aria-label={t.files.open(e.name)}
                      onClick={() => onGo([...path, e.name])}
                    >
                      <Icon name="folder" className="ar-row-icon" />
                      <span className="ar-text">
                        <span className="ar-name">{e.name}</span>
                        <span className="ar-meta">{when}</span>
                      </span>
                      <Icon name="forward" className="ar-row-icon" />
                    </button>
                  </li>
                ) : (
                  <li
                    key={`f:${e.name}`}
                    className="ar-row"
                    data-testid="resource-entry"
                    data-kind="file"
                  >
                    <Icon name="file" className="ar-row-icon" />
                    <span className="ar-text">
                      <span className="ar-name">{e.name}</span>
                      <span className="ar-meta">
                        {[when, e.bytes ? fileSize(e.bytes) : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="ar-meta ar-pad">{t.files.empty}</p>
          )}
          {ready?.truncated ? (
            <p className="ar-meta ar-pad">
              {t.files.truncated(ready.entries.length)}
            </p>
          ) : null}
          {ready?.unlisted ? (
            <p className="ar-meta ar-pad">{t.files.unlisted(ready.unlisted)}</p>
          ) : null}
          {ready ? <p className="ar-meta ar-pad">{t.files.note}</p> : null}
        </>
      )}
    </section>
  );
}

/** The page's frame: title, summary and the way to connect more, then the
 * list beside the chosen source (or, on a phone, one of them). */
export function AgentResourcesFrame({
  summary,
  connectHref,
  narrow,
  list,
  detail,
  notice,
}: {
  summary?: string;
  connectHref: string;
  narrow: boolean;
  list?: ReactNode;
  detail?: ReactNode;
  notice?: ReactNode;
}) {
  const t = useText(agentResourcesText);
  return (
    <div className="ar-page" data-testid="agent-resources">
      {narrow && detail ? null : (
        <header className="ar-page-head">
          <div className="ar-text">
            <h1>{t.title}</h1>
            {summary ? (
              <span className="ar-meta" data-testid="resource-summary">
                {summary}
              </span>
            ) : null}
          </div>
          <LinkRow
            href={connectHref}
            kind="nav"
            className="ar-connect-more"
            data-testid="resource-connect-more"
          >
            <Icon name="plus" />
            {t.connectMore}
          </LinkRow>
        </header>
      )}
      {notice}
      {narrow ? (
        (detail ?? list)
      ) : list ? (
        <div className="ar-cols">
          {list}
          {detail ?? <p className="ar-meta">{t.choose}</p>}
        </div>
      ) : null}
    </div>
  );
}

export function AgentResourcesFailed({ onRetry }: { onRetry: () => void }) {
  const t = useText(agentResourcesText);
  return (
    <InlineNotice
      data-testid="resource-failed"
      title={t.readFailed}
      description={t.readFailedDetail}
      tone="warning"
      actions={[{ label: t.retry, onPress: onRetry }]}
    />
  );
}
