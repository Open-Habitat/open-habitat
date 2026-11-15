import React, {
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import { createPortal, flushSync } from "react-dom";
import { createRoot } from "react-dom/client";
import pickerSource from "../../lib/picker.js?raw";
import "../../lib/picker.css";
import "../../../../design-system/styles.css";
import "../../../../web/src/app.css";
import type { DictationDeps } from "../../../../web/src/app/dictation";
import type { SpeechSession } from "../../../../web/src/app/speech";
import { Composer } from "../../../../web/src/components/composer/Composer";
import { Icon } from "../../../../web/src/components/Icon";
import { setPersonalLanguage } from "../../../../web/src/i18n";
import "../../../../web/src/components/components.css";
import { type Lang, type SceneId, SPOKEN, TEXT } from "./text";
import "./round.css";

// proto-dictation-limit, round 1. Jari 15.11.2026: decide the right length,
// warn as the limit approaches, and when it is reached nothing said may be
// lost: it is offered as text in the composer. One view, the composer while
// dictating, built from production: Composer with its real Dictation engine
// (web/src/app/dictation.ts), whose microphone, Soniox socket and clock are
// scripted stand-ins here. Nyt is production unchanged, including its
// one-minute note and ceiling notice. The directions keep the engine, field,
// bar and Valmis, hide production's time, note and notice, and draw their
// own in the same places: the time in the bar (a portal), the note above the
// field (Composer's beforeField) and the notice below it.

const directions = ["Nyt", "1 Kuuluva", "2 Ketju", "3 Tauko"];
const params = new URLSearchParams(location.search);

/** The production engine's own stop, 2 s before the key's 600 s ceiling. */
const ENGINE_STOP = 598_000;
/** Where each direction's limit is, and when the dictation really stops
 * (3: at the first pause after the hour). Nyt shows production's numbers. */
const CAP = [ENGINE_STOP, 600_000, 3_600_000, 3_600_000];
const END_AT = [ENGINE_STOP, 600_000, 3_600_000, 3_604_000];
const SCENES: SceneId[] = ["early", "minute", "seconds", "limit", "drop"];

/** The scene's moment on the direction's own clock. */
function sceneAt(d: number, id: SceneId) {
	switch (id) {
		case "early":
			return 134_000;
		case "minute":
			return CAP[d] - 58_000;
		case "seconds":
			return CAP[d] - 10_000;
		case "limit":
			return END_AT[d];
		case "drop":
			return 271_000;
	}
}

function mmss(ms: number) {
	const s = Math.max(0, Math.floor(ms / 1000));
	return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

// ---------- The tone: a short sine chime through Web Audio ----------

type Cue = "minute" | "seconds" | "end";
let cueContext: AudioContext | null = null;
const cueLog: Cue[] = [];
(window as unknown as { __dlCues: Cue[] }).__dlCues = cueLog;
/** One soft tone a minute before, two at ten seconds, a falling pair at the
 * end. Quiet and short, so it is a signal and not an alarm, and below the
 * level and length Soniox would take for speech. */
function cue(kind: Cue) {
	cueLog.push(kind);
	try {
		cueContext ??= new AudioContext();
		const ac = cueContext;
		const notes =
			kind === "minute" ? [660] : kind === "seconds" ? [660, 660] : [784, 523];
		notes.forEach((f, i) => {
			const o = ac.createOscillator();
			const g = ac.createGain();
			o.type = "sine";
			o.frequency.value = f;
			const t = ac.currentTime + i * 0.24;
			g.gain.setValueAtTime(0, t);
			g.gain.linearRampToValueAtTime(0.16, t + 0.02);
			g.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
			o.connect(g).connect(ac.destination);
			o.start(t);
			o.stop(t + 0.22);
		});
	} catch {
		// No audio output: the visual note and the announcement still carry it.
	}
}

// ---------- Scripted microphone, Soniox and clock ----------

/** One scene's run: its clock, frozen at the scene's moment until Toista
 * plays it, and its socket. */
type Run = {
	base: number;
	offset: number;
	playingFrom: number | null;
	/** The engine's clock reads the direction's clock minus this. */
	shift: number;
	mints: number;
	ws: FakeSocket | null;
	/** Further words while playing. */
	more: number;
};

const now = (r: Run) =>
	r.base + r.offset + (r.playingFrom === null ? 0 : Date.now() - r.playingFrom);
/** The direction's clock: how long the dictation has gone on. */
const virtual = (r: Run) => now(r) - r.base + r.shift;

class FakeSocket {
	binaryType = "";
	readyState = 0;
	onopen: ((e: Event) => void) | null = null;
	onmessage: ((e: { data: string }) => void) | null = null;
	onclose: ((e: Event) => void) | null = null;
	onerror: ((e: Event) => void) | null = null;
	/** Soniox's current guess, which the end of the stream confirms. */
	private guess = "";
	constructor(
		private run: Run,
		private lang: Lang,
		private scene: SceneId,
	) {
		run.ws = this;
		window.setTimeout(() => {
			this.readyState = 1;
			this.onopen?.(new Event("open"));
		}, 20);
	}
	send(data: unknown) {
		if (typeof data !== "string") return;
		const spoken = SPOKEN[this.lang];
		if (data === "") {
			// Soniox finalises what it heard, its guess included, and ends the
			// stream.
			window.setTimeout(
				() =>
					this.reply({
						tokens: [
							{ text: this.guess, is_final: true },
							{ text: spoken.last, is_final: true },
						].filter((t) => t.text),
						finished: true,
					}),
				150,
			);
			return;
		}
		if (!data.includes('"model"')) return;
		window.setTimeout(() => {
			// A resumed dictation starts with nothing said yet.
			if (this.run.mints > 1 && this.scene !== "drop") return;
			this.reply({
				tokens: [
					{ text: spoken.said, is_final: true },
					{ text: spoken.guess, is_final: false },
				],
			});
			if (this.scene === "drop")
				window.setTimeout(() => {
					this.readyState = 3;
					this.onclose?.(new Event("close"));
				}, 120);
		}, 30);
	}
	/** The next words while the scene plays. */
	word() {
		const spoken = SPOKEN[this.lang];
		const i = this.run.more++;
		if (i >= spoken.more.length) return;
		this.reply({
			tokens: [
				{ text: i === 0 ? this.guess : "", is_final: true },
				{ text: spoken.more[i] ?? "", is_final: true },
				{ text: spoken.more[i + 1] ?? "", is_final: false },
			].filter((t) => t.text),
		});
	}
	reply(body: { tokens: { text: string; is_final: boolean }[] }) {
		if (this.readyState !== 1) return;
		this.guess = body.tokens
			.filter((t) => !t.is_final)
			.map((t) => t.text)
			.join("");
		this.onmessage?.({ data: JSON.stringify(body) });
	}
	close() {
		this.readyState = 3;
	}
}

const session: SpeechSession = {
	schema_version: 1,
	api_key: "snx_temp_prototype000",
	expires_at: "2026-11-15T10:01:00Z",
	websocket_url: "wss://stt-rt.example/transcribe-websocket",
	max_session_seconds: 600,
};

function depsFor(run: Run, lang: Lang, scene: SceneId): DictationDeps {
	return {
		mint: () =>
			// The dropped scene's second key never arrives: it stays reconnecting.
			++run.mints > 1 && scene === "drop" && !run.playingFrom
				? new Promise(() => {})
				: Promise.resolve(session),
		microphone: async () =>
			({ getTracks: () => [{ stop() {} }] }) as unknown as MediaStream,
		capture: async (_stream, onFrame) => {
			const id = window.setInterval(() => {
				const t = Date.now() / 1000;
				const level = 0.25 + 0.2 * Math.sin(t * 7.1) * Math.sin(t * 2.3);
				onFrame(new Int16Array(160), Math.max(0.05, level));
			}, 100);
			return { sampleRate: 16000, close: () => window.clearInterval(id) };
		},
		socket: () => new FakeSocket(run, lang, scene) as unknown as WebSocket,
		now: () => now(run),
		setInterval: (f, ms) => window.setInterval(f, ms),
		clearInterval: (id) => window.clearInterval(id),
	};
}

// ---------- One scene ----------

const noop = () => {};

type Stage = "early" | "minute" | "seconds" | "pause" | "drop" | "ended";

function SceneView({ d, id, lang }: { d: number; id: SceneId; lang: Lang }) {
	const t = TEXT[lang];
	const words = t.scenes[id];
	const run = useRef<Run>({
		base: Date.parse("2026-11-15T10:00:00Z"),
		offset: 0,
		playingFrom: null,
		shift: END_AT[d] - ENGINE_STOP,
		mints: 0,
		ws: null,
		more: 0,
	}).current;
	const [deps] = useState(() => depsFor(run, lang, id));
	const [draft, setDraft] = useState("");
	const [active, setActive] = useState(false);
	const [ended, setEnded] = useState(false);
	const [vt, setVt] = useState(0);
	const [bar, setBar] = useState<HTMLElement | null>(null);
	const [said, setSaid] = useState("");
	const [droppedAt, setDroppedAt] = useState<number | null>(null);
	const box = useRef<HTMLElement>(null);
	const wasActive = useRef(false);
	const playing = useRef(false);

	// Start dictating, then set the clock to the scene's moment.
	useEffect(() => {
		const start = window.setTimeout(() => {
			box.current
				?.querySelector<HTMLButtonElement>('[data-testid="dictation-mic"]')
				?.click();
			window.setTimeout(() => {
				run.offset = sceneAt(d, id) - run.shift;
			}, 80);
		}, 30);
		return () => window.clearTimeout(start);
	}, [d, id, run]);

	// The direction's clock, the bar to draw into and the cues while playing.
	useEffect(() => {
		let last = virtual(run);
		let words = 0;
		const timer = window.setInterval(() => {
			const v = virtual(run);
			setVt(v);
			setBar(
				box.current?.querySelector<HTMLElement>(".ah-dictation-bar") ?? null,
			);
			if (playing.current && d > 0) {
				const cap = CAP[d];
				if (last < cap - 60_000 && v >= cap - 60_000) cue("minute");
				if (last < cap - 10_000 && v >= cap - 10_000) cue("seconds");
			}
			if (playing.current && run.ws && ++words % 5 === 0) run.ws.word();
			last = v;
		}, 250);
		return () => window.clearInterval(timer);
	}, [d, run]);

	const onDictating = (on: boolean) => {
		setActive(on);
		if (on) {
			wasActive.current = true;
			setEnded(false);
		} else if (wasActive.current) {
			setEnded(true);
			if (playing.current && d > 0) cue("end");
			playing.current = false;
			run.playingFrom = null;
		}
	};

	const reconnecting = id === "drop" && active && run.mints > 1;
	useEffect(() => {
		if (reconnecting && droppedAt === null) setDroppedAt(vt - 7_000);
	}, [reconnecting, droppedAt, vt]);

	const cap = CAP[d];
	const left = cap - vt;
	const resumed = run.mints > 1 && id !== "drop";
	const stage: Stage = ended
		? "ended"
		: reconnecting
			? "drop"
			: resumed
				? "early"
				: d === 3 && left <= 0
					? "pause"
					: left <= 10_000
						? "seconds"
						: left <= 60_000
							? "minute"
							: "early";
	// One announcement per threshold; the countdown itself is not read out.
	useEffect(() => {
		if (d === 0) return;
		setSaid(
			stage === "minute"
				? t.say.minute
				: stage === "seconds"
					? d === 3
						? t.say.pause
						: t.say.seconds
					: stage === "pause"
						? t.say.pause
						: stage === "ended"
							? t.endTitle[d]
							: "",
		);
	}, [stage, d, t]);

	const play = () => {
		// From 15 s before the limit, on the direction's own clock.
		run.offset = cap - 15_000 - run.shift;
		run.playingFrom = Date.now();
		playing.current = true;
	};

	const resume = () => {
		run.offset = 0;
		run.shift = 0;
		run.base = Date.now();
		run.playingFrom = Date.now();
		box.current
			?.querySelector<HTMLButtonElement>('[data-testid="dictation-mic"]')
			?.click();
	};

	// Production's own "Jatka sanelua" (Nyt) resumes from a fresh clock too.
	const onClickCapture = (e: React.MouseEvent) => {
		const target = e.target as Element;
		if (target.closest('[data-testid="dictation-resume"]')) {
			run.offset = 0;
			run.shift = 0;
			run.base = Date.now();
			run.playingFrom = Date.now();
		}
	};

	const inBar =
		d > 0 && bar && active ? (
			<BarTime d={d} vt={vt} stage={stage} lang={lang} />
		) : null;

	const note =
		d === 0 || !active ? null : stage === "minute" ? (
			<Note
				tone="soon"
				title={t.minuteNote}
				sub={d === 3 ? t.pauseSub : t.minuteSub}
			/>
		) : stage === "seconds" ? (
			<Note tone="urgent" title={d === 3 ? t.pauseSeconds : t.secondsNote} />
		) : stage === "pause" ? (
			<Note tone="urgent" title={t.pauseNote} sub={t.pauseSub} />
		) : stage === "drop" ? (
			<Note
				tone="drop"
				title={t.dropNote}
				sub={t.dropSub(mmss(vt - (droppedAt ?? vt)))}
			/>
		) : null;

	const listen: Cue | null =
		d === 0
			? null
			: id === "minute"
				? "minute"
				: id === "seconds"
					? "seconds"
					: id === "limit"
						? "end"
						: null;

	return (
		<section
			className="dl-scene"
			data-testid={`scene-${id}`}
			data-stage={stage}
			ref={box}
			onClickCapture={onClickCapture}
		>
			<header className="dl-scene-head">
				<h2>{words.title}</h2>
				<span className="dl-scene-acts">
					{listen ? (
						<button
							type="button"
							className="dl-replay"
							data-testid={`listen-${id}`}
							onClick={() => cue(listen)}
						>
							<Icon name="bell" />
							{t.listen}
						</button>
					) : null}
					{id === "seconds" ? (
						<button
							type="button"
							className="dl-replay"
							data-testid="replay-seconds"
							onClick={play}
						>
							{t.replay}
						</button>
					) : null}
				</span>
			</header>
			<p className="dl-caption">{words.caption}</p>
			<div className="dl-composer">
				<Composer
					value={draft}
					onChange={setDraft}
					activity="idle"
					selectedWorkingMode="steer"
					onModeChange={noop}
					onSendNow={noop}
					onSteer={noop}
					onFollowUp={noop}
					csrf="prototype"
					speech={{ onOpenSettings: noop, deps }}
					onDictating={onDictating}
					beforeField={note}
				/>
				{d > 0 && stage === "ended" ? (
					<EndNotice d={d} lang={lang} onResume={resume} />
				) : null}
			</div>
			{/* Mounted from the start, so a screen reader hears each threshold
          once; the ticking time is not in it. */}
			<p
				className="ah-visually-hidden"
				role="status"
				data-testid={`announce-${id}`}
			>
				{said}
			</p>
			{inBar && bar ? createPortal(inBar, bar) : null}
		</section>
	);
}

/** The time in the bar, in the direction's own way. */
function BarTime({
	d,
	vt,
	stage,
	lang,
}: {
	d: number;
	vt: number;
	stage: Stage;
	lang: Lang;
}) {
	const t = TEXT[lang];
	const left = CAP[d] - vt;
	const last = left <= 60_000 && stage !== "drop";
	let time: string;
	let state: string;
	if (stage === "drop") {
		time = mmss(vt);
		state = t.dropState;
	} else if (d === 3) {
		time = mmss(vt);
		state = stage === "pause" ? t.pauseState : t.listening;
	} else if (last) {
		time = t.left(mmss(left));
		state = "";
	} else {
		time = d === 1 ? `${mmss(vt)} ${t.of(mmss(CAP[d]))}` : mmss(vt);
		state = t.listening;
	}
	const tone =
		stage === "seconds" || stage === "pause"
			? "urgent"
			: stage === "minute"
				? "soon"
				: "calm";
	return (
		<span className="dl-bar" data-tone={tone} data-testid="dl-bar-time">
			<span className="dl-time">{time}</span>
			{state ? <span className="dl-state">{state}</span> : null}
			{d === 3 && last ? (
				<span className="dl-drain" aria-hidden="true">
					<i
						style={{
							width: `${Math.max(0, Math.min(1, left / 60_000)) * 100}%`,
						}}
					/>
				</span>
			) : null}
		</span>
	);
}

function Note({
	tone,
	title,
	sub,
}: {
	tone: "soon" | "urgent" | "drop";
	title: string;
	sub?: string;
}) {
	return (
		<div
			className={`ah-dictation-note dl-note${tone === "soon" ? "" : " urgent"}`}
			data-tone={tone}
			data-testid="dl-note"
		>
			<Icon name={tone === "drop" ? "warning" : "bell"} />
			<span>
				<strong>{title}</strong>
				{sub ? <span className="ah-dictation-sub"> {sub}</span> : null}
			</span>
		</div>
	);
}

/** Below the field, the dictation's end: what happened, that the text is
 * in the field, and the one action to go on. */
function EndNotice({
	d,
	lang,
	onResume,
}: {
	d: number;
	lang: Lang;
	onResume: () => void;
}) {
	const t = TEXT[lang];
	const [open, setOpen] = useState(true);
	if (!open) return null;
	return (
		<div className="ah-dictation-notice dl-notice" data-testid="dl-notice">
			<Icon name="check" />
			<div className="ah-dictation-notice-body">
				<strong>{t.endTitle[d]}</strong>
				<p>{t.endText}</p>
				<button
					type="button"
					className="ah-dictation-act primary dl-act"
					data-testid="dl-resume"
					onClick={onResume}
				>
					<Icon name="mic" />
					{t.resume}
				</button>
			</div>
			<button
				type="button"
				className="ah-dictation-x dl-x"
				aria-label={t.dismiss}
				onClick={() => setOpen(false)}
			>
				<Icon name="cross" />
			</button>
		</div>
	);
}

// ---------- The page ----------

let reviewTheme =
	(params.get("theme") as "light" | "dark" | "contrast") || "light";
let reviewLang: Lang = params.get("lang") === "en" ? "en" : "fi";

function App({ direction }: { direction: number }) {
	const [theme, setTheme] = useState(reviewTheme);
	const [lang, setLang] = useState<Lang>(reviewLang);
	const bar = useRef<HTMLElement>(null);
	const t = TEXT[lang];
	useLayoutEffect(() => {
		const el = bar.current;
		if (!el) return;
		const set = () =>
			document.documentElement.style.setProperty(
				"--review-h",
				`${el.getBoundingClientRect().height}px`,
			);
		set();
		const o = new ResizeObserver(set);
		o.observe(el);
		return () => o.disconnect();
	}, []);
	useLayoutEffect(() => {
		document.documentElement.dataset.theme = theme;
	}, [theme]);
	useLayoutEffect(() => {
		setPersonalLanguage(lang);
		document.documentElement.lang = lang;
	}, [lang]);
	return (
		<div className="dl-review" data-direction={direction}>
			<header className="dl-head" ref={bar}>
				<div className="dl-controls">
					<strong>{t.title}</strong>
					<label>
						{t.theme}{" "}
						<select
							id="theme"
							value={theme}
							onChange={(e) => {
								reviewTheme = e.target.value as typeof reviewTheme;
								setTheme(reviewTheme);
							}}
						>
							{(["light", "dark", "contrast"] as const).map((k) => (
								<option key={k} value={k}>
									{t.themes[k]}
								</option>
							))}
						</select>
					</label>
					<label>
						{t.language}{" "}
						<select
							id="lang"
							value={lang}
							onChange={(e) => {
								reviewLang = e.target.value as Lang;
								setPersonalLanguage(reviewLang);
								setLang(reviewLang);
							}}
						>
							<option value="fi">Suomi</option>
							<option value="en">English</option>
						</select>
					</label>
				</div>
				<ol className="dl-lines" data-testid="direction-lines">
					{t.lines.map((l, i) => (
						<li key={l} aria-current={i === direction ? "true" : undefined}>
							{l}
						</li>
					))}
				</ol>
				<p className="dl-recommend" data-testid="recommendation">
					{t.recommend}
				</p>
			</header>
			<main className="dl-stage">
				{SCENES.map((s) => (
					<SceneView
						key={`${direction}-${lang}-${s}`}
						d={direction}
						id={s}
						lang={lang}
					/>
				))}
			</main>
		</div>
	);
}

// ---------- Host stand-in: the field asks for nothing it needs here ----------

const realFetch = window.fetch.bind(window);
window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
	const url =
		typeof input === "string"
			? input
			: input instanceof URL
				? input.href
				: input.url;
	const path = new URL(url, "http://prototype.test/").pathname;
	if (!path.startsWith("/api/")) return realFetch(input, init);
	return new Response("", { status: 404 });
};

setPersonalLanguage(reviewLang);
const root = createRoot(document.getElementById("root")!);
// Keep the shared reference wiring intact: its stage writes become React commits.
const stageSink = {
	set innerHTML(view: ReactNode) {
		flushSync(() => root.render(view === "" ? null : view));
	},
};
const variants = directions.map((_, direction) => () => (
	<App key={direction} direction={direction} />
));
const picker = document.createElement("nav");
picker.className = "proto-picker";
picker.setAttribute("aria-label", "Prototype variants");
picker.innerHTML =
	'<span class="proto-picker-highlight" aria-hidden="true"></span>';
directions.forEach((n, i) => {
	const button = document.createElement("button");
	button.className = "proto-picker-item";
	button.textContent = n.replaceAll(" ", "\u00a0");
	if (i === 0) {
		button.setAttribute("data-active", "");
		button.setAttribute("aria-current", "true");
	}
	picker.append(button);
});
document.body.append(picker);
new Function("stage", "variants", pickerSource)(stageSink, variants);

export type { React };
