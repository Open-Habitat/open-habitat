import { afterEach, describe, expect, it, vi } from "vitest";
import guestExample from "../../../contracts/v1/examples/conversation-guest.json";
import membersExample from "../../../contracts/v1/examples/conversation-members.json";
import sharesExample from "../../../contracts/v1/examples/conversation-shares.json";
import {
  readGuestState,
  readInvite,
  readMembers,
  readOwnerShared,
  readShares,
  Unavailable,
} from "./multiplayer";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
afterEach(() => vi.unstubAllGlobals());

describe("multiplayer reads", () => {
  it("accept the contract's examples and use the owner's bare session ID", async () => {
    const fetch = vi.fn(async (url: string) => {
      if (url.endsWith("/members")) return json(membersExample);
      if (url.endsWith("/shared"))
        return json(
          url.startsWith("/api/v1/conversations/")
            ? {
                schema_version: 1,
                agent_id: guestExample.agent_id,
                turn: guestExample.turn,
                waiting_requests: guestExample.waiting_requests,
                release: guestExample.release,
                present: guestExample.present,
              }
            : sharesExample,
        );
      if (url.endsWith("/state")) return json(guestExample);
      if (url.endsWith("/invite"))
        return json({
          schema_version: 1,
          title: "",
          role: "participant",
          state: "invited",
        });
      return json({}, 404);
    });
    vi.stubGlobal("fetch", fetch);
    const id = "pi:11111111-1111-4111-8111-111111111111";
    await expect(readMembers(id)).resolves.toMatchObject({ generation: 3 });
    expect(fetch.mock.calls[0][0]).toBe(
      "/api/v1/conversations/11111111-1111-4111-8111-111111111111/members",
    );
    await expect(readOwnerShared(id)).resolves.toBeTruthy();
    await expect(readShares()).resolves.toBeTruthy();
    await expect(readGuestState(`s${"a".repeat(26)}`)).resolves.toBeTruthy();
    await expect(readInvite(`s${"a".repeat(26)}`)).resolves.toMatchObject({
      state: "invited",
    });
  });

  it("read a missing share as gone and a malformed reply as the host's", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) =>
        url.includes("gone") ? json({}, 404) : json({ schema_version: 1 }),
      ),
    );
    await expect(readGuestState("gone")).rejects.toEqual(
      new Unavailable("gone"),
    );
    await expect(readGuestState("other")).rejects.toMatchObject({
      reason: "host",
    });
  });
});
