# Result: admission through a GitHub team

Built as the issue describes. The broker keeps the team source
(`teams`) and one member record per person (`members`) in
`allowlist.json`, beside the operator ids and runtime entries, under the
same epoch and lock. At sign-in the gateway reads the teams, asks GitHub
with the sign-in's own token about each one, and sends what it saw to the
broker (`team_sign_in`) before `ensure`. `ensure` then decides from what
the broker recorded. The gateway stores no credential and decides nothing
itself. The access page takes `organisation/team` in the Salli field, shows
each row's reasons as chips and raises a leaver as a notice. Sign-in refusals
never name a team. When GitHub could not answer, the refusal says so
(`membership_unavailable`).

Verified: the broker tests (`internal/provision/admission_team_linux_test.go`)
cover a member, a non-member, a pending invitation, a leaver, both reasons,
GitHub being unavailable, pinning, the switch, the bounds, withdrawal,
restoring, removing a team, host apply's publication and frame size. The
gateway tests (`internal/gateway/admission_team_test.go`) cover the same
decisions through the real callback, the token use, a broker reply that
never arrives, the HTTP API and `CheckTeam` against fake GitHub answers. The
component tests and `web/tests/server-access.spec.ts` cover the UI states.
Nothing was tried against real GitHub. Before Contoso relies on this, test on
the pilot: a hidden member, an organisation that has not approved the app,
a pending invitation and a member removed from the team.

## Decisions for later review

1. **How a team is bound to its id.** The organisation's id comes from
   GitHub's public API when the team is added. Only a member's token can
   read the team's own id, so the first member check pins it (the
   observation carries it and the broker pins it once). Until then the page
   says the team waits for its first member, and nobody is admitted through
   it. The alternatives were to store an administrator token, which is
   forbidden, or to ask the administrator to authorise again when adding a
   team, which is a new OAuth flow. Pinning keeps the issue's "numeric ids,
   not names" with no new authority.
2. **GitHub not answering.** A member whose membership GitHub did not
   confirm becomes `unconfirmed`. That does not admit, and it is not
   leaving: no leaver notice appears, and the next answered sign-in admits
   again. The alternative, admitting on the last known membership, would
   contradict "the sign-in is refused with an honest message". An answer
   from GitHub that is not definite is unknown. That includes a 403 (an
   app restriction), any error, a slug that now resolves to another team,
   and a team 404 when the person's own organisation membership does not
   confirm the organisation.
3. **Readmission through a team rebuilds the runtime state** a non-admitted
   binding loses at boot, as a restore does: the committed account is
   verified first, and drift is left for the operator.
4. **A broker reply to the observation that never arrives stops the
   sign-in.** Otherwise a member record from an earlier sign-in could admit
   without this sign-in's answer. A definite refusal (the switch is off,
   the records are full) records nothing and leaves the decision to
   `ensure`.
5. **Removing a team does not end open sessions,** the same as leaving
   (Jari 2.11.: no new maximum lifetime). What the team gave ends at each
   member's next sign-in, and the records go without leaver notices. The
   alternative was to revoke the sessions of people admitted only through
   that team, like Poista pääsy. Poista pääsy remains the immediate route
   for one person.
6. **"Selvä" on the leaver notice forgets the record:** if the person
   rejoins the team, they are admitted again at a sign-in. Poista pääsy
   (withdraw) is the permanent route. It removes a team member's record and
   leaves a withdrawn entry that later sign-in observations cannot
   override until someone restores the person.
7. **The switch.** Root's `runtime_admission` switch must be on to add a
   team or to record a *new* member, as it already must be to add a person.
   Existing members keep signing in, including one whose last sign-in GitHub
   could not answer, and leaving is still recorded. A leaver who rejoins
   counts as a new member.
8. **Not built from the prototype:** the connect dialog's "move people
   already allowed one by one to come through the team" (the prototype's
   question 3). People allowed one by one stay so and show both reasons.
   Also not built: the "Tiimin kautta" filter (the existing stage filter
   remains) and listing team members who have never signed in, which would
   need a member-list credential. The leaver's sign-in view in the prototype
   named the team and the date. The brief says a refusal never names the
   group, so leavers get the same generic refusal.
9. **Root's CLI** lists teams and team rows (`admin access list`, `--state
   left|unconfirmed`). Adding and removing teams is browser-only for now.
10. **Bounds:** at most 8 teams and 256 member records. The admission file
   limit went to 128 KiB, and an access page holds 8 rows so that the
   widest row fits one broker frame.
11. **Known noise:** a sign-in by a non-member whose token GitHub refuses
    with a 403 sets the team's "GitHub did not answer" note until the next
    definite answer. It changes no one's access.
