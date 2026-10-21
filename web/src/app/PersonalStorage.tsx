import { useCallback, useEffect, useState } from "react";
import { ControlButton } from "../components/ControlElements";
import {
  StorageUsage,
  TrashEmptyDialog,
  TrashList,
  TrashPurgeDialog,
  type TrashRow,
} from "../components/WorkspaceTrash";
import { ownStorage, type Quota } from "./storageQuota";
import { blockerText, bytes, refusalText } from "./trashText";
import { WorktreeCleanup } from "./WorktreeCleanup";
import {
  type DeletionBlocker,
  type DeletionFacts,
  deleteTrashEntry,
  emptyTrash,
  inspectTrashEntry,
  type TrashList as Listing,
  listTrash,
  restoreTrashEntry,
  WorkspaceTrashError,
} from "./workspaceTrash";

const problemOf = (e: unknown) =>
  refusalText(e instanceof WorkspaceTrashError ? e.code : "unavailable");
const plain = (b: DeletionBlocker) =>
  blockerText(b)
    .what.map((p) => (typeof p === "string" ? p : p.code))
    .join("");
const rowName = (r: { name?: string; entry: string }) => r.name ?? r.entry;
// Git facts for the rows' labels are read one entry at a time; beyond this
// many a row shows only what the listing says.
const inspectLimit = 50;

// The subject is resolved by the gateway from the current cookie, never sent by this view.
export function PersonalStorage({
  csrf,
  onWorkspacesChanged,
}: {
  csrf?: string;
  onWorkspacesChanged?: () => void;
}) {
  const [quota, setQuota] = useState<Quota>();
  const [error, setError] = useState(false);
  const [quotaRead, setQuotaRead] = useState(0);
  const [trashBytes, setTrashBytes] = useState<number>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: quotaRead asks again after the Trash freed space.
  useEffect(() => {
    const controller = new AbortController();
    void ownStorage(controller.signal)
      .then((value) => {
        if (!controller.signal.aborted) setQuota(value);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [quotaRead]);
  return (
    <>
      <div className="s-card">
        <section aria-label="Käyttö">
          {quota ? (
            <StorageUsage
              usage={quota.usage_bytes}
              limit={quota.limit_bytes}
              trash={trashBytes}
            />
          ) : error ? (
            <p>Tallennustietoa ei voitu hakea.</p>
          ) : (
            <p>Haetaan tallennustietoa…</p>
          )}
        </section>
      </div>
      {csrf ? (
        <WorktreeCleanup
          csrf={csrf}
          onChanged={() => {
            setQuotaRead((n) => n + 1);
            onWorkspacesChanged?.();
          }}
        />
      ) : null}
      {csrf ? (
        <TrashSettings
          csrf={csrf}
          onTotal={setTrashBytes}
          onFreed={() => setQuotaRead((n) => n + 1)}
          onRestored={onWorkspacesChanged}
        />
      ) : null}
    </>
  );
}

function TrashSettings({
  csrf,
  onTotal,
  onFreed,
  onRestored,
}: {
  csrf: string;
  onTotal: (bytes: number | undefined) => void;
  onFreed: () => void;
  onRestored?: () => void;
}) {
  const [listing, setListing] = useState<Listing>();
  const [loadProblem, setLoadProblem] = useState("");
  const [facts, setFacts] = useState<Record<string, DeletionFacts>>({});
  const [read, setRead] = useState(0);
  const [busy, setBusy] = useState<string>();
  const [status, setStatus] = useState("");
  const [purge, setPurge] = useState<TrashRow>();
  const [purgeProblem, setPurgeProblem] = useState("");
  const [emptyOpen, setEmptyOpen] = useState(false);
  const reload = useCallback(() => setRead((n) => n + 1), []);
  // biome-ignore lint/correctness/useExhaustiveDependencies: read explicitly asks for a fresh listing.
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    void listTrash(csrf, signal).then(
      async (value) => {
        if (signal.aborted) return;
        // An entry name is reused after a restore, so facts belong to one
        // listing only.
        setFacts({});
        setListing(value);
        setLoadProblem("");
        onTotal(value.entries.reduce((sum, e) => sum + (e.size_bytes ?? 0), 0));
        for (const e of value.entries.slice(0, inspectLimit)) {
          if (signal.aborted) return;
          try {
            const inspected = await inspectTrashEntry(e.entry, csrf, signal);
            if (!signal.aborted)
              setFacts((all) => ({ ...all, [e.entry]: inspected.facts }));
          } catch {
            // A row without Git facts shows what the listing said.
          }
        }
      },
      (e) => {
        if (signal.aborted) return;
        setLoadProblem(problemOf(e));
        onTotal(undefined);
      },
    );
    return () => controller.abort();
  }, [csrf, read]);
  const rows: TrashRow[] = (listing?.entries ?? []).map((e) => ({
    ...e,
    facts: facts[e.entry],
  }));
  const total = rows.reduce((sum, r) => sum + (r.size_bytes ?? 0), 0);
  const restore = (row: TrashRow) => {
    setBusy(row.entry);
    setStatus("");
    void restoreTrashEntry(row.entry, csrf)
      .then(
        (restored) => {
          setStatus(
            restored.state === "restored"
              ? `${restored.name} palautettu: ~/src/${restored.name}.`
              : `${restored.name} palautettiin, mutta nimen takana on nyt jotain muuta. Tarkista ~/src/${restored.name}.`,
          );
          onRestored?.();
        },
        (e) => setStatus(`${rowName(row)}: ${problemOf(e)}`),
      )
      .finally(() => {
        setBusy(undefined);
        reload();
      });
  };
  // The dialog describes what it will remove: read the entry afresh.
  const openPurge = (row: TrashRow) => {
    setPurgeProblem("");
    setPurge({ ...row, facts: undefined });
    void inspectTrashEntry(row.entry, csrf).then(
      (inspected) => {
        setFacts((all) => ({ ...all, [row.entry]: inspected.facts }));
        setPurge((open) =>
          open?.entry === row.entry
            ? { ...open, facts: inspected.facts }
            : open,
        );
      },
      () => {},
    );
  };
  const confirmPurge = (typed: string) => {
    if (!purge) return;
    const row = purge;
    setBusy(row.entry);
    setPurgeProblem("");
    void deleteTrashEntry(row.entry, typed, csrf)
      .then(
        (result) => {
          if (result.state === "deleted") {
            setPurge(undefined);
            setStatus(
              `${rowName(row)} poistettu pysyvästi.${row.size_bytes ? ` ${bytes(row.size_bytes)} vapautui.` : ""}`,
            );
            onFreed();
          } else if (result.state === "blocked") {
            setPurgeProblem(
              `Ei poistettu: ${(result.blockers ?? []).map(plain).join(" ")}`,
            );
          } else {
            setPurgeProblem(
              `Osa jäi poistamatta (${result.remaining ?? 1}). Yritä uudelleen.`,
            );
            onFreed();
          }
        },
        (e) => setPurgeProblem(problemOf(e)),
      )
      .finally(() => {
        setBusy(undefined);
        reload();
      });
  };
  const confirmEmpty = () => {
    if (!listing) return;
    setBusy("*");
    void emptyTrash(listing, csrf)
      .then(
        (result) => {
          setEmptyOpen(false);
          onFreed();
          if (!result.kept.length) {
            setStatus("Roskakori tyhjennetty.");
            return;
          }
          const names = new Map(
            (listing.entries ?? []).map((e) => [e.entry, rowName(e)]),
          );
          const kept = result.kept.map((k) => {
            const why =
              k.state === "blocked"
                ? (k.blockers ?? []).map(plain).join(" ")
                : k.state === "partial"
                  ? "osa jäi poistamatta."
                  : "se ei ollut enää sama kohde.";
            return `${names.get(k.entry) ?? k.entry}: ${why}`;
          });
          setStatus(
            `${result.deleted} poistettiin, ${result.kept.length} jäi. ${kept.join(" ")}`,
          );
        },
        (e) => {
          // A refused emptying is not retried from the same dialog: the
          // reloaded list may hold entries the person has not seen.
          setEmptyOpen(false);
          setStatus(problemOf(e));
        },
      )
      .finally(() => {
        setBusy(undefined);
        reload();
      });
  };
  return (
    <section
      data-testid="trash"
      className="ah-trash-section"
      aria-labelledby="trash-heading"
    >
      <div className="ah-trash-head">
        <h3 id="trash-heading">Roskakori</h3>
        <ControlButton
          data-testid="open-empty-trash"
          variant="danger-subtle"
          size="row"
          isDisabled={!rows.length || !!busy}
          onPress={() => {
            setEmptyOpen(true);
          }}
        >
          Tyhjennä roskakori…
        </ControlButton>
      </div>
      <p className="ah-trash-intro">
        Poistetut työtilat säilyvät täällä kokonaisina, kunnes poistat ne
        pysyvästi. Tämä on kotihakemistosi roskakori (
        <code>~/.local/share/Trash</code>), jonka myös <code>gio trash</code>{" "}
        näkee.
      </p>
      {status ? <p role="status">{status}</p> : null}
      {loadProblem ? (
        <p role="alert">
          Roskakoria ei voitu lukea. {loadProblem}{" "}
          <ControlButton variant="quiet" size="row" onPress={reload}>
            Yritä uudelleen
          </ControlButton>
        </p>
      ) : !listing ? (
        <p>Luetaan roskakoria…</p>
      ) : (
        <TrashList
          rows={rows}
          busy={busy}
          onRestore={restore}
          onPurge={openPurge}
        />
      )}
      {listing?.truncated ? (
        <p className="ah-trash-intro">
          Näytetään {listing.entries.length} ensimmäistä.
        </p>
      ) : null}
      <TrashPurgeDialog
        key={purge?.entry ?? ""}
        row={purge}
        busy={!!busy && busy === purge?.entry}
        problem={purgeProblem}
        onConfirm={confirmPurge}
        onClose={() => setPurge(undefined)}
      />
      <TrashEmptyDialog
        isOpen={emptyOpen}
        count={rows.length}
        size={total || undefined}
        busy={busy === "*"}
        onConfirm={confirmEmpty}
        onClose={() => setEmptyOpen(false)}
      />
    </section>
  );
}
