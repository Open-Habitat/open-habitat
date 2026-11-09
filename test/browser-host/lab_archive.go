//go:build linux

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// labArchivedConversations are aurinkokello's archived conversations, with
// the titles of the archive Jari reported on 8.11.2026
// (proto-conversation-archive) and invented content. Each is archived ago
// before the lab starts, so the list has rows today, yesterday, earlier this
// week and older.
var labArchivedConversations = []struct {
	id, title, reply string
	ago              time.Duration
}{
	{"d4d4d4d4-0000-4000-8000-000000000001", "Pieni testiagentin testi", "Ensimmäinen otsikko on aurinkokello.", 50 * time.Minute},
	{"d4d4d4d4-0000-4000-8000-000000000002", "Testiavustajan tarkoitus", "Tein avustajan testaaja.", 95 * time.Minute},
	{"d4d4d4d4-0000-4000-8000-000000000003", "testi", "Hei! Miten voin auttaa?", 2 * time.Hour},
	{"d4d4d4d4-0000-4000-8000-000000000004", "Kokeile testikoneella", "Julkaisu vastaa ja kirjautuminen toimii.", 3*time.Hour + 20*time.Minute},
	{"d4d4d4d4-0000-4000-8000-000000000005", "Testi. Tee jotakin joka kestää 30s", "Valmis: komento päättyi normaalisti.", 4*time.Hour + 30*time.Minute},
	{"d4d4d4d4-0000-4000-8000-000000000006", "Testikoneen muutosten läpikäynti", "Korjaus on yhdistetty main-haaraan.", 22 * time.Hour},
	{"d4d4d4d4-0000-4000-8000-000000000007", "Kokeilukokonaisuuksien testaus", "Kirjasin liitteiden tekstin omaksi issueksi.", 24 * time.Hour},
	{"d4d4d4d4-0000-4000-8000-000000000008", "Testattavien toimintojen lista", "Worker päättyi; muutosta ei yhdistetty.", 29 * time.Hour},
	{"d4d4d4d4-0000-4000-8000-000000000009", "Git pull ongelmien selvitys", "Rebase onnistui, ja haara on ajan tasalla.", 56 * time.Hour},
	{"d4d4d4d4-0000-4000-8000-00000000000a", "Projektin esittelypyyntö suomeksi", "Aurinkokello laskee auringonnousun ja -laskun.", 71 * time.Hour},
	{"d4d4d4d4-0000-4000-8000-00000000000b", "Git pullin aloittaminen", "Haettu 4 uutta committia; ei ristiriitoja.", 82 * time.Hour},
	{"d4d4d4d4-0000-4000-8000-00000000000c", "ping", "pong", 125 * time.Hour},
	{"d4d4d4d4-0000-4000-8000-00000000000d", "Salutation en français", "Bonjour ! Comment puis-je vous aider ?", 11 * 24 * time.Hour},
}

// seedLabArchive writes the archived conversations' Pi histories and the
// person's archive marks, as the daemon would after each archive.
func seedLabArchive(home string) error {
	cwd := filepath.Join(home, "src", "aurinkokello")
	dir := filepath.Join(home, ".pi", "agent", "sessions", "--"+strings.ReplaceAll(strings.Trim(cwd, "/"), "/", "-")+"--")
	if err := os.MkdirAll(dir, 0700); err != nil {
		return err
	}
	now := time.Now()
	marks := map[string]any{}
	for _, c := range labArchivedConversations {
		archived := now.Add(-c.ago)
		started := archived.Add(-20 * time.Minute)
		path := filepath.Join(dir, started.UTC().Format("2006-01-02T15-04-05-000Z")+"_"+c.id+".jsonl")
		f, err := os.Create(path)
		if err != nil {
			return err
		}
		enc := json.NewEncoder(f)
		_ = enc.Encode(map[string]any{"type": "session", "version": 3, "id": c.id, "timestamp": started.UTC().Format(time.RFC3339Nano), "cwd": cwd})
		var parent any
		for n, m := range []map[string]any{
			{"role": "user", "content": []map[string]any{{"type": "text", "text": c.title}}},
			{"role": "assistant", "content": []map[string]any{{"type": "text", "text": c.reply}}, "stopReason": "stop"},
		} {
			at := started.Add(time.Duration(n+1) * time.Minute)
			m["timestamp"] = at.UnixMilli()
			id := fmt.Sprintf("a%07d", n+1)
			_ = enc.Encode(map[string]any{"type": "message", "id": id, "parentId": parent, "timestamp": at.UTC().Format(time.RFC3339Nano), "message": m})
			parent = id
		}
		if err := f.Close(); err != nil {
			return err
		}
		last := started.Add(2 * time.Minute)
		_ = os.Chtimes(path, last, last)
		marks["pi:"+c.id] = map[string]string{"archived_at": archived.UTC().Format(time.RFC3339Nano)}
	}
	state := filepath.Join(home, ".local", "state", "open-habitat")
	if err := os.MkdirAll(state, 0700); err != nil {
		return err
	}
	b, err := json.Marshal(map[string]any{"schema_version": 1, "workspaces": map[string]any{}, "conversations": marks})
	if err != nil {
		return err
	}
	return os.WriteFile(filepath.Join(state, "user-state.json"), b, 0600)
}
