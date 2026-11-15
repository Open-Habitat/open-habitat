// Package experimental owns the release's experimental-feature catalog shared
// with the Settings cards. Saved preferences remain the daemon's responsibility.
package experimental

import (
	_ "embed"
	"encoding/json"
)

//go:embed catalog.json
var source []byte

type Text struct {
	FI string `json:"fi"`
	EN string `json:"en"`
}

type Feature struct {
	ID          string `json:"id"`
	Landed      bool   `json:"landed"`
	Title       Text   `json:"title"`
	Description Text   `json:"description"`
}

var features = func() []Feature {
	type copy struct {
		Features map[string]struct {
			Name string
			Desc string
		}
	}
	var catalog struct {
		Features []Feature
		FI       copy
		EN       copy
	}
	if err := json.Unmarshal(source, &catalog); err != nil {
		panic(err)
	}
	seen := map[string]bool{}
	for i := range catalog.Features {
		f := &catalog.Features[i]
		fi, en := catalog.FI.Features[f.ID], catalog.EN.Features[f.ID]
		if seen[f.ID] || fi.Name == "" || en.Name == "" || fi.Desc == "" || en.Desc == "" {
			panic("invalid experimental catalog")
		}
		seen[f.ID] = true
		f.Title = Text{fi.Name, en.Name}
		f.Description = Text{fi.Desc, en.Desc}
	}
	return catalog.Features
}()

func List() []Feature { return append([]Feature{}, features...) }

func Known(id string) bool {
	for _, feature := range features {
		if feature.ID == id {
			return true
		}
	}
	return false
}
