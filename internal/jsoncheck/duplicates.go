// Package jsoncheck provides JSON grammar checks without endpoint policy.
package jsoncheck

import (
	"bytes"
	"encoding/json"
	"errors"
	"io"
)

// NoDuplicates accepts exactly one JSON value with no repeated object keys.
func NoDuplicates(b []byte) bool {
	d := json.NewDecoder(bytes.NewReader(b))
	if value(d) != nil {
		return false
	}
	var tail any
	return d.Decode(&tail) == io.EOF
}

func value(d *json.Decoder) error {
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
			if e = value(d); e != nil {
				return e
			}
		}
		end, e := d.Token()
		if e != nil || end != json.Delim('}') {
			return errors.New("object end")
		}
	case '[':
		for d.More() {
			if e = value(d); e != nil {
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
