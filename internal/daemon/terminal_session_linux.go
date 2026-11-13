//go:build linux

package daemon

import (
	"bytes"
	"context"
	"os"
	"path/filepath"
)

// How a browser shell's tmux session talks to the web terminal beyond the
// screen itself. tmux has one channel to its outer terminal that a session can
// shape without passthrough: the title (set-titles). The web terminal reads
// this title, never shows it, and learns two things from it: whether the pane
// is in a mode (copy mode after scrolling back), and the last address a
// program asked the browser to open. web/src/components/terminalTitle.ts is
// the reader; the two must change together.
const terminalTitleFormat = "oh;#{pane_in_mode};#{@open-habitat-url}"

// The key the web terminal sends before typed input while the person has
// scrolled back with the wheel: it leaves tmux's copy mode, so typing returns
// to the prompt as in any terminal. A user key is used, not q or Escape,
// because a person's own tmux configuration may rebind those; outside a mode
// the binding does nothing, so a late key never reaches the shell.
// web/src/components/terminalMouse.ts sends the same bytes.
const (
	terminalLeaveHistoryKey = "\x1b[29999~"
	terminalLeaveHistoryIdx = "977"
)

// terminalBrowserHelper is $BROWSER in a browser shell. A program that opens
// an address (gh's browser step, xdg-open, Python's webbrowser) runs it with
// the address; it sets the pane's @open-habitat-url, which the title carries
// to the web terminal, and the web terminal offers the address for the
// person to open. Nothing opens without that click, and only http(s)
// addresses of printable ASCII are passed on. The address is also printed,
// so it can be opened by hand where no web terminal is attached.
const terminalBrowserHelper = `#!/bin/sh
# Written by Open Habitat for its browser terminal. Programs run this as
# $BROWSER; it asks the web terminal to offer the address to the person.
export LC_ALL=C
url=$1
case $url in
http://* | https://*) ;;
*)
	echo "open-habitat: only http and https addresses can be offered" >&2
	exit 1
	;;
esac
case $url in
*[!!-~]*)
	echo "open-habitat: the address has spaces or other characters that cannot be offered" >&2
	exit 1
	;;
esac
if [ ${#url} -gt 4096 ]; then
	echo "open-habitat: the address is too long to offer" >&2
	exit 1
fi
printf 'Open in your browser: %s\n' "$url" >&2
if [ -z "$TMUX" ] || [ -z "$TMUX_PANE" ]; then
	exit 1
fi
exec tmux set-option -p -t "$TMUX_PANE" @open-habitat-url "$(date +%s%N) $url"
`

// browserHelper writes the helper beside the tmux socket, in a directory only
// this person can reach, and returns its path; "" when it cannot be written,
// in which case shells simply have no $BROWSER from us.
func (h *terminalHost) browserHelper(socket string) string {
	path := filepath.Join(filepath.Dir(socket), "open-url")
	if old, err := os.ReadFile(path); err == nil && bytes.Equal(old, []byte(terminalBrowserHelper)) {
		return path
	}
	tmp, err := os.CreateTemp(filepath.Dir(socket), ".open-url-*")
	if err != nil {
		return ""
	}
	_, werr := tmp.WriteString(terminalBrowserHelper)
	cerr := tmp.Close()
	if werr != nil || cerr != nil || os.Chmod(tmp.Name(), 0o700) != nil || os.Rename(tmp.Name(), path) != nil {
		_ = os.Remove(tmp.Name())
		return ""
	}
	return path
}

// prepareSession applies the browser shell's tmux settings to a session
// before a browser attaches to it, so a session made by an older daemon gets
// them too. Session options stay with the session; the bindings are the
// product server's own and only change the wheel and the leave key.
func (h *terminalHost) prepareSession(ctx context.Context, socket, name, helper string) {
	target := "=" + name + ":"
	args := []string{
		// The status line would cost a row and show tmux's own tabs beside
		// the panel's; mouse mode makes the wheel scroll tmux's history.
		"set-option", "-t", target, "status", "off", ";",
		"set-option", "-t", target, "mouse", "on", ";",
		"set-option", "-t", target, "set-titles", "on", ";",
		"set-option", "-t", target, "set-titles-string", terminalTitleFormat, ";",
		"set-option", "-s", "user-keys[" + terminalLeaveHistoryIdx + "]", terminalLeaveHistoryKey, ";",
		"bind-key", "-n", "User" + terminalLeaveHistoryIdx, "if-shell", "-F", "#{pane_in_mode}", "send-keys -X cancel", ";",
	}
	for _, table := range []string{"copy-mode", "copy-mode-vi"} {
		args = append(args,
			"bind-key", "-T", table, "User"+terminalLeaveHistoryIdx, "send-keys", "-X", "cancel", ";",
			// The web terminal sends one wheel report per line the wheel
			// moved, so a trackpad scrolls as far as the fingers did; tmux's
			// default of five lines a report made the view jump.
			"bind-key", "-T", table, "WheelUpPane", "select-pane ; send-keys -X -N 1 scroll-up", ";",
			"bind-key", "-T", table, "WheelDownPane", "select-pane ; send-keys -X -N 1 scroll-down", ";",
		)
	}
	if helper != "" {
		args = append(args, "set-environment", "-t", "="+name, "BROWSER", helper, ";")
	}
	args = args[:len(args)-1]
	if _, err := h.run(ctx, socket, args...); err != nil {
		h.log.Warn("terminal_prepare", "outcome", "failed")
	}
}
