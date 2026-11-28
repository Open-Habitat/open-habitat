// The round's own language rows, replacing web/src/components/LanguageSettings
// through build.mjs: production lists its four choices in the component.
// Proposal: every language by its own name (autonym), grouped by script so
// that a reader who cannot read the current interface still finds their own;
// a language whose catalog no native speaker has reviewed carries "Beta" in
// the description, in the interface language. Same props as production.
import { useState } from 'react';
import { type LanguageChoice, catalog, setPersonalLanguage, useText } from '../../../../web/src/i18n';
import { languageSettingsText } from '../../../../web/src/text/languageSettings';
import { ChoiceMenu } from '../../../../web/src/components/ChoiceMenu';
import { ControlButton } from '../../../../web/src/components/ControlElements';

const fi = {
  zhCNNote: 'Kiina, yksinkertaistetut merkit (Manner-Kiina). Beta: tekoälyn luonnos, natiivitarkastus kesken.',
  zhTWNote: 'Kiina, perinteiset merkit (Taiwan). Beta: tekoälyn luonnos, natiivitarkastus kesken.',
};
const roundText = catalog(fi, {
  zhCNNote: 'Chinese, simplified characters (mainland China). Beta: AI draft, native review pending.',
  zhTWNote: 'Chinese, traditional characters (Taiwan). Beta: AI draft, native review pending.',
});
const zh = {
  zhCNNote: '简体中文（中国大陆）。测试版：AI 起草，尚待母语审校。',
  zhTWNote: '繁體中文（台灣）。測試版：AI 起草，尚待母語審校。',
};
(roundText as unknown as Record<string, unknown>)['zh-CN'] = zh;
(roundText as unknown as Record<string, unknown>)['zh-TW'] = zh;

function useLanguageOptions(server = false) {
  const t = useText(languageSettingsText);
  const r = useText(roundText);
  return [
    { id: 'system', label: t.system, description: server ? t.serverSystemNote : t.systemNote },
    { id: 'fi', label: 'Suomi', description: t.fiNote },
    { id: 'en-US', label: 'English (US)', description: t.usNote },
    { id: 'en-GB', label: 'English (UK)', description: t.ukNote },
    { id: 'zh-CN', label: '简体中文', description: r.zhCNNote },
    { id: 'zh-TW', label: '繁體中文', description: r.zhTWNote },
  ] as { id: LanguageChoice; label: string; description: string }[];
}

export function LanguageSettingsRow({ choice, disabled, error, onChange, onReload }: {
  choice: LanguageChoice; disabled: boolean; error: boolean;
  onChange: (choice: LanguageChoice) => void; onReload?: () => void;
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
          <ChoiceMenu data-testid="language-choice" label={t.label} options={options}
            value={choice === 'en' ? 'en-GB' : choice} isDisabled={disabled} onChange={onChange} />
        </div>
      </div>
      {error && (
        <div className="s-row">
          <p role="alert" data-testid="language-preference-error">{t.error}</p>
          {onReload && <ControlButton size="row" onPress={onReload} isDisabled={disabled}>{t.reload}</ControlButton>}
        </div>
      )}
    </>
  );
}

export function ServerLanguageRow({ choice, disabled, error, onChange }: {
  choice: LanguageChoice; disabled: boolean; error: boolean; onChange: (choice: LanguageChoice) => void;
}) {
  const t = useText(languageSettingsText);
  const options = useLanguageOptions(true);
  return (
    <div className="s-row" data-settings-row="server-language" tabIndex={-1}>
      <div className="s-lbl">
        <strong>{t.serverLabel}</strong>
        <span className="s-desc">{t.serverDesc}</span>
        {error && <span className="s-desc" role="alert">{t.serverError}</span>}
      </div>
      <div className="s-val">
        <ChoiceMenu data-testid="server-language-choice" label={t.serverLabel} options={options}
          value={choice === 'en' ? 'en-GB' : choice} isDisabled={disabled} onChange={onChange} />
      </div>
    </div>
  );
}

/** Stands in for app/LanguageSettings: the choice applies at once, as the
 * confirmed account preference would, without the account read. */
export function LanguageSettings(_: { identity?: string; csrf?: string }) {
  const [choice, setChoice] = useState<LanguageChoice>(
    (document.documentElement.dataset.choice as LanguageChoice) || 'zh-CN',
  );
  return (
    <LanguageSettingsRow choice={choice} disabled={false} error={false}
      onChange={(c) => { setChoice(c); document.documentElement.dataset.choice = c; setPersonalLanguage(c); }} />
  );
}
