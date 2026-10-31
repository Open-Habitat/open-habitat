import type { ReactNode } from "react";
import { liveText } from "../i18n";
import { modelsText } from "../text/models";
import { ModelField, providerRoute } from "./ModelField";
import type { ModelChoice, PiProvider } from "./ModelPicker";
import { modelDisplayName } from "./modelPresentation";

const txt = liveText(modelsText);

/** Pi's default as a settings row (Tekoäly › Oletusmalli). */
export function DefaultModelRow({
  provider,
  model,
  thinking,
  models,
  loading,
  children,
}: {
  provider?: PiProvider | null;
  model?: string | null;
  thinking?: string;
  models?: ModelChoice[];
  loading?: boolean;
  children: ReactNode;
}) {
  const route = provider ? providerRoute(provider) : undefined;
  return (
    <ModelField
      rowId="default-model"
      testId="default-model"
      label={txt.defaultModel}
      description={txt.forNew}
      provider={provider}
      model={model}
      thinking={thinking}
      models={models}
      loading={loading}
      problem={
        model && route
          ? txt.defaultBroken(
              modelDisplayName(
                provider ? `${provider}/${model}` : model,
                models,
              ),
              route[0],
              provider === "openai-codex" || provider === "claude-bridge",
            )
          : null
      }
    >
      {children}
    </ModelField>
  );
}
