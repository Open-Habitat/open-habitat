import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OnboardingFrame, OnboardingRoute } from "./OnboardingFrame";

const states = (view: ReturnType<typeof render>) =>
  [...view.getByTestId("onboarding-steps").querySelectorAll("li")].map(
    (li) => `${li.dataset.testid?.slice(16)}:${li.dataset.state}`,
  );

describe("Kartta onboarding route", () => {
  it("without a journey's route shows GitHub, repositories and AI account", () => {
    const view = render(
      <OnboardingFrame step="repositories">
        <p>Vaihe</p>
      </OnboardingFrame>,
    );
    expect(states(view)).toEqual([
      "github:done",
      "repositories:current",
      "ai:next",
    ]);
    expect(
      view
        .getByTestId("onboarding-step-repositories")
        .getAttribute("aria-current"),
    ).toBe("step");
    expect(view.getByText(window.location.host)).toBeTruthy();
  });
  it("draws the journey's route, Google included, with what passed steps left behind", () => {
    const view = render(
      <OnboardingRoute
        steps={[
          { id: "github", note: "Kirjautunut" },
          { id: "repositories", skipped: true, note: "Ei repoja" },
          { id: "google", skipped: true, note: "Ohitettu" },
          { id: "ai" },
        ]}
      >
        <OnboardingFrame step="ai">
          <p>Vaihe</p>
        </OnboardingFrame>
      </OnboardingRoute>,
    );
    expect(states(view)).toEqual([
      "github:done",
      "repositories:skipped",
      "google:skipped",
      "ai:current",
    ]);
    expect(view.getByTestId("onboarding-step-github").textContent).toContain(
      "Kirjautunut",
    );
    expect(view.getByTestId("onboarding-step-google").textContent).toContain(
      "Ohitettu",
    );
    expect(view.getByTestId("onboarding-step-ai").textContent).toContain("Nyt");
  });
});
