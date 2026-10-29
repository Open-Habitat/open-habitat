import { describe, expect, it } from "vitest";
import { type Machine, machineState, seenAgo, sshTarget } from "./ownMachines";

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

describe("ssh target", () => {
  it("finds the host past options, their arguments and a user", () => {
    expect(sshTarget("ssh alice-macbook -- sw_vers")).toBe("alice-macbook");
    expect(sshTarget("ssh -o ConnectTimeout=5 -p 22 pc ls")).toBe("pc");
    expect(sshTarget("ssh -oBatchMode=yes -tt alice@pc ls")).toBe("pc");
    expect(sshTarget("ssh -i ~/.ssh/k -- pc ls")).toBe("pc");
    expect(sshTarget("cd /tmp && ssh pc 'df -h'")).toBe("pc");
    expect(sshTarget("timeout 10 ssh pc true")).toBe("pc");
  });
  it("names no host where ssh is not run on one", () => {
    expect(sshTarget("ssh-keygen -lf x pc")).toBeUndefined();
    expect(sshTarget("git push origin main")).toBeUndefined();
    expect(sshTarget("ls ~/.ssh pc")).toBeUndefined();
    expect(sshTarget("sshpc ls")).toBeUndefined();
    expect(sshTarget("ssh -i key")).toBeUndefined();
    expect(sshTarget("ssh 100.88.14.53 ls")).toBeUndefined();
    expect(sshTarget("echo ssh alice-macbook")).toBeUndefined();
    expect(sshTarget("# ssh alice-macbook true")).toBeUndefined();
    expect(sshTarget("ssh -G alice-macbook")).toBeUndefined();
  });
  it("reads quoted words as the shell does", () => {
    expect(sshTarget(`ssh "alice-macbook" ls`)).toBe("alice-macbook");
    expect(sshTarget(`ssh -o "ProxyCommand=ssh jump nc %h %p" pc ls`)).toBe(
      "pc",
    );
    expect(sshTarget(`echo "x; ssh pc"`)).toBeUndefined();
    expect(sshTarget("FOO=1 env -i ssh pc ls")).toBe("pc");
  });
});
