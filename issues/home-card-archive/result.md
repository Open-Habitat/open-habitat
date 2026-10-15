# Result

Each conversation card on the home page has an archive icon. A blocked action carries its reason, including while Pi is working. The existing host archive operation hides the card while pending; rejection restores it with an error on the card, and a successful retry removes it without confirmation.

## Evidence

- `lab-ready.{png,html}` and `lab-refused.{png,html}`: synthetic lab home cards before archive and after a 409 host refusal. In both states the action remains in the card header, and the failed card is still visible with its error. Compared to `design-system/drafts/Etusivu.proto.html` at the same desktop home-card state: the title remains left-aligned, the added action occupies the trailing header space rather than shifting recap/open rows.
- Browser case `home card blocks archive during Pi work, shows failure and removes on success`: host-backed synthetic snapshot with Pi running, then a 409 refusal and successful retry. The targeted case passed (1/1) after making its working-state fixture deterministic; the native fake Pi may finish before navigation otherwise.
- Component/unit tests (`HomeWorkspaces.test.tsx`) check the blocked reason and a refused archive retaining its card and error. Focused web checks and targeted review recorded in the run.

## Decisions for later review

- The card owns the transient failed-action notice, while `App` keeps the existing single authority for archive requests and optimistic hiding. The card's state is retained across the optimistic unmount by its home section rather than a separate registry. Home-origin requests do not navigate away on success or leave a global error to appear on another view.
- Native terminal writers and daemon sessions without confirmed idle status block the card action. Host admission still decides from a fresh native observation at the write boundary; a home snapshot alone cannot prove writer absence.
