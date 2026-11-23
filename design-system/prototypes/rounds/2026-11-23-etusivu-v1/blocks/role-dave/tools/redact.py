"""Redacts PDFs so the text cannot be recovered (PyMuPDF).

    python3 redact.py <dir with PDFs and redactions.csv> <out-dir>

For every row of redactions.csv (document, text, reason) the text is found on
the page, marked with a redaction annotation and the annotation applied:
MuPDF then deletes the characters under the box from the page's content
stream and paints the box in their place. The document's metadata is
cleared, and the file is rewritten from scratch (no incremental save, unused
objects dropped), so no earlier version of a page stays inside it.
Prints one line per document; exits 1 if a listed text is not found.
"""
import csv
import sys
from collections import defaultdict
from pathlib import Path

import pymupdf


def main(src, out):
    src, out = Path(src), Path(out)
    out.mkdir(parents=True, exist_ok=True)
    todo = defaultdict(list)
    with open(src / 'redactions.csv', newline='') as f:
        for row in csv.DictReader(f):
            todo[row['document']].append(row['text'])
    total = 0
    missing = []
    for pdf in sorted(src.glob('*.pdf')):
        doc = pymupdf.open(pdf)
        n = 0
        for text in todo.get(pdf.name, []):
            hits = 0
            for page in doc:
                for rect in page.search_for(text):
                    # A hair inside the found box, so the comma or bracket next to it stays.
                    page.add_redact_annot(rect + (0.7, 0.7, -0.7, -0.7), fill=(0, 0, 0))
                    hits += 1
            if not hits:
                missing.append(f'{pdf.name}: "{text}"')
            n += hits
        for page in doc:
            page.apply_redactions()
        doc.set_metadata({})
        doc.del_xml_metadata()
        doc.save(out / pdf.name, garbage=4, deflate=True, clean=True)
        total += n
        print(f'{pdf.name}: {n} redactions')
    print(f'{len(list(src.glob("*.pdf")))} documents · {total} redactions · text removed, not covered · metadata cleared')
    if missing:
        sys.exit('not found: ' + '; '.join(missing))


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
