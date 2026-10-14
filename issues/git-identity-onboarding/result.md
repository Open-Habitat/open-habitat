# Git identity onboarding result

The per-user daemon reads and writes global Git config through native `git config --global`, with no second store. GitHub's authenticated `/user` provides the profile name and login; `/user/emails` contributes verified choices only when available. The always-available default is the GitHub numeric-ID noreply address. A missing or malformed profile name falls back to login; a missing verified-email permission leaves only the noreply choice.

The confirmation appears after the connected GitHub repository catalog is loaded and before repository selection. Existing global values appear read-only in onboarding, even if only one of the two keys exists; only an explicit account-settings edit can replace them. A failed write is not automatically retried: the user should reread native Git config before trying again, because either command may already have completed. Settings accepts a manually entered address; the verified-email restriction applies to the initial GitHub-based suggestion, not to a later explicit edit.

The browser fixture uses a disposable HOME and a synthetic GitHub profile. `github-first-onboarding.spec.ts` confirms the noreply choice in a real browser journey; the daemon test checks the native config values, refusal to overwrite, and an explicit settings edit.
