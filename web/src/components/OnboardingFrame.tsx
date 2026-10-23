import { createContext, type ReactNode, useContext } from "react";
import { Icon } from "./Icon";
import styles from "./OnboardingFrame.module.css";

export type OnboardingStepId = "github" | "repositories" | "google" | "ai";

/** One step of this person's route and, once passed, how it ended. */
export type OnboardingRouteStep = {
  id: OnboardingStepId;
  /** A passed step that was left without its result, such as Google. */
  skipped?: boolean;
  /** What the passed step left behind, in a word or two. */
  note?: string;
};

const labels: Record<OnboardingStepId, string> = {
  github: "GitHub",
  repositories: "Repot",
  google: "Google",
  ai: "AI-tili",
};
const plainRoute: OnboardingRouteStep[] = [
  { id: "github" },
  { id: "repositories" },
  { id: "ai" },
];

const RouteContext = createContext<OnboardingRouteStep[] | undefined>(
  undefined,
);

/** The journey that owns onboarding names its route here, Google included
 * when it is part of it; the frames inside it draw that route. */
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
 * only: the current step comes from the owning journey, never from the URL. */
export function OnboardingFrame({
  step,
  children,
  notice,
}: {
  step: OnboardingStepId;
  children: ReactNode;
  notice?: ReactNode;
}) {
  const route = useContext(RouteContext) ?? plainRoute;
  const at = route.findIndex((s) => s.id === step);
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
                  aria-current={state === "current" ? "step" : undefined}
                >
                  <span className={styles.dot} aria-hidden="true">
                    {state === "done" ? <Icon name="check" /> : i + 1}
                  </span>
                  <span className={styles.label}>
                    <strong>{labels[s.id]}</strong>
                    <small>
                      {state === "current"
                        ? "Nyt"
                        : state === "next"
                          ? "Seuraavaksi"
                          : (s.note ?? (s.skipped ? "Ohitettu" : "Valmis"))}
                    </small>
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
