//go:build linux

package host

import (
	"context"
	"errors"
	"testing"
	"time"
)

func TestApplyNativeTransactionBudgetRetainsParentDeadline(t *testing.T) {
	for _, parentFirst := range []bool{true, false} {
		parent, command := time.Hour, 10*time.Millisecond
		if parentFirst {
			parent, command = command, parent
		}
		ctx, cancel := context.WithTimeout(context.Background(), parent)
		start := time.Now()
		_, err := nativeCommandTimeout(ctx, command, "/usr/bin/sleep", "30")
		cancel()
		if !errors.Is(err, context.DeadlineExceeded) || time.Since(start) > 5*time.Second {
			t.Fatalf("deadline not preserved: %v", err)
		}
	}
}
