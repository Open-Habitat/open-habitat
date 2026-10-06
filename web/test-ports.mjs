// Test-only listeners. OH_PORT_BASE=4174 preserves the original four ports.
const raw = process.env.OH_PORT_BASE ?? "4174";
if (!/^[0-9]+$/.test(raw) || Number(raw) < 1024 || Number(raw) > 65525)
  throw new Error("OH_PORT_BASE must be an integer from 1024 to 65525");
const base = Number(raw);
export const ports = {
  host: base,
  lab: base + 1,
  vite: base + 9,
  demo: base + 10,
};
export const hostOrigin = `https://127.0.0.1:${ports.host}`;
export const labOrigin = `https://127.0.0.1:${ports.lab}`;
export const viteOrigin = `http://127.0.0.1:${ports.vite}`;
export const demoOrigin = `http://127.0.0.1:${ports.demo}`;
