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

// seedLab replaces the test fixtures in one synthetic home with invented
// workspaces and Pi histories that look like everyday use. Nothing here comes
// from a real home, account or conversation.
func seedLab(home string) error {
	for _, name := range []string{"git-project", "ordinary-dir", "without-metadata"} {
		if e := os.RemoveAll(filepath.Join(home, "src", name)); e != nil {
			return e
		}
	}
	if e := os.Remove(filepath.Join(home, ".pi", "agent", "sessions", "synthetic.jsonl")); e != nil && !os.IsNotExist(e) {
		return e
	}
	workspaces := map[string][]string{
		"aurinkokello":     {"README.md", "go.mod", "main.go", "internal"},
		"kotisivu":         {"index.html", "tyylit.css", "kuvat"},
		"muistiinpanot":    {"2026-09-kokous.md", "ideat.md"},
		"reseptikirja":     {"README.md", "package.json", "src"},
		"tilastoharjoitus": {"analyysi.py", "data.csv"},
	}
	for name, files := range workspaces {
		dir := filepath.Join(home, "src", name)
		if e := os.MkdirAll(dir, 0700); e != nil {
			return e
		}
		if name != "muistiinpanot" {
			if e := os.MkdirAll(filepath.Join(dir, ".git"), 0700); e != nil {
				return e
			}
			if e := os.WriteFile(filepath.Join(dir, ".git", "origin"), []byte("https://github.com/fixture/"+name+".git\n"), 0600); e != nil {
				return e
			}
		}
		for _, f := range files {
			p := filepath.Join(dir, f)
			if !strings.Contains(f, ".") {
				if e := os.MkdirAll(p, 0700); e != nil {
					return e
				}
				continue
			}
			if e := os.WriteFile(p, []byte("synteettinen sisältö\n"), 0600); e != nil {
				return e
			}
		}
	}
	base := time.Now().Add(-26 * time.Hour)
	sessions := []struct {
		workspace, id string
		age           time.Duration
		turns         [][2]string
	}{
		{"aurinkokello", "a1a1a1a1-0000-4000-8000-000000000001", 0, [][2]string{
			{"Lisää komentoriville --json-lippu, joka tulostaa auringonnousun ja -laskun.", "Lisäsin `--json`-lipun. Tuloste on muotoa:\n\n```json\n{\"nousu\": \"07:12\", \"lasku\": \"18:41\"}\n```\n\nTestit menevät läpi (`go test ./...`)."},
			{"Entä aikavyöhyke?", "Käytän nyt järjestelmän aikavyöhykettä, ja `--tz` ohittaa sen. Lisäsin testin Helsingin kesäajan vaihtumiselle."},
		}},
		{"aurinkokello", "a1a1a1a1-0000-4000-8000-000000000002", 5 * time.Hour, [][2]string{
			{"Miksi CI epäonnistuu macOS:llä?", "CI kaatuu, koska testi olettaa `/usr/share/zoneinfo`-polun. Korjasin testin käyttämään Go:n upotettua `time/tzdata`-pakettia."},
		}},
		{"kotisivu", "b2b2b2b2-0000-4000-8000-000000000003", 20 * time.Hour, [][2]string{
			{"Tee etusivusta mobiiliystävällinen.", "Lisäsin viewport-metatiedon ja vaihdoin kiinteät leveydet `max-width`-sääntöihin. Navigaatio taittuu nyt alle 600 pikselin leveydellä."},
		}},
		{"reseptikirja", "c3c3c3c3-0000-4000-8000-000000000004", 24 * time.Hour, [][2]string{
			{"Kirjoita README, joka kertoo miten sovellus käynnistetään.", "Kirjoitin README:n, jossa on asennus (`npm ci`), kehityspalvelin (`npm run dev`) ja testit (`npm test`)."},
		}},
	}
	for _, s := range sessions {
		cwd := filepath.Join(home, "src", s.workspace)
		dir := filepath.Join(home, ".pi", "agent", "sessions", "--"+strings.ReplaceAll(strings.Trim(cwd, "/"), "/", "-")+"--")
		if e := os.MkdirAll(dir, 0700); e != nil {
			return e
		}
		at := base.Add(-s.age)
		path := filepath.Join(dir, at.UTC().Format("2006-01-02T15-04-05-000Z")+"_"+s.id+".jsonl")
		f, e := os.Create(path)
		if e != nil {
			return e
		}
		enc := json.NewEncoder(f)
		_ = enc.Encode(map[string]any{"type": "session", "version": 3, "id": s.id, "timestamp": at.UTC().Format(time.RFC3339Nano), "cwd": cwd})
		var parent any
		n := 0
		write := func(role string, content any, extra map[string]any) {
			n++
			id := fmt.Sprintf("e%07d", n)
			m := map[string]any{"role": role, "content": content, "timestamp": at.Add(time.Duration(n) * time.Minute).UnixMilli()}
			for k, v := range extra {
				m[k] = v
			}
			_ = enc.Encode(map[string]any{"type": "message", "id": id, "parentId": parent, "timestamp": at.Add(time.Duration(n) * time.Minute).UTC().Format(time.RFC3339Nano), "message": m})
			parent = id
		}
		n++
		_ = enc.Encode(map[string]any{"type": "model_change", "id": fmt.Sprintf("e%07d", n), "parentId": nil, "provider": "openai-codex", "modelId": "gpt-5-codex"})
		parent = fmt.Sprintf("e%07d", n)
		for _, t := range s.turns {
			write("user", []map[string]any{{"type": "text", "text": t[0]}}, nil)
			write("assistant", []map[string]any{{"type": "text", "text": "Katson ensin koodia."}, {"type": "toolCall", "id": "c", "name": "read", "arguments": map[string]any{"path": "README.md"}}}, map[string]any{"stopReason": "toolUse"})
			write("toolResult", []map[string]any{{"type": "text", "text": "synteettinen sisältö"}}, map[string]any{"toolCallId": "c", "toolName": "read", "isError": false})
			write("assistant", []map[string]any{{"type": "text", "text": t[1]}}, map[string]any{"stopReason": "stop"})
		}
		if e := f.Close(); e != nil {
			return e
		}
		_ = os.Chtimes(path, at, at)
	}
	return nil
}
