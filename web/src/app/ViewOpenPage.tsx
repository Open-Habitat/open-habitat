import { useEffect, useState } from "react";
import { ViewFrame } from "../components/ViewPanel";
import { accountSession } from "./pi";
import { listViews, mintViewURL, viewIdPattern } from "./views";

/** The app page a view card opens in a tab of its own (`/view?id=…`). The card
 * opens it synchronously with noopener; here, on the app's origin, it mints
 * the view's one-time URL with the session's CSRF and shows the view in a
 * sandboxed frame filling the tab, exactly as the panel frames it. The page
 * stays the tab's top-level document (see ViewFrame), and a reload mints a
 * fresh URL. */
export function ViewOpenPage() {
  const [failed, setFailed] = useState(false);
  const [src, setSrc] = useState<string>();
  const [title, setTitle] = useState("");
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id") ?? "";
    if (!viewIdPattern.test(id)) {
      setFailed(true);
      return;
    }
    let live = true;
    // The title is only the tab's label: it never holds back the frame,
    // whose one-time URL expires a minute after minting.
    void listViews().then(
      (views) => {
        const title = views?.find((v) => v.view_id === id)?.title;
        if (!live || !title) return;
        document.title = title;
        setTitle(title);
      },
      () => {},
    );
    void accountSession()
      .then((session) => {
        if (session === "login") throw new Error("login required");
        return mintViewURL(session.csrf, id);
      })
      .then((url) => {
        if (live) setSrc(url);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);
  if (src && !failed)
    return (
      <main className="ah-view-frame ah-view-tab" data-testid="view-open-page">
        <ViewFrame src={src} title={title} />
      </main>
    );
  return (
    <main className="ah-state" data-testid="view-open-page">
      <p role="status">
        {failed
          ? "Näkymää ei voitu avata. Se on ehkä poistettu, tai olet kirjautunut ulos. Avaa se uudelleen Habitatista."
          : "Avataan näkymää…"}
      </p>
    </main>
  );
}
