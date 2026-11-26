# Dictation starts as fast as the microphone opens

Round 1 (commit 7650cd0d2) made listening show only once audio is captured,
buffered audio until the Soniox stream opens, and readied the audio graph
(AudioContext and PCM worklet) on focus or hover. Round 2 measured the start
from the press and removed what was still in front of the microphone or
missing on the first press.

## Measured

Browser spec run (throwaway spec, not committed) through the synthetic host:
headless Chromium with its own fake microphone
(`--use-fake-device-for-media-stream`), the real `getUserMedia`, the fake
Soniox socket. Milliseconds from the press, three runs each, final code:

| case | asked mic | getUserMedia | listening | stream open | first audio sent | first reply* |
|---|---|---|---|---|---|---|
| warmed at mount, first press (shortcut, no hover) | 0–0.1 | 23–30 | +0.3 | 41–47 | 125 | 42–47 |
| repeat press, same composer | 0–0.1 | 10–22 | +0.1–0.4 | 24–37 | 102–127 | 25–43 |
| field focused first | 0–0.1 | 27–37 | +0.2 | 41–54 | 122–142 | 42–58 |
| page reloaded, first gesture is the press | 0–0.1 | 32–42 | +0.1–0.3 | 48–61 | 142 | 49–65 |

\* The fake Soniox acknowledges at once, so "first reply" measures the
browser's path, not the real service.

What the numbers say:

- **Capture starts within 0.1–0.4 ms of `getUserMedia` resolving in every
  case**, including the first press after a reload. That is the target.
- The microphone is asked for 0–0.1 ms after the press. Before round 2, a
  press that did not come after hover or focus (the keyboard shortcut, or a
  tap on a phone) first built an AudioContext synchronously, and only then
  asked for the microphone. `new AudioContext()` alone blocks for ~10 ms in
  headless Chromium (bare page: construct 9.7–10.1 ms, resume of a suspended
  context 1.0–1.3 ms, worklet `addModule` 2.2–3.3 ms, `getUserMedia` 1.1–2.4
  ms). That construction also ran before round 1's press mark, so it did not
  show in the measures. Real hardware opens the output device there and
  takes longer.
- In the app `getUserMedia` takes 10–40 ms against 1–2 ms on a bare page.
  The difference is the main thread being busy after the press, mostly with
  React rendering the bar (the first free moment is 7–28 ms after the press).
  It runs in parallel with the device opening. On a real device the device
  takes longer than the render, so the render is hidden. Here it isn't,
  because the fake device answers at once.
- The first audio goes out about 100 ms after listening starts, because the
  worklet sends 100 ms frames. Nothing is lost (frames before the stream
  opens are buffered). This affects how soon text appears, not whether the
  first word is heard.

A headless fake device cannot show the real slow step, which is the device
opening (macOS, and switching a Bluetooth headset to its call profile).

## Change

- The engine asks for the microphone as the very first thing the press does.
  The audio graph, the key mint and the view change follow while it opens.
  The hook no longer touches audio before starting the engine.
- At the press the graph is readied with `AudioInput.ready()`: a running
  context, never the suspend-then-resume a warm-up does.
- One `AudioInput` per page (`holdPageAudio`) shared by the composers, so the
  conversation opened next finds the context and the worklet loaded. Round 1
  closed it whenever a composer left. While no composer holds it, it is
  suspended, so it does not keep the audio device busy.
- Warm-up at the composer's mount when the page has already been used
  (`navigator.userActivation.hasBeenActive`), otherwise after the first
  press or key anywhere on the page is let go, which leaves the page
  activated (no autoplay warning). It replaces the focus and hover warm-up,
  which missed taps and the shortcut. The warm-up never touches the
  microphone.
- New measure `dictation: first audio sent`. All measures are now taken from
  the press itself.

## Seeing the timings on a real device

In the tab's DevTools console:

```js
sessionStorage.setItem("oh:debug-dictation", "true")
```

Each dictation then logs one line once its first reply arrives, or when it
ends without one, such as
`[dictation] ms from press {"microphone":…,"listening":…,"key":…,"stream":…,"first audio sent":…,"first reply":…}`.
The same steps are `dictation: …` entries in the Performance panel. Nothing
is visible by default.

## The floor

What remains between the press and capture is `getUserMedia` opening the
device. The rest of the press now either runs before it starts (nothing
does) or alongside it. On a real device that is typically tens to a few
hundred ms, and longer with Bluetooth headsets, which also switch profile.
The browser decides this; the page can only avoid doing it.

## Decisions only Jari can make (not implemented)

1. **Keep the microphone open for a short time after a dictation ends**
   (e.g. 10–30 s). A repeat dictation would start instantly with no
   `getUserMedia` at all. The cost: the browser's and the OS's recording
   indicator (macOS orange dot, tab icon) stays on for that time after
   Valmis, so the person sees "recording" when they are not dictating, and
   Bluetooth headsets stay in the low-quality call profile, which also
   degrades music. The audio would be discarded in the page, but the person
   cannot verify that.
2. **Open the microphone while the composer is focused.** Every first press
   would be instant. The cost: the recording indicator is on whenever the
   person types, whether or not they dictate. That reads as listening
   without asking, the headset profile switch happens on every focus, and on
   phones it competes with other apps' audio. This contradicts the
   principle that the microphone opens only on the person's request.
3. Smaller frames (e.g. 20–40 ms) for the first moments would show the first
   interim text up to ~80 ms sooner. They lose nothing either way and are a
   tuning, not a decision; left as is.

My recommendation: neither 1 nor 2 by default. If repeat dictations feel
slow in practice, option 1 with a short window (≈10 s) is the cheaper
trade-off.

## Kept from round 1

- No key is minted ahead of the press. A temporary key is single-use, lives
  a minute and counts against the mint limit. Buffered audio already hides
  the mint's latency (key arrives at 7–39 ms here, after capture has
  started).

## Verification

Under `umask 077`:

- `./scripts/test-focused.sh --area web`: 266 files / 2,262 tests passed.
  New or changed unit tests: the press asks for the microphone before the
  audio graph, the key or the view change; a press readies a running context
  without a warm-up's suspend; the warm-up waits for page activation (at
  once, or after the first press anywhere); one page AudioInput shared by
  composers, which rests (suspended, not closed) when none holds it and
  serves the next composer with no new context or worklet load;
  `StartTiming` times each step once and logs only when the tab asks.
- Browser: `speech-input.spec.ts` 14/14, `dictation-bar.spec.ts` 5/5, and
  both with `--repeat-each 3`: 57/57.
- UI references regenerated; `scripts/test-ui-reference.py` passes.

## Live check

On a real Mac (built-in microphone, then Bluetooth headphones): open a
conversation, press Sanele or the shortcut and talk at once. "kuuntelee"
should appear as soon as the microphone opens, and the first word should be
in the text. With the debug switch above, the `microphone` and `listening`
numbers should be within a few ms of each other. The `microphone` number is
the floor.
