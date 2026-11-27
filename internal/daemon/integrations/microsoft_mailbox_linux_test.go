//go:build linux

package integrations

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"sync/atomic"
	"testing"
	"time"
)

const microsoftMailGrant = "User.Read Files.ReadWrite.All Sites.ReadWrite.All Mail.ReadWrite Mail.Send Calendars.ReadWrite Contacts.ReadWrite"

// inboxAnswer is how the synthetic tenant answers the mailbox probe: a
// status and body, or hang until the request's deadline.
type inboxAnswer struct {
	status int
	body   string
	hang   bool
}

var (
	inboxPresent = inboxAnswer{status: 200, body: `{"id":"inbox-folder"}`}
	inboxGuest   = inboxAnswer{status: 404, body: `{"error":{"code":"MailboxNotEnabledForRESTAPI","message":"The mailbox is either inactive, soft-deleted, or is hosted on-premise."}}`}
)

// mailboxSignIn signs the synthetic person in (or renews expected) with a
// grant of scope, the tenant answering the inbox read with answer, and
// returns the connection's name and how many times the inbox was asked.
func mailboxSignIn(t *testing.T, env Env, scope string, answer inboxAnswer, expected string) (string, int32) {
	t.Helper()
	m := syntheticMicrosoft(t, "person@example.test", "")
	microsoftGrantToken(t, m, scope, true)
	base := m.client.Transport
	var asked atomic.Int32
	m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
		if r.URL.Host == "graph.microsoft.com" && r.URL.Path == "/v1.0/me/mailFolders/inbox" {
			asked.Add(1)
			if r.Header.Get("Authorization") != "Bearer access-secret" {
				t.Error("probe without the sign-in's token")
			}
			if answer.hang {
				<-r.Context().Done()
				return nil, r.Context().Err()
			}
			return &http.Response{StatusCode: answer.status, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(answer.body))}, nil
		}
		return base.RoundTrip(r)
	})
	l := msLogin(t, m, env, expected)
	defer l.Cancel()
	name, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil })
	if err != nil {
		t.Fatal(err)
	}
	if err := l.Commit(context.Background(), name); err != nil {
		t.Fatal(err)
	}
	return name, asked.Load()
}

// areasOf are the connection's registered area names, sorted.
func areasOf(t *testing.T, env Env, name string) []string {
	t.Helper()
	s, _, err := microsoftServerOf(env, name)
	if err != nil {
		t.Fatal(err)
	}
	var out []string
	for area := range s.areas {
		out = append(out, area)
	}
	slices.Sort(out)
	return out
}

func serviceIDs(services []Service) []string {
	var out []string
	for _, s := range services {
		out = append(out, s.ID)
	}
	return out
}

// checkWithGrant runs the status check with the tenant's answer naming
// scope as the grant.
func checkWithGrant(t *testing.T, env Env, name, scope string) ([]Service, *Grant) {
	t.Helper()
	verify, _ := json.Marshal(map[string]any{"state": "ok", "scopes": strings.Fields(scope)})
	if err := os.WriteFile(filepath.Join(env.Home, "mcp-status-result"), verify, 0600); err != nil {
		t.Fatal(err)
	}
	return (&microsoft{}).CheckGrant(context.Background(), env, name)
}

var allAreas = []string{"admin", "calendar", "contacts", "files", "mail"}

// A connection whose account has a mailbox gets its five areas as before.
func TestMicrosoftMailboxPresentRegistersFiveAreas(t *testing.T) {
	env := microsoftEnv(t)
	name, asked := mailboxSignIn(t, env, microsoftMailGrant, inboxPresent, "")
	if asked != 1 {
		t.Fatal("inbox asked", asked)
	}
	if got := areasOf(t, env, name); !slices.Equal(got, allAreas) {
		t.Fatal(got)
	}
	services, _ := checkWithGrant(t, env, name, microsoftMailGrant)
	if ids := serviceIDs(services); !slices.Contains(ids, "mail") || !slices.Contains(ids, "calendar") || !slices.Contains(ids, "contacts") {
		t.Fatal(ids)
	}
	if k := (&microsoft{}).Skill(env, name).Kinds; !slices.Equal(k, []string{"mail", "calendar", "contacts", "files"}) {
		t.Fatal(k)
	}
}

// An account without a mailbox in the organisation (a B2B guest, usually)
// is registered with its files area alone; the services, level and skill
// say so, and nothing reshapes it back to five at the next check.
func TestMicrosoftNoMailboxRegistersFilesAlone(t *testing.T) {
	for _, tc := range []struct {
		name   string
		answer inboxAnswer
	}{
		{"mailbox not enabled", inboxGuest},
		{"mailbox not found", inboxAnswer{status: 404, body: `{"error":{"code":"ResourceNotFound","message":"Resource could not be discovered."}}`}},
		{"tenant without Exchange", inboxAnswer{status: 401, body: `{"error":{"code":"OrganizationFromTenantGuidNotFound","message":"The tenant for tenant guid does not exist."}}`}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			env := microsoftEnv(t)
			name, _ := mailboxSignIn(t, env, microsoftMailGrant, tc.answer, "")
			if got := areasOf(t, env, name); !slices.Equal(got, []string{"files"}) {
				t.Fatal(got)
			}
			m := &microsoft{}
			services, grant := checkWithGrant(t, env, name, microsoftMailGrant)
			if ids := serviceIDs(services); !slices.Equal(ids, []string{"onedrive"}) {
				t.Fatal(ids)
			}
			if services[0].State != StateOK || services[0].Access != AccessFull || grant == nil {
				t.Fatalf("%+v %+v", services, grant)
			}
			if level := m.Level(env, name, services); level != LevelFull {
				t.Fatal("level", level)
			}
			// Before the grant is read the files row is still the card's.
			os.WriteFile(filepath.Join(env.Home, "mcp-status-result"), []byte(`{"state":"refused"}`), 0600)
			if services := m.Check(context.Background(), env, name); !slices.Equal(serviceIDs(services), []string{"onedrive"}) || services[0].State != StateLoginExpired {
				t.Fatalf("%+v", services)
			}
			skill := m.Skill(env, name)
			if !slices.Equal(skill.Kinds, []string{"files"}) || !strings.Contains(skill.Body, "`ms-files`") || strings.Contains(skill.Body, "ms-mail") || !strings.Contains(skill.Body, "no mailbox") || strings.Contains(skill.Body, "Outlook mail:") {
				t.Fatal(skill.Kinds, skill.Body)
			}
			if m.Misaligned(env, name) {
				t.Fatal("files-only registration seen as misaligned")
			}
			if err := m.Align(context.Background(), env, name, func() {}); err != nil {
				t.Fatal(err)
			}
			if got := areasOf(t, env, name); !slices.Equal(got, []string{"files"}) {
				t.Fatal("alignment changed the areas", got)
			}
			if _, err := microsoftBinding(env, name); err != nil {
				t.Fatal("files area does not run", err)
			}
		})
	}
}

// An answer that does not decide never takes tools away: a new connection
// gets its five areas as without the probe, and a files-only connection's
// renewal stays files-only rather than gaining mail tools that can only
// fail.
func TestMicrosoftMailboxProbeThatCannotDecide(t *testing.T) {
	defer func(d time.Duration) { microsoftMailboxProbeTimeout = d }(microsoftMailboxProbeTimeout)
	microsoftMailboxProbeTimeout = 50 * time.Millisecond
	for _, tc := range []struct {
		name   string
		answer inboxAnswer
	}{
		{"outage", inboxAnswer{status: 503, body: `{"error":{"code":"serviceNotAvailable"}}`}},
		{"refused", inboxAnswer{status: 403, body: `{"error":{"code":"ErrorAccessDenied"}}`}},
		{"throttled", inboxAnswer{status: 429, body: `{"error":{"code":"TooManyRequests"}}`}},
		{"another not found", inboxAnswer{status: 404, body: `{"error":{"code":"itemNotFound"}}`}},
		{"not found without a code", inboxAnswer{status: 404, body: `<html>gone</html>`}},
		{"no mailbox code on a success status", inboxAnswer{status: 200, body: `{"error":{"code":"MailboxNotEnabledForRESTAPI"}}`}},
		{"timeout", inboxAnswer{hang: true}},
	} {
		t.Run(tc.name, func(t *testing.T) {
			env := microsoftEnv(t)
			name, asked := mailboxSignIn(t, env, microsoftMailGrant, tc.answer, "")
			if asked != 1 {
				t.Fatal("inbox asked", asked)
			}
			if got := areasOf(t, env, name); !slices.Equal(got, allAreas) {
				t.Fatal("new connection", got)
			}

			guest := microsoftEnv(t)
			name, _ = mailboxSignIn(t, guest, microsoftMailGrant, inboxGuest, "")
			if renewed, _ := mailboxSignIn(t, guest, microsoftMailGrant, tc.answer, name); renewed != name {
				t.Fatal(renewed)
			}
			if got := areasOf(t, guest, name); !slices.Equal(got, []string{"files"}) {
				t.Fatal("renewal", got)
			}
		})
	}
}

// A grant without mail has no mailbox to ask about.
func TestMicrosoftMailboxNotAskedWithoutMail(t *testing.T) {
	env := microsoftEnv(t)
	name, asked := mailboxSignIn(t, env, "User.Read Files.ReadWrite.All Sites.ReadWrite.All Calendars.ReadWrite", inboxGuest, "")
	if asked != 0 {
		t.Fatal("inbox asked without a mail grant")
	}
	if got := areasOf(t, env, name); !slices.Equal(got, allAreas) {
		t.Fatal(got)
	}
}

// A guest whose organisation later gives them a mailbox gets the mail,
// calendar and contacts areas at their next sign-in, under the prefix the
// files area already had; and loses them again if a later sign-in finds the
// mailbox gone.
func TestMicrosoftConnectionGainsAMailbox(t *testing.T) {
	env := microsoftEnv(t)
	name, _ := mailboxSignIn(t, env, microsoftMailGrant, inboxGuest, "")
	if got := areasOf(t, env, name); !slices.Equal(got, []string{"files"}) {
		t.Fatal(got)
	}
	if renewed, asked := mailboxSignIn(t, env, microsoftMailGrant, inboxPresent, name); renewed != name || asked != 1 {
		t.Fatal(renewed, asked)
	}
	if got := areasOf(t, env, name); !slices.Equal(got, allAreas) {
		t.Fatal(got)
	}
	s, _, _ := microsoftServerOf(env, name)
	if s.areas["mail"] != "ms-mail" || s.areas["files"] != "ms-files" {
		t.Fatal(s.areas)
	}
	services, _ := checkWithGrant(t, env, name, microsoftMailGrant)
	if ids := serviceIDs(services); !slices.Contains(ids, "mail") {
		t.Fatal(ids)
	}
	if k := (&microsoft{}).Skill(env, name).Kinds; !slices.Contains(k, "mail") {
		t.Fatal(k)
	}
	mailboxSignIn(t, env, microsoftMailGrant, inboxGuest, name)
	if got := areasOf(t, env, name); !slices.Equal(got, []string{"files"}) {
		t.Fatal("mailbox gone", got)
	}
}

// A second connection does not take the prefix of a files-only one, whose
// other areas' names it keeps for a mailbox found later.
func TestMicrosoftFilesOnlyKeepsItsPrefix(t *testing.T) {
	env := microsoftEnv(t)
	name, _ := mailboxSignIn(t, env, microsoftMailGrant, inboxGuest, "")
	other := "other@example.test~" + testTenant
	if err := microsoftRegister(context.Background(), env, *env.Config.Microsoft, other, "User.Read", microsoftPin{username: "other@example.test"}, false); err != nil {
		t.Fatal(err)
	}
	if s, _, _ := microsoftServerOf(env, other); s.areas["mail"] != "ms2-mail" {
		t.Fatal(s.areas)
	}
	if s, _, _ := microsoftServerOf(env, name); s.index != 1 {
		t.Fatal(s.index)
	}
}

// The probe's outcome is journaled in fixed vocabulary for the proof with a
// real guest account; nothing of the person's is in it.
func TestMicrosoftMailboxProbeJournal(t *testing.T) {
	env := microsoftEnv(t)
	m := syntheticMicrosoft(t, "person@example.test", "")
	microsoftGrantToken(t, m, microsoftMailGrant, true)
	base := m.client.Transport
	m.client.Transport = dropboxTransport(func(r *http.Request) (*http.Response, error) {
		if r.URL.Path == "/v1.0/me/mailFolders/inbox" {
			return &http.Response{StatusCode: inboxGuest.status, Header: make(http.Header), Body: io.NopCloser(strings.NewReader(inboxGuest.body))}, nil
		}
		return base.RoundTrip(r)
	})
	l := msLogin(t, m, env, "")
	var journal bytes.Buffer
	l.log = slog.New(slog.NewJSONHandler(&journal, nil))
	if _, err := l.WaitWithPrompt(context.Background(), func(Prompt) error { return nil }); err != nil {
		t.Fatal(err)
	}
	want := fmt.Sprintf(`"transition":"mailbox_probe","mailbox":"absent","http_status":404,"graph_code":%q`, "MailboxNotEnabledForRESTAPI")
	if !strings.Contains(journal.String(), want) || strings.Contains(journal.String(), "person@") || strings.Contains(journal.String(), "on-premise") {
		t.Fatal(journal.String())
	}
}
