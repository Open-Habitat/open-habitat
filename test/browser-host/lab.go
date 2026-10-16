//go:build linux

package main

import (
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
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
			if e := exec.Command("/usr/bin/git", "-C", dir, "init", "-q", "-b", "main").Run(); e != nil {
				return e
			}
			if name != "tilastoharjoitus" {
				url := "https://github.com/fixture/" + name + ".git"
				if e := exec.Command("/usr/bin/git", "-C", dir, "remote", "add", "origin", url).Run(); e != nil {
					return e
				}
				// The synthetic clone observer also reads this fixture-only marker.
				if e := os.WriteFile(filepath.Join(dir, ".git", "origin"), []byte(url+"\n"), 0600); e != nil {
					return e
				}
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
		if name != "muistiinpanot" {
			run := func(args ...string) error {
				cmd := exec.Command("/usr/bin/git", append([]string{"-C", dir, "-c", "user.name=Synthetic lab", "-c", "user.email=synthetic@example.invalid"}, args...)...)
				cmd.Env = []string{"PATH=/usr/bin:/bin", "HOME=" + home, "GIT_CONFIG_NOSYSTEM=1"}
				return cmd.Run()
			}
			if e := run("add", "."); e != nil {
				return e
			}
			if e := run("commit", "-qm", "Luo synteettinen projekti"); e != nil {
				return e
			}
			if name == "aurinkokello" {
				if e := run("update-ref", "refs/remotes/origin/main", "HEAD"); e != nil {
					return e
				}
				if e := run("config", "branch.main.remote", "origin"); e != nil {
					return e
				}
				if e := run("config", "branch.main.merge", "refs/heads/main"); e != nil {
					return e
				}
				fetchPath := filepath.Join(dir, ".git", "FETCH_HEAD")
				if e := os.WriteFile(fetchPath, []byte("synthetic recorded fetch\n"), 0600); e != nil {
					return e
				}
				fetched := time.Now().Add(-6 * time.Minute)
				if e := os.Chtimes(fetchPath, fetched, fetched); e != nil {
					return e
				}
				if e := run("commit", "--allow-empty", "-qm", "Erota statusrivien jäsennin"); e != nil {
					return e
				}
				for _, file := range []string{"main.go", "go.mod"} {
					if e := os.WriteFile(filepath.Join(dir, file), []byte("synteettinen muutos\n"), 0600); e != nil {
						return e
					}
				}
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
		if s.id == "a1a1a1a1-0000-4000-8000-000000000001" {
			write("assistant", []map[string]any{{"type": "toolCall", "name": "read", "id": "r2"}, {"type": "toolCall", "name": "edit", "id": "e2"}}, nil)
			write("toolResult", []map[string]any{{"type": "text", "text": "synteettinen lukutulos"}}, map[string]any{"toolName": "read", "toolCallId": "r2"})
			write("toolResult", []map[string]any{{"type": "text", "text": "--- a/main.go\n+++ b/main.go\n@@ -1 +1 @@\n-vanha\n+uusi"}}, map[string]any{"toolName": "edit", "toolCallId": "e2"})
			write("toolResult", []map[string]any{{"type": "text", "text": strings.Repeat("synteettinen tulos\n", 5000)}}, map[string]any{"toolName": "bash", "toolCallId": "b2"})
			write("assistant", []map[string]any{{"type": "futureBlock", "prompt": "Valitse seuraava vaihe", "choices": []string{"Jatka", "Lopeta"}}}, nil)
			n++
			id := fmt.Sprintf("e%07d", n)
			_ = enc.Encode(map[string]any{"type": "futureEntry", "id": id, "parentId": parent, "payload": "synteettinen uusi tapahtuma"})
			parent = id
			write("assistant", []map[string]any{{"type": "text", "text": "Odotan vastausta."}}, map[string]any{"stopReason": "toolUse"})
		}
		recap := s.turns[len(s.turns)-1][1]
		through := parent
		if s.workspace == "aurinkokello" && s.age == 0 {
			through = "e0000005"
			recap = s.turns[0][1]
		}
		next := "Tarkista muutos ja kerro seuraava tehtävä."
		if s.workspace == "aurinkokello" && s.age == 0 {
			next = "Päätä, näytetäänkö aikavyöhyke myös JSON-tulosteessa."
		}
		n++
		_ = enc.Encode(map[string]any{"type": "custom", "id": fmt.Sprintf("e%07d", n), "parentId": parent, "customType": "conversation-recap", "data": map[string]any{"recap": recap, "next": next, "through": through, "generatedAt": time.Now().Add(-s.age - 5*time.Minute).UnixMilli(), "trigger": "automatic"}})
		if e := f.Close(); e != nil {
			return e
		}
		_ = os.Chtimes(path, at, at)
	}
	return nil
}

// Pi 1.3 custom_message shape, with pi-processes 0.10.9's XML content.
// All fields and content are invented; never copied from a user's session.
func seedOpeningHistory(home string) error {
	paths, err := filepath.Glob(filepath.Join(home, ".pi", "agent", "sessions", "*", "*_a1a1a1a1-0000-4000-8000-000000000001.jsonl"))
	if err != nil || len(paths) != 1 {
		return fmt.Errorf("opening fixture session not found")
	}
	f, err := os.Create(paths[0])
	if err != nil {
		return err
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	if err := enc.Encode(map[string]any{"type": "session", "version": 3, "id": "a1a1a1a1-0000-4000-8000-000000000001", "cwd": filepath.Join(home, "src", "aurinkokello")}); err != nil {
		return err
	}
	var parent any
	n := 0
	write := func(row map[string]any) error {
		n++
		row["id"] = fmt.Sprintf("opening%03d", n)
		row["parentId"] = parent
		row["timestamp"] = time.Now().Add(time.Duration(n) * time.Millisecond).UTC().Format(time.RFC3339Nano)
		parent = row["id"]
		return enc.Encode(row)
	}
	for i := 0; i < 6; i++ {
		if err := write(message("user", fmt.Sprintf("Avaamisen tarkistus %d", i), nil)); err != nil {
			return err
		}
		if err := write(message("assistant", strings.Repeat("Synteettinen pitkä vastaus.\n\n", 12), map[string]any{"stopReason": "stop"})); err != nil {
			return err
		}
	}
	for _, content := range []string{"", "<process_event type=\"lifecycle\" kind=\"success\" process_id=\"proc_example\" process_name=\"test\" status=\"exited\">\n  <summary>Synteettinen testi valmistui</summary>\n  <command>npm test</command>\n  <exit_code>0</exit_code>\n</process_event>"} {
		if err := write(map[string]any{"type": "custom_message", "customType": "ad-process:notification", "display": true, "content": content, "details": func() map[string]any {
			if content == "" {
				return map[string]any{"private": "not for the browser"}
			}
			return map[string]any{"kind": "success", "processId": "proc_abcd", "processName": "test", "command": "npm test", "exitCode": 0, "timestamp": time.Now().UnixMilli(), "private": "not for the browser"}
		}()}); err != nil {
			return err
		}
	}
	if err := write(message("user", "Viimeinen kysymys", nil)); err != nil {
		return err
	}
	if err := write(message("assistant", "Viimeisin vastaus on tässä.", map[string]any{"stopReason": "stop"})); err != nil {
		return err
	}
	return f.Sync()
}
