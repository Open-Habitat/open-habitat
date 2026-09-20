import * as React from "react";

/**
 * Käyttäjäpyyntö. Piirretty vastauspainike ei todista extensionin
 * selainrajapintaa — näytä myös ei-tuettu tilanne. Ei uusia hyväksyntäsääntöjä.
 * @startingPoint section="Agent" subtitle="Käyttäjäpyyntö ja vastaus" viewport="700x200"
 */
export interface ApprovalCardProps {
  question: string;
  options?: string[];
  /** Vaihe, esim. "1 / 2". */
  step?: string;
  /** Kun vastattu, vastaus jää näkyviin merkintänä. */
  answer?: string | null;
  supported?: boolean;
  unsupportedReason?: string;
  busy?: boolean;
  onAnswer?: (option: string) => void;
  onFreeText?: () => void;
}

export declare function ApprovalCard(props: ApprovalCardProps): React.JSX.Element;
