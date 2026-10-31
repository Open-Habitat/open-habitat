import Ajv from "ajv/dist/2020.js";
import { useEffect, useState } from "react";
import schema from "../../../contracts/v1/recap-settings.schema.json";
import { ModelField } from "../components/ModelField";
import type { PiProvider } from "../components/ModelPicker";
import {
  RecapSettings,
  type RecapSettingsValue,
} from "../components/RecapSettings";
import { liveText } from "../i18n";
import { recapSettingsText } from "../text/recapSettings";
import { jsonWrite } from "./mutations";
import { PiModelSelector } from "./PiModelSelector";
import { usePiModels } from "./PiModels";

const txt = liveText(recapSettingsText);

const ajv = new Ajv({ strict: false });
ajv.addSchema(schema);
const validResult = ajv.compile<{
  schema_version: 1;
  settings: RecapSettingsValue;
}>({ $ref: `${schema.$id}#/$defs/result` });

const path = "/api/v1/pi/recap-settings";

async function reply(response: Response): Promise<RecapSettingsValue> {
  if (!response.ok) throw Error("unavailable");
  const text = await response.text();
  if (text.length > 4096) throw Error("oversize");
  const value: unknown = JSON.parse(text);
  if (!validResult(value)) throw Error("contract");
  return value.settings;
}

type SaveEvent =
  | { kind: "saving" }
  | { kind: "saved"; value: RecapSettingsValue; last: boolean }
  | { kind: "failed"; last: boolean };
// One queue for the page, not for one mount of the section: leaving the
// section while a save is under way must not let an older queued change be
// written after a newer one made on return. The newest change wins.
const queue: {
  next?: {
    value: RecapSettingsValue;
    csrf: string;
    done: ((ok: boolean) => void)[];
  };
  latest?: RecapSettingsValue;
  running: boolean;
  listeners: Set<(event: SaveEvent) => void>;
} = { running: false, listeners: new Set() };
const notify = (event: SaveEvent) => {
  for (const listener of queue.listeners) listener(event);
};
async function drain() {
  if (queue.running) return;
  queue.running = true;
  notify({ kind: "saving" });
  while (queue.next) {
    const { value, csrf, done } = queue.next;
    queue.next = undefined;
    let ok = false;
    try {
      const saved = await reply(
        await jsonWrite("recap.settings", path, value, csrf, { method: "PUT" }),
      );
      ok = true;
      if (!queue.next) queue.latest = undefined;
      notify({ kind: "saved", value: saved, last: !queue.next });
    } catch {
      if (!queue.next) queue.latest = undefined;
      notify({ kind: "failed", last: !queue.next });
    }
    for (const resolve of done) resolve(ok);
  }
  queue.running = false;
}
function saveRecapSettings(value: RecapSettingsValue, csrf: string) {
  return new Promise<boolean>((resolve) => {
    queue.latest = value;
    queue.next = { value, csrf, done: [...(queue.next?.done ?? []), resolve] };
    void drain();
  });
}

/** Tilannekatsaus › the person's recap settings, kept in Pi's settings by
 * their daemon. A change shows at once and is saved in the background. */
export function RecapSettingsSection({ csrf }: { csrf?: string }) {
  const [stored, setStored] = useState<RecapSettingsValue>();
  // A change not yet confirmed, including one made before the section was
  // left and opened again.
  const [shown, setShown] = useState(queue.latest);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(queue.running);
  const [failed, setFailed] = useState(false);
  const { data: models, refresh } = usePiModels();
  useEffect(() => {
    refresh();
  }, [refresh]);
  useEffect(() => {
    const listener = (event: SaveEvent) => {
      if (event.kind === "saving") {
        setSaving(true);
        setFailed(false);
        return;
      }
      if (event.kind === "saved") setStored(event.value);
      setFailed(event.kind === "failed");
      if (event.last) {
        setShown(undefined);
        setSaving(false);
      }
    };
    queue.listeners.add(listener);
    return () => {
      queue.listeners.delete(listener);
    };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void fetch(path, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(reply)
      .then(setStored)
      .catch(() => {
        if (!controller.signal.aborted) setLoadFailed(true);
      });
    return () => controller.abort();
  }, []);
  const save = (value: RecapSettingsValue) => {
    if (!csrf) return Promise.resolve(false);
    setShown(value);
    return saveRecapSettings(value, csrf);
  };
  // A failed save shows the stored settings again.
  const value = shown ?? stored;
  const provider = value?.model
    ? (value.model.split("/")[0] as PiProvider)
    : (models?.default_provider ?? undefined);
  const model = value?.model
    ? value.model.slice(value.model.indexOf("/") + 1)
    : provider
      ? models?.background_models?.[provider]
      : undefined;
  return (
    <>
      {loadFailed ? (
        <p role="alert" data-testid="recap-settings-unavailable">
          {txt.readFailed}
        </p>
      ) : null}
      <RecapSettings
        value={value}
        loading={!value}
        saving={saving}
        failed={failed}
        onChange={(next) => void save(next)}
        modelField={
          <ModelField
            rowId="recap-model"
            testId="recap-model"
            label={txt.model}
            description={txt.modelDesc}
            provider={provider}
            model={model}
            auto={!!value && !value.model}
            models={models?.models}
            loading={!value || !models}
            emptyLabel={txt.conversationModel}
          >
            {(close) =>
              value ? (
                <PiModelSelector
                  csrf={csrf}
                  scope="background"
                  current={value.model ?? undefined}
                  onChoice={async (choice) => {
                    if (
                      !(await save({
                        ...value,
                        model: `${choice.provider}/${choice.model}`,
                      }))
                    )
                      throw Error("not saved");
                    close();
                  }}
                  onAutomatic={async () => {
                    if (!(await save({ ...value, model: null })))
                      throw Error("not saved");
                    close();
                  }}
                />
              ) : null
            }
          </ModelField>
        }
      />
    </>
  );
}
