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
)

type Request struct {
	Version   int    `json:"version"`
	Operation string `json:"operation"`
	Provider  string `json:"provider"`
	ID        string `json:"id"`
	Candidate string `json:"candidate,omitempty"`
}
type Route struct {
	UID      uint32 `json:"uid"`
	Username string `json:"username"`
	Socket   string `json:"socket"`
}
type Reply struct {
	Version    int     `json:"version"`
	Failure    Failure `json:"failure,omitempty"`
	Route      *Route  `json:"route,omitempty"`
	Generation uint64  `json:"generation,omitempty"`
	Epoch      uint64  `json:"epoch,omitempty"`
}

func numericID(id string) bool {
	n, err := strconv.ParseUint(id, 10, 64)
	return err == nil && n > 0 && strconv.FormatUint(n, 10) == id
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
func socketFor(name string) string { return "/run/native-agent-host/users/" + name + "/daemon.sock" }

// object rejects duplicate and unknown fields before any typed decode.
func object(b []byte, fields ...string) (map[string]json.RawMessage, error) {
	if len(b) == 0 || len(b) > MaxMessage {
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
func ParseRequest(b []byte) (Request, error) {
	var r Request
	raw, err := object(b, "version", "operation", "provider", "id", "candidate")
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
	_, candidatePresent := raw["candidate"]
	if r.Operation == "ensure" && (!candidatePresent || string(raw["candidate"]) == "null") || r.Operation == "authorize" && candidatePresent {
		return Request{}, ErrInvalid
	}
	if r.Version != 1 || r.Provider != "github" || !numericID(r.ID) || (r.Operation != "ensure" && r.Operation != "authorize") || (r.Operation == "ensure" && !username(r.Candidate)) {
		return Request{}, ErrInvalid
	}
	return r, nil
}
func ParseReply(b []byte) (Reply, error) {
	var r Reply
	if err := decode(b, &r, "version", "failure", "route", "generation", "epoch"); err != nil {
		return Reply{}, err
	}
	if r.Version != 1 {
		return Reply{}, ErrInvalid
	}
	raw, _ := object(b, "version", "failure", "route", "generation", "epoch")
	if len(raw["version"]) == 0 {
		return Reply{}, ErrInvalid
	}
	if _, present := raw["failure"]; present && r.Failure == "" {
		return Reply{}, ErrInvalid
	}
	if r.Failure != "" {
		switch r.Failure {
		case Denied, Invalid, StateUnavailable, NameCollision, Drift:
		default:
			return Reply{}, ErrInvalid
		}
		if r.Route != nil || r.Generation != 0 || r.Epoch != 0 {
			return Reply{}, ErrInvalid
		}
		return r, nil
	}
	if r.Route == nil || r.Generation == 0 || r.Epoch == 0 || len(raw["route"]) == 0 || len(raw["generation"]) == 0 || len(raw["epoch"]) == 0 {
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
