import { catalog } from "../i18n";

// One tool use in a conversation (components/PiBlocks.tsx): its states and
// the summary of a failed one.
const fi = {
  states: {
    forming: "muodostaa kutsua…",
    called: "odottaa ajoa",
    running: "ajossa",
    succeeded: "valmis",
    failed: "epäonnistui",
    cancelled: "keskeytetty",
    unknown: "tila ei tiedossa",
  },
  failed: "Agentti ilmoitti työkalun virheestä.",
};

export const piBlocksText = catalog(fi, {
  states: {
    forming: "preparing the call…",
    called: "waiting to run",
    running: "running",
    succeeded: "done",
    failed: "failed",
    cancelled: "interrupted",
    unknown: "status unknown",
  },
  failed: "The agent reported a tool error.",
});
