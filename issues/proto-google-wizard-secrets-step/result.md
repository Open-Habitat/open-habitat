# Result: console step and its values on one screen

Prototype: `issues/proto-google-wizard-secrets-step/prototype/index.html`
(hand-written, offline, built from
`design-system/prototypes/rounds/2026-10-28-google-tunnukset/`). Jari's guide
is in [NOTES.md](NOTES.md). The baseline is in `baseline/`: the production
guide walked in the synthetic lab with `web/lab/capture-google-wizard-baseline.mjs`.
Prototype screenshots are in `shots/`, both at device scale factor 2.

## What every direction changes

The separate last step **Tunnukset** goes away. Its fields move into the
step whose console page shows the values, and **Tallenna** replaces
**Seuraava** there. The same rule applies to all three guided providers:

| Provider | Now | Directions | Last step |
| --- | --- | --- | --- |
| Google | 5 steps | 4 | *Asiakas ja tunnukset*: Create Client, then the *OAuth client created* window's Client ID and Client secret |
| Microsoft 365 | 5 | 4 | *Hyväksyntä ja tunnukset*: admin consent, then Overview's two IDs. The *Jos rooli puuttuu* consent link fills from the typed values |
| Dropbox | 4 | 3 | *Asetukset ja tunnukset*: Käyttöoikeudet now comes before Asetukset, so the guide ends on the Settings page, which holds both the redirect and App key/App secret |

The steps before the last one are production's, word for word. The secret
warning now sits under the Client secret field and is reworded: *Google
näyttää salaisuuden vain tässä ikkunassa. Liitä se ennen kuin suljet
ikkunan.*

## Axis and directions

Axis: **how the console's instructions and the fields share the merged step.**

| # | Direction | What it decides | When it wins | Its cost |
| --- | --- | --- | --- | --- |
| 1 | Perään | The production step unchanged, then a rule, a heading naming the console moment (*Google näyttää ikkunan OAuth client created*) and the fields | It changes the least, keeps the dialog width and the Path/Val language of steps 1–3, and reads the same on the phone | The link between *Create* and the fields is only the heading, so the step is longer than before |
| 2 | Rinnakkain | *Google Cloudissa* on the left, a sunken *Tähän* panel with the fields on the right. The dialog widens to 920 px on this step | Shows clearly what is done there and what comes back here, and the fields stay visible while the reader is in the console | The dialog changes width mid-guide. On the phone it collapses to direction 1 with a box around the fields |
| 3 | Vuorotellen | A numbered list in console order (open, fill, Create, copy ID, copy secret), with each field in its own item | The most explicit action→result sequence. *Valitse Create* becomes its own item | The last step looks unlike steps 1–3 and is the longest; on the phone it needs the most scrolling |

## Host facts each direction needs

None of the directions needs a new host fact, command or contract surface.

| Fact | Exists | Used by |
| --- | --- | --- |
| The broker's app-credential write (`AppFields` → `AppChange`), its refusal codes and the waiting state | yes, unchanged | all |
| Client-side format checks (`appErrors`) | yes, unchanged | all |
| The provider's console paths and values (scopes, redirects, permissions) | yes, the same constants as `ServerIntegrations.tsx` | all |
| The filled admin-consent URL | composed in the browser from the two typed values. No host fact | all (Microsoft) |
| Whether an existing Google client still shows its secret | a Google console fact (shown once since 2025), not a host fact | the *Minulla on jo asiakas* text |

## Recommendation

**1 Perään**, applied to all three providers. It does what Jari asked: the
client is created and its values typed in the same view. It is also the
smallest change to `AppSetupDialog`: the last guide step renders `Fields`
after its body, and the `enter` step remains only for *Minulla on jo …* and
*Vaihda tunnukset…*. Direction 3 is the alternative if Jari wants the
*Create → copy* order spelled out. Direction 2 costs a width change that
nothing else in the settings dialogs does.

## Decisions for later review

1. **One rule for all three providers: the guide ends on the console page that
   shows the values.** Alternatives: put Microsoft's fields on step 1, where
   Register first shows the IDs, and save at the end; or save already on step 1.
   Chosen because the IDs stay on Overview, one click away, and the consent
   link needs them. Saving before consent would mark Microsoft as *Tarjolla*
   while people still could not connect.
2. **Dropbox's order is now Luo sovellus → Käyttöoikeudet → Asetukset ja
   tunnukset.** The alternative is to keep production's order and put the
   fields on step 2 with saving on step 3. The App Console's tabs do not depend
   on each other, and the new order ends the guide on the page that holds the
   values.
3. **Microsoft's consent link fills from the typed values** and gets a copy
   button once both are well formed. The alternative is to keep it as a
   template. The values are already on the same screen, so a copyable link
   costs nothing.
4. **In the new directions, *Minulla on jo …* opens only the fields** with
   where the values are; *Takaisin* returns to the guide. The alternative is
   production's jump to the last step, which would now also show the
   create-client instructions to someone who already has a client. For Google
   the text says to add a new secret (*Clients › Open Habitat › Add secret*),
   because Google no longer shows an existing one.
5. **Step titles**: *Asiakas ja tunnukset*, *Hyväksyntä ja tunnukset* and
   *Asetukset ja tunnukset*.
6. **Vaihda tunnukset… (replace) is unchanged.** It is already a single step.
7. **The prototype shows Dropbox as *Ei tarjolla* with Aseta tunnukset**, so
   that its guide can be opened. The synthetic lab has no rclone, so there
   it shows *rclone puuttuu*.

## Checks

`verify.mjs` builds the page and runs in headless Chromium: every variant on
desktop 1280 and phone 390 in light and dark walks Google from the row to
*Tarjolla*, an empty save is refused on the step with the fields, Microsoft
and Dropbox are walked to their saved state, *Minulla on jo asiakas* opens,
nothing overflows the dialog, `picker-check` passes, the console stays
clean, and the page makes no network requests. Production code is
unchanged, so no browser suite or Go checks were run.
