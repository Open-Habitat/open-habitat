const scale = Number(process.env.OH_TIMEOUT_SCALE ?? 1);
if (!Number.isFinite(scale) || scale < 1) {
  throw new Error("OH_TIMEOUT_SCALE must be a finite number >= 1");
}
export const stressTimeouts = {
  timeout: 30_000 * scale,
  expect: { timeout: 5_000 * scale },
};
