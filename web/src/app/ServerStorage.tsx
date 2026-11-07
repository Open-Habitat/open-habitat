import { useCallback, useEffect, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import { NumberStepper } from "../components/NumberStepper";
import {
  LimitReset,
  PeopleList,
  PeopleRow,
  SectionCard,
  SectionLead,
  SectionMeter,
  SectionNumber,
  SectionStatus,
  SectionSubhead,
  ServerSection,
  UsageFigure,
} from "../components/ServerSection";
import { textNow, useText } from "../i18n";
import { serverStorageText } from "../text/serverStorage";
import {
  type Administration,
  administration,
  changeAdministration,
} from "./serverAdministration";
import { useSettledChanges } from "./settledChanges";
import {
  bytes,
  changeStorage,
  type StorageAdministration,
  storageAdministration,
} from "./storageQuota";

// Palvelimen ylläpito › Levytila on the server sections' norm: the disk as a
// meter, the default limit and every person's limit as steppers in whole
// GiB, and each person's use beside their limit. The host keeps one limit
// per person and the default applies only to new users, so Oletukseen sets
// the person's limit to the current default rather than making it follow
// the default.

const GiB = 1024 ** 3;
// The host's ceiling on a limit, 2^50 bytes, in whole GiB.
const maxGiB = 2 ** 20;
const stepGiB = 5;

// This view never receives another user's daemon route, files or credentials.
export function ServerStorage({ csrf }: { csrf?: string }) {
  const t = useText(serverStorageText);
  const [data, setData] = useState<Administration>();
  const [storage, setStorage] = useState<StorageAdministration>();
  const [error, setError] = useState("");
  const [storageError, setStorageError] = useState("");
  const [problem, setProblem] = useState("");
  const reload = useCallback(async (signal?: AbortSignal) => {
    setData(await administration(signal));
  }, []);
  const reloadStorage = useCallback(async (signal?: AbortSignal) => {
    setStorage(await storageAdministration(signal));
    setStorageError("");
  }, []);
  // The key "" is the default limit, any other a person's; values in bytes.
  const { draft, change, writing } = useSettledChanges<number>(
    async (key, limit) => {
      if (!csrf) return;
      setProblem("");
      const text = textNow(serverStorageText);
      if (!key) {
        try {
          await changeAdministration(csrf, { default_limit_bytes: limit });
        } catch {
          setProblem(text.defaultUncertain);
        }
        await reload().catch(() => {});
        return;
      }
      try {
        await changeStorage(csrf, key, limit);
        await reloadStorage();
      } catch {
        // The outcome is unknown: no figure is shown until the next read.
        setStorage(undefined);
        setStorageError(text.limitUncertain);
      }
    },
  );
  useEffect(() => {
    const controller = new AbortController();
    void reloadStorage(controller.signal).catch(() => {
      if (!controller.signal.aborted)
        setStorageError(textNow(serverStorageText).storageUnavailable);
    });
    void reload(controller.signal).catch(() => {
      if (!controller.signal.aborted)
        setError(textNow(serverStorageText).settingsUnavailable);
    });
    return () => controller.abort();
  }, [reload, reloadStorage]);

  const alerts = (error || storageError) && (
    <SectionCard>
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
    </SectionCard>
  );
  if (!data)
    return (
      <ServerSection>
        {alerts}
        {!error && <p className="s-row">{t.loading}</p>}
      </ServerSection>
    );

  const enforced = storage?.limits !== "not_in_use";
  const fallback = draft[""] ?? data.default_limit_bytes;
  const quotaOf = (id: string) =>
    storage?.users.find((u) => u.id === id && !u.unavailable);
  const limitOf = (id: string, limit: number) => draft[id] ?? limit;
  // What the limits could take together, known only when every limit is.
  const known =
    !!storage &&
    enforced &&
    storage.overcommitted !== null &&
    storage.users.every((u) => !u.unavailable);
  const worst = known
    ? storage.users.reduce((sum, u) => sum + limitOf(u.id, u.limit_bytes), 0)
    : undefined;
  const disk = storage?.filesystem;
  const used = disk ? disk.capacity_bytes - disk.free_bytes : 0;
  const over = !!disk && worst !== undefined && worst > disk.capacity_bytes;
  const columns: [string, string, ...string[]] = enforced
    ? [t.person, t.used, t.limit]
    : [t.person, t.limit];
  return (
    <ServerSection testId="server-storage-section">
      <SectionLead>{enforced ? t.lead : t.leadNoLimits}</SectionLead>
      {alerts}
      <SectionCard>
        {storage && disk && (
          <SectionMeter
            row="disk"
            testId="server-storage"
            data-limits={storage.limits}
            data-overcommitted={
              storage.overcommitted === null
                ? "unknown"
                : String(storage.overcommitted)
            }
            label={t.disk}
            description={
              enforced && storage.overcommitted === null
                ? t.limitsUnknown
                : undefined
            }
            figure={t.capacity(
              bytes(disk.capacity_bytes),
              bytes(disk.free_bytes),
            )}
            total={disk.capacity_bytes}
            meterLabel={t.meter(
              bytes(used),
              worst === undefined ? "" : bytes(worst),
              bytes(disk.capacity_bytes),
            )}
            now={{ label: t.usedNow, value: bytes(used), amount: used }}
            worst={
              worst === undefined
                ? undefined
                : { label: t.worst, value: bytes(worst), amount: worst }
            }
            over={over ? t.overcommitted : undefined}
          />
        )}
        {enforced && (
          <SectionNumber
            row="default-limit"
            testId="default-limit"
            label={t.defaultLimit}
            description={t.defaultLimitDesc}
            value={fallback / GiB}
            min={1}
            max={maxGiB}
            step={stepGiB}
            unit="GiB"
            disabled={!csrf}
            onChange={(n) => change("", n * GiB)}
          />
        )}
      </SectionCard>
      <SectionSubhead>{t.people}</SectionSubhead>
      <SectionCard>
        <PeopleList row="user-limits" columns={columns}>
          {data.users.map((user) => {
            const quota = quotaOf(user.id);
            const limit = quota && limitOf(user.id, quota.limit_bytes);
            const own = limit !== undefined && limit !== fallback;
            const state = !enforced
              ? "not_in_use"
              : quota
                ? "known"
                : "unknown";
            return (
              <PeopleRow
                key={user.id}
                testId={`administration-user-${user.username}`}
                data-storage-state={state}
                data-own={own ? "" : undefined}
                name={user.username}
                detail={
                  quota ? (
                    <span className="s-desc">
                      {own ? t.ownLimit : t.usesDefault}
                    </span>
                  ) : undefined
                }
                cells={
                  !enforced
                    ? [t.noLimit]
                    : quota && limit !== undefined
                      ? [
                          <UsageFigure
                            key="use"
                            testId={`storage-use-${user.username}`}
                            used={quota.usage_bytes}
                            limit={limit}
                            text={`${bytes(quota.usage_bytes)} / ${bytes(limit)}`}
                          />,
                          <NumberStepper
                            key="limit"
                            label={t.personLimit(user.username)}
                            testId={`storage-limit-${user.username}`}
                            value={limit / GiB}
                            min={1}
                            max={maxGiB}
                            step={stepGiB}
                            disabled={!csrf}
                            onChange={(n) => change(user.id, n * GiB)}
                          />,
                        ]
                      : [t.unknownUsage, null]
                }
                end={
                  <LimitReset
                    own={own}
                    label={t.toDefault}
                    testId={`storage-limit-${user.username}-reset`}
                    disabled={!csrf}
                    onPress={() => change(user.id, fallback)}
                  />
                }
              />
            );
          })}
        </PeopleList>
      </SectionCard>
      <SectionStatus testId="storage-status">
        {problem || (writing ? t.saving : "")}
      </SectionStatus>
    </ServerSection>
  );
}
