import type { ReactNode } from "react";
import { useLanguage, useText } from "../i18n";
import { signInText } from "../text/signIn";
import { OnboardingFrame } from "./OnboardingFrame";
import { Button } from "./Primitives";
import { InlineNotice } from "./Status";

export function LoginCard({
  onLogin,
  notice,
}: {
  onLogin?: () => void;
  notice?: ReactNode;
}) {
  const demo = import.meta.env.VITE_SYNTHETIC_DEMO === "true";
  const language = useLanguage();
  const t = signInText[language];
  return (
    <OnboardingFrame step="github" notice={notice}>
      <section className="ah-login-card" aria-labelledby="login-title">
        <header>
          <p className="eyebrow">Open Habitat</p>
          <h1 data-testid="login-heading" id="login-title">
            {t.welcome}
          </h1>
        </header>
        <p>{t.intro}</p>
        <Button
          data-testid="github-sign-in"
          size="page"
          label={t.signIn}
          availability={
            demo
              ? {
                  state: "unsupported",
                  // Demo-only text stays out of the catalog, so the
                  // production bundle never carries the demo's markers.
                  reason:
                    language !== "fi"
                      ? "Signing in is not possible in the simulated demo."
                      : "Simuloidussa demossa ei voi kirjautua.",
                }
              : undefined
          }
          onPress={
            onLogin ??
            (() => {
              window.location.href = "/auth/github/start";
            })
          }
        />
        {demo ? (
          <p className="muted">
            {language !== "fi"
              ? "This view is a simulation."
              : "Tämä näkymä on simulaatio."}
          </p>
        ) : null}
      </section>
    </OnboardingFrame>
  );
}

// The callback currently supplies only a URL error code, not an authenticated,
// user-safe support reference. Never echo that query value as a diagnostic.
/** The sign-in's refusal in words: a refusal never names a team, but says
 * when GitHub could not answer whether the person belongs to one. */
export function LoginErrorNotice({ code }: { code?: string | null }) {
  const t = useText(signInText);
  const [title, description] =
    code === "membership_unavailable"
      ? [t.membershipTitle, t.membershipDetail]
      : code === "identity_mapping_denied"
        ? [t.deniedTitle, t.deniedDetail]
        : [t.errorTitle, t.errorDetail];
  return (
    <InlineNotice
      data-testid="login-error"
      data-state={code ?? undefined}
      title={title}
      description={description}
      tone="danger"
    />
  );
}
