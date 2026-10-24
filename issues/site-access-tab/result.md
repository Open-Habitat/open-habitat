# Result: Settings › Käyttäjät ja pääsy

Asetukset › *Käyttäjät ja pääsy* is the round-6 "Yksi lista" over the
`runtime-admission-broker` endpoints: a GitHub login is checked on GitHub
(name and numeric id) before *Salli*, duplicates are reported under the field
by numeric id, each change shows "odottaa palvelinta" until its reply and
"Tila epävarma" with *Päivitä* when no definite reply came. Removal confirms
its consequences, the row stays as *Pääsy poistettu* with *Palauta pääsy*.
`operator` rows have no remove action. `runtime_admission: false` disables
adding and restoring with the reason; `admission: any` says access is open and
disables every change. The gateway now joins last use (`last_seen`) into the
access list.

Evidence: `web/src/components/ServerAccess.test.tsx`,
`web/src/app/ServerAccessSettings.test.tsx`, stories
`Settings/Käyttäjät ja pääsy`, browser spec `web/tests/server-access.spec.ts`
(add, remove, restore against the synthetic broker, the removed person's
session ending, a lost reply, open mode, axe and 390 px overflow), gateway
`TestAccessListLastSeen`.

## Decisions for later review

1. **Last seen comes from live gateway sessions.** It is the newest renewal of
   any live session, so it is accurate to a day, and it is absent once every
   session has ended: the gateway keeps no sign-in history beside its sessions.
   A person who signed out yesterday shows no date. A session in its final
   90 days is left out too: its idle deadline is capped at the absolute one and
   no longer moves with use, so it would report up to 90 days stale. Making it
   exact needs a use time in the session record (a session-store format
   change), which was not worth it for a day-level hint.
2. **Per-person disk limits moved to Levytila.** *Käyttäjät ja pääsy* is only
   the access list; the storage table (usage, limit, *Raja…*) is now on the
   Levytila tab next to the disk total.
3. **site.json rows show "GitHub-id N".** Neither the broker nor the gateway
   keeps a login for `operator` entries, and resolving each one on GitHub on
   every page load was not worth the API calls. Their Unix name is shown.
4. **The GitHub check is an explicit *Tarkista*,** not as-you-type, so typing
   costs no GitHub API calls. The button becomes *Salli* or *Palauta pääsy*
   once the account is found.
5. **Left out of the prototype:** the authority banner and lede (admin views
   stay without explanatory text), the joined date and the onboarding outcome
   line (no read model; the outcome crosses the Unix-user boundary and belongs
   to `plan-site-onboarding-authority`), and the multi-login dialog of
   direction 3.
6. **Leftover states.** A deny on a still-admitted row (a withdrawal whose
   broker reply never came) shows *Poisto kesken* and offers *Poista pääsy*
   again. A deny with no admission row shows *Pääsy poistettu* with no action;
   root's `admin access` CLI resolves it.
7. **The administrator-role control** was already removed by
   `runtime-admission-broker`; the browser spec and component test assert its
   absence.
