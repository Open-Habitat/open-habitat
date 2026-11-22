import { type KeyboardEvent, useEffect, useRef, useState } from "react";
import { ChoiceMenu } from "../components/ChoiceMenu";
import {
  ControlButton,
  IconButton,
  Segmented,
} from "../components/ControlElements";
import { Icon } from "../components/Icon";
import { ScaleSlider } from "../components/ScaleSlider";
import { SoundEmblem } from "../components/SoundEmblem";
import { useText } from "../i18n";
import { attentionSoundText } from "../text/attentionSound";
import {
  chooseSound,
  chooseWorkspaceSound,
  loadAccountPreferences,
  type SoundChoice,
  useAccountPreferences,
} from "./accountPreferences";
import {
  nightEndHours,
  nightHourLabel,
  nightStartHours,
  playSound,
  setDeviceMuted,
  setDeviceVolume,
  silence,
  useDeviceNight,
  useDeviceSound,
  usePlaying,
  usePlayingAt,
  workspaceSound,
} from "./attentionSound";
import { SoundStatus } from "./SoundStatus";
import type { Workspace } from "./snapshot";
import { type SoundId, soundIds } from "./soundSynth";
import "./SoundSettings.css";

/** One sound's tile: a press listens and chooses. No length or time on the
 * tile (Jari 21.11.2026): the length is one choice for every sound. */
function Tile({
  id,
  chosen,
  disabled,
  onChoose,
}: {
  id: SoundId;
  chosen: boolean;
  disabled: boolean;
  onChoose: (id: SoundId) => void;
}) {
  const t = useText(attentionSoundText);
  const play = usePlaying(id, "settings-tile");
  const playing = usePlayingAt("settings-tile") === id;
  const [name, desc] = t.sounds[id];
  return (
    // biome-ignore lint/a11y/useSemanticElements: a tile that plays and chooses, drawn with its emblem; a native radio input cannot hold it
    <button
      type="button"
      role="radio"
      aria-checked={chosen}
      tabIndex={chosen ? 0 : -1}
      disabled={disabled}
      aria-label={t.tileLabel(name, desc)}
      data-testid={`sound-tile-${id}`}
      data-playing={playing || undefined}
      className="ss-tile"
      onClick={() => onChoose(id)}
    >
      <SoundEmblem id={id} play={play} />
      <span className="ss-tile-name">{name}</span>
      <span className="ss-tile-state">
        {playing ? (
          <>
            <Icon name="music" />
            {t.playing}
          </>
        ) : chosen ? (
          <>
            <Icon name="check" />
            {t.selected}
          </>
        ) : null}
      </span>
    </button>
  );
}

function WorkspaceRow({
  workspace,
  own,
  sound,
  defaultSound,
  disabled,
  onChoose,
  onListen,
}: {
  workspace: Workspace;
  own?: SoundId;
  sound: SoundId;
  defaultSound: SoundId;
  disabled: boolean;
  onChoose: (id: SoundId | null) => void;
  onListen: () => void;
}) {
  const t = useText(attentionSoundText);
  const where = `settings-workspace-${workspace.workspace_id}`;
  const play = usePlaying(sound, where);
  const name = workspace.display_name ?? workspace.name;
  return (
    <div
      className="s-row ss-workspace"
      data-testid={`sound-workspace-${workspace.workspace_id}`}
    >
      <div className="s-lbl ss-workspace-lbl">
        <SoundEmblem id={sound} play={play} size="small" />
        <code className="ss-workspace-name">{name}</code>
      </div>
      <div className="s-val">
        <span className="ss-choice">
          <ChoiceMenu<SoundId | "default">
            data-testid={`sound-workspace-choice-${workspace.workspace_id}`}
            label={t.workspaceLabel(name)}
            value={own ?? "default"}
            isDisabled={disabled}
            options={[
              {
                id: "default",
                label: t.sameAsDefault(t.sounds[defaultSound][0]),
              },
              ...soundIds.map((id) => ({
                id,
                label: t.sounds[id][0],
                description: t.sounds[id][1],
              })),
            ]}
            onChange={(v) => onChoose(v === "default" ? null : v)}
          />
        </span>
        <IconButton
          data-testid={`sound-workspace-listen-${workspace.workspace_id}`}
          size="row"
          variant="secondary"
          aria-label={t.listenWorkspace(name)}
          onPress={onListen}
        >
          <Icon name="run" />
        </IconButton>
      </div>
    </div>
  );
}

/** Asetukset › Äänet (attention-sound, experimental): the sound on or off,
 * the default sound as tiles, the length, when it plays, each workspace's
 * own sound and this device's mute and volume. Personal choices show once
 * the daemon has confirmed them; listening plays whatever they are. */
export function SoundSettings({
  identity,
  csrf,
  workspaces = [],
}: {
  identity?: string;
  csrf?: string;
  workspaces?: readonly Workspace[];
}) {
  const t = useText(attentionSoundText);
  const state = useAccountPreferences(identity, csrf);
  const sound = state.sound;
  const deviceSound = useDeviceSound();
  const night = useDeviceNight(sound);
  const nightRow = useRef<HTMLDivElement>(null);
  const masterRow = useRef<HTMLDivElement>(null);
  const deviceRow = useRef<HTMLDivElement>(null);
  const tiles = useRef<HTMLDivElement>(null);
  const session = !!identity && !!csrf && state.loaded;
  const writable = session && !state.busy;
  const off = !sound.enabled;
  const listen = (id: SoundId, where: string, length = sound.length) =>
    playSound(id, length, where);
  const choose = (choice: SoundChoice) => {
    if (identity && csrf) void chooseSound(identity, choice, csrf);
  };
  // A tile chosen while another choice is being saved waits for it, so a
  // quick press or arrow is never dropped and focus stays on the tile.
  const [queued, setQueued] = useState<SoundId>();
  useEffect(() => {
    if (!queued || !writable) return;
    setQueued(undefined);
    if (queued !== sound.default) choose({ default: queued });
  });
  const shown = queued ?? sound.default;
  const chooseTile = (id: SoundId) => {
    listen(id, "settings-tile");
    if (!writable) setQueued(id);
    else if (id !== sound.default) choose({ default: id });
  };
  const onTilesKey = (event: KeyboardEvent) => {
    const step = (
      { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<
        string,
        number
      >
    )[event.key];
    const i = soundIds.indexOf(shown);
    const next = step
      ? (i + step + soundIds.length) % soundIds.length
      : event.key === "Home"
        ? 0
        : event.key === "End"
          ? soundIds.length - 1
          : -1;
    if (next < 0 || off || !session) return;
    event.preventDefault();
    const id = soundIds[next];
    chooseTile(id);
    tiles.current
      ?.querySelector<HTMLElement>(`[data-testid="sound-tile-${id}"]`)
      ?.focus();
  };
  const why = silence({ sound, muted: deviceSound.muted, night });
  const nightNow = state.loaded && state.error !== "read" && why === "night";
  const error = state.error;
  const soundError =
    error === "read" ||
    error?.startsWith("sound.") ||
    error?.startsWith("workspace_sound:");
  const listed = workspaces.filter((w) => !w.place);
  return (
    <div className="s-stack ss-body" data-testid="sound-settings">
      {state.loaded && state.error !== "read" ? (
        <SoundStatus
          off={off}
          muted={deviceSound.muted}
          night={sound.night && night}
          nightStart={sound.night_start}
          nightEnd={sound.night_end}
          writable={writable}
          onEnable={() => {
            masterRow.current?.focus();
            choose({ enabled: true });
          }}
          onUnmute={() => {
            deviceRow.current?.focus();
            setDeviceMuted(false);
          }}
          onDisableNight={() => {
            // The status disappears on confirmation; keep keyboard focus on
            // the persistent row before the pending state disables its button.
            nightRow.current?.focus();
            choose({ night: false });
          }}
          onEditNight={() => {
            nightRow.current?.scrollIntoView({ block: "center" });
            nightRow.current?.focus({ preventScroll: true });
          }}
        />
      ) : null}
      <p className="s-intro">{t.intro}</p>
      {soundError ? (
        <div className="s-card">
          <div className="s-row ss-alert">
            <p role="alert" data-testid="sound-settings-error">
              {error === "read" ? t.readError : t.writeError}
            </p>
            {identity && csrf ? (
              <ControlButton
                size="row"
                data-testid="sound-settings-reload"
                onPress={() => void loadAccountPreferences(identity, csrf)}
              >
                {t.retry}
              </ControlButton>
            ) : null}
          </div>
        </div>
      ) : null}
      <div className="s-card">
        <div
          className="s-row"
          data-settings-row="attention-sound-on"
          ref={masterRow}
          tabIndex={-1}
        >
          <div className="s-lbl">
            <strong>{t.on}</strong>
            <span className="s-desc">{t.onDesc}</span>
          </div>
          <div className="s-val">
            <Segmented
              size="row"
              data-testid="sound-enabled"
              label={t.on}
              isDisabled={!writable}
              options={[
                { id: "off", label: t.off },
                { id: "on", label: t.onLabel },
              ]}
              value={sound.enabled ? "on" : "off"}
              onChange={(v) => {
                if ((v === "on") !== sound.enabled)
                  choose({ enabled: v === "on" });
              }}
            />
          </div>
        </div>
      </div>
      <h3 className="s-h3">{t.sound}</h3>
      <p className="s-desc ss-lead">{t.soundDesc}</p>
      {nightNow ? (
        <p className="ss-note" data-testid="sound-preview-night">
          {t.previewNight}
        </p>
      ) : null}
      <div
        ref={tiles}
        role="radiogroup"
        aria-label={t.sound}
        className="ss-tiles"
        data-testid="sound-tiles"
        data-settings-row="attention-sound-default"
        tabIndex={-1}
        onKeyDown={onTilesKey}
      >
        {soundIds.map((id) => (
          <Tile
            key={id}
            id={id}
            chosen={shown === id}
            disabled={off || !session}
            onChoose={chooseTile}
          />
        ))}
      </div>
      <div className="s-card">
        <div
          className="s-row"
          data-settings-row="attention-sound-length"
          tabIndex={-1}
        >
          <div className="s-lbl">
            <strong>{t.length}</strong>
            <span className="s-desc">{t.lengthDesc}</span>
          </div>
          <div className="s-val">
            <Segmented
              size="row"
              data-testid="sound-length"
              label={t.length}
              isDisabled={off || !writable}
              options={[
                { id: "short", label: t.short },
                { id: "long", label: t.long },
              ]}
              value={sound.length}
              onChange={(v) => {
                listen(sound.default, "settings-tile", v);
                if (v !== sound.length) choose({ length: v });
              }}
            />
          </div>
        </div>
      </div>
      <h3 className="s-h3">{t.when}</h3>
      <div className="s-card">
        <div
          className="s-row"
          data-settings-row="attention-sound-in-view"
          tabIndex={-1}
        >
          <div className="s-lbl">
            <strong>{t.inView}</strong>
            <span className="s-desc">{t.inViewDesc}</span>
          </div>
          <div className="s-val">
            <Segmented
              size="row"
              data-testid="sound-in-view"
              label={t.inView}
              isDisabled={off || !writable}
              options={[
                { id: "quiet", label: t.inViewQuiet },
                { id: "play", label: t.inViewPlays },
              ]}
              value={sound.in_view}
              onChange={(v) => {
                if (v !== sound.in_view) choose({ in_view: v });
              }}
            />
          </div>
        </div>
        <div
          className="s-row"
          data-settings-row="attention-sound-night"
          ref={nightRow}
          tabIndex={-1}
        >
          <div className="s-lbl">
            <strong>{t.night}</strong>
            <span className="s-desc">{t.nightDesc}</span>
          </div>
          <div className="s-val">
            <Segmented
              size="row"
              data-testid="sound-night"
              label={t.night}
              isDisabled={off || !writable}
              options={[
                { id: "off", label: t.off },
                { id: "on", label: t.onLabel },
              ]}
              value={sound.night ? "on" : "off"}
              onChange={(v) => {
                if ((v === "on") !== sound.night) choose({ night: v === "on" });
              }}
            />
          </div>
        </div>
        {sound.night && !off ? (
          <div className="s-row ss-clock" data-testid="sound-night-clock">
            {(
              [
                ["night_start", t.nightStart, nightStartHours],
                ["night_end", t.nightEnd, nightEndHours],
              ] as const
            ).map(([key, label, hours]) => (
              <div className="ss-clock-field" key={key}>
                <span>{label}</span>
                <ChoiceMenu
                  data-testid={`sound-${key}`}
                  label={label}
                  value={String(sound[key])}
                  isDisabled={!writable}
                  options={hours.map((hour) => ({
                    id: String(hour),
                    label: t.clockHour(nightHourLabel(hour)),
                  }))}
                  onChange={(value) =>
                    choose(
                      key === "night_start"
                        ? { night_start: Number(value) }
                        : { night_end: Number(value) },
                    )
                  }
                />
              </div>
            ))}
          </div>
        ) : null}
      </div>
      <h3 className="s-h3">{t.workspaces}</h3>
      <div
        className="s-card"
        data-settings-row="attention-sound-workspaces"
        tabIndex={-1}
      >
        <p className="s-desc ss-pad">{t.workspacesDesc}</p>
        {listed.length ? (
          listed.map((w) => {
            const own = sound.workspaces[w.workspace_id];
            const id = workspaceSound(sound, w.workspace_id);
            return (
              <WorkspaceRow
                key={w.workspace_id}
                workspace={w}
                own={own}
                sound={id}
                defaultSound={sound.default}
                disabled={off || !writable}
                onChoose={(next) => {
                  listen(
                    next ?? sound.default,
                    `settings-workspace-${w.workspace_id}`,
                  );
                  if (identity && csrf && (next ?? undefined) !== own)
                    void chooseWorkspaceSound(
                      identity,
                      w.workspace_id,
                      next,
                      csrf,
                    );
                }}
                onListen={() =>
                  listen(id, `settings-workspace-${w.workspace_id}`)
                }
              />
            );
          })
        ) : (
          <p className="s-desc ss-pad">{t.noWorkspaces}</p>
        )}
      </div>
      <h3 className="s-h3">{t.device}</h3>
      <div className="s-card">
        <p className="s-desc ss-pad">{t.deviceDesc}</p>
        <div
          className="s-row"
          data-settings-row="attention-sound-device"
          ref={deviceRow}
          tabIndex={-1}
        >
          <div className="s-lbl">
            <strong>{t.mute}</strong>
            <span className="s-desc">{t.muteDesc}</span>
          </div>
          <div className="s-val">
            <Segmented
              size="row"
              data-testid="sound-device-mute"
              label={t.mute}
              options={[
                { id: "plays", label: t.plays },
                { id: "quiet", label: t.quiet },
              ]}
              value={deviceSound.muted ? "quiet" : "plays"}
              onChange={(v) => setDeviceMuted(v === "quiet")}
            />
          </div>
        </div>
        <div
          className="s-row ss-volume"
          data-settings-row="attention-sound-volume"
          tabIndex={-1}
        >
          <div className="s-lbl">
            <strong>{t.volume}</strong>
          </div>
          <div className="s-val">
            <ScaleSlider
              testId="sound-device-volume"
              label={t.volume}
              value={deviceSound.volume}
              stops={[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100]}
              format={(v) => `${v} %`}
              disabled={deviceSound.muted}
              onChange={setDeviceVolume}
            />
            <ControlButton
              data-testid="sound-test"
              size="row"
              variant="secondary"
              onPress={() => listen(sound.default, "settings-tile")}
            >
              <Icon name="run" />
              {t.test}
            </ControlButton>
          </div>
        </div>
        {nightNow ? (
          <p className="ss-note" data-testid="sound-test-night">
            {t.testNight}
          </p>
        ) : null}
      </div>
    </div>
  );
}
