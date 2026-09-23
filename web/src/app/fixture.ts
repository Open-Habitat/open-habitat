import type { Bootstrap } from "./bootstrap";
const fixtures: Record<string, Bootstrap> = {
  ready: {
    schema_version: 1,
    state: "authenticated",
    server_label: "Alder-testifixture",
  },
  auth: {
    schema_version: 1,
    state: "authentication_required",
    server_label: "Alder-testifixture",
  },
  daemon: {
    schema_version: 1,
    state: "daemon_unavailable",
    server_label: "Alder-testifixture",
    problem: {
      code: "daemon_unavailable",
      message: "Deterministinen testi: daemon ei vastaa.",
    },
  },
  design: {
    schema_version: 1,
    state: "authenticated",
    server_label: "Alder-testifixture",
  },
  "design-unhappy": {
    schema_version: 1,
    state: "authenticated",
    server_label: "Alder-testifixture",
  },
};
export function fixtureBootstrap(): Bootstrap | undefined {
  if (import.meta.env.VITE_ENABLE_TEST_FIXTURES !== "true") return undefined;
  const name =
    new URLSearchParams(window.location.search).get("fixture") ?? "ready";
  return fixtures[name];
}
