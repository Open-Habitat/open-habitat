import { Link } from "react-router";
export function EmptyWorkspace({ path }: { path: string }) {
  return (
    <main id="main" tabIndex={-1}>
      <p className="eyebrow">YHTEYS VALMIS</p>
      <h1>Native Agent Host</h1>
      <p className="lead">
        Sovelluspohja on yhteydessä, mutta tämä toimitus ei vielä lue oikeita
        workspaceja tai Pi-historiaa.
      </p>
      <div className="boundary">
        <h2>Foundation-raja</h2>
        <ul>
          <li>
            Reitti: <code>{path}</code>
          </li>
          <li>Natiivit historiat säilyvät omilla omistajillaan.</li>
          <li>Kirjoitustoiminnot eivät ole vielä käytössä.</li>
        </ul>
      </div>
      <Link to="/workspaces">Näytä workspacet</Link>
    </main>
  );
}
