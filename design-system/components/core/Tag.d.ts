import * as React from "react";

/** Pieni merkintä: tila, hakutermi, määrä. Ei koskaan ainoa tiedon kantaja. */
export interface TagProps {
  tone?: "neutral" | "accent" | "error" | "mono";
  /** Pyöreä pilleri (tilat) vai terävämpi laatikko (koodi, hakutermi). */
  pill?: boolean;
  children?: React.ReactNode;
}

export declare function Tag(props: TagProps): React.JSX.Element;
