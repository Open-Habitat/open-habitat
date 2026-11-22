//go:build linux

package cli

import (
	"context"
	"encoding/json"

	"github.com/open-habitat/open-habitat/internal/host"
)

func doctorWithServerBrowser(component any, checks []any) (any, error) {
	return doctorBrowserResult(component, checks, host.ServerBrowserCheck(context.Background()))
}

func doctorBrowserResult(component any, checks []any, check host.Check) (any, error) {
	ok, failed, status := len(checks), 0, "ok"
	if check.Status != "pass" {
		failed, status = 1, "fail"
	} else {
		ok++
	}
	checks = append(checks, map[string]any{"id": check.Code, "status": status, "message": check.Reason, "fix_suggestion": "administrator: run host check, then obtain a fresh host apply plan and apply to repair required Google Chrome"})
	result := envelope(map[string]any{"component": component, "checks": checks, "summary": map[string]int{"ok": ok, "warn": 0, "fail": failed}})
	if failed != 0 {
		b, _ := json.Marshal(result)
		return nil, &cliError{code: "server_browser_required", message: "required Google Chrome is missing, below minimum or cannot be verified; ask the administrator to run host apply", exit: 1, result: b}
	}
	return result, nil
}
