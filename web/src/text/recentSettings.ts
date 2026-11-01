import { catalog, plural } from "../i18n";

const fi = {
  label: "Viimeisimmät keskustelut",
  desc: "Sivupalkin viimeisimpien keskustelujen määrä, 1–20. Avoin keskustelu pysyy lisäksi näkyvissä. Koskee kaikkia laitteitasi.",
  error:
    "Asetusta ei voitu vahvistaa. Tarkista nykyinen arvo ennen uutta muutosta.",
  reload: "Tarkista",
  unit: (count: number) =>
    plural("fi", count, { one: "keskustelu", other: "keskustelua" }),
};
export const recentSettingsText = catalog(fi, {
  label: "Recent conversations",
  desc: "Number of recent conversations in the sidebar, 1–20. The open conversation stays visible too. Applies to all your devices.",
  error:
    "The setting could not be confirmed. Check its current value before changing it again.",
  reload: "Check",
  unit: (count: number) =>
    plural("en-US", count, { one: "conversation", other: "conversations" }),
});
