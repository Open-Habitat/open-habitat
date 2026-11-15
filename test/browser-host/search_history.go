//go:build linux

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"time"
)

// seedSearchHistory writes the default conversation for the ⌘K switcher's
// search: 160 turns, so its words about map tiles (turns 3 and 4) lie two
// pages back, and one compound hit in the newest turns (turn 150).
func seedSearchHistory(path, cwd string) error {
	f, e := os.OpenFile(path, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if e != nil {
		return e
	}
	defer f.Close()
	encode := json.NewEncoder(f)
	start := time.Date(2026, 11, 1, 8, 0, 0, 0, time.UTC)
	if e := encode.Encode(map[string]any{"type": "session", "version": 3, "id": "11111111-1111-4111-8111-111111111111", "cwd": cwd, "timestamp": start.Format(time.RFC3339)}); e != nil {
		return e
	}
	var parent any
	at := 0
	write := func(id string, message map[string]any) error {
		at++
		e := encode.Encode(map[string]any{"type": "message", "id": id, "parentId": parent, "timestamp": start.Add(time.Duration(at) * time.Minute).Format(time.RFC3339), "message": message})
		parent = id
		return e
	}
	for turn := 0; turn < 160; turn++ {
		prompt := fmt.Sprintf("Synteettinen kysymys %d", turn)
		reply := fmt.Sprintf("Synteettinen vastaus %d.", turn)
		switch turn {
		case 0:
			prompt = "Retkioppaan suunnittelu"
		case 3:
			prompt = "Karttatiilet latautuvat hitaasti metsässä. Voisiko niitä tallentaa?"
		case 4:
			reply = "Lisäsin välimuistin karttatiilille. Toinen avaus on lähes välitön."
		case 150:
			prompt = "Päivitä vielä tilikartta."
		}
		if e := write(fmt.Sprintf("search%03d-user", turn), map[string]any{"role": "user", "content": prompt}); e != nil {
			return e
		}
		if e := write(fmt.Sprintf("search%03d-reply", turn), map[string]any{"role": "assistant", "stopReason": "stop", "content": []any{
			map[string]any{"type": "thinking", "thinking": "Synteettinen ajatus kartasta."},
			map[string]any{"type": "text", "text": reply},
		}}); e != nil {
			return e
		}
	}
	return f.Sync()
}
