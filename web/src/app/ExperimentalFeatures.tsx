import { ExperimentalFeaturesControl } from "../components/ExperimentalFeatures";
import {
  type ExperimentalFeatureId,
  experimentalFeatureIds,
  loadAccountPreferences,
  setExperimentalFeature,
  useAccountPreferences,
} from "./accountPreferences";
import { useBrowserInstalled } from "./serverBrowser";

const known = (id: string): id is ExperimentalFeatureId =>
  (experimentalFeatureIds as readonly string[]).includes(id);

export function ExperimentalFeatures({
  identity,
  csrf,
}: {
  identity?: string;
  csrf?: string;
}) {
  const state = useAccountPreferences(identity, csrf);
  const browserInstalled = useBrowserInstalled(identity, csrf);
  return (
    <ExperimentalFeaturesControl
      unavailable={browserInstalled === false ? ["remote-browser"] : []}
      enabled={(id) => !!state.experimental[id]}
      disabled={!identity || !csrf || !state.loaded || !!state.busy}
      busy={state.busy}
      error={state.error}
      onChange={(id, on) => {
        if (!identity || !csrf || !known(id)) return;
        void setExperimentalFeature(identity, id, on, csrf);
      }}
      onReload={
        identity && csrf
          ? () => void loadAccountPreferences(identity, csrf)
          : undefined
      }
    />
  );
}
