#!/usr/bin/env python3
"""Inline the design-system tokens and fonts into page.src.html.

Writes selitys.html beside this file: one offline page, no network.
Run from anywhere: python3 issues/proto-conversation-header-actions-r4/prototypes/build.py
"""
import base64
import pathlib
import re

here = pathlib.Path(__file__).resolve().parent
ds = here.parents[2] / "design-system"
src = (here / "page.src.html").read_text()
tokens = "\n".join((ds / "tokens" / f).read_text() for f in ("colors.css", "typography.css", "spacing.css", "motion.css"))
# The tokens name the fonts by relative URL; inline them so nothing is fetched.
tokens = re.sub(r'url\("\.\./fonts/([^"]+)"\)',
                lambda m: "url(data:font/woff2;base64," + base64.b64encode((ds / "fonts" / m.group(1)).read_bytes()).decode() + ")",
                tokens)
out = here / "selitys.html"
out.write_text(src.replace("/*TOKENS*/", tokens))
print(out, out.stat().st_size)
