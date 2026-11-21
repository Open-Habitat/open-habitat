//go:build linux

package host

import (
	"fmt"
	"os"
	"strings"
	"testing"
)

func TestUpgradeSessionActive(t *testing.T) {
	for _, state := range []string{"idle", "stopped", "failed", "start_failed"} {
		t.Run(state, func(t *testing.T) {
			if upgradeSessionActive(state) {
				t.Fatalf("settled state %q counted as an active turn", state)
			}
		})
	}
	for _, state := range []string{"running", "starting", "streaming", "unknown", "", "future_state"} {
		t.Run(state, func(t *testing.T) {
			if !upgradeSessionActive(state) {
				t.Fatalf("unsettled or unfamiliar state %q must count as active", state)
			}
		})
	}
}

func TestUpgradeSettledTurnsStillRequireInterruptionConsent(t *testing.T) {
	for _, observable := range []bool{true, false} {
		if !interruptionRequired([]upgradeUser{{Daemon: true, TurnsObservable: observable, ActiveTurns: 0}}) {
			t.Fatalf("live daemon must require consent even with no reported active turns (observable=%v)", observable)
		}
	}
}

// listReply wraps rows the way the predecessor's `agent conversation list
// --json` does: the daemon's reply is the envelope's result.
func listReply(rows ...string) []byte {
	return []byte(`{"ok":true,"data":{"cli_version":"0.0.0","result":{"schema_version":1,"sessions":[` + strings.Join(rows, ",") + `]}}}`)
}

func TestUpgradeActiveTurnsReadsTheHistoryCatalog(t *testing.T) {
	row := func(id int, rest string) string {
		return fmt.Sprintf(`{"agent_id":"pi:00000000-0000-4000-8000-%012d","workspace_id":"ws_example123","title":"Synthetic"%s}`, id, rest)
	}
	for _, c := range []struct {
		name string
		rows []string
		want int
	}{
		{"resting history without state", []string{row(1, `,"lifecycle":"resting"`)}, 0},
		{"archived history without state", []string{row(1, `,"lifecycle":"archived"`)}, 0},
		// Another Pi writing it (SSH, tmux, Taskfleet) outlives the upgrade.
		{"native writer without a daemon handle", []string{row(1, `,"lifecycle":"live"`)}, 0},
		{"idle daemon child", []string{row(1, `,"lifecycle":"live","state":"idle","startup_choice":null`)}, 0},
		{"running daemon turn", []string{row(1, `,"lifecycle":"live","state":"running","startup_choice":null`)}, 1},
		{"archived running daemon turn", []string{row(1, `,"lifecycle":"archived","state":"running","startup_choice":null`)}, 1},
		{"resting handle starting", []string{row(1, `,"lifecycle":"resting","state":"starting","startup_choice":null`)}, 1},
		{"empty state is a handle in an unknown state", []string{row(1, `,"lifecycle":"resting","state":""`)}, 1},
		{"unfamiliar state", []string{row(1, `,"lifecycle":"resting","state":"future_state"`)}, 1},
		{"unfamiliar lifecycle", []string{row(1, `,"lifecycle":"future"`)}, 1},
		{"missing lifecycle and state", []string{row(1, ``)}, 1},
		{"mixed catalog", []string{
			row(1, `,"lifecycle":"resting"`), row(2, `,"lifecycle":"archived"`), row(3, `,"lifecycle":"live"`),
			row(4, `,"lifecycle":"live","state":"idle"`), row(5, `,"lifecycle":"live","state":"streaming"`),
			row(6, `,"lifecycle":"resting","state":"stopped"`), row(7, `,"lifecycle":"archived","state":"start_failed"`),
		}, 1},
	} {
		t.Run(c.name, func(t *testing.T) {
			got, observable := activeTurns(listReply(c.rows...))
			if !observable || got != c.want {
				t.Fatalf("active turns = %d (observable %v), want %d", got, observable, c.want)
			}
		})
	}
}

// Reproduces the 0.1.3 to 0.1.4 report: a catalog of 133 history rows and two
// idle daemon children read as 135 active turns and held the installer's
// quiet window until it gave up.
func TestUpgradeHistoryCatalogIsNotBusy(t *testing.T) {
	rows := []string{}
	for i := range 133 {
		lifecycle := []string{"resting", "archived", "live"}[i%3]
		rows = append(rows, fmt.Sprintf(`{"agent_id":"pi:00000000-0000-4000-8000-%012d","workspace_id":"ws_example123","title":"Synthetic","lifecycle":%q}`, i, lifecycle))
	}
	for i := range 2 {
		rows = append(rows, fmt.Sprintf(`{"agent_id":"pi:11111111-0000-4000-8000-%012d","workspace_id":"ws_example123","title":"Synthetic","lifecycle":"live","state":"idle","startup_choice":null}`, i))
	}
	if got, observable := activeTurns(listReply(rows...)); !observable || got != 0 {
		t.Fatalf("history catalog: %d active turns (observable %v)", got, observable)
	}
	// One of them taking a turn is still seen.
	rows[134] = strings.Replace(rows[134], `"idle"`, `"running"`, 1)
	if got, _ := activeTurns(listReply(rows...)); got != 1 {
		t.Fatalf("running turn among history: %d active turns", got)
	}
}

func TestUpgradeActiveTurnsUnobservableReply(t *testing.T) {
	for name, data := range map[string]string{
		"not json":              `daemon unavailable`,
		"empty":                 ``,
		"error envelope":        `{"ok":false,"error":{"code":"native_source_unavailable"}}`,
		"missing sessions":      `{"ok":true,"data":{"result":{"schema_version":1}}}`,
		"null sessions":         `{"ok":true,"data":{"result":{"schema_version":1,"sessions":null}}}`,
		"sessions not a list":   `{"ok":true,"data":{"result":{"schema_version":1,"sessions":{}}}}`,
		"unknown schema":        `{"ok":true,"data":{"result":{"schema_version":2,"sessions":[]}}}`,
		"missing schema":        `{"ok":true,"data":{"result":{"sessions":[]}}}`,
		"state of a wrong type": `{"ok":true,"data":{"result":{"schema_version":1,"sessions":[{"lifecycle":"resting","state":7}]}}}`,
	} {
		t.Run(name, func(t *testing.T) {
			if n, observable := activeTurns([]byte(data)); observable {
				t.Fatalf("unreadable reply reported observable with %d active turns", n)
			}
		})
	}
	if n, observable := activeTurns(listReply()); !observable || n != 0 {
		t.Fatalf("an empty catalog is observable and idle: %d %v", n, observable)
	}
}

// The contract's own example is the catalog shape the host must read.
func TestUpgradeActiveTurnsContractExample(t *testing.T) {
	example, err := os.ReadFile("../../contracts/v1/examples/agent-conversation-list.json")
	if err != nil {
		t.Fatal(err)
	}
	data := []byte(`{"ok":true,"data":{"cli_version":"0.0.0","result":` + string(example) + `}}`)
	if n, observable := activeTurns(data); !observable || n != 0 {
		t.Fatalf("contract example: %d active turns (observable %v)", n, observable)
	}
}
