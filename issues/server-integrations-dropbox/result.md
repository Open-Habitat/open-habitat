# Result: Dropbox app setup in Integraatiot

Dropbox's *Aseta tunnukset…* in Asetukset › Palvelimen ylläpito ›
Integraatiot is round 5's direction 2, "Sivu kerrallaan": *Luo sovellus*
(a direct link to `https://www.dropbox.com/developers/apps/create`, Scoped
access, Full Dropbox and why an app folder is not enough, the app name rule,
and the advice to create the app on the organisation's shared Dropbox
account), *Asetukset* (the exact redirect `http://localhost:53682/` and
*Enable additional users*), *Käyttöoikeudet* (the seven `dropboxScopes` as one
copyable block, browser search advice, and that a later change does not reach
connected accounts), then App key and App secret (a password field) and
*Tallenna*. *Minulla on jo sovellus* jumps to the keys. Dropbox renews no
secret on request, so the row's *Tunnukset* menu offers only *Poista
tunnukset…*; the menu heading shows the App key's first four characters and
the 50-person Development-status rule. The removal dialog adds that connected
accounts stop syncing and that another app can be set afterwards.

The broker rule already matched `dropboxApp()` (`integrationapps.Usable`:
1–256 of `[A-Za-z0-9_-]` for both) plus key ≠ secret in any case
(`integrationapps.Valid`); the browser checks the same and names the App key
when it is pasted twice. Only the App key returns: the gateway view and the
broker's reply have no secret member, and a reply carrying one does not parse.

## Evidence

- Go: `go test ./internal/integrationapps ./internal/provision
  ./internal/gateway ./test/browser-host`. New: validator cases (App key twice
  in another case, missing secret, extra field) and the broker's
  secret-never-leaves test now also sets a Dropbox app and checks that the
  reply carries the App key and that neither the reply, the list, the record,
  the log nor the events carry the secret, while root's file does.
- Web: `ServerIntegrations.test.tsx` (Dropbox's four steps in order; a secret
  with a space or a dot or equal to the key in another case stays in its
  field and nothing is sent; trimmed values sent; the remove-only menu with
  the Development-status note and the sync-stops consequence); stories
  `Settings/Palvelimen integraatiot` DropboxSet and DropboxStep* (each step
  and phone).
- Browser: `server-integrations.spec.ts` Dropbox set → *Odottaa palvelinta* →
  *Käytössä* → remove, with the administrator's own catalog following, the
  set reply checked for the App key and no secret, axe and 390 px on the
  first step. The browser host's Dropbox is the production entry: a
  `rclone=1` fixture installs a stand-in rclone and the entry reads the
  Dropbox section the fixture broker wrote, as the daemon reads root's file.
- Review: focused self-review plus one targeted finder (gpt-6-astra) on the
  validation path (browser vs broker rule, secret return, fixture
  faithfulness): no findings. Its model-performance entry was not logged
  (SSH from Alder to itself refused).

Not covered: the real Dropbox App Console (paths and button names come from
Dropbox's documentation, as in round 5), and a live person connecting through
a browser-set app.

## Decisions for later review

1. **The menu's 50-person note is fixed text** shown whenever Dropbox's app
   is set: the server cannot see the app's status or how many have
   connected (round 5's proposal).
2. **The removal dialog also says another app can be set afterwards**, as
   for Microsoft (the round 5 prototype did so). It does not say that
   existing connections keep the old app's keys in each person's rclone
   configuration; round 5 left that open for Jari.
3. **The menu labels the identifier "app key"** rather than "client id" for
   Dropbox, matching the console's word.
4. **No operations.md change**: its *Dropbox app registration* section
   already describes the same registration (round 5's note).
