# Result

Reproduced on main after `recap-settings-polish`: at 1280 the section column is
436 px and the delay row needed 472 px, the model row 462 px. The cause was
shared: `.s-row` keeps a 160 px label beside its control however narrow the
column is, and at about 900 px (column 248 px) rows in Tili, Tekoäly, Ulkoasu,
Levy, Editori and Kokeelliset overflowed too.

- `.s-main` is a `settings-main` container; at ≤400 px rows take the phone
  layout (control under the label), and the model field's name may wrap.
- Tilannekatsaus' delay/model card stacks at ≤520 px, since its controls are
  wider than most; `ScaleSlider` never exceeds its row, the stepper keeps its
  own width under its label.
- `recap-settings.spec.ts` checks that no element of a Tilannekatsaus card
  crosses its card edge at 1280/1100/1024/900/800 with Oma and a chosen model;
  it fails on the previous CSS at 1280 (`recap-delay`).

## Decisions for later review

- Stacking point for all settings rows is a 400 px column, not the 520 px the
  recap card uses. Alternative: one higher threshold, which would put every
  toggle on every page under its label at the ordinary 1280 window; none of
  those rows overflow at 436 px, so only the recap card's wide controls stack
  there.
