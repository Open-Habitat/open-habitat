# Result: not a bug, Brave's default setting

The prompt comes from Jari's browser. Brave turns on *Ask where to save each
file before downloading* by default (brave-core
`browser/brave_profile_prefs.cc` sets `prefs::kPromptForDownload` to `true`;
Chrome's default is off). Jari's default browser on maple is Brave
1.97.59, and its `Default` profile does not override `download.prompt_for_download`,
so Brave asks for every download on every site. Firefox and Chrome
are installed too, but `https` opens in Brave.

Nothing on the page asks for a file name. The *Lataa* link is a same-origin
`<a href=… download=name>` (no blob, no `showSaveFilePicker`, no
cross-origin redirect). The gateway answers with `Content-Type:
application/octet-stream` and `Content-Disposition: attachment;
filename="…"; filename*=UTF-8''…` (`fileRelay` in
`internal/gateway/fileoffers_linux.go`). Chromium downloads such a response
straight to the download folder when the prompt setting is off (the
`agent-file-offers.spec.ts` download step).

To download directly: Brave › Settings › Downloads › turn off *Ask where to
save each file before downloading*. No product change.
