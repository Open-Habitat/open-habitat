import type { ReactNode } from "react";
import { ModelField, routes } from "./ModelField";
import type { ModelChoice, PiProvider } from "./ModelPicker";
import { modelDisplayName } from "./modelPresentation";

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
  const route = provider ? routes[provider] : undefined;
  return (
    <ModelField
      rowId="default-model"
      testId="default-model"
      label="Oletusmalli"
      description="Uusille keskusteluille"
      provider={provider}
      model={model}
      thinking={thinking}
      models={models}
      loading={loading}
      problem={
        model && route ? (
          <>
            {modelDisplayName(
              provider ? `${provider}/${model}` : model,
              models,
            )}{" "}
            ({route[0]}) ei vastannut viimeksi. Valitse toinen oletus tai korjaa{" "}
            {provider === "openai-codex" || provider === "claude-bridge"
              ? "kirjautuminen"
              : "avain"}{" "}
            alla.
          </>
        ) : null
      }
    >
      {children}
    </ModelField>
  );
}
