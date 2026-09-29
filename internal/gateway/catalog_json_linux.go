//go:build linux

package gateway

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
)

// Reject ambiguous duplicate JSON keys before decoding a daemon response.
func catalogNoDuplicates(b []byte) bool {
	d := json.NewDecoder(bytes.NewReader(b))
	if catalogValue(d) != nil {
		return false
	}
	var tail any
	return d.Decode(&tail) == io.EOF
}
func catalogValue(d *json.Decoder) error {
	token, e := d.Token()
	if e != nil {
		return e
	}
	delim, ok := token.(json.Delim)
	if !ok {
		return nil
	}
	switch delim {
	case '{':
		seen := map[string]bool{}
		for d.More() {
			key, e := d.Token()
			if e != nil {
				return e
			}
			s, ok := key.(string)
			if !ok || seen[s] {
				return errors.New("ambiguous JSON")
			}
			seen[s] = true
			if e = catalogValue(d); e != nil {
				return e
			}
		}
		end, e := d.Token()
		if e != nil || end != json.Delim('}') {
			return errors.New("object end")
		}
	case '[':
		for d.More() {
			if e = catalogValue(d); e != nil {
				return e
			}
		}
		end, e := d.Token()
		if e != nil || end != json.Delim(']') {
			return errors.New("array end")
		}
	default:
		return errors.New("invalid delimiter")
	}
	return nil
}
