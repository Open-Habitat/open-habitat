// Synthetic catalog replay only: the lab has no installed Claude runtime.
import { openLab, snapshot, origin } from "./session.mjs";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const home = await mkdtemp(join(tmpdir(), "claude-default-capture-"));
const pkg = resolve(
  "internal/daemon/pi-device-test/node_modules/@earendil-works/pi-coding-agent",
);
const helper = (action) => {
  const child = spawnSync(
    process.execPath,
    [
      "--import",
      resolve("internal/daemon/pi-device-test/mock.mjs"),
      resolve("internal/daemon/pi_models_helper.mjs"),
      join(pkg, "dist/index.js"),
      join(pkg, "package.json"),
      action,
      "",
    ],
    {
      env: { HOME: home, PATH: process.env.PATH, PI_OFFLINE: "1" },
      encoding: "utf8",
    },
  );
  if (child.status !== 0) throw Error(child.stdout + child.stderr);
  return JSON.parse(child.stdout);
};
const lab = await openLab();
try {
  const catalog = helper("list");
  // Replay the effective first-session fallback, not a saved preference.
  let payload = {
    ...catalog,
    default_provider: "claude-bridge",
    default_model: catalog.models.find((m) => m.provider === "claude-bridge")
      .id,
    default_thinking: "off",
  };
  await lab.page.route("**/api/v1/pi/claude-login", (route) =>
    route.fulfill({ json: { schema_version: 1, state: "completed" } }),
  );
  await lab.page.route("**/api/v1/pi/models", (route) =>
    route.fulfill({ json: payload }),
  );
  for (const phase of ["before", "after"]) {
    if (phase === "after") payload = helper("initialize-claude");
    await lab.page.goto(`${origin}/settings`);
    await lab.page
      .getByRole("button", { name: "Agentit", exact: true })
      .click();
    await lab.page
      .getByRole("radio", { name: phase === "after" ? /Opus 5.5/ : /Fable/ })
      .first()
      .waitFor();
    await snapshot(lab.page, `issues/claude-default-model/${phase}`);
    await lab.page.goto(`${origin}/workspaces`);
  }
} finally {
  await lab.browser.close();
  await rm(home, { recursive: true, force: true });
}
