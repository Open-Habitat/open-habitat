import { RecentSettingsRow } from "../components/RecentSettings";
import {
  chooseRecentCount,
  loadAccountPreferences,
  useConfirmedPreferences,
} from "./accountPreferences";

export function RecentSettings({
  identity,
  csrf,
}: {
  identity?: string;
  csrf?: string;
}) {
  const state = useConfirmedPreferences(identity, csrf);
  return (
    <RecentSettingsRow
      count={state.recent_count}
      disabled={!identity || !csrf || !state.loaded || !!state.busy}
      error={state.error === "read" || state.error === "recent_count"}
      onChange={(count) => {
        if (identity && csrf) void chooseRecentCount(identity, count, csrf);
      }}
      onReload={
        identity && csrf
          ? () => void loadAccountPreferences(identity, csrf)
          : undefined
      }
    />
  );
}
