import * as React from "react";

/**
 * Viestikenttä. Luonnos säilyy sovelluksen sisäisessä navigoinnissa. Työn
 * aikana viestiä ei lähetetä heti: se menee jonoon tai seuraavaan
 * työkalukatkokseen. Jonoon mahtuu monta viestiä.
 * @startingPoint section="Chat" subtitle="Syöte, jono ja keskeytys" viewport="700x220"
 */
export interface QueuedMessage {
  id?: string;
  text: string;
  mode: "steer" | "after";
}

export interface ComposerProps {
  value: string;
  onChange?: (value: string) => void;
  /** mode: "now" | "steer" | "after". */
  onSend?: (mode: "now" | "steer" | "after") => void;
  working?: boolean;
  disabled?: boolean;
  /** Miksi lähettäminen ei ole käytettävissä — näytetään aina sanoina. */
  disabledReason?: string;
  queue?: QueuedMessage[];
  onCancelQueued?: (item: QueuedMessage) => void;
  onClearQueue?: () => void;
  onInterrupt?: () => void;
}

export declare function Composer(props: ComposerProps): React.JSX.Element;
