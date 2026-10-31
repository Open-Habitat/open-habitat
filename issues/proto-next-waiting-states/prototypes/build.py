#!/usr/bin/env python3
"""Inline the design-system tokens and fonts into page.src.html.

Writes tilakoneet.html (round 1) and tilakoneet-2.html (round 2) beside this
file: each one offline page, no network.
Run from anywhere: python3 issues/proto-next-waiting-states/prototypes/build.py
"""
import base64
import pathlib

here = pathlib.Path(__file__).resolve().parent
repo = here.parents[2]
ds = repo / "design-system"
src = (here / "page.src.html").read_text()
tokens = "\n".join((ds / "tokens" / f).read_text() for f in ("colors.css", "typography.css", "spacing.css", "motion.css"))
import re
# The tokens name the fonts by relative URL; inline them so nothing is fetched.
tokens = re.sub(r'url\("\.\./fonts/([^"]+)"\)',
                lambda m: "url(data:font/woff2;base64," + base64.b64encode((ds / "fonts" / m.group(1)).read_bytes()).decode() + ")",
                tokens)
faces = []
PICKS = {
    1: ("tilakoneet.html", ["Nykyinen", "Työn ajan", "Saapuminen", "Kierros eteenpäin"]),
    2: ("tilakoneet-2.html", ["Nykyinen", "Vuoron loppuun", "Paikka pysyy", "Lähtöön asti"]),
}
page = src.replace("/*FONTS*/", "\n".join(faces)).replace("/*TOKENS*/", tokens)
for rnd, (name, labels) in PICKS.items():
    active = ' data-active aria-current="true"'
    items = "\n".join(
        f'  <button class="proto-picker-item"{active if i == 0 else ""}>{label}</button>'
        for i, label in enumerate(labels))
    out = page.replace("<!--PICKER-->", items).replace("/*ROUND*/1", str(rnd))
    if rnd == 2:
        out = out.replace("<title>Sillä aikaa -rivi tilakoneena</title>", "<title>Sillä aikaa -rivi tilakoneena, kierros 2</title>")
    (here / name).write_text(out)
    print(here / name, len(out))
