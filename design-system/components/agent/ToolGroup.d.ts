import * as React from "react";

/**
 * Ryhmä saman vuoron peräkkäisiä työkalutapahtumia. Uusi viesti tai
 * käyttäjäpyyntö katkaisee ryhmän. Otsikko kantaa virheen myös suljettuna.
 * @startingPoint section="Agent" subtitle="Avattava työkaluryhmä" viewport="700x180"
 */
export interface ToolGroupProps {
  /** Esim. "Luettu 15 tiedostoa" tai kesken työn "Luetaan tiedostoja". */
  title: string;
  /** Määrät otsikkoon: { running, done: "✓ 15/15", error, stopped }. */
  counts?: { running?: number; done?: string; error?: number; stopped?: number };
  meta?: string;
  open?: boolean;
  onToggle?: () => void;
  children?: React.ReactNode;
}

export declare function ToolGroup(props: ToolGroupProps): React.JSX.Element;
