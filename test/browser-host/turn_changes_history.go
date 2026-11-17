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

// seedTurnChangesHistory writes a native session for Muutokset
// (turn-changes): a first turn that only lists files, and a second that
// reads and edits one file twice (once by its absolute path), writes a new
// one, removes one with git rm, fails an edit and answers with an interim
// reply between. Every entry has its moment, a second apart or more.
func seedTurnChangesHistory(path, cwd string) error {
	return seedTurnChanges(path, cwd, false)
}

// seedTurnChangesOneHistory writes a native session whose only turn edits one
// file, replacing a short line with one far wider than a phone or a desktop
// conversation: a single-file change that opens straight to its diff, whose
// code block offers the wrap toggle.
func seedTurnChangesOneHistory(path, cwd string) error {
	return seedTurnChanges(path, cwd, true)
}

func seedTurnChanges(path, cwd string, one bool) error {
	start := time.Date(2026, 11, 11, 9, 0, 0, 0, time.UTC)
	rows := []map[string]any{{"type": "session", "version": 3, "id": "11111111-1111-4111-8111-111111111111", "cwd": cwd, "timestamp": start.Format(time.RFC3339Nano)}}
	var parent any
	add := func(id string, seconds int, message map[string]any) {
		at := start.Add(time.Duration(seconds) * time.Second)
		message["timestamp"] = at.UnixMilli()
		rows = append(rows, map[string]any{"type": "message", "id": id, "parentId": parent, "timestamp": at.Format(time.RFC3339Nano), "message": message})
		parent = id
	}
	call := func(id string, seconds int, name string, args map[string]any, text string) {
		content := []any{}
		if text != "" {
			content = append(content, map[string]any{"type": "text", "text": text})
		}
		content = append(content, map[string]any{"type": "toolCall", "id": id, "name": name, "arguments": args})
		add(id+"-call", seconds, map[string]any{"role": "assistant", "stopReason": "toolUse", "content": content})
	}
	result := func(id string, seconds int, name, text string, failed bool) {
		add(id+"-result", seconds, map[string]any{"role": "toolResult", "toolCallId": id, "toolName": name, "isError": failed, "content": []any{map[string]any{"type": "text", "text": text}}})
	}
	reply := func(id string, seconds int, text string) {
		add(id, seconds, map[string]any{"role": "assistant", "stopReason": "stop", "content": []any{map[string]any{"type": "text", "text": text}}})
	}

	if one {
		add("tc-user-1", 0, map[string]any{"role": "user", "content": "Kuvaa oletus tarkemmin."})
		call("tc-edit", 5, "edit", map[string]any{"path": "src/haku.ts", "edits": []any{map[string]any{"oldText": "export const oletus = 10;", "newText": "export const oletus = 10; // " + strings.Repeat("hakutulosten oletusmäärä ", 12)}}}, "")
		result("tc-edit", 6, "edit", "Successfully replaced 1 block(s) in src/haku.ts.", false)
		reply("tc-reply-1", 10, "Oletus on nyt kuvattu.")
		return writeRows(path, rows)
	}
	add("tc-user-1", 0, map[string]any{"role": "user", "content": "Mitä tiedostoja on?"})
	call("tc-ls", 2, "bash", map[string]any{"command": "ls src"}, "")
	result("tc-ls", 3, "bash", "haku.ts\nvanha.ts\n", false)
	reply("tc-reply-1", 5, "Kaksi tiedostoa: haku.ts ja vanha.ts.")

	haku := "export function haku(reitit, sana) {\n  return reitit.filter((r) => r.nimi.includes(sana));\n}\n\nexport const oletus = 10;\n"
	add("tc-user-2", 60, map[string]any{"role": "user", "content": "Lisää haulle korkeusero ja poista vanha kartta."})
	call("tc-read", 65, "read", map[string]any{"path": "src/haku.ts"}, "")
	result("tc-read", 66, "read", haku, false)
	call("tc-edit-1", 80, "edit", map[string]any{"path": "src/haku.ts", "edits": []any{map[string]any{"oldText": "export function haku(reitit, sana) {", "newText": "export function haku(reitit, sana, nousu = 0) {"}}}, "")
	result("tc-edit-1", 81, "edit", "Successfully replaced 1 block(s) in src/haku.ts.", false)
	call("tc-edit-bad", 85, "edit", map[string]any{"path": "README.md", "edits": []any{map[string]any{"oldText": "ei ole", "newText": "on"}}}, "")
	result("tc-edit-bad", 86, "edit", "Could not find the exact text in README.md.", true)
	call("tc-edit-2", 100, "edit", map[string]any{"path": filepath.Join(cwd, "src", "haku.ts"), "edits": []any{map[string]any{"oldText": "  return reitit.filter((r) => r.nimi.includes(sana));", "newText": "  return reitit\n    .filter((r) => r.nimi.includes(sana))\n    .filter((r) => r.nousu >= nousu);"}}}, "Haku on päivitetty. Seuraavaksi korkeus ja vanha kartta.")
	result("tc-edit-2", 101, "edit", "Successfully replaced 1 block(s) in src/haku.ts.", false)
	call("tc-write", 110, "write", map[string]any{"path": "src/korkeus.ts", "content": "export function nousu(pisteet) {\n  let summa = 0;\n  for (let i = 1; i < pisteet.length; i++)\n    summa += Math.max(0, pisteet[i] - pisteet[i - 1]);\n  return summa;\n}\n"}, "")
	result("tc-write", 111, "write", "Successfully wrote to src/korkeus.ts", false)
	call("tc-rm", 120, "bash", map[string]any{"command": "git rm -q src/vanha.ts && npm test"}, "")
	result("tc-rm", 125, "bash", "ok\n", false)
	reply("tc-reply-2", 130, "Valmista: haku ottaa korkeuseron huomioon, `src/korkeus.ts` laskee nousun ja vanha kartta on poistettu.")

	// The workspace as the turn left it, so the editor can open the files.
	if e := os.MkdirAll(filepath.Join(cwd, "src"), 0700); e != nil {
		return e
	}
	after := "export function haku(reitit, sana, nousu = 0) {\n  return reitit\n    .filter((r) => r.nimi.includes(sana))\n    .filter((r) => r.nousu >= nousu);\n}\n\nexport const oletus = 10;\n"
	if e := os.WriteFile(filepath.Join(cwd, "src", "haku.ts"), []byte(after), 0600); e != nil {
		return e
	}
	return writeRows(path, rows)
}

func writeRows(path string, rows []map[string]any) error {
	f, e := os.OpenFile(path, os.O_CREATE|os.O_TRUNC|os.O_WRONLY, 0600)
	if e != nil {
		return e
	}
	defer f.Close()
	encode := json.NewEncoder(f)
	for _, row := range rows {
		if e := encode.Encode(row); e != nil {
			return e
		}
	}
	return f.Sync()
}

// seedTurnChangesManyHistory writes a long native session for Muutokset: turn
// n writes src/t<n>.ts with n+1 lines when n is even and only lists files
// when n is odd, so every other turn has a change of its own and the older
// turns are on history pages read later, on scroll-up.
func seedTurnChangesManyHistory(path, cwd string, turns int) error {
	start := time.Date(2026, 11, 11, 9, 0, 0, 0, time.UTC)
	rows := []map[string]any{{"type": "session", "version": 3, "id": "11111111-1111-4111-8111-111111111111", "cwd": cwd, "timestamp": start.Format(time.RFC3339Nano)}}
	var parent any
	seconds := 0
	add := func(id string, message map[string]any) {
		seconds += 3
		at := start.Add(time.Duration(seconds) * time.Second)
		message["timestamp"] = at.UnixMilli()
		rows = append(rows, map[string]any{"type": "message", "id": id, "parentId": parent, "timestamp": at.Format(time.RFC3339Nano), "message": message})
		parent = id
	}
	for n := 0; n < turns; n++ {
		id := fmt.Sprintf("tcm%03d", n)
		add(id+"-user", map[string]any{"role": "user", "content": fmt.Sprintf("Pyyntö %d", n)})
		name, args, out := "bash", map[string]any{"command": "ls src"}, "haku.ts\n"
		if n%2 == 0 {
			name = "write"
			args = map[string]any{"path": fmt.Sprintf("src/t%d.ts", n), "content": strings.Repeat("export {};\n", n+1)}
			out = fmt.Sprintf("Successfully wrote to src/t%d.ts", n)
		}
		add(id+"-call", map[string]any{"role": "assistant", "stopReason": "toolUse", "content": []any{map[string]any{"type": "toolCall", "id": id + "-tool", "name": name, "arguments": args}}})
		add(id+"-result", map[string]any{"role": "toolResult", "toolCallId": id + "-tool", "toolName": name, "isError": false, "content": []any{map[string]any{"type": "text", "text": out}}})
		add(id+"-reply", map[string]any{"role": "assistant", "stopReason": "stop", "content": []any{map[string]any{"type": "text", "text": fmt.Sprintf("Vastaus %d.", n)}}})
	}
	return writeRows(path, rows)
}
