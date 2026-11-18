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

// The README story: the lab started with BROWSER_HOST_LAB_STORY=readme gives
// Alice an English home of an invented small studio (a sales folder, the
// studio's website, a newsletter, a staff handbook and a room-booking tool),
// and the fake Pi answers the story's prompts with scripted English turns:
// real native-shaped tool calls, steps paced so a capture can find them
// running, and holds a capture releases. web/lab/capture-readme.mjs drives
// it. Everything here is invented: the studio, the people, the figures, the
// addresses (example.org) and the mail.

const (
	storyFile     = "fakepi-story"
	storyHoldFile = "fakepi-story-hold"
)

// storyActive says whether the fake Pi of this home plays the README story.
func storyActive(home string) bool {
	b, _ := os.ReadFile(filepath.Join(filepath.Dir(home), storyFile))
	return strings.TrimSpace(string(b)) == "readme"
}

type storyStep struct {
	think, text string
	// tool is bash, read, write, edit or process; args are its arguments.
	tool   string
	args   map[string]any
	output string
	// files are written under the workspace when the tool finishes, as the
	// command would have written them.
	files map[string]string
	// hold keeps the tool running while the story hold file exists.
	hold bool
	// real runs a bash step's command in the workspace and shows what it
	// printed, so the terminal and the editor later agree with the turn.
	real bool
	// workers starts the handbook's three synthetic Taskfleet workers.
	workers bool
	pause   time.Duration
}

type storyScript struct {
	// title is what the synthetic title model names a conversation that
	// starts with this prompt.
	prompt, title string
	steps         []storyStep
	answer        string
}

func bashStep(command, output string) storyStep {
	return storyStep{tool: "bash", args: map[string]any{"command": command}, output: output}
}

// storyScripts are matched by the start of the person's message.
var storyScripts = []storyScript{
	{
		prompt: "Have October's sales files arrived",
		title:  "October sales report",
		steps:  []storyStep{bashStep("ls -l data/", "-rw-r--r-- 1 alice alice 41210 Nov 17 08:02 october-north.csv\n-rw-r--r-- 1 alice alice 52877 Nov 17 08:02 october-online.csv\n-rw-r--r-- 1 alice alice 38964 Nov 17 08:03 october-south.csv\n-rw-r--r-- 1 alice alice 49102 Oct 15 09:40 september-all.csv")},
		answer: "Yes. All three October files arrived yesterday morning: the north shop, the south shop and online. September's combined file is there too, for comparison.",
	},
	{
		prompt: "What is in this folder",
		title:  "Meeting room booking page",
		steps:  []storyStep{bashStep("ls -la && cat README.md", "total 12\ndrwx------ 3 alice alice 4096 Nov 18 09:12 .\ndrwx------ 9 alice alice 4096 Nov 18 09:12 ..\ndrwx------ 7 alice alice 4096 Nov 18 09:12 .git\n-rw------- 1 alice alice   62 Nov 18 09:12 README.md\n# Room booking\n\nA small page for booking the meeting room.")},
		answer: "Only a README that describes a page for booking the meeting room. Nothing has been built yet, and the folder is a Git repository with one commit.",
	},
	{
		prompt: "Make a short report of October sales",
		steps: []storyStep{
			{think: "**Checking what the spreadsheets contain**", tool: "bash", args: map[string]any{"command": "ls data/"}, output: "october-north.csv\noctober-online.csv\noctober-south.csv\nseptember-all.csv"},
			bashStep("head -4 data/october-north.csv", "date,product,units,revenue_eur\n2026-10-01,Linen tote,14,546.00\n2026-10-01,Stoneware mug,22,418.00\n2026-10-02,Wool throw,3,267.00"),
			{text: "Three regional files for October, and September's total to compare with. I'll combine them with a short Python script and draw the chart as SVG, so the report is a single page you can open anywhere.", tool: "write", args: map[string]any{"path": "report/build.py", "content": storyBuildScript}, output: "Successfully wrote to report/build.py", files: map[string]string{"report/build.py": storyBuildScript}},
			{tool: "bash", args: map[string]any{"command": "python3 report/build.py"}, output: "Read 1,284 rows from 3 files\nTotal revenue: 48,215 EUR (September 43,050 EUR, +12%)\nBest seller: Stoneware mug (1,102 units)\nWrote report/october.html", files: map[string]string{"report/october.html": storyReport}, hold: true, pause: 2 * time.Second},
		},
		answer: "The October report is ready: `report/october.html`, open beside this conversation.\n\n- **Revenue 48,215 €**, up 12 % on September.\n- **Online grew most**, +31 %, and is now a third of all sales.\n- **The south shop fell 4 %**, mostly because the Linen tote sold out on 12 October.\n- The Stoneware mug was the best seller again, 1,102 units.\n\nThe chart compares the three channels week by week. Re-running `python3 report/build.py` updates the report when November's files arrive.",
	},
	{
		prompt: "The contact page still shows the summer opening hours",
		title:  "Winter opening hours",
		steps: []storyStep{
			{tool: "bash", args: map[string]any{"command": "grep -n -A3 'Opening hours' contact.html"}, real: true},
			{tool: "edit", args: map[string]any{"path": "contact.html", "edits": []map[string]any{{"oldText": "  <p>Monday–Friday 9–18</p>\n  <p>Saturday 10–16</p>\n  <p>Sunday 12–16</p>", "newText": "  <p>Monday–Friday 10–17</p>\n  <p>Saturday 11–15</p>\n  <p>Sunday closed</p>"}}}, output: "Successfully replaced 1 block(s) in contact.html.", files: map[string]string{"contact.html": strings.Replace(storyContactPage, storySummerHours, storyWinterHours, 1)}},
			{tool: "bash", args: map[string]any{"command": "git commit -qam 'Winter opening hours on the contact page' && git log --oneline -2"}, real: true},
		},
		answer: "Done. The contact page now says:\n\n- Monday–Friday 10–17\n- Saturday 11–15\n- Sunday closed\n\nI committed the change as *Winter opening hours on the contact page*. It is not on the live site yet. Shall I publish it?",
	},
	{
		prompt: "Draft the November newsletter",
		title:  "November newsletter",
		steps: []storyStep{
			bashStep("gog calendar events --from 2026-11-01 --to 2026-11-30", "Thu 6 Nov   16:00–19:00  Autumn open studio\nFri 14 Nov  10:00–15:00  Workshop: natural dyes (12 places)\nFri 21 Nov  all day      Shop closed for stocktaking\nFri 28 Nov  until 21:00  Late-night shopping"),
			bashStep("gog gmail search 'subject:newsletter in:sent' --max 1", "2 Oct  “October at the studio”  to: newsletter@example.org (214 subscribers)"),
			{tool: "write", args: map[string]any{"path": "drafts/2026-11.md", "content": storyNewsletter}, output: "Successfully wrote to drafts/2026-11.md", files: map[string]string{"drafts/2026-11.md": storyNewsletter}},
		},
		answer: "The draft is in `drafts/2026-11.md`, in the same tone and length as October's: the open studio first, then the dye workshop (12 places), the late-night shopping, and a note that the shop is closed on 21 November.\n\nShould I save it as a draft in Gmail for you to check, or send it to the 214 subscribers now?",
	},
	{
		prompt: "Build a simple page where the team can book the meeting room",
		steps: []storyStep{
			{think: "**Planning a small booking service**", text: "I'll make it one small Python service with no extra packages: a week view of the room, and bookings saved in a file in this folder so they survive a restart.", tool: "write", args: map[string]any{"path": "app.py", "content": storyBookingApp}, output: "Successfully wrote to app.py", files: map[string]string{"app.py": storyBookingApp}},
			{tool: "write", args: map[string]any{"path": "test_app.py", "content": storyBookingTests}, output: "Successfully wrote to test_app.py", files: map[string]string{"test_app.py": storyBookingTests}},
			{tool: "bash", args: map[string]any{"command": "python3 -m pytest -q"}, output: "....                                                     [100%]\n4 passed in 0.21s", hold: true, pause: 2 * time.Second},
			{tool: "process", args: map[string]any{"action": "start", "name": "room-booking", "command": "python3 app.py --port 8080"}, output: "Started process room-booking (proc_8080)."},
			bashStep("curl -s localhost:8080/health", `{"status": "ok", "room": "Meeting room", "bookings": 0}`),
		},
		answer: "The room booking page is running on the server as the background process **room-booking**, on port 8080.\n\n- The week view shows free and booked slots; anyone picks a slot and writes their name.\n- Bookings are kept in `bookings.json` in this folder.\n- Four tests cover double bookings and bookings in the past.\n\nTo open it from everyone's browser, the server's administrator gives it an address. I can write them a short note with what it needs.",
	},
	{
		prompt: "Make the slots 30 minutes",
		steps: []storyStep{
			{tool: "edit", args: map[string]any{"path": "app.py", "edits": []map[string]any{{"oldText": "SLOT_MINUTES = 60", "newText": "SLOT_MINUTES = 30"}}}, output: "Successfully replaced 1 block(s) in app.py."},
			bashStep("python3 -m pytest -q", "....                                                     [100%]\n4 passed in 0.20s"),
		},
		answer: "Slots are 30 minutes now, and the tests still pass.",
	},
	{
		prompt: "When it runs, write a short note",
		steps: []storyStep{
			{tool: "write", args: map[string]any{"path": "HOW-TO-BOOK.md", "content": storyBookingNote}, output: "Successfully wrote to HOW-TO-BOOK.md", files: map[string]string{"HOW-TO-BOOK.md": storyBookingNote}},
		},
		answer: "The note for the team is in `HOW-TO-BOOK.md`: how to book, how to cancel, and who to ask if the page does not open.",
	},
	{
		prompt: "Check every page of the staff handbook",
		title:  "Handbook and the new policy",
		steps: []storyStep{
			bashStep("ls pages | wc -l && grep -lis 'travel\\|remote\\|expense' pages/*.md", "18\npages/04-working-hours.md\npages/05-remote-work.md\npages/06-equipment.md\npages/09-travel.md\npages/10-booking-travel.md\npages/11-per-diems.md\npages/12-expenses.md\npages/13-receipts.md\npages/16-security.md"),
			{text: "18 pages, and 9 of them touch the new policy. I'll split them between three workers, one per section, each on its own branch so you can review the changes separately.", tool: "bash", args: map[string]any{"command": "taskfleet run create --kind spinoff --title handbook-travel …  (3 runs)"}, output: "created handbook-travel        01m7r2c4tr4ve10000000000a1\ncreated handbook-remote-work   01m7r2c4rem0te0000000000a2\ncreated handbook-expenses      01m7r2c4expen5e0000000000a", workers: true},
		},
		answer: "Three workers are on it:\n\n- **Travel**: booking rules and the new per-diem rates.\n- **Remote work**: the two-days-a-week rule and equipment at home.\n- **Expenses**: receipts and the new approval limit.\n\nEach works on its own branch. When they are done I'll bring the changes together and list what changed, page by page.",
	},
}

// storyTitle is the title model's answer for a conversation whose text
// starts one of the story's conversations.
func storyTitle(text string) string {
	for _, script := range storyScripts {
		if script.title != "" && strings.Contains(text, script.prompt) {
			return script.title
		}
	}
	return ""
}

// storyTurn plays one scripted turn and reports whether the prompt was the
// story's. The emitted events and saved entries follow the shapes of the
// fake's other turns (longRun).
func (s *fakeSession) storyTurn(prompt string, run chan struct{}, emit func(any)) bool {
	var script *storyScript
	for i := range storyScripts {
		if strings.HasPrefix(prompt, storyScripts[i].prompt) {
			script = &storyScripts[i]
		}
	}
	if script == nil {
		return false
	}
	model, provider := "claude-sonnet-5-5", "anthropic"
	if s.model != "" {
		model, provider = s.model, s.provider
	}
	meta := func(stop string) map[string]any {
		return map[string]any{"provider": provider, "model": model, "stopReason": stop}
	}
	holdFile := filepath.Join(filepath.Dir(os.Getenv("HOME")), storyHoldFile)
	stop := func() { emit(map[string]any{"type": "agent_end"}) }
	for n, step := range script.steps {
		pause := step.pause
		if pause == 0 {
			pause = 1500 * time.Millisecond
		}
		if s.pause(run, pause) {
			stop()
			return true
		}
		emit(map[string]any{"type": "turn_start"})
		content := []map[string]any{}
		index := 0
		if step.think != "" {
			emit(map[string]any{"type": "message_update", "assistantMessageEvent": map[string]any{"type": "thinking_delta", "contentIndex": index, "delta": step.think}})
			content = append(content, map[string]any{"type": "thinking", "thinking": step.think})
			index++
		}
		if step.text != "" {
			emit(map[string]any{"type": "message_update", "message": map[string]any{"role": "assistant"}, "assistantMessageEvent": map[string]any{"type": "text_delta", "contentIndex": index, "delta": step.text}})
			content = append(content, map[string]any{"type": "text", "text": step.text})
			index++
		}
		callID := fmt.Sprintf("call_story_%d_%d", time.Now().UnixNano(), n)
		emit(map[string]any{"type": "message_update", "assistantMessageEvent": map[string]any{"type": "toolcall_start", "contentIndex": index, "toolName": step.tool, "id": callID}})
		emit(map[string]any{"type": "message_update", "assistantMessageEvent": map[string]any{"type": "toolcall_end", "contentIndex": index, "toolCall": map[string]any{"id": callID, "name": step.tool, "arguments": step.args}}})
		content = append(content, map[string]any{"type": "toolCall", "id": callID, "name": step.tool, "arguments": step.args})
		s.append(message("assistant", content, meta("toolUse")))
		emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "assistant", "stopReason": "toolUse"}})
		emit(map[string]any{"type": "tool_execution_start", "toolName": step.tool, "toolCallId": callID, "args": step.args})
		aborted := s.pause(run, pause)
		for step.hold && !aborted {
			if _, err := os.Stat(holdFile); err != nil {
				break
			}
			aborted = s.pause(run, 100*time.Millisecond)
		}
		if aborted {
			s.append(message("toolResult", []map[string]any{{"type": "text", "text": "Command aborted"}}, map[string]any{"toolCallId": callID, "toolName": step.tool, "isError": true}))
			emit(map[string]any{"type": "tool_execution_end", "toolName": step.tool, "toolCallId": callID, "isError": true, "result": map[string]any{"content": []map[string]any{{"type": "text", "text": "Command aborted"}}}})
			stop()
			return true
		}
		for name, text := range step.files {
			path := filepath.Join(s.cwd, name)
			_ = os.MkdirAll(filepath.Dir(path), 0700)
			_ = os.WriteFile(path, []byte(text), 0600)
		}
		if step.real {
			cmd := exec.Command("/bin/sh", "-c", step.args["command"].(string))
			cmd.Dir = s.cwd
			cmd.Env = []string{"PATH=/usr/bin:/bin", "HOME=" + os.Getenv("HOME"), "GIT_CONFIG_NOSYSTEM=1"}
			b, _ := cmd.CombinedOutput()
			step.output = strings.TrimRight(string(b), "\n")
		}
		if step.workers {
			_ = storyWorkers(os.Getenv("HOME"), s.cwd, s.id)
		}
		result := map[string]any{"content": []map[string]any{{"type": "text", "text": step.output}}}
		extra := map[string]any{"toolCallId": callID, "toolName": step.tool, "isError": false}
		if step.tool == "process" {
			// pi-processes' start result, as the fake's own process turn.
			extra["details"] = map[string]any{"action": "start", "process": map[string]any{"id": "proc_8080", "name": step.args["name"], "command": step.args["command"], "startTime": time.Now().UnixMilli(), "status": "running"}, "notify": map[string]any{"onSuccess": "turn", "onFailure": "turn", "onKilled": "context"}}
		}
		emit(map[string]any{"type": "tool_execution_update", "toolName": step.tool, "toolCallId": callID, "args": step.args, "partialResult": result})
		s.append(message("toolResult", []map[string]any{{"type": "text", "text": step.output}}, extra))
		emit(map[string]any{"type": "tool_execution_end", "toolName": step.tool, "toolCallId": callID, "isError": false, "result": result})
		emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "toolResult"}})
		emit(map[string]any{"type": "turn_end"})
	}
	if s.pause(run, 1200*time.Millisecond) {
		stop()
		return true
	}
	emit(map[string]any{"type": "turn_start"})
	emit(map[string]any{"type": "message_update", "message": map[string]any{"role": "assistant"}, "assistantMessageEvent": map[string]any{"type": "text_delta", "contentIndex": 0, "delta": script.answer}})
	final := meta("stop")
	final["usage"] = s.replyUsage(prompt)
	s.append(message("assistant", []map[string]any{{"type": "text", "text": script.answer}}, final))
	emit(map[string]any{"type": "message_end", "message": map[string]any{"role": "assistant"}})
	emit(map[string]any{"type": "turn_end"})
	stop()
	return true
}

// storyWorkers gives the handbook conversation three workers in Taskfleet's
// native shapes: a worktree and branch each, a run record attributed to the
// conversation, and each worker's own Pi session. Two are at work and one
// has landed. Runs are listed by `run list`; `run show` reads each run's own
// show.json (the fixture taskfleet's per-run detail).
func storyWorkers(home, repo, parent string) error {
	type worker struct{ id, title, branch, brief, status string }
	workers := []worker{
		{"01m7r2c4tr4ve10000000000a1", "handbook-travel", "handbook-travel", "Update the travel pages (09–11) to the new travel policy: booking through the shared calendar, and the new per-diem rates.", "running"},
		{"01m7r2c4rem0te0000000000a2", "handbook-remote-work", "handbook-remote-work", "Update the remote-work pages (04–06) to the new policy: two office days a week, and equipment at home.", "running"},
		{"01m7r2c4expen5e0000000000a", "handbook-expenses", "handbook-expenses", "Update the expense pages (12, 13, 16) to the new policy: receipts as photos, and the 500 € approval limit.", "done"},
	}
	root := filepath.Join(home, ".taskfleet")
	git := func(dir string, args ...string) error {
		cmd := exec.Command("/usr/bin/git", append([]string{"-C", dir, "-c", "user.name=Alice Example", "-c", "user.email=alice@example.org"}, args...)...)
		cmd.Env = []string{"PATH=/usr/bin:/bin", "HOME=" + home, "GIT_CONFIG_NOSYSTEM=1"}
		return cmd.Run()
	}
	var runs []any
	created := time.Now().UTC()
	for i, w := range workers {
		tree := filepath.Join(filepath.Dir(repo), filepath.Base(repo)+"__worktrees", w.branch)
		if err := git(repo, "worktree", "add", "-q", "-b", w.branch, tree, "main"); err != nil {
			return err
		}
		_ = git(repo, "config", "branch."+w.branch+".workmux-base", "main")
		page := map[string]string{"handbook-travel": "pages/09-travel.md", "handbook-remote-work": "pages/05-remote-work.md", "handbook-expenses": "pages/12-expenses.md"}[w.branch]
		_ = os.WriteFile(filepath.Join(tree, page), []byte(storyHandbookPage(page)+"\nUpdated to the November 2026 policy.\n"), 0600)
		if w.status == "done" {
			_ = git(tree, "commit", "-qam", "Expenses pages follow the new policy")
		}
		transcript := "runs/" + w.id + "/session.jsonl"
		run := map[string]any{
			"run_id": w.id, "kind": "spinoff", "title": w.title, "status": w.status,
			"lifecycle": "headless", "agent_owner": "taskfleet", "source_branch": "main", "harness": "pi",
			"source_repo": repo, "worktree_path": tree, "created_at": created.Add(time.Duration(i) * time.Second).Format(time.RFC3339Nano),
			"created_by_session": map[string]string{"harness": "pi", "session_id": parent},
			"supervisor":         map[string]string{"state": "running"},
			"node_transcripts": []any{map[string]any{
				"node_id": "n-0001", "harness": "pi", "support": "supported", "worktree_path": tree,
				"live": map[string]any{"anchor": "state-root", "path": transcript, "availability": "available"},
			}},
			"preserved_work": []any{map[string]any{"branch": w.branch, "worktree_path": tree, "branch_present": true, "worktree_present": true}},
			"report":         map[string]string{"summary": ""},
		}
		if w.status == "done" {
			run["landed"] = true
			run["report"] = map[string]string{"summary": "Pages 12, 13 and 16 follow the new expense policy: receipts as photos in the shared folder, and approval needed above 500 €."}
			run["manifest"] = map[string]string{"updated_at": time.Now().UTC().Format(time.RFC3339Nano)}
		}
		dir := filepath.Join(root, "runs", w.id)
		if err := os.MkdirAll(dir, 0700); err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(dir, "prompt.md"), []byte(w.brief+"\n"), 0600); err != nil {
			return err
		}
		if err := writeStoryWorkerSession(filepath.Join(root, transcript), tree, w.id, w.brief, page, w.status == "done"); err != nil {
			return err
		}
		for name, value := range map[string]any{"manifest.json": run, "show.json": map[string]any{"schema_version": 1, "data": run}} {
			b, _ := json.Marshal(value)
			if err := os.WriteFile(filepath.Join(dir, name), b, 0600); err != nil {
				return err
			}
		}
		runs = append(runs, run)
	}
	b, _ := json.Marshal(map[string]any{"schema_version": 1, "data": map[string]any{"runs": runs}})
	return os.WriteFile(filepath.Join(root, "fixture-list.json"), b, 0600)
}

func writeStoryWorkerSession(path, cwd, id, brief, page string, done bool) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()
	enc := json.NewEncoder(f)
	at := time.Now().Add(-2 * time.Minute)
	_ = enc.Encode(map[string]any{"type": "session", "version": 3, "id": id, "timestamp": at.UTC().Format(time.RFC3339Nano), "cwd": cwd})
	n := 0
	var parent any
	write := func(role string, content any, extra map[string]any) {
		n++
		entry := fmt.Sprintf("w%07d", n)
		m := map[string]any{"role": role, "content": content, "timestamp": at.Add(time.Duration(n) * 10 * time.Second).UnixMilli()}
		for k, v := range extra {
			m[k] = v
		}
		_ = enc.Encode(map[string]any{"type": "message", "id": entry, "parentId": parent, "timestamp": at.Add(time.Duration(n) * 10 * time.Second).UTC().Format(time.RFC3339Nano), "message": m})
		parent = entry
	}
	model := map[string]any{"provider": "anthropic", "model": "claude-sonnet-5-5", "stopReason": "toolUse"}
	write("user", []map[string]any{{"type": "text", "text": brief}}, nil)
	write("assistant", []map[string]any{{"type": "toolCall", "id": "r1", "name": "read", "arguments": map[string]any{"path": page}}}, model)
	write("toolResult", []map[string]any{{"type": "text", "text": storyHandbookPage(page)}}, map[string]any{"toolCallId": "r1", "toolName": "read", "isError": false})
	write("assistant", []map[string]any{{"type": "text", "text": "The page still describes the old policy. Updating it now."}, {"type": "toolCall", "id": "e1", "name": "edit", "arguments": map[string]any{"path": page, "edits": []map[string]any{{"oldText": "old policy", "newText": "November 2026 policy"}}}}}, model)
	write("toolResult", []map[string]any{{"type": "text", "text": "Successfully replaced 1 block(s) in " + page + "."}}, map[string]any{"toolCallId": "e1", "toolName": "edit", "isError": false})
	if done {
		final := map[string]any{"provider": "anthropic", "model": "claude-sonnet-5-5", "stopReason": "stop"}
		write("assistant", []map[string]any{{"type": "text", "text": "Pages 12, 13 and 16 follow the new expense policy. Committed on handbook-expenses and merged."}}, final)
	}
	return nil
}

func storyHandbookPage(page string) string {
	title := strings.TrimSuffix(filepath.Base(page), ".md")
	title = strings.ReplaceAll(title[3:], "-", " ")
	return "# " + strings.ToUpper(title[:1]) + title[1:] + "\n\nThis page follows the old policy from 2024.\n"
}

// storyGitHub is a prefix for the synthetic gh: in the story, the account's
// repositories are the studio's, for the getting-started chooser.
func storyGitHub(story bool, subject, username string) string {
	if !story {
		return ""
	}
	return `case "$4" in
 /user) printf '{"id":` + subject + `,"login":"` + username + `-example","name":"` + strings.ToUpper(username[:1]) + username[1:] + ` Example"}\n'; exit 0 ;;
 /user/repos*page=1\&*)
   printf '['
   row example-studio website false '"The studio website"' '"2026-11-17T15:20:00Z"' 2048 Organization
   printf ','; row example-studio staff-handbook true '"Staff handbook, one page per topic"' '"2026-11-12T09:00:00Z"' 512 Organization
   printf ','; row example-studio price-list true '"Prices and product sheets"' '"2026-11-03T11:40:00Z"' 256 Organization
   printf ','; row example-studio brand-guide false '"Logo, colours and type"' '"2026-10-21T08:10:00Z"' 9216 Organization
   printf ','; row example-studio workshop-bookings true '"Workshop sign-ups and waiting lists"' '"2026-10-02T13:30:00Z"' 128 Organization
   printf ']\n'; exit 0 ;;
 /user/repos*) printf '[]\n'; exit 0 ;;
esac
`
}

// seedReadmeStory replaces Alice's lab home with the story's workspaces and
// a few older English conversations; the live ones are started by the
// capture through the browser.
func seedReadmeStory(home string) error {
	for _, name := range []string{"git-project", "ordinary-dir", "without-metadata"} {
		if e := os.RemoveAll(filepath.Join(home, "src", name)); e != nil {
			return e
		}
	}
	if e := os.RemoveAll(filepath.Join(home, ".pi", "agent", "sessions")); e != nil {
		return e
	}
	if e := os.WriteFile(filepath.Join(home, ".gitconfig"), []byte("[user]\n\tname = Alice Example\n\temail = alice@example.org\n"), 0600); e != nil {
		return e
	}
	if e := os.WriteFile(filepath.Join(home, ".bash_profile"), []byte("PS1='\\[\\e[1;32m\\]alice@habitat\\[\\e[0m\\]:\\[\\e[1;34m\\]\\w\\[\\e[0m\\]\\$ '\nexport HISTFILE=/dev/null\n"), 0600); e != nil {
		return e
	}
	handbook := map[string]string{}
	for _, page := range []string{"01-welcome", "02-who-we-are", "03-first-week", "04-working-hours", "05-remote-work", "06-equipment", "07-holidays", "08-sick-leave", "09-travel", "10-booking-travel", "11-per-diems", "12-expenses", "13-receipts", "14-tools", "15-email-and-chat", "16-security", "17-wellbeing", "18-contacts"} {
		handbook["pages/"+page+".md"] = storyHandbookPage("pages/" + page + ".md")
	}
	handbook["README.md"] = "# Staff handbook\n\nThe studio's staff handbook, one page per topic.\n"
	workspaces := []struct {
		name, remote string
		git          bool
		files        map[string]string
	}{
		{"sales-report", "", false, map[string]string{
			"data/october-north.csv":  storySales("north"),
			"data/october-south.csv":  storySales("south"),
			"data/october-online.csv": storySales("online"),
			"data/september-all.csv":  storySales("all"),
			"report/README.md":        "Monthly sales reports.\n",
		}},
		{"website", "https://github.com/example-studio/website.git", true, map[string]string{
			"index.html":   "<!doctype html>\n<title>Example Studio</title>\n<h1>Example Studio</h1>\n<p>Ceramics, textiles and workshops.</p>\n",
			"contact.html": storyContactPage,
			"styles.css":   "body { font-family: system-ui, sans-serif; margin: 2rem auto; max-width: 40rem; }\n",
			"favicon.svg":  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#b4532a"/><circle cx="16" cy="16" r="7" fill="#fff"/></svg>` + "\n",
		}},
		{"newsletter", "", false, map[string]string{
			"drafts/2026-10.md": "# October at the studio\n\nSynthetic past newsletter.\n",
		}},
		{"room-booking", "", true, map[string]string{
			"README.md": "# Room booking\n\nA small page for booking the meeting room.\n",
		}},
		{"staff-handbook", "", true, handbook},
	}
	for _, w := range workspaces {
		dir := filepath.Join(home, "src", w.name)
		for name, text := range w.files {
			p := filepath.Join(dir, name)
			if e := os.MkdirAll(filepath.Dir(p), 0700); e != nil {
				return e
			}
			if e := os.WriteFile(p, []byte(text), 0600); e != nil {
				return e
			}
		}
		if !w.git {
			continue
		}
		run := func(args ...string) error {
			cmd := exec.Command("/usr/bin/git", append([]string{"-C", dir, "-c", "user.name=Alice Example", "-c", "user.email=alice@example.org"}, args...)...)
			cmd.Env = []string{"PATH=/usr/bin:/bin", "HOME=" + home, "GIT_CONFIG_NOSYSTEM=1"}
			return cmd.Run()
		}
		if e := run("init", "-q", "-b", "main"); e != nil {
			return e
		}
		if w.remote != "" {
			if e := run("remote", "add", "origin", w.remote); e != nil {
				return e
			}
			if e := os.WriteFile(filepath.Join(dir, ".git", "origin"), []byte(w.remote+"\n"), 0600); e != nil {
				return e
			}
		}
		if e := run("add", "."); e != nil {
			return e
		}
		if e := run("commit", "-qm", "Start "+w.name); e != nil {
			return e
		}
	}
	// Connected Google and Microsoft 365 accounts for the fixture catalog,
	// with Drive's folders chosen.
	for provider, address := range map[string]string{"google": "alice@example.org", "microsoft": "alice@studio.example.org"} {
		dir := filepath.Join(home, ".config", "fixture-integrations", provider)
		if e := os.MkdirAll(dir, 0700); e != nil {
			return e
		}
		content := "own\nshared"
		if provider == "microsoft" {
			content = ""
		}
		if e := os.WriteFile(filepath.Join(dir, address), []byte(content), 0600); e != nil {
			return e
		}
	}
	base := time.Now().Add(-26 * time.Hour)
	sessions := []struct {
		workspace, id string
		age           time.Duration
		ask, answer   string
	}{
		{"staff-handbook", "d4d4d4d4-0000-4000-8000-000000000011", 2 * time.Hour, "Turn the notes from Tuesday's team meeting into a list of actions with owners.", "Seven actions, each with an owner and a date, are in `meetings/2026-11-11-actions.md`. Two had no owner in the notes; I marked them *to be agreed*."},
		{"sales-report", "d4d4d4d4-0000-4000-8000-000000000012", 26 * time.Hour, "Which products sold best in September?", "The Stoneware mug (964 units) and the Linen tote (701) were well ahead; the Wool throw was third by revenue."},
		{"website", "d4d4d4d4-0000-4000-8000-000000000013", 50 * time.Hour, "Add the new autumn photos to the gallery page.", "The twelve photos are on the gallery page, resized for the web and with alt text. The page is about 40 % lighter than before."},
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
		model := map[string]any{"provider": "anthropic", "model": "claude-sonnet-5-5"}
		rows := []map[string]any{
			{"role": "user", "content": []map[string]any{{"type": "text", "text": s.ask}}},
			{"role": "assistant", "content": []map[string]any{{"type": "text", "text": s.answer}}, "stopReason": "stop"},
		}
		var parent any
		for i, m := range rows {
			id := fmt.Sprintf("s%07d", i+1)
			m["timestamp"] = at.Add(time.Duration(i) * time.Minute).UnixMilli()
			if m["role"] == "assistant" {
				for k, v := range model {
					m[k] = v
				}
			}
			_ = enc.Encode(map[string]any{"type": "message", "id": id, "parentId": parent, "timestamp": at.Add(time.Duration(i) * time.Minute).UTC().Format(time.RFC3339Nano), "message": m})
			parent = id
		}
		if e := f.Close(); e != nil {
			return e
		}
		_ = os.Chtimes(path, at, at)
	}
	return nil
}

// storySales is an invented month of one channel's sales.
func storySales(channel string) string {
	products := []struct {
		name  string
		price float64
	}{{"Linen tote", 39}, {"Stoneware mug", 19}, {"Wool throw", 89}, {"Plant pot", 24}}
	var b strings.Builder
	b.WriteString("date,product,units,revenue_eur\n")
	seed := len(channel)
	for day := 1; day <= 31; day++ {
		for i, p := range products {
			units := (day*7+i*5+seed*3)%17 + 2
			if channel == "north" && day == 1 {
				units = []int{14, 22, 3, 6}[i]
			}
			fmt.Fprintf(&b, "2026-10-%02d,%s,%d,%.2f\n", day, p.name, units, float64(units)*p.price)
		}
	}
	return b.String()
}

const storySummerHours = "  <p>Monday–Friday 9–18</p>\n  <p>Saturday 10–16</p>\n  <p>Sunday 12–16</p>"
const storyWinterHours = "  <p>Monday–Friday 10–17</p>\n  <p>Saturday 11–15</p>\n  <p>Sunday closed</p>"

var storyContactPage = "<!doctype html>\n<html lang=\"en\">\n<head>\n  <meta charset=\"utf-8\">\n  <title>Contact · Example Studio</title>\n  <link rel=\"stylesheet\" href=\"styles.css\">\n</head>\n<body>\n<section>\n  <h1>Visit the studio</h1>\n  <p>Harbour Street 12, Example Town</p>\n  <p>hello@example.org</p>\n</section>\n<section>\n  <h2>Opening hours</h2>\n" + storySummerHours + "\n</section>\n</body>\n</html>\n"

const storyBuildScript = `"""Combine October's sales files into one HTML report with a chart."""
import csv
from collections import defaultdict
from pathlib import Path

DATA = Path("data")
OUT = Path("report/october.html")
CHANNELS = ("north", "south", "online")

def read(name):
    with open(DATA / name, newline="") as f:
        return list(csv.DictReader(f))

october = {c: read(f"october-{c}.csv") for c in CHANNELS}
september = sum(float(r["revenue_eur"]) for r in read("september-all.csv"))
revenue = {c: sum(float(r["revenue_eur"]) for r in rows) for c, rows in october.items()}
total = sum(revenue.values())

units = defaultdict(int)
for rows in october.values():
    for r in rows:
        units[r["product"]] += int(r["units"])
best = max(units, key=units.get)

weeks = defaultdict(lambda: defaultdict(float))
for c, rows in october.items():
    for r in rows:
        weeks[int(r["date"][8:]) // 7][c] += float(r["revenue_eur"])

bars = "".join(
    f'<rect x="{70 + w * 130 + i * 32}" y="{200 - v / 50:.0f}" width="30" '
    f'height="{v / 50:.0f}" class="{c}"/>'
    for w, week in sorted(weeks.items()) for i, (c, v) in enumerate(week.items())
)
rows = "".join(f"<tr><td>{p}</td><td>{n:,}</td></tr>"
               for p, n in sorted(units.items(), key=lambda x: -x[1]))
OUT.write_text(f"""<!doctype html><title>October sales</title>
<h1>October sales</h1><p>{total:,.0f} € ({total / september - 1:+.0%})</p>
<svg viewBox="0 0 700 230">{bars}</svg><table>{rows}</table>""")

print(f"Read {sum(map(len, october.values())):,} rows from {len(october)} files")
print(f"Total revenue: {total:,.0f} EUR (September {september:,.0f} EUR, "
      f"{total / september - 1:+.0%})")
print(f"Best seller: {best} ({units[best]:,} units)")
print(f"Wrote {OUT}")
`

// storyReport is the page build.py writes: one invented month, figures as
// the turn's answer states them.
const storyReport = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>October 2026 sales</title>
<style>
  body { font-family: system-ui, -apple-system, "Segoe UI", sans-serif; color: #1f2a24; margin: 0; background: #fbfaf7; }
  main { max-width: 760px; margin: 0 auto; padding: 32px 28px 48px; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  .sub { color: #5c6b62; margin: 0 0 24px; }
  .kpis { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 28px; }
  .kpi { background: #fff; border: 1px solid #e3e0d8; border-radius: 10px; padding: 14px 16px; }
  .kpi b { display: block; font-size: 24px; }
  .kpi span { color: #5c6b62; font-size: 13px; }
  .up { color: #2f7d4f; } .down { color: #b4532a; }
  h2 { font-size: 17px; margin: 28px 0 10px; }
  table { width: 100%; border-collapse: collapse; background: #fff; border: 1px solid #e3e0d8; border-radius: 10px; overflow: hidden; }
  th, td { text-align: left; padding: 9px 14px; border-bottom: 1px solid #eeebe4; font-size: 14px; }
  th { background: #f3f1ec; font-weight: 600; }
  td.n, th.n { text-align: right; font-variant-numeric: tabular-nums; }
  .legend span { display: inline-flex; align-items: center; gap: 6px; margin-right: 16px; font-size: 13px; color: #5c6b62; }
  .legend i { width: 12px; height: 12px; border-radius: 3px; display: inline-block; }
</style>
</head>
<body>
<main>
  <h1>October 2026 sales</h1>
  <p class="sub">Example Studio · north shop, south shop and online</p>
  <div class="kpis">
    <div class="kpi"><span>Revenue</span><b>48,215 €</b><span class="up">+12 % on September</span></div>
    <div class="kpi"><span>Online</span><b>16,140 €</b><span class="up">+31 %</span></div>
    <div class="kpi"><span>South shop</span><b>13,480 €</b><span class="down">−4 %</span></div>
  </div>
  <h2>Revenue by week</h2>
  <div class="legend"><span><i style="background:#2f6f5e"></i>North shop</span><span><i style="background:#d08c4f"></i>South shop</span><span><i style="background:#6b8fc7"></i>Online</span></div>
  <svg viewBox="0 0 700 230" width="100%" role="img" aria-label="Weekly revenue by channel">
    <g stroke="#e3e0d8"><line x1="40" y1="20" x2="690" y2="20"/><line x1="40" y1="80" x2="690" y2="80"/><line x1="40" y1="140" x2="690" y2="140"/><line x1="40" y1="200" x2="690" y2="200"/></g>
    <g fill="#5c6b62" font-size="11"><text x="4" y="24">6k</text><text x="4" y="84">4k</text><text x="4" y="144">2k</text><text x="10" y="204">0</text></g>
    <g>
      <rect x="70" y="80" width="30" height="120" fill="#2f6f5e"/><rect x="102" y="104" width="30" height="96" fill="#d08c4f"/><rect x="134" y="113" width="30" height="87" fill="#6b8fc7"/>
      <rect x="200" y="74" width="30" height="126" fill="#2f6f5e"/><rect x="232" y="92" width="30" height="108" fill="#d08c4f"/><rect x="264" y="98" width="30" height="102" fill="#6b8fc7"/>
      <rect x="330" y="86" width="30" height="114" fill="#2f6f5e"/><rect x="362" y="116" width="30" height="84" fill="#d08c4f"/><rect x="394" y="86" width="30" height="114" fill="#6b8fc7"/>
      <rect x="460" y="77" width="30" height="123" fill="#2f6f5e"/><rect x="492" y="119" width="30" height="81" fill="#d08c4f"/><rect x="524" y="71" width="30" height="129" fill="#6b8fc7"/>
      <rect x="590" y="140" width="30" height="60" fill="#2f6f5e"/><rect x="622" y="158" width="30" height="42" fill="#d08c4f"/><rect x="654" y="134" width="30" height="66" fill="#6b8fc7"/>
    </g>
    <g fill="#5c6b62" font-size="12"><text x="96" y="220">Week 40</text><text x="226" y="220">Week 41</text><text x="356" y="220">Week 42</text><text x="486" y="220">Week 43</text><text x="606" y="220">29–31 Oct</text></g>
  </svg>
  <h2>Best sellers</h2>
  <table>
    <tr><th>Product</th><th class="n">Units</th><th class="n">Revenue</th><th class="n">vs September</th></tr>
    <tr><td>Stoneware mug</td><td class="n">1,102</td><td class="n">20,938 €</td><td class="n up">+14 %</td></tr>
    <tr><td>Linen tote</td><td class="n">288</td><td class="n">11,232 €</td><td class="n down">−9 %</td></tr>
    <tr><td>Wool throw</td><td class="n">97</td><td class="n">8,633 €</td><td class="n up">+22 %</td></tr>
    <tr><td>Plant pot</td><td class="n">309</td><td class="n">7,412 €</td><td class="n up">+6 %</td></tr>
  </table>
</main>
</body>
</html>
`

const storyNewsletter = `# November at the studio

The evenings are dark, the kilns are warm. Here is what is on this month.

## Autumn open studio · Thursday 6 November, 16–19
Come and see the new stoneware before it reaches the shop.

## Workshop: natural dyes · Friday 14 November, 10–15
Dye a linen scarf with onion skins and walnut. 12 places.

## Late-night shopping · Friday 28 November, until 21
Mulled juice, and 10 % off everything in the shop.

The shop is closed on Friday 21 November for stocktaking.
`

const storyBookingApp = `"""Meeting room booking: a week view and bookings in bookings.json."""
import json
from datetime import date, datetime, timedelta
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

ROOM = "Meeting room"
SLOT_MINUTES = 60
STORE = Path(__file__).with_name("bookings.json")

def load():
    return json.loads(STORE.read_text()) if STORE.exists() else []

def book(start, name):
    bookings = load()
    if datetime.fromisoformat(start) < datetime.now():
        raise ValueError("That time has passed.")
    if any(b["start"] == start for b in bookings):
        raise ValueError("That slot is already booked.")
    bookings.append({"start": start, "name": name})
    STORE.write_text(json.dumps(bookings, indent=2))
`

const storyBookingTests = `from app import book, load

def test_books_a_free_slot(tmp_path, monkeypatch): ...
def test_refuses_a_double_booking(tmp_path, monkeypatch): ...
def test_refuses_the_past(tmp_path, monkeypatch): ...
def test_bookings_survive_a_restart(tmp_path, monkeypatch): ...
`

const storyBookingNote = `# Booking the meeting room

1. Open the room booking page.
2. Pick a free slot in the week view and write your name.
3. To cancel, open your booking and choose Cancel.

If the page does not open, tell Alice.
`
