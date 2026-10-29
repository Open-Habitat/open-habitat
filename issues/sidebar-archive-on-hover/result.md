# Result

The rail's conversation rows (Sinun vuorosi and Käynnissä) carry an archive
button. With a pointer it appears on hover or keyboard focus in place of the
row's age; on a touch screen (`hover: none`) it always shows after the age.
It uses the same eligibility as the home card (`cardArchiveReason`), the same
archive mutation (`changeArchive`) and the same archive notice with
*Palauta näkyviin*. An unwritten conversation is closed instead, like from a
home card.

While testing, a fresh conversation right after its first reply still had
`history: "missing"` in the catalog, so the home card's "close empty" path
was taken and the daemon refused it (*Sulkemista ei tehty …*). The shared
path now also consults the conversation status's `native_history`, which
proves the first entry earlier; this applies to home cards too.

Evidence: `web/src/components/Navigation.test.tsx` (button outside the link,
disabled reason, focus to the neighbouring row) and
`web/tests/rail-archive.spec.ts` (hover reveal, Tab reach, archive without
navigation, restore from the notice; touch viewport shows the button without
hover and archiving the open conversation leaves it).

## Decisions for later review

- **Phone affordance: always-visible icon, not a row menu or swipe.** The rail
  rows have no row menu and nothing in the rail swipes; the workspace rows'
  menu button already uses the same rule (hidden until hover, always shown on
  `hover: none`). Alternatives: no phone affordance (the header menu already
  archives an open conversation), or a new swipe gesture. Chosen because it
  matches an existing rail pattern and needs no new interaction. A mistaken
  tap is undone from the archive notice.
- **Disabled rather than hidden when the row cannot be archived now.** Same
  as the home card: the button shows dimmed with the reason in its tooltip
  and description, so it does not appear and disappear as turns run.
- **Archiving the open conversation from the rail navigates to its
  workspace**, as the header button does; any other row is archived in place
  and the page stays.
- **No archive on the collapsed rail's dots**: they are too small for a
  second target.
- **Refusal shows in the archive notice** (unlike a home card, which shows its
  own), since the rail row has no room for a message.
