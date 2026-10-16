import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { PiModelSelector } from "./PiModelSelector";

afterEach(() => vi.restoreAllMocks());
it("publishes a new-conversation provider toggle even when model ids collide, without changing defaults", async () => {
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
  render(<PiModelSelector csrf="csrf" scope="new" onChoice={onChoice} />);
  fireEvent.click(await screen.findByRole("button", { name: /^API-avain$/ }));
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
  expect(fetcher).toHaveBeenCalledTimes(1);
  expect(fetcher.mock.calls[0][1]?.method).toBeUndefined();
});
