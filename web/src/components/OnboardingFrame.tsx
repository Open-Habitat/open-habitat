import { createContext, type ReactNode, useContext } from "react";
import type { ProviderId } from "../app/integrations";
import { Icon } from "./Icon";
import { providerCopy } from "./Integrations";
import styles from "./OnboardingFrame.module.css";

/** The route's steps; an integration step is named by its provider. */
export type OnboardingStepId = "github" | "repositories" | ProviderId | "ai";

/** One step of this person's route and, once passed, how it ended. */
export type OnboardingRouteStep = {
  id: OnboardingStepId;
  /** A passed step that was left without its result, such as Google. */
  skipped?: boolean;
  /** An integration step the site made required: it has no skip action. */
  required?: boolean;
  /** What the passed step left behind, in a word or two. */
  note?: string;
  /** Work the step started that is still visible from the route, such as
   * the repositories being fetched while the person goes on. */
  detail?: ReactNode;
};

const label = (id: OnboardingStepId) =>
  id === "github"
    ? "GitHub"
    : id === "repositories"
      ? "Repot"
      : id === "ai"
        ? "AI-tili"
        : providerCopy[id].name;
const plainRoute: OnboardingRouteStep[] = [
  { id: "github" },
  { id: "repositories" },
  { id: "ai" },
];

const RouteContext = createContext<OnboardingRouteStep[] | undefined>(
  undefined,
);

/** The journey that owns onboarding names its route here, the site's
 * integration steps included; the frames inside it draw that route. The
 * administrator's preview names its route here too, so it draws the same. */
export function OnboardingRoute({
  steps,
  children,
}: {
  steps: OnboardingRouteStep[];
  children: ReactNode;
}) {
  return (
    <RouteContext.Provider value={steps}>{children}</RouteContext.Provider>
  );
}

/** The Kartta frame: the whole route beside the current step. Presentation
 * only: the current step comes from the owning journey, never from the URL.
 * "done" is past the last step, where only the preview stops. */
export function OnboardingFrame({
  step,
  children,
  notice,
}: {
  step: OnboardingStepId | "done";
  children: ReactNode;
  notice?: ReactNode;
}) {
  const route = useContext(RouteContext) ?? plainRoute;
  const at =
    step === "done" ? route.length : route.findIndex((s) => s.id === step);
  return (
    <div className={`ah-onboarding-frame ${styles.frame}`} data-step={step}>
      <div className={styles.identity}>
        <strong>Open Habitat</strong>
        <span aria-hidden="true" className={styles.divider} />
        <span className={styles.host}>{window.location.host}</span>
      </div>
      <div className={styles.map}>
        <nav className={styles.route} aria-label="Käyttöönoton vaiheet">
          <p className={styles.kicker}>Oma reittisi</p>
          <ol data-testid="onboarding-steps">
            {route.map((s, i) => {
              const state =
                i === at
                  ? "current"
                  : i < at
                    ? s.skipped
                      ? "skipped"
                      : "done"
                    : "next";
              return (
                <li
                  key={s.id}
                  data-testid={`onboarding-step-${s.id}`}
                  data-state={state}
                  data-required={s.required ? "true" : undefined}
                  aria-current={state === "current" ? "step" : undefined}
                >
                  <span className={styles.dot} aria-hidden="true">
                    {state === "done" ? <Icon name="check" /> : i + 1}
                  </span>
                  <span className={styles.label}>
                    <strong>{label(s.id)}</strong>
                    <small>
                      {state === "current"
                        ? "Nyt"
                        : state === "next"
                          ? s.required
                            ? "Pakollinen"
                            : "Seuraavaksi"
                          : (s.note ?? (s.skipped ? "Ohitettu" : "Valmis"))}
                    </small>
                    {s.detail}
                  </span>
                </li>
              );
            })}
          </ol>
        </nav>
        <div className={styles.step}>
          <div className={styles.card} data-testid="onboarding-card">
            {children}
          </div>
          {notice}
        </div>
      </div>
    </div>
  );
}
