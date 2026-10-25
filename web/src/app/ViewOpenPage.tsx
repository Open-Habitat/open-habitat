import { useEffect, useState } from "react";
import { accountSession } from "./pi";
import { mintViewURL, viewIdPattern } from "./views";

/** The app page a view card opens in a tab of its own (`/view?id=…`). The card
 * opens it synchronously with noopener; here, on the app's origin, it mints
 * the view's one-time URL with the session's CSRF and replaces itself, so the
 * view tab keeps no reference to the app and no app page in its history. */
export function ViewOpenPage() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("id") ?? "";
    if (!viewIdPattern.test(id)) {
      setFailed(true);
      return;
    }
    let live = true;
    void accountSession()
      .then((session) => {
        if (session === "login") throw new Error("login required");
        return mintViewURL(session.csrf, id);
      })
      .then((url) => {
        if (live) window.location.replace(url);
      })
      .catch(() => {
        if (live) setFailed(true);
      });
    return () => {
      live = false;
    };
  }, []);
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
