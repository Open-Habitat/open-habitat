package gateway

import (
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strconv"
	"strings"
	"testing"
	"time"
)

// liveFake is the broker's live-limit surface: it records each relayed write
// and can lose its reply after committing.
type liveFake struct {
	*accessFake
	limits  LiveLimits
	relayed []string
	lose    bool
}

func (b *liveFake) LiveLimits(context.Context) (LiveLimits, error) { return b.limits, nil }
func (b *liveFake) SetLiveLimit(_ context.Context, subject string, limit int) (LiveLimits, error) {
	b.relayed = append(b.relayed, subject+"="+strconv.Itoa(limit))
	if subject == "" {
		b.limits.Default = limit
	} else if subject == "99" {
		return LiveLimits{}, ErrBoundUserNotFound
	} else {
		people := []LiveLimitPerson{}
		for _, p := range b.limits.People {
			if p.ID != subject {
				people = append(people, p)
			}
		}
		if limit != 0 {
			people = append(people, LiveLimitPerson{subject, limit})
		}
		b.limits.People = people
	}
	if b.lose {
		b.lose = false
		return LiveLimits{}, ErrLiveLimitUncertain
	}
	return b.limits, nil
}

func TestLiveLimitsAdministratorRelay(t *testing.T) {
	x := newAccessHarness(t)
	fake := &liveFake{accessFake: x.broker}
	now := time.Date(2026, 11, 6, 9, 0, 0, 0, time.UTC)
	a, e := NewAuth(OAuthConfig{ClientID: "fixture", ClientSecret: "fixture", Origin: "https://host.test", CallbackURL: "https://host.test/auth/github/callback"}, AuthOptions{Provider: x.provider, Sink: x.sink, Broker: fake, Now: func() time.Time { return now }, SessionFile: filepath.Join(x.dir, "sessions.json"), AdminFile: filepath.Join(x.dir, "administration.json"), Log: slog.New(slog.DiscardHandler)})
	if e != nil {
		t.Fatal(e)
	}
	x.auth, x.h = a, NewWithAuth("", a)
	original := readMemory
	readMemory = func() (Memory, bool) { return Memory{TotalBytes: 16 << 30, AvailableBytes: 9 << 30}, true }
	t.Cleanup(func() { readMemory = original })

	alice := x.login("42", "alice")
	csrf := extractCSRF(t, request(x.h, "GET", "/auth/session", alice).Body.String())
	bob := x.login("43", "bob")
	bobCSRF := extractCSRF(t, request(x.h, "GET", "/auth/session", bob).Body.String())
	put := func(c *http.Cookie, token, body string) *httptest.ResponseRecorder {
		r := httptest.NewRequest("PUT", "https://host.test"+liveLimitsPath, strings.NewReader(body))
		r.AddCookie(c)
		r.Header.Set("Origin", "https://host.test")
		r.Header.Set("X-Agent-Host-CSRF", token)
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		x.h.ServeHTTP(w, r)
		return w
	}
	if w := request(x.h, "GET", liveLimitsPath, bob); w.Code != 403 {
		t.Fatal("non-administrator read", w.Code)
	}
	if w := put(bob, bobCSRF, `{"limit":40}`); w.Code != 403 || len(fake.relayed) != 0 {
		t.Fatal("non-administrator write", w.Code)
	}
	if w := put(alice, "wrong", `{"limit":40}`); w.Code != 403 || len(fake.relayed) != 0 {
		t.Fatal("CSRF bypass", w.Code)
	}
	for _, body := range []string{`{"limit":0}`, `{"limit":129}`, `{"limit":1.5}`, `{}`, `{"subject":"042","limit":3}`, `{"subject":"43","limit":3,"uid":2100}`, `{"limit":"3"}`} {
		if w := put(alice, csrf, body); w.Code != 400 {
			t.Fatal("invalid write", body, w.Code)
		}
	}
	if len(fake.relayed) != 0 {
		t.Fatal("invalid write reached the broker", fake.relayed)
	}
	var view struct {
		DefaultLimit *int              `json:"default_limit"`
		HostDefault  int               `json:"host_default"`
		MaxLimit     int               `json:"max_limit"`
		Memory       *Memory           `json:"memory"`
		People       []LiveLimitPerson `json:"people"`
	}
	w := request(x.h, "GET", liveLimitsPath, alice)
	if w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &view) != nil || view.DefaultLimit != nil || view.HostDefault != 32 || view.MaxLimit != 128 || view.Memory == nil || view.Memory.TotalBytes != 16<<30 {
		t.Fatal(w.Code, w.Body.String())
	}
	if w = put(alice, csrf, `{"limit":12}`); w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &view) != nil || view.DefaultLimit == nil || *view.DefaultLimit != 12 {
		t.Fatal(w.Code, w.Body.String())
	}
	if w = put(alice, csrf, `{"subject":"43","limit":40}`); w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &view) != nil || len(view.People) != 1 || view.People[0] != (LiveLimitPerson{"43", 40}) {
		t.Fatal(w.Code, w.Body.String())
	}
	if w = put(alice, csrf, `{"subject":"43","limit":null}`); w.Code != 200 || json.Unmarshal(w.Body.Bytes(), &view) != nil || len(view.People) != 0 {
		t.Fatal(w.Code, w.Body.String())
	}
	if w = put(alice, csrf, `{"subject":"99","limit":4}`); w.Code != 404 {
		t.Fatal("unbound subject", w.Code)
	}
	fake.lose = true
	if w = put(alice, csrf, `{"limit":20}`); w.Code != 503 || !strings.Contains(w.Body.String(), "outcome_uncertain") {
		t.Fatal("lost reply", w.Code, w.Body.String())
	}
	if strings.Join(fake.relayed, ",") != "=12,43=40,43=0,99=4,=20" {
		t.Fatal(fake.relayed)
	}
}

func TestParseMeminfo(t *testing.T) {
	m, ok := parseMeminfo([]byte("MemTotal:       16303440 kB\nMemFree:  100 kB\nMemAvailable:    9443120 kB\n"))
	if !ok || m.TotalBytes != 16303440<<10 || m.AvailableBytes != 9443120<<10 {
		t.Fatal(m, ok)
	}
	if _, ok = parseMeminfo([]byte("MemTotal: 10 kB\n")); ok {
		t.Fatal("missing MemAvailable accepted")
	}
	if _, ok = parseMeminfo([]byte("MemTotal: 10 kB\nMemAvailable: 20 kB\n")); ok {
		t.Fatal("available above total accepted")
	}
}
