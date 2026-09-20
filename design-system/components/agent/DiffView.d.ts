import * as React from "react";

/**
 * Unified diff tarkastelua varten. Ei Hyväksy-toimintoa, ellei harness ole
 * oikeasti pysähtynyt odottamaan hyväksyntää. Ilman diff-tietoa näytä saatu
 * tulos, älä keksittyä muutosta.
 * @startingPoint section="Agent" subtitle="Unified diff" viewport="700x260"
 */
export interface DiffLine {
  kind?: "meta" | "context" | "add" | "del";
  /** Rivin teksti merkkeineen: "+ …", "− …". Merkki kulkee aina mukana. */
  text: string;
}

export interface DiffViewProps {
  path: string;
  added: number;
  removed: number;
  lines?: DiffLine[];
  note?: string;
  onCopy?: () => void;
}

export declare function DiffView(props: DiffViewProps): React.JSX.Element;
