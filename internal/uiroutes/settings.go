// Package uiroutes shares settings slugs between browser navigation and the
// gateway's exact OAuth return allowlist. No prefixes or URL normalization are
// accepted here: those would also admit non-UI return targets.
package uiroutes

import (
	_ "embed"
	"encoding/json"
)

//go:embed settings.json
var settingsJSON []byte

var settings = func() map[string]string {
	var sections map[string]string
	if err := json.Unmarshal(settingsJSON, &sections); err != nil {
		panic(err)
	}
	return sections
}()

func IsSettings(path string) bool {
	if path == "/settings" {
		return true
	}
	for _, slug := range settings {
		if path == "/settings/"+slug {
			return true
		}
	}
	return false
}
