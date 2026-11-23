//go:build linux

package daemon

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/open-habitat/open-habitat/internal/transport"
)

const (
	tabA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
	tabB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
)

type deviceClock struct{ t time.Time }

func (c *deviceClock) now() time.Time       { return c.t }
func (c *deviceClock) pass(d time.Duration) { c.t = c.t.Add(d) }
func newDeviceTest() (*activeDevices, *deviceClock) {
	clock := &deviceClock{time.Unix(1_800_000_000, 0)}
	d := newActiveDevices()
	d.now = clock.now
	return d, clock
}

func reportOf(tab string, visible bool, idle *time.Duration) activeDeviceReport {
	r := activeDeviceReport{Tab: tab, Visible: &visible}
	if idle != nil {
		ms := idle.Milliseconds()
		r.IdleMS = &ms
	}
	return r
}

func ago(d time.Duration) *time.Duration { return &d }

// The freshest input wins, the other tab stays quiet; five minutes without
// input anywhere lets every tab play again.
func TestActiveDeviceFreshestInputWins(t *testing.T) {
	d, clock := newDeviceTest()
	if !d.report(reportOf(tabA, true, nil)) || !d.report(reportOf(tabB, true, nil)) {
		t.Fatal("tabs without input must play")
	}
	d.report(reportOf(tabA, true, ago(30*time.Second)))
	clock.pass(10 * time.Second)
	if !d.report(reportOf(tabB, true, ago(0))) {
		t.Fatal("the tab with fresh input must play")
	}
	if d.report(reportOf(tabA, true, ago(40*time.Second))) {
		t.Fatal("the older input must stay quiet")
	}
	// Heartbeats keep both tabs known while nobody touches anything.
	for range 5 {
		clock.pass(time.Minute)
		d.report(reportOf(tabA, true, nil))
		d.report(reportOf(tabB, true, nil))
	}
	if !d.report(reportOf(tabA, true, nil)) {
		t.Fatal("after five idle minutes every tab plays")
	}
}

// Inputs within the tie margin: the visible tab plays over the hidden one,
// two visible ones both play.
func TestActiveDeviceTies(t *testing.T) {
	d, _ := newDeviceTest()
	d.report(reportOf(tabA, false, ago(0)))
	if !d.report(reportOf(tabB, true, ago(500*time.Millisecond))) {
		t.Fatal("visible tied tab must play")
	}
	if d.report(reportOf(tabA, false, nil)) {
		t.Fatal("hidden tied tab must step aside for a visible one")
	}
	if !d.report(reportOf(tabA, true, nil)) || !d.report(reportOf(tabB, true, nil)) {
		t.Fatal("two visible tied tabs both play")
	}
}

// A tab that says it leaves is forgotten at once; one that vanishes is
// forgotten after the forget period, and the other tab plays.
func TestActiveDeviceClosedTabsRelease(t *testing.T) {
	d, clock := newDeviceTest()
	d.report(reportOf(tabA, true, ago(0)))
	left := true
	if d.report(reportOf(tabB, true, nil)) {
		t.Fatal("B has no input while A does")
	}
	d.report(activeDeviceReport{Tab: tabA, Visible: new(bool), Left: &left})
	if !d.report(reportOf(tabB, true, nil)) {
		t.Fatal("a closed tab still held the sound")
	}
	d.report(reportOf(tabA, true, ago(0)))
	clock.pass(activeDeviceForget - time.Second)
	if d.report(reportOf(tabB, true, nil)) {
		t.Fatal("A forgotten too early")
	}
	clock.pass(2 * time.Second)
	if !d.report(reportOf(tabB, true, nil)) {
		t.Fatal("a silent tab still held the sound")
	}
}

// Memory stays bounded: the tab heard from longest ago goes first.
func TestActiveDeviceBoundsTabs(t *testing.T) {
	d, clock := newDeviceTest()
	for i := range activeDeviceTabs + 5 {
		clock.pass(time.Millisecond)
		tab := strings.Replace("00000000-0000-4000-8000-000000000000", "00", string(rune('a'+i%26))+string(rune('a'+i/26)), 1)
		d.report(reportOf(tab, true, nil))
	}
	if len(d.tabs) != activeDeviceTabs {
		t.Fatal(len(d.tabs))
	}
}

func TestActiveDeviceHTTPBoundary(t *testing.T) {
	cfg := transport.Config{Home: t.TempDir(), Provider: "github", Subject: "42"}
	trusted := true
	handler := activeDeviceHandler(cfg, func(*http.Request) bool { return trusted }, newActiveDevices())
	call := func(method, suffix, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest(method, "http://unix"+ActiveDevicePath+suffix, strings.NewReader(body))
		if body != "" {
			r.Header.Set("Content-Type", "application/json")
		}
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, r)
		return w
	}
	ok := `{"tab":"` + tabA + `","visible":true,"idle_ms":0}`
	for _, tc := range []struct{ method, suffix, body string }{
		{"GET", "", ""}, {"POST", "", ok}, {"PUT", "?x=1", ok},
		{"PUT", "", `{"tab":"` + tabA + `"}`},
		{"PUT", "", `{"tab":"../x","visible":true}`},
		{"PUT", "", `{"tab":"` + tabA + `","visible":true,"idle_ms":-1}`},
		{"PUT", "", `{"tab":"` + tabA + `","visible":true,"idle_ms":86400001}`},
		{"PUT", "", `{"tab":"` + tabA + `","visible":true,"left":false}`},
		{"PUT", "", `{"tab":"` + tabA + `","visible":true,"other":1}`},
		{"PUT", "", ok + ` {}`},
		{"PUT", "", `{"tab":"` + tabA + `","visible":true,"idle_ms":0,"pad":"` + strings.Repeat("x", 60) + `"}`},
	} {
		if w := call(tc.method, tc.suffix, tc.body); w.Code != 400 {
			t.Fatalf("%+v: %d", tc, w.Code)
		}
	}
	w := call("PUT", "", ok)
	var v map[string]any
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &v) != nil || v["play"] != true || v["schema_version"] != float64(1) || len(v) != 2 {
		t.Fatal(w.Code, w.Body.String())
	}
	if w := call("PUT", "", `{"tab":"`+tabB+`","visible":true}`); !strings.Contains(w.Body.String(), `"play":false`) {
		t.Fatal(w.Body.String())
	}
	trusted = false
	if w := call("PUT", "", ok); w.Code != 403 {
		t.Fatalf("untrusted peer: %d", w.Code)
	}
}
