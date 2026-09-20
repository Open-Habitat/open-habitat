import * as React from "react";

/**
 * Toiminto. Ensisijainen on korostustäyttö, muut ovat reunustettuja.
 * Estetty painike saa aina sanallisen syyn viereensä.
 * @startingPoint section="Core" subtitle="Painikkeet ja niiden variantit" viewport="700x150"
 */
export interface ButtonProps {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
  disabled?: boolean;
  /** Näppäinoikotie painikkeen sisällä, esim. "⌘⏎" tai "Esc Esc". */
  shortcut?: string;
  title?: string;
  children?: React.ReactNode;
  onClick?: () => void;
  style?: React.CSSProperties;
}

export declare function Button(props: ButtonProps): React.JSX.Element;
