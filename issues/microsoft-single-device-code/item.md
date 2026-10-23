---
created: 2026-10-23
updated: 2026-10-23
type: bug
reporter: jari
status: open
priority: normal
preparation: ready
lane: integrations
lane_seq: 4
collision: [internal/daemon/integrations]
---

# Microsoft 365: one device code for the whole connection; fix completion wording

## Description

Jari 2026-10-23 06:16–06:24 on the test server (bf2774c1), Microsoft 365 work account: sign-in finally connected (the SharePoint 404 site was skipped as designed, `integration_discovery outcome=skipped step=site_drives`), but:

1. **He had to enter a device code twice.** The flow runs two separate device-code logins (rclone for OneDrive/SharePoint files, then ms-365-mcp-server for Outlook). He entered the shown code, went through Microsoft's whole flow, came back and the dialog still showed the same waiting state with "Odotetaan, että hyväksyt kirjautumisen"; only after entering again did it move on. Whether the dialog failed to show the switch to the second code or failed to notice the first approval, the person experiences it as broken. Jari: this is a bug, not a matter of the flow being complicated.
2. **The completion message reads oddly:** "Näitä seurattuja SharePoint-sivustoja ei voitu avata: tailspin.test - Työsuhteet. Muiden tiedostojen yhdistäminen jatkuu. Tarkista sivustojen käyttöoikeudet organisaatiostasi." shown above "Yhdistetty: maintainer@example.org". At that point everything is already connected, so "jatkuu" is wrong and the order is backwards.

## Goal

- **One device code for the whole Microsoft 365 connection.** Use a single device-code sign-in with the union of the scopes, then provide the result to both native tools' own stores (rclone remote config and the ms-365-mcp-server token cache), e.g. by redeeming the refresh token for each tool's scope set with the same Entra app, or by whatever the tools natively support. No new shared credential store: each token still lives only in the tool's own native store in the person's home. If a single code is genuinely impossible with the tools as pinned, the dialog must make the second code impossible to miss (new code replaces the old one with a clear "Vaihe 2/2: Outlook" state) and must detect approval reliably; record why one code was impossible.
- **Wording:** success first, then the skipped site in past tense, e.g. "Yhdistetty: maintainer@example.org. SharePoint-sivustoa ”tailspin.test – Työsuhteet” ei voitu avata, joten se jätettiin pois. Jos tarvitset sitä, pyydä käyttöoikeus organisaatiosi ylläpitäjältä." Review the other Finnish strings of this dialog for the same problem.

## Acceptance Criteria

- [ ] A Microsoft 365 connection needs one code (or, if proven impossible, an unmistakable two-step dialog that reliably detects each approval), covered by a synthetic regression that simulates both tools' polling.
- [ ] Completion and partial-site messages read correctly in Finnish; screenshots desktop/390 px.
