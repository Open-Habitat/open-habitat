# Prototype round 1: workflow permission on the GitHub card

Round `design-system/prototypes/rounds/2026-11-13-github-workflow-scope/`
(build and check commands, and "What the host would need", are in its
`NOTES.md`). Production's Settings › Koodipalvelut is unchanged around the
round's pieces. The same in every direction: off by default; turning it on
re-runs the GitHub sign-in with `workflow` added; the card shows the current
token's scopes. States: off, signing in, allowed, permission missing,
scopes unknown.

Axis: where the opt-in sits on the card.

- **A Rivi**: a row of its own under the GitHub row, with the plain-words
  risk, the state and one button ("Salli GitHubissa" / "Poista lupa").
  The token's scopes are chips on the GitHub row.
- **B Luettelo**: the GitHub row lists every scope in plain words; workflow
  is the last item, with the same state and buttons.
- **C Ikkuna**: the card shows only the scope chips and a line; the
  permission is a checkbox, with the explanation, in a "Yhdistä uudelleen…"
  dialog that replaces production's Reconnect.

**Recommendation: A.** The permission and its risk are visible without
opening anything, and every state fits the one row. B explains scopes nobody
asked about; C hides the permission behind a dialog nobody opens without a
reason.

## Questions for Jari

1. Should Habitat remember the opt-in (one boolean in the person's own
   settings, beside the token)? Without it there is no "permission missing"
   state: after an ordinary sign-in replaces an expired token, or after
   `gh auth login` in a terminal, the card just says "Ei sallittu" and the
   only signal is a failed push. The round assumes yes.
2. Removing the permission leaves the old workflow token unused on GitHub.
   Revoking it would need the daemon to hand gh's token to the gateway.
   The round does not revoke it; is that acceptable?

## Verdict (Jari 14.11.2026)

Direction **A Rivi**. Habitat remembers the opt-in (so a later sign-in that
drops the scope shows "permission missing"). Removing the permission does
not revoke the old token on GitHub; that is enough. Implementation:
`github-workflow-scope`.
