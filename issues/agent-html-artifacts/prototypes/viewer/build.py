#!/usr/bin/env python3
"""Build the self-contained review page; never imported by production."""
import base64
import re
from pathlib import Path
here = Path(__file__).resolve().parent
root = here.parents[3]
picker = (Path.home() / '.claude/skills/prototype/PICKER.md').read_text()
blocks = {lang: re.search(r'```' + lang + r'\n(.*?)\n```', picker, re.S).group(1)
          for lang in ('html', 'css', 'js')}
markup = blocks['html'].replace('Quiet', 'Editori').replace('Editorial', 'Oikealla').replace('Playful', 'Katselutila')
# No entrance animation in the contestants: omit the conditional replay button.
markup = re.sub(r'  <span class="proto-picker-divider".*?\n  <button.*?proto-picker-replay.*?</button>\n', '', markup)
tokens = '\n'.join((root / 'design-system/tokens' / name).read_text()
    for name in ('colors.css', 'typography.css', 'spacing.css', 'motion.css'))
def font_url(match):
    data = base64.b64encode((root / 'design-system/fonts' / match.group(1)).read_bytes()).decode()
    return 'url("data:font/woff2;base64,' + data + '")'
tokens = re.sub(r'url\("\.\./fonts/([^\"]+)"\)', font_url, tokens)
wiring = """const requested = Number(new URLSearchParams(location.search).get('v'));
if (!Number.isInteger(requested) || requested < 1 || requested > 3) {
 const url = new URL(location); url.searchParams.set('v','1'); history.replaceState(null,'',url);
}
""" + blocks['js']
html = '''<!doctype html><html lang="fi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><title>HTML-näkymät · Habitat · Kierros 1</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; frame-src 'self' about:; connect-src 'none'; base-uri 'none'; form-action 'none'">
<style>''' + tokens + '\n' + (here / 'surface.css').read_text() + '\n' + blocks['css'] + '''</style></head><body>
<header class="lab"><div><strong>HTML-näkymät · Kierros 1</strong><span>Synteettinen offline-prototyyppi · 1–3 vaihtaa suuntaa</span></div>
<div class="lab-controls"><label>Näkymät <select id="offer-state"><option value="ready">Tarjolla</option><option value="expired">Vanhentuneet</option><option value="offline">Palvelin offline</option></select></label>
<label>Prototyyppi <select id="live-state"><option value="running">Käynnissä</option><option value="stopped">Pysähtynyt</option><option value="unavailable">Osoite ei vastaa</option></select></label>
<button id="theme">Tumma</button></div></header><main id="stage"></main>''' + markup + '''
<script>''' + (here / 'variants.js').read_text() + '\n' + wiring + '''
installPrototype();
</script></body></html>'''
(here / 'index.html').write_text(html)
print(here / 'index.html')
