//go:build linux

package integrations

import (
	"encoding/json"
	"errors"

	"golang.org/x/sys/unix"
)

// refusalDir keeps, per account, the last chosen first pass the daemon
// refused before copying anything. The refusal is the daemon's own decision,
// recorded nowhere native: without it a restart left the files looking like
// a failed status check instead of saying why nothing was copied. A new
// choice, leaving the files out, or removing the account forgets it.
const refusalDir = ".local/state/open-habitat/first-pass-refusals"

// firstPassRefusal is one refusal: the failure code and, for
// quota_insufficient, the counted size of the choice and the room it did
// not fit, as totals only.
type firstPassRefusal struct {
	Failure     string `json:"failure"`
	NeededBytes uint64 `json:"needed_bytes,omitempty"`
	FreeBytes   uint64 `json:"free_bytes,omitempty"`
}

// refusalOf is the refusal err describes, if it is one that is kept.
func refusalOf(err error) (firstPassRefusal, bool) {
	var short quotaShortfall
	switch {
	case errors.As(err, &short):
		return firstPassRefusal{Failure: "quota_insufficient", NeededBytes: short.needed, FreeBytes: short.free}, true
	case errors.Is(err, errQuota):
		return firstPassRefusal{Failure: "quota_insufficient"}, true
	case errors.Is(err, errQuotaUnavailable):
		return firstPassRefusal{Failure: "quota_unavailable"}, true
	}
	return firstPassRefusal{}, false
}

func refusalName(k key) (string, bool) {
	if !validCatalogAddress(k.provider, k.address) {
		return "", false
	}
	return string(k.provider) + "-" + k.address + ".json", true
}

// recordRefusal keeps the refusal err describes; any other error, or none,
// forgets an earlier one. Keeping it is best effort: without it the files
// still show that nothing was copied.
func (c *Catalog) recordRefusal(k key, err error) {
	r, ok := refusalOf(err)
	name, valid := refusalName(k)
	if !valid {
		return
	}
	if !ok {
		c.forgetRefusal(k)
		return
	}
	fd, openErr := openHomeDir(c.env.Home, true, splitPath(refusalDir)...)
	if openErr != nil {
		return
	}
	defer unix.Close(fd)
	data, _ := json.Marshal(r)
	_ = writeFileAt(fd, name, data, 0600)
}

func (c *Catalog) forgetRefusal(k key) {
	name, ok := refusalName(k)
	if !ok {
		return
	}
	fd, err := openHomeDir(c.env.Home, false, splitPath(refusalDir)...)
	if err != nil {
		return
	}
	defer unix.Close(fd)
	_ = unix.Unlinkat(fd, name, 0)
}

// refusal is the account's kept refusal, if there is a readable one.
func (c *Catalog) refusal(k key) (firstPassRefusal, bool) {
	var r firstPassRefusal
	name, ok := refusalName(k)
	if !ok {
		return r, false
	}
	fd, err := openHomeDir(c.env.Home, false, splitPath(refusalDir)...)
	if err != nil {
		return r, false
	}
	defer unix.Close(fd)
	data, err := readFileAt(fd, name, 4096)
	if err != nil {
		return r, false
	}
	if json.Unmarshal(data, &r) != nil || (r.Failure != "quota_insufficient" && r.Failure != "quota_unavailable") {
		return firstPassRefusal{}, false
	}
	return r, true
}
