# Result

The sidebar's archived group heading is now a quiet section heading. It reads "ARKISTOIDUT" in the same muted 11 px uppercase, letter-spaced style as the rail's Työtilat heading, with the workspace rows' disclosure chevron in front: it points right when the group is closed and down when it is open. It has no count, no bold and no button surface. Hovering gives it the rail's hover tint, so it still reads as something that opens. It remains a `button` with `aria-expanded`, and its accessible name is now "Arkistoidut".

## Evidence

The before images are `issues/archive-workspace-restore/lab-*-archived-group.png`. They were captured from the same lab before this change, and they show "Arkistoidut 1" as an accent-coloured bold label.

The after images, made with `capture.mjs`, are `lab-after-{desktop,phone}-{light,dark}-archived-{collapsed,group}.{png,html}`. The Palauta button in the opened group now has the text-button surface from `buttons-no-surface`.

`tests/workspace-archive.spec.ts` now finds the toggle by the exact name "Arkistoidut".

## Decisions for later review

- **Not a heading element.** The heading is not an `h2`. The rail's Työtilat heading is not a heading element either, and the region is already named "Arkistoidut työtilat".
