import { type LanguageChoice, useText } from "../i18n";
import { languageSettingsText } from "../text/languageSettings";
import { ControlButton, Segmented } from "./ControlElements";

/** The three language choices; Suomi and English name themselves. */
function useLanguageOptions() {
  const t = useText(languageSettingsText);
  return [
    { id: "system", label: t.system },
    { id: "fi", label: "Suomi" },
    { id: "en", label: "English" },
  ] as const satisfies readonly { id: LanguageChoice; label: string }[];
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
          <Segmented
            data-testid="language-choice"
            label={t.label}
            options={options}
            value={choice}
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
  const options = useLanguageOptions();
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
        <Segmented
          data-testid="server-language-choice"
          label={t.serverLabel}
          options={options}
          value={choice}
          isDisabled={disabled}
          onChange={onChange}
        />
      </div>
    </div>
  );
}
