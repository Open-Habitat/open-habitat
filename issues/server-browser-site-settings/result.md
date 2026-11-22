# Result

The experimental server browser now seeds real-site defaults in its own native
Chrome profile, once. Previously it seeded only session restore and welcome
state; no site permissions or download destination were configured.

The seed allows JavaScript, pop-ups and multiple downloads, leaves third-party
cookies available in the regular profile, opens PDFs in Chrome, blocks site
notifications, and turns off password-saving prompts and automatic sign-in.
Existing saved passwords are not deleted and may still autofill. Camera,
microphone, location, certificate checks, Safe Browsing, sandboxing and site
isolation retain Chrome's behavior. Chrome Sync is disabled for this launch.

No host-wide policy is installed. Linux Chrome does not read enterprise policy
JSON from `--user-data-dir`; its policy directories are system-level. Native
Preferences are the appropriate per-person mechanism here. Upstream references
checked on 2026-11-22: Chromium's “Configuring Other Preferences”,
`components/content_settings/core/common/pref_names.h`,
`components/content_settings/core/browser/content_settings_registry.cc`,
`content_settings_default_provider.cc`, `cookie_settings.h`,
`components/password_manager/core/common/password_manager_pref_names.h` and
`components/sync/base/command_line_switches.cc`.

## Decisions for later review

- **Allow pop-ups and multiple downloads globally in this dedicated browser.**
  Alternative: a site allowlist or only gesture-triggered windows. The task
  requires real-service workflows, including deferred windows and batch exports;
  an allowlist would require ongoing domain maintenance. This also permits
  nuisance windows and unsolicited multiple downloads on visited sites.
- **Seed once, not force settings at every start.** Existing explicit settings
  and site exceptions win. Already-used profiles receive missing values once;
  an absent value cannot distinguish a pre-adoption reset from an untouched
  default. Thereafter a native-file marker protects even resets that Chrome
  represents by removing keys. No separate settings database or migration store.
- **Keep downloads beside the browser profile**, initially
  `~/.local/share/open-habitat/browser/profile/Downloads` (0700). Alternatives:
  the general Downloads folder or a workspace-specific folder. One dedicated
  destination avoids ambiguity when multiple workspaces share one browser.
  Chrome's Downloads page exposes files to the person; the bundled agent guide
  names the destination and tells agents to check the current native setting.
  `browserhost.DefaultDownloadDirectory(profile)` exports this default for the
  agent-tools worker; it is not a claim about a user-changed current destination.
- **Permit normal-profile third-party cookies; retain PDF viewing.** Alternatives:
  blanket cookie blocking or forcing every PDF to download. Prefer normal
  sign-in compatibility and on-screen document reading; an agent can save the
  particular document needed. This is not evidence that every provider works.
- **Block notifications and disable password saving/automatic sign-in by default.**
  Alternatives: native prompts and automatic credential capture. A remote browser
  without a desktop keyring should not silently accumulate another password
  store. Existing choices and saved data remain untouched.
- **Disable Chrome Sync for this launch.** Alternative: permit account sync.
  Server-specific permission defaults should not propagate to personal browsers;
  the browser remains local even if the person signs into a Google website.
- **Refuse malformed/unwritable preferences rather than silently resetting them.**
  Alternative: let Chrome rename malformed data and recover to factory settings.
  Preserve the person's settings for manual recovery rather than discard their
  restrictions. Atomic replacement syncs the new file first; this is not a full
  power-loss durability claim.

## Verification

Final runnable changes based on `763d97b73cd478fb993340d0c78d4f00d86212b5`:

- `./scripts/test-focused.sh --area go --go-package ./internal/browserhost` — pass.
  Tests cover existing settings/exception preservation, exact large-number
  preservation, one-time initialization after native-default reset, refusal of
  malformed/symlink/special files, private modes and launch safety.
- `./scripts/test-focused.sh --area go --go-package ./internal/daemon` — pass.
- `./scripts/test-focused.sh --area contracts` — pass, generated output unchanged.
- `issuectl doctor --json`, `python3 scripts/validate-project-view.py` and
  `git diff --check` — pass.
- `TestPreferencesNativeSites`, opt-in with `OH_SITE_SETTINGS_CHROME` — pass on
  sandboxed Google Chrome 158.0.8127.36, Linux amd64, headless. Local HTTP fixture
  opens a window without a gesture and triggers two Blob downloads. Negative
  control blocks the window and completes exactly one file; seeded profile
  opens the window and completes both with matching contents. JavaScript runs,
  notifications are denied. Graceful Chrome close preserves the marker and the
  next preparation leaves native Preferences byte-for-byte unchanged.
- Every native run had an outer timeout and disposable synthetic profile under
  the scratch lease. No Playwright launch flags or CDP download/permission
  overrides could mask preference behavior. The local cached Chromium initially
  failed with “No usable sandbox”; the required test was rerun successfully on
  a sandbox-capable Linux host, without disabling the sandbox or changing host
  services. Evidence: `/var/tmp/agent-keep/server-browser-site-settings/native-final.log`.
- Targeted critical `/llm-review`: finder `claude-fable-5-2`, verifier
  `gpt-6-astra`, two calls, followed by `/assess-findings`. One confirmed defect
  (repeated initialization reversing a native-default reset) fixed and retested.
  Corrupt-profile recovery was retained as the explicit fail-closed choice;
  possible sync propagation was not reproduced, and Sync is disabled by choice.
  No outstanding confirmed findings. Review and assessment are local `history/`
  artifacts; no follow-up issues filed. No performance-log push in this worker.

Not claimed: real-provider sign-in, cross-site cookie journeys, PDF viewer UI,
Xvnc rendering, distinct-UID isolation, deployment or a whole browser suite.
Runtime installation belongs to the separate runtime issue and was not changed.

## Live check

After deployment, restart the experimental server browser. On a synthetic local
page, open a pop-up and trigger two downloads together. Both files should appear
in Chrome's Downloads page and in the initial directory above unless a prior
native setting selected another destination. Change pop-ups to blocked in
Chrome settings, stop/start the browser and check that the restriction stays.
Try a normal PDF and the intended provider's sign-in separately; those live
journeys remain manual acceptance, not claims of the local fixture.
