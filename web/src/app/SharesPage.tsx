import { useEffect, useMemo, useRef, useState } from "react";
import {
  Dialog as AriaDialog,
  Heading,
  Modal,
  ModalOverlay,
} from "react-aria-components";
import { useSearchParams } from "react-router";
import {
  ControlButton,
  LinkRow,
  Segmented,
} from "../components/ControlElements";
import { OfferThumb, offerFacts, offerKind } from "../components/FileOffer";
import { Icon } from "../components/Icon";
import { OfferActions, OfferMark } from "../components/OfferCard";
import { OfferedFileView, OfferFolder } from "../components/OfferPanel";
import { CopyButton } from "../components/ViewLink";
import { type ViewSummary, viewFacts } from "../components/ViewOffer";
import { ViewFrame } from "../components/ViewPanel";
import { formatDate, formatNumber, useText } from "../i18n";
import { sharesText } from "../text/shares";
import { viewLinksText } from "../text/viewLinks";
import { agentTitle } from "./agentTitle";
import {
  type FileOfferSummary,
  offerTabPath,
  useFileOffer,
  useFileOffers,
} from "./fileOffers";
import { groupShares, type Share, shareCategory } from "./shares";
import type { Snapshot } from "./snapshot";
import {
  addressItem,
  defaultExpiry,
  deleteViewAddressForGood,
  formatExpiry,
  isPublic,
  refreshViewLinks,
  setViewDuration,
  setViewPublic,
  stopViewSharing,
  useViewAddressMark,
  useViewLinks,
  useViewLinksUnknown,
} from "./viewLinks";
import { conversationViews, mintViewURL, viewTabPath } from "./views";
import "../components/Shares.css";

const date = (value: string) =>
  formatDate(new Date(value), {
    weekday: "short",
    day: "numeric",
    month: "numeric",
  });
const fullDate = (value: string) =>
  formatDate(new Date(value), { dateStyle: "short", timeStyle: "short" });
const conversationHref = (s: Share) =>
  `/workspaces/${s.conversation?.worktree_id ?? s.conversation?.workspace_id}?conversation=${encodeURIComponent(s.conversation?.agent_id ?? "")}`;

export function SharesRail({
  current,
  collapsed,
}: {
  current: boolean;
  collapsed: boolean;
}) {
  const t = useText(sharesText);
  const links = useViewLinks();
  const unknown = useViewLinksUnknown();
  const count =
    links && typeof links === "object" && links.maxDays > 0 && !unknown
      ? links.addresses.filter(isPublic).length
      : 0;
  return (
    <div className="ah-rail-home-row">
      <LinkRow
        href="/shares"
        data-testid="rail-shares"
        kind="home"
        current={current}
        className="ah-rail-home"
        aria-label={collapsed ? t.title : undefined}
      >
        <Icon name="globe" />
        <span className="ah-rail-home-label">
          {t.title}
          {count ? ` ${formatNumber(count)}` : ""}
        </span>
      </LinkRow>
    </div>
  );
}

export function SharesPage({
  snapshot,
  csrf,
}: {
  snapshot: Pick<Snapshot, "agents" | "workspaces">;
  csrf?: string;
}) {
  const t = useText(sharesText);
  const links = useViewLinks();
  const [params, setParams] = useSearchParams();
  const [narrow, setNarrow] = useState(
    () => window.matchMedia("(max-width: 760px)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(max-width: 760px)");
    const change = () => setNarrow(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  const [loadedViews, setViews] = useState<{
    key: string;
    views: ViewSummary[];
  }>();
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  const addresses =
    links && typeof links === "object" ? links.addresses : undefined;
  const ids = useMemo(
    () => addresses?.flatMap((a) => (a.offer_id ? [a.offer_id] : [])) ?? [],
    [addresses],
  );
  const offers = useFileOffers(ids, retry);
  const viewKey = addresses
    ?.flatMap((a) => (a.view_id ? [a.view_id] : []))
    .sort()
    .join(",");
  const views = loadedViews?.views;
  useEffect(() => {
    void retry;
    const abort = new AbortController();
    void refreshViewLinks(abort.signal).catch(() => {});
    return () => abort.abort();
  }, [retry]);
  useEffect(() => {
    void retry;
    if (viewKey === undefined) return;
    const abort = new AbortController();
    setFailed(false);
    void (
      viewKey ? conversationViews(undefined, abort.signal) : Promise.resolve([])
    )
      .then((values) => {
        if (!abort.signal.aborted)
          setViews({ key: viewKey, views: values ?? [] });
      })
      .catch(() => {
        if (!abort.signal.aborted) setFailed(true);
      });
    return () => abort.abort();
  }, [viewKey, retry]);
  const items: (ViewSummary | FileOfferSummary)[] = [
    ...(views ?? []),
    ...offers.flatMap((o) => (o.state === "ready" ? [o.manifest.offer] : [])),
  ];
  // A newly observed address is not proof its target is gone. Keep known
  // rows mounted while reading the facts of additions in the background.
  const knownViews = new Set(loadedViews?.key.split(",") ?? []);
  const shownAddresses = addresses?.filter((a) => {
    if (a.view_id) return knownViews.has(a.view_id);
    const state = offers[ids.indexOf(a.offer_id ?? "")]?.state;
    return state === "ready" || state === "removed";
  });
  const groups = shownAddresses
    ? groupShares(shownAddresses, items, snapshot)
    : [];
  const rows = groups.flatMap((g) => g.rows);
  const counts = { all: rows.length, public: 0, private: 0, past: 0 };
  for (const row of rows) counts[shareCategory(row)]++;
  const rawFilter = params.get("filter");
  const filter =
    rawFilter === "public" || rawFilter === "private" || rawFilter === "past"
      ? rawFilter
      : "all";
  const filtered = groups
    .map((g) => ({
      ...g,
      rows: g.rows.filter(
        (s) => filter === "all" || shareCategory(s) === filter,
      ),
    }))
    .filter((g) => g.rows.length);
  const selected = params.get("share")
    ? filtered
        .flatMap((g) => g.rows)
        .find((s) => s.address.address_id === params.get("share"))
    : filtered[0]?.rows[0];
  const explicit =
    !!params.get("share") &&
    selected?.address.address_id === params.get("share");
  const loading = !failed && (links === undefined || (addresses && !views));
  const unavailable =
    failed ||
    links === "unavailable" ||
    offers.some((o) => o.state === "unavailable");
  return (
    <section className="sh-page" data-testid="shares-page">
      {loading ? (
        <p role="status">{t.loading}</p>
      ) : unavailable && !views ? (
        <div role="alert">
          <p>{t.failed}</p>
          <ControlButton size="row" onPress={() => setRetry((n) => n + 1)}>
            {t.retry}
          </ControlButton>
        </div>
      ) : (
        <div className="sh-layout" data-detail={explicit || undefined}>
          <div className="sh-list">
            <header>
              <h1>{t.title}</h1>
              <p>{t.summary(counts.public, counts.private, counts.past)}</p>
            </header>
            {unavailable ? (
              <div role="alert">
                <p>{t.failed}</p>
                <ControlButton
                  size="row"
                  onPress={() => setRetry((n) => n + 1)}
                >
                  {t.retry}
                </ControlButton>
              </div>
            ) : shownAddresses?.length !== addresses?.length ? (
              <p role="status">{t.loading}</p>
            ) : null}
            {rows.length > 0 && (
              <Segmented
                size="row"
                data-testid="shares-filter"
                label={t.title}
                value={filter}
                options={(
                  Object.keys(t.filters) as (keyof typeof t.filters)[]
                ).map((id) => ({
                  id,
                  label: narrow
                    ? t.filters[id]
                    : `${t.filters[id]} ${formatNumber(counts[id])}`,
                }))}
                onChange={(value) =>
                  setParams(value === "all" ? {} : { filter: value })
                }
              />
            )}
            {addresses?.length === 0 || links === "off" ? (
              <div className="sh-empty">
                <Icon name="globe" />
                <h2>{t.empty}</h2>
                <p>{t.emptyHelp}</p>
              </div>
            ) : (
              <ol className="sh-timeline">
                {filtered.map((g) => {
                  const first = g.rows[0];
                  const workspace = snapshot.workspaces.find(
                    (w) => w.workspace_id === g.conversation?.workspace_id,
                  );
                  return (
                    <li
                      key={g.id}
                      data-testid="shares-conversation"
                      data-conversation-id={g.id}
                      className="sh-group"
                    >
                      <span
                        className="sh-dot"
                        data-public={
                          g.rows.some((s) => shareCategory(s) === "public") ||
                          undefined
                        }
                      />
                      <header
                        className="sh-group-head"
                        data-testid="shares-conversation-heading"
                      >
                        <h2>
                          {g.conversation ? (
                            <LinkRow
                              href={conversationHref(first)}
                              kind="inline"
                            >
                              {agentTitle(g.conversation.title)}
                            </LinkRow>
                          ) : g.id === "removed" ? (
                            t.gone
                          ) : (
                            t.unknown
                          )}
                        </h2>
                        <time dateTime={g.changed} title={fullDate(g.changed)}>
                          {date(g.changed)}
                        </time>
                        <div className="sh-meta">
                          {workspace?.display_name ?? workspace?.name}{" "}
                          {g.conversation?.archive === "archived"
                            ? t.archived
                            : ""}{" "}
                          · {t.count(g.rows.length)}
                        </div>
                      </header>
                      <ul className="sh-rows">
                        {g.rows.map((s) => (
                          <li key={s.address.address_id}>
                            <button
                              type="button"
                              data-testid="shares-row"
                              data-address-id={s.address.address_id}
                              className="sh-row"
                              aria-current={selected === s ? "true" : undefined}
                              onClick={() =>
                                setParams({
                                  ...(filter !== "all" ? { filter } : {}),
                                  share: s.address.address_id,
                                })
                              }
                            >
                              <ShareThumb share={s} />
                              <span className="sh-row-text">
                                <strong
                                  className={!s.item ? "sh-gone" : undefined}
                                >
                                  {s.address.title}
                                </strong>
                                <span className="sh-meta">
                                  {t.shared(
                                    formatDate(new Date(s.address.created_at), {
                                      weekday: "short",
                                      day: "numeric",
                                      month: "numeric",
                                      hour: "numeric",
                                      minute: "numeric",
                                    }),
                                  )}{" "}
                                  · <ShareFacts share={s} short />
                                </span>
                                <ShareState share={s} />
                              </span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    </li>
                  );
                })}
              </ol>
            )}
            {rows.length > 0 && !filtered.length && <p>{t.noMatches}</p>}
          </div>
          {selected && (!narrow || explicit) && (
            <div className="sh-detail">
              <ShareDetail
                key={selected.address.address_id}
                share={selected}
                csrf={csrf}
                maxDays={links && typeof links === "object" ? links.maxDays : 0}
                onBack={() => setParams(filter === "all" ? {} : { filter })}
              />
            </div>
          )}
        </div>
      )}
    </section>
  );
}
function ShareFacts({
  share,
  short = false,
}: {
  share: Share;
  short?: boolean;
}) {
  const offer = useFileOffer(share.address.offer_id ?? "");
  if (!share.item) return null;
  return (
    <>
      {("view_id" in share.item
        ? viewFacts(share.item)
        : offerFacts(share.item, offer)
      )
        .slice(0, short ? 1 : undefined)
        .join(" · ")}
    </>
  );
}
function ShareThumb({ share }: { share: Share }) {
  const offer = useFileOffer(share.address.offer_id ?? "");
  const item = offer.state === "ready" ? offer.manifest.items[0] : undefined;
  return (
    <span className="sh-thumb">
      {!share.item ? (
        <Icon name="slash" />
      ) : "view_id" in share.item ? (
        <OfferMark kind="view" size="s" />
      ) : item ? (
        <OfferThumb offerId={share.item.offer_id} item={item} />
      ) : (
        <OfferMark kind={offerKind(share.item, offer)} size="s" />
      )}
    </span>
  );
}
function ShareState({ share }: { share: Share }) {
  const t = useText(sharesText);
  const l = useText(viewLinksText);
  const unknown = useViewLinksUnknown();
  const category = shareCategory(share);
  const links = useViewLinks();
  const sharing = !!links && typeof links === "object" && links.maxDays > 0;
  return (
    <span className="sh-state" data-testid="shares-state" data-state={category}>
      <Icon
        name={
          !share.item
            ? "slash"
            : category === "public"
              ? "globe"
              : category === "past"
                ? "clock"
                : "lock"
        }
      />
      {unknown
        ? l.checking
        : !share.item
          ? t.gone
          : category === "public"
            ? (sharing ? l.publicUntil : l.paused)(
                formatExpiry(share.address.public_until ?? ""),
              )
            : category === "past"
              ? t.ended(formatExpiry(share.address.public_until ?? ""))
              : l.isPrivate}
    </span>
  );
}
function ShareDetail({
  share,
  csrf,
  maxDays,
  onBack,
}: {
  share: Share;
  csrf?: string;
  maxDays: number;
  onBack: () => void;
}) {
  const t = useText(sharesText);
  const l = useText(viewLinksText);
  const id = addressItem(share.address);
  const mark = useViewAddressMark(id);
  const unknown = useViewLinksUnknown();
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  const present = useRef(true);
  useEffect(() => {
    present.current = true;
    return () => {
      present.current = false;
    };
  }, []);
  const pub = isPublic(share.address);
  const act = (write: Promise<void>) => {
    setError("");
    void write.catch((error: Error) =>
      setError(error.message || l.addressesUnknown),
    );
  };
  return (
    <div className="sh-pane">
      <ControlButton
        size="row"
        className="sh-back"
        data-testid="shares-back"
        onPress={onBack}
      >
        <Icon name="back" />
        {t.title}
      </ControlButton>
      {share.conversation && (
        <div className="sh-meta">
          {t.from}{" "}
          <LinkRow kind="inline" href={conversationHref(share)}>
            {agentTitle(share.conversation.title)}
          </LinkRow>
        </div>
      )}
      <header>
        <h2>{share.address.title}</h2>
        <div className="sh-meta">
          <ShareFacts share={share} /> ·{" "}
          {t.shared(fullDate(share.address.created_at))}
        </div>
      </header>
      <div className="sh-publication">
        <ShareState share={share} />
        {pub && maxDays > 0 && !unknown && share.item && (
          <div className="sh-url" data-testid="shares-address">
            <input aria-label={t.address} readOnly value={share.address.url} />
            <CopyButton
              iconOnly
              text={share.address.url}
              data-testid="shares-copy"
            />
          </div>
        )}
        <div className="sh-actions">
          <OfferActions
            label={share.address.title}
            publish={
              share.item && maxDays > 0
                ? {
                    public: pub,
                    until: pub ? share.address.public_until : undefined,
                    maxDays,
                    pending: mark === "busy" || !csrf,
                    unknown: unknown || mark === "uncertain",
                    onPublic: (on) => {
                      if (csrf)
                        act(
                          setViewPublic(csrf, id, on, defaultExpiry(maxDays)),
                        );
                    },
                    onDuration: (days) => {
                      if (csrf) act(setViewDuration(csrf, id, days));
                    },
                  }
                : undefined
            }
            onTab={
              share.item
                ? () =>
                    window.open(
                      share.address.view_id
                        ? viewTabPath(id)
                        : offerTabPath(id),
                      "_blank",
                      "noopener,noreferrer",
                    )
                : undefined
            }
          >
            {pub && maxDays === 0 && (
              <ControlButton
                className="ah-offer-ib"
                size="row"
                variant="quiet"
                data-testid="view-address-private"
                aria-label={l.stop}
                isDisabled={!csrf || mark === "busy"}
                onPress={() => {
                  if (csrf) act(stopViewSharing(csrf, share.address));
                }}
              >
                <Icon name="lock" />
              </ControlButton>
            )}
            <ControlButton
              className="ah-offer-ib"
              data-testid="shares-remove"
              aria-label={l.remove}
              title={l.remove}
              variant="quiet"
              size="row"
              isDisabled={!csrf || mark === "busy"}
              onPress={() => setRemoving(true)}
            >
              <Icon name="trash" />
            </ControlButton>
          </OfferActions>
        </div>
        {pub && maxDays > 0 && <p className="sh-hint">{t.hint}</p>}
      </div>
      {error && <p role="alert">{error}</p>}
      {share.item && <SharePreview share={share} csrf={csrf} />}
      <ModalOverlay
        isOpen={removing}
        onOpenChange={setRemoving}
        className="ah-overlay"
        isDismissable
      >
        <Modal className="ah-modal">
          <AriaDialog
            className="ah-dialog"
            role="alertdialog"
            data-testid="view-address-remove-dialog"
            aria-label={l.removeTitle}
          >
            <Heading slot="title">{l.removeTitle}</Heading>
            <p>{l.removeDesc(share.address.title)}</p>
            <div className="ah-dialog-actions">
              <ControlButton
                size="page"
                data-testid="cancel"
                slot="close"
                autoFocus
              >
                {l.cancel}
              </ControlButton>
              <ControlButton
                size="page"
                data-testid="view-address-remove-confirm"
                variant="danger"
                onPress={() => {
                  setRemoving(false);
                  if (csrf)
                    act(
                      deleteViewAddressForGood(csrf, share.address).then(() => {
                        if (present.current) onBack();
                      }),
                    );
                }}
              >
                {l.removeConfirm}
              </ControlButton>
            </div>
          </AriaDialog>
        </Modal>
      </ModalOverlay>
    </div>
  );
}
function SharePreview({ share, csrf }: { share: Share; csrf?: string }) {
  const t = useText(sharesText);
  const offer = useFileOffer(share.address.offer_id ?? "");
  const [src, setSrc] = useState<string>();
  const [failed, setFailed] = useState(false);
  const [path, setPath] = useState<string>();
  const id = share.address.view_id;
  useEffect(() => {
    if (!id || !csrf) return;
    let current = true;
    void mintViewURL(csrf, id)
      .then((url) => {
        if (current) setSrc(url);
      })
      .catch(() => {
        if (current) setFailed(true);
      });
    return () => {
      current = false;
    };
  }, [id, csrf]);
  if (id)
    return src ? (
      <ViewFrame src={src} title={share.address.title} />
    ) : (
      <p role="status">{failed ? t.failed : t.loading}</p>
    );
  if (offer.state !== "ready") return <p role="status">{t.loading}</p>;
  const { manifest } = offer;
  const item = path
    ? manifest.items.find((i) => i.path === path)
    : manifest.items.length === 1 && !manifest.offer.folder
      ? manifest.items[0]
      : undefined;
  return item ? (
    <>
      <ControlButton
        size="row"
        data-testid="offer-panel-back"
        onPress={() => setPath(undefined)}
        isDisabled={!path}
      >
        <Icon name="back" />
        {manifest.offer.title}
      </ControlButton>
      <OfferedFileView offerId={manifest.offer.offer_id} item={item} />
    </>
  ) : (
    <OfferFolder
      offer={manifest.offer}
      items={manifest.items}
      onOpen={setPath}
      onTab={(path) =>
        window.open(
          offerTabPath(manifest.offer.offer_id, path),
          "_blank",
          "noopener,noreferrer",
        )
      }
    />
  );
}
