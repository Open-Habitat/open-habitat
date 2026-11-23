"""Writes the invented personnel file the redaction scene works on: eleven
documents for a former Example Studio employee, Nora Hale, as HTML that
assets.mjs prints to PDF with Chromium (as an office program would have).
Everything in them is made up. Other people's details are marked in the
source as [[text|reason]]; the marks are dropped from the document and
written to redactions.csv, the list the agent draws up by reading the file
and that Dave checks. redact.py applies it.

    python3 make_file.py <out-dir> <dir with the Instrument Sans woff2 files>
"""
import csv
import re
import sys
from pathlib import Path


CSS = """
@page { size: A4; margin: 21mm 22mm; }
@font-face { font-family: "Instrument Sans"; src: url("FONTS/instrument-sans-latin.woff2") format("woff2"); font-weight: 400 700; }
html { font: 400 11pt/1.5 "Instrument Sans", sans-serif; color: #1c1f1d; }
body { margin: 0; }
.k { font-size: 8pt; font-weight: 600; color: #5d665f; letter-spacing: .09em; text-transform: uppercase; margin: 0 0 14pt; padding-bottom: 7pt; border-bottom: 1.2pt solid #1c1f1d; }
h1 { font-size: 21pt; font-weight: 650; letter-spacing: -.01em; margin: 0 0 2pt; }
.sub { color: #5d665f; margin: 0 0 14pt; }
h2 { font-size: 12pt; font-weight: 650; margin: 15pt 0 4pt; }
p { margin: 0 0 7pt; }
table { border-collapse: collapse; width: 100%; margin: 4pt 0 9pt; }
th { text-align: left; font-size: 8.5pt; font-weight: 600; color: #5d665f; letter-spacing: .05em; text-transform: uppercase; border-bottom: .8pt solid #1c1f1d; padding: 3pt 10pt 4pt 0; }
td { border-bottom: .5pt solid #c9cfc8; padding: 5pt 10pt 5pt 0; font-size: 10.5pt; vertical-align: top; white-space: nowrap; }
td:last-child { white-space: normal; }
.foot { font-size: 8.5pt; color: #5d665f; margin-top: 18pt; }
"""

HEAD = '<p class="k">Example Studio · Personnel file · Nora Hale · employee 0117</p>'


def table(head, rows):
    return '<table><tr>' + ''.join(f'<th>{h}</th>' for h in head) + '</tr>' + ''.join('<tr>' + ''.join(f'<td>{c}</td>' for c in r) + '</tr>' for r in rows) + '</table>'


DOCS = [
    ('01-employment-contract', 'Employment contract', 'Signed 14 February 2022', """
<p>Example Studio employs Nora Hale as a packer and shop assistant from 1 March 2022, 30 hours a week, at €16.20 an hour.</p>
<p>The notice period is one month on either side. Working hours follow the rota published on the 20th of the month before.</p>
<p>Signed for Example Studio by Dave. Witness: [[Hanna Brook|name]], [[8 Birch Road|address]].</p>"""),
    ('02-contract-amendment', 'Contract amendment', '1 September 2023', """
<p>From 1 September 2023 Nora Hale works 34 hours a week at €17.10 an hour and holds a key to the packing room.</p>
<p>The rise brings her pay close to that of [[Mikael Strand|name]], who is paid [[€17.60|pay]], and below [[Tessa Rowe|name]] at [[€19.40|pay]].</p>
<p>Signed for Example Studio by Dave.</p>"""),
    ('03-pay-summary-2023', 'Pay summary 2023', 'Prepared January 2024', """
<p>Gross pay for 2023: €24,912.60. Overtime included: 41 hours. Holiday pay carried over: 3 days.</p>
""" + table(['Quarter', 'Hours', 'Gross'], [['Q1', '390', '€6,318.00'], ['Q2', '396', '€6,415.20'], ['Q3', '412', '€5,846.40'], ['Q4', '444', '€6,333.00']]) + """
<p>Payroll note: the December figure was first posted to [[Jonas Feld|name]], employee [[0121|employee number]], and corrected on 9 January.</p>"""),
    ('04-shift-record-2024-03', 'Shift and overtime record', 'March 2024', """
<p>Shifts worked by Nora Hale in the packing room and the shop, with changes agreed during the month.</p>
""" + table(['Date', 'Shift', 'Hours', 'Note'], [
        ['Thu 7 March', 'Pack', '9', 'Wholesale day, 2 h overtime'],
        ['Thu 14 March', 'Shop', '7.5', 'Swapped with [[Mikael Strand|name]]; approved by Dave'],
        ['Sat 16 March', 'Shop', '6', 'Covered for [[Tessa Rowe|name]] ([[sick leave|health]])'],
        ['Wed 27 March', 'Pack', '9.5', 'Easter orders, 4 h overtime'],
    ]) + """
<h2>Overtime</h2>
<p>Overtime in March: 6 hours, approved by Dave and paid in April at €17.10 an hour plus 50 %.</p>
<p>For comparison, [[Jonas Feld|name]] worked [[9 hours|hours]] and [[Ida Marsh|name]] [[4 hours|hours]] of overtime in March, both at [[€19.40|pay]] an hour.</p>
<h2>Keys</h2>
<p>Key 7 to the packing room was held by Nora Hale all month. The second key holder was [[Hanna Brook|name]], [[8 Birch Road|address]], telephone [[555 0142|telephone]].</p>
<p class="foot">Kept in people/files/. Changes to this record are made by Dave.</p>"""),
    ('05-review-2023', 'Yearly review', '22 November 2023', """
<p>Nora packs accurately and fast: 0.4 % of her orders came back with a packing fault, the lowest in the room.</p>
<p>She trained two new packers this autumn, [[Peter Voss|name]] and [[Ida Marsh|name]]. [[Peter|name]] needed [[a second week because of his wrist|health]].</p>
<p>Agreed for 2024: the wholesale desk on Thursdays, and the first-aid course in spring.</p>"""),
    ('06-training-record', 'Training record', '2022 to 2024', table(['Date', 'Course', 'Result'], [
        ['12 April 2022', 'Safety at the press', 'Passed'],
        ['3 October 2022', 'Till and returns', 'Passed'],
        ['18 April 2024', 'First aid, one day', 'Passed'],
    ]) + """
<p>The first-aid course was attended together with [[Tessa Rowe|name]] and [[Jonas Feld|name]]; [[Jonas|name]] [[did not pass|result]].</p>"""),
    ('07-sick-leave', 'Absences', '2022 to 2024', table(['From', 'To', 'Days', 'Certificate'], [
        ['6 February 2023', '8 February 2023', '3', 'Self-certified'],
        ['11 September 2023', '15 September 2023', '5', 'Doctor'],
    ]) + """
<p>During the September absence the Thursday wholesale shifts were packed by [[Mikael Strand|name]].</p>"""),
    ('08-incident-note', 'Incident note', '9 May 2024', """
<p>At about 14:20 a pallet of tote bags slipped from the lower shelf in the packing room. Nobody was hurt.</p>
<p>Nora Hale was at the bench. The pallet had been stacked that morning by [[Peter Voss|name]], who [[has since had a written reminder|disciplinary]].</p>
<p>Reported by [[Hanna Brook|name]] ([[hanna.brook@example.org|email]]). The shelf now has a lip.</p>"""),
    ('09-email-holiday-2024', 'Email: summer holiday 2024', 'Printed from the office mailbox', """
<p><b>From:</b> Nora Hale · <b>To:</b> Dave · 2 April 2024</p>
<p>Could I have weeks 28 to 30 off this summer?</p>
<p><b>From:</b> Dave · <b>To:</b> Nora Hale · 3 April 2024</p>
<p>Weeks 28 and 29 are yours. Week 30 is already promised to [[Ida Marsh|name]], [[whose daughter starts school that week|family]]. Would week 31 do instead?</p>
<p><b>From:</b> Nora Hale · <b>To:</b> Dave · 3 April 2024</p>
<p>Week 31 is fine. Thank you.</p>"""),
    ('10-leaving-checklist', 'Leaving checklist', 'Last day 28 June 2024', table(['Item', 'Done', 'By'], [
        ['Key 7 returned', '28 June', 'Dave'],
        ['Till login closed', '28 June', 'Kirsi'],
        ['Final pay and holiday pay', '15 July', 'payroll'],
        ['Wholesale desk handed over', '27 June', '[[Mikael Strand|name]]'],
    ]) + """
<p>Forwarding address for the final payslip: 21 Mill Lane (Nora Hale's own).</p>"""),
    ('11-reference', 'Reference', '1 July 2024', """
<p>Nora Hale worked at Example Studio from 1 March 2022 to 28 June 2024 as a packer and shop assistant, and from 2024 at the wholesale desk.</p>
<p>She is exact, calm in the Christmas rush, and good at teaching others. We would gladly employ her again.</p>
<p>Dave, HR and office, Example Studio</p>"""),
]

MARK = re.compile(r'\[\[(.+?)\|(.+?)\]\]')


def main(out, fonts):
    out = Path(out)
    out.mkdir(parents=True, exist_ok=True)
    css = CSS.replace('FONTS', Path(fonts).resolve().as_uri())
    rows = []
    for name, title, sub, body in DOCS:
        for text, reason in MARK.findall(body):
            if (f'{name}.pdf', text, reason) not in rows:
                rows.append((f'{name}.pdf', text, reason))
        html = f'<!doctype html><meta charset="utf-8"><title>{title} · Nora Hale</title><style>{css}</style>{HEAD}<h1>{title}</h1><p class="sub">{sub}</p>' + MARK.sub(r'\1', body)
        (out / f'{name}.html').write_text(html)
    with open(out / 'redactions.csv', 'w', newline='') as f:
        w = csv.writer(f)
        w.writerow(['document', 'text', 'reason'])
        w.writerows(rows)
    print(f'{len(DOCS)} documents · {len(rows)} entries in redactions.csv')


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
