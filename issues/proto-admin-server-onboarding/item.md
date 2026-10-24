---
created: 2026-10-23
updated: 2026-10-24
type: task
reporter: jari
status: done
priority: normal
related: ['@proto-site-onboarding-and-invites']
preparation: pending
lane: proto-admin-server-onboarding
lane_seq: 1
closed: 2026-10-24
closed_by: worker
---

# Prototype: Settings › Palvelin — configure onboarding and invite people

## Description

Jari 2026-10-23 (see `proto-site-onboarding-and-invites`, the parent request): The administrator in Settings › Palvelin: configure the onboarding steps and defaults, and invite people (GitHub username → invitation; pending/accepted; revoke). Show what each change means for a new person.

Shared vocabulary for all three units (keep it consistent; it is a design assumption, not a decision): a site may define an onboarding with ordered steps — GitHub sign-in (always), repositories (default repositories: auto-checkout or pre-selected; staleness filter in days; or skip), integrations (e.g. Google; required/optional/off), AI account — plus who may join (admitted GitHub users, invitations). Use these names: `onboarding.steps`, `onboarding.repositories.defaults`, `onboarding.repositories.stale_after_days`, `onboarding.integrations`, `invitations`.

Prototype/plan only; production unchanged until Jari chooses.

## Acceptance Criteria

- [x] Published for review with a Finnish summary, recommendation and the question for Jari.
- [x] Round 2 from Vaihelista with Jari's 2026-10-23 feedback (see Decisions), published to a new page with the PICKER.md tablet, Finnish summary, recommendation and open questions.
- [x] Round 3: the AI-account view of 'Lista reittinä' alone (per Jari's r2 decisions), published for review.
- [x] Round 4: the preview of what the new person sees and the person's AI step itself (per Jari's r3 feedback), with Käyttöönotto and Käyttäjät ja pääsy as their own Settings tabs, published for review.
- [x] Round 5: the repositories step only (start mode with default repositories, production RepoFinder and GitHubRepoChooser, the settled preview mode), with a proposal for defaults the person cannot read, published for review.
- [x] Round 6: the Käyttäjät ja pääsy tab (allowed GitHub usernames and the user list, no invitations) and, carried over from r5, locked forced selections in the person's chooser in automatic checkout, published for review with the actions that need the root broker marked.

## Prototype review

[Recommendation, alternatives and evidence](result.md). Round 6 (Käyttäjät ja pääsy, section Kierros 6 · Käyttäjät ja pääsy): [published review](https://glasspad.example.test/p/c32hkvhffsk4biofnunhrmewdy/), recommendation Yksi lista: one row per person whose state shows allowed / joined / access removed; every admission change is shown as waiting for the server; removing a joined person keeps their Unix account (CLI removes it); the r5 carry-over proposes a `locked` prop for `GitHubRepoChooser`. Round 5 (repositories only, section Kierros 5 · Repot): [published review](https://glasspad.example.test/p/eiccjybwfpgcnjub7agb56t5kq/), recommendation Tapa ja lista with the fetched repositories named on the route; a default the person cannot read is left out without showing its name and reported to the administrator. Round 4 (preview and the person's AI step, section Kierros 4 · Esikatselu ja AI-vaihe): [published review](https://glasspad.example.test/p/lpjcp6fbpdferog7plpctqvqj4/), recommendation Ikkuna vieressä with the step layout Ehdotus ja lista and clone progress on the route. Round 3 (AI account only, section Kierros 3 · AI-tili): [published review](https://glasspad.example.test/p/2vk2gkcroprzixhgitdlsu7dz4/), recommendation Avain erikseen; where a site-provided API key lives and how it reaches each Unix user stays open in `plan-site-onboarding-authority`. Round 2: https://glasspad.example.test/p/2pbl3lkzsqwha4igun24xp52au/ (Jari chose Lista reittinä); round 1: https://glasspad.example.test/p/ai2t44d56dtch24msa4e636xgm/. Awaiting Jari's choice and answers to the round-6 questions; no production changes.

## Decisions

### 2026-10-23T16:01:05Z · @jari

Jari 2026-10-23 on r1: Vaihelista is the best direction; riff a round 2 from it. Feedback: the step order is fixed (not adjustable). Repositories: no stale-filter setting ('hide repositories updated more than N days ago' is not offered as configuration); the repository start mode (auto-checkout vs pre-selected) is good; there can be several default repositories. Integrations: the admin adds one or more integrations, and each one appears as its own step in the effect preview ('vaikutukset'). AI account: the admin chooses which option is offered as the default.

### 2026-10-23T16:37:39Z · @jari

Jari 2026-10-23 on r2: 'Lista reittinä' (direction 2) is the best; the overall look is settled — no more riffing on it; next riff the individual views one at a time. Repositories: in the skip mode the admin can still choose one or more default repositories, imported automatically when the person has access to them. AI account: options also include an Anthropic API key and a DeepSeek API key; the admin may provide the API key in advance so the AI step is not shown at all; when a default is set only that one option is offered, with '› Käytä muuta AI-palvelua' at the bottom revealing the others. Integrations: very good and clear as is. Access page: there are no invitations on this side — only the list of allowed GitHub usernames.

### 2026-10-23T17:00:35Z · @jari

Jari 2026-10-23 on r3 (AI account): 'Kolme tapaa' is the right direction. A site key bills whichever account the API key belongs to. Already-joined people are not changed; the CLI exists for finer administrative actions like that. Add Anthropic and DeepSeek API key support to the product. The 'what the person sees' part is unclear: riff a proper preview for it. The person's AI step itself (screenshot r3-jari-ai-step.png) has many things wrong and misaligned: right-floating status and buttons, inconsistent headings, repo clone card inside the step, long stacked key rows — riff that view too.

### 2026-10-23T17:01:08Z · @jari

Jari 2026-10-23: onboarding configuration gets its own Settings tab, not the generic 'Palvelin' tab. Access (allowed GitHub usernames) is also its own tab — perhaps the same one that holds the other user matters.

### 2026-10-23T17:46:33Z · @jari

Jari 2026-10-23 on r4: the person's view is shown through the preview mode of direction 2 ('Esikatselutila' — 'Näytä henkilön näkymä' opens a full preview with the settings in a side panel); a permanent side window takes too much space. Repository clone progress during the AI step shows on the route's Repot row. Allowed GitHub usernames and the user list share the 'Käyttäjät ja pääsy' tab. The names 'ChatGPT-tilaus' and 'Claude-tilaus' are fine. Jari did not object to the recommended AI-step layout 'Ehdotus ja lista'; the conductor takes it as the layout (to confirm in the next round).

### 2026-10-23T17:58:08Z · @jari

Jari 2026-10-23 confirmed: the person's AI step uses 'Ehdotus ja lista' (r4 direction 1's step layout) inside the preview mode.

### 2026-10-24T04:21:22Z · @jari

Jari 2026-10-24 on r5 (repositories): 'Tapa ja lista' with names on the route is the form. A default repo the person cannot access is silently left out and only the admin sees it — e.g. team-workspace and management-workspace as defaults, the latter appearing only for people with access. In automatic checkout the already-fetching defaults stay visible in the chooser as locked 'forced selections' (requires a new chooser state). Skip mode with no defaults: the step is skipped and the Repot row disappears from the route.

### 2026-10-24T04:55:22Z · @jari

Jari 2026-10-24 on r6 (Käyttäjät ja pääsy): 'Yksi lista'. The shared rules all hold (browser requests, server confirms; GitHub check before adding; duplicates under the field; removal ends sign-in and sessions while the Unix account and files stay, row stays as 'Pääsy poistettu', account deletion via CLI; admins not removable in the browser). A restored person returns to the same Unix account. Show the numeric GitHub id when adding. Locked forced selections and the proposed 'locked' prop are fine. Fix: the GitHub usernames in the list are far too large.

## Resolution

### 2026-10-24T05:16:58Z · @worker

Rounds 1–6 accepted as the UI specification of the ADR 0030 implementation issues; each names the round it implements.
