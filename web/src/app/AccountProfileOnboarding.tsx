import { type FormEvent, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { OnboardingFrame } from "../components/OnboardingFrame";
import { Button } from "../components/Primitives";
import { useText } from "../i18n";
import { accountProfileOnboardingText } from "../text/accountProfileOnboarding";
import { mutationFetch } from "./mutations";
import { type AccountProfile, accountSession } from "./pi";

export function AccountProfileOnboarding({
  profile,
  csrf,
  onSaved,
  onLogin,
  onSkip,
}: {
  profile: AccountProfile;
  csrf?: string;
  onSaved: (profile: AccountProfile) => void;
  onLogin: () => void;
  onSkip?: () => void;
}) {
  const t = useText(accountProfileOnboardingText);
  const [name, setName] = useState(profile.name);
  const [email, setEmail] = useState(profile.email);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!csrf || pending) return;
    setPending(true);
    setError(false);
    try {
      const response = await mutationFetch("account.profile", "/auth/profile", {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
          "X-Agent-Host-CSRF": csrf,
        },
        body: JSON.stringify({ name: name.trim(), email: email.trim() }),
      });
      if (response.status === 401) {
        onLogin();
        return;
      }
      if (!response.ok) throw new Error("profile unavailable");
      const current = await accountSession();
      if (current === "login") {
        onLogin();
        return;
      }
      onSaved(current.profile);
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }
  return (
    <OnboardingFrame step="github">
      <main className="ah-account-onboarding">
        <h1>{t.title}</h1>
        <p>{t.intro}</p>
        <form
          onSubmit={(event) => {
            void submit(event);
          }}
        >
          {!profile.name && (
            <label>
              {t.name}{" "}
              <input
                required
                maxLength={200}
                data-testid="profile-name"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
            </label>
          )}
          {!profile.email && (
            <label>
              {t.email}{" "}
              <input
                required
                type="email"
                maxLength={254}
                data-testid="profile-email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
            </label>
          )}
          {error && <p role="alert">{t.saveFailed}</p>}
          <ControlButton
            size="page"
            type="submit"
            data-testid="profile-submit"
            variant="primary"
            isDisabled={pending || !csrf}
          >
            {pending ? t.saving : t.continue}
          </ControlButton>
          {onSkip && (
            <Button
              size="page"
              data-testid="profile-skip"
              label={t.skip}
              variant="secondary"
              onPress={onSkip}
            />
          )}
        </form>
      </main>
    </OnboardingFrame>
  );
}
