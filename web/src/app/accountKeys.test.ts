import { describe, expect, it } from "vitest";
import {
  type AccountKey,
  keyId,
  markSeen,
  recipientGroups,
  seenKeys,
} from "./accountKeys";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(k: string) {
    return this.values.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.values.set(k, v);
  }
}
const store = () => new MemoryStorage() as unknown as Storage;

const ssh = (fingerprint: string): AccountKey => ({
  kind: "ssh",
  file: "~/.ssh/id_ed25519",
  algorithm: "ssh-ed25519",
  public_key: "ssh-ed25519 AAAA",
  fingerprint,
  modified_at: "2026-10-29T10:00:00Z",
});

describe("seen keys", () => {
  it("takes the keys of the first visit as seen and marks later ones", () => {
    const storage = store();
    const first = [ssh("SHA256:a")];
    expect([...seenKeys("wid_a", first, storage)]).toEqual(["SHA256:a"]);
    // The default file now holds another key: it is new, though the name is not.
    const later = [ssh("SHA256:b")];
    const seen = seenKeys("wid_a", later, storage);
    expect(seen.has(keyId(later[0]))).toBe(false);
    expect(markSeen("wid_a", ["SHA256:b"], storage).has("SHA256:b")).toBe(true);
    expect(seenKeys("wid_a", later, storage).has("SHA256:b")).toBe(true);
  });

  it("keeps each web identity's marks apart", () => {
    const storage = store();
    seenKeys("wid_a", [], storage);
    markSeen("wid_a", ["SHA256:a"], storage);
    // Another identity's first visit seeds only its own keys.
    expect(seenKeys("wid_b", [ssh("SHA256:b")], storage).has("SHA256:a")).toBe(
      false,
    );
    expect(seenKeys("wid_a", [], storage).has("SHA256:b")).toBe(false);
  });

  it("treats unreadable storage as nothing seen rather than everything", () => {
    const storage = store();
    storage.setItem("oh.account-keys.seen.wid_a", "{not json");
    expect(seenKeys("wid_a", [ssh("SHA256:a")], storage).size).toBe(0);
  });
});

it("groups an age recipient by four after its prefix", () => {
  expect(recipientGroups("age1abcdefghij")).toBe("age1 abcd efgh ij");
});
