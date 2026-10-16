# Result

## What existed, and why Jari did not see it

`settings-model-picker-autoselect` (commit 926f2553) added `version` to the
authenticated `GET /api/v1/server` reply and a grey `md-note` line,
"Palvelimen versio: …", at the very end of the settings detail pane. The
watcher receipt for pilot.180 names source `91993325`, which contains 926f2553,
so the line was in the bundle the server shipped. Two things kept it out of
sight: the line sat below the section content in note styling (on a long
section it is below the fold and looks like a footnote), and a tab opened
before 18:43 still ran the older bundle, which had no line at all. Nothing in
the tab told him which of the two he was looking at. That second gap is the
real defect; the fix below addresses both.

## Design

**What the version is.** The gateway already receives the release version from
the composition root (`internal/cli.version`, injected by
`package-release.sh`). The reply now also carries `commit`, the 40-hex source
commit the binary was built from (the same value `open-habitat --json version`
reports), only when the binary has one. Both are non-secret release metadata
and are returned to every signed-in user, as before. `contracts/v1/server.schema.json`
gains the optional `commit` field.

**What "a new version" means for a tab.** Reloading helps only when the
*browser bundle* changed: Go changes take effect on the server whether or not
the tab reloads, and the watcher releases every commit to main, including
docs- and issue-only commits whose web bundle is byte-identical. Prompting on
every version number change would ask for pointless reloads many times a day.
The tab therefore compares bundles, not version labels.

The browser already knows its own bundle exactly: Vite's `index.html`
references content-hashed entry assets (`/assets/index-<hash>.js`, the CSS
file), and the document the tab loaded still contains those tags. At start-up
the client records the sorted list of `script[type=module][src]` and
`link[rel=stylesheet|modulepreload][href]` from the loaded document (before
lazy chunks add their own). To check, it fetches `/index.html` (same origin,
`no-store`, already served without caching by the gateway, size-capped,
redirects not followed), parses it with `DOMParser` (no script runs; only
attributes are read) and compares the same list. Different lists mean the
server now serves a different bundle. Any failure (offline, 401/redirect to
login, oversize, unparseable) is "unknown" and never prompts.

Alternatives rejected: a version header on every API reply would need a
central fetch hook across a dozen modules and would still only give the label,
which prompts on non-web releases; baking the version into the bundle at build
time would change the reproducible web build and also prompts on non-web
releases; an SSE hello field would couple the release check to the daemon's
event journal, which the gateway does not own.

**When the tab checks.** When the tab becomes visible (`visibilitychange`),
when the browser comes back `online`, on window focus, and every two minutes
while visible. A desk tab left open over an upgrade is caught within two
minutes; a background tab is caught the moment Jari returns to it. Hidden
tabs do not poll. The request is a ~1 KB static file.

**The prompt.** A non-modal status banner in the same place and style as the
connection banner: "Uusi versio on saatavilla. Lataa sivu uudelleen, niin saat
uusimmat korjaukset. Luonnokset säilyvät." with "Lataa uudelleen" and
"Myöhemmin". "Myöhemmin" hides it until the server serves yet another bundle.
Reload is always the person's choice: an automatic reload could interrupt a
half-typed message or an open dialog. Drafts and held messages already live in
`sessionStorage` per tab and are written on every keystroke, so they survive
the reload; the browser test proves it across a simulated upgrade.

**Where the version is shown.** Asetukset → Palvelin gets a "Versio" row in
the server card: release version, short commit, and this tab's state ("Tämä
välilehti on ajan tasalla" or "Tämä välilehti käyttää vanhempaa versiota" with
a reload button). The bottom of every settings section keeps a line with the
same facts for non-administrators. A tab whose bundle predates this change
shows neither, which itself is now the tell.

**Daemon version.** Not needed: the release switch (`release_fresh_next.py`)
stops every product unit, including every `open-habitat-daemon@` instance,
before selecting the new release, and the broker restores the sockets from the
new binary. A daemon process older than the gateway cannot survive an upgrade,
so no daemon version endpoint or admin warning was added.

## Decisions for later review

- The reload prompt is driven by a changed web bundle, not by a changed
  version number; a server release that does not change the bundle shows the
  new version in settings but no prompt.
- Check cadence: on visibility/focus/online and every two minutes while
  visible.
- "Myöhemmin" dismisses until the next different bundle, not for a time span.
