import * as React from "react";

/**
 * Keskustelun yläpalkki. Otsikko generoidaan ensimmäisen vuoron jälkeen ja
 * päivitetään noin 3., 5. ja 10. vuoron kohdalla. Harness ei näy: malli on
 * "sonnet", ei "pi-sonnet", eikä resume-ID kuulu perusnäkymään.
 * @startingPoint section="Chat" subtitle="Keskustelun yläpalkki" viewport="700x120"
 */
export interface TopBarProps {
  title: string;
  /** Projektin nimi, ei koko polkua eikä käyttäjätunnusta. */
  project: string;
  working?: boolean;
  /** Mitä juuri nyt tehdään, näkyy laajennettuna. */
  workingDetail?: string;
  connected?: boolean;
  server: string;
  model: { name: string; thinking: string };
  thinkingLevel?: number;
  thinkingLevels?: number;
  /** Mikä tunniste on laajennettuna: "conn" | "model" | null. */
  expanded?: "conn" | "model" | null;
  onHoverChange?: (which: "conn" | "model", hovering: boolean) => void;
}

export declare function TopBar(props: TopBarProps): React.JSX.Element;
