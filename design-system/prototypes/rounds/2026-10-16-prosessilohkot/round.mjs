// Round of 2026-10-16 (issue proto-processes-blocks): riff on 2026-10-16-prosessit after
// Jari chose direction 3, Kentän yllä, with "Poista päättyneet". The same story in every
// direction: the agent starts background processes, a finished process reaches the agent
// as steering while it works or wakes it when its turn has ended, and a `taskfleet run
// wait` process is shown as the spinoff it waits on. The state model gains "Odottaa
// prosessia" and "Odottaa spinoffia" in the sidebar, the home page, the top bar and the
// recap. The axis is how loudly a process speaks in the thread.
export const title = 'Keskustelu · prosessilohkot ja odotustilat';
export const app = true;
export const variants = [
  { name: 'Merkintänä', axis: 'käynnistys on tavallinen process-työkalurivi työn sisällä ja päättyminen hiljainen merkintärivi; kentän yllä oleva rivi kertoo loput', fn: 'v1' },
  { name: 'Korttina', axis: 'käynnistys jättää vastauksen alle elävän prosessikortin, ja päättyminen on kortti, jossa on lopputulos ja tulosteen viimeiset rivit', fn: 'v2' },
  { name: 'Viestinä', axis: 'päättyminen näkyy prosessin viestinä agentille, kuten se natiivisti on; agentin vuoro vastaa siihen', fn: 'v3' },
];
