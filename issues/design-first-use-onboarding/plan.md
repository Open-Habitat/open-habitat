# First-use onboarding: GitHub, repositories, OpenAI

After signing in with GitHub, a new user chooses repositories to bring into
`~/src`, then connects their ChatGPT subscription through Pi. They can do this
entirely in the browser. GitHub provides repository access; Pi provides agent
credentials. Each native tool owns its credentials under the user's Unix account.

## The agreed journey

The repository screen shows the user's checkoutable GitHub repositories. All
are visible by default, with a time filter the user can turn on. Jari confirmed
on 30 September that this is already agreed with the designer for **browser
design v2**. The delivered handoff and HTML start with the monthly filter on;
that default does not govern implementation. The current catalog supplies last
push time (`pushed_at`), so a filter using it should say what time it measures.
Repositories without a known time and selected repositories stay visible.

One Continue action checks out the selected repositories and shows progress.
Confirmed success advances to OpenAI sign-in; choosing none advances without a
checkout. Native `gh`, Git and the filesystem determine access and results.
An already-present matching checkout does not need to be cloned again.

For OpenAI sign-in, the user's daemon starts Pi's native device-code operation.
The browser shows the verification link, user code and progress; the user
confirms on the provider's page. Pi handles token exchange, storage and refresh.
Only a native status check confirming usable credentials opens normal
workspaces, histories and agent control. API keys and other login methods are
later work.

The [v2 onboarding draft](https://github.com/maintainer/native-agent-host/blob/0d1a53160772be64daa00879536c8103bbd3d0e1/design-system/drafts/v2/vedokset/Onboarding%20v2.dc.html)
is the visual reference for the shared frame, step indicator, repository list,
code presentation and interruption confirmation. The
[design assessment](../review-browser-design-v2/assessment.md) relates it to the
production components and shared styling. Phone variants are reference material;
mobile implementation scope remains a separate decision.

## Returning and recovering

A returning user with usable Pi credentials goes straight to workspaces,
including when `~/src` is empty. There is no permanent host onboarding-complete
record: current native state determines what can open. The existing browser
flow also remembers reaching the Pi step within the same web session, so a
reload need not repeat repository selection.

The root directory is prepared during provisioning. An absent, unreadable or
unsafe directory is a setup problem, not a successful empty workspace list.
Browser login alone does not prove native GitHub access; repository operations
need verified native authorization. Missing Pi credentials lead to sign-in;
an unavailable status needs a check/retry explanation, not a claim that the
user is disconnected. Normal native data remains protected by the Pi gate.

A lost checkout reply may follow a successful write. Read-only observation can
confirm the checkout, establish that it is absent, or find a conflict or partial
directory. If the result still cannot be established, show that uncertainty
and offer another check. Explain which repositories succeeded. Another clone
requires a user action and current native evidence that it is safe; losing a
browser connection neither cancels a clone nor makes automatic retry safe.
This behavior remains necessary when adapting the draft's success/error states.

A delayed device code is still being prepared, not a login error. If the daemon
or attempt stops, check Pi's native state before offering a new attempt. Neither
a notification nor returning from the provider's tab proves completion.
Changing web identity clears the previous user's onboarding state. Independent
terminal Pi login/logout during web onboarding is outside the agreed first
version, so no additional cross-process credential protocol is required.

Web logout ends browser access without deleting workspaces or native credentials.
Native disconnect controls belong to account settings, and Unix-account removal
is a separate concern. The [account-settings issue](../add-account-settings-ui/item.md)
owns those controls and the [account-display decision](../decide-account-display/item.md)
owns first-name/email presentation.

## Existing implementation and ownership

The source check for this rewrite used `770f46a` (30 September 2026):

| Area | Source and work owner |
| --- | --- |
| Pi-native login, status and process lifecycle | [Adapter result](../add-pi-device-adapter/result.md) |
| Server-side Pi access gate and direct-route protection | [Gate result](../gate-native-routes-on-pi/result.md) |
| First-use directory | [Provisioning issue](../provision-first-src/item.md) |
| Repository catalog, selection, checkout and observation | [Repository onboarding](../github-repos-first-onboarding/item.md), `web/src/app/GitHubOnboarding.tsx` |
| Browser Pi instructions, polling and recovery | `web/src/app/PiOnboarding.tsx`, composed through `web/src/app/App.tsx` |
| Current routes and generated wire contracts | [Interfaces](../../docs/interfaces.md), [v1 schemas](../../contracts/v1/) |
| V2 onboarding composition | [This issue](item.md), coordinated with the [UI assessment](../review-browser-design-v2/item.md) |

These components already exist; the remaining work is to complete and verify
the journey and its v2 presentation. Shared visual improvements and work division
follow the design assessment and the live issue DAG. This plan does not create
a second implementation queue.

## What the evidence establishes

The repository-onboarding result records synthetic browser coverage. Its issue
also records a pilot.10 live checkout confirmed by native Git/origin/ownership
readback. The [checkout-observation issue](../observe-pre-pi-checkout/item.md)
records a separate-kernel-UID fixture. The native Pi gate has its own synthetic
and UID results. These reports describe particular revisions and do not prove
the current installed journey or acceptance of v2 visuals.

[TESTING.md](../../TESTING.md) defines the checks appropriate to implementation
changes. [Live Pi verification](../verify-live-pi-journey/item.md) tracks current
provider and installed-host checks; Fleetrepo keeps concrete installation and
recovery receipts. Earlier live observations remain evidence for what they
actually exercised, not a substitute for verifying later changes.
