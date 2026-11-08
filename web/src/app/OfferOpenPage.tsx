import { useEffect, useState } from "react";
import {
  fileFacts,
  offerDownload,
  offerFacts,
  offerKind,
  singleItem,
} from "../components/FileOffer";
import { Icon } from "../components/Icon";
import { OfferActions, OfferMark } from "../components/OfferCard";
import { OfferedFileView, OfferFolder } from "../components/OfferPanel";
import { Button } from "../components/Primitives";
import { useText } from "../i18n";
import { offerPanelText } from "../text/offerPanel";
import { fileOfferIdPattern, offerTabPath, useFileOffer } from "./fileOffers";
import { accountSession } from "./pi";

const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/** A file offer, or one file of a folder offer, in a tab of its own
 * (`/offer?id=…&path=…`): the same content the panel beside the conversation
 * shows, read with the person's own session from the offer's routes. It is
 * an app page and opens no access the panel does not have; another person's
 * offer, a removed and an unknown one read alike. */
export function OfferOpenPage() {
  const t = useText(offerPanelText);
  const params = new URLSearchParams(window.location.search);
  const offerId = params.get("id") ?? "";
  const valid = fileOfferIdPattern.test(offerId);
  const [session, setSession] = useState<
    "checking" | "login" | "ready" | "failed"
  >(valid ? "checking" : "failed");
  const [path, setPath] = useState(params.get("path") ?? undefined);
  useEffect(() => {
    if (!valid) return;
    let alive = true;
    void accountSession().then(
      (s) => {
        if (alive) setSession(s === "login" ? "login" : "ready");
      },
      () => {
        if (alive) setSession("failed");
      },
    );
    return () => {
      alive = false;
    };
  }, [valid]);
  useEffect(() => {
    const back = () =>
      setPath(
        new URLSearchParams(window.location.search).get("path") ?? undefined,
      );
    window.addEventListener("popstate", back);
    return () => window.removeEventListener("popstate", back);
  }, []);
  if (session === "login")
    return (
      <main className="ah-state" data-testid="offer-open-page">
        <p>{t.signIn}</p>
        <Button
          data-testid="offer-sign-in"
          size="page"
          label={t.signInAction}
          onPress={() => {
            window.location.href = `/auth/github/start?return_to=${encodeURIComponent(window.location.pathname + window.location.search)}`;
          }}
        />
      </main>
    );
  if (session !== "ready")
    return (
      <main className="ah-state" data-testid="offer-open-page">
        <p role="status">{session === "checking" ? t.opening : t.failed}</p>
      </main>
    );
  return (
    <OfferTab
      offerId={offerId}
      path={path}
      onPath={(next) => {
        window.history.pushState(null, "", offerTabPath(offerId, next));
        setPath(next);
      }}
    />
  );
}

function OfferTab({
  offerId,
  path,
  onPath,
}: {
  offerId: string;
  path?: string;
  onPath: (path?: string) => void;
}) {
  const t = useText(offerPanelText);
  const state = useFileOffer(offerId);
  const manifest = state.state === "ready" ? state.manifest : undefined;
  useEffect(() => {
    if (!manifest) return;
    document.title = path ? baseName(path) : manifest.offer.title;
  }, [manifest, path]);
  if (!manifest)
    return (
      <main className="ah-state" data-testid="offer-open-page">
        <p role="status">{state.state === "loading" ? t.opening : t.failed}</p>
      </main>
    );
  const offer = manifest.offer;
  const one = singleItem(manifest);
  const item = path ? manifest.items.find((i) => i.path === path) : one;
  const inFolder = !!path && !one;
  const title = inFolder && item ? baseName(item.path) : offer.title;
  return (
    <main
      className="ah-offer-tab"
      data-testid="offer-open-page"
      data-offer-id={offerId}
    >
      {inFolder ? (
        <button
          type="button"
          className="ah-offer-pane-back"
          data-testid="offer-panel-back"
          aria-label={t.back(offer.folder ? `${offer.folder}/` : offer.title)}
          onClick={() => onPath(undefined)}
        >
          <Icon name="back" /> {offer.folder ? `${offer.folder}/` : offer.title}
        </button>
      ) : null}
      <header className="ah-editor-header ah-offer-pane-head">
        <OfferMark kind={item ? item.kind : offerKind(offer, state)} size="s" />
        <span className="ah-offer-pane-title">
          <h1 className="ah-view-title">{title}</h1>
          <span className="ah-offer-facts">
            {(item ? fileFacts(item) : offerFacts(offer, state)).join(" · ")}
          </span>
        </span>
        <span className="ah-editor-controls">
          <OfferActions label={title} download={offerDownload(offer, item)} />
        </span>
      </header>
      <div className="ah-offer-pane-body">
        {item ? (
          <OfferedFileView offerId={offerId} item={item} />
        ) : (
          <OfferFolder offer={offer} items={manifest.items} onOpen={onPath} />
        )}
      </div>
    </main>
  );
}
