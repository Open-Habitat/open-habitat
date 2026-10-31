import { useCallback, useEffect, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { InlineTextSetting } from "../components/InlineTextSetting";
import { ServerLanguageRow } from "../components/LanguageSettings";
import { type LanguageChoice, textNow, useText } from "../i18n";
import { serverAdministrationText } from "../text/serverAdministration";
import { ServerAccessSettings } from "./ServerAccessSettings";
import { ServerVersionRow } from "./ServerVersion";
import {
  type Administration,
  administration,
  changeAdministration,
} from "./serverAdministration";
import {
  bytes,
  changeStorage,
  type StorageAdministration,
  storageAdministration,
} from "./storageQuota";
import { ViewLinkAdministration } from "./ViewLinkSettings";

// This view never receives another user's daemon route, files or credentials.
export function ServerAdministration({
  csrf,
  section = "palvelin",
  version,
  commit,
}: {
  csrf?: string;
  section?: "palvelin" | "kayttajat" | "levy";
  version?: string;
  commit?: string;
}) {
  const [editing, setEditing] = useState("");
  const [data, setData] = useState<Administration>();
  const [limits, setLimits] = useState<Record<string, string>>({});
  const [storage, setStorage] = useState<StorageAdministration>();
  const [storageError, setStorageError] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [languageSaving, setLanguageSaving] = useState(false);
  const [languageError, setLanguageError] = useState(false);
  const t = useText(serverAdministrationText);
  const reload = useCallback(async (signal?: AbortSignal) => {
    setData(await administration(signal));
  }, []);
  const reloadStorage = useCallback(async (signal?: AbortSignal) => {
    const next = await storageAdministration(signal);
    setStorage(next);
    setLimits(
      Object.fromEntries(
        next.users.map((u) => [u.id, String(u.limit_bytes / 1024 ** 3)]),
      ),
    );
    setStorageError("");
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    void reloadStorage(controller.signal).catch(() => {
      if (!controller.signal.aborted)
        setStorageError(textNow(serverAdministrationText).storageUnavailable);
    });
    void reload(controller.signal).catch(() => {
      if (!controller.signal.aborted)
        setError(textNow(serverAdministrationText).settingsUnavailable);
    });
    return () => controller.abort();
  }, [reload, reloadStorage]);
  // An inline field keeps its own text and failure; a write is idempotent,
  // so trying again needs no reload first.
  const saveField = async (
    change: { name: string } | { default_limit_bytes: number },
  ) => {
    if (!csrf) throw new Error("unavailable");
    await changeAdministration(csrf, change);
    await reload().catch(() => {});
  };
  const saveLanguage = async (language: LanguageChoice) => {
    if (!csrf || languageSaving) return;
    setLanguageSaving(true);
    setLanguageError(false);
    try {
      await changeAdministration(csrf, { default_language: language });
      await reload().catch(() => {});
    } catch {
      setLanguageError(true);
    } finally {
      setLanguageSaving(false);
    }
  };
  const gigabytes = (raw: string): number | undefined => {
    const number = Number(raw);
    const limit = number * 1024 ** 3;
    return raw.trim() !== "" &&
      Number.isSafeInteger(limit) &&
      limit >= 1024 ** 2 &&
      limit <= 2 ** 50 &&
      limit % 1024 === 0
      ? limit
      : undefined;
  };
  const saveLimit = async (subject: string) => {
    const limit = gigabytes(limits[subject] ?? "");
    if (!csrf || limit === undefined || saving) return;
    setSaving(true);
    setStorageError("");
    try {
      await changeStorage(csrf, subject, limit);
      await reloadStorage();
    } catch {
      setStorage(undefined);
      setStorageError(t.limitUncertain);
    } finally {
      setSaving(false);
    }
  };
  const bar = (used: number, limit: number) => (
    <div
      className="s-bar"
      role="img"
      aria-label={`${bytes(used)} / ${bytes(limit)}`}
    >
      <span
        style={{ width: `${limit ? Math.min(100, (100 * used) / limit) : 0}%` }}
      />
    </div>
  );
  if (section === "kayttajat")
    return (
      <div className="s-card ah-administration">
        <ServerAccessSettings csrf={csrf} />
        <ViewLinkAdministration csrf={csrf} />
      </div>
    );
  return (
    <div className="s-card ah-administration">
      {error && (
        <div className="s-row" role="alert">
          {error}
          <ControlButton
            size="row"
            onPress={() => {
              setError("");
              void reload().catch(() => setError(t.settingsUnavailable));
            }}
          >
            {t.reloadData}
          </ControlButton>
        </div>
      )}
      {storageError && (
        <div className="s-row" role="alert">
          {storageError}
          <ControlButton
            size="row"
            onPress={() =>
              void reloadStorage().catch(() =>
                setStorageError(t.storageUnavailable),
              )
            }
          >
            {t.reload}
          </ControlButton>
        </div>
      )}
      {data ? (
        <>
          {section === "palvelin" && (
            <InlineTextSetting
              row="server-name"
              data-testid="server-name-input"
              label={t.serverName}
              description={t.serverNameDesc}
              value={data.name}
              maxLength={80}
              disabled={!csrf}
              invalid={(draft) => (draft.trim() ? undefined : t.nameEmpty)}
              onSave={(next) => saveField({ name: next })}
            />
          )}
          {section === "palvelin" && (
            <ServerLanguageRow
              choice={data.default_language}
              disabled={!csrf || languageSaving}
              error={languageError}
              onChange={(language) => void saveLanguage(language)}
            />
          )}
          {section === "palvelin" && (
            <ServerVersionRow version={version} commit={commit} />
          )}
          {section === "levy" && (
            <>
              {storage && (
                <div className="s-row" data-settings-row="disk" tabIndex={-1}>
                  <div className="s-lbl">
                    <strong>{t.disk}</strong>
                    <span className="s-desc">
                      {storage.limits === "not_in_use"
                        ? t.noLimits
                        : storage.overcommitted === null
                          ? t.limitsUnknown
                          : storage.overcommitted
                            ? t.overcommitted
                            : t.homeDisk}
                    </span>
                  </div>
                  <div
                    data-testid="server-storage"
                    data-limits={storage.limits}
                    data-overcommitted={
                      storage.overcommitted === null
                        ? "unknown"
                        : String(storage.overcommitted)
                    }
                  >
                    {t.capacity(
                      bytes(storage.filesystem.capacity_bytes),
                      bytes(storage.filesystem.free_bytes),
                    )}
                    {bar(
                      storage.filesystem.capacity_bytes -
                        storage.filesystem.free_bytes,
                      storage.filesystem.capacity_bytes,
                    )}
                  </div>
                </div>
              )}
              {storage?.limits !== "not_in_use" && (
                <InlineTextSetting
                  row="default-limit"
                  label={t.defaultLimit}
                  description={t.defaultLimitDesc}
                  value={String(data.default_limit_bytes / 1024 ** 3)}
                  unit="GiB"
                  inputMode="decimal"
                  disabled={!csrf}
                  normalize={(draft) => {
                    const text = draft.trim().replace(",", ".");
                    // "8,0" and "8.0" are the saved "8", not a change.
                    return gigabytes(text) === undefined
                      ? text
                      : String(Number(text));
                  }}
                  invalid={(draft) =>
                    gigabytes(draft.trim().replace(",", ".")) === undefined
                      ? t.limitInvalid
                      : undefined
                  }
                  onSave={(next) =>
                    saveField({ default_limit_bytes: gigabytes(next) ?? 0 })
                  }
                />
              )}
            </>
          )}
          {section === "levy" && (
            <table
              className="s-table"
              data-settings-row="user-limits"
              tabIndex={-1}
            >
              <thead>
                <tr>
                  <th>{t.user}</th>
                  <th>{t.storage}</th>
                  <th>{t.actions}</th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((user) => {
                  const quota = storage?.users.find(
                    (u) => u.id === user.id && !u.unavailable,
                  );
                  return (
                    <tr
                      data-testid={`administration-user-${user.username}`}
                      key={user.id}
                    >
                      <td>
                        <strong>{user.username}</strong>
                      </td>
                      <td
                        className="s-storage"
                        data-storage-state={
                          storage?.limits === "not_in_use"
                            ? "not_in_use"
                            : quota
                              ? "known"
                              : "unknown"
                        }
                      >
                        {storage?.limits === "not_in_use" ? (
                          t.noLimit
                        ) : quota ? (
                          <>
                            <span className="s-storage-value">
                              {bytes(quota.usage_bytes)} /{" "}
                              {bytes(quota.limit_bytes)}
                            </span>
                            {bar(quota.usage_bytes, quota.limit_bytes)}
                          </>
                        ) : (
                          t.unknownUsage
                        )}
                      </td>
                      <td>
                        {quota && (
                          <>
                            <ControlButton
                              data-testid="storage-limit-edit"
                              size="row"
                              onPress={() => setEditing(user.id)}
                            >
                              {t.limitEdit}
                            </ControlButton>
                            {editing === user.id && (
                              <form
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  void saveLimit(user.id).then(() =>
                                    setEditing(""),
                                  );
                                }}
                              >
                                <label className="s-field">
                                  {t.limitField(user.username)}
                                  <input
                                    inputMode="decimal"
                                    data-testid="storage-limit-input"
                                    autoComplete="off"
                                    value={limits[user.id] ?? ""}
                                    onChange={(e) =>
                                      setLimits((v) => ({
                                        ...v,
                                        [user.id]: e.target.value,
                                      }))
                                    }
                                  />
                                </label>
                                <ControlButton
                                  size="row"
                                  type="submit"
                                  isDisabled={
                                    !csrf ||
                                    saving ||
                                    gigabytes(limits[user.id] ?? "") ===
                                      undefined ||
                                    gigabytes(limits[user.id] ?? "") ===
                                      quota.limit_bytes
                                  }
                                >
                                  {t.saveLimit}
                                </ControlButton>
                                <ControlButton
                                  data-testid="cancel"
                                  size="row"
                                  onPress={() => setEditing("")}
                                >
                                  {t.cancel}
                                </ControlButton>
                              </form>
                            )}
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </>
      ) : (
        !error && <p className="s-row">{t.loading}</p>
      )}
    </div>
  );
}
