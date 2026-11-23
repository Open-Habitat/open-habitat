import { catalog, plural } from "../i18n";

const fi = {
  changed: (n: number) => `${n} keskustelun tila muuttui`,
  arrival: (name: string, state: string) => `${name} · ${state}`,
};
export const railStateMotionText = catalog(fi, {
  changed: (n: number) =>
    `${n} ${plural("en-US", n, { one: "conversation changed state", other: "conversations changed state" })}`,
  arrival: (name: string, state: string) => `${name} · ${state}`,
});
