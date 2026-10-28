import { describe, expect, it } from "vitest";
import {
  Dictation,
  type DictationDeps,
  type DictationView,
  stopAtMs,
} from "./dictation";
import { SpeechError, type SpeechSession } from "./speech";

class FakeSocket {
  binaryType = "blob";
  readyState = 0;
  sent: (string | ArrayBuffer)[] = [];
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: (() => void) | null = null;
  constructor(
    readonly url: string,
    readonly protocols: string[],
  ) {}
  send(data: string | ArrayBuffer) {
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  reply(body: object) {
    this.onmessage?.({ data: JSON.stringify(body) });
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
  texts() {
    return this.sent.filter((d): d is string => typeof d === "string");
  }
}

function harness(mints: (SpeechSession | SpeechError)[]) {
  let clock = 1_000;
  const sockets: FakeSocket[] = [];
  let frame: ((pcm: Int16Array, level: number) => void) | null = null;
  let ticks: (() => void)[] = [];
  const views: DictationView[] = [];
  let minted = 0;
  const deps: DictationDeps = {
    mint: async () => {
      const next = mints[minted++];
      if (!next || next instanceof SpeechError)
        throw next ?? new SpeechError("speech_unavailable");
      return next;
    },
    microphone: async () => ({ getTracks: () => [] }) as unknown as MediaStream,
    capture: async (_stream, onFrame) => {
      frame = onFrame;
      return { sampleRate: 48_000, close: () => {} };
    },
    socket: (url, protocols) => {
      const s = new FakeSocket(url, protocols);
      sockets.push(s);
      return s as unknown as WebSocket;
    },
    now: () => clock,
    setInterval: (run) => ticks.push(run),
    clearInterval: () => {
      ticks = [];
    },
  };
  const d = new Dictation(deps, (v) => views.push(v));
  return {
    d,
    sockets,
    views,
    mintCount: () => minted,
    audio: (level = 0.5) => frame?.(new Int16Array(4800), level),
    advance: (ms: number) => {
      clock += ms;
      for (const t of ticks) t();
    },
  };
}

const session = (n: number): SpeechSession => ({
  schema_version: 1,
  api_key: `snx_temp_${n}`,
  expires_at: "2026-10-28T09:01:00Z",
  websocket_url: "wss://stt-rt.eu.soniox.com/transcribe-websocket",
  max_session_seconds: 600,
});

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("Dictation", () => {
  it("streams with the temporary key, keeps the guess apart and starts a paragraph after a long pause", async () => {
    const h = harness([session(1)]);
    await h.d.start();
    const ws = h.sockets[0];
    expect(ws?.protocols).toEqual(["soniox-api-key", "snx_temp_1"]);
    // Audio heard before the stream opens is sent after the start message.
    h.audio();
    ws?.open();
    const start = JSON.parse(ws?.texts()[0] ?? "{}");
    expect(start).toMatchObject({
      audio_format: "pcm_s16le",
      sample_rate: 48_000,
      num_channels: 1,
    });
    expect(ws?.sent[1]).toBeInstanceOf(ArrayBuffer);
    expect(h.d.view.phase).toBe("live");
    ws?.reply({
      tokens: [
        { text: " Hei", start_ms: 0, end_ms: 300, is_final: true },
        { text: " maa", start_ms: 300, end_ms: 500, is_final: false },
      ],
    });
    expect(h.d.view).toMatchObject({ final: "Hei", interim: " maa" });
    ws?.reply({
      tokens: [
        { text: " maailma.", start_ms: 300, end_ms: 900, is_final: true },
        { text: "<end>", is_final: true },
        { text: " Uusi", start_ms: 5_200, end_ms: 5_500, is_final: true },
      ],
    });
    expect(h.d.view).toMatchObject({
      final: "Hei maailma.\n\nUusi",
      interim: "",
    });
  });

  it("sends a keepalive when nothing has gone to Soniox for a while", async () => {
    const h = harness([session(1)]);
    await h.d.start();
    h.sockets[0]?.open();
    h.advance(10_000);
    expect(h.sockets[0]?.texts()).toHaveLength(1);
    h.advance(10_000);
    expect(JSON.parse(h.sockets[0]?.texts()[1] ?? "{}")).toEqual({
      type: "keepalive",
    });
  });

  it("reconnects once with a new key, keeping the unconfirmed words, then ends with what it heard", async () => {
    const h = harness([session(1), session(2)]);
    await h.d.start();
    h.sockets[0]?.open();
    h.sockets[0]?.reply({
      tokens: [
        { text: "Yksi", start_ms: 0, end_ms: 300, is_final: true },
        { text: " kaksi", is_final: false },
      ],
    });
    h.sockets[0]?.drop();
    expect(h.d.view.phase).toBe("reconnecting");
    // Audio during the gap waits for the new stream.
    h.audio();
    await flush();
    const second = h.sockets[1];
    expect(second?.protocols).toEqual(["soniox-api-key", "snx_temp_2"]);
    second?.open();
    expect(second?.sent.filter((d) => d instanceof ArrayBuffer)).toHaveLength(
      1,
    );
    expect(h.d.view).toMatchObject({ phase: "live", final: "Yksi kaksi" });
    second?.reply({ tokens: [{ text: " kolme", is_final: false }] });
    second?.drop();
    await flush();
    expect(h.sockets).toHaveLength(2);
    expect(h.d.view).toMatchObject({
      phase: "idle",
      ended: "dropped",
      final: "Yksi kaksi kolme",
    });
  });

  it("ends a dictation that cannot reconnect with the text it has", async () => {
    const h = harness([session(1), new SpeechError("speech_unavailable")]);
    await h.d.start();
    h.sockets[0]?.open();
    h.sockets[0]?.reply({ tokens: [{ text: "Sana", is_final: true }] });
    h.sockets[0]?.drop();
    await flush();
    expect(h.d.view).toMatchObject({ ended: "dropped", final: "Sana" });
  });

  it("stops before the ten-minute ceiling and waits for Soniox's last words", async () => {
    const h = harness([session(1)]);
    await h.d.start();
    const ws = h.sockets[0];
    ws?.open();
    ws?.reply({ tokens: [{ text: " Alku", is_final: true }] });
    h.advance(stopAtMs - 1_000);
    expect(h.d.view.phase).toBe("live");
    h.advance(1_000);
    expect(h.d.view.phase).toBe("finishing");
    // The empty text frame ends the stream.
    expect(ws?.texts().at(-1)).toBe("");
    ws?.reply({
      tokens: [{ text: " loppu.", is_final: true }],
      finished: true,
    });
    await flush();
    expect(h.d.view).toMatchObject({
      phase: "idle",
      ended: "ceiling",
      final: "Alku loppu.",
    });
  });

  it("reports a refused start without text, and a refused key mid-dictation with the text", async () => {
    const missing = harness([new SpeechError("speech_key_missing")]);
    await missing.d.start();
    expect(missing.d.view).toMatchObject({
      phase: "idle",
      ended: "failed",
      failure: "speech_key_missing",
    });
    expect(missing.sockets).toHaveLength(0);

    const rejected = harness([session(1)]);
    await rejected.d.start();
    rejected.sockets[0]?.open();
    rejected.sockets[0]?.reply({ error_code: 401, error_message: "x" });
    expect(rejected.d.view).toMatchObject({
      ended: "failed",
      failure: "speech_key_rejected",
    });
  });

  it("stop resolves with the confirmed text even when Soniox does not answer", async () => {
    const h = harness([session(1)]);
    await h.d.start();
    h.sockets[0]?.open();
    h.sockets[0]?.reply({
      tokens: [
        { text: "Valmis", is_final: true },
        { text: " teksti", is_final: false },
      ],
    });
    const stopped = h.d.stop();
    h.sockets[0]?.drop();
    expect(await stopped).toBe("Valmis teksti");
    expect(h.d.view.ended).toBe("stopped");
    expect(h.mintCount()).toBe(1);
  });
});
