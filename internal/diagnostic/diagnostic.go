// Package diagnostic defines the host-owned stderr JSONL convention. Callers
// supply only classified, trusted fields; this package never serializes errors.
package diagnostic

import (
	"io"
	"log/slog"
)

// New returns a synchronous logger. slog ignores writer errors; diagnostics are
// best effort and never participate in an operation's success decision.
func New(w io.Writer, component string) *slog.Logger {
	h := slog.NewJSONHandler(w, &slog.HandlerOptions{ReplaceAttr: func(_ []string, a slog.Attr) slog.Attr {
		if a.Key == slog.MessageKey {
			a.Key = "event"
		}
		return a
	}})
	return slog.New(h).With("schema_version", 1, "component", component)
}
