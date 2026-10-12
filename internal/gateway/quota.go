package gateway

import (
	"context"
	"encoding/json"
	"errors"
	"io"
	"math"
	"net/http"
)

// Quota is native broker-reported quota state, never gateway-accounted usage.
type Quota struct {
	UsageBytes uint64 `json:"usage_bytes"`
	LimitBytes uint64 `json:"limit_bytes"`
}
type QuotaFilesystem struct {
	CapacityBytes uint64 `json:"capacity_bytes"`
	FreeBytes     uint64 `json:"free_bytes"`
}

// BrokerQuota accepts only authenticated provider subjects. The broker resolves
// the binding to a UID; the gateway never sends a UID or a home path.
type BrokerQuota interface {
	ReadQuota(context.Context, string) (Quota, QuotaFilesystem, error)
	SetQuota(context.Context, string, uint64) error
}

const maxJSONQuota = uint64(9007199254740991) // exact in browser numbers
const maxNativeLimit = uint64(1 << 50)

func validQuotaLimit(n uint64) bool { return n >= 1<<20 && n <= maxNativeLimit && n%1024 == 0 }
func boolInt(b bool) int {
	if b {
		return 1
	}
	return 0
}

type quotaUser struct {
	BoundUser
	Quota
	Administrator bool `json:"administrator"`
}

func (a *Auth) quotaUsers(ctx context.Context) ([]byte, error) {
	if !a.administrationAvailable() {
		return nil, ErrAdministrationState
	}
	reader, ok := a.broker.(BrokerReader)
	if !ok {
		return nil, errBrokerRead
	}
	quotas, ok := a.broker.(BrokerQuota)
	if !ok {
		return nil, errBrokerRead
	}
	users, err := reader.ListBound(ctx)
	if err != nil {
		return nil, errBrokerRead
	}
	rows := make([]quotaUser, 0, len(users))
	var fs QuotaFilesystem
	var sum uint64
	for _, u := range users {
		if !canonicalSubject(u.ID) {
			return nil, errBrokerRead
		}
		q, disk, err := quotas.ReadQuota(ctx, u.ID)
		if err != nil || !validQuotaLimit(q.LimitBytes) || q.UsageBytes > maxJSONQuota || disk.CapacityBytes == 0 || disk.CapacityBytes > maxJSONQuota || disk.FreeBytes > disk.CapacityBytes {
			return nil, errBrokerRead
		}
		if len(rows) > 0 && disk.CapacityBytes != fs.CapacityBytes {
			return nil, errBrokerRead
		}
		if len(rows) == 0 {
			fs = disk // free space is a point-in-time observation, not a stable value
		}
		// Saturate only the comparison: overcommit is allowed, not an error.
		if math.MaxUint64-sum < q.LimitBytes {
			sum = math.MaxUint64
		} else {
			sum += q.LimitBytes
		}
		rows = append(rows, quotaUser{BoundUser: u, Quota: q, Administrator: a.isAdministrator(u.ID)})
	}
	if len(rows) == 0 {
		return nil, errBrokerRead
	} // no filesystem report to trust
	return json.Marshal(struct {
		SchemaVersion int             `json:"schema_version"`
		Users         []quotaUser     `json:"users"`
		Filesystem    QuotaFilesystem `json:"filesystem"`
		Overcommitted bool            `json:"overcommitted"`
	}{1, rows, fs, sum > fs.CapacityBytes})
}
func (a *Auth) setQuota(ctx context.Context, caller, subject string, limit uint64) error {
	if !canonicalSubject(subject) || !validQuotaLimit(limit) {
		return errors.New("invalid quota request")
	}
	// Hold the writer lock across authorization and the broker write so that a
	// concurrent role removal cannot leave a stale administrator with write access.
	a.mu.Lock()
	defer a.mu.Unlock()
	if !a.administrationHealthy() {
		return ErrAdministrationState
	}
	if caller != "" && !a.isAdministratorLocked(caller) {
		return errAdminDenied
	}
	broker, ok := a.broker.(BrokerQuota)
	if !ok {
		return errBrokerRead
	}
	if err := broker.SetQuota(ctx, subject, limit); err != nil {
		if errors.Is(err, ErrBoundUserNotFound) {
			return errBindingNotFound
		}
		return errBrokerRead
	}
	return nil
}
func (a *Auth) quotaHTTP(w http.ResponseWriter, r *http.Request) {
	s, ok := a.authenticated(r)
	if !ok {
		safe(w, 401, "authentication_required")
		return
	}
	w.Header().Set("Cache-Control", "no-store")
	if !a.exact(r, r.URL.Path) {
		safe(w, 400, "invalid_request")
		return
	}
	if r.URL.Path == "/api/v1/account/storage" {
		if r.Method != http.MethodGet {
			safe(w, 405, "method_not_allowed")
			return
		}
		broker, ok := a.broker.(BrokerQuota)
		if !ok {
			safe(w, 503, "broker_unavailable")
			return
		}
		q, _, err := broker.ReadQuota(r.Context(), s.identity.Subject)
		if err != nil || !validQuotaLimit(q.LimitBytes) || q.UsageBytes > maxJSONQuota {
			safe(w, 503, "broker_unavailable")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(struct {
			SchemaVersion int `json:"schema_version"`
			Quota
		}{1, q})
		return
	}
	if !a.isAdministrator(s.identity.Subject) {
		safe(w, 403, "admin_required")
		return
	}
	if r.Method == http.MethodGet {
		b, err := a.quotaUsers(r.Context())
		if err != nil {
			safe(w, 503, "broker_unavailable")
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_, _ = w.Write(b)
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
	if r.Header.Get("Content-Type") != "application/json" {
		safe(w, 400, "invalid_request")
		return
	}
	var input struct {
		Subject    string  `json:"subject"`
		LimitBytes *uint64 `json:"limit_bytes"`
	}
	dec := json.NewDecoder(io.LimitReader(r.Body, 1025))
	dec.DisallowUnknownFields()
	if dec.Decode(&input) != nil || dec.Decode(new(any)) != io.EOF || input.LimitBytes == nil || !canonicalSubject(input.Subject) || !validQuotaLimit(*input.LimitBytes) {
		safe(w, 400, "invalid_request")
		return
	}
	err := a.setQuota(r.Context(), s.identity.Subject, input.Subject, *input.LimitBytes)
	if errors.Is(err, errAdminDenied) {
		safe(w, 403, "admin_required")
		return
	}
	if errors.Is(err, errBindingNotFound) {
		safe(w, 404, "not_found")
		return
	}
	if err != nil {
		safe(w, 503, "broker_unavailable")
		return
	}
	w.WriteHeader(http.StatusNoContent)
}
