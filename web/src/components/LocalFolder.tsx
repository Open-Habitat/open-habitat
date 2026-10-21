import { createContext, useContext } from "react";
import { ControlButton } from "./ControlElements";
import "./LocalFolder.css";

/** Browser-owned state, supplied by the app; no native handles enter the UI. */
export type LocalFolderView = {
  supported: boolean;
  name?: string;
  issue?: "aborted" | "security" | "failed";
  onChoose: () => void;
  onStop: () => void;
};
export const LocalFolderContext = createContext<LocalFolderView | undefined>(
  undefined,
);

export function LocalFolder({
  view,
  onAttach,
}: {
  view: LocalFolderView;
  onAttach?: () => void;
}) {
  return (
    <section
      className="ah-local-folder"
      data-testid="local-folder"
      aria-label="Oman koneen kansio"
    >
      <h2>Oman koneen kansio</h2>
      {!view.supported ? (
        <>
          <p data-testid="local-folder-unavailable">
            Oman koneen kansio ei ole käytettävissä tämän selaimen nykyisillä
            asetuksilla. Voit lisätä yksittäisiä tiedostoja liitteinä.
          </p>
          <details>
            <summary>Käytätkö Bravea?</summary>
            <p>
              Voit halutessasi ottaa File System Access API -asetuksen käyttöön.
              Kopioi osoite selaimen osoiteriville:
            </p>
            <code className="ah-local-folder-address">
              brave://flags/#file-system-access-api
            </code>
            <p>
              Ota asetus käyttöön ja käynnistä selain uudelleen. Valitse ja
              salli kansio erikseen tämän jälkeen. Jos asetusta ei löydy, käytä
              liitteitä.
            </p>
          </details>
        </>
      ) : (
        <>
          {view.name ? (
            <p>
              Jaettu kansio: <code>{view.name}</code>
            </p>
          ) : (
            <p>Kansiota ei ole jaettu tässä selaimessa.</p>
          )}
          <p>
            Agentti voi selata ja hakea tiedostoja valitsemastasi kansiosta
            tämän välilehden ollessa auki. Kansiota ei lähetetä kokonaan:
            pyydetyt tiedostot siirtyvät palvelimelle liitteinä.
          </p>
          <p data-testid="local-folder-guidance">
            Valitse oma alikansio, esimerkiksi <code>Downloads/agentille</code>.
            Selain voi estää koko koti-, työpöytä-, asiakirja- tai
            Lataukset-kansion jakamisen. Siirrä kuvakaappaukset alikansioon tai
            lisää yksittäinen tiedosto liitteenä.
          </p>
          {view.issue ? (
            <p role="status" data-testid="local-folder-picker-issue">
              {view.issue === "aborted"
                ? "Kansion valinta peruttiin tai selain ei sallinut sitä. Kokeile erillistä alikansiota tai lisää tiedosto liitteenä."
                : view.issue === "security"
                  ? "Selain esti kansion valinnan. Yritä uudelleen tästä painikkeesta tai lisää tiedosto liitteenä."
                  : "Kansion valinta ei onnistunut. Yritä uudelleen tai lisää tiedosto liitteenä."}
              {view.name
                ? " Aiemmin jaettu kansio on edelleen käytössä."
                : " Kansiota ei jaettu."}
            </p>
          ) : null}
          <div className="ah-local-folder-actions">
            <ControlButton
              size="row"
              data-testid={
                view.name ? "local-folder-open" : "local-folder-share"
              }
              onPress={view.onChoose}
            >
              {view.name ? "Vaihda kansio" : "Valitse kansio…"}
            </ControlButton>
            {view.name ? (
              <ControlButton
                size="row"
                data-testid="local-folder-unshare"
                onPress={view.onStop}
              >
                Lopeta jakaminen
              </ControlButton>
            ) : null}
          </div>
        </>
      )}
      {onAttach ? (
        <ControlButton
          size="row"
          data-testid="local-folder-attach"
          onPress={onAttach}
        >
          Lisää tiedosto liitteenä
        </ControlButton>
      ) : null}
    </section>
  );
}

export function LocalFolderIntegration() {
  const view = useContext(LocalFolderContext);
  return view ? <LocalFolder view={view} /> : null;
}
