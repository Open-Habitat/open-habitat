# Result

**Asetukset → Palvelin → Palvelimen nimi** is now a plain text field. It saves when focus leaves it or on Enter, and Escape returns to the saved value. Next to the field is a quiet "Tallennetaan…" / "Tallennettu". A refused save keeps the typed text, marks the field and says "Ei tallennettu: muutosta ei voitu vahvistaa. Teksti säilyi; yritä uudelleen Enterillä." An empty name is not sent and says why. The sidebar picks up the new name without navigation, as before.

The same pattern applies to the other single-value setting, **Levytila → Oletusraja** (GiB, comma or point accepted, invalid values are not sent). The shared component is `web/src/components/InlineTextSetting.tsx`.

Screenshots (synthetic lab, `capture.mjs`): `lab-{desktop,phone}-{light,dark}-{saved,failed,storage}.{png,html}`.

## Tests

- Review fixes (`/llm-review`): the field is read-only while a save is outstanding, so the reply cannot overwrite newer text. Equivalent limits ("8,0", "8.0", " 8 ") are recognized as unchanged and not written again.

- `web/tests/settings-name-and-storage.spec.ts` (host-backed): there are no Muokkaa/Tallenna buttons. Typing and leaving the field against a refused PUT shows "Ei tallennettu", keeps the typed text and leaves the sidebar on the old name. Enter after the host recovers saves it, shows "Tallennettu" and renames the mounted sidebar without a navigation.
- `web/src/app/ServerAdministration.test.tsx`: an unchanged blur writes nothing; the name is trimmed; failure keeps the text; a retry writes the same body; an empty name is refused locally; Escape restores the saved value.

## Decisions for later review

- **A failure no longer hides the card behind "Lataa tiedot uudelleen".** The old editor cleared the view after a refused write, so a lost acknowledgement could not be mistaken for the current state. A name or default-limit write sets a whole value and is idempotent, so retrying the same text is safe without a reload. The role and per-user limit actions keep the old behavior.
- **Saved on blur, not while typing.** A debounced save while typing would rename the server in everyone's sidebar mid-word.
- **Per-user storage limits stay as they are** (Raja… in the user table). They are a table action, not a single settings row.
