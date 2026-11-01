#!/usr/bin/env python3
"""Inline the design-system tokens, fonts and the shared picker into page.src.html.

Writes taitekohdat.html beside this file: one offline page, no network.
Run from anywhere: python3 issues/proto-settings-breakpoints/prototypes/build.py
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
lib = ds / "prototypes" / "lib"
# The shared picker verbatim; its wiring expects `stage` and `variants` from the page.
html = src.replace("/*TOKENS*/", tokens)
html = html.replace("/*PICKER_CSS*/", (lib / "picker.css").read_text())
html = html.replace("/*PICKER_JS*/", (lib / "picker.js").read_text())
out = here / "taitekohdat.html"
out.write_text(html)
print(out, out.stat().st_size)
