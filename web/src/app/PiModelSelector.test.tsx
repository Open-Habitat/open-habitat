import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PiModelSelector } from "./PiModelSelector";
import { PiModelsProvider } from "./PiModels";

afterEach(() => vi.restoreAllMocks());
it("browses a provider without choosing even when model ids collide, then publishes the explicit choice", async () => {
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        schema_version: 1,
        default_provider: "openai-codex",
        default_model: "gpt-6-luna",
        default_thinking: "off",
        catalog_status: "native_cached",
        models: [
          {
            provider: "openai-codex",
            id: "gpt-6-luna",
            name: "Luna subscription",
            thinking_levels: ["off"],
          },
          {
            provider: "openai",
            id: "gpt-6-luna",
            name: "Luna API",
            thinking_levels: ["off"],
          },
        ],
      }),
      { headers: { "Content-Type": "application/json" } },
    ),
  );
  const onChoice = vi.fn();
  render(
    <PiModelsProvider enabled>
      <PiModelSelector csrf="csrf" scope="new" onChoice={onChoice} />
    </PiModelsProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: /^API-avain$/ }));
  expect(onChoice).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("radio", { name: /Luna API/ }));
  await waitFor(() =>
    expect(onChoice).toHaveBeenCalledWith({
      provider: "openai",
      model: "gpt-6-luna",
      thinking: "off",
    }),
  );
  expect(screen.getByRole("radio", { name: /Luna API/ })).toHaveProperty(
    "checked",
    true,
  );
  expect(fetcher).toHaveBeenCalledTimes(2);
  expect(fetcher.mock.calls[0][1]?.method).toBeUndefined();
});
it("does not unblock the applied refused model until an empty-conversation choice is confirmed", async () => {
  vi.spyOn(globalThis, "fetch").mockImplementation(
    async () =>
      new Response(
        JSON.stringify({
          schema_version: 1,
          default_provider: "openai-codex",
          default_model: "refused",
          default_thinking: "off",
          models: [
            {
              id: "refused",
              name: "Refused",
              outcome: "refused",
              observed_at: new Date().toISOString(),
              thinking_levels: ["off"],
            },
            { id: "working", name: "Working", thinking_levels: ["off"] },
          ],
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
  );
  const onBlocked = vi.fn();
  const onChoice = vi.fn();
  render(
    <PiModelsProvider enabled>
      <PiModelSelector
        csrf="csrf"
        scope="empty"
        onBlocked={onBlocked}
        onChoice={onChoice}
      />
    </PiModelsProvider>,
  );
  const radio = await screen.findByRole("radio", { name: /Working/ });
  await waitFor(() => expect(onBlocked).toHaveBeenLastCalledWith(true));
  fireEvent.click(radio);
  expect(onBlocked).toHaveBeenLastCalledWith(true);
  expect(onChoice).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Valitse" }));
  await waitFor(() => expect(onBlocked).toHaveBeenLastCalledWith(false));
  expect(onChoice).toHaveBeenCalledWith({
    provider: "openai-codex",
    model: "working",
    thinking: "off",
  });
});
it("keeps an unconfirmed choice while late native settings replace a qualified startup label", async () => {
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(
      JSON.stringify({
        schema_version: 1,
        default_provider: "openai-codex",
        default_model: "current",
        default_thinking: "off",
        models: [
          { id: "current", name: "Current", thinking_levels: ["off", "high"] },
          { id: "chosen", name: "Chosen", thinking_levels: ["off", "high"] },
        ],
      }),
      { headers: { "Content-Type": "application/json" } },
    ),
  );
  const onChoice = vi.fn();
  const { rerender } = render(
    <PiModelsProvider enabled>
      <PiModelSelector
        csrf="csrf"
        scope="conversation"
        current="openai-codex/current"
        currentThinking="off"
        onChoice={onChoice}
      />
    </PiModelsProvider>,
  );
  fireEvent.click(await screen.findByRole("radio", { name: /Chosen/ }));
  rerender(
    <PiModelsProvider enabled>
      <PiModelSelector
        csrf="csrf"
        scope="conversation"
        current="current"
        currentThinking="high"
        onChoice={onChoice}
      />
    </PiModelsProvider>,
  );
  expect(screen.getByRole("radio", { name: /Chosen/ })).toHaveProperty(
    "checked",
    true,
  );
  expect(
    screen.getByRole("button", { name: "off" }).getAttribute("aria-pressed"),
  ).toBe("true");
  fireEvent.click(
    screen.getByRole("button", {
      name: "Aloita uusi keskustelu mallilla chosen",
    }),
  );
  await waitFor(() =>
    expect(onChoice).toHaveBeenCalledWith({
      provider: "openai-codex",
      model: "chosen",
      thinking: "off",
    }),
  );
});
