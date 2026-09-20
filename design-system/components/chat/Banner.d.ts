import * as React from "react";

/**
 * Huomautus syötekentän yllä. Kun yhteys on poikki, tämä on ainoa toiminto
 * joka näkyy — lähettäminen ja resume palaavat vasta yhteyden palattua.
 * @startingPoint section="Chat" subtitle="Katkos- ja resume-huomautus" viewport="700x120"
 */
export interface BannerProps {
  tone?: "info" | "error";
  children?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  busy?: boolean;
}

export declare function Banner(props: BannerProps): React.JSX.Element;
