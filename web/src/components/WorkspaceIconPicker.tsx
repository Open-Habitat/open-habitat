import { useState } from "react";
import {
  Button as AriaButton,
  Dialog,
  DialogTrigger,
  Heading,
  Input,
  Popover,
} from "react-aria-components";
import { useText } from "../i18n";
import { workspaceIconPickerText } from "../text/workspaceIconPicker";
import { ControlButton } from "./ControlElements";
import { Icon } from "./Icon";
import { WorkspaceIcon, type WorkspaceIconModel } from "./WorkspaceIcon";
import "./WorkspaceIconPicker.css";

/** What the page's icon picker shows (workspace-icons, experimental;
 * proto-workspace-icon-setting's Otsikko): the icon now, the value the
 * repository's config says (its flat `icon` format), and what each choice
 * would look like. */
export type WorkspaceIconPickerModel = {
  icon: WorkspaceIconModel;
  /** The config's `icon` now: an emoji, letters, an image path or `auto`. */
  setting?: string;
  /** What Automaattinen shows: the logo, else the derived glyph. */
  auto: WorkspaceIconModel;
  /** The repository's logo, offered on its own. */
  logo?: { path: string; icon: WorkspaceIconModel };
  /** The name's own letters, the letter field's starting value. */
  letters: string;
};

// The grid's emoji, as in the prototype; any other can be typed.
const emojis = [
  "🦊",
  "🐙",
  "🦉",
  "🐝",
  "🦔",
  "🐢",
  "🦜",
  "🐳",
  "🦋",
  "🌵",
  "🍄",
  "🌻",
  "🍋",
  "🍇",
  "🥝",
  "🧀",
  "🪴",
  "⛵",
  "🚲",
  "🛶",
  "🎈",
  "🪁",
  "🧭",
  "🔭",
];
const lettersPattern = /^[A-Za-z0-9åäöÅÄÖ]{1,3}$/;
const letterValue = (v: string) =>
  lettersPattern.test(v.trim()) ? v.trim().toLocaleUpperCase("fi") : undefined;
/** One short emoji: a pictograph, no letters or spaces. The daemon decides. */
const emojiValue = (v: string) => {
  const t = v.trim();
  return t &&
    [...t].length <= 8 &&
    /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(t) &&
    !/[\s\p{L}\p{N}]/u.test(t)
    ? t
    : undefined;
};

function Option({
  icon,
  label,
  detail,
  pressed,
  onPress,
  testId,
}: {
  icon: WorkspaceIconModel;
  label: string;
  detail: React.ReactNode;
  pressed: boolean;
  onPress: () => void;
  testId: string;
}) {
  return (
    <AriaButton
      className="ah-wsip-opt"
      data-testid={testId}
      aria-pressed={pressed}
      onPress={onPress}
    >
      <WorkspaceIcon icon={icon} size="m" />
      <span className="ah-wsip-opt-text">
        <b>{label}</b>
        <small>{detail}</small>
      </span>
    </AriaButton>
  );
}

/** The workspace page's heading icon as a button that opens the picker; a
 * sheet on a phone. A choice closes it and goes to `onChoose` at once: the
 * page writes and commits it without asking (Jari 2026-10-30). */
export function WorkspaceIconPicker({
  model,
  onChoose,
  isDisabled,
  disabledReason,
  footer,
}: {
  model: WorkspaceIconPickerModel;
  onChoose: (value: string) => void;
  isDisabled?: boolean;
  disabledReason?: string;
  /** Below the choices, e.g. asking a model for suggestions. */
  footer?: (close: () => void) => React.ReactNode;
}) {
  const t = useText(workspaceIconPickerText);
  const [open, setOpen] = useState(false);
  const [letters, setLetters] = useState(model.letters);
  const [own, setOwn] = useState("");
  const [ownInvalid, setOwnInvalid] = useState(false);
  const { setting } = model;
  const settingLetters = setting ? letterValue(setting) : undefined;
  const isLetters = !!settingLetters && setting === settingLetters;
  const grid =
    setting &&
    setting !== "auto" &&
    !isLetters &&
    setting !== model.logo?.path &&
    !emojis.includes(setting)
      ? [setting, ...emojis]
      : emojis;
  const choose = (value: string | undefined) => {
    if (!value) return;
    setOpen(false);
    onChoose(value);
  };
  const typed = letterValue(letters);
  const lettersIcon: WorkspaceIconModel = {
    ...model.icon,
    glyph: { ...model.icon.glyph, letters: typed ?? model.letters },
    show: { kind: "glyph" },
  };
  return (
    <DialogTrigger
      isOpen={open}
      onOpenChange={(next) => {
        if (next) {
          setLetters(
            isLetters && settingLetters ? settingLetters : model.letters,
          );
          setOwn("");
          setOwnInvalid(false);
        }
        setOpen(next);
      }}
    >
      <ControlButton
        data-testid="workspace-icon-picker"
        size="inline"
        variant="quiet"
        className="ah-wsip-head"
        aria-label={t.change}
        title={isDisabled ? disabledReason : t.change}
        isDisabled={isDisabled}
      >
        <WorkspaceIcon icon={model.icon} size="l" />
        {isDisabled ? null : (
          <span className="ah-wsip-pen" aria-hidden="true">
            <Icon name="pencil" />
          </span>
        )}
      </ControlButton>
      <Popover
        placement="bottom start"
        offset={6}
        className="ah-popover ah-wsip-popover"
      >
        <Dialog
          className="ah-wsip"
          data-testid="workspace-icon-dialog"
          aria-label={t.title}
        >
          {({ close }) => (
            <>
              <header className="ah-wsip-top">
                <Heading slot="title" level={2}>
                  {t.title}
                </Heading>
                <ControlButton
                  size="inline"
                  variant="quiet"
                  aria-label={t.close}
                  onPress={close}
                >
                  <Icon name="cross" />
                </ControlButton>
              </header>
              <div className="ah-wsip-opts">
                <Option
                  testId="workspace-icon-auto"
                  icon={model.auto}
                  label={t.auto}
                  detail={
                    model.logo
                      ? t.autoLogo(<code>{model.logo.path}</code>)
                      : t.autoDerived
                  }
                  pressed={setting === "auto"}
                  onPress={() => choose("auto")}
                />
                {model.logo ? (
                  <Option
                    testId="workspace-icon-logo"
                    icon={model.logo.icon}
                    label={t.logo}
                    detail={<code>{model.logo.path}</code>}
                    pressed={setting === model.logo.path}
                    onPress={() => choose(model.logo?.path)}
                  />
                ) : null}
                <div
                  className="ah-wsip-opt ah-wsip-letters"
                  data-chosen={isLetters || undefined}
                >
                  <AriaButton
                    className="ah-wsip-letters-tile"
                    data-testid="workspace-icon-letters"
                    aria-pressed={isLetters}
                    aria-label={t.lettersNamed(typed ?? model.letters)}
                    isDisabled={!typed}
                    onPress={() => choose(typed)}
                  >
                    <WorkspaceIcon icon={lettersIcon} size="m" />
                  </AriaButton>
                  <span className="ah-wsip-opt-text">
                    <b>{t.letters}</b>
                    <small>{t.lettersHint}</small>
                  </span>
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      choose(typed);
                    }}
                  >
                    <Input
                      className="ah-wsip-letters-input"
                      data-testid="workspace-icon-letters-input"
                      aria-label={t.lettersField}
                      maxLength={3}
                      value={letters}
                      onChange={(e) => setLetters(e.target.value)}
                    />
                  </form>
                </div>
              </div>
              <p className="ah-wsip-h">{t.emoji}</p>
              <div className="ah-wsip-grid">
                {grid.map((e) => (
                  <AriaButton
                    key={e}
                    className="ah-wsip-emoji"
                    data-testid="workspace-icon-emoji"
                    aria-label={e}
                    aria-pressed={setting === e}
                    onPress={() => choose(e)}
                  >
                    {e}
                  </AriaButton>
                ))}
              </div>
              <form
                className="ah-wsip-own"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = emojiValue(own);
                  setOwnInvalid(!v);
                  choose(v);
                }}
              >
                <Input
                  data-testid="workspace-icon-own"
                  aria-label={t.own}
                  aria-invalid={ownInvalid || undefined}
                  placeholder={t.ownPlaceholder}
                  maxLength={16}
                  value={own}
                  onChange={(e) => {
                    setOwn(e.target.value);
                    setOwnInvalid(false);
                  }}
                />
                <ControlButton
                  data-testid="workspace-icon-own-use"
                  size="row"
                  type="submit"
                >
                  {t.use}
                </ControlButton>
              </form>
              {ownInvalid ? (
                <p className="ah-wsip-invalid" role="status">
                  {t.oneEmoji}
                </p>
              ) : null}
              {footer ? (
                <div className="ah-wsip-foot">{footer(close)}</div>
              ) : null}
            </>
          )}
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
}
