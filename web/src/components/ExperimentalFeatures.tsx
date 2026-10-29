import type { ReactNode } from "react";
import { ControlButton, Segmented } from "./ControlElements";
import "./ExperimentalFeatures.css";

/** What a feature's card says. `landed` is false until the feature itself
 * is in the product; its issue sets it when it lands, and until then the
 * card says the choice waits for it. */
export type ExperimentalFeature = {
  id: string;
  name: string;
  desc: string;
  where: string;
  shows: string;
  needs: string;
  caption: string;
  landed: boolean;
};

export const experimentalFeatures = [
  {
    id: "next-waiting-row",
    name: "Seuraava odottava keskustelu",
    desc: "Kun olet vastannut ja agentti on aloittanut, kentän yläpuolelle tulee seuraava sinua odottava keskustelu.",
    where:
      "Keskustelun alareunassa, kirjoituskentän yläpuolella, kun agentti työskentelee.",
    shows: "Keskustelun nimen, miksi se odottaa ja Avaa-painikkeen (Alt+↓).",
    needs: "Ei muuta. Järjestys seuraa toistaiseksi sivupalkkia.",
    caption: "Keskustelun alareuna",
    landed: false,
  },
  {
    id: "worker-row-sentence",
    name: "Workerin työ rivillä",
    desc: "Workerin rivi kertoo sanoin, onko se jo tehnyt jotain: commitit, muutokset ja pull requestin tarkistukset.",
    where: "Workerit-paneelin riveillä ja sivupalkin worktree-keskusteluissa.",
    shows:
      "”2 committia · 3 muutosta”, ”PR #412 luonnos, tarkistukset käynnissä” tai ”ei vielä muutoksia”.",
    needs: "PR-tiedot näkyvät, kun gh on kirjautunut (Koodipalvelut).",
    caption: "Workerit-paneeli",
    landed: false,
  },
  {
    id: "terminal-watch",
    name: "Päätteen Pi:n katselu",
    desc: "Päätteessä käynnissä olevan Pi:n tmux-ikkunaa voi katsoa selaimen päätepaneelissa. Selain ei kirjoita siihen.",
    where: "Päätteessä aloitetun keskustelun alareunassa: Katso päätteessä.",
    shows: "Tmux-ikkunan sellaisenaan päätepaneelin välilehdellä, vain luku.",
    needs:
      "Pi käynnissä tmuxissa samalla käyttäjällä. Ilman tmuxia painiketta ei ole.",
    caption: "Päätepaneeli",
    landed: false,
  },
] as const satisfies readonly ExperimentalFeature[];

/** A small drawing of what the feature adds, grey while it is off. It is
 * decoration: the facts beside it say the same in words. */
function Picture({ id, on }: { id: string; on: boolean }) {
  let body: ReactNode;
  if (id === "next-waiting-row")
    body = (
      <>
        <span className="ex-ghost ex-ghost-own" />
        <span className="ex-ghost" style={{ width: "80%" }} />
        <span className="ex-ghost" style={{ width: "55%" }} />
        <span className="ex-next">
          <span className="ex-dot" />
          <b>Kuvien pakkaus</b>
          <span className="ex-why">uusi vastaus · 12 min</span>
          <span className="ex-open">Avaa</span>
        </span>
        <span className="ex-composer">Kirjoita agentille…</span>
      </>
    );
  else if (id === "worker-row-sentence")
    body = (
      <>
        <span className="ex-wrow">
          <span className="ex-dot" />
          <span className="ex-lines">
            <span className="ex-l1">
              <b>Sääaseman CSV-vienti</b>
              <span>18 min</span>
            </span>
            <span className="ex-l2">
              <span className="ex-state">agentti odottaa</span> ·{" "}
              <span className="ex-hl">2 committia · 3 muutosta</span>
            </span>
          </span>
        </span>
        <span className="ex-wrow">
          <span className="ex-ring" />
          <span className="ex-lines">
            <span className="ex-l1">
              <b>Vanhan rajapinnan poisto</b>
              <span>2 min</span>
            </span>
            <span className="ex-l2">
              agentti ei odota ·{" "}
              <span className="ex-hl">ei vielä muutoksia</span>
            </span>
          </span>
        </span>
      </>
    );
  else
    body = (
      <>
        <span className="ex-tabs">
          <span className="ex-tab">$ bash</span>
          <span className="ex-tab ex-tab-current">
            work:2 <span className="ex-ro">vain luku</span>
          </span>
        </span>
        <span className="ex-term">
          <span className="ex-term-a">pi</span> ~/src/aurinkokello · gpt-5.5
          {"\n"}› Aja testit ja korjaa, mitä löytyy.{"\n"}
          <span className="ex-term-g">●</span> bash python -m pytest -q{" "}
          <span className="ex-term-g">14 passed</span>
        </span>
      </>
    );
  return (
    <div className="ex-pic" data-off={on ? undefined : ""} aria-hidden="true">
      {body}
    </div>
  );
}

/** Kokeelliset ominaisuudet: one card per feature with a picture, where it
 * appears, what it shows and what it needs, and its switch. Off by default;
 * a choice shows only once the daemon has confirmed it. */
export function ExperimentalFeaturesControl({
  enabled,
  disabled,
  busy,
  error,
  onChange,
  onReload,
  features = experimentalFeatures,
}: {
  enabled: (id: string) => boolean;
  /** No switch can be used: not yet read, or a write is in flight. */
  disabled: boolean;
  /** The feature whose write is in flight. */
  busy?: string;
  /** "read", or the feature whose write failed. */
  error?: string;
  onChange: (id: string, on: boolean) => void;
  onReload?: () => void;
  features?: readonly ExperimentalFeature[];
}) {
  const alert = (testId: string, text: string) => (
    <div className="s-row ex-alert">
      <p role="alert" data-testid={testId}>
        {text}
      </p>
      {onReload && (
        <ControlButton
          data-testid={`${testId}-reload`}
          size="row"
          onPress={onReload}
          isDisabled={!!busy}
        >
          Lue tallennettu valinta
        </ControlButton>
      )}
    </div>
  );
  return (
    <div className="s-stack" data-testid="experimental-features">
      <p className="s-intro">
        Keskeneräisiä ominaisuuksia, joita voit kokeilla jo nyt. Ne voivat vielä
        muuttua tai poistua. Valinnat tallentuvat tilillesi ja koskevat kaikkia
        laitteitasi.
      </p>
      {error === "read" && (
        <div className="s-card">
          {alert(
            "experimental-read-error",
            "Valintoja ei voitu lukea. Lue tallennettu valinta uudelleen.",
          )}
        </div>
      )}
      {features.map((f) => {
        const on = enabled(f.id);
        return (
          <section
            key={f.id}
            className="ex-card"
            data-settings-row={f.id}
            data-testid={`experimental-${f.id}`}
            tabIndex={-1}
            aria-label={f.name}
            aria-busy={busy === f.id || undefined}
          >
            <div className="s-row">
              <div className="s-lbl">
                <strong>{f.name}</strong>
                <span className="s-desc">{f.desc}</span>
              </div>
              <div className="s-val">
                <Segmented
                  data-testid={`experimental-${f.id}-choice`}
                  label={f.name}
                  options={[
                    { id: "off", label: "Pois" },
                    { id: "on", label: "Päällä" },
                  ]}
                  value={on ? "on" : "off"}
                  isDisabled={disabled}
                  onChange={(v) => {
                    if ((v === "on") !== on) onChange(f.id, v === "on");
                  }}
                />
              </div>
            </div>
            {error === f.id &&
              alert(
                `experimental-${f.id}-error`,
                "Valintaa ei voitu tallentaa. Lue tallennettu valinta ennen uutta yritystä.",
              )}
            <div className="ex-body">
              <figure className="ex-figure">
                <figcaption>{f.caption}</figcaption>
                <Picture id={f.id} on={on} />
              </figure>
              <dl className="ex-facts">
                <div>
                  <dt>Missä</dt>
                  <dd>{f.where}</dd>
                </div>
                <div>
                  <dt>Mitä näkyy</dt>
                  <dd>{f.shows}</dd>
                </div>
                <div>
                  <dt>Edellyttää</dt>
                  <dd>{f.needs}</dd>
                </div>
              </dl>
            </div>
            {!f.landed && (
              <p
                className="ex-coming"
                data-testid={`experimental-${f.id}-coming`}
              >
                Tulossa. Tämä versio ei vielä näytä ominaisuutta; valintasi
                tulee voimaan, kun se on valmis.
              </p>
            )}
          </section>
        );
      })}
    </div>
  );
}
