package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"testing"
)

type quotaBroker struct {
	*adminBroker
	lastSubject string
	lastLimit   uint64
	missing     bool
}

func (b *quotaBroker) ReadQuota(_ context.Context, id string) (Quota, QuotaFilesystem, error) {
	b.lastSubject = id
	return Quota{UsageBytes: 2 * 1024 * 1024, LimitBytes: 1024 * 1024}, QuotaFilesystem{CapacityBytes: 1024 * 1024, FreeBytes: 512 * 1024}, nil
}
func (b *quotaBroker) SetQuota(_ context.Context, id string, limit uint64) error {
	if b.missing {
		return ErrBoundUserNotFound
	}
	b.lastSubject = id
	b.lastLimit = limit
	return nil
}
func TestQuotaAuthorizationAndDefault(t *testing.T) {
	h, a, _, _, _ := fixture(t)
	if e := a.loadAdministration(filepath.Join(t.TempDir(), "admin.json")); e != nil {
		t.Fatal(e)
	}
	b := &quotaBroker{adminBroker: &adminBroker{Broker: a.broker}}
	a.broker = b
	state, flow := start(t, h)
	if r := callback(h, state, flow); r.Code != 503 {
		t.Fatalf("missing default allowed login: %d", r.Code)
	}
	if _, e := a.AdminControl(context.Background(), []byte(`{"operation":"default_limit","default_limit_bytes":1073741824}`)); e != nil {
		t.Fatal(e)
	}
	state, flow = start(t, h)
	login := callback(h, state, flow)
	if login.Code != 303 {
		t.Fatalf("configured login: %d %s", login.Code, login.Body.String())
	}
	cookie := login.Result().Cookies()[1]
	personal := request(h, "GET", "/api/v1/account/storage", cookie)
	if personal.Code != 200 || b.lastSubject != "42" {
		t.Fatalf("personal read: %d %s", personal.Code, b.lastSubject)
	}
	if request(h, "GET", "/api/v1/server/storage", cookie).Code != 403 {
		t.Fatal("non-admin quota list")
	}
	if e := a.changeRole(context.Background(), "42", true); e != nil {
		t.Fatal(e)
	}
	listed := request(h, "GET", "/api/v1/server/storage", cookie)
	var result struct {
		Overcommitted bool  `json:"overcommitted"`
		Users         []any `json:"users"`
	}
	if listed.Code != 200 || json.Unmarshal(listed.Body.Bytes(), &result) != nil || !result.Overcommitted || len(result.Users) != 2 {
		t.Fatalf("quota list: %d %s", listed.Code, listed.Body.String())
	}
	var sess struct {
		CSRF string `json:"csrf"`
	}
	if e := json.Unmarshal(request(h, "GET", "/auth/session", cookie).Body.Bytes(), &sess); e != nil {
		t.Fatal(e)
	}
	put := func(csrf, body string) int {
		r := httptest.NewRequest("PUT", "https://host.test/api/v1/server/storage", strings.NewReader(body))
		r.AddCookie(cookie)
		r.Header.Set("Origin", "https://host.test")
		r.Header.Set("X-Agent-Host-CSRF", csrf)
		r.Header.Set("Content-Type", "application/json")
		w := httptest.NewRecorder()
		h.ServeHTTP(w, r)
		return w.Code
	}
	if put("wrong", `{"subject":"43","limit_bytes":1024}`) != 403 || put(sess.CSRF, `{"subject":"043","limit_bytes":1024}`) != 400 || put(sess.CSRF, `{"subject":"43","limit_bytes":0}`) != 400 || put(sess.CSRF, `{"subject":"43","limit_bytes":1024}`) != 400 {
		t.Fatal("invalid quota write accepted")
	}
	if put(sess.CSRF, `{"subject":"43","limit_bytes":1048576}`) != 204 || b.lastSubject != "43" || b.lastLimit != 1048576 {
		t.Fatal("quota write did not reach broker by subject")
	}
	if _, e := a.AdminControl(context.Background(), []byte(`{"operation":"quota_set","subject":"043","limit_bytes":1024}`)); e == nil {
		t.Fatal("control accepted noncanonical subject")
	}
	b.missing = true
	if put(sess.CSRF, `{"subject":"999","limit_bytes":1048576}`) != 404 {
		t.Fatal("unbound quota target reported as broker outage")
	}
	if _, e := a.AdminControl(context.Background(), []byte(`{"operation":"quota_set","subject":"999","limit_bytes":1048576}`)); !errors.Is(e, errBindingNotFound) {
		t.Fatalf("CLI unbound target: %v", e)
	}
}

func (b *quotaBroker) ListQuotas(ctx context.Context) ([]QuotaRow, QuotaFilesystem, error) {
	users, err := b.ListBound(ctx)
	if err != nil {
		return nil, QuotaFilesystem{}, err
	}
	rows := make([]QuotaRow, 0, len(users))
	var fs QuotaFilesystem
	for _, u := range users {
		q, disk, err := b.ReadQuota(ctx, u.ID)
		if err != nil {
			return nil, fs, err
		}
		fs = disk
		rows = append(rows, QuotaRow{BoundUser: u, Quota: q})
	}
	return rows, fs, nil
}

type partialQuotaBroker struct{ *quotaBroker }

func (b partialQuotaBroker) ListQuotas(context.Context) ([]QuotaRow, QuotaFilesystem, error) {
	return []QuotaRow{
		{BoundUser: BoundUser{ID: "42", Username: "alice"}, Quota: Quota{UsageBytes: 123, LimitBytes: 1 << 30}},
		{BoundUser: BoundUser{ID: "43", Username: "bob"}, Unavailable: true},
	}, QuotaFilesystem{CapacityBytes: 2 << 30, FreeBytes: 1 << 30}, nil
}
func TestQuotaPartialListKeepsHealthyRowsAndUnknownOvercommit(t *testing.T) {
	_, a, _, _, _ := fixture(t)
	if err := a.loadAdministration(filepath.Join(t.TempDir(), "admin.json")); err != nil {
		t.Fatal(err)
	}
	a.broker = partialQuotaBroker{&quotaBroker{adminBroker: &adminBroker{Broker: a.broker}}}
	raw, err := a.quotaUsers(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	var result struct {
		Users         []QuotaRow `json:"users"`
		Overcommitted *bool      `json:"overcommitted"`
	}
	if err := json.Unmarshal(raw, &result); err != nil || len(result.Users) != 2 || result.Users[0].UsageBytes != 123 || !result.Users[1].Unavailable || result.Overcommitted != nil {
		t.Fatalf("partial quota list: %s %v", raw, err)
	}
}
