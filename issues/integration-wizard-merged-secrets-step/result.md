# Result: console step and its values side by side, a direct link on every step

Implemented direction *Rinnakkain* from `issues/proto-google-wizard-secrets-step/`
in `web/src/components/ServerIntegrations.tsx` (`AppSetupDialog`).

| Provider | Before | Now | Last step |
| --- | --- | --- | --- |
| Google | 5 | 4 | *Asiakas ja tunnukset*: Create Client on the left, Client ID and secret on the right |
| Microsoft 365 (and its levels) | 5 | 4 | *Hyväksyntä ja tunnukset*: admin consent on the left, the two Overview ids and the filled consent link on the right |
| Dropbox (and App folder level) | 4 | 3 | *Asetukset ja tunnukset*: order is now Luo sovellus → Käyttöoikeudet → Asetukset, so the guide ends on the Settings page that shows App key and secret |

On the last step the dialog widens to 920 px; the console side (*Google
Cloudissa*, *Microsoft Entrassa*, *Dropbox App Consolessa*) is on the left and
a sunken *Tähän* panel with the fields on the right. When the step body is
narrower than 640 px (a phone), the panel goes below the instructions.
*Minulla on jo …* opens only the fields with where the values are; *Takaisin*
returns to the start of the guide. *Vaihda tunnukset…* is still one step.

Screenshots (device scale factor 2, desktop 1280 and phone 390, light and
dark) are in `shots/`: `*-client-*`, `*-consent-*`, `*-settings-*` are the
merged steps (`-end` is the phone view scrolled to the bottom),
`microsoft-consent-filled-*` shows the filled consent link,
`google-scopes-*` a step with its console link, `google-existing-*` *Minulla
on jo asiakas*, `google-client-empty-save-desktop-light` an empty save refused
in its fields.

## Console links

Every step's first console path carries *Avaa sivu*, a direct link to that
page (the first steps keep their existing descriptive links). Checked against
how the consoles' own documentation and projects link them (Google Workspace
and Identity docs, GoogleCloudPlatform and Supabase docs for clients/create,
Microsoft's own repositories for CreateApplicationBlade):

| Step | Link |
| --- | --- |
| Google API:t | `console.cloud.google.com/apis/enableflow?apiid=…` (unchanged) |
| Google Kohdeyleisö | `console.cloud.google.com/auth/branding` |
| Google Käyttöoikeudet | `console.cloud.google.com/auth/scopes` |
| Google Asiakas ja tunnukset | `console.cloud.google.com/auth/clients/create` |
| Google Minulla on jo asiakas | `console.cloud.google.com/auth/clients` (generic: the client's page needs its id) |
| Google Vaihda tunnukset | `console.cloud.google.com/auth/clients/<client id>` (the id is known) |
| Microsoft Rekisteröi sovellus | `entra.microsoft.com/#view/Microsoft_AAD_RegisteredApps/CreateApplicationBlade/quickStartType~/null/isMSAApp~/false` |
| Microsoft steps 2–4, Minulla on jo sovellus | App registrations list, with *Valitse sovellus &lt;nimi&gt;* (generic: the app's pages need its Application ID) |
| Dropbox Luo sovellus | `www.dropbox.com/developers/apps/create` (unchanged) |
| Dropbox steps 2–3, Minulla on jo sovellus | `www.dropbox.com/developers/apps`, with *Valitse sovellus ja välilehti …* (generic: the app's page needs its App key) |

## Decisions for later review

1. **Generic links where the page needs an id the guide does not yet have.**
   Entra's app pages need the Application ID and Dropbox's the App key, which
   the guide only learns on its last step. Alternatives: ask for the id
   earlier (would split the values again), or switch to deep links once the
   id is typed (only possible on the last step). Chosen: the list page plus
   a short *Valitse sovellus …* line.
2. **Google links carry no project.** They open the project last selected in
   the console, as the existing enable link does. The alternative is asking
   for the project id, a field that nothing else needs.
3. **Microsoft's first step links straight to New registration** instead of
   the App registrations list, and the search hint stays for later steps.
4. **The prototype's decisions 1–5 are taken as they were** (one rule for all
   three providers, Dropbox order, consent link filled from the typed ids
   with a copy button once both are valid, *Minulla on jo …* shows only the
   fields, the step titles). The reworded once-only warning sits under the
   Google fields and also shows in *Minulla on jo asiakas* and *Vaihda
   tunnukset…*, where a new secret is likewise shown only once.
5. **Stacking follows the step's width (640 px container), not the window**,
   so a narrow desktop window stacks too.
6. **Uniform `si-console-link` test id** replaces `si-enable-link`,
   `si-entra-link` and `si-dropbox-link`; the unit test checks every step of
   all three guides links to its console over https.

## Checks

- `./scripts/test-focused.sh --area web`: 131 files, 841 tests passed.
- `OH_PORT_BASE=5400 OH_BROWSER_WORKERS=2 ./scripts/test-focused.sh --area
  browser --spec server-integrations.spec.ts`: 4 passed (Google walk and
  save on the merged step, side-by-side on desktop and stacked on a phone
  with no overflow and axe clean, Microsoft and Dropbox walks).
- Review: focused self-review; the change is browser-only (no daemon,
  contract, session state or authority path).
