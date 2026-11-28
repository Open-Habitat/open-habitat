import { RiskyFeaturesControl } from "../components/RiskyFeatures";
import {
  loadAccountPreferences,
  type RiskyFeatureId,
  riskyFeatureIds,
  setRiskyFeature,
  useAccountPreferences,
} from "./accountPreferences";

const busyFeature = (busy?: string) =>
  riskyFeatureIds.find((id) => busy === `risky:${id}`);

/** Settings › Vaaralliset toiminnot on the person's confirmed preferences. */
export function RiskyFeatures({
  identity,
  csrf,
}: {
  identity?: string;
  csrf?: string;
}) {
  const state = useAccountPreferences(identity, csrf);
  const failed = state.error?.startsWith("risky:")
    ? state.error.slice("risky:".length)
    : state.error === "read"
      ? "read"
      : undefined;
  return (
    <RiskyFeaturesControl
      features={riskyFeatureIds}
      allowed={(id) => state.risky[id]}
      disabled={!identity || !csrf || !state.loaded || !!state.busy}
      busy={busyFeature(state.busy)}
      error={failed}
      onChange={(id: RiskyFeatureId, on) => {
        if (!identity || !csrf) return;
        void setRiskyFeature(identity, id, on, csrf);
      }}
      onReload={
        identity && csrf
          ? () => void loadAccountPreferences(identity, csrf)
          : undefined
      }
    />
  );
}
