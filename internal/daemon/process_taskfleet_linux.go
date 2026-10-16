//go:build linux

package daemon

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

type processSpinoff struct {
	State     string  `json:"state,omitempty"`
	Preserved bool    `json:"preserved"`
	RunID     string  `json:"run_id"`
	Title     string  `json:"title"`
	Status    string  `json:"status"`
	Landed    bool    `json:"landed"`
	Commit    *string `json:"commit"`
}
type processReadBuffer struct{ bytes.Buffer }

func (b *processReadBuffer) Write(p []byte) (int, error) {
	if b.Len()+len(p) > 256*1024 {
		return 0, errors.New("native reply too large")
	}
	return b.Buffer.Write(p)
}

// Read only the mapped user's native Taskfleet state, with fixed argv and
// validated IDs. No run registry, report content or native paths cross to UI.
func readProcessSpinoffs(ctx context.Context, home string, env []string, ids []string, parent nativeSession) []processSpinoff {
	runs := []processSpinoff{}
	if !filepath.IsAbs(home) || len(ids) > 20 {
		return runs
	}
	for _, id := range ids {
		if !taskfleetIDPattern.MatchString(id) {
			continue
		}
		child, cancel := context.WithTimeout(ctx, 350*time.Millisecond)
		binary := taskfleetBinary(home)
		if binary == "" {
			cancel()
			continue
		}
		cmd := exec.CommandContext(child, binary, "run", "show", id, "--output", "json")
		cmd.Env = append(append([]string{}, env...), "HOME="+home, "TASKFLEET_HOME="+filepath.Join(home, ".taskfleet"))
		cmd.Dir = home
		cmd.WaitDelay = 100 * time.Millisecond
		var output processReadBuffer
		cmd.Stdout = &output
		err := cmd.Run()
		cancel()
		if err != nil {
			continue
		}
		var reply struct {
			Schema int `json:"schema_version"`
			Data   struct {
				nativeSpinoff
				Report struct {
					Origin struct {
						OID string `json:"worker_oid"`
					} `json:"origin"`
				} `json:"report"`
			} `json:"data"`
		}
		if json.Unmarshal(output.Bytes(), &reply) != nil || reply.Schema != 1 || reply.Data.ID != id || !belongsSpinoffInCheckout(ctx, home, reply.Data.nativeSpinoff, parent) {
			continue
		}
		d := reply.Data
		switch d.Status {
		case "pending", "running", "done", "failed", "cancelled":
		default:
			continue
		}
		var commit *string
		if len(d.Report.Origin.OID) == 40 && strings.Trim(d.Report.Origin.OID, "0123456789abcdef") == "" {
			v := d.Report.Origin.OID
			commit = &v
		}
		preserved := false
		for _, p := range d.Preserved {
			preserved = preserved || p.BranchPresent || p.WorktreePresent
		}
		runs = append(runs, processSpinoff{spinoffState(d.nativeSpinoff), preserved, id, prefixBytes(d.Title, 200), d.Status, d.Landed, commit})
	}
	return runs
}
func processRunHome(p *piRPC) (string, []string) {
	if p.cmd == nil {
		return "", nil
	}
	home := ""
	for _, value := range p.cmd.Env {
		if strings.HasPrefix(value, "HOME=") {
			home = strings.TrimPrefix(value, "HOME=")
		}
	}
	return home, p.cmd.Env
}
func taskfleetPending(runs []processSpinoff) bool {
	for _, run := range runs {
		if run.Status == "pending" || run.Status == "running" {
			return true
		}
	}
	return false
}

func enrichProcessEntry(parent context.Context, home string, session nativeSession, entry *historyEntry) {
	ctx, cancel := context.WithTimeout(parent, 500*time.Millisecond)
	defer cancel()
	for i := range entry.Blocks {
		event := entry.Blocks[i].ProcessEvent
		if event != nil && len(event.RunIDs) > 0 {
			event.Spinoff = readProcessSpinoffs(ctx, home, []string{"PATH=/usr/local/bin:/usr/bin:/bin"}, event.RunIDs, session)
		}
	}
}
