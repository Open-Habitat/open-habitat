//go:build linux

package gateway

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net"
	"net/http"
	"regexp"
	"slices"
	"sort"
	"strings"
	"time"
	"unicode"

	"github.com/open-habitat/open-habitat/internal/jsoncheck"
	"github.com/open-habitat/open-habitat/internal/udssecure"
)

// Other people in a person's conversation (ADR 0038 section 7), the owner's
// side. The owner's own session reads the record, picks people to invite and
// changes their roles. The gateway's part is narrow: it names people, it
// never decides what they may do. An invitee must be an admitted person with
// a bound account, and the gateway supplies the display name itself; the
// owner's daemon keeps the record and is the only authority over it.

var conversationMembersPath = regexp.MustCompile(`^/api/v1/conversations/([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})/(members|people)$`)

var memberSubject = regexp.MustCompile(`^github:([0-9]{1,20})$`)

const memberControlLimit = 1024

func (a *Auth) conversationMembers(w http.ResponseWriter, r *http.Request, match []string) {
	people := match[2] == "people"
	if !a.exact(r, r.URL.Path) || (r.Method != http.MethodGet && (people || r.Method != http.MethodPost)) || (r.Method == http.MethodGet && (r.ContentLength > 0 || len(r.TransferEncoding) != 0)) {
		safe(w, 400, "invalid_request")
		return
	}
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	if r.Method == http.MethodPost {
		if denied := a.authorizeWrite(r, s); denied != "" {
			safe(w, 403, denied)
			return
		}
	}
	switch {
	case people:
		a.invitePeople(w, r, s, match[1])
	case r.Method == http.MethodGet:
		a.proxy(w, r, s, false)
	default:
		a.changeMember(w, r, s, match[1])
	}
}

type memberPerson struct {
	Subject     string `json:"subject"`
	DisplayName string `json:"display_name"`
	AvatarURL   string `json:"avatar_url"`
	Membership  string `json:"membership"`
}

// invitablePeople lists every other admitted person whose account is bound,
// by the name and avatar the gateway shows for them. Accepted for people on
// the same server (ADR 0038 question 5; Jari: every signed-in person). The
// broker's access list names the admitted people of an allowlist; a server
// that admits anyone has no such list, so everyone who holds a session here
// is listed too: a session exists only for a person whose binding the broker
// authorized at sign-in, and withdrawal removes it.
func (a *Auth) invitablePeople(ctx context.Context, self Identity) ([]memberPerson, error) {
	broker, ok := a.accessBroker()
	if !ok {
		return nil, errBrokerRead
	}
	page, err := broker.AccessList(ctx)
	if err != nil {
		return nil, errBrokerRead
	}
	names := a.profileNames()
	a.mu.Lock()
	denied := slices.Clone(a.settings.Denied)
	a.mu.Unlock()
	people := []memberPerson{}
	for _, row := range page.Rows {
		if row.State != "joined" || row.ID == self.Subject || slices.Contains(denied, row.ID) || !numericSubject(row.ID) {
			continue
		}
		name := names[row.ID]
		if name == "" {
			name = row.LoginHint
		}
		if name == "" {
			name = "GitHub " + row.ID
		}
		people = append(people, memberPerson{Subject: "github:" + row.ID, DisplayName: memberName(name), AvatarURL: githubAvatar(row.ID), Membership: "none"})
	}
	listed := map[string]bool{}
	for _, p := range people {
		listed[p.Subject] = true
	}
	for _, id := range a.signedInPeople() {
		if id == self.Subject || listed["github:"+id] || slices.Contains(denied, id) || !numericSubject(id) {
			continue
		}
		listed["github:"+id] = true
		name := names[id]
		if name == "" {
			name = "GitHub " + id
		}
		people = append(people, memberPerson{Subject: "github:" + id, DisplayName: memberName(name), AvatarURL: githubAvatar(id), Membership: "none"})
	}
	sort.Slice(people, func(i, j int) bool { return people[i].Subject < people[j].Subject })
	return people, nil
}

// signedInPeople are the GitHub subjects that hold an unexpired session.
func (a *Auth) signedInPeople() []string {
	a.mu.Lock()
	defer a.mu.Unlock()
	now := a.now()
	seen := map[string]bool{}
	out := []string{}
	for _, s := range a.sessions {
		if s.identity.Provider != "github" || !now.Before(s.idle) || !now.Before(s.absolute) || seen[s.identity.Subject] || a.deniedLocked(s.identity.Subject) {
			continue
		}
		seen[s.identity.Subject] = true
		out = append(out, s.identity.Subject)
	}
	return out
}

func numericSubject(id string) bool {
	return memberSubject.MatchString("github:" + id)
}

// memberName makes a profile name one line the daemon accepts: printable,
// trimmed and at most 100 characters.
func memberName(s string) string {
	var out []rune
	for _, r := range s {
		if unicode.IsControl(r) || unicode.Is(unicode.Cf, r) || r == 0x2028 || r == 0x2029 {
			r = ' '
		}
		out = append(out, r)
		if len(out) == 100 {
			break
		}
	}
	return strings.TrimSpace(string(out))
}

// profileNames is the newest live session's profile name for each subject.
// The gateway keeps no directory of its own: a person who has no live
// session is shown by their GitHub login.
func (a *Auth) profileNames() map[string]string {
	a.mu.Lock()
	defer a.mu.Unlock()
	names := map[string]string{}
	newest := map[string]time.Time{}
	now := a.now()
	for _, s := range a.sessions {
		if !now.Before(s.idle) || !now.Before(s.absolute) || s.profile.Name == "" {
			continue
		}
		if s.created.After(newest[s.identity.Subject]) || names[s.identity.Subject] == "" {
			newest[s.identity.Subject] = s.created
			names[s.identity.Subject] = s.profile.Name
		}
	}
	return names
}

type daemonMembers struct {
	Members []struct {
		Subject string `json:"subject"`
		State   string `json:"state"`
	} `json:"members"`
}

// invitePeople answers the picker. It first reads the owner's record, which
// also answers whether the feature is on and the conversation exists, so a
// person sees the directory only while inviting into a conversation of
// their own.
func (a *Auth) invitePeople(w http.ResponseWriter, r *http.Request, s session, id string) {
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	status, body, err := a.daemonSend(ctx, s.identity, http.MethodGet, "/api/v1/conversations/"+id+"/members", nil)
	if err != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	if status != 200 {
		relayDaemonError(w, status, body)
		return
	}
	var record daemonMembers
	if json.Unmarshal(body, &record) != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	people, err := a.invitablePeople(ctx, s.identity)
	if err != nil {
		safe(w, 503, "people_unavailable")
		return
	}
	for i := range people {
		for _, m := range record.Members {
			if m.Subject == people[i].Subject && (m.State == "invited" || m.State == "joined") {
				people[i].Membership = m.State
			}
		}
	}
	writeJSON(w, map[string]any{"schema_version": 1, "agent_id": "pi:" + id, "people": people})
}

func (a *Auth) changeMember(w http.ResponseWriter, r *http.Request, s session, id string) {
	if r.Header.Get("Content-Type") != "application/json" || r.ContentLength <= 0 || r.ContentLength > memberControlLimit || len(r.TransferEncoding) != 0 {
		safe(w, 400, "invalid_request")
		return
	}
	raw, err := io.ReadAll(io.LimitReader(r.Body, memberControlLimit+1))
	var in struct {
		Action  string `json:"action"`
		Subject string `json:"subject"`
	}
	dec := json.NewDecoder(bytes.NewReader(raw))
	dec.DisallowUnknownFields()
	if err != nil || int64(len(raw)) != r.ContentLength || !jsoncheck.NoDuplicates(raw) || dec.Decode(&in) != nil || dec.More() || !memberSubject.MatchString(in.Subject) {
		safe(w, 400, "invalid_request")
		return
	}
	out := map[string]string{"action": in.Action, "subject": in.Subject}
	switch in.Action {
	case "full_rights", "take_back", "remove":
	case "invite":
		ctx, cancel := context.WithTimeout(r.Context(), 10*time.Second)
		people, err := a.invitablePeople(ctx, s.identity)
		cancel()
		if err != nil {
			safe(w, 503, "people_unavailable")
			return
		}
		found := false
		for _, p := range people {
			if p.Subject == in.Subject {
				out["display_name"], found = p.DisplayName, true
			}
		}
		if !found {
			// Not an admitted, bound person here (or the owner): the same
			// answer whichever, so the route is no probe of accounts.
			safe(w, 404, "person_not_found")
			return
		}
	default:
		safe(w, 400, "invalid_request")
		return
	}
	body, _ := json.Marshal(out)
	ctx, cancel := context.WithTimeout(r.Context(), 15*time.Second)
	defer cancel()
	status, reply, err := a.daemonSend(ctx, s.identity, http.MethodPost, "/api/v1/conversations/"+id+"/members", body)
	if err != nil {
		safe(w, 503, "daemon_unavailable")
		return
	}
	if status != 200 {
		relayDaemonError(w, status, reply)
		return
	}
	// The index follows the record: an invitation gets its share, a removal
	// loses it and ends that participant's relays. The daemon's change
	// already holds; if the index cannot follow, an invitation does not
	// route yet (the owner invites again) and a removal is already refused
	// by the owner's daemon.
	if err := a.reconcileShare(s, id, in.Subject, reply); err != nil {
		safe(w, 503, "shares_unavailable")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(200)
	_, _ = w.Write(reply)
}

// relayDaemonError passes on the daemon's fixed refusal code and nothing else.
func relayDaemonError(w http.ResponseWriter, status int, body []byte) {
	var e struct {
		Error struct {
			Code string `json:"code"`
		} `json:"error"`
	}
	if status < 400 || status > 599 || json.Unmarshal(body, &e) != nil || !memberErrorCode.MatchString(e.Error.Code) {
		safe(w, 503, "daemon_unavailable")
		return
	}
	safe(w, status, e.Error.Code)
}

var memberErrorCode = regexp.MustCompile(`^[a-z][a-z_]{0,63}$`)

// daemonSend makes one request the gateway built itself to target's daemon
// and reads a bounded reply.
func (a *Auth) daemonSend(ctx context.Context, target Identity, method, path string, body []byte) (int, []byte, error) {
	if a.snapshotDial == nil && udssecure.Mapped(target.Socket, target.UID) != nil {
		return 0, nil, errors.New("daemon socket not mapped")
	}
	transport := &http.Transport{
		DisableKeepAlives:      true,
		MaxResponseHeaderBytes: 16 << 10,
		DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
			return a.dialDaemon(ctx, target)
		},
	}
	defer transport.CloseIdleConnections()
	var reader io.Reader = http.NoBody
	if body != nil {
		reader = bytes.NewReader(body)
	}
	req, err := http.NewRequestWithContext(ctx, method, "http://unix"+path, reader)
	if err != nil {
		return 0, nil, err
	}
	if body != nil {
		req.ContentLength = int64(len(body))
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := transport.RoundTrip(req)
	if err != nil {
		return 0, nil, err
	}
	defer res.Body.Close()
	b, err := io.ReadAll(io.LimitReader(res.Body, 64<<10+1))
	if err != nil || len(b) > 64<<10 {
		return 0, nil, errors.New("daemon reply unreadable")
	}
	return res.StatusCode, b, nil
}
