import { LanguageSettingsRow } from "../components/LanguageSettings";
import {
  chooseLanguage,
  loadAccountPreferences,
  useConfirmedPreferences,
} from "./accountPreferences";

/** The person's language, kept in their account preferences so that it
 * follows them to every device. */
export function LanguageSettings({
  identity,
  csrf,
}: {
  identity?: string;
  csrf?: string;
}) {
  // The provider keeps the preferences read; opening Settings › Ulkoasu
  // adds no read of its own.
  const state = useConfirmedPreferences(identity, csrf);
  return (
    <LanguageSettingsRow
      choice={state.language}
      disabled={!identity || !csrf || !state.loaded || !!state.busy}
      error={state.error === "read" || state.error === "language"}
      onChange={(language) => {
        if (identity && csrf) void chooseLanguage(identity, language, csrf);
      }}
      onReload={
        identity && csrf
          ? () => void loadAccountPreferences(identity, csrf)
          : undefined
      }
    />
  );
}
