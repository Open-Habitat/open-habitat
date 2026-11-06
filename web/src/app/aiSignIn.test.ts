import { afterEach, expect, it } from "vitest";
import {
  announceSignedIn,
  clearWaiting,
  conversationProvider,
  failuresSeen,
  providerOfModel,
  readWaiting,
  refusedTurn,
  resendCommand,
  sendCommand,
  signedInFor,
  waitingFor,
  writeWaiting,
} from "./aiSignIn";
import type { HistoryEntry } from "./history";

afterEach(() => {
  sessionStorage.clear();
  failuresSeen.clear();
  signedInFor.clear();
});
const entry = (
  key: string,
  kind: HistoryEntry["kind"],
  text: string,
  more: Partial<HistoryEntry> = {},
): HistoryEntry => ({
  entry_key: key,
  kind,
  content: { media_type: "text/plain", text, complete: true },
  ...more,
});

it("finds the conversation's own refused reply and the message it failed", () => {
  const asked = entry("u1", "user", " Kirjaa tunnit. ");
  const refused = entry("a1", "assistant", "Failed to authenticate", {
    stop_reason: "error",
    refused_by: "claude-bridge",
  });
  expect(refusedTurn([asked, refused])).toEqual({
    provider: "claude-bridge",
    key: "a1",
    text: "Kirjaa tunnit.",
  });
  // Asked again since, or another failure: not a refused sign-in now.
  expect(refusedTurn([asked, refused, entry("u2", "user", "x")])).toBe(
    undefined,
  );
  expect(
    refusedTurn([
      asked,
      entry("a2", "assistant", "", { stop_reason: "error" }),
    ]),
  ).toBe(undefined);
});

it("tells the conversation's provider from its newest choice", () => {
  expect(providerOfModel("claude-bridge/claude-sonnet-5")).toBe(
    "claude-bridge",
  );
  expect(providerOfModel("synthetic/fake")).toBe(undefined);
  const change = entry("m1", "model_change", "openai-codex/gpt-6-astra");
  const answer = entry("a1", "assistant", "ok", { model: "gpt-6-astra" });
  expect(conversationProvider([change, answer])).toBe("openai-codex");
  expect(conversationProvider([], { provider: "anthropic" })).toBe("anthropic");
  expect(conversationProvider([], {})).toBe("openai-codex");
  expect(conversationProvider([])).toBe(undefined);
});

it("gives a restored message the same send ID in every tab sending the same text", async () => {
  const agent = "pi:00000000-0000-4000-8000-000000000001";
  const a = await resendCommand(agent, "e1", "Kirjaa tunnit.");
  expect(a).toMatch(
    /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  );
  expect(await resendCommand(agent, "e1", "Kirjaa tunnit.")).toBe(a);
  // An edit is a message of its own, and so is another failure's.
  expect(await resendCommand(agent, "e1", "Kirjaa tunnit. Kiitos!")).not.toBe(
    a,
  );
  expect(await resendCommand(agent, "e2", "Kirjaa tunnit.")).not.toBe(a);
  const held = crypto.randomUUID();
  expect(
    await sendCommand(
      agent,
      { command: held, provider: "openai", text: "x" },
      "y",
    ),
  ).toBe(held);
  expect(
    await sendCommand(
      agent,
      { command: held, provider: "openai", text: "x", from: "e1" },
      "Kirjaa tunnit.",
    ),
  ).toBe(a);
});

it("does not offer to send again a message the agent had already worked on", () => {
  const asked = entry("u1", "user", "Julkaise versio.");
  const call = entry("a1", "assistant", "", { stop_reason: "toolUse" });
  const result = entry("t1", "tool", "ok");
  const refused = entry("a2", "assistant", "", {
    stop_reason: "error",
    refused_by: "openai-codex",
  });
  expect(refusedTurn([asked, call, result, refused])).toEqual({
    provider: "openai-codex",
    key: "a2",
    text: "",
  });
});

it("keeps waiting messages per conversation and provider with their fields", () => {
  const command = crypto.randomUUID();
  writeWaiting("wid_a", "pi:one", {
    command,
    provider: "claude-bridge",
    text: "x",
  });
  writeWaiting("wid_a", "pi:two", {
    command: crypto.randomUUID(),
    provider: "openai",
    text: "y",
  });
  sessionStorage.setItem("nah:wid_a:draft:pi:one", "x Kiitos!");
  expect(readWaiting("wid_a", "pi:one")?.command).toBe(command);
  expect(waitingFor("wid_a", "claude-bridge")).toEqual([
    {
      id: "pi:one",
      waiting: { command, provider: "claude-bridge", text: "x" },
      draft: "x Kiitos!",
    },
  ]);
  expect(waitingFor("wid_b", "claude-bridge")).toEqual([]);
  sessionStorage.setItem("nah:wid_a:waiting:pi:bad", '{"command":"nope"}');
  expect(readWaiting("wid_a", "pi:bad")).toBe(undefined);
  clearWaiting("wid_a", "pi:one");
  expect(waitingFor("wid_a", "claude-bridge")).toEqual([]);
});

it("ends the refusals this tab has shown when their provider takes the person back", () => {
  failuresSeen.set("pi:one", { provider: "claude-bridge", key: "a1" });
  failuresSeen.set("pi:two", { provider: "openai", key: "b1" });
  announceSignedIn("claude-bridge");
  expect(signedInFor.has("pi:one:a1")).toBe(true);
  expect(signedInFor.has("pi:two:b1")).toBe(false);
});
