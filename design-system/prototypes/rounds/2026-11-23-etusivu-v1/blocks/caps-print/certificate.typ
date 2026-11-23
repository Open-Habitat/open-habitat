// Maple Lane School's swimming certificate: one A5 landscape page per pupil,
// read from pupils.csv. Compiled by assets.mjs, once per class:
//   typst compile --input class=7B certificate.typ certificates-7B.pdf
// Without --input class it sets all 118. Fonts: P052 and Z003 (URW base 35).
#let only = sys.inputs.at("class", default: none)
#let rows = csv("pupils.csv", row-type: dictionary).filter(r => only == none or r.class == only)

#let navy = rgb("#1f3a5c")
#let gold = rgb("#b08d3c")
#let paper = rgb("#fcfaf3")
#let water = rgb("#2f6f9c")
// Level colours: the ribbon and the badge.
#let tone = (
  "1": rgb("#3f8f6b"),
  "2": rgb("#2f6f9c"),
  "3": rgb("#7a4f9a"),
  "4": rgb("#b3532e"),
)

#set page(width: 210mm, height: 148mm, margin: 0mm, fill: paper)
#set text(font: "P052", size: 11pt, fill: navy)

// One line of waves, w wide, made of n cubic crests.
#let waves(w, n: 14, amp: 2.2mm, stroke: 0.8pt + water) = {
  let step = w / n
  curve(
    stroke: stroke,
    curve.move((0mm, 0mm)),
    ..range(n).map(i => curve.cubic(
      (step * i + step * 0.35, -amp),
      (step * i + step * 0.65, amp),
      (step * (i + 1), 0mm),
    )),
  )
}

// The school's mark: a maple leaf would need a drawing, so the pool does it.
#let seal(c) = box(width: 17mm, height: 17mm, {
  place(center + horizon, circle(radius: 8.5mm, stroke: 0.9pt + c))
  place(center + horizon, circle(radius: 7.3mm, stroke: 0.35pt + c))
  for (k, dy) in ((0, -2.4mm), (1, 0.4mm), (2, 3.2mm)) {
    place(center + horizon, dy: dy, waves(9mm, n: 3, amp: 1.5mm, stroke: 0.9pt + c))
  }
})

#let certificate(r) = {
  let c = tone.at(r.level)
  // Frame: a navy rule with a fine gold one inside it.
  place(top + left, dx: 7mm, dy: 7mm, rect(width: 196mm, height: 134mm, stroke: 1.1pt + navy))
  place(top + left, dx: 9mm, dy: 9mm, rect(width: 192mm, height: 130mm, stroke: 0.4pt + gold))
  // The pool along the bottom.
  for (k, a) in ((0, 55%), (1, 35%), (2, 18%)) {
    place(bottom + left, dx: 9mm, dy: -(13mm + k * 3.6mm), waves(192mm, n: 24, amp: 1.6mm, stroke: 0.7pt + water.transparentize(100% - a)))
  }
  // The level ribbon, top right.
  place(top + right, dx: -20mm, dy: 9mm, polygon(
    fill: c,
    (0mm, 0mm), (16mm, 0mm), (16mm, 30mm), (8mm, 25mm), (0mm, 30mm),
  ))
  place(top + right, dx: -20mm, dy: 12.5mm, box(width: 16mm, align(center, text(fill: white, {
    text(size: 6.5pt, tracking: 0.12em, font: "Nimbus Sans", weight: "bold")[LEVEL]
    v(-1.5mm)
    text(size: 24pt, weight: "bold", r.level)
  }))))

  place(top + center, dy: 19mm, block(width: 150mm, align(center, stack(
    dir: ttb,
    seal(navy),
    3.5mm,
    text(size: 8.5pt, tracking: 0.28em)[MAPLE LANE SCHOOL],
    7mm,
    text(size: 30pt, tracking: 0.01em)[Swimming Certificate],
    6mm,
    text(size: 10.5pt, style: "italic", fill: navy.lighten(25%))[This is to certify that],
    5.5mm,
    text(font: "Z003", size: 40pt, fill: c, r.first + " " + r.last),
    4mm,
    line(length: 96mm, stroke: 0.4pt + gold),
    4.5mm,
    par(leading: 0.62em, text(size: 11.5pt)[
      of class #r.class has swum *#r.metres metres* without stopping \
      and is awarded *Level #r.level* of the school swimming award.
    ]),
  ))))

  // Date and the two lines the teachers sign after printing.
  place(bottom + center, dy: -25mm, block(width: 166mm, grid(
    columns: (1fr, 1fr, 1fr),
    align: center,
    ..(
      ([18 December 2026], [Date]),
      ([], [Swimming teacher]),
      ([], [Head teacher]),
    ).map(((top, label)) => stack(
      dir: ttb,
      box(height: 5mm, align(bottom, text(size: 10.5pt, top))),
      1.6mm,
      line(length: 44mm, stroke: 0.5pt + navy),
      1.8mm,
      text(size: 6.5pt, tracking: 0.14em, font: "Nimbus Sans", fill: navy.lighten(20%), upper(label)),
    )),
  )))
}

#for (i, r) in rows.enumerate() {
  if i > 0 { pagebreak() }
  certificate(r)
}
