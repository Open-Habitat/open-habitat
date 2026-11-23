# library-intro

The capability section's intro: tens of thousands of programs, the four sourced claims, and a wall of real program names.

## v1 changes

- Kicker "One ordinary server, everything on it". The paragraph is tightened, and the headline is unchanged.
- **The four claims are exactly round 5/6's "Claims to verify"** (FFmpeg, SQLite, QGIS, Git), with the same quotations and URLs. No new claim was added.
- **The program wall** replaces the comma list. It has the eight fields in the order of the capability groups below it (Video and sound, Pictures, 3D and making, Paper and files, Maps and routes, Documents and print, Data and numbers, The web), with 7–10 well-known programs each. The four sourced programs are marked ★ with the key "★ quoted above". Each name's tooltip gives its Ubuntu package. The wall uses no logos, so no logo licences are involved.
- Whisper and DuckDB are named as fetched from the project, because neither is in the noble archive (`apt-cache show duckdb` finds nothing).

## How the wall was checked

On Ubuntu 24.04.5 LTS (main, universe, restricted, multiverse), 23 November 2026:

```
for p in ffmpeg audacity kdenlive … rustc; do apt-cache show --no-all-versions $p | grep -E '^(Section|Version)'; done
apt-cache dumpavail | grep -c '^Package:'   # 94635 binary packages: "tens of thousands" holds
```

Every package in `WALL` (block.js) returned a record. Some versions: ffmpeg 7:6.1.1, blender 4.0.2, qgis 3.34.4, libreoffice 24.2.7, r-base 4.3.3, sqlite3 3.45.1, git 2.43.0, tesseract-ocr 5.3.4, pandoc 3.1.3. These are not in the archive and were left out: rembg, freecad, cura, typst, duckdb, zola, manim, himalaya. MuseScore is the `musescore3` package.

## Sources and licenses

No third-party files. The program names are only names.

## Engine needs

None.
