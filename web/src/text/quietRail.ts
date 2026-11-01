import { catalog } from "../i18n";

const fi = {
  title: "Hiljaiset",
  empty: "Ei hiljaisia keskusteluja.",
  fold: "Taita Hiljaiset",
  unfold: "Näytä Hiljaiset",
  /** The count when one workspace is chosen: shown of all. */
  narrowed: (shown: number, all: number) => `${shown}/${all}, ${all} yhteensä`,
  menu: "Rajaa ja järjestä Hiljaiset",
  order: "Järjestys",
  sorts: { newest: "Uusin", workspace: "Työtila", name: "Nimi" },
  workspaces: "Työtilat",
  all: "Kaikki",
  done: "Valmis",
  notSaved: "Valintaa ei tallennettu. Yritä uudelleen.",
  pills: "Avaa yksi työtila",
  pill: (name: string, count: number) =>
    `Avaa Hiljaiset: vain ${name} (${count})`,
  kept: "avoinna, rajauksen ulkopuolelta",
};
export const quietRailText = catalog(fi, {
  title: "Quiet",
  empty: "No quiet conversations.",
  fold: "Fold Quiet",
  unfold: "Show Quiet",
  narrowed: (shown, all) => `${shown}/${all}, ${all} in all`,
  menu: "Narrow and sort Quiet",
  order: "Order",
  sorts: { newest: "Newest", workspace: "Workspace", name: "Name" },
  workspaces: "Workspaces",
  all: "All",
  done: "Done",
  notSaved: "The choice was not saved. Try again.",
  pills: "Open one workspace",
  pill: (name, count) => `Open Quiet: only ${name} (${count})`,
  kept: "open, outside the narrowing",
});
