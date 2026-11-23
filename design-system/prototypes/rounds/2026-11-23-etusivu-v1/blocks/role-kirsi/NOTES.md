# role-kirsi

Kirsi, finance (in-house): October's books from the bank statement, the VAT
return previewed and sent on her yes, the cash slide for her 14:30 with Alice.

## What changed and why

The three picked glimpses now run on one real set of books instead of
invented figures, so every number on the screens comes from the same ledger
and adds up.

- **The books (12:50).** `assets.mjs` generates Example Studio's October
  in Beancount from a seed: 184 bank-statement lines (shop terminal payouts,
  web shop payouts, market cash deposits, wholesale invoices including two
  intra-EU 0 % sales, seven salaries, payroll and VAT settlements, rent,
  suppliers, two EU linen purchases and three EU software subscriptions on
  reverse charge). A `balance` directive holds the books to the statement's
  closing balance, so `bean-check` proves they land on the bank to the cent.
  The three questions (garden centre, electrician, parking without a
  receipt) sit on `Assets:Suspense` in the 12:50 ledger and are booked with
  Kirsi's answers in the closed ledger the VAT and the forecast use. The
  `bean-query` output in the work is the program's real output. The view is
  a small income statement drawn from the same ledger (sales by channel,
  costs, the result), the bank check and the three open payments.
- **The VAT return (13:40).** The return is a clean form (new HTML view, not
  a screenshot) whose lines are computed from the closed ledger: domestic
  sales VAT at 25.5 %, the 14 % and 10 % lines at zero, reverse-charge VAT on
  EU goods and services, deductible VAT, tax to pay **€6,480.85**, and the
  EU information lines. Each line with entries opens (engine toggle) to its
  entry count and largest entries. The `bean-query` VAT totals in the work
  match the form. It is sent only after “Yes, file it.”, stamped “Filed 13:45”.
  Due 12 December: monthly VAT is due on the 12th of the second month after
  the period, which is the Finnish rule the 25.5 % rate implies.
- **The cash slide (14:20).** `runway.py` (Kirsi's own tool in the story)
  reads the closed ledger with Beancount's loader and runs the bank balance
  forward twelve months from October's actuals: a seasonal pattern, the
  2027 supplier prices (+6.4 % on materials from January), VAT and payroll
  paid on their real lags, June holiday pay; a second run adds a €13,400
  press in March. Its printed table is the tool output in the work, and
  matplotlib draws the slide from its JSON: “Cash stays above our floor
  until July”, nine months, seven with the press. The slide is drawn at a
  size that reads in the ~600 px view.
- Copy: Kirsi's blurb, the three `did` lines and the replies tightened around
  what she wants (the month closed, nothing sent without her, one answer for
  the meeting). Sidebar lines follow the numbers (`€6,480.85 to pay · file
  it?`, `Above the floor until July`).
- The two unpicked glimpses (price lists, Christmas stock) are unchanged.

## Assets and how they are made

`node blocks/role-kirsi/assets.mjs` (with `TMPDIR` set to scratch) writes
`$ETUSIVU_ASSETS/role-kirsi/cash-2026-11.webp` (1200×675, ~32 KB). It:

1. creates a venv in `$TMPDIR/role-kirsi-venv` with `uv` and installs
   beancount 3.2.3, beanquery 0.2.0, matplotlib 3.11.2, fonttools 4.60.1,
   brotli 1.1.0 from PyPI;
2. writes the 12:50 and closed ledgers, runs `bean-check` on both and the
   two `bean-query` queries, and runs `runway.py`; **it fails if any output
   differs from `OUT` in block.js**, printing the new output to paste;
3. instances Instrument Sans (design-system/fonts, OFL) at 400/600/700 with
   fontTools so matplotlib can use the weights, renders the slide with
   matplotlib, and converts it to WebP with ImageMagick.

block.js imports `facts()` from assets.mjs, so the views' numbers are
computed at build time from the same generated transactions; only the
programs' printed output is pasted (and verified).

hledger was the first choice, but its official Linux release is x86-64 only
and this build host is aarch64; Beancount installs from PyPI with aarch64
wheels and does the same job.

## Sources and licenses

No third-party media. Instrument Sans is the design system's bundled font
(SIL Open Font License, see `design-system/fonts/AGENTS.md`); Beancount
(GPL-2.0), beanquery (GPL-2.0) and matplotlib (PSF-based licence) are run as
programs, nothing of theirs ships.

## Assumptions about the product

The agent runs `bean-check`, `bean-query` and Kirsi's own Python tools in her
workspace; `tools/vat_file.py --submit` is her own tool calling the tax
authority's filing interface, run only after her explicit yes. Nothing is
scheduled. The figures, suppliers, customers and places are invented.

## For Jari

- October shows a small loss (−€1,136.92) before Christmas; that is what
  makes the runway question real. If the page should show a healthier
  studio, change the sales ranges in `ledger()` and rerun `assets.mjs`; it
  prints the new outputs for `OUT`.
- The slide says “until July” (the last month-end above the €15,000 floor),
  not “11 months” as in round 6: the numbers decided it.

## Engine needs

None. The VAT drill-down uses the engine's `data-view`/`data-set` toggle.
