import { describe, expect, it } from "vitest";
import { deviceIdOf, deviceLabel } from "./push";

describe("push", () => {
  // The browser finds itself in the daemon's device list by the same hash
  // the daemon names devices with (pushDeviceID); this value is computed
  // independently of both.
  it("names a device as the daemon does", async () => {
    expect(await deviceIdOf("https://web.push.apple.com/QExample")).toBe(
      "pd_4nNO2phQWDCDBLye8pimdg",
    );
  });

  it("labels a device by platform and browser within the daemon's limit", () => {
    const iphone =
      "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";
    expect(deviceLabel(iphone)).toBe("iPhone · Safari");
    const edge =
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36 Edg/130.0";
    expect(deviceLabel(edge)).toBe("Windows · Edge");
    expect(deviceLabel("").length).toBeGreaterThan(0);
  });
});
