import { catalog } from "../i18n";

const fi = {
  title: "Hiljaiset",
  empty: "ei mitään",
  fold: "Taita Hiljaiset",
  unfold: "Näytä Hiljaiset",
  menu: "Rajaa ja järjestä Hiljaiset",
  order: "Järjestys",
  sorts: { newest: "Uusin", workspace: "Työtila", name: "Nimi" },
  pills: "Avaa yksi työtila",
  pill: (name: string, count: number) =>
    `Avaa Hiljaiset: vain ${name} (${count})`,
};
export const quietRailText = catalog(fi, {
  title: "Quiet",
  empty: "none",
  fold: "Fold Quiet",
  unfold: "Show Quiet",
  menu: "Narrow and sort Quiet",
  order: "Order",
  sorts: { newest: "Newest", workspace: "Workspace", name: "Name" },
  pills: "Open one workspace",
  pill: (name, count) => `Open Quiet: only ${name} (${count})`,
});
