#!/usr/bin/env python3
"""Cut the masked Entra crops for round 3 from Jari's screenshots.

usage: crops.py [SHOTS_DIR]   (default ~/.local/state/oh-conductor/m365-shots)

Needs Pillow with AVIF (13+), e.g. `uv venv "$TMPDIR/venv" && uv pip install
-p "$TMPDIR/venv" pillow`. The originals carry tenant, client and object ids
and the organisation's domain, so they never enter the tree: this script
crops each one, paints an opaque box over every id and the domain *before*
scaling, and writes only the scaled AVIF crops to crops/ and their record to
crops.json (box, masks, targets, size and sha256 of each output). check.mjs
reads crops.json and fails if a committed crop is missing, changed, the size
of an original, or shows anything but the mask colour inside a mask.

All coordinates are pixels of the original screenshot.
"""
import hashlib
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

HERE = Path(__file__).resolve().parent
SHOTS = Path(sys.argv[1] if len(sys.argv) > 1 else Path.home() / ".local/state/oh-conductor/m365-shots")
SCALE = 0.6
MASK = (200, 200, 200)

# name: source, crop box (l, t, r, b), masks, named targets (l, t, r, b).
# Targets are what a riff highlights or cuts out tight; masks are opaque.
CROPS = {
    "register": {
        "source": "01.png", "box": (0, 0, 1796, 1420),
        "masks": [(258, 576, 392, 622)],  # domain in "Single tenant only - <domain>"
        "targets": {
            "name": (4, 214, 1630, 396),
            "accounts": (4, 470, 890, 630),
            "redirect": (4, 770, 1330, 986),
            "register": (6, 1346, 208, 1410),
        },
    },
    "list": {
        "source": "02.png", "box": (0, 0, 1796, 1050),
        "masks": [
            (1088, 790, 1612, 1040),  # every Application (client) ID
            (60, 786, 600, 912),  # other applications' avatars and names
        ],
        "targets": {
            "new": (24, 180, 288, 240),
            "tabs": (36, 470, 252, 540),
            "search": (40, 562, 952, 626),
            "row": (36, 916, 1080, 978),
        },
    },
    "overview": {
        "source": "03.png", "box": (0, 0, 2166, 800),
        "masks": [
            (584, 482, 1086, 520),  # Application (client) ID
            (584, 570, 1086, 608),  # Object ID
            (584, 658, 1086, 696),  # Directory (tenant) ID
        ],
        "targets": {
            "menu": (0, 248, 510, 312),
            "client": (580, 448, 1092, 524),
            "object": (580, 536, 1092, 612),
            "tenant": (580, 624, 1092, 700),
            "essentials": (580, 296, 2150, 790),
        },
    },
    "auth": {
        "source": "04.png", "box": (0, 0, 2166, 750),
        "masks": [],
        "targets": {
            "menu": (0, 650, 510, 714),
            "tab": (560, 474, 906, 536),
            "settings": (1240, 474, 1362, 536),
            "add": (574, 662, 832, 718),
            "tabs": (560, 474, 1362, 536),
        },
    },
    "perms": {
        "source": "05.png", "box": (0, 0, 2166, 1130),
        "masks": [(1177, 862, 1296, 910)],  # domain in "Grant admin consent for <domain>"
        "targets": {
            "menu": (0, 842, 510, 906),
            "add": (560, 864, 818, 910),
            "grant": (840, 864, 1300, 910),
            "graph": (570, 1004, 830, 1048),
            "configured": (548, 690, 2150, 1124),
        },
    },
}


def main() -> int:
    out = HERE / "crops"
    out.mkdir(exist_ok=True)
    record = {"scale": SCALE, "mask": MASK, "originals": {}, "crops": {}}
    for name, spec in CROPS.items():
        src = Image.open(SHOTS / spec["source"]).convert("RGB")
        record["originals"][spec["source"]] = list(src.size)
        draw = ImageDraw.Draw(src)
        l, t, r, b = spec["box"]
        for m in spec["masks"]:
            assert l <= m[0] < m[2] <= r and t <= m[1] < m[3] <= b, (name, m)
            draw.rectangle(m, fill=MASK)
        crop = src.crop(spec["box"])
        size = (round(crop.width * SCALE), round(crop.height * SCALE))
        assert list(size) not in record["originals"].values()
        crop = crop.resize(size, Image.LANCZOS)
        path = out / f"{name}.avif"
        crop.save(path, "AVIF", quality=70, speed=4)
        data = path.read_bytes()
        record["crops"][name] = {
            "file": f"crops/{name}.avif", "source": spec["source"], "box": spec["box"],
            "size": size, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
            "masks": spec["masks"], "targets": spec["targets"],
        }
        print(f"{path.relative_to(HERE)} {size[0]}x{size[1]} {len(data)} B")
    (HERE / "crops.json").write_text(json.dumps(record, indent=1) + "\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
