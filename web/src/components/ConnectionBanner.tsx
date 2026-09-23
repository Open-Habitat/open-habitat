import type { Bootstrap } from "../app/bootstrap";
export function ConnectionBanner({
  state,
}: {
  state: "loading" | Bootstrap["state"];
}) {
  if (state === "authenticated") return null;
  const labels = {
    loading: "Ladataan palvelimen tilaa…",
    authentication_required: "Istunto puuttuu tai on vanhentunut.",
    daemon_unavailable: "Käyttäjän agenttipalveluun ei saada yhteyttä.",
  } as const;
  const urgent = state !== "loading";
  return (
    <div
      className={`banner banner-${state}`}
      role={urgent ? "alert" : "status"}
    >
      {labels[state]}
    </div>
  );
}
