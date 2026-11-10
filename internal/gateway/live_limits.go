package gateway

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/open-habitat/open-habitat/internal/livelimits"
)

// Limits on conversations working at once (live-conversation-limit-admin).
// The root broker writes them into the installation's live-limits file, which
// every person's daemon reads for its own UID; the gateway's part is the
// administrator check and the relay, the pattern of the integration app
// sections. The gateway names a person by provider subject and never a UID.
//
// The view carries limits and the host's memory only. How many conversations
// another person has working is known only to that person's daemon, and no
// route here asks it (Jari's decision pending): the administrator's estimate
// is computed from the limits alone.

// LiveLimits is the broker's page: the installation's limit (0: none set,
// each daemon uses livelimits.HostDefault) and the exceptions of committed
// bindings.
type LiveLimits struct {
	Default int
	People  []LiveLimitPerson
}
type LiveLimitPerson struct {
	ID    string `json:"id"`
	Limit int    `json:"limit"`
}

// LiveLimitsBroker is the broker's live-limit surface. subject "" is the
// installation's limit; limit 0 clears. Set returns ErrLiveLimitUncertain
// when no definite reply arrived and ErrBoundUserNotFound for a subject
// without a committed binding.
type LiveLimitsBroker interface {
	LiveLimits(context.Context) (LiveLimits, error)
	SetLiveLimit(ctx context.Context, subject string, limit int) (LiveLimits, error)
}

var ErrLiveLimitUncertain = errors.New("live limit change outcome uncertain")

const liveLimitsPath = "/api/v1/server/conversations"

// Memory is the host's memory now, read from /proc/meminfo: a fact about the
// whole machine that names nobody.
type Memory struct {
	TotalBytes     uint64 `json:"total_bytes"`
	AvailableBytes uint64 `json:"available_bytes"`
}

var readMemory = func() (Memory, bool) {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return Memory{}, false
	}
	defer f.Close()
	b, err := io.ReadAll(io.LimitReader(f, 64<<10))
	if err != nil {
		return Memory{}, false
	}
	return parseMeminfo(b)
}

func parseMeminfo(b []byte) (Memory, bool) {
	var m Memory
	var total, available bool
	s := bufio.NewScanner(bytes.NewReader(b))
	for s.Scan() {
		fields := strings.Fields(s.Text())
		if len(fields) != 3 || fields[2] != "kB" {
			continue
		}
		n, err := strconv.ParseUint(fields[1], 10, 64)
		if err != nil || n > maxJSONQuota>>10 {
			continue
		}
		switch fields[0] {
		case "MemTotal:":
			m.TotalBytes, total = n<<10, true
		case "MemAvailable:":
			m.AvailableBytes, available = n<<10, true
		}
	}
	if !total || !available || m.TotalBytes == 0 || m.AvailableBytes > m.TotalBytes {
		return Memory{}, false
	}
	return m, true
}

type liveLimitsView struct {
	SchemaVersion int               `json:"schema_version"`
	DefaultLimit  *int              `json:"default_limit"`
	HostDefault   int               `json:"host_default"`
	MaxLimit      int               `json:"max_limit"`
	ChildBytes    uint64            `json:"child_bytes"`
	Memory        *Memory           `json:"memory"`
	People        []LiveLimitPerson `json:"people"`
}

func liveView(l LiveLimits) (liveLimitsView, error) {
	v := liveLimitsView{SchemaVersion: 1, HostDefault: livelimits.HostDefault, MaxLimit: livelimits.Max, ChildBytes: livelimits.ChildBytes, People: []LiveLimitPerson{}}
	if l.Default != 0 {
		if !livelimits.Valid(l.Default) {
			return liveLimitsView{}, errBrokerRead
		}
		d := l.Default
		v.DefaultLimit = &d
	}
	if len(l.People) > livelimits.MaxPeople {
		return liveLimitsView{}, errBrokerRead
	}
	seen := map[string]bool{}
	for _, p := range l.People {
		if !canonicalSubject(p.ID) || !livelimits.Valid(p.Limit) || seen[p.ID] {
			return liveLimitsView{}, errBrokerRead
		}
		seen[p.ID] = true
		v.People = append(v.People, p)
	}
	if m, ok := readMemory(); ok {
		v.Memory = &m
	}
	return v, nil
}

func (a *Auth) liveLimitsBroker() (LiveLimitsBroker, bool) {
	b, ok := a.broker.(LiveLimitsBroker)
	return b, ok
}

// setLiveLimit writes one limit for an administrator; the role is checked as
// current, under the writer lock, as storage limits are.
func (a *Auth) setLiveLimit(ctx context.Context, caller, subject string, limit int) (liveLimitsView, error) {
	if subject != "" && !canonicalSubject(subject) || limit != 0 && !livelimits.Valid(limit) {
		return liveLimitsView{}, errors.New("invalid live limit")
	}
	broker, ok := a.liveLimitsBroker()
	if !ok {
		return liveLimitsView{}, errBrokerRead
	}
	a.mu.Lock()
	defer a.mu.Unlock()
	if !a.administrationHealthy() {
		return liveLimitsView{}, ErrAdministrationState
	}
	if !a.isAdministratorLocked(caller) {
		return liveLimitsView{}, errAdminDenied
	}
	l, err := broker.SetLiveLimit(ctx, subject, limit)
	if errors.Is(err, ErrLiveLimitUncertain) {
		a.log.Warn("live_limit", "outcome", "uncertain", "reason", "broker_reply_missing", "actor", actorFor(caller))
		return liveLimitsView{}, err
	}
	if err != nil {
		return liveLimitsView{}, err
	}
	a.log.Info("live_limit", "outcome", "accepted", "actor", actorFor(caller))
	return liveView(l)
}

// liveLimitsHTTP serves the administrator's view and its one write: PUT
// {"subject"?: id, "limit": n | null}. No subject is the installation's
// limit; null removes it.
func (a *Auth) liveLimitsHTTP(w http.ResponseWriter, r *http.Request) {
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	if !a.exact(r, liveLimitsPath) || r.URL.Path != liveLimitsPath {
		safe(w, 400, "invalid_request")
		return
	}
	if !a.isAdministrator(s.identity.Subject) {
		safe(w, 403, "admin_required")
		return
	}
	reply := func(v liveLimitsView, err error) {
		switch {
		case errors.Is(err, errAdminDenied):
			safe(w, 403, "admin_required")
		case errors.Is(err, ErrBoundUserNotFound):
			safe(w, 404, "not_found")
		case errors.Is(err, ErrLiveLimitUncertain):
			safe(w, 503, "outcome_uncertain")
		case err != nil:
			safe(w, 503, "broker_unavailable")
		default:
			w.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(w).Encode(v)
		}
	}
	if r.Method == http.MethodGet {
		broker, ok := a.liveLimitsBroker()
		if !ok {
			safe(w, 503, "broker_unavailable")
			return
		}
		l, err := broker.LiveLimits(r.Context())
		if err != nil {
			safe(w, 503, "broker_unavailable")
			return
		}
		reply(liveView(l))
		return
	}
	if r.Method != http.MethodPut {
		safe(w, 405, "method_not_allowed")
		return
	}
	if reason := a.authorizeWrite(r, s); reason != "" {
		safe(w, 403, reason)
		return
	}
	var input struct {
		Subject *string         `json:"subject"`
		Limit   json.RawMessage `json:"limit"`
	}
	dec := json.NewDecoder(io.LimitReader(r.Body, 257))
	dec.DisallowUnknownFields()
	limit := 0
	valid := r.Header.Get("Content-Type") == "application/json" && dec.Decode(&input) == nil && dec.Decode(new(any)) == io.EOF && len(input.Limit) > 0 && (input.Subject == nil || canonicalSubject(*input.Subject))
	if valid && string(input.Limit) != "null" {
		valid = json.Unmarshal(input.Limit, &limit) == nil && livelimits.Valid(limit)
	}
	if !valid {
		safe(w, 400, "invalid_request")
		return
	}
	subject := ""
	if input.Subject != nil {
		subject = *input.Subject
	}
	reply(a.setLiveLimit(r.Context(), s.identity.Subject, subject, limit))
}
