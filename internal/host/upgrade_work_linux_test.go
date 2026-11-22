//go:build linux

package host

import (
	"fmt"
	"os"
	"slices"
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

// censusReply wraps a work census the way `agent work show --json` does.
func censusReply(conversations, jobs string) []byte {
	return []byte(`{"schema_version":1,"data":{"cli_version":"0.0.0","result":{"schema_version":1,"conversations":[` + conversations + `],"jobs":[` + jobs + `]}},"warnings":[]}`)
}

func censusRow(id int, activities string, processes string) string {
	return fmt.Sprintf(`{"agent_id":"pi:00000000-0000-4000-8000-%012d","workspace_id":"ws_example123","activities":[%s],"processes":[%s]}`, id, activities, processes)
}

// Every kind of daemon work holds the quiet window except long-lived
// background processes, which are counted apart and named; an activity this
// release does not know holds it too.
func TestUpgradeWorkCensusKinds(t *testing.T) {
	preview := `{"id":"proc_1","name":"preview server"}`
	for _, c := range []struct {
		name               string
		conversations      string
		jobs               string
		active, background int
	}{
		{"nothing", "", "", 0, 0},
		{"turn", censusRow(1, `"turn"`, ""), "", 1, 0},
		{"question", censusRow(1, `"question","turn"`, ""), "", 1, 0},
		{"person's command behind an idle state", censusRow(1, `"command"`, ""), "", 1, 0},
		{"Habitat's title or settle window", censusRow(1, `"habitat"`, ""), "", 1, 0},
		{"unreadable child or bridge", censusRow(1, `"unknown"`, ""), "", 1, 0},
		{"activity from a later release", censusRow(1, `"future"`, ""), "", 1, 0},
		{"conversation listed without activity", censusRow(1, "", ""), "", 1, 0},
		{"preview server alone", censusRow(1, `"processes"`, preview), "", 0, 1},
		{"processes named without records", censusRow(1, `"processes"`, ""), "", 0, 1},
		{"turn beside two processes", censusRow(1, `"turn","processes"`, preview+`,{"id":"proc_2","name":""}`), "", 1, 2},
		{"handle-less title", "", `{"kind":"history_title","agent_id":"pi:00000000-0000-4000-8000-000000000009"}`, 1, 0},
		{"clone", "", `{"kind":"clone"}`, 1, 0},
		{"job from a later release", "", `{"kind":"future"}`, 1, 0},
		{"handle without a workspace", `{"agent_id":"pi:00000000-0000-4000-8000-000000000001","activities":["turn"],"processes":[]}`, "", 1, 0},
	} {
		t.Run(c.name, func(t *testing.T) {
			u := upgradeUser{Daemon: true}
			readDaemonWork(&u, func(args ...string) ([]byte, []byte, error) {
				if strings.Join(args, " ") != "agent work show --json" {
					t.Fatalf("census present, but read %v", args)
				}
				return censusReply(c.conversations, c.jobs), nil, nil
			})
			if !u.TurnsObservable || u.WorkCensus != "daemon" || u.ActiveTurns != c.active || u.BackgroundProcesses != c.background {
				t.Fatalf("got active %d background %d observable %v census %q", u.ActiveTurns, u.BackgroundProcesses, u.TurnsObservable, u.WorkCensus)
			}
			if len(u.ActiveWork) != strings.Count(c.conversations, `"activities"`)+strings.Count(c.jobs, `"kind"`) {
				t.Fatalf("plan does not name each piece of work: %+v", u.ActiveWork)
			}
		})
	}
	u := upgradeUser{Daemon: true}
	readDaemonWork(&u, func(...string) ([]byte, []byte, error) {
		return censusReply(censusRow(1, `"processes"`, preview), ""), nil, nil
	})
	if len(u.ActiveWork) != 1 || !slices.Equal(u.ActiveWork[0].Processes, []string{"preview server"}) {
		t.Fatalf("preview server not named: %+v", u.ActiveWork)
	}
}

// The census contract's example reads as the work it shows.
func TestUpgradeWorkCensusContractExample(t *testing.T) {
	example, err := os.ReadFile("../../contracts/v1/examples/agent-work.json")
	if err != nil {
		t.Fatal(err)
	}
	census, ok := parseWorkCensus([]byte(`{"schema_version":1,"data":{"result":` + string(example) + `}}`))
	if !ok {
		t.Fatal("contract example unreadable")
	}
	// A turn, a command with Habitat's work, a clone, a title and a workspace operation hold the
	// window; the preview server is named.
	if active, background, _ := census.counts(); active != 5 || background != 1 {
		t.Fatalf("contract example: active %d background %d", active, background)
	}
}

// Only the predecessor CLI's own refusal of `agent work show` selects the
// conversation list; any other census failure or an unreadable census is
// unobservable, never the list's narrower view.
func TestUpgradeWorkCensusFallsBackOnlyForAnOlderCLI(t *testing.T) {
	refused := []byte(`{"schema_version":1,"error":{"code":"invalid_arguments","message":"invalid agent arguments"}}` + "\n")
	running := listReply(`{"agent_id":"pi:00000000-0000-4000-8000-000000000001","workspace_id":"ws_example123","title":"x","lifecycle":"live","state":"running"}`)
	for _, c := range []struct {
		name       string
		census     []byte
		stderr     []byte
		censusErr  error
		list       []byte
		listErr    error
		observable bool
		mode       string
		active     int
	}{
		{"older CLI", nil, refused, ErrNativeApply, running, nil, true, "list_only", 1},
		{"older CLI, list unreadable", nil, refused, ErrNativeApply, []byte("x"), nil, false, "unavailable", 0},
		{"older CLI, list fails", nil, refused, ErrNativeApply, nil, ErrNativeApply, false, "unavailable", 0},
		{"daemon unreachable", nil, []byte(`{"schema_version":1,"error":{"code":"agent_unavailable"}}`), ErrNativeApply, running, nil, false, "unavailable", 0},
		{"daemon refuses the request", nil, []byte(`{"schema_version":1,"error":{"code":"invalid_request"}}`), ErrNativeApply, running, nil, false, "unavailable", 0},
		{"no JSON on stderr", nil, []byte("panic: boom"), ErrNativeApply, running, nil, false, "unavailable", 0},
		{"census of another schema", []byte(`{"data":{"result":{"schema_version":2,"conversations":[],"jobs":[]}}}`), nil, nil, running, nil, false, "unavailable", 0},
		{"census without jobs", []byte(`{"data":{"result":{"schema_version":1,"conversations":[]}}}`), nil, nil, running, nil, false, "unavailable", 0},
	} {
		t.Run(c.name, func(t *testing.T) {
			u := upgradeUser{Daemon: true}
			readDaemonWork(&u, func(args ...string) ([]byte, []byte, error) {
				switch strings.Join(args, " ") {
				case "agent work show --json":
					return c.census, c.stderr, c.censusErr
				case "agent conversation list --json":
					return c.list, nil, c.listErr
				}
				t.Fatalf("unexpected command %v", args)
				return nil, nil, nil
			})
			if u.TurnsObservable != c.observable || u.WorkCensus != c.mode || u.ActiveTurns != c.active {
				t.Fatalf("got observable %v census %q active %d", u.TurnsObservable, u.WorkCensus, u.ActiveTurns)
			}
		})
	}
}

// A chatty stderr is kept bounded and never fails the command.
func TestBoundedStderrNeverFails(t *testing.T) {
	var b boundedStderr
	chunk := make([]byte, 40<<10)
	for i := 0; i < 3; i++ {
		if n, err := b.Write(chunk); err != nil || n != len(chunk) {
			t.Fatalf("write %d: %d %v", i, n, err)
		}
	}
	if len(b.data) != 64<<10 {
		t.Fatalf("kept %d bytes", len(b.data))
	}
}
