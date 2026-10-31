#!/usr/bin/env python3
"""Inline the design-system tokens and fonts into page.src.html.

Writes tilakoneet.html beside this file: one offline page, no network.
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
out = src.replace("/*FONTS*/", "\n".join(faces)).replace("/*TOKENS*/", tokens)
(here / "tilakoneet.html").write_text(out)
print(here / "tilakoneet.html", len(out))
