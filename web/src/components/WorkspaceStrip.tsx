import {
  type KeyboardEvent,
  type ReactNode,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import {
  Button,
  Dialog,
  DialogTrigger,
  Heading,
  Popover,
} from "react-aria-components";
import { usePlaying, usePlayingAt } from "../app/attentionSound";
import { type SoundId, type SoundLength, soundIds } from "../app/soundSynth";
import { useText } from "../i18n";
import { attentionSoundText } from "../text/attentionSound";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import { SoundEmblem } from "./SoundEmblem";
import "./WorkspaceStrip.css";

export type IconFrom = "derived" | "letters" | "emoji" | "logo";
type Choice = SoundId | "default";
const choices: Choice[] = ["default", ...soundIds];

/** The sound picker: a press chooses and plays, ▶ listens without choosing.
 * No times on the cards (Jari 21.11.2026). */
function SoundPicker({
  where,
  own,
  defaultSound,
  length,
  enabled,
  onChoose,
  onPreview,
  close,
}: {
  where: string;
  own?: SoundId;
  defaultSound: SoundId;
  length: SoundLength;
  enabled: boolean;
  onChoose: (id: SoundId | null) => void;
  onPreview: (id: SoundId, where: string) => void;
  close: () => void;
}) {
  const t = useText(attentionSoundText);
  const value: Choice = own ?? "default";
  const soundOf = (c: Choice) => (c === "default" ? defaultSound : c);
  const nowAt = usePlayingAt(`${where}-picker`);
  const playingChoice = usePlayingAt(`${where}-picker-default`)
    ? "default"
    : nowAt;
  const choose = (c: Choice) => {
    onPreview(
      soundOf(c),
      c === "default" ? `${where}-picker-default` : `${where}-picker`,
    );
    if (c !== value) onChoose(c === "default" ? null : c);
  };
  const onKey = (event: KeyboardEvent) => {
    if ((event.target as HTMLElement).getAttribute("role") !== "radio") return;
    const step = (
      { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 } as Record<
        string,
        number
      >
    )[event.key];
    const i = choices.indexOf(value);
    const next = step
      ? (i + step + choices.length) % choices.length
      : event.key === "Home"
        ? 0
        : event.key === "End"
          ? choices.length - 1
          : -1;
    if (next < 0) return;
    event.preventDefault();
    event.stopPropagation();
    const c = choices[next];
    choose(c);
    const root = event.currentTarget;
    requestAnimationFrame(() =>
      root
        .querySelector<HTMLElement>(`[data-testid="strip-sound-pick-${c}"]`)
        ?.focus(),
    );
  };
  const state = (c: Choice) =>
    playingChoice === c ? (
      <span className="ws-pick-state" data-state="playing">
        <Icon name="music" />
        {t.playing}
      </span>
    ) : value === c ? (
      <span className="ws-pick-state" data-state="selected">
        <Icon name="check" />
        {t.selected}
      </span>
    ) : null;
  const preview = (c: Choice, label: string) => (
    <button
      type="button"
      className="ws-preview"
      data-testid={`strip-sound-preview-${c}`}
      aria-label={t.preview(label)}
      title={t.preview(label)}
      data-playing={playingChoice === c || undefined}
      onClick={() =>
        onPreview(
          soundOf(c),
          c === "default" ? `${where}-picker-default` : `${where}-picker`,
        )
      }
    >
      <Icon name="run" />
    </button>
  );
  const defaultName = t.sounds[defaultSound][0];
  return (
    <div className="ws-picker" data-testid="strip-sound-picker">
      <header className="ws-picker-top">
        <Heading slot="title" level={2}>
          <Icon name="music" />
          {t.pickerTitle}
        </Heading>
        <ControlButton
          size="inline"
          variant="quiet"
          aria-label={t.close}
          onPress={close}
          data-testid="strip-sound-close"
        >
          <Icon name="cross" />
        </ControlButton>
      </header>
      <p className="ws-picker-help">{t.pickerHelp}</p>
      {!enabled ? (
        <p className="ws-picker-note" data-testid="strip-sound-off">
          <Icon name="slash" />
          {t.offNote}
        </p>
      ) : null}
      <div
        role="radiogroup"
        aria-label={t.pickerTitle}
        className="ws-options"
        onKeyDown={onKey}
      >
        <div
          className="ws-default-row"
          data-checked={value === "default" || undefined}
        >
          {/* biome-ignore lint/a11y/useSemanticElements: a card that plays and chooses, with a separate listen button beside it; a native radio input cannot hold either */}
          <button
            type="button"
            role="radio"
            aria-checked={value === "default"}
            tabIndex={value === "default" ? 0 : -1}
            className="ws-default"
            data-testid="strip-sound-pick-default"
            onClick={() => choose("default")}
          >
            <PickerEmblem
              id={defaultSound}
              where={`${where}-picker-default`}
              size="small"
            />
            <span className="ws-default-text">
              <b>{t.pickerDefault}</b>
              <small>{t.pickerDefaultDetail(defaultName)}</small>
            </span>
            <span className="ws-default-state">{state("default")}</span>
          </button>
          {preview("default", `${t.pickerDefault} (${defaultName})`)}
        </div>
        <div className="ws-grid">
          {soundIds.map((id) => {
            const [name, desc] = t.sounds[id];
            return (
              <div
                key={id}
                className="ws-card"
                data-checked={value === id || undefined}
              >
                {/* biome-ignore lint/a11y/useSemanticElements: a card that plays and chooses, with a separate listen button beside it; a native radio input cannot hold either */}
                <button
                  type="button"
                  role="radio"
                  aria-checked={value === id}
                  tabIndex={value === id ? 0 : -1}
                  aria-label={t.tileLabel(name, desc)}
                  className="ws-tile"
                  data-testid={`strip-sound-pick-${id}`}
                  onClick={() => choose(id)}
                >
                  <PickerEmblem
                    id={id}
                    where={`${where}-picker`}
                    size="strip"
                  />
                  <span className="ws-tile-name">{name}</span>
                  <span className="ws-tile-foot">{state(id)}</span>
                </button>
                {preview(id, name)}
              </div>
            );
          })}
        </div>
      </div>
      <footer className="ws-picker-foot">
        <p>
          <Icon name="music" />
          <span>{t.lengthNote[length]}</span>
        </p>
        <ControlButton
          size="row"
          variant="primary"
          onPress={close}
          data-testid="strip-sound-done"
        >
          {t.done}
        </ControlButton>
      </footer>
    </div>
  );
}

function PickerEmblem({
  id,
  where,
  size,
}: {
  id: SoundId;
  where: string;
  size: "strip" | "small";
}) {
  return <SoundEmblem id={id} play={usePlaying(id, where)} size={size} />;
}

/** Nimi edited in place (B Paikallaan, Jari 21.11.2026): the box becomes
 * the field. Enter and a click elsewhere save, Esc cancels, and focus
 * returns to Nimi. An empty name brings back the folder's name. */
function NameBox({
  name,
  folder,
  onRename,
  headingPath,
}: {
  name: string;
  folder: string;
  onRename?: (display: string) => void;
  headingPath?: ReactNode;
}) {
  const t = useText(attentionSoundText);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);
  const input = useRef<HTMLInputElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const done = useRef(false);
  useLayoutEffect(() => {
    if (editing) {
      done.current = false;
      input.current?.select();
    } else if (done.current) {
      button.current?.focus();
    }
  }, [editing]);
  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    const value = (input.current?.value ?? draft).trim();
    if (save && onRename && value !== name) onRename(value);
    setEditing(false);
  };
  const display = (
    <Button
      ref={button}
      className={headingPath ? "ws-heading-button" : "ws-item ws-flat"}
      data-testid="strip-name"
      aria-label={t.nameLabel(name)}
      isDisabled={!onRename}
      onPress={() => {
        setDraft(name);
        setEditing(true);
      }}
    >
      {headingPath ? null : (
        <span className="ws-label">
          <Icon name="pencil" />
          {t.stripName}
        </span>
      )}
      <span className="ws-box">
        <span className="ws-name" title={name} data-testid="strip-name-value">
          {name}
        </span>
      </span>
    </Button>
  );
  const editor = (
    // biome-ignore lint/a11y/noNoninteractiveElementInteractions: focus leaving the field and its buttons saves, as a rename in a file manager does
    <form
      className={
        headingPath ? "ws-name-form" : "ws-item ws-flat ws-name-editing"
      }
      data-testid="strip-name"
      data-editing=""
      onSubmit={(event) => {
        event.preventDefault();
        finish(true);
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node))
          finish(true);
      }}
    >
      <span className="ws-label">
        <Icon name="pencil" />
        <label htmlFor="ws-name-input" aria-label={t.nameField}>
          {t.stripName}
        </label>
        <span className="ws-inline-actions">
          <button
            type="button"
            className="ws-inline-button"
            data-testid="strip-name-cancel"
            aria-label={t.cancel}
            title={t.cancel}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => finish(false)}
          >
            <Icon name="cross" />
          </button>
          <button
            type="submit"
            className="ws-inline-button"
            data-testid="strip-name-save"
            aria-label={t.save}
            title={t.save}
            onMouseDown={(event) => event.preventDefault()}
          >
            <Icon name="check" />
          </button>
        </span>
      </span>
      <span className="ws-box">
        <input
          id="ws-name-input"
          ref={input}
          className="ws-name ws-name-input"
          data-testid="strip-name-input"
          value={draft}
          aria-describedby="ws-name-hint"
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              event.stopPropagation();
              finish(false);
            }
          }}
        />
      </span>
      <span id="ws-name-hint" className="ah-visually-hidden">
        {t.nameHint(folder)}
      </span>
    </form>
  );
  if (!headingPath) return editing ? editor : display;
  return (
    <div
      className="ws-item ws-flat ws-header-name"
      data-editing={editing || undefined}
    >
      {editing ? (
        editor
      ) : (
        <span className="ws-label">
          <Icon name="pencil" />
          {t.stripName}
        </span>
      )}
      <h1
        data-testid="workspace-title"
        tabIndex={-1}
        className={editing ? "ah-visually-hidden" : undefined}
      >
        {editing ? name : display}
      </h1>
      {headingPath}
    </div>
  );
}

/**
 * The workspace's settings strip under its head (attention-sound,
 * A Yksi rivi, Jari 21.11.2026): Kuvake and Ääni as squares,
 * Nimi as a wider box, one row of one height. The kind of a button, never
 * its value, sets its size, so a new choice moves nothing. While it shows,
 * it is the one place to change the icon and the name: the head's own icon
 * button and rename pencil step aside.
 */
export function WorkspaceStrip({
  workspaceId,
  icon,
  iconFrom,
  name,
  folder,
  onRename,
  sound,
  ownSound,
  defaultSound,
  length,
  enabled,
  onChooseSound,
  onPreview,
  headingPath,
  actions,
}: {
  headingPath?: ReactNode;
  actions?: ReactNode;
  workspaceId: string;
  /** The real icon editor, its trigger stretched over the square. */
  icon?: ReactNode;
  iconFrom?: IconFrom;
  name: string;
  /** The folder as shown under the heading, which a rename keeps. */
  folder: string;
  onRename?: (display: string) => void;
  sound: SoundId;
  ownSound?: SoundId;
  defaultSound: SoundId;
  length: SoundLength;
  enabled: boolean;
  onChooseSound?: (id: SoundId | null) => void;
  onPreview: (id: SoundId, where: string) => void;
}) {
  const t = useText(attentionSoundText);
  const where = `strip-${workspaceId}`;
  const play = usePlaying(sound, where);
  const [open, setOpen] = useState(false);
  return (
    <section
      className={headingPath ? "ws-strip ws-header-c2a" : "ws-strip"}
      data-testid="workspace-strip"
      aria-label={t.strip}
    >
      {icon ? (
        <div
          className="ws-item ws-square ws-icon-square"
          data-testid="strip-icon"
          data-icon-from={iconFrom}
        >
          <span className="ws-label">
            <Icon name="image" />
            {t.stripIcon}
          </span>
          <span className="ws-box">{icon}</span>
          <span className="ws-value">
            {iconFrom ? t.iconFrom[iconFrom] : ""}
          </span>
        </div>
      ) : null}
      <NameBox
        name={name}
        folder={folder}
        onRename={onRename}
        headingPath={headingPath}
      />
      <DialogTrigger isOpen={open} onOpenChange={setOpen}>
        <Button
          className="ws-item ws-square"
          data-testid="strip-sound"
          data-own={ownSound ? "" : undefined}
          aria-label={t.soundLabel(t.sounds[sound][0], !!ownSound)}
          isDisabled={!onChooseSound}
        >
          <span className="ws-label">
            <Icon name="music" />
            {t.stripSound}
          </span>
          <span className="ws-box">
            <SoundEmblem id={sound} play={play} size="strip" />
          </span>
          <span className="ws-value" data-testid="strip-sound-value">
            <span className="ws-value-name">{t.sounds[sound][0]}</span>
            {ownSound ? null : (
              <span className="ws-value-suffix"> · {t.defaultWord}</span>
            )}
          </span>
        </Button>
        <Popover
          placement="bottom end"
          offset={6}
          className="ah-popover ws-popover"
        >
          <Dialog
            className="ws-dialog"
            aria-label={t.pickerTitle}
            data-testid="strip-sound-dialog"
          >
            {({ close }) => (
              <SoundPicker
                where={where}
                own={ownSound}
                defaultSound={defaultSound}
                length={length}
                enabled={enabled}
                onChoose={(id) => onChooseSound?.(id)}
                onPreview={onPreview}
                close={close}
              />
            )}
          </Dialog>
        </Popover>
      </DialogTrigger>
      {actions}
    </section>
  );
}
