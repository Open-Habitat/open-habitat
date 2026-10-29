#!/usr/bin/env python3
"""Build index.html: source.html with the production tokens and fonts inlined.

The result is one offline file. It does not use the prototype library or
production components, because bundled builds render blank in Habitat views.
Usage: python3 build.py  (from any directory)
"""
import base64
import pathlib
import re

here = pathlib.Path(__file__).resolve().parent
repo = here.parents[3]
tokens = repo / "design-system" / "tokens"
fonts = repo / "design-system" / "fonts"


def inline_font(match: re.Match) -> str:
    data = base64.b64encode((fonts / match.group(1)).read_bytes()).decode()
    return f'url("data:font/woff2;base64,{data}")'


css = []
for name in ("colors.css", "spacing.css", "typography.css", "motion.css"):
    text = (tokens / name).read_text()
    if name == "typography.css":
        # The composer's shell font is not used here; drop its face.
        text = re.sub(r'@font-face \{\s*font-family: "Habitat Composer";[^}]*\}', "", text)
        text = re.sub(r'url\("\.\./fonts/([^"]+)"\)', inline_font, text)
    css.append(f"/* design-system/tokens/{name} */\n{text}")

source = (here / "source.html").read_text()
assert source.count("/*@TOKENS@*/") == 1
out = source.replace("/*@TOKENS@*/", "\n".join(css))
(here / "index.html").write_text(out)
print(f"{here / 'index.html'} {len(out.encode()) // 1024} KiB")
