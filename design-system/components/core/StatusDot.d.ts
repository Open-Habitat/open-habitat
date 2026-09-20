import * as React from "react";

/**
 * Tila: merkki + sana + väri, tässä järjestyksessä. Väri ei kanna merkitystä yksin.
 * Tuntematonta tilaa ei esitetä valmiina eikä pysähtyneenä.
 */
export interface StatusDotProps {
  tone?: "running" | "ok" | "error" | "stopped" | "idle" | "offline";
  /** Tilan sana. Jätä pois vain kun tila on oletus (yhdistetty, odottaa viestiä). */
  label?: string;
  size?: number;
  showMark?: boolean;
}

export declare function StatusDot(props: StatusDotProps): React.JSX.Element;
