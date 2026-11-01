# text/workerTerminal.ts

Generated from web/src/text/workerTerminal.ts; do not edit.

```tsx
import { catalog } from "../i18n";

// A live worker's read-only Taskfleet window (app/WorkerTerminal.tsx).
const fi = {
  closed: "Workerin pääte sulkeutui.",
  notFound: "Workerin päätettä ei löytynyt tästä työtilasta.",
  label: "Workerin pääte (vain luku)",
};

export const workerTerminalText = catalog(fi, {
  closed: "The worker's terminal closed.",
  notFound: "The worker's terminal was not found in this workspace.",
  label: "Worker's terminal (read only)",
});

```
