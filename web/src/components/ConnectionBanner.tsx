import type { Bootstrap } from "../app/bootstrap";
import {
  ConnectionBanner as ProductionConnectionBanner,
  type ConnectionState,
} from "./Status";

export function ConnectionBanner({
  state,
}: {
  state: "loading" | Bootstrap["state"];
}) {
  const mapped: Record<typeof state, ConnectionState> = {
    loading: "loading",
    authenticated: "online",
    authentication_required: "authentication-required",
    daemon_unavailable: "daemon-unavailable",
  };
  return <ProductionConnectionBanner state={mapped[state]} />;
}
