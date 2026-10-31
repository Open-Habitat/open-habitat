//go:build linux

package daemon

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/Open-Habitat/open-habitat/internal/transport"
	"github.com/Open-Habitat/open-habitat/internal/webpush/webpushtest"
)

type pushFixture struct {
	t       *testing.T
	home    string
	service *webpushtest.Service
	p       *PushNotifier
	h       http.Handler
	clock   time.Time
}

func newPushFixture(t *testing.T) *pushFixture {
	home := t.TempDir()
	cfg := transport.Config{Home: home, UID: os.Getuid(), Provider: "github", Subject: "42"}
	f := &pushFixture{t: t, home: home, service: webpushtest.NewService(), clock: time.Unix(1_800_000_000, 0)}
	f.p = NewPushNotifierWithFixtureClient(cfg, f.service.Client(), 0, pushPresence)
	f.p.now = func() time.Time { return f.clock }
	f.h = f.p.Handler(cfg, func(*http.Request) bool { return true })
	return f
}

func (f *pushFixture) do(method, path, body string) (int, map[string]any) {
	f.t.Helper()
	r := httptest.NewRequest(method, "http://unix"+path, strings.NewReader(body))
	if body != "" {
		r.Header.Set("Content-Type", "application/json")
	}
	w := httptest.NewRecorder()
	f.h.ServeHTTP(w, r)
	var out map[string]any
	_ = json.Unmarshal(w.Body.Bytes(), &out)
	return w.Code, out
}

func (f *pushFixture) feature(on bool) {
	f.t.Helper()
	if _, err := applyPreferences(f.home, preferencesWrite{Experimental: map[string]bool{PushFeature: on}}); err != nil {
		f.t.Fatal(err)
	}
}

// subscribe records a device the way the card does: key first, then the
// subscription made with it.
func (f *pushFixture) subscribe(b *webpushtest.Browser, refresh bool) (int, map[string]any) {
	f.t.Helper()
	code, state := f.do("POST", PushKeyPath, "")
	if code != 200 {
		return code, state
	}
	body, _ := json.Marshal(map[string]any{"endpoint": b.Endpoint, "keys": map[string]string{"p256dh": b.P256dh(), "auth": b.Auth()}, "public_key": state["public_key"], "label": "iPhone · Safari", "language": "fi", "refresh": refresh})
	return f.do("POST", PushDevicesPath, string(body))
}

func TestPushDevicesStayInThePersonsOwnFile(t *testing.T) {
	f := newPushFixture(t)
	phone := webpushtest.NewBrowser("https://web.push.apple.com/phone")
	// Off: nothing is created, not even a key.
	if code, _ := f.subscribe(phone, false); code != 409 {
		t.Fatalf("subscribe while off: %d", code)
	}
	if _, err := os.Stat(filepath.Join(f.home, ".config/open-habitat/push.json")); !os.IsNotExist(err) {
		t.Fatal("push file written while off")
	}
	f.feature(true)
	code, state := f.subscribe(phone, false)
	if code != 200 || state["device_id"] != pushDeviceID(phone.Endpoint) {
		t.Fatalf("subscribe: %d %v", code, state)
	}
	st, err := os.Stat(filepath.Join(f.home, ".config/open-habitat/push.json"))
	if err != nil || st.Mode().Perm() != 0600 {
		t.Fatalf("push file: %v %v", st, err)
	}
	// The browser's view carries no endpoint, subscription secret or private key.
	_, view := f.do("GET", PushPath, "")
	raw, _ := json.Marshal(view)
	stored, _ := os.ReadFile(filepath.Join(f.home, ".config/open-habitat/push.json"))
	var file pushState
	_ = json.Unmarshal(stored, &file)
	for _, secret := range []string{phone.Endpoint, phone.Auth(), phone.P256dh(), file.Vapid.Private} {
		if strings.Contains(string(raw), secret) {
			t.Fatalf("view leaks %q: %s", secret, raw)
		}
	}
	// A page load refreshes only a device still recorded: one removed on
	// another device does not come back.
	if code, _ := f.do("POST", PushRemovePath, `{"device_id":"`+pushDeviceID(phone.Endpoint)+`"}`); code != 200 {
		t.Fatalf("remove: %d", code)
	}
	if code, _ := f.subscribe(phone, true); code != 404 {
		t.Fatalf("refresh of removed device: %d", code)
	}
	if code, _ := f.subscribe(phone, false); code != 200 {
		t.Fatalf("subscribe again: %d", code)
	}
	// Only the vendors' push services are accepted as endpoints.
	for _, endpoint := range []string{"https://127.0.0.1/push", "http://fcm.googleapis.com/fcm/send/x", "https://example.org/push", "https://fcm.googleapis.com:444/x"} {
		if code, out := f.subscribe(webpushtest.NewBrowser(endpoint), false); code != 400 {
			t.Fatalf("%s accepted: %d %v", endpoint, code, out)
		}
	}
	// A subscription made with an older key cannot be recorded.
	body, _ := json.Marshal(map[string]any{"endpoint": "https://fcm.googleapis.com/fcm/send/x", "keys": map[string]string{"p256dh": phone.P256dh(), "auth": phone.Auth()}, "public_key": "BOld", "label": "Chrome", "language": "en", "refresh": false})
	if code, _ := f.do("POST", PushDevicesPath, string(body)); code != 409 {
		t.Fatalf("stale key: %d", code)
	}
	// Turning the feature off forgets the key and every device.
	f.feature(false)
	if _, err := os.Stat(filepath.Join(f.home, ".config/open-habitat/push.json")); !os.IsNotExist(err) {
		t.Fatal("push file kept after the feature was turned off")
	}
}

func TestPushRefusesAForeignOrUnsafeFile(t *testing.T) {
	f := newPushFixture(t)
	f.feature(true)
	if code, _ := f.subscribe(webpushtest.NewBrowser("https://fcm.googleapis.com/fcm/send/a"), false); code != 200 {
		t.Fatal("subscribe")
	}
	file := filepath.Join(f.home, ".config/open-habitat/push.json")
	if err := os.Chmod(file, 0640); err != nil {
		t.Fatal(err)
	}
	if code, _ := f.do("GET", PushPath, ""); code != 503 {
		t.Fatalf("group-readable key file used: %d", code)
	}
	if err := os.Remove(file); err != nil {
		t.Fatal(err)
	}
	other := filepath.Join(t.TempDir(), "push.json")
	if err := os.WriteFile(other, []byte(`{"devices":[]}`), 0600); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(other, file); err != nil {
		t.Fatal(err)
	}
	if code, _ := f.do("GET", PushPath, ""); code != 503 {
		t.Fatalf("symlinked file followed: %d", code)
	}
}

func TestPushRoutesRefuseUntrustedPeersAndBadShapes(t *testing.T) {
	home := t.TempDir()
	cfg := transport.Config{Home: home, Provider: "github", Subject: "42"}
	h := NewPushNotifierWithFixtureClient(cfg, webpushtest.NewService().Client(), 0, pushPresence).Handler(cfg, func(*http.Request) bool { return false })
	w := httptest.NewRecorder()
	h.ServeHTTP(w, httptest.NewRequest("GET", "http://unix"+PushPath, nil))
	if w.Code != 403 {
		t.Fatalf("untrusted: %d", w.Code)
	}
	f := newPushFixture(t)
	f.feature(true)
	for _, tc := range []struct{ method, path, body string }{
		{"POST", PushPath, ""}, {"GET", PushKeyPath, ""}, {"GET", PushPath + "?uid=1", ""},
		{"POST", PushRemovePath, `{"device_id":"../x"}`}, {"POST", PushTestPath, `{"device_id":"pd_x","uid":1}`},
		{"POST", PushDevicesPath, `{"endpoint":"https://fcm.googleapis.com/x","keys":{"p256dh":"x","auth":"y"},"public_key":"k","label":"a","language":"fi","refresh":false}`},
		{"POST", PushPresencePath, `{}`},
	} {
		if code, _ := f.do(tc.method, tc.path, tc.body); code != 400 {
			t.Errorf("%+v: %d", tc, code)
		}
	}
}

func TestPushNotifiesOncePerTurnOnlyWhileAway(t *testing.T) {
	f := newPushFixture(t)
	f.feature(true)
	phone := webpushtest.NewBrowser("https://web.push.apple.com/phone")
	laptop := webpushtest.NewBrowser("https://fcm.googleapis.com/fcm/send/laptop")
	f.subscribe(phone, false)
	f.subscribe(laptop, false)
	turn := pushTurn{agent: "pi:a", kind: "turn", key: "turn:1", workspace: "Sääasema", title: "CSV-vienti", url: "/workspaces/ws_1?conversation=pi:a"}

	// In front of a tab: nothing.
	f.p.here()
	f.clock = f.clock.Add(30 * time.Second)
	f.p.notify(t.Context(), turn)
	if n := len(f.service.Messages()); n != 0 {
		t.Fatalf("sent while present: %d", n)
	}
	// Away: one message per device, with only the names and the kind.
	f.clock = f.clock.Add(2 * time.Minute)
	f.p.notify(t.Context(), turn)
	messages := f.service.Messages()
	if len(messages) != 2 {
		t.Fatalf("messages %d", len(messages))
	}
	for _, m := range messages {
		b := phone
		if m.Endpoint == laptop.Endpoint {
			b = laptop
		}
		plain, err := b.Decrypt(m.Body)
		if err != nil {
			t.Fatal(err)
		}
		var payload map[string]any
		if err := json.Unmarshal(plain, &payload); err != nil {
			t.Fatal(err)
		}
		want := map[string]any{"v": float64(1), "kind": "turn", "lang": "fi", "workspace": "Sääasema", "title": "CSV-vienti", "url": "/workspaces/ws_1?conversation=pi:a", "tag": "pi:a"}
		if len(payload) != len(want) {
			t.Fatalf("payload %v", payload)
		}
		for k, v := range want {
			if payload[k] != v {
				t.Fatalf("payload %v", payload)
			}
		}
		if m.Header.Get("TTL") == "" || m.Header.Get("Topic") == "" {
			t.Fatalf("headers %v", m.Header)
		}
	}
	// The same turn again (a repeated settlement) and a further turn of the
	// same conversation before the person came back: nothing more.
	f.p.notify(t.Context(), turn)
	f.clock = f.clock.Add(5 * time.Minute)
	f.p.notify(t.Context(), pushTurn{agent: "pi:a", kind: "turn", key: "turn:2"})
	if n := len(f.service.Messages()); n != 2 {
		t.Fatalf("repeat notified: %d", n)
	}
	// Another conversation still notifies.
	f.p.notify(t.Context(), pushTurn{agent: "pi:b", kind: "question", key: "question:q"})
	if n := len(f.service.Messages()); n != 4 {
		t.Fatalf("second conversation: %d", n)
	}
	// After the person was back and left again, the first one notifies anew.
	f.p.here()
	f.clock = f.clock.Add(2 * time.Minute)
	f.p.notify(t.Context(), pushTurn{agent: "pi:a", kind: "turn", key: "turn:3"})
	if n := len(f.service.Messages()); n != 6 {
		t.Fatalf("after return: %d", n)
	}
	// A push service that forgot the subscription removes the device.
	f.service.SetStatus(phone.Endpoint, 410)
	f.p.notify(t.Context(), pushTurn{agent: "pi:c", kind: "turn", key: "turn:1"})
	_, view := f.do("GET", PushPath, "")
	if devices := view["devices"].([]any); len(devices) != 1 || devices[0].(map[string]any)["device_id"] != pushDeviceID(laptop.Endpoint) {
		t.Fatalf("gone device kept: %v", view)
	}
	// Off: nothing is sent.
	f.feature(false)
	before := len(f.service.Messages())
	f.p.notify(t.Context(), pushTurn{agent: "pi:d", kind: "turn", key: "turn:1"})
	if len(f.service.Messages()) != before {
		t.Fatal("sent while off")
	}
}

func TestPushTestReportsDelivery(t *testing.T) {
	f := newPushFixture(t)
	f.feature(true)
	phone := webpushtest.NewBrowser("https://web.push.apple.com/phone")
	f.subscribe(phone, false)
	id := pushDeviceID(phone.Endpoint)
	code, out := f.do("POST", PushTestPath, `{"device_id":"`+id+`"}`)
	if code != 200 || out["outcome"] != "delivered" {
		t.Fatalf("test: %d %v", code, out)
	}
	plain, _ := phone.Decrypt(f.service.Messages()[0].Body)
	if !strings.Contains(string(plain), `"kind":"test"`) {
		t.Fatalf("test payload %s", plain)
	}
	f.service.SetStatus(phone.Endpoint, 503)
	if _, out := f.do("POST", PushTestPath, `{"device_id":"`+id+`"}`); out["outcome"] != "rejected" {
		t.Fatalf("refusal: %v", out)
	}
	_, view := f.do("GET", PushPath, "")
	if last := view["devices"].([]any)[0].(map[string]any)["last_delivery"].(map[string]any); last["outcome"] != "rejected" {
		t.Fatalf("last delivery %v", last)
	}
	if code, _ := f.do("POST", PushTestPath, `{"device_id":"pd_AAAAAAAAAAAAAAAAAAAAAA"}`); code != 404 {
		t.Fatalf("unknown device: %d", code)
	}
}

// The controller hands a turn on only while it is still the person's: a
// message sent within the delay, or a question answered, cancels it.
func TestPushTurnFollowsTheConversation(t *testing.T) {
	f := newPushFixture(t)
	f.feature(true)
	f.subscribe(webpushtest.NewBrowser("https://web.push.apple.com/phone"), false)
	f.p.delay = 20 * time.Millisecond
	f.clock = f.clock.Add(time.Hour)
	c := &ConversationController{sessions: map[string]*conversation{}, cfg: transport.Config{Home: f.home, UID: os.Getuid()}, discover: func(transport.Config) Discovery { return Discovery{} }, push: f.p}
	s := &conversation{id: "11111111-1111-1111-1111-111111111111", state: "idle", turnGeneration: 3}
	c.sessions[s.id] = s
	wait := func(n int) {
		t.Helper()
		deadline := time.Now().Add(2 * time.Second)
		for len(f.service.Messages()) != n && time.Now().Before(deadline) {
			time.Sleep(5 * time.Millisecond)
		}
		time.Sleep(60 * time.Millisecond)
		if got := len(f.service.Messages()); got != n {
			t.Fatalf("messages %d, want %d", got, n)
		}
	}
	c.mu.Lock()
	c.pushTurn(s, "turn", "3")
	s.turnGeneration, s.state = 4, "pending" // the person wrote meanwhile
	c.mu.Unlock()
	wait(0)
	c.mu.Lock()
	s.state, s.questionID = "idle", "q1"
	c.pushTurn(s, "question", "q1")
	s.questionID = "" // answered elsewhere
	c.mu.Unlock()
	wait(0)
	c.mu.Lock()
	c.pushTurn(s, "turn", "4")
	c.mu.Unlock()
	wait(1)
}
