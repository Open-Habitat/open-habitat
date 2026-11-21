// Test-only: stands in for the companion's turn mode in a turn without all
// its tools (process-extension.mjs turnModeApiKey).
export default function () {
  globalThis[Symbol.for('open-habitat.turn-mode')] = Object.freeze({ webTools: () => false });
}
