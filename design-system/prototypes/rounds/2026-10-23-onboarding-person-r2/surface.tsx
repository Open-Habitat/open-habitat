import type { Account, Provider } from "../../../../web/src/app/integrations";
import React, { useState, useEffect, useRef } from "react";
import { createRoot, Root } from "react-dom/client";
import { ModalOverlay, Modal, Dialog, Heading } from "react-aria-components";
import { ControlButton } from "../../../../web/src/components/ControlElements";
import {
  ProviderMark,
  ConnectDialog,
  IntegrationsOverview,
} from "../../../../web/src/components/Integrations";
import { PiDeviceSignIn } from "../../../../web/src/components/PiDeviceSignIn";
import "../../../../web/src/components/components.css";
import "./surface.css";

// All authority is synthetic and in memory. No requests, credentials or native writes.
const google: Provider = {
  id: "google",
  available: true,
  login: "pasted_redirect",
  services: ["mail", "calendar", "contacts", "drive"],
};
const repos = [
  { name: "aurinkolabra/tuote", age: 2, default: true },
  { name: "aurinkolabra/design", age: 8 },
  { name: "aurinkolabra/pilotti", age: 70 },
  { name: "aurinkolabra/muistiinpanot", age: null },
];
const account: Account = {
  provider: "google",
  address: "aino@example.test",
  checked_at: "2026-10-23T12:00:00Z",
  services: [
    { id: "mail", state: "ok" },
    { id: "calendar", state: "ok" },
    { id: "contacts", state: "ok" },
    { id: "drive", state: "ok", directory: "~/GoogleDrive" },
  ],
};
function Btn({
  id,
  children,
  onClick,
  quiet = false,
}: {
  id?: string;
  children: React.ReactNode;
  onClick: () => void;
  quiet?: boolean;
}) {
  return (
    <ControlButton
      size="page"
      variant={quiet ? "secondary" : "primary"}
      data-testid={id}
      onPress={onClick}
    >
      {children}
    </ControlButton>
  );
}
function App({ direction }: { direction: number }) {
  const [step, S] = useState(0),
    [mode, M] = useState("preselected"),
    [rule, G] = useState("optional"),
    [fault, F] = useState("none");
  const [selected, T] = useState(["aurinkolabra/tuote"]),
    [old, O] = useState(false),
    [query, Q] = useState("");
  const [repoState, RS] = useState("idle"),
    [connected, C] = useState(false),
    [ai, A] = useState(false),
    [modal, D] = useState(""),
    [pocket, P] = useState(false),
    [paused, Pause] = useState(false),
    [settings, Settings] = useState(false),
    [message, Message] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const steps = [0, 1, ...(rule === "off" ? [] : [2]), 3];
  const labels = ["GitHub", "Repot", "Integraatiot", "AI-tili"];
  const reset = () => {
    S(0);
    T(mode === "none" ? [] : ["aurinkolabra/tuote"]);
    RS("idle");
    C(false);
    A(false);
    D("");
    P(false);
    Pause(false);
    Settings(false);
    O(false);
    Q("");
    Message("");
  };
  useEffect(reset, [mode, rule, fault]);
  useEffect(() => {
    heading.current?.focus();
  }, [step, paused, settings]);
  const nextRepo = () => S(rule === "off" ? 3 : 2);
  const signin = () => {
    if (mode === "auto") {
      if (repoState === "idle")
        RS(fault === "checkout" ? "uncertain" : "confirmed");
      nextRepo();
    } else S(1);
  };
  const checkout = () => {
    if (selected.length && fault === "checkout") {
      RS("uncertain");
      return;
    }
    RS(selected.length ? "confirmed" : "skipped");
    nextRepo();
  };
  const skipRepo = () => {
    RS("skipped");
    T([]);
    nextRepo();
  };
  const summary =
    repoState === "confirmed"
      ? `${mode === "auto" ? "Oletusrepo haettu automaattisesti" : "Repot haettu"}: ${mode === "auto" ? "aurinkolabra/tuote" : selected.join(", ")}`
      : repoState === "uncertain"
        ? "Repon haun tulosta ei tunneta. Tarkista tila myöhemmin; hakua ei toisteta."
        : "Jatkoit ilman repoja.";
  const status = (i: number) =>
    i === 0 && step > 0
      ? "Kirjautunut"
      : i === 1 && step > 1
        ? repoState === "confirmed"
          ? "Haettu"
          : repoState === "uncertain"
            ? "Epäselvä"
            : "Ohitettu"
        : i === 2 && step > 2
          ? connected
            ? "Yhdistetty"
            : "Ohitettu"
          : i === 3 && step > 3
            ? ai
              ? "Yhdistetty"
              : "Ohitettu"
            : i === step
              ? "Nyt"
              : "Seuraavaksi";
  const route = (
    <ol className="r-route">
      {steps.map((i, n) => (
        <li key={i} aria-current={step === i ? "step" : undefined}>
          <span className="r-dot">
            {i < step && status(i) !== "Ohitettu" && status(i) !== "Epäselvä"
              ? "✓"
              : n + 1}
          </span>
          <div>
            <strong>{labels[i]}</strong>
            <small>{status(i)}</small>
          </div>
        </li>
      ))}
    </ol>
  );
  const card =
    step === 0 ? (
      <>
        <p>Kirjaudu omalla tunnuksellasi Aurinkolabraan.</p>
        <div className="r-note">
          {mode === "auto"
            ? "Oletusrepo haetaan kirjautumisen jälkeen automaattisesti."
            : mode === "preselected"
              ? "Sivuston oletusrepo on esivalittu. Päätät hausta seuraavaksi."
              : "Valitset repot seuraavaksi."}
          {mode !== "none" && <code>aurinkolabra/tuote</code>}
        </div>
        <Btn id="signin" onClick={signin}>
          Simuloi GitHub-kirjautuminen
        </Btn>
      </>
    ) : step === 1 ? (
      <>
        <p>Valitse repot työtiloiksi tai jatka ilman niitä.</p>
        {fault === "catalog" ? (
          <p role="alert">Repoluetteloa ei saatu. Voit jatkaa ilman repoja.</p>
        ) : (
          <>
            <label className="r-search">
              Etsi repoa
              <input
                data-testid="search"
                value={query}
                onChange={(e) => Q(e.target.value)}
              />
            </label>
            <label className="r-filter">
              <input
                data-testid="stale"
                type="checkbox"
                checked={old}
                onChange={(e) => O(e.target.checked)}
              />
              Näytä myös yli 14 päivää vanhat
            </label>
            <div className="r-repos">
              {repos
                .filter(
                  (r) =>
                    (old ||
                      r.age === null ||
                      r.age <= 14 ||
                      selected.includes(r.name) ||
                      (r.default && mode !== "none")) &&
                    r.name.includes(query),
                )
                .map((r) => (
                  <label key={r.name}>
                    <input
                      type="checkbox"
                      data-testid={"repo-" + r.name.split("/")[1]}
                      checked={selected.includes(r.name)}
                      onChange={(e) =>
                        T((v) =>
                          e.target.checked
                            ? [...v, r.name]
                            : v.filter((x) => x !== r.name),
                        )
                      }
                    />
                    <span>
                      <code>{r.name}</code>
                      <small>
                        {r.default && mode !== "none"
                          ? "Sivuston oletus · "
                          : ""}
                        {r.age === null
                          ? "Commitin aika tuntematon"
                          : `${r.age} päivää viimeisestä commitista`}
                      </small>
                    </span>
                  </label>
                ))}
            </div>
            <small>
              Valitut, oletusrepot ja tuntemattomat ajat säilyvät näkyvissä.
            </small>
          </>
        )}
        {repoState === "uncertain" ? (
          <p role="alert">{summary}</p>
        ) : (
          fault !== "catalog" && (
            <div className="r-actions">
              <Btn id="checkout" onClick={checkout}>
                {selected.length ? `Hae ${selected.length} ja jatka` : "Jatka"}
              </Btn>
            </div>
          )
        )}
        <div className="r-actions">
          <Btn id="skip-repos" quiet onClick={skipRepo}>
            Jatka ilman repoja
          </Btn>
          {repoState === "uncertain" && (
            <Btn
              id="recheck"
              quiet
              onClick={() => {
                RS("confirmed");
                nextRepo();
              }}
            >
              Simuloi tilan tarkistus
            </Btn>
          )}
        </div>
      </>
    ) : step === 2 ? (
      <>
        <div className="r-provider">
          <ProviderMark provider="google" />
          <div>
            <h3>Google</h3>
            <small>{rule === "required" ? "Pakollinen" : "Valinnainen"}</small>
          </div>
          <span className="r-status" role="status">
            {connected ? "✓ Yhdistetty" : "Ei yhdistetty"}
          </span>
        </div>
        <p className="r-benefit">
          Posti, kalenteri, yhteystiedot ja Drive agenttien käyttöön.
        </p>
        <small>
          Luku ja muokkaus, myös lähetys ja poisto omissa nimissäsi.
        </small>
        <div className="r-actions">
          {connected ? (
            <>
              <code>aino@example.test</code>
              <Btn id="next-google" onClick={() => S(3)}>
                Jatka AI-tiliin
              </Btn>
            </>
          ) : (
            <Btn id="connect-google" onClick={() => D("consent")}>
              Yhdistä Google
            </Btn>
          )}
        </div>
        <div className="r-actions">
          {!connected &&
            (rule === "required" ? (
              <Btn id="pause-required" quiet onClick={() => Pause(true)}>
                Keskeytä ja palaa myöhemmin
              </Btn>
            ) : (
              <Btn id="skip-google" quiet onClick={() => S(3)}>
                Jatka ilman Googlea
              </Btn>
            ))}
        </div>
      </>
    ) : step === 3 ? (
      <>
        <p>AI-tili tarvitaan agentin käyttöön, ei työtilojen selaamiseen.</p>
        <PiDeviceSignIn
          embedded
          view={{ phase: ai ? "connected" : "start" }}
          onRetry={() => A(true)}
          onRefresh={() => A(true)}
        />
        {!ai && (
          <Btn id="connect-ai" onClick={() => A(true)}>
            Simuloi AI-kirjautuminen
          </Btn>
        )}
        <div className="r-actions">
          <Btn id="finish" onClick={() => S(4)}>
            {ai ? "Avaa työtilat" : "Jatka ilman AI-tiliä"}
          </Btn>
        </div>
      </>
    ) : (
      <>
        <p role="status">{summary}</p>
        <p>
          {connected ? "Google yhdistetty." : "Googlea ei yhdistetty."}{" "}
          {ai
            ? "AI-tili yhdistetty."
            : "AI-tili puuttuu; agentti ei vielä käynnisty."}
        </p>
        <Btn id="settings" quiet onClick={() => Settings(true)}>
          Asetukset › Integraatiot
        </Btn>
        <div className="r-actions">
          <Btn id="restart" quiet onClick={reset}>
            Toista käyttöönotto
          </Btn>
        </div>
      </>
    );
  return (
    <div className={"r-demo r-d" + direction}>
      <details className="r-scenarios">
        <summary>Synteettinen prototyyppi · skenaariot</summary>
        <div>
          <label>
            Oletusrepot
            <select
              data-testid="mode"
              value={mode}
              onChange={(e) => M(e.target.value)}
            >
              <option value="preselected">Esivalittu</option>
              <option value="auto">Automaattinen haku</option>
              <option value="none">Ei oletusrepoja</option>
            </select>
          </label>
          <label>
            Google
            <select
              data-testid="rule"
              value={rule}
              onChange={(e) => G(e.target.value)}
            >
              <option value="optional">Valinnainen</option>
              <option value="required">Pakollinen</option>
              <option value="off">Pois käytöstä</option>
            </select>
          </label>
          <label>
            Poikkeus
            <select
              data-testid="fault"
              value={fault}
              onChange={(e) => F(e.target.value)}
            >
              <option value="none">Ei poikkeusta</option>
              <option value="catalog">Luettelo puuttuu</option>
              <option value="checkout">Haun tulos epäselvä</option>
              <option value="denied">Google-lupa evätty</option>
            </select>
          </label>
        </div>
      </details>
      <header className="r-brand">
        <strong>Open Habitat</strong>
        <span>Aurinkolabra</span>
        <small>Käyttöönotto</small>
      </header>
      {settings ? (
        <section className="r-settings">
          <h2 ref={heading} tabIndex={-1}>
            Asetukset › Integraatiot
          </h2>
          <IntegrationsOverview
            list={{
              schema_version: 1,
              providers: [google],
              accounts: connected ? [account] : [],
              skill: connected ? "current" : "none",
            }}
            checking={new Set()}
            onConnect={() => D("consent")}
            onCheck={() => Message("Simulaatio: tila tarkistettu.")}
            onSignInAgain={() => D("consent")}
            onRemove={() => {
              C(false);
              Message("Simulaatio: liitos poistettu.");
            }}
          />
          <p role="status">{message}</p>
          <Btn quiet onClick={() => Settings(false)}>
            Takaisin työtiloihin
          </Btn>
        </section>
      ) : paused ? (
        <section className="r-paused">
          <h2 ref={heading} tabIndex={-1}>
            Käyttöönotto kesken
          </h2>
          <p>Google tarvitaan ennen työtiloihin siirtymistä.</p>
          <Btn id="resume" onClick={() => Pause(false)}>
            Jatka tästä
          </Btn>
          <p>
            <small>Simulaation tila säilyy vain tällä sivulla.</small>
          </p>
          <Btn quiet onClick={reset}>
            Simuloi uloskirjautuminen
          </Btn>
        </section>
      ) : (
        <div className="r-layout">
          <aside className="r-side">
            {direction === 0 ? (
              <>
                <p className="r-kicker">OMA REITTISI</p>
                {route}
                <small>Voit täydentää valinnaiset liitokset myöhemmin.</small>
              </>
            ) : direction === 1 ? (
              <>
                <p className="r-kicker">OLET TÄSSÄ</p>
                <div className="r-compass">
                  <span>
                    {Math.min(
                      steps.indexOf(step) + 1 || steps.length,
                      steps.length,
                    )}{" "}
                    / {steps.length}
                  </span>
                  <strong>{step === 4 ? "Valmis" : labels[step]}</strong>
                </div>
                <div className="r-track">
                  {steps.map((i) => (
                    <span key={i} data-reached={i <= step} />
                  ))}
                </div>
                <p className="r-next">
                  {step < 3 ? (
                    <>
                      Seuraavaksi
                      <br />
                      <strong>{labels[steps[steps.indexOf(step) + 1]]}</strong>
                    </>
                  ) : (
                    "Työtilat odottavat"
                  )}
                </p>
                <details>
                  <summary>Kaikki vaiheet</summary>
                  {route}
                </details>
              </>
            ) : (
              <>
                <Btn id="route-toggle" quiet onClick={() => P(!pocket)}>
                  {pocket ? "Sulje reitti" : "Näytä reitti"} ·{" "}
                  {step < 4 ? steps.indexOf(step) + 1 : steps.length}/
                  {steps.length}
                </Btn>
                {pocket && <div className="r-pocket">{route}</div>}
              </>
            )}
          </aside>
          <main className="r-main" data-step={step}>
            <p className="r-kicker">
              {step === 4
                ? "KÄYTTÖÖNOTTO VALMIS"
                : `VAIHE ${steps.indexOf(step) + 1} / ${steps.length}`}
            </p>
            <h2 tabIndex={-1} ref={heading}>
              {
                [
                  "Tervetuloa",
                  "Omat repot",
                  "Integraatiot",
                  "AI-tili",
                  "Työtilat",
                ][step]
              }
            </h2>
            {card}
            {step > 1 && step < 4 && (
              <details className="r-receipt">
                <summary>Repojen haun tila</summary>
                <p>{summary}</p>
              </details>
            )}
            {step > 0 && step < 4 && (
              <footer>
                <Btn
                  id="back"
                  quiet
                  onClick={() =>
                    S(
                      step === 3 && rule === "off"
                        ? 1
                        : step === 2 && mode === "auto"
                          ? 0
                          : step - 1,
                    )
                  }
                >
                  Takaisin
                </Btn>
              </footer>
            )}
          </main>
        </div>
      )}
      {modal === "consent" && (
        <ModalOverlay
          className="r-overlay"
          isOpen
          isDismissable
          onOpenChange={(open) => !open && D("")}
        >
          <Modal className="r-consent">
            <Dialog aria-label="Google-luvan simulaatio">
              <ProviderMark provider="google" />
              <Heading slot="title">Google · luvan hyväksyntä</Heading>
              <p>Vain simulaatio. Oikeaa Googlea ei avata.</p>
              {fault === "denied" ? (
                <p role="alert">Lupaa ei myönnetty. Mitään ei yhdistetty.</p>
              ) : (
                <Btn id="approve" onClick={() => D("folders")}>
                  Simuloi hyväksyntä
                </Btn>
              )}
              <div className="r-actions">
                <Btn id="cancel-google" quiet onClick={() => D("")}>
                  Palaa yhdistämättä
                </Btn>
              </div>
            </Dialog>
          </Modal>
        </ModalOverlay>
      )}
      <ConnectDialog
        provider={modal === "folders" ? google : undefined}
        stage={{
          stage: "login",
          view: {
            schema_version: 1,
            state: "choose_folders",
            provider: "google",
            address: "aino@example.test",
            directory: "~/GoogleDrive",
            free_bytes: 8000000000,
            quota_bytes: 10000000000,
            folders: [
              {
                id: "work",
                name: "Tiimin materiaalit",
                bytes: 400000000,
                suggested: true,
              },
              {
                id: "archive",
                name: "Arkisto",
                bytes: 1000000000,
                suggested: false,
              },
            ],
          },
        }}
        onContinue={() => {}}
        onPassword={() => {}}
        onPaste={() => {}}
        onFolders={() => {
          C(true);
          D("");
        }}
        onRestart={() => D("consent")}
        onClose={() => D("")}
      />
    </div>
  );
}
let root: Root | undefined;
function mount(direction: number) {
  root?.unmount();
  requestAnimationFrame(() => {
    const el = document.getElementById("person-root");
    if (el) {
      root = createRoot(el);
      root.render(<App direction={direction} />);
    }
  });
  return '<div id="person-root"></div>';
}
Object.assign(window, {
  personMap: () => mount(0),
  personCompass: () => mount(1),
  personPocket: () => mount(2),
});
