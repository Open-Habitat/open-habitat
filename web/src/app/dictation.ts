import type { SpeechFailure, SpeechSession } from "./speech";
import { SpeechError } from "./speech";

/** One dictation into the composer (proto-speech-input, Jari 2026-10-28):
 * the browser captures the microphone as 16-bit PCM and streams it straight
 * to Soniox with a temporary key from the person's own daemon. Confirmed
 * text and Soniox's still-changing guess are kept apart; a dropped
 * connection is reopened once with a new key; the dictation ends at a fixed
 * ten-minute ceiling, which Soniox also enforces on the key. */

export type DictationPhase =
  | "idle"
  | "connecting"
  | "live"
  | "reconnecting"
  | "finishing";

/** How the last dictation ended, for the notice under the field. */
export type DictationEnd = "stopped" | "ceiling" | "dropped" | "failed";

export type DictationView = {
  phase: DictationPhase;
  /** Confirmed text, paragraphs included. */
  final: string;
  /** Soniox's current guess after it; it may still change. */
  interim: string;
  /** Since the stream first opened. */
  elapsedMs: number;
  /** Microphone level, 0–1. */
  level: number;
  /** How long the microphone has been quiet. */
  quietMs: number;
  ended?: DictationEnd;
  failure?: SpeechFailure;
};

/** The key's session ceiling; the daemon mints with the same number. */
export const ceilingMs = 600_000;
/** The note above the field appears a minute before the end. */
export const warnAtMs = ceilingMs - 60_000;
/** The browser ends a little early, so the last words are finalised before
 * Soniox closes the stream itself. */
export const stopAtMs = ceilingMs - 2_000;
/** A longer pause in speech starts a new paragraph. */
export const paragraphGapMs = 4_000;
/** Soniox closes a stream that hears nothing for 60 s. */
const keepaliveMs = 20_000;
/** Audio kept while the connection is reopened. */
const bufferedSeconds = 30;
/** How long a stop waits for Soniox's last words. */
const finishWaitMs = 4_000;
const quietLevel = 0.02;

export type AudioCapture = { sampleRate: number; close: () => void };

export type DictationDeps = {
  mint: (signal: AbortSignal) => Promise<SpeechSession>;
  microphone: () => Promise<MediaStream>;
  capture: (
    stream: MediaStream,
    onFrame: (pcm: Int16Array, level: number) => void,
  ) => Promise<AudioCapture>;
  socket: (url: string, protocols: string[]) => WebSocket;
  now: () => number;
  setInterval: (run: () => void, ms: number) => number;
  clearInterval: (id: number) => void;
};

type Token = {
  text: string;
  start_ms?: number;
  end_ms?: number;
  is_final: boolean;
};

const idle: DictationView = {
  phase: "idle",
  final: "",
  interim: "",
  elapsedMs: 0,
  level: 0,
  quietMs: 0,
};

export class Dictation {
  view: DictationView = idle;
  private deps: DictationDeps;
  private onChange: (view: DictationView) => void;
  private run = 0;
  private abort: AbortController | null = null;
  private stream: MediaStream | null = null;
  private capture: AudioCapture | null = null;
  private ws: WebSocket | null = null;
  private wsReady = false;
  private pending: ArrayBuffer[] = [];
  private pendingBytes = 0;
  private openedAt: number | null = null;
  private lastSent = 0;
  private lastVoice = 0;
  private lastFinalEnd: number | null = null;
  private reconnected = false;
  /** Soniox has answered the current stream with something other than an
   * error, so it accepted the key. */
  private accepted = false;
  private tick: number | null = null;
  private finished: (() => void) | null = null;
  private finishing: Promise<void> | null = null;

  constructor(deps: DictationDeps, onChange: (view: DictationView) => void) {
    this.deps = deps;
    this.onChange = onChange;
  }

  get active() {
    return this.view.phase !== "idle";
  }

  private set(next: Partial<DictationView>) {
    this.view = { ...this.view, ...next };
    this.onChange(this.view);
  }

  /** Starts a dictation; the result shows in the view. */
  async start() {
    if (this.active) return;
    const run = ++this.run;
    this.abort = new AbortController();
    this.reconnected = false;
    this.openedAt = null;
    this.lastFinalEnd = null;
    this.pending = [];
    this.pendingBytes = 0;
    this.set({ ...idle, phase: "connecting" });
    try {
      // The microphone first: its prompt may take longer than the key's
      // one minute to open a stream.
      let stream: MediaStream;
      try {
        stream = await this.deps.microphone();
      } catch {
        throw new SpeechError("microphone_denied");
      }
      // A dictation stopped while the browser asked must not keep the
      // microphone it was given afterwards.
      if (run !== this.run) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      this.stream = stream;
      const capture = await this.deps
        .capture(stream, (pcm, level) => this.frame(run, pcm, level))
        .catch(() => {
          throw new SpeechError("unsupported");
        });
      if (run !== this.run) {
        capture.close();
        return;
      }
      this.capture = capture;
      const session = await this.deps.mint(this.abort.signal);
      if (run !== this.run) return;
      this.lastVoice = this.deps.now();
      this.open(run, session);
      this.tick = this.deps.setInterval(() => this.onTick(run), 250);
    } catch (error) {
      if (run !== this.run) return;
      this.release();
      this.set({
        ...idle,
        ended: "failed",
        failure:
          error instanceof SpeechError ? error.code : "speech_unavailable",
      });
    }
  }

  private open(run: number, session: SpeechSession) {
    const ws = this.deps.socket(session.websocket_url, [
      "soniox-api-key",
      session.api_key,
    ]);
    ws.binaryType = "arraybuffer";
    this.ws = ws;
    this.wsReady = false;
    this.accepted = false;
    ws.onopen = () => {
      if (run !== this.run || this.ws !== ws || !this.capture) return;
      ws.send(
        JSON.stringify({
          model: "stt-rt-v5",
          audio_format: "pcm_s16le",
          sample_rate: this.capture.sampleRate,
          num_channels: 1,
          language_hints: ["fi", "en"],
        }),
      );
      this.wsReady = true;
      this.lastSent = this.deps.now();
      this.openedAt ??= this.deps.now();
      for (const chunk of this.pending) ws.send(chunk);
      this.pending = [];
      this.pendingBytes = 0;
      if (this.view.phase !== "finishing") this.set({ phase: "live" });
    };
    ws.onmessage = (event) => {
      if (run !== this.run || this.ws !== ws) return;
      if (typeof event.data === "string") this.message(run, event.data);
    };
    ws.onclose = () => {
      if (run !== this.run || this.ws !== ws) return;
      this.ws = null;
      this.wsReady = false;
      if (this.finished) {
        this.finished();
        return;
      }
      void this.reconnect(run);
    };
  }

  private message(run: number, data: string) {
    let reply: {
      tokens?: Token[];
      finished?: boolean;
      error_code?: number;
    };
    try {
      reply = JSON.parse(data);
    } catch {
      return;
    }
    if (typeof reply.error_code === "number") {
      const definite =
        reply.error_code === 401 || reply.error_code === 403
          ? "speech_key_rejected"
          : reply.error_code === 429
            ? "speech_limit_reached"
            : null;
      if (!this.accepted && !this.reconnected) {
        // Refused at the start: nothing was dictated yet.
        this.run++;
        this.release();
        this.set({
          ...idle,
          ended: "failed",
          failure: definite ?? "speech_unavailable",
        });
      } else if (definite) this.end(run, "dropped", definite);
      // Anything else closes the stream next, and the close reconnects.
      return;
    }
    this.accepted = true;
    let final = this.view.final;
    const interim: string[] = [];
    for (const token of reply.tokens ?? []) {
      if (typeof token.text !== "string" || /^<[a-z]+>$/.test(token.text))
        continue;
      if (!token.is_final) {
        interim.push(token.text);
        continue;
      }
      const gap =
        this.lastFinalEnd !== null && typeof token.start_ms === "number"
          ? token.start_ms - this.lastFinalEnd
          : 0;
      if (!final) final = token.text.trimStart();
      else if (gap > paragraphGapMs)
        final = `${final.trimEnd()}\n\n${token.text.trimStart()}`;
      else final += token.text;
      if (typeof token.end_ms === "number") this.lastFinalEnd = token.end_ms;
    }
    let guess = interim.join("");
    if (!final) guess = guess.trimStart();
    this.set({ final, interim: guess });
    if (reply.finished && this.finished) this.finished();
  }

  private frame(run: number, pcm: Int16Array, level: number) {
    if (run !== this.run || !this.active) return;
    const now = this.deps.now();
    if (level > quietLevel) this.lastVoice = now;
    const buffer = pcm.buffer.slice(
      pcm.byteOffset,
      pcm.byteOffset + pcm.byteLength,
    ) as ArrayBuffer;
    if (this.ws && this.wsReady) {
      this.ws.send(buffer);
      this.lastSent = now;
    } else if (this.view.phase !== "finishing" && this.capture) {
      // Kept while the stream opens or reopens, so no words are lost.
      this.pending.push(buffer);
      this.pendingBytes += buffer.byteLength;
      while (this.pendingBytes > this.capture.sampleRate * 2 * bufferedSeconds)
        this.pendingBytes -= this.pending.shift()?.byteLength ?? 0;
    }
    this.set({ level, quietMs: now - this.lastVoice });
    this.checkCeiling(run, now);
  }

  private onTick(run: number) {
    if (run !== this.run || !this.active) return;
    const now = this.deps.now();
    if (this.ws && this.wsReady && now - this.lastSent >= keepaliveMs) {
      this.ws.send(JSON.stringify({ type: "keepalive" }));
      this.lastSent = now;
    }
    this.set({
      elapsedMs: this.openedAt === null ? 0 : now - this.openedAt,
      quietMs: now - this.lastVoice,
    });
    this.checkCeiling(run, now);
  }

  private checkCeiling(run: number, now: number) {
    if (
      this.openedAt !== null &&
      now - this.openedAt >= stopAtMs &&
      (this.view.phase === "live" || this.view.phase === "reconnecting")
    )
      void this.finish(run, "ceiling");
  }

  /** The stream dropped: reopen it once with a new key, else end with
   * what was heard. */
  private async reconnect(run: number) {
    if (this.openedAt === null) {
      // The stream never opened: a failed start, not a drop.
      this.run++;
      this.release();
      this.set({ ...idle, ended: "failed", failure: "speech_unavailable" });
      return;
    }
    if (this.reconnected || this.view.phase !== "live") {
      this.end(run, "dropped");
      return;
    }
    this.reconnected = true;
    // Words Soniox had not confirmed are the best guess there is: they
    // become text, and the new stream starts after them.
    this.commitInterim();
    this.lastFinalEnd = null;
    this.set({ phase: "reconnecting" });
    try {
      const session = await this.deps.mint(
        this.abort?.signal ?? new AbortController().signal,
      );
      if (
        run !== this.run ||
        (this.view.phase as DictationPhase) !== "reconnecting"
      )
        return;
      this.open(run, session);
    } catch {
      if (run === this.run) this.end(run, "dropped");
    }
  }

  private commitInterim() {
    const { final, interim } = this.view;
    if (!interim) return;
    this.set({ final: final + interim, interim: "" });
  }

  /** Stops the dictation and resolves with the confirmed text once Soniox
   * has finished, or after a short wait. */
  async stop(): Promise<string> {
    await this.finish(this.run, "stopped");
    return this.view.final;
  }

  private finish(run: number, why: "stopped" | "ceiling"): Promise<void> {
    // Every stop during the wait for Soniox's last words waits for the same
    // end, so Send never takes the text before it is final.
    if (this.view.phase === "finishing" && this.finishing)
      return this.finishing;
    if (run !== this.run || !this.active) return Promise.resolve();
    if (this.view.phase === "connecting") {
      this.run++;
      this.release();
      this.set({ ...idle, final: this.view.final, ended: why });
      return Promise.resolve();
    }
    this.finishing = this.finishStream(run, why).finally(() => {
      this.finishing = null;
    });
    return this.finishing;
  }

  private async finishStream(run: number, why: "stopped" | "ceiling") {
    this.set({ phase: "finishing" });
    // The microphone stops at once; Soniox finalises what it has.
    this.capture?.close();
    this.capture = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    const ws = this.ws;
    if (ws && this.wsReady) {
      await new Promise<void>((done) => {
        const timer = window.setTimeout(done, finishWaitMs);
        this.finished = () => {
          window.clearTimeout(timer);
          done();
        };
        // An empty text frame ends the stream (Soniox's protocol).
        ws.send("");
      });
    }
    if (run !== this.run) return;
    this.end(run, why);
  }

  private end(run: number, why: DictationEnd, failure?: SpeechFailure) {
    if (run !== this.run) return;
    this.commitInterim();
    this.run++;
    this.release();
    this.set({
      ...idle,
      final: this.view.final,
      elapsedMs: this.view.elapsedMs,
      ended: why,
      failure,
    });
  }

  /** Ends everything at once, as the composer leaves. */
  dispose() {
    this.run++;
    this.release();
  }

  private release() {
    this.finished = null;
    this.abort?.abort();
    this.abort = null;
    if (this.tick !== null) this.deps.clearInterval(this.tick);
    this.tick = null;
    this.capture?.close();
    this.capture = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
    const ws = this.ws;
    this.ws = null;
    this.wsReady = false;
    if (ws && ws.readyState <= 1) ws.close();
    this.pending = [];
    this.pendingBytes = 0;
  }
}

const workletSource = `
class OhPcm extends AudioWorkletProcessor {
  constructor() { super(); this.parts = []; this.length = 0; }
  process(inputs) {
    const channel = inputs[0] && inputs[0][0];
    if (channel) {
      this.parts.push(new Float32Array(channel));
      this.length += channel.length;
      if (this.length >= sampleRate / 10) {
        const out = new Float32Array(this.length);
        let at = 0;
        for (const p of this.parts) { out.set(p, at); at += p.length; }
        this.port.postMessage(out, [out.buffer]);
        this.parts = []; this.length = 0;
      }
    }
    return true;
  }
}
registerProcessor("oh-pcm", OhPcm);
`;

function toPcm(samples: Float32Array): [Int16Array, number] {
  const pcm = new Int16Array(samples.length);
  let sum = 0;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i] ?? 0));
    sum += s * s;
    pcm[i] = s < 0 ? s * 0x8000 : s * 0x7fff;
  }
  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  return [pcm, Math.min(1, rms * 4)];
}

/** The browser's microphone as 16-bit mono PCM in 100 ms frames. */
export async function captureAudio(
  stream: MediaStream,
  onFrame: (pcm: Int16Array, level: number) => void,
): Promise<AudioCapture> {
  const context = new AudioContext();
  try {
    await context.resume();
    const source = context.createMediaStreamSource(stream);
    const mute = context.createGain();
    mute.gain.value = 0;
    mute.connect(context.destination);
    let node: AudioNode;
    if (context.audioWorklet) {
      const url = URL.createObjectURL(
        new Blob([workletSource], { type: "text/javascript" }),
      );
      try {
        await context.audioWorklet.addModule(url);
      } finally {
        URL.revokeObjectURL(url);
      }
      const worklet = new AudioWorkletNode(context, "oh-pcm", {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        channelCount: 1,
        channelCountMode: "explicit",
      });
      worklet.port.onmessage = (event: MessageEvent<Float32Array>) =>
        onFrame(...toPcm(event.data));
      node = worklet;
    } else {
      const processor = context.createScriptProcessor(4096, 1, 1);
      processor.onaudioprocess = (event) =>
        onFrame(...toPcm(event.inputBuffer.getChannelData(0)));
      node = processor;
    }
    source.connect(node);
    node.connect(mute);
    return {
      sampleRate: context.sampleRate,
      close: () => {
        source.disconnect();
        node.disconnect();
        void context.close();
      },
    };
  } catch (error) {
    void context.close();
    throw error;
  }
}

export function browserDictationDeps(
  mint: (signal: AbortSignal) => Promise<SpeechSession>,
): DictationDeps {
  return {
    mint,
    microphone: () => {
      if (!navigator.mediaDevices?.getUserMedia)
        return Promise.reject(new Error("unsupported"));
      return navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });
    },
    capture: captureAudio,
    socket: (url, protocols) => new WebSocket(url, protocols),
    now: () => Date.now(),
    setInterval: (run, ms) => window.setInterval(run, ms),
    clearInterval: (id) => window.clearInterval(id),
  };
}
