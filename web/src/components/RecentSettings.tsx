import { useText } from "../i18n";
import { recentSettingsText } from "../text/recentSettings";
import { ControlButton } from "./ControlElements";
import { NumberStepper } from "./NumberStepper";

export function RecentSettingsRow({
  count,
  disabled,
  error,
  onChange,
  onReload,
}: {
  count: number;
  disabled: boolean;
  error: boolean;
  onChange: (count: number) => void;
  onReload?: () => void;
}) {
  const t = useText(recentSettingsText);
  return (
    <div className="s-row" data-settings-row="recent-count" tabIndex={-1}>
      <div className="s-lbl">
        <strong>{t.label}</strong>
        <span className="s-desc">{t.desc}</span>
        {error && (
          <span role="alert" data-testid="recent-count-error">
            {t.error}
          </span>
        )}
      </div>
      <div className="s-val">
        <NumberStepper
          label={t.label}
          value={count}
          unit={t.unit(count)}
          min={1}
          max={20}
          disabled={disabled}
          testId="recent-count"
          onChange={onChange}
        />
        {error && onReload && (
          <ControlButton size="row" onPress={onReload} isDisabled={disabled}>
            {t.reload}
          </ControlButton>
        )}
      </div>
    </div>
  );
}
