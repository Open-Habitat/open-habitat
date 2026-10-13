// Test-only listeners. OH_PORT_BASE=4174 preserves the original four ports.
const raw = process.env.OH_PORT_BASE ?? "4174";
if (!/^[0-9]+$/.test(raw) || Number(raw) < 1024 || Number(raw) > 65480)
  throw new Error("OH_PORT_BASE must be an integer from 1024 to 65480");
const base = Number(raw);
export const ports = {
  host: base,
  lab: base + 1,
  vite: base + 9,
  demo: base + 10,
};
// Playwright assigns a stable parallel index to each worker slot, including restarts.
// The independent lab host and Vite server keep their original ports.
export const workerHostPort = (index) => base + 20 + index;
export const labWorkerHostPort = (index) => base + 40 + index;
export const hostOrigin = `https://127.0.0.1:${process.env.TEST_PARALLEL_INDEX === undefined ? ports.host : workerHostPort(Number(process.env.TEST_PARALLEL_INDEX))}`;
export const labOrigin = `https://127.0.0.1:${process.env.TEST_PARALLEL_INDEX === undefined ? ports.lab : labWorkerHostPort(Number(process.env.TEST_PARALLEL_INDEX))}`;
export const viteOrigin = `http://127.0.0.1:${ports.vite}`;
export const demoOrigin = `http://127.0.0.1:${ports.demo}`;
