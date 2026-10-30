import { useCallback, useEffect, useRef, useState } from "react";
import {
  AddMachineDialog,
  OwnMachinesPage,
  type Wizard,
  type WizardStep,
} from "../components/OwnMachines";
import { Button } from "../components/Primitives";
import { jsonWrite, writeOutcome } from "./mutations";
import {
  type Check,
  type OwnMachines as Data,
  type OwnMachinesRequest,
  ownMachinesPath,
  ownMachinesRefusal,
  readOwnMachines,
} from "./ownMachines";

const freshWizard = (): Wizard => ({
  mode: "add",
  step: 1,
  user: "",
  days: 0,
});

/** Asetukset › Omat koneet: the person's daemon reads and does everything;
 * this page holds only the dialog's progress and the last checks it made. */
export function OwnMachines({ csrf }: { csrf?: string }) {
  const [data, setData] = useState<Data>();
  const [error, setError] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [wizard, setWizard] = useState<Wizard>();
  const [checks, setChecks] = useState<Record<string, Check>>({});
  const [checking, setChecking] = useState<string>();
  const [removed, setRemoved] = useState<{ name: string; os?: string }>();
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const phone = useRef(
    typeof window !== "undefined" &&
      window.matchMedia?.("(max-width: 640px)").matches,
  );

  useEffect(() => {
    void csrf;
    void refresh;
    const controller = new AbortController();
    void fetch(ownMachinesPath, {
      credentials: "same-origin",
      cache: "no-store",
      signal: controller.signal,
    })
      .then(readOwnMachines)
      .then((d) => {
        if (controller.signal.aborted) return;
        setError(false);
        setData(d);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError(true);
      });
    return () => controller.abort();
  }, [csrf, refresh]);

  // While Tailscale waits for the person's login, read again until it is
  // done; nothing is sent meanwhile.
  const waiting =
    wizard?.step === 1 &&
    data !== undefined &&
    ["login", "approval", "starting"].includes(data.tailscale.state);
  useEffect(() => {
    if (!waiting) return;
    const timer = window.setInterval(() => setRefresh((n) => n + 1), 2000);
    return () => window.clearInterval(timer);
  }, [waiting]);

  /** One request; the reply is the whole page again. A lost reply is never
   * sent again: the page reads what is on the account instead. */
  const send = useCallback(
    async (body: OwnMachinesRequest) => {
      if (!csrf) return { ok: false as const, message: "Kirjaudu uudelleen." };
      let response: Response | undefined;
      try {
        response = await jsonWrite(
          "account.own_machines",
          ownMachinesPath,
          body,
          csrf,
        );
        const reply = await readOwnMachines(response);
        setData(reply);
        return { ok: true as const, reply };
      } catch {
        const outcome = await writeOutcome(response?.ok ? undefined : response);
        setRefresh((n) => n + 1);
        if (outcome.kind === "refused")
          return {
            ok: false as const,
            message: ownMachinesRefusal(outcome.code),
          };
        if (outcome.kind === "login")
          return { ok: false as const, message: "Kirjaudu uudelleen." };
        return {
          ok: false as const,
          message: "Tulosta ei saatu varmistettua. Tiedot luettiin uudelleen.",
        };
      }
    },
    [csrf],
  );

  const patch = (p: Partial<Wizard>) =>
    setWizard((w) => (w ? { ...w, ...p } : w));

  const page = async (
    body: OwnMachinesRequest,
    after?: (reply: Data) => void,
  ) => {
    setBusy(true);
    setNotice("");
    const r = await send(body);
    setBusy(false);
    if (r.ok) after?.(r.reply);
    else setNotice(r.message);
  };

  const wizardActions = {
    connect: async () => {
      patch({ busy: "connect", error: undefined });
      const r = await send({ action: "connect" });
      patch({ busy: undefined, error: r.ok ? undefined : r.message });
    },
    close: () => {
      setWizard(undefined);
      setRefresh((n) => n + 1);
    },
    setStep: async (step: WizardStep) => {
      if (!wizard) return;
      if (step === 4 && wizard.mode === "add" && wizard.peer) {
        // The line is asked for on reaching its step; a machine changed
        // since gets a new one.
        patch({ step, busy: "grant", error: undefined, check: undefined });
        const r = await send({
          action: "grant",
          peer: wizard.peer,
          user: wizard.user,
          days: wizard.days,
        });
        patch(
          r.ok
            ? { busy: undefined, grant: r.reply.grant }
            : { busy: undefined, error: r.message, step: 3 },
        );
        return;
      }
      patch({ step, error: undefined });
    },
    choose: async (p: Partial<Pick<Wizard, "peer" | "user" | "days">>) => {
      patch({ ...p, grant: undefined, check: undefined });
      if (wizard?.mode === "renew" && wizard.peer && p.days !== undefined) {
        // A renewal's new length is a new line.
        patch({ busy: "grant" });
        const r = await send({
          action: "renew",
          machine: wizard.peer,
          days: p.days,
        });
        patch(
          r.ok
            ? { busy: undefined, grant: r.reply.grant }
            : { busy: undefined, error: r.message },
        );
      }
    },
    check: async () => {
      if (!wizard?.grant) return;
      patch({ busy: "check", error: undefined, check: undefined });
      const r = await send(
        wizard.mode === "renew"
          ? { action: "recheck", machine: wizard.grant.machine }
          : {
              action: "check",
              peer: wizard.grant.machine,
              user: wizard.grant.user,
            },
      );
      patch(
        r.ok
          ? { busy: undefined, check: r.reply.check }
          : { busy: undefined, error: r.message },
      );
    },
    save: async () => {
      const g = wizard?.grant;
      if (!wizard || !g) return;
      patch({ busy: "save", error: undefined });
      const r = await send(
        wizard.mode === "renew"
          ? { action: "extend", machine: g.machine, expires: g.expires }
          : {
              action: "save",
              peer: g.machine,
              user: g.user,
              expires: g.expires,
              host_key: wizard.check?.host_key ?? "",
            },
      );
      if (r.ok && r.reply.saved) {
        setChecks((c) => {
          const next = { ...c };
          delete next[g.machine];
          return next;
        });
        setWizard(undefined);
        return;
      }
      patch(
        r.ok
          ? { busy: undefined, check: r.reply.check, step: 4 }
          : { busy: undefined, error: r.message },
      );
    },
    mismatch: () => patch({ mismatch: true }),
    restart: () => setWizard(freshWizard()),
  };

  const actions = {
    connect: () => void page({ action: "connect" }),
    disconnect: () => void page({ action: "disconnect" }, () => setChecks({})),
    addMachine: () => {
      setRemoved(undefined);
      setWizard({
        ...freshWizard(),
        step: data?.tailscale.state === "on" ? 2 : 1,
      });
    },
    renew: async (machine: string) => {
      const m = data?.machines.find((x) => x.name === machine);
      if (!m) return;
      setWizard({
        mode: "renew",
        step: 4,
        peer: machine,
        user: m.user,
        days: 0,
        busy: "grant",
      });
      const r = await send({ action: "renew", machine, days: 0 });
      setWizard((w) =>
        w
          ? r.ok
            ? { ...w, busy: undefined, grant: r.reply.grant }
            : { ...w, busy: undefined, error: r.message }
          : w,
      );
    },
    recheck: async (machine: string) => {
      setChecking(machine);
      setNotice("");
      const r = await send({ action: "recheck", machine });
      setChecking(undefined);
      if (r.ok && r.reply.check) {
        const c = r.reply.check;
        setChecks((now) => ({ ...now, [machine]: c }));
      } else if (!r.ok) setNotice(r.message);
    },
    remove: (machine: string) => {
      // The machine leaves the page with the reply; its line's command
      // still needs the machine's shell.
      const os = data?.machines.find((m) => m.name === machine)?.os;
      void page({ action: "remove", machine }, () => {
        setRemoved({ name: machine, os });
      });
    },
    copy: async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        return true;
      } catch {
        return false;
      }
    },
  };

  if (!data)
    return error ? (
      <div className="s-stack">
        <p role="alert" data-testid="own-machines-error">
          Koneiden tietoja ei voitu lukea. Yritä uudelleen.
        </p>
        <span>
          <Button
            data-testid="own-machines-retry"
            size="row"
            label="Yritä uudelleen"
            variant="secondary"
            onPress={() => setRefresh((n) => n + 1)}
          />
        </span>
      </div>
    ) : (
      <p className="s-desc" data-testid="own-machines-loading">
        Luetaan koneita…
      </p>
    );
  return (
    <>
      <OwnMachinesPage
        data={data}
        checks={checks}
        checking={checking}
        removed={removed}
        notice={notice}
        busy={busy}
        actions={actions}
      />
      {wizard && (
        <AddMachineDialog
          data={data}
          wizard={wizard}
          actions={wizardActions}
          copy={actions.copy}
          phone={phone.current}
        />
      )}
    </>
  );
}
