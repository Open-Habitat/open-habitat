//go:build linux

package daemon

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"os"
	"sync"
	"syscall"
	"time"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
	"github.com/Open-Habitat/open-habitat/internal/transport"
	"github.com/Open-Habitat/open-habitat/internal/webpush"
	"golang.org/x/sys/unix"
)

// Phone notifications when a conversation becomes the person's turn
// (experimental, push-when-your-turn). Everything belongs to the person: the
// VAPID key pair and the subscriptions (one per device) live in their own
// ~/.config/open-habitat/push.json, 0600, written only by this daemon. The
// gateway serves the service worker and relays these routes; it holds no key
// and no subscription. The browser vendor's push service delivers the
// encrypted message and sees only its timing and size.
const (
	PushPath         = "/api/v1/notifications/push"
	PushKeyPath      = PushPath + "/key"
	PushDevicesPath  = PushPath + "/devices"
	PushRemovePath   = PushPath + "/remove"
	PushTestPath     = PushPath + "/test"
	PushPresencePath = "/api/v1/notifications/presence"
)

// PushFeature is the experimental switch's id in the account preferences.
const PushFeature = "push-when-your-turn"

const (
	maxPushDevices = 10
	maxPushFile    = 32 << 10
	// pushDelay lets a reply read at once go without a buzz.
	pushDelay = 30 * time.Second
	// pushPresence is how long a report that the person is in front of a
	// Habitat tab counts. The browser reports every 20 seconds while a
	// visible tab has had input in the last two minutes.
	pushPresence = 60 * time.Second
	// A notification still says something after a night offline: the
	// conversation still waits.
	pushTTL = 12 * time.Hour
)

type pushDevice struct {
	ID        string `json:"id"`
	Endpoint  string `json:"endpoint"`
	P256dh    string `json:"p256dh"`
	Auth      string `json:"auth"`
	Label     string `json:"label"`
	Language  string `json:"language"`
	CreatedAt string `json:"created_at"`
}

type pushState struct {
	Vapid   *webpush.Keys `json:"vapid,omitempty"`
	Devices []pushDevice  `json:"devices"`
}

// pushLock serializes the read-modify-replace of push.json, and the feature
// switch's removal of it (applyPreferences), within this person's daemon.
var pushLock sync.Mutex

// pushDeviceID names a device by its endpoint without carrying it: the
// browser computes the same from its own subscription to find itself.
func pushDeviceID(endpoint string) string {
	sum := sha256.Sum256([]byte(endpoint))
	return "pd_" + base64.RawURLEncoding.EncodeToString(sum[:16])
}

func validPushLabel(s string) bool {
	if s == "" || len(s) > 64 || !utf8.ValidString(s) {
		return false
	}
	for _, r := range s {
		if r < 0x20 || r == 0x7f || (r >= 0x80 && r < 0xa0) || r == 0x2028 || r == 0x2029 {
			return false
		}
	}
	return true
}

func (d pushDevice) valid() bool {
	return d.ID == pushDeviceID(d.Endpoint) && webpush.AllowedEndpoint(d.Endpoint) && (webpush.Subscription{P256dh: d.P256dh, Auth: d.Auth}).ValidKeys() && validPushLabel(d.Label) && (d.Language == "fi" || d.Language == "en") && len(d.CreatedAt) <= 40
}

func (s pushState) valid() bool {
	if s.Vapid != nil && !s.Vapid.Valid() || len(s.Devices) > maxPushDevices || len(s.Devices) > 0 && s.Vapid == nil {
		return false
	}
	seen := map[string]bool{}
	for _, d := range s.Devices {
		if !d.valid() || seen[d.ID] {
			return false
		}
		seen[d.ID] = true
	}
	return true
}

// readPushState reads the person's push file. Absent is the empty state.
func readPushState(home string) (pushState, error) {
	empty := pushState{Devices: []pushDevice{}}
	dir, err := preferencesDir(home, false)
	if errors.Is(err, os.ErrNotExist) {
		return empty, nil
	}
	if err != nil {
		return empty, err
	}
	defer dir.Close()
	fd, err := unix.Openat(int(dir.Fd()), "push.json", unix.O_RDONLY|unix.O_NOFOLLOW|unix.O_NONBLOCK|unix.O_CLOEXEC, 0)
	if errors.Is(err, os.ErrNotExist) {
		return empty, nil
	}
	if err != nil {
		return empty, err
	}
	f := os.NewFile(uintptr(fd), "push")
	defer f.Close()
	st, err := f.Stat()
	// The file holds a private key: anything but the person's own 0600
	// regular file is refused rather than used.
	if err != nil || !st.Mode().IsRegular() || st.Size() > maxPushFile || st.Mode().Perm()&0077 != 0 || st.Sys().(*syscall.Stat_t).Uid != uint32(os.Geteuid()) {
		return empty, errors.New("unsafe push file")
	}
	var value pushState
	dec := json.NewDecoder(io.LimitReader(f, maxPushFile+1))
	dec.DisallowUnknownFields()
	if dec.Decode(&value) != nil || dec.Decode(new(any)) != io.EOF {
		return empty, errors.New("invalid push file")
	}
	if value.Devices == nil {
		value.Devices = []pushDevice{}
	}
	if !value.valid() {
		return empty, errors.New("invalid push file")
	}
	return value, nil
}

func savePushState(home string, value pushState) error {
	if !value.valid() {
		return errors.New("invalid push state")
	}
	dir, err := preferencesDir(home, true)
	if err != nil {
		return err
	}
	defer dir.Close()
	var random [16]byte
	if _, err = rand.Read(random[:]); err != nil {
		return err
	}
	name := ".push-" + hex.EncodeToString(random[:])
	fd, err := unix.Openat(int(dir.Fd()), name, unix.O_WRONLY|unix.O_CREAT|unix.O_EXCL|unix.O_NOFOLLOW|unix.O_CLOEXEC, 0600)
	if err != nil {
		return err
	}
	defer unix.Unlinkat(int(dir.Fd()), name, 0)
	f := os.NewFile(uintptr(fd), "push")
	defer f.Close()
	if err = json.NewEncoder(f).Encode(value); err != nil {
		return err
	}
	if err = f.Sync(); err != nil {
		return err
	}
	if err = f.Close(); err != nil {
		return err
	}
	if err = unix.Renameat(int(dir.Fd()), name, int(dir.Fd()), "push.json"); err != nil {
		return err
	}
	return dir.Sync()
}

// removePushState forgets the key pair and every device. Turning the
// feature off calls it, so nothing of the feature is kept while it is off.
// Caller holds pushLock.
func removePushState(home string) error {
	dir, err := preferencesDir(home, false)
	if errors.Is(err, os.ErrNotExist) {
		return nil
	}
	if err != nil {
		return err
	}
	defer dir.Close()
	if err = unix.Unlinkat(int(dir.Fd()), "push.json", 0); err != nil && !errors.Is(err, unix.ENOENT) {
		return err
	}
	return dir.Sync()
}

func pushEnabled(home string) bool {
	p, err := readPreferences(home)
	return err == nil && p.Experimental[PushFeature]
}

type pushDelivery struct {
	outcome webpush.Outcome
	at      time.Time
}

// PushNotifier is the person's sender. It lives as long as the daemon,
// across conversation controllers; its memory (presence, what was already
// sent, the last delivery per device) is not kept anywhere else.
type PushNotifier struct {
	home   string
	uid    int
	sender webpush.Sender
	log    *slog.Logger
	delay  time.Duration
	// presence is how long a report that the person is here counts.
	presence time.Duration
	now      func() time.Time

	mu sync.Mutex
	// hereAt is the latest report that the person is in front of a tab.
	hereAt time.Time
	// sentAt is when each conversation last notified. A conversation
	// notifies once until the person comes back (a presence report after
	// it), however many turns it has meanwhile.
	sentAt map[string]time.Time
	// turns is the last turn key each conversation notified for.
	turns     map[string]string
	delivered map[string]pushDelivery
}

// NewPushNotifier is the production sender: the egress-checked client and
// the site's origin as the VAPID contact.
func NewPushNotifier(cfg transport.Config) *PushNotifier {
	subject := ""
	if site, err := loadSite(siteOriginPath); err == nil {
		subject = site.Origin
	}
	return newPushNotifier(cfg, webpush.Sender{Subject: subject}, pushDelay)
}

// NewPushNotifierWithFixtureClient routes every push to the test's client
// and shortens the delay and the presence window; the endpoint allowlist
// still applies.
func NewPushNotifierWithFixtureClient(cfg transport.Config, client *http.Client, delay, presence time.Duration) *PushNotifier {
	p := newPushNotifier(cfg, webpush.Sender{Client: client, Subject: "https://habitat.invalid"}, delay)
	p.presence = presence
	return p
}

func newPushNotifier(cfg transport.Config, sender webpush.Sender, delay time.Duration) *PushNotifier {
	return &PushNotifier{home: cfg.Home, uid: cfg.UID, sender: sender, delay: delay, presence: pushPresence, now: time.Now, log: diagnostic.New(os.Stderr, "daemon").With("user", cfg.Username, "component", "push"), sentAt: map[string]time.Time{}, turns: map[string]string{}, delivered: map[string]pushDelivery{}}
}

// pushPayload is what the service worker receives, decrypted on the device.
// It carries no message text: the kind, which the worker words in the
// device's language, the workspace's and conversation's names, and where a
// tap leads.
type pushPayload struct {
	Version   int    `json:"v"`
	Kind      string `json:"kind"` // turn, question or test
	Language  string `json:"lang"`
	Workspace string `json:"workspace,omitempty"`
	Title     string `json:"title,omitempty"`
	URL       string `json:"url"`
	Tag       string `json:"tag"`
}

// pushTurn is one conversation entering the person's turn, as the
// conversation controller saw it.
type pushTurn struct {
	agent, kind, key, workspace, title, url string
}

// here records the person in front of a tab.
func (p *PushNotifier) here() {
	p.mu.Lock()
	p.hereAt = p.now()
	p.mu.Unlock()
}

// claim decides whether a turn notifies: the feature is on, the person is
// not in front of a tab, this turn has not notified yet and the
// conversation has not notified since the person was last here.
func (p *PushNotifier) claim(t pushTurn) (bool, string) {
	if !pushEnabled(p.home) {
		return false, "off"
	}
	p.mu.Lock()
	defer p.mu.Unlock()
	now := p.now()
	if now.Sub(p.hereAt) < p.presence {
		return false, "present"
	}
	if p.turns[t.agent] == t.key {
		return false, "duplicate"
	}
	if sent, ok := p.sentAt[t.agent]; ok && sent.After(p.hereAt) {
		return false, "unseen"
	}
	p.turns[t.agent] = t.key
	p.sentAt[t.agent] = now
	// Bounded: entries go with the conversations the person came back to.
	if len(p.sentAt) > 256 {
		for agent, at := range p.sentAt {
			if at.Before(p.hereAt) {
				delete(p.sentAt, agent)
				delete(p.turns, agent)
			}
		}
	}
	return true, ""
}

func (p *PushNotifier) notify(ctx context.Context, t pushTurn) {
	ok, reason := p.claim(t)
	if !ok {
		p.log.Info("push_notification", "outcome", "skipped", "reason", reason)
		return
	}
	pushLock.Lock()
	state, err := readPushState(p.home)
	pushLock.Unlock()
	if err != nil || state.Vapid == nil || len(state.Devices) == 0 {
		p.log.Info("push_notification", "outcome", "skipped", "reason", "no_device")
		return
	}
	var wg sync.WaitGroup
	for _, d := range state.Devices {
		wg.Add(1)
		go func() {
			defer wg.Done()
			p.send(ctx, *state.Vapid, d, t)
		}()
	}
	wg.Wait()
}

func pushTopic(agent string) string {
	sum := sha256.Sum256([]byte(agent))
	return base64.RawURLEncoding.EncodeToString(sum[:18])
}

func (p *PushNotifier) send(ctx context.Context, keys webpush.Keys, d pushDevice, t pushTurn) webpush.Outcome {
	payload, err := json.Marshal(pushPayload{Version: 1, Kind: t.kind, Language: d.Language, Workspace: t.workspace, Title: t.title, URL: t.url, Tag: t.agent})
	if err != nil {
		return webpush.Rejected
	}
	m := webpush.Message{Payload: payload, TTL: pushTTL, Urgency: "high"}
	if t.agent != "" {
		m.Topic = pushTopic(t.agent)
	}
	outcome := p.sender.Send(ctx, keys, webpush.Subscription{Endpoint: d.Endpoint, P256dh: d.P256dh, Auth: d.Auth}, m)
	p.mu.Lock()
	p.delivered[d.ID] = pushDelivery{outcome: outcome, at: p.now()}
	p.mu.Unlock()
	p.log.Info("push_notification", "outcome", string(outcome), "reason", t.kind)
	if outcome == webpush.Gone {
		// The push service forgot the subscription: so does the person's file.
		pushLock.Lock()
		if state, err := readPushState(p.home); err == nil {
			kept := state.Devices[:0]
			for _, other := range state.Devices {
				if other.ID != d.ID {
					kept = append(kept, other)
				}
			}
			state.Devices = kept
			_ = savePushState(p.home, state)
		}
		pushLock.Unlock()
	}
	return outcome
}

func (p *PushNotifier) view(state pushState) map[string]any {
	devices := []map[string]any{}
	p.mu.Lock()
	for _, d := range state.Devices {
		var last any
		if got, ok := p.delivered[d.ID]; ok {
			last = map[string]any{"outcome": string(got.outcome), "at": got.at.UTC().Format(time.RFC3339)}
		}
		devices = append(devices, map[string]any{"device_id": d.ID, "label": d.Label, "language": d.Language, "created_at": d.CreatedAt, "last_delivery": last})
	}
	p.mu.Unlock()
	var public any
	if state.Vapid != nil {
		public = state.Vapid.Public
	}
	return map[string]any{"schema_version": 1, "public_key": public, "devices": devices}
}

// Handler serves the browser's push routes. Each one is the person's own
// request through the gateway; the daemon trusts nothing in it beyond the
// shapes the contract allows.
func (p *PushNotifier) Handler(cfg transport.Config, trusted func(*http.Request) bool) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(cfg, trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		path := r.URL.Path
		if r.URL.EscapedPath() != path || r.URL.RawQuery != "" || len(r.TransferEncoding) != 0 {
			snapshotError(w, 400, "invalid_request")
			return
		}
		switch {
		case path == PushPath && r.Method == http.MethodGet && r.ContentLength <= 0:
			p.read(w)
		case path == PushPresencePath && r.Method == http.MethodPost && r.ContentLength == 0:
			p.here()
			historyJSON(w, map[string]any{"schema_version": 1, "state": "noted"})
		case path == PushKeyPath && r.Method == http.MethodPost && r.ContentLength == 0:
			p.ensureKey(w)
		case path == PushDevicesPath && r.Method == http.MethodPost:
			p.addDevice(w, r)
		case path == PushRemovePath && r.Method == http.MethodPost:
			p.removeDevice(w, r)
		case path == PushTestPath && r.Method == http.MethodPost:
			p.test(w, r)
		default:
			snapshotError(w, 400, "invalid_request")
		}
	})
}

// Mount adds the push routes to a daemon mux.
func (p *PushNotifier) Mount(mux *http.ServeMux, cfg transport.Config, trusted func(*http.Request) bool) {
	h := p.Handler(cfg, trusted)
	for _, path := range []string{PushPath, PushKeyPath, PushDevicesPath, PushRemovePath, PushTestPath, PushPresencePath} {
		mux.Handle(path, h)
	}
}

func (p *PushNotifier) read(w http.ResponseWriter) {
	pushLock.Lock()
	state, err := readPushState(p.home)
	pushLock.Unlock()
	if err != nil {
		snapshotError(w, 503, "push_unavailable")
		return
	}
	historyJSON(w, p.view(state))
}

// ensureKey makes the person's VAPID key pair if there is none; the browser
// subscribes with its public half.
func (p *PushNotifier) ensureKey(w http.ResponseWriter) {
	pushLock.Lock()
	defer pushLock.Unlock()
	if !pushEnabled(p.home) {
		snapshotError(w, 409, "push_feature_off")
		return
	}
	state, err := readPushState(p.home)
	if err != nil {
		snapshotError(w, 503, "push_unavailable")
		return
	}
	if state.Vapid == nil {
		keys, err := webpush.NewKeys()
		if err != nil {
			snapshotError(w, 503, "push_unavailable")
			return
		}
		state.Vapid = &keys
		if savePushState(p.home, state) != nil {
			snapshotError(w, 503, "push_unavailable")
			return
		}
	}
	historyJSON(w, p.view(state))
}

// addDevice records this device's subscription, or with refresh only
// updates one already recorded: a page load refreshes its own device but
// must not bring back one the person removed elsewhere.
func (p *PushNotifier) addDevice(w http.ResponseWriter, r *http.Request) {
	var in struct {
		Endpoint string `json:"endpoint"`
		Keys     struct {
			P256dh string `json:"p256dh"`
			Auth   string `json:"auth"`
		} `json:"keys"`
		PublicKey string `json:"public_key"`
		Label     string `json:"label"`
		Language  string `json:"language"`
		Refresh   bool   `json:"refresh"`
	}
	if decodeControl(r, &in, 2048) != nil {
		snapshotError(w, 400, "invalid_request")
		return
	}
	d := pushDevice{ID: pushDeviceID(in.Endpoint), Endpoint: in.Endpoint, P256dh: in.Keys.P256dh, Auth: in.Keys.Auth, Label: in.Label, Language: in.Language, CreatedAt: p.now().UTC().Format(time.RFC3339)}
	if !webpush.AllowedEndpoint(in.Endpoint) {
		snapshotError(w, 400, "push_endpoint_refused")
		return
	}
	if !d.valid() {
		snapshotError(w, 400, "invalid_request")
		return
	}
	pushLock.Lock()
	defer pushLock.Unlock()
	if !pushEnabled(p.home) {
		snapshotError(w, 409, "push_feature_off")
		return
	}
	state, err := readPushState(p.home)
	if err != nil {
		snapshotError(w, 503, "push_unavailable")
		return
	}
	// A subscription made with an earlier key pair cannot be sent to.
	if state.Vapid == nil || in.PublicKey != state.Vapid.Public {
		snapshotError(w, 409, "push_key_changed")
		return
	}
	found := false
	for i, other := range state.Devices {
		if other.ID == d.ID {
			d.CreatedAt = other.CreatedAt
			state.Devices[i] = d
			found = true
		}
	}
	if !found {
		if in.Refresh {
			snapshotError(w, 404, "push_device_unknown")
			return
		}
		if len(state.Devices) >= maxPushDevices {
			snapshotError(w, 409, "push_devices_full")
			return
		}
		state.Devices = append(state.Devices, d)
	}
	if savePushState(p.home, state) != nil {
		snapshotError(w, 503, "push_unavailable")
		return
	}
	view := p.view(state)
	view["device_id"] = d.ID
	historyJSON(w, view)
}

func decodePushDevice(r *http.Request) (string, bool) {
	var in struct {
		DeviceID string `json:"device_id"`
	}
	if decodeControl(r, &in, 128) != nil || len(in.DeviceID) != 25 || in.DeviceID[:3] != "pd_" {
		return "", false
	}
	if _, err := base64.RawURLEncoding.DecodeString(in.DeviceID[3:]); err != nil {
		return "", false
	}
	return in.DeviceID, true
}

func (p *PushNotifier) removeDevice(w http.ResponseWriter, r *http.Request) {
	id, ok := decodePushDevice(r)
	if !ok {
		snapshotError(w, 400, "invalid_request")
		return
	}
	pushLock.Lock()
	defer pushLock.Unlock()
	state, err := readPushState(p.home)
	if err != nil {
		snapshotError(w, 503, "push_unavailable")
		return
	}
	kept := state.Devices[:0]
	for _, d := range state.Devices {
		if d.ID != id {
			kept = append(kept, d)
		}
	}
	// Removing a device that is already gone is the same result.
	if len(kept) != len(state.Devices) {
		state.Devices = kept
		if savePushState(p.home, state) != nil {
			snapshotError(w, 503, "push_unavailable")
			return
		}
	}
	p.mu.Lock()
	delete(p.delivered, id)
	p.mu.Unlock()
	historyJSON(w, p.view(state))
}

// test sends the test notification to one device and answers how the push
// service took it, so a server without outbound HTTPS says so on the card.
func (p *PushNotifier) test(w http.ResponseWriter, r *http.Request) {
	_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(30 * time.Second))
	id, ok := decodePushDevice(r)
	if !ok {
		snapshotError(w, 400, "invalid_request")
		return
	}
	if !pushEnabled(p.home) {
		snapshotError(w, 409, "push_feature_off")
		return
	}
	pushLock.Lock()
	state, err := readPushState(p.home)
	pushLock.Unlock()
	if err != nil {
		snapshotError(w, 503, "push_unavailable")
		return
	}
	var device *pushDevice
	for i := range state.Devices {
		if state.Devices[i].ID == id {
			device = &state.Devices[i]
		}
	}
	if device == nil || state.Vapid == nil {
		snapshotError(w, 404, "push_device_unknown")
		return
	}
	outcome := p.send(r.Context(), *state.Vapid, *device, pushTurn{kind: "test", url: "/settings/experimental#" + PushFeature})
	historyJSON(w, map[string]any{"schema_version": 1, "device_id": id, "outcome": string(outcome)})
}
