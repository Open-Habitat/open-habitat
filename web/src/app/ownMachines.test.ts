import { describe, expect, it } from "vitest";
import { type Machine, machineState, seenAgo } from "./ownMachines";

const machine = (patch: Partial<Machine> = {}): Machine => ({
  name: "alice-macbook",
  user: "alice",
  address: "100.88.14.53",
  expires: "2026-11-28",
  expired: false,
  in_tailnet: true,
  online: true,
  host_key: "SHA256:q8Vd2mR0bW3kYt1pZs9xLc4nHe7uJ5gAo6fTiK2wQyE",
  connection_open: false,
  ...patch,
});

describe("machine state", () => {
  it("lets the date decide over any check: an expired line is expired, not revoked", () => {
    expect(machineState(machine({ expired: true }), "key_rejected")).toBe(
      "expired",
    );
  });
  it("reads a refused key before the date as taken away on the machine", () => {
    expect(machineState(machine(), "key_rejected")).toBe("revoked");
    expect(machineState(machine({ online: false }), "key_rejected")).toBe(
      "revoked",
    );
  });
  it("never calls a machine with another host key merely asleep", () => {
    expect(machineState(machine({ online: false }), "host_key_changed")).toBe(
      "changed",
    );
  });
  it("tells a machine gone from the tailnet from one asleep in it", () => {
    expect(machineState(machine({ in_tailnet: false, online: false }))).toBe(
      "gone",
    );
    expect(machineState(machine({ online: false }))).toBe("asleep");
    expect(machineState(machine(), "no_ssh")).toBe("asleep");
    expect(machineState(machine(), "ok")).toBe("active");
  });
});

describe("last seen", () => {
  const now = new Date("2026-10-29T12:00:00Z");
  it("says how long ago in the largest whole unit", () => {
    expect(seenAgo("2026-10-29T11:59:30Z", now)).toBe("juuri");
    expect(seenAgo("2026-10-29T11:00:00Z", now)).toBe("60 min sitten");
    expect(seenAgo("2026-10-29T02:00:00Z", now)).toBe("10 h sitten");
    expect(seenAgo("2026-10-26T12:00:00Z", now)).toBe("3 pv sitten");
    expect(seenAgo(undefined, now)).toBe("ei tiedossa");
  });
});
