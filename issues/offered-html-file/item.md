---
created: 2026-11-24
updated: 2026-11-24
type: bug
reporter: jari
status: fixed
priority: normal
lane: unlaned
preparation: ready
closed: 2026-11-24
---

# An offered HTML file should open as a page in its preview

## Observed (Jari 24.11.2026)

An offered HTML file (`open-habitat agent file offer --source x.html`) opens in the file
card's preview as metadata only ("HTML-koodi · 4 826 riviä · 7,5 Mt", Tyyppi, Koko), not as
the page. Jari: an HTML file should open there.

## Done when

An offered `.html` file's preview renders the page in the same sandbox as offered views
(the view host's CSP: scripts allowed, no network, no top navigation, no nested frames),
with the source/metadata view still reachable and download unchanged. Large files (several
MB, like prototype builds) render too. If rendering offered HTML in that sandbox raises a
security concern the view host does not already accept, stop and report it instead.
