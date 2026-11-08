import { useEffect, useState } from "react";
import { Button } from "../components/Primitives";
import { ViewFrame } from "../components/ViewPanel";
import { useText } from "../i18n";
import { viewOpenPageText } from "../text/viewOpenPage";
import { OfferAtAddress } from "./OfferOpenPage";
import { accountSession } from "./pi";
import { ensureViewAddress, openViewEntry } from "./viewLinks";
import { listViews, mintViewURL, viewIdPattern } from "./views";

const entryPattern = /^\/n\/([A-Za-z0-9_-]{43})$/;

/** Whether this tab is at a view's stable entry address (`/n/<entry>`). */
export function atViewEntry(): boolean {
  return window.location.pathname.startsWith("/n/");
}

type Shown =
  | { kind: "opening" }
  | { kind: "failed" }
  | { kind: "login" }
  | { kind: "unavailable" }
  | { kind: "view"; src: string }
  | { kind: "offer"; offerId: string };

/** Mints the view's one-time URL with the session's CSRF and names the tab
 * after the view. The title is only the tab's label: it never holds back the
 * frame, whose one-time URL expires a minute after minting. */
function frameView(
  csrf: string,
  viewId: string,
  live: () => boolean,
  show: (shown: Shown) => void,
  setTitle: (title: string) => void,
) {
  void listViews().then(
    (views) => {
      const title = views?.find((v) => v.view_id === viewId)?.title;
      if (!live() || !title) return;
      document.title = title;
      setTitle(title);
    },
    () => {},
  );
  void mintViewURL(csrf, viewId).then(
    (src) => {
      if (live()) show({ kind: "view", src });
    },
    () => {
      if (live()) show({ kind: "failed" });
    },
  );
}

/** A view in a tab of its own, on the app's origin. The card opens
 * `/view?id=…` synchronously with noopener; that page reserves the view's
 * one stable address and replaces itself with it (`/n/<entry>`). There, a
 * public address has already been redirected to its content host by the
 * gateway; for anything else this page asks, as the signed-in person,
 * whether the address is theirs, and shows the view in a sandboxed frame
 * filling the tab, exactly as the panel frames it. The page stays the tab's
 * top-level document (see ViewFrame), and a reload mints a fresh URL.
 * Another person's address, a deleted and an unknown one read alike, and
 * nothing is said about the view before sign-in. */
export function ViewOpenPage() {
  const t = useText(viewOpenPageText);
  const [shown, show] = useState<Shown>({ kind: "opening" });
  const [title, setTitle] = useState("");
  useEffect(() => {
    let alive = true;
    const live = () => alive;
    const entry = entryPattern.exec(window.location.pathname)?.[1];
    const viewId = new URLSearchParams(window.location.search).get("id") ?? "";
    if (atViewEntry() ? !entry : !viewIdPattern.test(viewId)) {
      show({ kind: atViewEntry() ? "unavailable" : "failed" });
      return;
    }
    void accountSession()
      .then(async (session) => {
        if (!live()) return;
        if (session === "login") {
          show({ kind: entry ? "login" : "failed" });
          return;
        }
        if (!entry) {
          // The stable address is the one opened. Without one (at the
          // reservation cap, or with the address store unavailable) the
          // view still opens here.
          const address = await ensureViewAddress(session.csrf, viewId).catch(
            () => undefined,
          );
          if (!live()) return;
          if (address) window.location.replace(address.url);
          else frameView(session.csrf, viewId, live, show, setTitle);
          return;
        }
        const address = await openViewEntry(session.csrf, entry);
        if (!live()) return;
        if (address === "not_found") show({ kind: "unavailable" });
        else if (address.offer_id)
          // A file offer's address shows the offer as its own tab does.
          show({ kind: "offer", offerId: address.offer_id });
        else if (address.view_id)
          frameView(session.csrf, address.view_id, live, show, setTitle);
        else show({ kind: "failed" });
      })
      .catch(() => {
        if (live()) show({ kind: "failed" });
      });
    return () => {
      alive = false;
    };
  }, []);
  if (shown.kind === "offer") return <OfferAtAddress offerId={shown.offerId} />;
  if (shown.kind === "view")
    return (
      <main className="ah-view-frame ah-view-tab" data-testid="view-open-page">
        <ViewFrame src={shown.src} title={title} />
      </main>
    );
  if (shown.kind === "login")
    return (
      <main className="ah-state" data-testid="view-open-page">
        <p>{t.signIn}</p>
        <Button
          data-testid="view-sign-in"
          size="page"
          label={t.signInAction}
          onPress={() => {
            // The gateway keeps the address with the pending sign-in; the
            // provider never sees it.
            window.location.href = `/auth/github/start?return_to=${encodeURIComponent(window.location.pathname)}`;
          }}
        />
      </main>
    );
  return (
    <main className="ah-state" data-testid="view-open-page">
      <p role="status">
        {shown.kind === "opening"
          ? t.opening
          : shown.kind === "unavailable"
            ? t.unavailable
            : t.failed}
      </p>
    </main>
  );
}
