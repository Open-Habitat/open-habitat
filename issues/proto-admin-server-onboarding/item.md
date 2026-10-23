---
created: 2026-10-23
updated: 2026-10-23
type: task
reporter: jari
status: in-progress
priority: normal
related: ['@proto-site-onboarding-and-invites']
preparation: pending
lane: proto-admin-server-onboarding
lane_seq: 1
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

## Prototype review

[Recommendation, alternatives and evidence](result.md). Round 3 (AI account only, section Kierros 3 · AI-tili): [published review](https://glasspad.example.test/p/2vk2gkcroprzixhgitdlsu7dz4/), recommendation Avain erikseen; where a site-provided API key lives and how it reaches each Unix user stays open in `plan-site-onboarding-authority`. Round 2: https://glasspad.example.test/p/2pbl3lkzsqwha4igun24xp52au/ (Jari chose Lista reittinä); round 1: https://glasspad.example.test/p/ai2t44d56dtch24msa4e636xgm/. Awaiting Jari's choice and answers to the round-3 questions; no production changes.

## Decisions

### 2026-10-23T16:01:05Z · @jari

Jari 2026-10-23 on r1: Vaihelista is the best direction; riff a round 2 from it. Feedback: the step order is fixed (not adjustable). Repositories: no stale-filter setting ('hide repositories updated more than N days ago' is not offered as configuration); the repository start mode (auto-checkout vs pre-selected) is good; there can be several default repositories. Integrations: the admin adds one or more integrations, and each one appears as its own step in the effect preview ('vaikutukset'). AI account: the admin chooses which option is offered as the default.

### 2026-10-23T16:37:39Z · @jari

Jari 2026-10-23 on r2: 'Lista reittinä' (direction 2) is the best; the overall look is settled — no more riffing on it; next riff the individual views one at a time. Repositories: in the skip mode the admin can still choose one or more default repositories, imported automatically when the person has access to them. AI account: options also include an Anthropic API key and a DeepSeek API key; the admin may provide the API key in advance so the AI step is not shown at all; when a default is set only that one option is offered, with '› Käytä muuta AI-palvelua' at the bottom revealing the others. Integrations: very good and clear as is. Access page: there are no invitations on this side — only the list of allowed GitHub usernames.

### 2026-10-23T17:00:35Z · @jari

Jari 2026-10-23 on r3 (AI account): 'Kolme tapaa' is the right direction. A site key bills whichever account the API key belongs to. Already-joined people are not changed; the CLI exists for finer administrative actions like that. Add Anthropic and DeepSeek API key support to the product. The 'what the person sees' part is unclear: riff a proper preview for it. The person's AI step itself (screenshot r3-jari-ai-step.png) has many things wrong and misaligned: right-floating status and buttons, inconsistent headings, repo clone card inside the step, long stacked key rows — riff that view too.

### 2026-10-23T17:01:08Z · @jari

Jari 2026-10-23: onboarding configuration gets its own Settings tab, not the generic 'Palvelin' tab. Access (allowed GitHub usernames) is also its own tab — perhaps the same one that holds the other user matters.
