import { expect, test } from "./lab-host";

// The Trash has no view yet (implement-trash-ui); this drives the host
// contract from the signed-in page through the real gateway, CSRF check and
// daemon handler on a synthetic home.
test("@workspace-trash delete, restore and permanent delete through the gateway", async ({
  page,
}) => {
  await page.goto("/workspaces");
  await page.getByRole("button", { name: "Kirjaudu GitHubilla" }).click();
  await page.getByRole("link", { name: "Alice", exact: true }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
  const { csrf } = await (await page.request.get("/auth/session")).json();
  const call = (body: Record<string, unknown>) =>
    page.evaluate(
      async ([body, csrf]) => {
        const r = await fetch("/api/v1/workspaces", {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json",
            "X-Agent-Host-CSRF": csrf,
          },
          body: JSON.stringify(body),
        });
        return { status: r.status, body: await r.json() };
      },
      [body, csrf] as const,
    );
  const observe = async (name: string) => {
    const snapshot = await (await page.request.get("/api/v1/snapshot")).json();
    const workspace = snapshot.workspaces.find(
      (w: { name: string }) => w.name === name,
    );
    return { snapshot, workspace };
  };

  const { snapshot } = await observe("");
  const created = await call({
    action: "create",
    name: "roskakori-koe",
    git: false,
    user_observation_token: snapshot.user_observation_token,
  });
  expect(created.status).toBe(200);

  let { workspace } = await observe("roskakori-koe");
  const target = {
    workspace_id: workspace.workspace_id,
    observation_token: workspace.observation_token,
  };
  const check = await call({ action: "delete_check", ...target });
  expect(check.status).toBe(200);
  expect(check.body.outcome).toBe("trash");
  // A plain directory has nowhere else that holds it: no outright deletion.
  const refused = await call({
    action: "delete",
    ...target,
    disposal: "permanent",
  });
  expect(refused.status).toBe(409);
  expect(refused.body.error.code).toBe("workspace_not_clean");

  const moved = await call({ action: "delete", ...target, disposal: "trash" });
  expect(moved.body).toMatchObject({
    state: "trashed",
    entry: "roskakori-koe",
  });
  expect((await observe("roskakori-koe")).workspace).toBeUndefined();
  const listed = await call({ action: "trash_list" });
  expect(listed.body.entries).toContainEqual(
    expect.objectContaining({ entry: "roskakori-koe", restore: "available" }),
  );

  const restored = await call({
    action: "trash_restore",
    entry: "roskakori-koe",
  });
  expect(restored.body).toMatchObject({
    state: "restored",
    workspace_id: target.workspace_id,
  });
  ({ workspace } = await observe("roskakori-koe"));
  expect(workspace).toBeDefined();

  const again = await call({
    action: "delete",
    workspace_id: workspace.workspace_id,
    observation_token: workspace.observation_token,
    disposal: "trash",
  });
  expect(again.body.state).toBe("trashed");
  const destroyed = await call({
    action: "trash_delete",
    entry: "roskakori-koe",
    confirmation: "roskakori-koe",
  });
  expect(destroyed.body).toMatchObject({ state: "deleted" });
  expect(
    (await call({ action: "trash_list" })).body.entries,
  ).not.toContainEqual(expect.objectContaining({ entry: "roskakori-koe" }));

  // The gateway's write check still applies to every deletion action.
  const forged = await page.evaluate(async () => {
    const r = await fetch("/api/v1/workspaces", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "trash_list" }),
    });
    return r.status;
  });
  expect(forged).toBe(403);
});
