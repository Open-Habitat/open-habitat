import * as React from "react";

/**
 * Työkalutapahtuma tiiviinä rivinä: tunniste, tila, määrä; yksityiskohdat avattavissa.
 * @startingPoint section="Agent" subtitle="Työkalutapahtuma yhtenä rivinä" viewport="700x150"
 */
export interface ToolRowProps {
  /** Toiminnon nimi, esim. "Haku" tai "Muokattu". */
  name: string;
  /** Konekielinen kohde: polku, komento, hakutermi. */
  detail?: string;
  /** Määrä ja kesto, esim. "2,4 s · rinnakkain". Vain jos lähde antaa. */
  meta?: string;
  tone?: "running" | "ok" | "error" | "stopped";
  statusLabel?: string;
  mono?: boolean;
  open?: boolean;
  onToggle?: () => void;
  /** Virhe värittää koko rivin, jotta se näkyy myös suljetussa ryhmässä. */
  error?: boolean;
  children?: React.ReactNode;
}

export declare function ToolRow(props: ToolRowProps): React.JSX.Element;
