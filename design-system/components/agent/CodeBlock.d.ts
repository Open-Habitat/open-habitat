import * as React from "react";

/**
 * Koodilohko ja komennon output. Kopioi koodi kopioi vain koodin, ei tilamerkkejä.
 * @startingPoint section="Agent" subtitle="Koodi ja komennon output" viewport="700x200"
 */
export interface CodeBlockProps {
  label?: string;
  language?: string;
  text: string;
  /** Näytettävien rivien katto. Lyhentämisestä on aina kerrottava. */
  maxLines?: number;
  /** Esim. "Näytetään 4 / 2 480 riviä — lähde säilytti 2 480". */
  truncationNote?: string;
  onCopy?: () => void;
  error?: boolean;
}

export declare function CodeBlock(props: CodeBlockProps): React.JSX.Element;
