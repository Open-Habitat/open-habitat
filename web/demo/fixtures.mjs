// Local-only deterministic rehearsal data. Never imported by the production entrypoint.
const time = "2026-01-01T00:00:00Z";
const uuid = "00000000-0000-4000-8000-000000000001";
const fact = (source, state) => ({ source, state, observed_at: time });
const workspace = (name, kind = "directory", state = "confirmed") => ({
  workspace_id: `ws_${name.padEnd(8, "0")}`,
  observation_token: "synthetic-observation",
  presence: "present",
  name,
  display_name: name,
  kind,
  visibility: "visible",
  mutation_state: "read_only",
  facts: [
    fact("filesystem", state),
    fact("git", kind === "directory" ? "absent" : state),
    fact("annotation", "unknown"),
  ],
});
const base = {
  schema_version: 1,
  snapshot_id: uuid,
  captured_at: time,
  server_instance_id: uuid,
  event_cursor: `ev1:${uuid}:1`,
  user_observation_token: "synthetic-observation",
  write_state: "read_only",
  identity: {
    web_identity_id: "wid_synthetic_demo",
    display_name: "Demo-käyttäjä (synteettinen)",
  },
  sources: [fact("filesystem", "confirmed")],
  workspaces: [
    workspace("git-project", "git_main_worktree"),
    workspace("ordinary-dir"),
    workspace("without-metadata"),
  ],
  agents: [],
  operations: [],
  command_ledger: {
    epoch: uuid,
    max_entries: 1,
    max_age_seconds: 60,
    entries: [],
  },
  auth: {
    provider: "github",
    provider_account_id: "synthetic",
    native_github: { state: "unknown" },
  },
};
export function responseFor(scenario) {
  if (scenario === "login") return { status: 401 };
  if (scenario === "unavailable") return { status: 503 };
  if (!new Set(["ready", "empty", "partial", "missing"]).has(scenario))
    return { status: 404 };
  const snapshot = structuredClone(base);
  if (scenario === "empty") snapshot.workspaces = [];
  if (scenario === "partial") {
    snapshot.sources = [fact("filesystem", "unavailable")];
    snapshot.workspaces = [workspace("uncertain", "unknown", "unavailable")];
  }
  if (scenario === "missing") {
    snapshot.sources = [fact("filesystem", "absent")];
    snapshot.workspaces = [];
  }
  return { status: 200, body: snapshot };
}
