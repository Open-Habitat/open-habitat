//go:build linux

package provision

import (
	"context"
	"log/slog"
	"os"
	"time"
)

const loginctl = "/usr/bin/loginctl"

// EnableLinger has no arbitrary verb, unit or path surface. NSS is rechecked
// against the committed identity before logind is asked to keep its user manager.
// logind owns the linger flag; the broker keeps no second record of it.
func (e *LinuxHostExecutor) EnableLinger(ctx context.Context, i ExecutorIdentity) error {
	if os.Geteuid() != 0 || ctx == nil || ctx.Err() != nil || e.identity(ctx, i) != nil {
		return ErrInvalid
	}
	if _, err := e.command(ctx, loginctl, "enable-linger", i.username); err != nil {
		return ErrInvalid
	}
	return nil
}

// This is deliberately post-commit and best effort. An interrupted provisioning
// journal must never grant a persistent user manager. Repeating enable-linger is
// idempotent, including on ensure after a previous login or boot attempt failed.
func (w Writer) enableLinger(ctx context.Context, i ExecutorIdentity) {
	bounded, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	err := w.Executor.EnableLinger(bounded, i)
	if w.LingerEvent != nil {
		w.LingerEvent(i.username, err == nil)
	}
}

func lingerLogger(log *slog.Logger) func(string, bool) {
	return func(user string, ok bool) {
		if ok {
			log.Info("broker_linger", "outcome", "enabled", "user", user)
		} else {
			log.Warn("broker_linger", "outcome", "rejected", "reason", "enable_failed", "user", user)
		}
	}
}
