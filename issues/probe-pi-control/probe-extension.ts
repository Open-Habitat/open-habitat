import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

const wait = (ms: number, signal?: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(timer);
      reject(new Error("probe wait aborted"));
    }, { once: true });
  });

export default function probeExtension(pi: ExtensionAPI) {
  pi.registerTool({
    name: "probe_stream",
    label: "Disposable probe stream",
    description: "Emit synthetic, non-sensitive intermediate output for integration testing.",
    parameters: Type.Object({}),
    async execute(_id, _params, signal, onUpdate) {
      onUpdate?.({ content: [{ type: "text", text: "synthetic step 1/2" }], details: { step: 1 } });
      await wait(700, signal);
      onUpdate?.({ content: [{ type: "text", text: "synthetic step 2/2" }], details: { step: 2 } });
      await wait(700, signal);
      return { content: [{ type: "text", text: "synthetic stream complete" }], details: { step: 2 } };
    },
  });

  pi.registerTool({
    name: "probe_wait",
    label: "Disposable probe wait",
    description: "Wait long enough for the integration probe to test abort.",
    parameters: Type.Object({}),
    async execute(_id, _params, signal, onUpdate) {
      onUpdate?.({ content: [{ type: "text", text: "synthetic wait started" }], details: {} });
      await wait(30_000, signal);
      return { content: [{ type: "text", text: "synthetic wait complete" }], details: {} };
    },
  });

  pi.registerCommand("probe-question", {
    description: "Exercise the RPC extension UI response path with synthetic data",
    handler: async (_args, ctx) => {
      const answer = await ctx.ui.input("Disposable probe question", "synthetic answer");
      pi.appendEntry("probe-question-answer", { answer: answer ?? null });
      ctx.ui.notify(answer === undefined ? "Probe answer cancelled" : "Probe answer recorded", "info");
    },
  });
}
