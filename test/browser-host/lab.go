//go:build linux

package main

import (
	_ "embed"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"
)

//go:embed lab-start-page.md
var labStartPage []byte

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
		// Workspace icons come from the repository: reseptikirja names one in
		// its committed Open Habitat config, kotisivu has a logo, and the
		// others fall back to a glyph derived from the name.
		if name == "reseptikirja" {
			if e := os.WriteFile(filepath.Join(dir, ".open-habitat.yaml"), []byte("# Open Habitat\nicon: \"🍳\"\n"), 0600); e != nil {
				return e
			}
		}
		if name == "kotisivu" {
			if e := os.WriteFile(filepath.Join(dir, "favicon.svg"), []byte(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#185e87"/><path d="M8 17l8-7 8 7v7H8z" fill="#fff"/></svg>`+"\n"), 0600); e != nil {
				return e
			}
		}
		if name == "aurinkokello" {
			// Editor link targets belong to the committed baseline, not the
			// four intentional dirty files installed by labGitStatus.
			if e := os.MkdirAll(filepath.Join(dir, "cmd"), 0700); e != nil {
				return e
			}
			if e := os.WriteFile(filepath.Join(dir, "cmd", "main.go"), []byte("package main\n\nimport \"fmt\"\n\nfunc main() {\n\tfmt.Println(\"Aurinkokello\")\n}\n"), 0600); e != nil {
				return e
			}
			writePreviewFixtures(filepath.Join(dir, "cmd"))
			if e := os.MkdirAll(filepath.Join(dir, ".agents"), 0700); e != nil {
				return e
			}
			if e := os.WriteFile(filepath.Join(dir, ".agents/start-page.md"), labStartPage, 0600); e != nil {
				return e
			}
			// The start page's first goal has its own skill, as the
			// start-page skill writes it: the goal's title is its description.
			goalSkill := filepath.Join(dir, ".agents", "skills", "korjaa-ongelma")
			if e := os.MkdirAll(goalSkill, 0700); e != nil {
				return e
			}
			if e := os.WriteFile(filepath.Join(goalSkill, "SKILL.md"), []byte("---\nname: korjaa-ongelma\ndescription: Korjaa havaittu ongelma\ndisable-model-invocation: true\n---\nSelvitä ongelman syy. Tee ensin pieni toistava testi. Korjaa juurisyy ja aja aiheeseen liittyvät testit. Kerro, mitä tarkistit ja mikä jäi tarkistamatta.\n"), 0600); e != nil {
				return e
			}
			skillDir := filepath.Join(dir, ".pi", "skills", "pytest-debug")
			if e := os.MkdirAll(skillDir, 0700); e != nil {
				return e
			}
			if e := os.WriteFile(filepath.Join(skillDir, "SKILL.md"), []byte("---\nname: pytest-debug\ndescription: Find why a pytest test fails and fix the smallest cause first.\n---\nSynthetic lab skill only.\n"), 0600); e != nil {
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
				if e := labGitStatus(home, dir); e != nil {
					return e
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
		if s.id == "a1a1a1a1-0000-4000-8000-000000000002" {
			labStageTurns(write)
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
	return seedLabArchive(home)
}

// labStageTurns writes turns whose interim replies close stages of work: two
// short interim replies, then a long one and one right before the answer.
// All content is invented, after the interim-reply prototype round.
func labStageTurns(write func(string, any, map[string]any)) {
	opus := map[string]any{"provider": "anthropic", "model": "claude-opus-5-5", "stopReason": "toolUse"}
	final := map[string]any{"provider": "anthropic", "model": "claude-opus-5-5", "stopReason": "stop"}
	n := 0
	bash := func(command string) map[string]any {
		n++
		return map[string]any{"type": "toolCall", "id": fmt.Sprintf("stage-%d", n), "name": "bash", "arguments": map[string]any{"command": command}}
	}
	text := func(t string) map[string]any { return map[string]any{"type": "text", "text": t} }
	think := func(t string) map[string]any { return map[string]any{"type": "thinking", "thinking": t} }
	step := func(content []map[string]any, outputs ...string) {
		write("assistant", content, opus)
		i := 0
		for _, block := range content {
			if block["type"] == "toolCall" {
				write("toolResult", []map[string]any{text(outputs[i])}, map[string]any{"toolCallId": block["id"], "toolName": "bash", "isError": false})
				i++
			}
		}
	}
	write("user", []map[string]any{text("Synkkaa fleetrepo originin kanssa ja aja fleet doctor.")}, nil)
	step([]map[string]any{think("**Checking the repository state before pulling**"), bash("git status --short --branch"), bash("git rev-list --count origin/main..HEAD")}, "## main...origin/main [behind 3]", "0")
	step([]map[string]any{text("Working tree on puhdas, ei paikallisia committeja — pelkkä pull riittää, pushattavaa ei ole."), bash("git pull --rebase")}, "Fast-forward\n 3 files changed")
	step([]map[string]any{think("**Running the fleet doctor across machines**"), bash("fleetrepo fleet doctor")}, "alder ok\nbrunhild ok\nhauis unreachable")
	step([]map[string]any{text("Pull meni läpi, kolme uutta committia. Doctorin mukaan `rowan` ei vastaa — katson vielä, onko kone vain unessa vai oikeasti rikki."), bash("ping -c 2 -W 2 rowan.local")}, "2 packets transmitted, 0 received")
	write("assistant", []map[string]any{text("Fleetrepo on ajan tasalla: `main` on nyt `b81d0e3`.\n\n- `alder`, `maple`, `cedar` ja `willow` ovat konvergoituneet.\n- `rowan` ei vastaa SSH:hon eikä pingiin. Kone on todennäköisesti unessa; sitä ei ole todennettu, joten en merkitse sitä rikkinäiseksi.\n\nKun kone herää, aja `fleetrepo fleet doctor rowan`.")}, final)
	write("user", []map[string]any{text("Selvä. Tarkista vielä, että Gitean yöllinen varmuuskopio on ajettu ja ehjä.")}, nil)
	step([]map[string]any{think("**Finding the backup timer and its last run**"), bash("systemctl list-timers gitea-backup.timer"), bash("journalctl -u gitea-backup --since today --no-pager")}, "Fri 03:00 gitea-backup.timer", "waiting for lock (41 s)\nsnapshot 7c1e0a94 saved")
	step([]map[string]any{text("Ajo on tehty ja päättyi onnistuneesti, mutta lokissa on kaksi asiaa, jotka kannattaa tietää ennen kuin jatkan:\n\n1. **Lukko oli varattuna.** `maple` piti restic-repon lukkoa eilisillasta 22:14 asti, ja yön ajo joutui odottamaan 41 sekuntia. Todennäköisesti läppärin oma varmuuskopio jäi kesken, kun kansi suljettiin. Tämä ei rikkonut mitään, mutta jos lukko jää pysyväksi, seuraava ajo epäonnistuu.\n2. **Tilannevedos on pienempi kuin edellinen.** `7c1e0a94` on noin 180 Mt pienempi kuin perjantain vedos. Se voi olla siivottua LFS-sisältöä, mutta en oleta sitä.\n\nTarkistan seuraavaksi arkiston eheyden `restic check`illä ja vertaan vedoksia. Se kestää noin minuutin; en poista lukkoa enkä muuta mitään."), bash("restic -r /srv/backup/gitea check --read-data-subset=5%"), bash("restic -r /srv/backup/gitea diff 51d9f3b2 7c1e0a94 | tail -6")}, "no errors were found", "removed: 276 MiB\nadded: 94 MiB")
	write("assistant", []map[string]any{think("**The removed data matches Friday's LFS cleanup**"), text("Eheystarkistus ei löytänyt virheitä, ja pienentyminen selittyy perjantain LFS-siivouksella (276 Mt pois, 94 Mt uutta)."), text("Gitean varmuuskopio on kunnossa.\n\n- Yön ajo 03:00 onnistui, tilannevedos `7c1e0a94`.\n- `restic check` (5 % datasta luettu) ei löytänyt virheitä.\n- Pienempi koko johtuu perjantain LFS-siivouksesta, ei puuttuvasta datasta.\n\nYksi asia jää sinulle: `maple`in vanha lukko. Jos haluat sen pois ennen ensi yötä, aja läppärillä `restic unlock`. En tehnyt sitä täältä, koska lukko kuuluu toisen koneen prosessille.")}, final)
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
	// Pi 1.3.0 saves its structured system prompt before the first user turn.
	if err := write(message("system", "", map[string]any{"sections": map[string]any{"preamble": "Synthetic internal instruction"}, "toolsAdded": []any{map[string]any{"name": "synthetic"}}})); err != nil {
		return err
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

// labPushedClone makes ~/src/<name> a clone of a bare repository in the same
// disposable home, with every commit pushed and two ignored local files.
func labPushedClone(home, name string) error {
	remote := filepath.Join(home, ".cache", "lab-remotes", name+".git")
	dir := filepath.Join(home, "src", name)
	if e := os.RemoveAll(remote); e != nil {
		return e
	}
	if e := os.RemoveAll(dir); e != nil {
		return e
	}
	if e := os.MkdirAll(filepath.Dir(remote), 0700); e != nil {
		return e
	}
	run := func(cwd string, args ...string) error {
		cmd := exec.Command("/usr/bin/git", append([]string{"-c", "user.name=Synthetic lab", "-c", "user.email=synthetic@example.invalid", "-c", "init.defaultBranch=main"}, args...)...)
		cmd.Dir = cwd
		cmd.Env = []string{"PATH=/usr/bin:/bin", "HOME=" + home, "GIT_CONFIG_NOSYSTEM=1"}
		return cmd.Run()
	}
	if e := run(home, "init", "-q", "--bare", remote); e != nil {
		return e
	}
	if e := run(home, "clone", "-q", remote, dir); e != nil {
		return e
	}
	for path, body := range map[string]string{"README.md": "synteettinen kokeilu\n", ".gitignore": ".env\nnode_modules/\n"} {
		if e := os.WriteFile(filepath.Join(dir, path), []byte(body), 0600); e != nil {
			return e
		}
	}
	if e := run(dir, "add", "."); e != nil {
		return e
	}
	if e := run(dir, "commit", "-qm", "Synteettinen kokeilu"); e != nil {
		return e
	}
	if e := run(dir, "push", "-q", "origin", "main"); e != nil {
		return e
	}
	if e := os.WriteFile(filepath.Join(dir, ".env"), []byte("SYNTHETIC=1\n"), 0600); e != nil {
		return e
	}
	return os.MkdirAll(filepath.Join(dir, "node_modules", "kirjasto"), 0700)
}

// labGitStatus gives aurinkokello the Git state of the prototype round
// 2026-10-17-git-tila: branch status-rivit tracking origin/status-rivit (2 not
// pushed, 1 incoming), base main through origin/HEAD (5 ahead, 3 behind),
// four changed files and a fetch 25 minutes ago. Its origin is a bare
// repository in the same disposable home, so Hae etärepo really fetches, and
// main has one commit there that the last fetch has not seen yet.
func labGitStatus(home, dir string) error {
	remote := filepath.Join(home, ".cache", "lab-remotes", "aurinkokello.git")
	other := filepath.Join(home, ".cache", "lab-remotes", "aurinkokello-other")
	for _, p := range []string{remote, other} {
		if e := os.RemoveAll(p); e != nil {
			return e
		}
	}
	if e := os.MkdirAll(filepath.Dir(remote), 0700); e != nil {
		return e
	}
	now := time.Now()
	minutes := 0
	git := func(cwd string, args ...string) error {
		stamp := now.Add(time.Duration(minutes) * time.Minute).Format(time.RFC3339)
		cmd := exec.Command("/usr/bin/git", append([]string{"-c", "user.name=Synthetic lab", "-c", "user.email=synthetic@example.invalid", "-c", "init.defaultBranch=main"}, args...)...)
		cmd.Dir = cwd
		cmd.Env = []string{"PATH=/usr/bin:/bin", "HOME=" + home, "GIT_CONFIG_NOSYSTEM=1", "GIT_AUTHOR_DATE=" + stamp, "GIT_COMMITTER_DATE=" + stamp}
		if out, e := cmd.CombinedOutput(); e != nil {
			return fmt.Errorf("git %v: %v %s", args, e, out)
		}
		return nil
	}
	commit := func(cwd string, at int, file, body, subject string) error {
		minutes = at
		if e := os.MkdirAll(filepath.Dir(filepath.Join(cwd, file)), 0700); e != nil {
			return e
		}
		if e := os.WriteFile(filepath.Join(cwd, file), []byte(body), 0600); e != nil {
			return e
		}
		if e := git(cwd, "add", file); e != nil {
			return e
		}
		return git(cwd, "commit", "-qm", subject)
	}
	lines := func(n int, word string) string { return strings.Repeat(word+"\n", n) }
	steps := []func() error{
		func() error { return git(home, "init", "-q", "--bare", remote) },
		// The workspace's existing commit becomes the remote's main.
		func() error { return git(dir, "remote", "set-url", "origin", remote) },
		func() error { return git(dir, "push", "-q", "origin", "main") },
		func() error { return git(home, "clone", "-q", remote, other) },
		// status-rivit: three pushed commits, then main moves on, then one
		// incoming commit and two local ones.
		func() error { return git(dir, "switch", "-q", "-c", "status-rivit") },
		func() error {
			return commit(dir, -170, "scripts/status_rows.py", lines(20, "rivi"), "Statusskriptin ensimmäinen versio")
		},
		func() error {
			return commit(dir, -155, "pyproject.toml", lines(8, "asetus"), "Lue status.md:n polku argumentista")
		},
		func() error {
			return commit(dir, -117, "scripts/status_rows.py", lines(24, "rivi"), "Statusrivit JSON-muotoon")
		},
		func() error { return git(dir, "push", "-q", "-u", "origin", "status-rivit") },
		func() error { return commit(other, -265, "go.sum", "riippuvuus\n", "Päivitä riippuvuudet") },
		func() error { return commit(other, -102, "main.go", "aikavyöhyke\n", "Aikavyöhyke tulosteeseen") },
		func() error { return commit(other, -77, ".github/ci.yml", "välimuisti\n", "CI: pip-välimuisti") },
		func() error { return git(other, "push", "-q", "origin", "main") },
		func() error { return git(other, "fetch", "-q") },
		func() error { return git(other, "switch", "-q", "status-rivit") },
		func() error {
			return commit(other, -42, "README.md", "käyttöesimerkki\n", "README: statusskriptin käyttöesimerkki")
		},
		func() error { return git(other, "push", "-q", "origin", "status-rivit") },
		func() error { return git(dir, "fetch", "-q", "origin") },
		func() error { return git(dir, "remote", "set-head", "origin", "main") },
		func() error {
			return commit(dir, -19, "scripts/status_rows.py", lines(26, "rivi"), "Statusrivien jäsennys omaksi funktioksi")
		},
		func() error {
			return commit(dir, -6, "scripts/status_rows.py", lines(30, "rivi"), "Statusrivit: --since-suodatus")
		},
		// Fetched since the last fetch here: main's newest commit.
		func() error { return git(other, "switch", "-q", "main") },
		func() error {
			return commit(other, -1, ".github/ci.yml", "aikakatkaisu\n", "Korjaa maanantain CI-aikakatkaisu")
		},
		func() error { return git(other, "push", "-q", "origin", "main") },
	}
	for _, step := range steps {
		if e := step(); e != nil {
			return e
		}
	}
	// Four changes: two modified, one staged, one untracked.
	write := func(file, body string) error {
		if e := os.MkdirAll(filepath.Dir(filepath.Join(dir, file)), 0700); e != nil {
			return e
		}
		return os.WriteFile(filepath.Join(dir, file), []byte(body), 0600)
	}
	if e := write("scripts/status_rows.py", lines(26, "rivi")+lines(18, "uusi")); e != nil {
		return e
	}
	if e := write("pyproject.toml", lines(8, "asetus")+lines(2, "lisä")); e != nil {
		return e
	}
	if e := write("tests/test_status_rows.py", lines(52, "testi")); e != nil {
		return e
	}
	if e := write("README.md", lines(9, "ohje")); e != nil {
		return e
	}
	if e := git(dir, "add", "README.md"); e != nil {
		return e
	}
	fetchPath := filepath.Join(dir, ".git", "FETCH_HEAD")
	fetched := now.Add(-25 * time.Minute)
	return os.Chtimes(fetchPath, fetched, fetched)
}

// labWorktrees adds linked worktrees of ~/src/aurinkokello in the sibling
// layout, one per Git state the cleanup list shows, and a live Taskfleet run
// that owns one of them. The home gets a Git identity, which saving changes
// to a branch needs.
func labWorktrees(home string) error {
	repo := filepath.Join(home, "src", "aurinkokello")
	wt := func(name string) string { return filepath.Join(home, "src", "aurinkokello__worktrees", name) }
	if e := os.WriteFile(filepath.Join(home, ".gitconfig"), []byte("[user]\n\tname = Synthetic lab\n\temail = synthetic@example.invalid\n"), 0600); e != nil {
		return e
	}
	run := func(cwd string, args ...string) error {
		cmd := exec.Command("/usr/bin/git", args...)
		cmd.Dir = cwd
		cmd.Env = []string{"PATH=/usr/bin:/bin", "HOME=" + home, "GIT_CONFIG_NOSYSTEM=1"}
		return cmd.Run()
	}
	commit := func(name string) error {
		if e := os.WriteFile(filepath.Join(wt(name), name+".md"), []byte("synteettinen muutos\n"), 0600); e != nil {
			return e
		}
		if e := run(wt(name), "add", "."); e != nil {
			return e
		}
		return run(wt(name), "commit", "-qm", "Synteettinen "+name)
	}
	for _, name := range []string{"valmis", "kesken", "muokattu", "hylatty", "kadonnut", "ajossa"} {
		// From main, with the source branch recorded as Taskfleet does, so
		// the base is main whatever aurinkokello has checked out.
		if e := run(repo, "worktree", "add", "-q", "-b", name, wt(name), "main"); e != nil {
			return e
		}
		if e := run(repo, "config", "branch."+name+".workmux-base", "main"); e != nil {
			return e
		}
		if name != "kadonnut" {
			if e := commit(name); e != nil {
				return e
			}
		}
	}
	if e := run(repo, "branch", "-f", "main", "valmis"); e != nil {
		return e
	}
	for _, name := range []string{"muokattu", "hylatty"} {
		if e := os.WriteFile(filepath.Join(wt(name), name+".md"), []byte("muokattu, ei commitoitu\n"), 0600); e != nil {
			return e
		}
		if e := os.WriteFile(filepath.Join(wt(name), "uusi.txt"), []byte("uusi tiedosto\n"), 0600); e != nil {
			return e
		}
	}
	if e := os.RemoveAll(wt("kadonnut")); e != nil {
		return e
	}
	root := filepath.Join(home, ".taskfleet")
	if e := os.MkdirAll(root, 0700); e != nil {
		return e
	}
	list := map[string]any{"schema_version": 1, "data": map[string]any{"runs": []any{map[string]any{
		"run_id": "01m53433zdhmcc9q1spepb30gz", "kind": "spinoff", "status": "running",
		"worktree_path": wt("ajossa"), "source_repo": repo, "node_transcripts": []any{},
	}}}}
	b, _ := json.Marshal(list)
	return os.WriteFile(filepath.Join(root, "fixture-list.json"), b, 0600)
}
