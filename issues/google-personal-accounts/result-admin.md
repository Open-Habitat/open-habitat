# Prototype round 1 — administrator setup guide (2026-11-17)

## Saatesanat

Tämä kierros näyttää palvelimen ylläpitäjän Google-ohjeen siinä muodossa, jossa
myös henkilökohtaiset Gmail-tilit voi sallia. Kolme suuntaa eroavat siinä,
miten ohje kysyy, kenen tilit saavat yhdistää, ja miten se kertoo valinnan
seuraukset. Suosittelen A:ta: se on sama vaiheittainen ohje, jonka valitsit
Googlelle aiemmin, ja ensimmäinen vaihe kysyy valinnan ihmisten kannalta
("Vain organisaation tilit" / "Myös henkilökohtaiset tilit") ennen Googlen
termejä Internal ja External.

Sisältö on sama kaikissa suunnissa. Henkilökohtaisten tilien polku lisää
ohjeeseen nimen, yhteystiedot ja tietosuojaselosteen, julkaisun
(Testing vs. In production) sekä käyttäjärajan ja kertoo, mistä rajan
käytön näkee. Tallennuksen jälkeen tulevat viesti toisen organisaation
ylläpitäjälle, jos työtili on estetty, ja lista siitä, mitä kokeillaan.
Tallennetut tunnukset eivät vielä todista, että kirjautuminen toimii.
Vanhalle Internal-asiakkaalle on oma lyhyt polku, joka ei vaihda asiakasta
eikä katkaise yhteyksiä.

Kolme asiaa on merkitty sivulla "varmistamatta": Googlen varoitusruudun
suomenkielinen teksti ja se, mikä nimi linkissä "Go to … (unsafe)" näkyy;
säilyvätkö Internal-aikana annetut yhteydet vaihdossa; ja poistuuko varoitus,
kun organisaatio luottaa sovellukseen. Habitat ei tiedä Googlen tilaa, joten
ohje kysyy, mitä Googlessa lukee, eikä näytä keksittyä tilamerkkiä.

## Page

Build `node design-system/prototypes/rounds/2026-11-17-google-admin-audience/build.mjs`;
the page is `design-system/prototypes/dist/google-admin-audience/offline.html`
(not committed). Screenshots from the check run (not committed) are in
`/var/tmp/agent-keep/2026-11-17-google-admin-audience/` on the build host.
The round's own notes: `design-system/prototypes/rounds/2026-11-17-google-admin-audience/NOTES.md`.

## Axis and directions

Axis: how the guide presents the audience choice and its consequences.

- **A Kysymys ensin** — production's step dialog. Step 1 asks "Kenen Google-tilit voivat yhdistää tähän palvelimeen?" with two radio cards, each saying who is excluded and what follows; Next waits for a choice. The path then has 8 steps (personal) or 6 (organisation).
- **B Yksi sivu** — the whole guide on one wide page with a table of contents; the audience is a segmented switch that adds or removes sections. Credentials are saved inline; the work-account and try-it sections sit under "Tallennuksen jälkeen".
- **C Vertailu ensin** — step 1 is a two-column table of consequences (who can connect, Google's setting, warning, user cap, preparation, other work accounts) with a Choose button per column; later steps carry a "Valintasi" summary column with a Change link.

**Recommendation: A.** It keeps the stepper Jari chose for Google (round 3, "Vaiheittain"), so only one step and the branch are new. B shows everything at once, which suits an administrator who already knows Google Cloud, but it makes a long page and drops the "one console page per step" rhythm. C's table is the clearest comparison, but the side summary repeats what the admin has already chosen and crowds the phone layout.

## States shown (research › Round 1)

1. **Choose audience** — preset 1: organisation-only vs also personal, written in terms of who is excluded.
2. **New project and existing client** — preset 2 and situation "Tunnukset jo asetettu": Habitat says it cannot see Google's audience, links to Audience, keeps the client and connections; the personal path goes brand → Make external → publish → work accounts → check, with a migration checklist and token survival marked unconfirmed. In a new installation, "Minulla on jo asiakas" skips straight to the credentials after the audience choice.
3. **Testing / In production** — preset 3: the admin says what Publishing status shows; Testing warns about test users only and 7-day connections; In production says publishing is not Google's verification. The lifetime cap of 100 new users, and where to check it (Audience › OAuth user cap), is shown in both. Publishing happens in Google; saving in Habitat publishes nothing.
4. **Brand and privacy** — preset 4: support and developer emails, home page, privacy policy (required even without verification, and must describe agents' reading, storage and onward transfers), terms (sources disagree), authorized domain owned and verified. An illustration of Google's warning uses the documented English heading and "Advanced › Go to ‹tunniste› (unsafe)", marked unconfirmed, with no promise that the app name or logo appears.
5. **Workspace policy block** — preset 5: a copyable message to the other organisation's administrator with the exact Client ID and the Admin console path to Trusted; Trusted is not verification and changes nothing for personal accounts; warning suppression is marked unconfirmed.
6. **Ready for the person's test** — preset 6: saved ≠ tested; connect a personal account, expect the warning, try both Full and Read only levels (same client), ask an agent to read a message.

Every state is in light and dark, 1440 and 390 px, Finnish and English.

## Decisions for later review

- **The guide asks what Google shows instead of displaying a status.** Alternatives: store an admin-declared audience; read state from Google. Habitat's `GoogleApp` has only the client id and secret, and the research recommended no new configuration authority; a segmented "what does Publishing status say?" keeps the guide honest.
- **Work-account handoff and the try-it list come after Save, inside the same guide.** Alternative: separate help elsewhere. The Client ID is only certain after save, and "saved is not tested" belongs at the moment of saving. Production's guide currently closes on save; this changes that.
- **The existing-client path opens from the Google row.** In the prototype the row's credentials menu opens the guide directly; the proposed production entry is a new menu item ("Kohdeyleisö…") beside Vaihda tunnukset / Poista tunnukset.
- **The new-project path recommends a project used only for this server, and a separate one for a test server**, because the cap is per project.
- **No audience is preselected.** Alternative: preselect "personal" because staging and the pilot switch to External. The choice has real consequences (the cap, the privacy policy), so the administrator makes it.
- **The handoff message is written by the Habitat administrator on the person's behalf** to the other organisation's admin, not by the person.

## Questions for Jari

1. **Which direction?** Recommendation: A.
2. **Should Habitat remember the administrator's audience choice?** It would let the person's connect flow (round 2) show Google's warning help only when it is relevant. Recommendation: not now. It would be a second, unverifiable copy of Google's state, and the person flow can explain the warning conditionally ("jos Google näyttää…"). Revisit if round 2 shows the conditional help is confusing.
3. **Do we keep the warning illustration in the admin guide?** Recommendation: yes, with the unconfirmed marker, until an authorised test account confirms the Finnish labels; then replace it with the confirmed wording (synthetic illustration, never a capture of a real installation).
4. **Where does the existing-client path live: a new row menu item "Kohdeyleisö…" or inside Vaihda tunnukset?** Recommendation: a separate item, because changing the audience must not ask for a new secret.
5. **Should the guide require a privacy-policy URL before Save?** Recommendation: no. Habitat cannot check Google's form; the guide states the obligation plainly and leaves it to the administrator.

## Verification

- `node design-system/prototypes/rounds/2026-11-17-google-admin-audience/build.mjs` — built.
- `check.mjs` (above) — `ok 471 checks`, console clean (errors and warnings both fail), all three directions × six presets × 1440/390 × light/dark, English, the clicked paths, and the shared picker check.
- Review level: self-review of screenshots and text against research.md. Prototype-only diff: no product code, contract, session, daemon state or authorization boundary changed, so no independent model review.
