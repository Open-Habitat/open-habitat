import { type LanguageChoice, useText } from "../i18n";
import { languageSettingsText } from "../text/languageSettings";
import { ChoiceMenu } from "./ChoiceMenu";
import { ControlButton } from "./ControlElements";

/** Language names stay recognisable in every interface language. */
function useLanguageOptions(server = false) {
  const t = useText(languageSettingsText);
  return [
    {
      id: "system",
      label: t.system,
      description: server ? t.serverSystemNote : t.systemNote,
    },
    { id: "fi", label: "Suomi", description: t.fiNote },
    { id: "en-US", label: "English (US)", description: t.usNote },
    { id: "en-GB", label: "English (UK)", description: t.ukNote },
  ] as const satisfies readonly {
    id: LanguageChoice;
    label: string;
    description: string;
  }[];
}

/** The person's own interface language: a row in Settings › Ulkoasu. */
export function LanguageSettingsRow({
  choice,
  disabled,
  error,
  onChange,
  onReload,
}: {
  choice: LanguageChoice;
  disabled: boolean;
  error: boolean;
  onChange: (choice: LanguageChoice) => void;
  onReload?: () => void;
}) {
  const t = useText(languageSettingsText);
  const options = useLanguageOptions();
  return (
    <>
      <div className="s-row" data-settings-row="language" tabIndex={-1}>
        <div className="s-lbl">
          <strong>{t.label}</strong>
          <span className="s-desc">{t.desc}</span>
        </div>
        <div className="s-val">
          <ChoiceMenu
            data-testid="language-choice"
            label={t.label}
            options={options}
            value={choice === "en" ? "en-GB" : choice}
            isDisabled={disabled}
            onChange={onChange}
          />
        </div>
      </div>
      {error && (
        <div className="s-row">
          <p role="alert" data-testid="language-preference-error">
            {t.error}
          </p>
          {onReload && (
            <ControlButton size="row" onPress={onReload} isDisabled={disabled}>
              {t.reload}
            </ControlButton>
          )}
        </div>
      )}
    </>
  );
}

/** The server's default language: a row in Settings › Palvelin. */
export function ServerLanguageRow({
  choice,
  disabled,
  error,
  onChange,
}: {
  choice: LanguageChoice;
  disabled: boolean;
  error: boolean;
  onChange: (choice: LanguageChoice) => void;
}) {
  const t = useText(languageSettingsText);
  const options = useLanguageOptions(true);
  return (
    <div className="s-row" data-settings-row="server-language" tabIndex={-1}>
      <div className="s-lbl">
        <strong>{t.serverLabel}</strong>
        <span className="s-desc">{t.serverDesc}</span>
        {error && (
          <span className="s-desc" role="alert">
            {t.serverError}
          </span>
        )}
      </div>
      <div className="s-val">
        <ChoiceMenu
          data-testid="server-language-choice"
          label={t.serverLabel}
          options={options}
          value={choice === "en" ? "en-GB" : choice}
          isDisabled={disabled}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
