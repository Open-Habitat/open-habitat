//go:build linux

package browserhost

import (
	"context"
	_ "embed"
	"os/exec"
	"strings"
	"time"
)

// Chrome refreshes on XkbNewKeyboardNotify, but not the XkbMapNotify that
// TigerVNC sends when adding a missing symbol. Load the Latin repertoire before
// Chrome connects, instead of relying on that dynamic mapping.
//
//go:embed keyboard.xkb
var browserKeymap string

func prepareKeyboard(ctx context.Context, loader, display, cookie string, env []string) error {
	if loader == "" {
		loader = "/usr/bin/xkbcomp"
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	cmd := exec.CommandContext(ctx, loader, "-w", "0", "-", ":"+display)
	cmd.Env = append(append([]string{}, env...), "XAUTHORITY="+cookie)
	cmd.Stdin = strings.NewReader(browserKeymap)
	return cmd.Run()
}
