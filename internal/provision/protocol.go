// Package provision contains inert policy and wire validation for a future
// root-only broker. Nothing here starts a listener or provisions an account.
package provision

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"strconv"
)

const MaxMessage = 4096

var ErrInvalid = errors.New("invalid broker data")

// Failure is a closed vocabulary; messages and credentials never cross this boundary.
type Failure string

const (
	Denied           Failure = "denied"
	Invalid          Failure = "invalid_request"
	StateUnavailable Failure = "state_unavailable"
	NameCollision    Failure = "name_collision"
	Drift            Failure = "drift"
	// Runtime admission refusals: the switch is off, the runtime set is full,
	// the installation admits anyone, or the id belongs to the operator source.
	RuntimeDisabled Failure = "runtime_admission_disabled"
	RuntimeFull     Failure = "runtime_admission_full"
	AdmissionOpen   Failure = "admission_open"
	OperatorOwned   Failure = "operator_owned"
	// QuotaNotInUse refuses a limit change on an installation without user quotas.
	QuotaNotInUse Failure = "quota_not_in_use"
)

type Request struct {
	Version           int     `json:"version"`
	Operation         string  `json:"operation"`
	Provider          string  `json:"provider"`
	ID                string  `json:"id"`
	Candidate         string  `json:"candidate,omitempty"`
	DefaultLimitBytes *uint64 `json:"default_limit_bytes,omitempty"`
	LimitBytes        *uint64 `json:"limit_bytes,omitempty"`
	LoginHint         string  `json:"login_hint,omitempty"`
	Actor             string  `json:"actor,omitempty"`
	// Fields is an integration app section; only set_integration_app has it.
	Fields map[string]string `json:"fields,omitempty"`
	// Slug names a team inside the organisation ID names (team_add,
	// team_remove); Teams is one sign-in's observations (team_sign_in).
	Slug  string            `json:"slug,omitempty"`
	Teams []TeamObservation `json:"teams,omitempty"`
}
type Route struct {
	UID      uint32 `json:"uid"`
	Username string `json:"username"`
	Socket   string `json:"socket"`
}
type BoundUser struct {
	ID       string `json:"id"`
	Username string `json:"username"`
}

// NotInUse marks an installation without user quotas: usage and limit are
// then zero, not an observation, and only the filesystem figures are real.
type QuotaReply struct {
	UsageBytes    uint64 `json:"usage_bytes"`
	LimitBytes    uint64 `json:"limit_bytes"`
	CapacityBytes uint64 `json:"capacity_bytes"`
	FreeBytes     uint64 `json:"free_bytes"`
	NotInUse      bool   `json:"not_in_use,omitempty"`
}

// Quota pages contain only committed bindings and native quota observations.
// Unavailable rows carry no native error text or guessed usage.
type QuotaRow struct {
	BoundUser
	UsageBytes  uint64 `json:"usage_bytes"`
	LimitBytes  uint64 `json:"limit_bytes"`
	Unavailable bool   `json:"unavailable"`
}
type QuotaPage struct {
	Rows          []QuotaRow `json:"rows"`
	CapacityBytes uint64     `json:"capacity_bytes"`
	FreeBytes     uint64     `json:"free_bytes"`
	// NotInUse pages carry no rows: there are no per-user limits to list.
	NotInUse bool `json:"not_in_use,omitempty"`
}

const QuotaPageSize = 15

type Reply struct {
	Access       *AccessPage      `json:"access,omitempty"`
	Integrations *IntegrationPage `json:"integrations,omitempty"`
	Quotas       *QuotaPage       `json:"quotas,omitempty"`
	Quota        *QuotaReply      `json:"quota,omitempty"`
	Users        *[]BoundUser     `json:"users,omitempty"`
	Next         string           `json:"next,omitempty"`
	Version      int              `json:"version"`
	Failure      Failure          `json:"failure,omitempty"`
	Route        *Route           `json:"route,omitempty"`
	Generation   uint64           `json:"generation,omitempty"`
	Epoch        uint64           `json:"epoch,omitempty"`
	// Created is true only in the ensure reply whose call committed the
	// binding (ADR 0030). It is not stored: once the binding exists no later
	// ensure, failed handoff or broker restart can report it again.
	Created bool `json:"created,omitempty"`
}

func numericID(id string) bool {
	n, err := strconv.ParseUint(id, 10, 64)
	return err == nil && n > 0 && strconv.FormatUint(n, 10) == id
}
func numericOffset(s string) bool {
	if s == "0" {
		return true
	}
	return numericID(s) && len(s) < 5
}
func username(s string) bool {
	if len(s) < 1 || len(s) > 32 || s[0] < 'a' || s[0] > 'z' {
		return false
	}
	for _, c := range s[1:] {
		if !(c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '_' || c == '-') {
			return false
		}
	}
	return true
}

// A GitHub handle is candidate data, not a Unix name. Permit the provider's
// bounded ASCII syntax; the writer decides whether it is a safe local name or
// requires an operator-approved alternate. Existing bindings ignore renames.
func githubLogin(s string) bool {
	if len(s) < 1 || len(s) > 39 {
		return false
	}
	for _, c := range s {
		if !(c >= 'a' && c <= 'z' || c >= 'A' && c <= 'Z' || c >= '0' && c <= '9' || c == '-') {
			return false
		}
	}
	return true
}
func socketFor(name string) string { return "/run/open-habitat/users/" + name + "/daemon.sock" }

// object rejects duplicate and unknown fields before any typed decode.
func object(b []byte, fields ...string) (map[string]json.RawMessage, error) {
	return objectSized(b, MaxMessage, fields...)
}
func objectSized(b []byte, limit int, fields ...string) (map[string]json.RawMessage, error) {
	if len(b) == 0 || len(b) > limit {
		return nil, ErrInvalid
	}
	allowed := make(map[string]bool, len(fields))
	for _, f := range fields {
		allowed[f] = true
	}
	d := json.NewDecoder(bytes.NewReader(b))
	d.UseNumber()
	t, err := d.Token()
	if err != nil || t != json.Delim('{') {
		return nil, ErrInvalid
	}
	out := make(map[string]json.RawMessage)
	for d.More() {
		t, err = d.Token()
		if err != nil {
			return nil, ErrInvalid
		}
		k, ok := t.(string)
		if !ok || !allowed[k] {
			return nil, ErrInvalid
		}
		if _, exists := out[k]; exists {
			return nil, ErrInvalid
		}
		var v json.RawMessage
		if d.Decode(&v) != nil {
			return nil, ErrInvalid
		}
		out[k] = v
	}
	t, err = d.Token()
	if err != nil || t != json.Delim('}') {
		return nil, ErrInvalid
	}
	if _, err = d.Token(); err != io.EOF {
		return nil, ErrInvalid
	}
	return out, nil
}
func decode(b []byte, dst any, fields ...string) error {
	if _, err := object(b, fields...); err != nil {
		return err
	}
	if json.Unmarshal(b, dst) != nil {
		return ErrInvalid
	}
	return nil
}
func validLimit(n uint64) bool { return n >= 1<<20 && n <= 1<<50 && n%1024 == 0 }

func ParseRequest(b []byte) (Request, error) {
	var r Request
	raw, err := object(b, "version", "operation", "provider", "id", "candidate", "default_limit_bytes", "limit_bytes", "login_hint", "actor", "fields", "slug", "teams")
	if err != nil {
		return Request{}, err
	}
	for _, key := range []string{"version", "operation", "provider", "id"} {
		if len(raw[key]) == 0 || string(raw[key]) == "null" {
			return Request{}, ErrInvalid
		}
	}
	if err := json.Unmarshal(b, &r); err != nil {
		return Request{}, ErrInvalid
	}
	if integrationOperation(r.Operation) {
		return parseIntegrationRequest(raw, r)
	}
	if _, ok := raw["fields"]; ok {
		return Request{}, ErrInvalid
	}
	if accessOperation(r.Operation) {
		return parseAccessRequest(raw, r)
	}
	if _, ok := raw["slug"]; ok {
		return Request{}, ErrInvalid
	}
	if _, ok := raw["teams"]; ok {
		return Request{}, ErrInvalid
	}
	if _, ok := raw["login_hint"]; ok {
		return Request{}, ErrInvalid
	}
	if _, ok := raw["actor"]; ok {
		return Request{}, ErrInvalid
	}
	_, candidatePresent := raw["candidate"]
	if r.Operation == "ensure" && (!candidatePresent || string(raw["candidate"]) == "null") || r.Operation != "ensure" && r.Operation != "list" && r.Operation != "quota_list" && candidatePresent || (r.Operation == "list" || r.Operation == "quota_list") && candidatePresent && !numericOffset(r.Candidate) {
		return Request{}, ErrInvalid
	}
	if _, ok := raw["default_limit_bytes"]; ok && (r.Operation != "ensure" || r.DefaultLimitBytes == nil || !validLimit(*r.DefaultLimitBytes)) {
		return Request{}, ErrInvalid
	}
	if _, ok := raw["limit_bytes"]; ok && (r.Operation != "quota_set" || r.LimitBytes == nil || !validLimit(*r.LimitBytes)) {
		return Request{}, ErrInvalid
	}
	if r.Operation == "quota_set" && r.LimitBytes == nil {
		return Request{}, ErrInvalid
	}
	if r.Version != 1 || r.Provider != "github" || ((r.Operation == "list" || r.Operation == "quota_list") && r.ID != "0") || (!numericID(r.ID) && !((r.Operation == "list" || r.Operation == "quota_list") && r.ID == "0")) || (r.Operation != "ensure" && r.Operation != "authorize" && r.Operation != "lookup" && r.Operation != "list" && r.Operation != "quota_read" && r.Operation != "quota_set" && r.Operation != "quota_list") || (r.Operation == "ensure" && !githubLogin(r.Candidate)) {
		return Request{}, ErrInvalid
	}
	return r, nil
}
func ParseReply(b []byte) (Reply, error) {
	var r Reply
	if err := decode(b, &r, "version", "failure", "route", "generation", "epoch", "users", "next", "quota", "quotas", "access", "created", "integrations"); err != nil {
		return Reply{}, err
	}
	if r.Version != 1 {
		return Reply{}, ErrInvalid
	}
	raw, _ := object(b, "version", "failure", "route", "generation", "epoch", "users", "next", "quota", "quotas", "access", "created", "integrations")
	// created exists only as true on a route reply; false is never written.
	if _, present := raw["created"]; present && (!r.Created || len(raw["route"]) == 0 || string(raw["route"]) == "null") {
		return Reply{}, ErrInvalid
	}
	if len(raw["version"]) == 0 {
		return Reply{}, ErrInvalid
	}
	if _, present := raw["failure"]; present && r.Failure == "" {
		return Reply{}, ErrInvalid
	}
	if r.Failure != "" {
		switch r.Failure {
		case Denied, Invalid, StateUnavailable, NameCollision, Drift, RuntimeDisabled, RuntimeFull, AdmissionOpen, OperatorOwned, BrowserSetupOff, HostBusy, IntegrationsFile, QuotaNotInUse:
		default:
			return Reply{}, ErrInvalid
		}
		if r.Route != nil || r.Generation != 0 || r.Epoch != 0 || r.Users != nil || r.Next != "" || (len(raw["quota"]) != 0 || len(raw["quotas"]) != 0 || len(raw["access"]) != 0 || len(raw["integrations"]) != 0) {
			return Reply{}, ErrInvalid
		}
		return r, nil
	}
	if len(raw["integrations"]) != 0 {
		return parseIntegrationReply(raw, r)
	}
	if r.Integrations != nil {
		return Reply{}, ErrInvalid
	}
	if len(raw["access"]) != 0 {
		return parseAccessReply(raw, r)
	}
	if len(raw["quotas"]) != 0 {
		if r.Quotas == nil || r.Quota != nil || r.Route != nil || r.Users != nil || r.Generation == 0 || r.Epoch == 0 || r.Next != "" && !numericOffset(r.Next) {
			return Reply{}, ErrInvalid
		}
		page, err := object(raw["quotas"], "rows", "capacity_bytes", "free_bytes", "not_in_use")
		if err != nil || r.Quotas.CapacityBytes == 0 || r.Quotas.FreeBytes > r.Quotas.CapacityBytes || len(page["capacity_bytes"]) == 0 || string(page["free_bytes"]) == "null" || len(page["free_bytes"]) == 0 {
			return Reply{}, ErrInvalid
		}
		if _, present := page["not_in_use"]; present && (!r.Quotas.NotInUse || len(r.Quotas.Rows) != 0 || r.Next != "") {
			return Reply{}, ErrInvalid
		}
		rows, err := checkArray(page["rows"], "rows")
		if err != nil || len(rows) > QuotaPageSize {
			return Reply{}, ErrInvalid
		}
		seen := map[string]bool{}
		for _, row := range rows {
			var q QuotaRow
			fields, err := object(row, "id", "username", "usage_bytes", "limit_bytes", "unavailable")
			if err != nil || json.Unmarshal(row, &q) != nil || !numericID(q.ID) || !username(q.Username) || seen[q.ID] {
				return Reply{}, ErrInvalid
			}
			for _, key := range []string{"id", "username", "usage_bytes", "limit_bytes", "unavailable"} {
				if len(fields[key]) == 0 || string(fields[key]) == "null" {
					return Reply{}, ErrInvalid
				}
			}
			if q.Unavailable && (q.UsageBytes != 0 || q.LimitBytes != 0) || !q.Unavailable && !validLimit(q.LimitBytes) {
				return Reply{}, ErrInvalid
			}
			seen[q.ID] = true
		}
		return r, nil
	}

	if len(raw["quota"]) != 0 {
		if r.Quota == nil || r.Route != nil || r.Users != nil || r.Next != "" || r.Generation == 0 || r.Epoch == 0 || len(raw["generation"]) == 0 || len(raw["epoch"]) == 0 {
			return Reply{}, ErrInvalid
		}
		qraw, err := object(raw["quota"], "usage_bytes", "limit_bytes", "capacity_bytes", "free_bytes", "not_in_use")
		if err != nil || len(qraw["usage_bytes"]) == 0 || string(qraw["usage_bytes"]) == "null" || len(qraw["limit_bytes"]) == 0 || string(qraw["limit_bytes"]) == "null" || len(qraw["capacity_bytes"]) == 0 || string(qraw["capacity_bytes"]) == "null" || len(qraw["free_bytes"]) == 0 || string(qraw["free_bytes"]) == "null" || r.Quota.CapacityBytes == 0 || r.Quota.FreeBytes > r.Quota.CapacityBytes {
			return Reply{}, ErrInvalid
		}
		_, notInUse := qraw["not_in_use"]
		if notInUse && (!r.Quota.NotInUse || r.Quota.UsageBytes != 0 || r.Quota.LimitBytes != 0) || !notInUse && !validLimit(r.Quota.LimitBytes) {
			return Reply{}, ErrInvalid
		}
		return r, nil
	}
	if len(raw["users"]) != 0 {
		if r.Users == nil || r.Route != nil || r.Quota != nil || r.Generation == 0 || r.Epoch == 0 || len(raw["generation"]) == 0 || len(raw["epoch"]) == 0 || len(*r.Users) > 30 || r.Next != "" && !numericOffset(r.Next) {
			return Reply{}, ErrInvalid
		}
		entries, err := checkArray(raw["users"], "users")
		if err != nil {
			return Reply{}, err
		}
		for _, entry := range entries {
			var u BoundUser
			if decode(entry, &u, "id", "username") != nil || !numericID(u.ID) || !username(u.Username) {
				return Reply{}, ErrInvalid
			}
		}
		return r, nil
	}
	if r.Next != "" {
		return Reply{}, ErrInvalid
	}
	if r.Users != nil {
		return Reply{}, ErrInvalid
	}
	if r.Route == nil || r.Quota != nil || r.Generation == 0 || r.Epoch == 0 || len(raw["route"]) == 0 || len(raw["generation"]) == 0 || len(raw["epoch"]) == 0 {
		return Reply{}, ErrInvalid
	}
	if err := decode(raw["route"], r.Route, "uid", "username", "socket"); err != nil {
		return Reply{}, err
	}
	if r.Route.UID == 0 || !username(r.Route.Username) || r.Route.Socket != socketFor(r.Route.Username) {
		return Reply{}, ErrInvalid
	}
	return r, nil
}
func EncodeRequest(r Request) ([]byte, error) {
	b, err := json.Marshal(r)
	if err != nil {
		return nil, err
	}
	if _, err = ParseRequest(b); err != nil {
		return nil, err
	}
	return b, nil
}
func EncodeReply(r Reply) ([]byte, error) {
	b, err := json.Marshal(r)
	if err != nil {
		return nil, err
	}
	if _, err = ParseReply(b); err != nil {
		return nil, err
	}
	return b, nil
}
func checkArray(raw json.RawMessage, field string) ([]json.RawMessage, error) {
	var a []json.RawMessage
	if len(raw) == 0 || raw[0] != '[' || json.Unmarshal(raw, &a) != nil || a == nil || len(a) > 1024 {
		return nil, fmt.Errorf("%w: %s", ErrInvalid, field)
	}
	return a, nil
}
