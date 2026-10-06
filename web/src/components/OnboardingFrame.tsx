import type { ReactNode } from "react";
import styles from "./OnboardingFrame.module.css";

/** Presentation only: the current step comes from the owning journey, never from the browser URL. */
export function OnboardingFrame({
  step,
  children,
}: {
  step: 1 | 2 | 3;
  children: ReactNode;
}) {
  return (
    <div className={styles.frame}>
      <div className={styles.identity}>
        <strong>Omega Habitat</strong>
        <span aria-hidden="true" className={styles.divider} />
        <span className={styles.host}>{window.location.host}</span>
      </div>
      <div className={styles.card}>
        <ol className={styles.steps} aria-label="Käyttöönoton vaiheet">
          {(["GitHub", "Repot", "OpenAI"] as const).map((label, i) => {
            const number = (i + 1) as 1 | 2 | 3;
            return (
              <li
                key={label}
                aria-current={step === number ? "step" : undefined}
              >
                <span className={styles.number}>
                  {number < step ? "✓" : number}
                </span>
                <span>{label}</span>
              </li>
            );
          })}
        </ol>
        {children}
      </div>
    </div>
  );
}
