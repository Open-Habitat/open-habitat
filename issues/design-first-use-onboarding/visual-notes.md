# First-use visual pass (synthetic lab, 2026-09-29)

Not yet reviewed by Jari. These screenshots use invented accounts, repositories, a fake GitHub provider and fake Pi device code, **not** a live account or production-host proof.

- `onboarding-before-chooser.png` / `onboarding-after-chooser.png`: 52 repos made the original page almost 5,000 px tall and hid the count and Continue action. The list now has its own bounded scroll region, while selection and Continue stay in view. The complete catalog remains in the DOM and filterable; no partial-page selection. Desktop 1440×900; narrow 390×844 also inspected locally.
- `onboarding-before-pi.png` / `onboarding-after-device-narrow.png`: the former start state called the task a Pi login and used “workspacet”; current device state names ChatGPT, shows the allowlisted OpenAI link and copyable fake code and explicitly waits for confirmation. The new-code and interrupted cases remain cautious about an unknown result.
- `onboarding-after-settings.png`: the synthetic host reports GitHub status unknown; the page says so rather than implying a working connection. The previous disabled disconnect control was not an available action; settings now explains that this action is not available here, separately from browser sign-out.

The login page and sign-out menu were also exercised in the lab. No changes to OAuth, native clone progress protocol, real provider sign-in, or GitHub disconnect capability are implied by these images. The current checkout indicator identifies the repository being processed and explains that the completed count only changes after verification; it does **not** claim byte-level or stage progress. That native stream remains in `@show-large-clone-progress`.
