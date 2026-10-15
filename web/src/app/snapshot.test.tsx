import { expect, it } from "vitest";
import { readSnapshot } from "./snapshot";

it("accepts a valid native snapshot beyond the old 1 MiB body limit", async () => {
  const uuid = "11111111-1111-4111-8111-111111111111";
  const observed = "2026-10-15T10:00:00Z";
  const workspaces = Array.from({ length: 2500 }, (_, i) => ({
    workspace_id: `ws_${String(i).padStart(8, "0")}`,
    observation_token: `obs_${String(i).padStart(8, "0")}`,
    name: `project-${i}`,
    display_name: `project-${i}`,
    path: `/synthetic/${"directory/".repeat(12)}project-${i}`,
    kind: "directory",
    visibility: "visible",
    mutation_state: "allowed",
    presence: "present",
    facts: [
      { source: "filesystem", state: "confirmed", observed_at: observed },
    ],
  }));
  const body = JSON.stringify({
    schema_version: 1,
    snapshot_id: uuid,
    captured_at: observed,
    server_instance_id: uuid,
    event_cursor: `ev1:${uuid}:0`,
    user_observation_token: "obs_person",
    write_state: "enabled",
    identity: { web_identity_id: "wid_12345678", display_name: "Alice" },
    sources: [
      { source: "filesystem", state: "confirmed", observed_at: observed },
    ],
    workspaces,
    agents: [],
    operations: [],
    command_ledger: {
      epoch: uuid,
      max_entries: 100,
      max_age_seconds: 60,
      entries: [],
    },
  });
  expect(new TextEncoder().encode(body).byteLength).toBeGreaterThan(
    1024 * 1024,
  );
  const parsed = await readSnapshot(new Response(body));
  expect(parsed.workspaces).toHaveLength(2500);
  expect(parsed.workspaces.at(-1)?.workspace_id).toBe("ws_00002499");
});
