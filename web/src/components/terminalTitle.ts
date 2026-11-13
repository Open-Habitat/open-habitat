// The browser shell's tmux title is a channel, not a title: the daemon sets
// set-titles-string to "oh;#{pane_in_mode};#{@open-habitat-url}"
// (internal/daemon/terminal_session_linux.go), and the web terminal reads it
// and never shows it. The address part is "<nonce> <url>", written by the
// shell's $BROWSER helper; a new nonce is a new request.

export type TerminalTitle = {
  /** tmux shows a mode in the pane: its history after scrolling back. */
  mode: boolean;
  offer?: { nonce: string; url: string };
};

export function readTitle(title: string): TerminalTitle | undefined {
  const m = /^oh;([01]);(?:([0-9]{1,24}) ([!-~]{1,4096}))?$/.exec(title);
  if (!m) return;
  return {
    mode: m[1] === "1",
    offer: m[2] && m[3] ? { nonce: m[2], url: m[3] } : undefined,
  };
}

/** The address as the browser may offer it: http or https, no user name or
 * password that could make one host look like another. */
export function offerableUrl(raw: string): URL | undefined {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return;
  if (url.username || url.password || !url.hostname) return;
  return url;
}
