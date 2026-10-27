#!/bin/sh
# Regenerates the round's synthetic media and writes them as base64 into round.js's MEDIA line:
# a 5-second VP9 intro (SVG frames → rsvg-convert → ffmpeg), an animated GIF spinner and its
# first frame (ImageMagick). The prototype is offline, so the bytes live in the page itself.
# Run from anywhere: sh design-system/prototypes/rounds/2026-10-27-tiedostotyypit/make-media.sh
set -eu
here=$(cd "$(dirname "$0")" && pwd)
work=$(mktemp -d /var/tmp/ft-media.XXXXXX)
cd "$work"
python3 - <<'PY'
import math
W, H = 480, 270
for i in range(60):
    t = i / 12
    x = 40 - 60 * (1 - min(1, t / 1.2)) ** 2
    bar = 400 * min(1, t / 4)
    open(f'f{i:03d}.svg', 'w').write(f'''<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}">
<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#1e4fb0"/><stop offset="1" stop-color="#18a383"/></linearGradient></defs>
<rect width="{W}" height="{H}" fill="url(#g)"/>
<circle cx="{380 + 20 * math.sin(t * 1.3)}" cy="{70 + 10 * math.cos(t)}" r="{38 + 4 * math.sin(t * 2)}" fill="#ffd166" opacity=".9"/>
<path d="M0 {210 + 6 * math.sin(t)} Q120 {170 + 8 * math.cos(t * 1.2)} 240 205 T480 {195 + 6 * math.sin(t * .8)} V270 H0Z" fill="#0f2f5a" opacity=".55"/>
<text x="{x:.1f}" y="120" font-family="DejaVu Sans" font-weight="bold" font-size="30" fill="#fff" opacity="{min(1, t / 1.2):.2f}">Kevätkampanja 2027</text>
<text x="40" y="152" font-family="DejaVu Sans" font-size="16" fill="#e8f0ff" opacity="{max(0, min(1, (t - 1.2) / 1)):.2f}">Pyöräile saariston reitti 12.4.–31.5.</text>
<rect x="40" y="236" width="400" height="6" rx="3" fill="#ffffff" opacity=".25"/>
<rect x="40" y="236" width="{bar:.0f}" height="6" rx="3" fill="#fff"/>
</svg>''')
PY
for f in f*.svg; do rsvg-convert "$f" -o "${f%.svg}.png"; done
ffmpeg -loglevel error -y -framerate 12 -i f%03d.png -c:v libvpx-vp9 -b:v 90k -pix_fmt yuv420p -an video.webm
for i in $(seq 0 11); do a=$((i * 30)); convert -size 96x96 xc:white -fill none -stroke '#d5dae2' -strokewidth 9 -draw "circle 48,48 48,14" -stroke '#2f6fdf' -draw "arc 14,14 82,82 $a,$((a + 100))" "g$(printf %02d "$i").png"; done
convert -delay 8 -loop 0 g*.png -layers Optimize spinner.gif
convert 'spinner.gif[0]' still.png
node -e '
const fs = require("fs"); const b = (f) => fs.readFileSync(f).toString("base64");
const line = `const MEDIA = { video: "${b("video.webm")}", gif: "${b("spinner.gif")}", still: "${b("still.png")}" };`;
const p = process.argv[1]; fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/^const MEDIA = .*$/m, () => line));
' "$here/round.js"
cd / && rm -r "$work"
