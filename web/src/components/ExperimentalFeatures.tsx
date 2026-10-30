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
    desc: "Kun olet vastannut ja agentti on aloittanut, voit käydä sinua odottavat keskustelut läpi yhtenä kierroksena.",
    where:
      "Keskustelun alareunassa, kirjoituskentän yläpuolella. Kierroksen ajan jono näkyy jokaisessa keskustelussa.",
    shows:
      "Montako odottaa ja Käy läpi (Alt+↓). Kierroksella koko jonon: Seuraava (Alt+↓), Edellinen (Alt+↑) ja ✕ (Esc).",
    needs: "Ei muuta. Järjestys seuraa toistaiseksi sivupalkkia.",
    caption: "Keskustelun alareuna",
    landed: true,
  },
  {
    id: "worker-row-sentence",
    name: "Workerin työ rivillä",
    desc: "Workerin rivi kertoo sanoin, onko se jo tehnyt jotain: commitit, muutokset ja pull requestin tarkistukset.",
    where:
      "Workerit-paneelin riveillä ja workerin näkymässä. Sivupalkin worktree-keskustelut kertovat commitit ja muutokset ilman PR:ää.",
    shows:
      "”2 committia · 3 muutosta”, ”PR #412 luonnos, tarkistukset käynnissä” tai ”ei vielä muutoksia”.",
    needs: "PR-tiedot näkyvät, kun gh on kirjautunut (Koodipalvelut).",
    caption: "Workerit-paneeli",
    landed: true,
  },
  {
    id: "composer-dictation-bar",
    name: "Sanelupalkki",
    desc: "Sanele ja Lähetä pysyvät kirjoituskentän oikeassa reunassa, eivätkä rivin painikkeet hyppää, kun agentti aloittaa työn. Sanellessa rivi muuttuu kuuntelupalkiksi.",
    where:
      "Kirjoituskentän alarivillä. Ohjaa ja Stop tulevat Saneleen vasemmalle puolelle; puhelimessa apupainikkeet ovat kuvakkeita.",
    shows:
      "Sanellessa ✕ (peru, kenttä palaa ennalleen), aika, ääniaalto ja ”Enter valmis”. Saneleen paikalla on Valmis.",
    needs: "Sanelu käytössä (Soniox-avain, Asetukset › Sanelu).",
    caption: "Kirjoituskentän rivi sanellessa",
    landed: true,
  },
  {
    id: "workspace-icons",
    name: "Työtilan kuvake",
    desc: "Sivupalkin keskustelujen edessä on niiden työtilan kuvake, joten Käynnissä ei enää toista työtilan nimeä otsikkona. Kuvake vaihdetaan työtilan sivun otsikosta, ja mallisi ehdottaa kuvaketta työtilalle, jolla sitä ei vielä ole.",
    where:
      "Sivupalkin Sinun vuorosi-, Käynnissä- ja Työtilat-riveillä sekä kapeassa kaistaleessa editorin vieressä. Kuvakkeesta aukeaa kortti: koko nimi, kuvakkeen lähde, työtilasivu ja uusi keskustelu. Työtilan sivulla otsikon kuvake avaa valitsimen.",
    shows:
      "Repon .open-habitat.yaml-tiedoston icon-kentän hymiön, kirjaimet tai kuvan, muuten repon logon (esimerkiksi favicon.svg), muuten nimestä johdetun kirjaintunnuksen.",
    needs:
      "Valinta kirjoitetaan repon juuren .open-habitat.yaml-tiedostoon ja commitoidaan saman tien, vain se tiedosto eikä pushia. Commit tarvitsee Git-identiteetin. Ehdotukset tekee oma mallisi (API-avain tai tilaus, myös pelkkä Claude-tilaus), ja se näkee vain nimen, README:n alun, aloitussivun, kielet ja logon polun; icon: auto lopettaa ehdotukset.",
    caption: "Sivupalkki",
    landed: true,
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
          <b>3 odottaa sinua</b>
          <span className="ex-why">Kuvien pakkaus, …</span>
          <span className="ex-open">Käy läpi</span>
        </span>
        <span className="ex-composer">Kirjoita agentille…</span>
      </>
    );
  else if (id === "composer-dictation-bar")
    body = (
      <>
        <span className="ex-ghost" style={{ width: "70%" }} />
        <span className="ex-ghost" style={{ width: "45%" }} />
        <span className="ex-cbox">
          <span className="ex-ctext">Tarkista vielä puhelimen rivi</span>
          <span className="ex-crow">
            <span className="ex-dbar">
              <span className="ex-dx">✕</span>
              <span className="ex-ddot" />
              <b>0:06</b>
              <span className="ex-dwave" />
              <span className="ex-dhint">Enter valmis</span>
            </span>
            <span className="ex-ddone">✓ Valmis</span>
            <span className="ex-dsend" />
          </span>
        </span>
      </>
    );
  else if (id === "workspace-icons")
    body = [
      ["🦊", "Ikoniprototyypin suunnat", "nyt"],
      ["🦊", "Rail-ikonit", "3 min"],
      ["OH", "pilot.16 testipalvelimelle", "22 min"],
    ].map(([icon, title, age], i) => (
      <span key={title} className="ex-irow" data-gap={i === 2 || undefined}>
        <span className="ex-icon" data-glyph={icon === "OH" || undefined}>
          {icon}
        </span>
        <span className="ex-dot" />
        <b>{title}</b>
        <span>{age}</span>
      </span>
    ));
  else
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
