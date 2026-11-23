// Example Studio's quote template, filled in for the Harbour Hotel lobby.
// typst compile quote.typ Q-2026-118.pdf   (Typst 0.15; built-in Libertinus Serif)
#let indigo = rgb("#27406b")
#let ink = rgb("#26261f")
#let muted = rgb("#6b675c")
#let linen = rgb("#f4efe4")
#let rule = rgb("#d9d1c0")

#set page(paper: "a4", margin: (x: 22mm, top: 0mm, bottom: 20mm), fill: white,
  footer: context [
    #set text(7.5pt, fill: muted)
    #line(length: 100%, stroke: 0.5pt + rule)
    #v(-2pt)
    Example Studio · 4 Granary Yard · studio.example.org · Hand-printed linen since 2014
    #h(1fr) Q-2026-118 · page #counter(page).display()
  ])
#set text(font: "Libertinus Serif", size: 10.5pt, fill: ink, lang: "en")
#set par(leading: 0.62em)

// The studio's block-print motif as a strip under a plain indigo band.
#let motif = tiling(size: (12pt, 12pt))[
  #place(dx: 2.5pt, dy: 2.5pt, circle(radius: 3.5pt, fill: none, stroke: 1pt + indigo))
  #place(dx: 5pt, dy: 5pt, circle(radius: 1pt, fill: indigo))
]
#place(top + left, dx: -22mm, stack(
  block(width: 210mm, height: 28mm, fill: indigo),
  block(width: 210mm, height: 9mm, fill: linen, inset: 0pt)[#block(width: 100%, height: 100%, fill: motif)],
))
#v(9mm)
#grid(columns: (1fr, auto), align: (left + horizon, right + horizon),
  text(fill: white, size: 26pt, weight: "bold", tracking: 0.5pt)[Example Studio],
  text(fill: white.transparentize(15%), size: 9pt)[Hand-printed linen \ studio.example.org])
#v(22mm)

#grid(columns: (1fr, 1fr), gutter: 10mm,
  [
    #text(8pt, fill: muted, tracking: 1.2pt)[QUOTE FOR] \
    #text(13pt, weight: "bold")[Harbour Hotel] \
    Nina Holm, operations manager \
    1 Harbour Road \
    harbourhotel.example.org
  ],
  align(right)[
    #text(30pt, weight: "bold", fill: indigo)[Quote] \
    #v(-4pt)
    #table(columns: 2, stroke: none, inset: (x: 0pt, y: 2.5pt), column-gutter: 10pt, align: (right, left),
      text(fill: muted)[Number], [Q-2026-118],
      text(fill: muted)[Date], [19 November 2026],
      text(fill: muted)[Valid until], [19 December 2026])
  ])
#v(9mm)

#text(13pt)[Six large prints for the renovated lobby]
#v(-3pt)
#text(fill: muted)[As we agreed at the hotel today: indigo prints on our 240 g linen, framed in oak and hung by us before the lobby reopens.]
#v(5mm)

#let money(x) = {
  let s = str(calc.floor(x))
  let c = str(calc.round((x - calc.floor(x)) * 100)).clusters()
  let cents = if c.len() == 1 { "0" + c.at(0) } else { c.join() }
  let g = s.clusters().rev().chunks(3).map(p => p.rev().join()).rev().join(",")
  [€#g.#cents]
}
#let rows = (
  ([Large print, indigo on linen, 90 × 120 cm], [Hand-printed in the studio, one design in six colourways], 6, 490.00),
  ([Oak frame, 90 × 120 cm], [Solid oak, oiled; non-reflective glazing], 6, 260.00),
  ([Hanging in the lobby], [Two of us, one morning in week 3 of January 2027], 1, 480.00),
)
#let sub = rows.map(r => r.at(2) * r.at(3)).sum()
#let vat = calc.round(sub * 0.255, digits: 2)
#table(
  columns: (1fr, auto, auto, auto),
  stroke: (x, y) => if y == 0 { (bottom: 0.8pt + ink) } else { (bottom: 0.5pt + rule) },
  inset: (x: 6pt, y: 8pt),
  align: (left, right, right, right),
  table.header(..([Item], [Qty], [Unit price], [Amount]).map(h => text(8pt, tracking: 1pt, fill: muted, upper(h)))),
  ..rows.map(r => (
    [#r.at(0) \ #text(8.5pt, fill: muted, r.at(1))],
    [#r.at(2)], money(r.at(3)), money(r.at(2) * r.at(3)),
  )).flatten(),
)
#align(right, table(columns: (auto, 34mm), stroke: none, inset: (x: 6pt, y: 4pt), align: (right, right),
  text(fill: muted)[Subtotal], money(sub),
  text(fill: muted)[VAT 25.5 %], money(vat),
  table.hline(stroke: 0.8pt + ink),
  text(weight: "bold")[Total], text(weight: "bold", size: 13pt, fill: indigo, money(sub + vat)),
))
#v(6mm)

#block(fill: linen, inset: 11pt, radius: 3pt, width: 100%)[
  #text(8pt, tracking: 1.2pt, fill: muted)[TERMS] \
  #v(-2pt)
  #set text(9.5pt)
  The quote is valid for 30 days. We print and frame in December and hang the prints on a morning in
  week 3 of January that suits you. Invoice after hanging, 14 days net. Each print is made by hand,
  so small variations in the indigo are part of the work.
]
#v(9mm)
Thank you for today, Nina. I look forward to seeing the lobby.
#v(4mm)
#text(weight: "bold")[Bob] \
#text(fill: muted)[Sales and orders, Example Studio · bob\@studio.example.org]
