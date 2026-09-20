import * as React from "react";

/**
 * Yksi viesti. Käyttäjän viesti on rajattu pinta, agentin vastaus vapaata
 * tekstiä — ei kuplia kummallekaan.
 * @startingPoint section="Chat" subtitle="Viesti ja kopiointi" viewport="700x150"
 */
export interface MessageProps {
  role?: "user" | "agent";
  time?: string;
  children?: React.ReactNode;
  /** Kopioi lähdetekstin, ei visuaalista rivitystä tai tilamerkkejä. */
  onCopy?: () => void;
}

export declare function Message(props: MessageProps): React.JSX.Element;
