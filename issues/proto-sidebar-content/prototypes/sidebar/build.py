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
names = ['Nyt', 'Saapuneet', 'Työpuu', 'Työtila kerrallaan', 'Kiinnitetyt']
buttons = '\n'.join(
    f'  <button class="proto-picker-item"{" data-active aria-current=\"true\"" if i == 0 else ""}>{i + 1} · {n}</button>'
    for i, n in enumerate(names))
markup = re.sub(r'  <button class="proto-picker-item" data-active.*?(?=\n  <span class="proto-picker-divider")', buttons, blocks['html'], flags=re.S)
# Static comparison: no entrance animation, so no replay button or divider.
markup = re.sub(r'  <span class="proto-picker-divider".*?\n  <button.*?proto-picker-replay.*?</button>\n', '', markup)
tokens = '\n'.join((root / 'design-system/tokens' / name).read_text()
    for name in ('colors.css', 'typography.css', 'spacing.css', 'motion.css'))
def font_url(match):
    data = base64.b64encode((root / 'design-system/fonts' / match.group(1)).read_bytes()).decode()
    return 'url("data:font/woff2;base64,' + data + '")'
tokens = re.sub(r'url\("\.\./fonts/([^\"]+)"\)', font_url, tokens)
html = '''<!doctype html><html lang="fi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><title>Sivupalkin sisältö · Habitat · Kierros 1</title>
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; font-src data:; img-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'">
<style>''' + tokens + '\n' + (here / 'surface.css').read_text() + '\n' + blocks['css'] + '''</style></head><body>
<header class="lab"><div><strong>Sivupalkin sisältö · Kierros 1</strong><span>Synteettinen offline-prototyyppi · 1–5 tai ←/→ vaihtaa ideaa · « kaventaa</span></div>
<div class="lab-controls"><output id="lab-feedback" aria-live="polite"></output><button id="reset">Alusta</button><button id="theme">Tumma</button></div></header>
<div id="stage"></div>''' + markup + '''
<script>''' + (here / 'variants.js').read_text() + '\n' + blocks['js'] + '''
installPrototype();
</script></body></html>'''
(here / 'index.html').write_text(html)
print(here / 'index.html')
