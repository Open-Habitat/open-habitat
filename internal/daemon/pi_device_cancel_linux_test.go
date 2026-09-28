//go:build linux

package daemon

import (
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestPiDeviceCancelDuringStatus(t *testing.T) {
	p, home := piFixture(t)
	marker := filepath.Join(home, "status-started")
	script := filepath.Join(home, "controlled-child")
	source := `#!/bin/sh
for arg do action="$arg"; done
if [ "$action" = login ]; then
  printf '%s\n' '{"type":"device_code","verificationUri":"https://auth.openai.com/codex/device","userCode":"ABCD-1234"}' '{"type":"completed"}'
else
  touch "` + marker + `"
  exec sleep 60
fi
`
	if err := os.WriteFile(script, []byte(source), 0700); err != nil {
		t.Fatal(err)
	}
	p.Node = script
	id, events, err := p.Start()
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 100; i++ {
		if _, err := os.Stat(marker); err == nil {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}
	if _, err := os.Stat(marker); err != nil {
		t.Fatal("status never started")
	}
	if !p.Cancel(id) {
		t.Fatal("attempt no longer cancellable during status")
	}
	var last PiDeviceEvent
	for e := range events {
		last = e
	}
	if last.Type != "unknown" {
		t.Fatalf("cancelled attempt reported %+v", last)
	}
}
