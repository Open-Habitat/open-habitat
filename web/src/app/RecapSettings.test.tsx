import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { recapLevels } from "../components/RecapSettings";
import { RecapSettingsSection } from "./RecapSettings";

const custom = {
  level: "custom",
  delay_seconds: 180,
  model: null,
  ...recapLevels.standard,
};

afterEach(() => vi.unstubAllGlobals());

describe("Tilannekatsaus saves", () => {
  it("a change queued before leaving the section never lands after a newer one", async () => {
    let disk = { ...custom };
    const writes: number[] = [];
    const replies: (() => void)[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (_url: string, init?: RequestInit) => {
        if (init?.method === "PUT") {
          const value = JSON.parse(String(init.body));
          writes.push(value.words);
          await new Promise<void>((resolve) => replies.push(resolve));
          disk = value;
        }
        return new Response(
          JSON.stringify({ schema_version: 1, settings: disk }),
          {
            headers: { "Content-Type": "application/json" },
          },
        );
      }),
    );
    const first = render(<RecapSettingsSection csrf="token" />);
    const more = async () => {
      const button = await screen.findByTestId("recap-words-more");
      await act(async () => fireEvent.click(button));
    };
    await more(); // 45, in flight
    await more(); // 50, queued
    first.unmount();
    render(<RecapSettingsSection csrf="token" />);
    // The returning section shows the change still on its way.
    expect(await screen.findByTestId("recap-words-input")).toHaveProperty(
      "value",
      "50",
    );
    await more(); // 55 replaces the queued 50
    while (replies.length) await act(async () => replies.shift()?.());
    await act(async () => {});
    while (replies.length) await act(async () => replies.shift()?.());
    expect(writes).toEqual([45, 55]);
    expect(disk.words).toBe(55);
  });
});
