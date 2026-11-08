import RFB from "@novnc/novnc";
import { useEffect, useRef, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { useText } from "../i18n";
import { serverBrowserText } from "../text/serverBrowser";
import { browserViewURL } from "./serverBrowser";

/** The live view of the person's server browser: noVNC on a WebSocket to
 * the person's daemon through the gateway. The first message proves the
 * session's CSRF token, as for the browser shell; after that the socket is
 * RFB. Looking is noVNC's view-only mode, which sends no input at all, so a
 * look never moves the agent's pointer or types into its page. */
export default function BrowserViewer({
  csrf,
  viewOnly,
}: {
  csrf: string;
  viewOnly: boolean;
}) {
  const txt = useText(serverBrowserText);
  const target = useRef<HTMLDivElement>(null);
  const rfb = useRef<RFB | undefined>(undefined);
  const [phase, setPhase] = useState<"connecting" | "connected" | "lost">(
    "connecting",
  );
  const [attempt, setAttempt] = useState(0);
  const view = useRef(viewOnly);
  view.current = viewOnly;

  // biome-ignore lint/correctness/useExhaustiveDependencies: a retry is a new connection
  useEffect(() => {
    const element = target.current;
    if (!element) return;
    setPhase("connecting");
    let gone = false;
    const socket = new WebSocket(browserViewURL());
    socket.binaryType = "arraybuffer";
    const lost = () => {
      if (!gone) setPhase("lost");
    };
    socket.onclose = lost;
    socket.onopen = () => {
      if (gone) return;
      socket.send(JSON.stringify({ type: "auth", csrf }));
      const client = new RFB(element, socket, { shared: true });
      client.viewOnly = view.current;
      client.scaleViewport = true;
      client.resizeSession = false;
      client.focusOnClick = true;
      client.background = "transparent";
      client.addEventListener("connect", () => {
        if (!gone) setPhase("connected");
      });
      client.addEventListener("disconnect", lost);
      rfb.current = client;
    };
    return () => {
      gone = true;
      const client = rfb.current;
      rfb.current = undefined;
      if (client) client.disconnect();
      else socket.close(1000);
    };
  }, [csrf, attempt]);

  useEffect(() => {
    if (rfb.current) {
      rfb.current.viewOnly = viewOnly;
      if (!viewOnly) rfb.current.focus();
    }
  }, [viewOnly]);

  return (
    <>
      <div
        ref={target}
        className="sb-viewer"
        data-testid="browser-viewer"
        data-phase={phase}
        data-view-only={viewOnly || undefined}
      />
      {phase === "connecting" ? (
        <p className="sb-viewer-note">{txt.sheet.connecting}</p>
      ) : null}
      {phase === "lost" ? (
        <div className="sb-viewer-note" role="alert">
          <p>{txt.sheet.lost}</p>
          <ControlButton
            size="row"
            data-testid="browser-viewer-retry"
            onPress={() => setAttempt((n) => n + 1)}
          >
            {txt.sheet.retry}
          </ControlButton>
        </div>
      ) : null}
    </>
  );
}
