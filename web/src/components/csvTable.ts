/** A CSV's separator: the comma, semicolon or tab its first row has most of
 * outside quotes, a comma on a tie. A spreadsheet in a Finnish locale writes
 * semicolons, because the comma is its decimal mark. The daemon's column
 * count (`countText`) uses the same rule. */
export function csvSeparator(text: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let quoted = false;
  for (const c of text) {
    if (c === '"') quoted = !quoted;
    else if (!quoted && (c === "\n" || c === "\r")) break;
    else if (!quoted && c in counts) counts[c]++;
  }
  return counts[";"] > counts[","] && counts[";"] >= counts["\t"]
    ? ";"
    : counts["\t"] > counts[","]
      ? "\t"
      : ",";
}

/** A row of cells and the text line (0-based) it starts on: a quoted line
 * break makes one row span several lines. */
export type TableRow = { cells: string[]; line: number };

/** The first rows and columns of a CSV (or TSV); quotes may hold separators,
 * doubled quotes and line breaks. Cells past the column limit are left out,
 * so one long row cannot build an unbounded table. `more` tells that rows
 * past the limit were left out. */
export function readTable(
  text: string,
  tabs: boolean,
  limit: number,
  columns: number,
): { rows: TableRow[]; more: boolean; separator: string } {
  const sep = tabs ? "\t" : csvSeparator(text);
  const rows: TableRow[] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let line = 0;
  let start = 0;
  let i = 0;
  for (; i < text.length && rows.length < limit; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else {
        if (c === "\n" || (c === "\r" && text[i + 1] !== "\n")) line++;
        cell += c;
      }
    } else if (c === '"') quoted = true;
    else if (c === sep) {
      if (row.length < columns) row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      if (row.length < columns) row.push(cell);
      rows.push({ cells: row, line: start });
      row = [];
      cell = "";
      start = ++line;
    } else cell += c;
  }
  if ((cell || row.length) && rows.length < limit) {
    rows.push({
      cells: row.length < columns ? [...row, cell] : row,
      line: start,
    });
    i = text.length;
  }
  return { rows, more: i < text.length, separator: sep };
}

/** The first rows and columns of a CSV (or TSV) as cells. */
export function tableRows(
  text: string,
  tabs: boolean,
  limit = 60,
  columns = 50,
) {
  return readTable(text, tabs, limit, columns).rows.map((r) => r.cells);
}
