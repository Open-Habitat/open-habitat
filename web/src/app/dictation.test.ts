import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AudioInput,
  chainAtMs,
  chainLatestMs,
  Dictation,
  type DictationDeps,
  type DictationView,
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

function harness(
  mints: (SpeechSession | SpeechError | Promise<SpeechSession>)[],
) {
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
    socket: (n: number) => {
      const socket = sockets[n];
      if (!socket) throw new Error(`Socket ${n} has not opened`);
      return socket;
    },
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

afterEach(() => vi.useRealTimers());

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
    h.advance(5_000);
    expect(h.sockets[0]?.texts()).toHaveLength(1);
    h.advance(5_000);
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

  it("stops at two hours and waits for Soniox's last words", async () => {
    const h = harness([session(1)]);
    await h.d.start();
    const ws = h.sockets[0];
    ws?.open();
    ws?.reply({ tokens: [{ text: " Alku", is_final: true }] });
    h.advance(7_200_000);
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

  it("chains only at a pause or the deadline, routes every frame once, and finalizes old tokens before opening the next stream", async () => {
    vi.useFakeTimers();
    const h = harness([session(1), session(2), session(3)]);
    await h.d.start();
    const first = h.socket(0);
    first.open();
    first.reply({
      tokens: [
        { text: "First", is_final: true },
        { text: " wor", is_final: false },
      ],
    });
    h.advance(chainAtMs - 100);
    h.audio();
    h.advance(100);
    expect(first.texts()).not.toContain("");
    h.advance(300);
    expect(first.texts().at(-1)).toBe("");
    const firstFrames = first.sent.filter(
      (x) => x instanceof ArrayBuffer,
    ).length;
    h.audio();
    h.audio();
    expect(first.sent.filter((x) => x instanceof ArrayBuffer)).toHaveLength(
      firstFrames,
    );
    expect(h.mintCount()).toBe(1);
    first.reply({
      tokens: [{ text: " word.", is_final: true }],
      finished: true,
    });
    await vi.advanceTimersByTimeAsync(0);
    const second = h.socket(1);
    second.open();
    expect(second.sent.filter((x) => x instanceof ArrayBuffer)).toHaveLength(2);
    second.reply({ tokens: [{ text: "Next", is_final: true }] });
    // Late callbacks from the retired socket cannot duplicate its words.
    first.reply({
      tokens: [{ text: " word.", is_final: true }],
      finished: true,
    });
    expect(h.d.view.final).toBe("First word. Next");
    h.advance(chainLatestMs - 100);
    h.audio();
    h.advance(100);
    expect(second.texts().at(-1)).toBe("");
    h.d.cancel();
    await vi.advanceTimersByTimeAsync(0);
    expect(h.mintCount()).toBe(2);
  });

  it("stopping during a chain flushes captured seam audio before returning text", async () => {
    vi.useFakeTimers();
    const h = harness([session(1), session(2)]);
    await h.d.start();
    const first = h.socket(0);
    first.open();
    h.advance(chainAtMs);
    h.audio();
    const stopped = h.d.stop();
    first.reply({ tokens: [{ text: "Old", is_final: true }], finished: true });
    await vi.advanceTimersByTimeAsync(0);
    const second = h.socket(1);
    second.open();
    await vi.advanceTimersByTimeAsync(0);
    expect(second.sent.filter((x) => x instanceof ArrayBuffer)).toHaveLength(1);
    expect(second.texts().at(-1)).toBe("");
    second.reply({ tokens: [{ text: "new", is_final: true }], finished: true });
    await expect(stopped).resolves.toBe("Old new");
    expect(h.d.view.ended).toBe("stopped");
  });

  it.each(["timeout", "close"])(
    "a chain %s recovers as a drop, keeping the best transcript and unsent audio",
    async (failure) => {
      vi.useFakeTimers();
      const h = harness([session(1), session(2)]);
      await h.d.start();
      const first = h.socket(0);
      first.open();
      first.reply({
        tokens: [
          { text: "Kept", is_final: true },
          { text: " guess", is_final: false },
        ],
      });
      h.advance(chainAtMs);
      h.audio();
      if (failure === "close") first.drop();
      await vi.advanceTimersByTimeAsync(4000);
      expect(h.d.view).toMatchObject({
        phase: "reconnecting",
        final: "Kept guess",
      });
      expect(h.mintCount()).toBe(2);
      h.sockets[1]?.open();
      expect(
        h.sockets[1]?.sent.filter((x) => x instanceof ArrayBuffer),
      ).toHaveLength(1);
      h.d.cancel();
    },
  );

  it("does not mint a new key when stopped during a drain with no buffered audio", async () => {
    vi.useFakeTimers();
    const h = harness([session(1)]);
    await h.d.start();
    h.sockets[0]?.open();
    h.advance(chainAtMs);
    const stopped = h.d.stop();
    h.sockets[0]?.reply({
      tokens: [{ text: "Done", is_final: true }],
      finished: true,
    });
    await expect(stopped).resolves.toBe("Done");
    expect(h.mintCount()).toBe(1);
  });

  it("a stop bounds a stalled chain mint and keeps the transcript with a drop notice", async () => {
    vi.useFakeTimers();
    let mint: (session: SpeechSession) => void = () => {};
    const h = harness([
      session(1),
      new Promise<SpeechSession>((resolve) => {
        mint = resolve;
      }),
    ]);
    await h.d.start();
    h.sockets[0]?.open();
    h.advance(chainAtMs);
    h.audio();
    h.sockets[0]?.reply({
      tokens: [{ text: "Kept", is_final: true }],
      finished: true,
    });
    await vi.advanceTimersByTimeAsync(0);
    const stopped = h.d.stop();
    await vi.advanceTimersByTimeAsync(5000);
    await expect(stopped).resolves.toBe("Kept");
    expect(h.d.view.ended).toBe("dropped");
    mint(session(2));
    await vi.advanceTimersByTimeAsync(0);
    expect(h.sockets).toHaveLength(1);
  });

  it("carries a paragraph pause across provider timestamp resets", async () => {
    vi.useFakeTimers();
    const h = harness([session(1), session(2)]);
    await h.d.start();
    h.sockets[0]?.open();
    h.audio();
    h.sockets[0]?.reply({
      tokens: [{ text: "Paragraph.", end_ms: 40, is_final: true }],
    });
    h.advance(chainAtMs);
    h.sockets[0]?.reply({ finished: true });
    await vi.advanceTimersByTimeAsync(0);
    h.sockets[1]?.open();
    h.sockets[1]?.reply({
      tokens: [{ text: "New", start_ms: 6000, end_ms: 6300, is_final: true }],
    });
    expect(h.d.view.final).toBe("Paragraph.\n\nNew");
    h.d.cancel();
  });

  it("warns once per threshold across two hours of chained streams", async () => {
    vi.useFakeTimers();
    const h = harness(Array.from({ length: 13 }, (_, n) => session(n)));
    await h.d.start();
    h.socket(0).open();
    let at = 0;
    // Twelve rollovers, with time for the final reply at every boundary.
    for (let n = 0; n < 12; n++) {
      h.advance(chainLatestMs);
      at += chainLatestMs;
      h.socket(n).reply({
        tokens: [{ text: ` ${n}`, is_final: true }],
        finished: true,
      });
      await vi.advanceTimersByTimeAsync(0);
      h.socket(n + 1).open();
    }
    expect(h.d.view.phase).toBe("live");
    expect(h.d.view.warning).toBeUndefined();
    h.advance(7_140_000 - at);
    h.advance(50_000);
    h.advance(500);
    h.advance(9500);
    expect(h.d.view.phase).toBe("finishing");
    h.socket(12).reply({
      tokens: [{ text: " end", is_final: true }],
      finished: true,
    });
    await vi.advanceTimersByTimeAsync(0);
    const transitions = h.views
      .filter((v, i) => v.warning && v.warning !== h.views[i - 1]?.warning)
      .map((v) => v.warning);
    expect(transitions).toEqual(["minute", "ten-seconds", "limit"]);
    expect(h.d.view).toMatchObject({
      ended: "ceiling",
      final: "0 1 2 3 4 5 6 7 8 9 10 11 end",
    });
    expect(h.mintCount()).toBe(13);
  });

  it("reports a refused key or a stream refused at its start as a failed start", async () => {
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

  it("cancel ends at once with nothing heard and closes the stream", async () => {
    const h = harness([session(1)]);
    await h.d.start();
    const ws = h.sockets[0];
    ws?.open();
    ws?.reply({
      tokens: [
        { text: "Hei", is_final: true },
        { text: " maa", is_final: false },
      ],
    });
    h.d.cancel();
    expect(h.d.view).toMatchObject({
      phase: "idle",
      final: "",
      interim: "",
      ended: "cancelled",
    });
    expect(ws?.readyState).toBe(3);
    // No end-of-stream frame: Soniox is not asked to finish.
    expect(ws?.texts()).not.toContain("");
    // Words that arrive after the cancel land nowhere.
    ws?.reply({ tokens: [{ text: " myöhässä", is_final: true }] });
    expect(h.d.view.final).toBe("");
  });

  it("a second stop while Soniox finishes waits for the same final text", async () => {
    const h = harness([session(1)]);
    await h.d.start();
    const ws = h.sockets[0];
    ws?.open();
    ws?.reply({ tokens: [{ text: "Hei", is_final: true }] });
    const first = h.d.stop();
    const second = h.d.stop();
    ws?.reply({
      tokens: [{ text: " maailma", is_final: true }],
      finished: true,
    });
    expect(await second).toBe("Hei maailma");
    expect(await first).toBe("Hei maailma");
  });

  it("a stop while the browser asks for the microphone releases the microphone it gets later", async () => {
    let grant: (s: MediaStream) => void = () => {};
    let stopped = 0;
    const h = harness([session(1)]);
    const d = new Dictation(
      {
        ...(h.d as unknown as { deps: DictationDeps }).deps,
        microphone: () => new Promise<MediaStream>((r) => (grant = r)),
      },
      () => {},
    );
    const started = d.start();
    await d.stop();
    grant({
      getTracks: () => [{ stop: () => stopped++ }],
    } as unknown as MediaStream);
    await started;
    expect(stopped).toBe(1);
    expect(d.view.phase).toBe("idle");
    expect(h.sockets).toHaveLength(0);
  });

  describe("from the press", () => {
    // A dictation whose microphone and key arrive when the case says.
    function gated(mints: (SpeechSession | SpeechError)[]) {
      const h = harness(mints);
      const base = (h.d as unknown as { deps: DictationDeps }).deps;
      let grant: () => void = () => {};
      const keys: ((ok: boolean) => void)[] = [];
      let tracksStopped = 0;
      let warmed = 0;
      const d = new Dictation(
        {
          ...base,
          warm: () => warmed++,
          microphone: () =>
            new Promise<MediaStream>((r) => {
              grant = () =>
                r({
                  getTracks: () => [{ stop: () => tracksStopped++ }],
                } as unknown as MediaStream);
            }),
          mint: (signal) =>
            new Promise<void>((r) => keys.push(() => r())).then(() =>
              base.mint(signal),
            ),
        },
        () => {},
      );
      return {
        ...h,
        d,
        grant: async () => {
          grant();
          await flush();
        },
        key: async () => {
          keys.shift()?.(true);
          await flush();
        },
        keysAsked: () => keys.length,
        tracksStopped: () => tracksStopped,
        warmed: () => warmed,
      };
    }

    it("asks for the key and readies the audio while the microphone opens, and listens before the stream is ready", async () => {
      const h = gated([session(1)]);
      void h.d.start();
      await flush();
      // The key and the audio graph are on their way before the
      // microphone has answered, so the press waits only for it.
      expect(h.keysAsked()).toBe(1);
      expect(h.warmed()).toBe(1);
      expect(h.d.view.phase).toBe("connecting");
      await h.grant();
      expect(h.d.view.phase).toBe("live");
      expect(h.sockets).toHaveLength(0);
      h.audio();
      h.audio();
      await h.key();
      const ws = h.sockets[0];
      ws?.open();
      expect(ws?.texts()[0]).toContain("pcm_s16le");
      expect(ws?.sent.filter((x) => x instanceof ArrayBuffer)).toHaveLength(2);
    });

    it("a stop before the stream opens still sends what was said and waits for its words", async () => {
      const h = gated([session(1)]);
      void h.d.start();
      await h.grant();
      h.audio();
      const stopped = h.d.stop();
      expect(h.d.view.phase).toBe("finishing");
      expect(h.tracksStopped()).toBe(1);
      await h.key();
      const ws = h.sockets[0];
      ws?.open();
      await flush();
      expect(ws?.sent.map((x) => typeof x)).toEqual([
        "string",
        "object",
        "string",
      ]);
      expect(ws?.texts().at(-1)).toBe("");
      ws?.reply({
        tokens: [{ text: "Ensimmäiset sanat", is_final: true }],
        finished: true,
      });
      expect(await stopped).toBe("Ensimmäiset sanat");
      expect(h.d.view).toMatchObject({ phase: "idle", ended: "stopped" });
    });

    it("replaces a key that a long microphone prompt left old", async () => {
      const h = gated([session(1), session(2)]);
      void h.d.start();
      await h.key();
      h.advance(31_000);
      await h.grant();
      expect(h.sockets).toHaveLength(0);
      await h.key();
      expect(h.sockets[0]?.protocols).toEqual(["soniox-api-key", "snx_temp_2"]);
    });

    it("a missing key ends the start without waiting for the microphone, which is let go when it comes", async () => {
      const h = gated([new SpeechError("speech_key_missing")]);
      void h.d.start();
      await h.key();
      expect(h.d.view).toMatchObject({
        phase: "idle",
        ended: "failed",
        failure: "speech_key_missing",
      });
      await h.grant();
      expect(h.tracksStopped()).toBe(1);
      expect(h.sockets).toHaveLength(0);
    });

    it("a stream refused before it opened fails the start even after a stop", async () => {
      const h = gated([session(1)]);
      void h.d.start();
      await h.grant();
      h.audio();
      const stopped = h.d.stop();
      await h.key();
      h.sockets[0]?.drop();
      await stopped;
      expect(h.d.view).toMatchObject({
        ended: "failed",
        failure: "speech_unavailable",
      });
    });
  });
});

describe("AudioInput", () => {
  // A Web Audio stand-in that counts contexts and worklet loads.
  function fakeAudio(failFirstLoad = false) {
    const made: FakeContext[] = [];
    let loads = 0;
    class FakeNode {
      port = { onmessage: null as unknown };
      connect() {}
      disconnect() {}
    }
    class FakeContext {
      state = "running";
      sampleRate = 48_000;
      destination = {};
      audioWorklet = {
        addModule: async () => {
          loads++;
          if (failFirstLoad && loads === 1) throw new Error("load");
        },
      };
      constructor() {
        made.push(this);
      }
      async suspend() {
        this.state = "suspended";
      }
      async resume() {
        this.state = "running";
      }
      async close() {
        this.state = "closed";
      }
      createMediaStreamSource() {
        return new FakeNode();
      }
      createGain() {
        return { gain: { value: 1 }, connect() {}, disconnect() {} };
      }
    }
    vi.stubGlobal("AudioContext", FakeContext);
    vi.stubGlobal("AudioWorkletNode", FakeNode);
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL: () => "blob:x",
      revokeObjectURL: () => {},
    });
    return { made, loads: () => loads };
  }
  const stream = {} as MediaStream;

  afterEach(() => vi.unstubAllGlobals());

  it("readies one context ahead of the press, keeps it quiet until then and reuses it for every dictation", async () => {
    const audio = fakeAudio();
    const input = new AudioInput();
    input.warm();
    input.warm();
    await flush();
    expect(audio.made).toHaveLength(1);
    expect(audio.loads()).toBe(1);
    // Made outside a press, it does not run on its own.
    expect(input.output).toBeNull();
    const first = await input.capture(stream, () => {});
    first.close();
    const second = await input.capture(stream, () => {});
    second.close();
    expect(audio.made).toHaveLength(1);
    expect(audio.loads()).toBe(1);
    // Closing a capture keeps the context for cues; leaving closes it.
    expect(input.output).not.toBeNull();
    input.close();
    expect(audio.made[0]?.state).toBe("closed");
  });

  it("tries a failed worklet load again at the press", async () => {
    const audio = fakeAudio(true);
    const input = new AudioInput();
    input.warm();
    await flush();
    await input.capture(stream, () => {});
    expect(audio.loads()).toBe(2);
  });
});
