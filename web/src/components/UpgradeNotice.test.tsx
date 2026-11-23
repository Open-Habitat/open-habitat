import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  UpgradeBanner,
  UpgradeNoticeLine,
  type UpgradeSchedule,
  upgradeBannerState,
} from "./UpgradeNotice";

const deadline = new Date();
deadline.setHours(14, 32, 0, 0);
const schedule: UpgradeSchedule = {
  schedule_id: "0123456789abcdef0123456789abcdef",
  revision: 1,
  target_version: "0.9.0",
  announced_at: new Date(deadline.getTime() - 120000).toISOString(),
  deadline: deadline.toISOString(),
  status: "countdown",
};

describe("the installation upgrade banner", () => {
  it("counts down to the local time, then says the update is starting, never complete", () => {
    const { rerender } = render(
      <UpgradeBanner schedule={schedule} now={deadline.getTime() - 110000} />,
    );
    const banner = screen.getByTestId("upgrade-banner");
    expect(banner.dataset.state).toBe("countdown");
    expect(banner.textContent).toContain(
      "Habitat päivitetään klo 14.32, noin 2 minuutin kuluttua",
    );
    expect(banner.textContent).toContain("Luonnoksesi säilyvät");
    rerender(
      <UpgradeBanner schedule={schedule} now={deadline.getTime() + 1} />,
    );
    expect(screen.getByTestId("upgrade-banner").dataset.state).toBe("starting");
    expect(screen.getByTestId("upgrade-banner").textContent).toContain(
      "Päivitys alkaa",
    );
    expect(upgradeBannerState({ ...schedule, status: "unknown" }, 0)).toBe(
      "unknown",
    );
  });
  it("shows a cancellation and an unknown owner, and lets the person close them", () => {
    const { rerender } = render(
      <UpgradeBanner schedule={{ ...schedule, status: "withdrawn" }} now={0} />,
    );
    expect(screen.getByTestId("upgrade-banner").textContent).toContain(
      "Päivitys peruttiin",
    );
    fireEvent.click(screen.getByTestId("upgrade-banner-dismiss"));
    expect(screen.queryByTestId("upgrade-banner")).toBeNull();
    rerender(
      <UpgradeBanner schedule={{ ...schedule, status: "unknown" }} now={0} />,
    );
    expect(screen.getByTestId("upgrade-banner").textContent).toContain(
      "Päivityksen tila ei ole tiedossa",
    );
    rerender(<UpgradeBanner schedule={undefined} now={0} />);
    expect(screen.queryByTestId("upgrade-banner")).toBeNull();
  });
});

describe("Habitat's line on the announcement", () => {
  it("names the version, the time and the background work that stops", () => {
    render(
      <UpgradeNoticeLine
        line={{
          version: "0.9.0",
          deadline: deadline.toISOString(),
          variant: "idle",
          processes: [{ process_id: "proc_0a1b", name: "esikatselu" }],
        }}
      />,
    );
    const line = screen.getByTestId("upgrade-notice-line");
    expect(line.textContent).toContain("versioon 0.9.0 klo 14.32");
    expect(line.textContent).toContain("esikatselu");
  });
});
