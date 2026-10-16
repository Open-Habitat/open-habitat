# Result: Asetukset, palvelimen ylläpito and API keys

Round: `design-system/prototypes/rounds/2026-10-15-asetukset/` (the unfinished
round from 15.10, finished here rather than started again).
Build: `node build.mjs rounds/2026-10-15-asetukset` in `design-system/prototypes/`
gives `dist/2026-10-15-asetukset.html` (three directions, keys 1–3).
Architecture sketch: `issues/provider-api-keys/architecture.md`.

## Axis and directions

Axis: **how settings and server administration are organised**. The content is
the same in all three: account and sign-out, Git identity, GitHub and Pi
connections, the OpenAI API key, which credential new conversations use, Pi's
default model, agent work default, theme and own storage. Administrators also
get server name and version, users with role and per-user storage limits, disk
capacity and the default limit. The account menu's Asetukset and Palvelimen
ylläpito open the view, and a conversation row in the sidebar leads back.

| # | Direction | What it decides | When it is right | Its cost |
|---|---|---|---|---|
| 1 | Yksi sivu | Everything on one scrolling page with a section list beside it; administration is a second heading on the same page, and the menu item scrolls to it | Few settings, used rarely; everything is findable with the browser's search | Long page; on a phone there is no section list, so administration sits at the bottom |
| 2 | Osiot | Section list and one section at a time, as in OS settings; administration is its own group in the same list | The settings grow (more providers, more harnesses) | One more click per section; on a phone the list and the section are separate screens with a back button |
| 3 | Kaksi näkymää | Own settings as one compact page; administration is a separate dashboard with disk, users and default-limit tiles above the user table | Administration and personal settings are different jobs for different moments | Two places to learn; the dashboard tiles only pay off with more users |

Changes from the current production views (seen in the synthetic lab): one row
pattern (label and explanation on the left, value and action on the right,
editing inline below) replaces the mix of open forms, panels and lists. Git
identity is shown, not kept open as a form. Administration shows usage bars and
a users table instead of bare lists. Leaving actions (sign-out, detaching GitHub,
removing the key) are confirmed in a dialog that says what is removed and what
stays.

## Host facts the view assumes

Existing facts: `GET/POST /api/v1/account/git-identity` (`~/.gitconfig`);
native `gh` state and `NativeDisconnect` (the OAuth grant at GitHub is not
revoked); Pi status `usable/missing/unknown` and the device login; Pi models
and default via `/api/v1/pi/models`; own quota `/api/v1/account/storage`;
administration name, default limit, bound users and roles
(`/api/v1/server/administration`); per-user quotas, capacity, free space and
overcommit (`/api/v1/server/storage`). The server version comes from the
account menu's existing server info.

New, all from `provider-api-keys`: whether an `openai` API key is present
(presence only, never the key), adding, replacing and removing it, the
`{provider, model}` default selection, and a readiness check that accepts
either credential. The architecture sketch describes these.

Not assumed: the user's last-seen time, the users' names beyond GitHub login
and display name, and any per-key metadata. The fixture's display names are
synthetic.

## Verification

`node check.mjs dist/2026-10-15-asetukset.html` from the repository root:
all three directions in light, dark and phone, console clean. Click paths with
`--click` per direction, desktop dark and phone: account menu → Palvelimen
ylläpito → user limit editor; account menu → Asetukset → key editor → invalid
save (field error) → sign-out dialog; in Osiot, section navigation and the
GitHub detach dialog. A scripted Playwright flow (scratch, not committed) ran
in each direction on desktop and phone. It checked that a `!command` value is
refused, a valid key is saved and absent from the DOM, the default moves to
`openai/…` and back, the theme switches, the key is removed through the dialog,
a user limit and role are saved, the admin path works through the menu and a
conversation row returns to the conversation. No console errors. A first
check.mjs run once timed out on a screenshot under load and passed on rerun.

## Questions for Jari

1. Which direction? The rest of the content is the same in all three.
2. Should the key show `sk-…abcd`, or is presence enough? The suffix means the
   daemon reads the key back (see the sketch).
3. The credential for new conversations is a two-way switch next to the default
   model. Is this the right place, or should the model list itself show both
   providers' models in groups?
4. Accept the architecture sketch's proposal (key as Pi's own `auth.json`
   entry, written by the daemon as the user, no host store)? It is a proposal,
   not an ADR.

## Decisions for later review

- Finished the existing round directory instead of a new `2026-10-16-*` one,
  since the brief allowed it and the directions were already set.
- API key shown by presence only ("Avain tallennettu"), no suffix, following
  the conductor's recommendation in `provider-api-keys`.
- "Which credential" is modelled as Pi's default provider (`openai-codex` vs
  `openai`), not as a separate host setting, because Pi has no other place for
  it; the prototype keeps the same model id when switching.
- The browser prototype accepts only `sk-[A-Za-z0-9_-]{20,}` because Pi runs a
  stored value starting with `!` and expands `$NAME`.
- In Yksi sivu and Osiot the top bar stays "Asetukset" when opened from
  Palvelimen ylläpito (administration is part of that view); only Kaksi näkymää
  titles it separately.
- Sign-out, GitHub detach and key removal use one shared confirmation dialog in
  the round (`.confirm` from `lib/app.css`, plus a round-local danger button,
  since `composer.css`'s `button.danger` is not loaded with `composer = false`).
  Library proposal: move a `button.danger` rule to `lib/app.css` next to
  `.confirm`.
- Round-local layout override: `.frame` gets `container-name: frame` so the
  round's phone rules query the frame, and the main column is its own
  container for the users table. Library proposal: name the frame container in
  `lib/chrome.css`.
- Review level for the sketch: one targeted independent review (`/llm-review`,
  GPT-6 Astra finder, Claude Fable 5.1 verifier), because it touches
  credentials and the Unix-user boundary. Two must-fix gaps were confirmed and
  folded in: the subscription-only readiness gate and id-only model selection.
  The prototype HTML/JS got a focused self-review only (synthetic content). The
  model-performance log entry could not be written (SSH to alder from alder is
  refused, the known `assess-models-alder-self-ssh` issue).
