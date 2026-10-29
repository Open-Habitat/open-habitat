# Result: shared view links

## Jarille

Näkymän voi nyt jakaa linkillä. Kortissa ja paneelin yläpalkissa on *Jaa
linkillä*. Dialogi kertoo, että kuka tahansa linkin saanut voi avata näkymän
kirjautumatta. Siinä valitaan voimassaolo (1, 7 tai 30 päivää tai palvelimen
enimmäisaika) ja luodaan linkki. Saman dialogin kautta linkin voi kopioida,
jatkaa, vaihtaa näyttämään toista näkymää (*Vaihda sisältö*), vaihtaa uuteen
osoitteeseen tai poistaa. Asetukset › Tili › Jaetut linkit listaa kaikki omat
linkit. Ylläpitäjä näkee Käyttäjät ja pääsy -osiossa, kuka jakoi mitä ja mihin
asti, mutta ei osoitetta, ja voi poistaa minkä tahansa linkin.

Avaaja näkee sivun samoin kuin sinä omasi, ilman kehyssivua, koska poistit
huijaussuojat. Linkki on näkymäosoitteiden alla
(`https://oh-view-….example.test/<avain>/`), joten uutta verkkotunnusta tai
varmennetta ei tarvita. Agentti ei voi luoda linkkejä eikä näe niitä.

**Testikoneelle tarvitaan Fleetrepo-muutos.** Testikoneella ei ole site.jsonia,
joten näkymäoperaattorin (`infra/open-habitat-test/guest_view_origin.py`)
täytyy asettaa gatewayn konfiguraatioon myös `oauth.view_link_max_days`
(esim. 90). Ilman sitä linkit ovat testikoneella pois päältä eikä *Jaa
linkillä* -painiketta näy. Tähän työhön kuului vain huomata tarve, ei muuttaa
Fleetrepoa.

## Decisions for later review

- **Links live on per-link hosts of the existing view namespace.** ADR 0033 is
  rewritten to say this. The proposal's separate `views.public_origin` host
  went away with the frame page. Alternatives were one fixed public host,
  which needs a new DNS name and certificate, and the owner's own per-view
  host, where re-pointing would change the URL. The label is a hash of the
  link ID, never of the token.
- **The operator switch is `views.link_max_days`** (1–365), published as
  `oauth.view_link_max_days`. One field both enables links and sets their
  maximum. The alternative was a boolean plus an optional maximum (default
  90), and one field is simpler. Lowering the maximum does not shorten links
  that already exist; it only caps new links and extensions.
- **Sites behind an Access pin.** On a site with `oauth.access` (Cloudflare
  Access), link hosts go through the same Access check. "Anyone" then means
  anyone past Access. Exempting link hosts in the gateway would have been an
  authority change.
- **Limits (tuning):** 50 active links per person, 4096 per site, 8
  concurrent relays per link and 48 per site, a daily budget of 2 GiB per link
  and 20 GiB per site, and a 5-minute write deadline per public response.
- **Title kept in the link record.** The view's title is stored when a link
  is created or re-pointed, so the administrator list needs no read of every
  owner's daemon.
- **Unknown, expired, revoked and disabled links answer the same way:** 404
  *Linkki ei ole voimassa.*, including a revoked link's host once it falls
  back to being an ordinary view host. A removed view answers *Jaettu näkymä
  ei ole enää saatavilla.*
- **The UI manages one link per view**, the newest. The API allows more, and
  Settings lists them all.
- **"Uusi osoite" keeps the host and replaces only the token.** The old URL
  dies either way.

## Evidence

- Go: `internal/gateway` (new `view_links_linux_test.go`: anonymous read of
  one export, wrong/short tokens, traversal, the owner's host, another link's
  host, robots, expiry, extension, new address, re-point, removed view,
  revocation, operator switch, deny, `revokeSessionsLocked`, admin metadata
  without URL, budgets, caps, store round trip and discard, commit-time
  session check, configuration), `internal/host` (site schema drift),
  `internal/cli`, `test/browser-host`, daemon view/context subset. All pass.
- Contracts: `validate-contracts.py` with new negatives; generation clean.
- Web: the full unit suite (147 files), including new ViewHost link tests and
  the epoch fence in `viewLinks.test.ts`.
- Browser (synthetic, same UID, Chromium): new `view-links.spec.ts`. The
  person creates a link. A fresh context with no cookies opens it top-level,
  and scripts, styles, image and a relative link work with no cookie sent or
  set. The app still asks the recipient to sign in. Re-pointing keeps the URL,
  the Settings list shows the link, and the administrator revokes it, after
  which the link returns 404. `agent-views.spec.ts` and
  `settings-search.spec.ts` are unchanged and green.
- Review: an independent `/llm-review` (finder gpt-6-astra, verifier
  claude-fable-5-1) raised five findings, and all were confirmed and fixed:
  a previous person's link URLs could reach the next person's UI after an
  in-tab account switch, the commit-time session check missed expiry, slow
  readers could pin relay slots, expired links counted against the site cap,
  and the store size limits were misaligned.
- Not tested: a real ingress, separate Unix users, Firefox or Safari, and the
  live test server (which needs the Fleetrepo switch).
