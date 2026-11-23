# Result

## Every path that makes a sound

| Path | Starts without a press? | Night quiet |
| --- | --- | --- |
| Attention sound (`useAttentionSound`, App) | yes, in an open Habitat tab when a conversation becomes the person's turn | applies (`silence`, `deviceNight`) |
| Previews: Settings › Äänet tiles and Testi, the workspace strip | no | skipped on purpose, and the page says so ("Kuuntelu ohittaa yöhiljaisuuden") |
| Dictation cues (`Dictation.tsx`) | no, only while the person dictates | not applicable |
| Web Push, service worker, `Notification` | none exist | nothing to silence |
| Key/navigation sounds | not built (`key-sounds` is untriaged) | — |

So the only sound Habitat starts by itself is the attention sound, and only in an
open tab. A system notification sound (a ding from the OS or the browser) does not
come from Habitat.

`deviceNight` itself is right: the window crossing midnight, a start at or before the
current hour (20 at 20.45), DST days, and the browser's local clock (not the server's)
are covered by unit tests. Rows that arrive before the preferences are read are the
baseline and never play.

## The cause

A tab re-read the person's preferences on focus and every 5 s **only while visible**.
A tab in the background, which is exactly where the attention sound plays, kept the
choices it read when it was last visible. A night moved earlier, night quiet turned on,
or the sound turned off on another device (or in another tab) did not count there until
it was looked at again.

Fix: before a due sound plays, the tab reads the person's choices again
(`currentSoundPreferences`, sharing any read already in flight) and decides from those;
a failed read falls back to the last confirmed choices. The device's own mute is local
and needs no read. Reproduced first: the browser case "a background tab follows a night
changed on another device: start 20" played at 20.45 before the fix.

The Settings description of night quiet now says that it silences Habitat's own sounds,
that Habitat sends no system notifications, and that other apps' and the browser's own
sounds are not silenced by it.

## Which path most likely produced Jari's sound

On v0.1.6 the sound was still on by default for every account, with night 22–7. At
20.45 the default window is not night, so for the sound to have been "silenced for the
night" the start must have been 18–20, and the sound most likely came from **a Habitat
tab that had been open in the background since before that change**, on another device
or another browser window: it still had 22 and played the chosen Habitat sound.

To confirm, check:

1. Which sound it was: one of Habitat's ten sounds (Kalimba by default) or a system/app
   notification sound. A system ding is not from Habitat.
2. Which device and browser played it, and whether a Habitat tab or installed app was
   open there in the background (phone, the other computer, another window).
3. Asetukset › Äänet: the night start hour actually stored, and where it was changed.
4. In the browser that played it, Asetukset › Äänet at that hour shows "Yö, hiljaa
   klo …" at the top. If it does not although the hours say it should, the browser
   reports another time zone (privacy modes such as Firefox's fingerprinting
   resistance report UTC), which shifts the night by the offset.

Other possibilities that are not bugs: night left at 22–7 (20.45 is not night), or a
preview pressed in Settings or the workspace strip.

After the change to default-off (attention-sounds-off), existing accounts start with
the sound off until the person turns it on.
