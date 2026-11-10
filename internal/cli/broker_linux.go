//go:build linux

package cli

import (
	"context"
	"os/signal"
	"syscall"

	"github.com/open-habitat/open-habitat/internal/provision"
)

// No flag or environment override for the privileged production contract.
func brokerCommand(args []string) (any, error) {
	if len(args) != 1 || args[0] != "exec" {
		return nil, usage("expected broker exec (root-only, fixed /var/lib/open-habitat/broker/broker.json)")
	}
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()
	if provision.ServeBroker(ctx) != nil {
		return nil, system("broker_unavailable", "root broker startup or service refused; inspect root state and socket contract")
	}
	return nil, nil
}
