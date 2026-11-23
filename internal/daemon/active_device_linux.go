//go:build linux

package daemon

import (
	"encoding/json"
	"io"
	"net/http"
	"regexp"
	"sync"
	"time"

	"github.com/open-habitat/open-habitat/internal/transport"
)

const ActiveDevicePath = "/api/v1/account/active-device"

// The attention sound plays only in the tab the person is using
// (sounds-active-device, experimental): each open tab reports whether it is
// visible and how long ago it last had input, and the freshest input wins.
// The reports live only in this daemon's memory, which is the person's own,
// so one person's tabs never learn of another's; a restart forgets them and
// every tab plays until the next input is reported.
const (
	// activeDeviceIdle is how long input keeps a tab the active one. With no
	// input anywhere for this long, every tab plays as it did before.
	activeDeviceIdle = 5 * time.Minute
	// activeDeviceForget drops a tab not heard from for this long: a tab that
	// closed without saying so (a crash, a laptop lid) stops holding the sound
	// for others. Open tabs report at least once a minute, and hidden tabs'
	// timers may run only once a minute, so this leaves room for one miss.
	activeDeviceForget = 150 * time.Second
	// activeDeviceTie treats inputs this close together as simultaneous: the
	// idle times arrive over different networks, so a smaller difference says
	// nothing about which came first.
	activeDeviceTie = time.Second
	// activeDeviceTabs bounds the memory; the tab heard from longest ago goes.
	activeDeviceTabs = 32
)

var activeDeviceTab = regexp.MustCompile(`^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$`)

type activeDeviceEntry struct {
	visible  bool
	hasInput bool
	input    time.Time // by this daemon's clock
	seen     time.Time
}

type activeDevices struct {
	mu   sync.Mutex
	tabs map[string]*activeDeviceEntry
	now  func() time.Time
}

func newActiveDevices() *activeDevices {
	return &activeDevices{tabs: map[string]*activeDeviceEntry{}, now: time.Now}
}

type activeDeviceReport struct {
	Tab     string `json:"tab"`
	Visible *bool  `json:"visible"`
	IdleMS  *int64 `json:"idle_ms"`
	Left    *bool  `json:"left"`
}

func (r activeDeviceReport) valid() bool {
	return activeDeviceTab.MatchString(r.Tab) && r.Visible != nil &&
		(r.IdleMS == nil || (*r.IdleMS >= 0 && *r.IdleMS <= 86_400_000)) &&
		(r.Left == nil || *r.Left)
}

// report records one tab's state and answers whether the sound plays in it.
func (d *activeDevices) report(r activeDeviceReport) bool {
	d.mu.Lock()
	defer d.mu.Unlock()
	now := d.now()
	if r.Left != nil {
		delete(d.tabs, r.Tab)
		return true
	}
	e := d.tabs[r.Tab]
	if e == nil {
		if len(d.tabs) >= activeDeviceTabs {
			oldest := ""
			for id, other := range d.tabs {
				if oldest == "" || other.seen.Before(d.tabs[oldest].seen) {
					oldest = id
				}
			}
			delete(d.tabs, oldest)
		}
		e = &activeDeviceEntry{}
		d.tabs[r.Tab] = e
	}
	e.visible, e.seen = *r.Visible, now
	// A tab sends its reports one at a time, so the latest says its input
	// best; the idle time is read against this daemon's clock alone.
	if r.IdleMS != nil {
		e.input, e.hasInput = now.Add(-time.Duration(*r.IdleMS)*time.Millisecond), true
	}
	return d.playsLocked(r.Tab, now)
}

func (d *activeDevices) playsLocked(tab string, now time.Time) bool {
	var latest time.Time
	fresh := false
	for id, e := range d.tabs {
		if now.Sub(e.seen) > activeDeviceForget {
			delete(d.tabs, id)
			continue
		}
		if e.hasInput && now.Sub(e.input) < activeDeviceIdle {
			if !fresh || e.input.After(latest) {
				latest = e.input
			}
			fresh = true
		}
	}
	if !fresh {
		return true
	}
	// The tabs whose input is the freshest, within the tie margin. If any of
	// them is visible, the hidden ones step aside; several visible ones all
	// play, because a double sound is better than a missed one.
	tied := func(e *activeDeviceEntry) bool {
		return e.hasInput && latest.Sub(e.input) < activeDeviceTie
	}
	me := d.tabs[tab]
	if me == nil || !tied(me) {
		return false
	}
	if me.visible {
		return true
	}
	for _, e := range d.tabs {
		if e.visible && tied(e) {
			return false
		}
	}
	return true
}

func ActiveDeviceHandler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return activeDeviceHandler(cfg, trusted, newActiveDevices())
}

func activeDeviceHandler(cfg transport.Config, trusted func(*http.Request) bool, devices *activeDevices) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.URL.Path != ActiveDevicePath || r.URL.EscapedPath() != ActiveDevicePath || r.URL.RawQuery != "" || len(r.TransferEncoding) != 0 || r.Method != http.MethodPut ||
			r.ContentLength < 2 || r.ContentLength > 128 || r.Header.Get("Content-Type") != "application/json" || len(r.Header.Values("Content-Type")) != 1 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		var value activeDeviceReport
		dec := json.NewDecoder(io.LimitReader(r.Body, 129))
		dec.DisallowUnknownFields()
		if dec.Decode(&value) != nil || !value.valid() || dec.Decode(new(any)) != io.EOF {
			snapshotError(w, 400, "invalid_request")
			return
		}
		historyJSON(w, map[string]any{"schema_version": 1, "play": devices.report(value)})
	})
}
