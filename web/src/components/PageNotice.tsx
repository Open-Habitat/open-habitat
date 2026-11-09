import { Button } from "./Primitives";
import type { Action } from "./types";
import { WarningBanner, type WarningTone } from "./WarningBanner";

/** Page observations live outside the conversation's notice stack. Their
 * page owner keeps them while the observed state lasts. */
export function PageNotice({
  title,
  description,
  tone = "neutral",
  actions = [],
  ...attributes
}: {
  "data-testid"?: string;
  "data-state"?: string;
  title: string;
  description?: string;
  tone?: WarningTone;
  actions?: Action[];
}) {
  return (
    <WarningBanner
      {...attributes}
      tone={tone}
      title={title}
      actions={
        actions.length
          ? actions.map((action) => (
              <Button
                key={action.label}
                data-testid={action.testId ?? "notice-action"}
                size="row"
                variant="secondary"
                label={action.label}
                availability={action.availability}
                onPress={action.onPress}
              />
            ))
          : undefined
      }
    >
      {description}
    </WarningBanner>
  );
}
