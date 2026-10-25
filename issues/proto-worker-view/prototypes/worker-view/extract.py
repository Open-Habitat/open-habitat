#!/usr/bin/env python3
"""Copies production markup and CSS out of baseline.mjs's synthetic-lab dumps.

The prototype is built from these copies so that it looks like the shipped
conversation, not like a redrawing of it. Run after baseline.mjs:
  python3 extract.py <scratch-dir>
"""
import re
import sys
from pathlib import Path

scratch = Path(sys.argv[1])
out = Path(__file__).resolve().parent / 'captured'
out.mkdir(exist_ok=True)


def clean(h):
    h = re.sub(r'<script[\s\S]*?</script>', '', h)
    h = re.sub(r' (data-rac|data-react-aria-pressable|data-hovered|data-focused|data-focus-visible)="[^"]*"', '', h)
    h = re.sub(r' id="(react-aria|_r_)[^"]*"', '', h)
    h = re.sub(r' (aria-describedby|aria-labelledby|for)="(react-aria|_r_)[^"]*"', '', h)
    h = re.sub(r' href="[^"]*"', ' href="#"', h)
    return h


def element(h, start):
    """The element that opens at `start`, through its matching close tag."""
    tag = re.match(r'<(\w+)', h[start:]).group(1)
    depth, i = 0, start
    for m in re.finditer(r'<(/?)' + tag + r'\b[^>]*>', h[start:]):
        depth += -1 if m.group(1) else 1
        if depth == 0:
            return h[start:start + m.end()]
    raise ValueError(tag)


def at(h, marker):
    i = h.find(marker)
    if i < 0:
        raise ValueError(marker)
    return element(h, h.rfind('<', 0, i))


body = (scratch / 'conversation.html').read_text()
frame = at(body, 'class="ah-conversation-frame')
shell = clean(body.replace(frame, '<!--FRAME-->'))
(out / 'shell.html').write_text(shell)
live = (scratch / 'live.html').read_text()
expanded = (scratch / 'expanded.html').read_text()
parts = {
    'header': at(body, 'class="ah-agent-header"'),
    'readonly': at(body, 'class="ah-read-only-footer"'),
    'strip': at(body, 'data-testid="background-work"'),
    'working': at(live, 'class="ah-turn-strip ah-turn-working"'),
    'composer': at(live, 'class="ah-composer'),
    'livehead': at(live, 'class="ah-agent-header"'),
    'stage': at(expanded, 'data-tool-count="2"'),
    'tools': at(expanded, 'data-tool-name="read"'),
    'edit': at(expanded, 'data-tool-name="edit"'),
}
for name, html in parts.items():
    (out / f'{name}.html').write_text(clean(html) + '\n')
css = (scratch / 'production.css').read_text()
# Fonts come embedded from design-system/tokens; the served @font-face URLs do not exist offline.
css = re.sub(r'@font-face \{[^}]*\}\n?', '', css)
(out / 'production.css').write_text(css)
print(out)
