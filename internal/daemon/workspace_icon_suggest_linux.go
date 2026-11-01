//go:build linux

package daemon

import (
	"bytes"
	"context"
	_ "embed"
	"encoding/base64"
	"encoding/json"
	"errors"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
	"unicode"
	"unicode/utf8"

	"github.com/Open-Habitat/open-habitat/internal/diagnostic"
	"golang.org/x/sys/unix"
)

//go:embed icon-helper.mjs
var iconHelper string

// Icon suggestions (Sirut, Jari 2026-10-30) come from the person's own model
// credentials through the same native path as conversation titles: a one-shot
// helper on the selected Pi installation, run as the person, with a fixed
// budget and fixed failure codes. The model sees only a bounded set of facts
// the daemon reads from the workspace; repository text can try to steer it,
// so every answer is validated here against the icon's flat format, and the
// worst a hostile README achieves is a poor emoji. Nothing is stored here:
// the page keeps the rounds in the browser.
//
// The budget leaves room for a slow provider: gpt-6-luna answers in about
// three seconds on a good day, but timed out at 15 s on the test server, and
// a person waits with the elapsed seconds on show rather than being cut off.
// The journal records every outcome with its duration, so the bound can be
// revisited from real calls.
const (
	WorkspaceIconSuggestionsPath = "/api/v1/workspaces/icon/suggestions"
	iconSuggestionLimit          = 45 * time.Second
	maxIconSuggestions           = 5
	maxIconReadme                = 2048
	maxIconWish                  = 4096
	maxIconRequest               = 98304
	maxIconRounds                = 3
	maxIconWhy                   = 60
	maxIconReply                 = 200
)

var iconModelPattern = regexp.MustCompile(`^[a-z0-9][a-z0-9-]{0,40}/[A-Za-z0-9][A-Za-z0-9._:-]{0,100}$`)

type iconRound struct {
	Wish  string   `json:"wish"`
	Icons []string `json:"icons"`
}

type iconSuggestionRequest struct {
	SchemaVersion int         `json:"schema_version"`
	WorkspaceID   string      `json:"workspace_id"`
	Wish          string      `json:"wish"`
	History       []iconRound `json:"history"`
}

// iconFacts is everything the model is told about the workspace, and what
// the page says it was told.
type iconFacts struct {
	Name      string         `json:"name"`
	Display   string         `json:"display_name,omitempty"`
	Readme    string         `json:"readme,omitempty"`
	StartPage string         `json:"start_page,omitempty"`
	Languages []iconLanguage `json:"languages,omitempty"`
	Logo      string         `json:"logo,omitempty"`
}

type iconLanguage struct {
	Name    string `json:"name"`
	Percent int    `json:"percent"`
}

type iconSuggestion struct {
	Icon string `json:"icon"`
	Why  string `json:"why"`
}

// The per-request suggester; the unit tests replace it.
type iconSuggester func(ctx context.Context, input []byte) (model, reply string, suggestions []iconSuggestion, err error)

// WorkspaceIconSuggestions answers POST {workspace_id, wish, history} with
// up to five validated suggestions, or a fixed failure.
func (c *ConversationController) WorkspaceIconSuggestions() http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !historyAuthorized(c.cfg, c.trusted, r) {
			snapshotError(w, 403, "cross_user_denied")
			return
		}
		if r.Method != http.MethodPost || r.URL.Path != WorkspaceIconSuggestionsPath || r.RequestURI != WorkspaceIconSuggestionsPath || r.ContentLength < 2 || r.ContentLength > maxIconRequest || len(r.TransferEncoding) != 0 || r.Header.Get("Content-Type") != "application/json" {
			snapshotError(w, 400, "invalid_request")
			return
		}
		body, err := io.ReadAll(io.LimitReader(r.Body, maxIconRequest+1))
		var in iconSuggestionRequest
		dec := json.NewDecoder(bytes.NewReader(body))
		dec.DisallowUnknownFields()
		if err != nil || int64(len(body)) != r.ContentLength || !catalogNoDuplicates(body) || dec.Decode(&in) != nil || dec.Decode(new(any)) != io.EOF || in.SchemaVersion != 1 || !idPattern.MatchString(in.WorkspaceID) || !validIconRequest(in) {
			snapshotError(w, 400, "invalid_request")
			return
		}
		ws, cwd, err := c.workspaceFD(in.WorkspaceID)
		if err != nil {
			snapshotError(w, 404, "resource_not_found")
			return
		}
		facts, current := readIconFacts(in.WorkspaceID, ws, c.cfg.UID, filepath.Base(cwd))
		ws.Close()
		avoid := c.otherWorkspaceIcons(in.WorkspaceID)
		attachments, err := iconWishAttachments(c.home, in.Wish)
		if err != nil {
			snapshotError(w, 400, "invalid_attachments")
			return
		}
		input, _ := json.Marshal(map[string]any{"facts": facts, "avoid": avoid, "history": in.History, "wish": in.Wish, "attachments": attachments})
		reply := map[string]any{"schema_version": 1, "seen": seenFacts(facts)}
		suggest := c.iconSuggester
		if suggest == nil {
			suggest = c.suggestIcons
		}
		// The socket server's write timeout is a few seconds; an answer
		// slower than that would be lost on the way back.
		_ = http.NewResponseController(w).SetWriteDeadline(time.Now().Add(iconSuggestionLimit + 5*time.Second))
		ctx, cancel := context.WithTimeout(r.Context(), iconSuggestionLimit)
		defer cancel()
		started := time.Now()
		model, text, raw, err := suggest(ctx, input)
		elapsed := time.Since(started).Milliseconds()
		var suggestions []iconSuggestion
		if err == nil {
			suggestions = validIconSuggestions(raw, facts.Logo, append(avoid, current))
			if len(suggestions) == 0 || !iconModelPattern.MatchString(model) {
				err = titleModelInvalid
			}
		}
		if err != nil {
			reason := titleReason(err)
			diagnostic.New(os.Stderr, "daemon").Warn("workspace_icon_suggestions", "outcome", "failed", "reason", string(reason), "duration_ms", elapsed)
			reply["state"], reply["reason"] = "failed", string(reason)
			historyJSON(w, reply)
			return
		}
		diagnostic.New(os.Stderr, "daemon").Info("workspace_icon_suggestions", "outcome", "done", "model", model, "duration_ms", elapsed)
		reply["state"], reply["model"], reply["suggestions"] = "done", model, suggestions
		if text = cleanIconText(text, maxIconReply); text != "" {
			reply["reply"] = text
		}
		historyJSON(w, reply)
	})
}

func validIconRequest(in iconSuggestionRequest) bool {
	if !validIconWish(in.Wish) || len(in.History) > maxIconRounds {
		return false
	}
	for _, round := range in.History {
		if !validIconWish(round.Wish) || len(round.Icons) > 8 {
			return false
		}
		for _, icon := range round.Icons {
			if len(icon) > maxIconPath || !utf8.ValidString(icon) || strings.IndexFunc(icon, unicode.IsControl) >= 0 {
				return false
			}
		}
	}
	return true
}

// Wishes use the composer's paragraphs, unlike the single-line model output.
func validIconWish(s string) bool {
	line := strings.NewReplacer("\n", " ", "\r", " ", "\t", " ").Replace(s)
	return utf8.RuneCountInString(s) <= maxIconWish && cleanIconText(line, maxIconWish) == strings.TrimSpace(line)
}

// Reuse the upload store's own-UID, no-symlink reads. The one-shot model has
// no tools, so send image bytes and bounded UTF-8 text, never local paths.
func iconWishAttachments(home, wish string) ([]map[string]string, error) {
	matches := attachmentRef.FindAllStringSubmatch(wish, -1)
	if len(matches) == 0 {
		return nil, nil
	}
	root, err := attachmentRoot(home)
	if err != nil {
		return nil, err
	}
	defer root.Close()
	seen := make(map[string]bool)
	var out []map[string]string
	var total int64
	var textBytes int
	for _, match := range matches {
		id := match[1]
		if seen[id] {
			continue
		}
		seen[id] = true
		if len(seen) > 8 {
			return nil, errors.New("too many attachments")
		}
		f, err := attachmentFile(root, id)
		if err != nil {
			return nil, err
		}
		data, err := io.ReadAll(io.LimitReader(f, attachmentLimit-total+1))
		f.Close()
		total += int64(len(data))
		if err != nil || total > attachmentLimit {
			return nil, errors.New("attachments too large")
		}
		typ := attachmentType(data)
		if attachmentImage(typ) {
			out = append(out, map[string]string{"type": "image", "data": base64.StdEncoding.EncodeToString(data), "mimeType": typ})
		} else {
			textBytes += len(data)
			if textBytes > 65536 || !utf8.Valid(data) || bytes.IndexByte(data, 0) >= 0 {
				return nil, errors.New("attachment is not bounded text")
			}
			out = append(out, map[string]string{"type": "text", "text": string(data)})
		}
	}
	return out, nil
}

// cleanIconText trims a line of model or person text and admits it only
// within the bound and without control characters; "" otherwise.
func cleanIconText(s string, max int) string {
	s = strings.TrimSpace(s)
	if !utf8.ValidString(s) || utf8.RuneCountInString(s) > max || strings.IndexFunc(s, func(r rune) bool { return unicode.IsControl(r) || unicode.Is(unicode.Cf, r) && r != 0x200d }) >= 0 {
		return ""
	}
	return s
}

// validIconSuggestions keeps what the flat format admits and the chain could
// show: an emoji, letters, or exactly the logo the daemon found; never
// `auto`, another path, a repeat, the current icon or another workspace's.
func validIconSuggestions(raw []iconSuggestion, logo string, avoid []string) []iconSuggestion {
	seen := map[string]bool{}
	for _, a := range avoid {
		seen[a] = true
	}
	var out []iconSuggestion
	for _, s := range raw {
		set := parseIconValue(s.Icon)
		why := cleanIconText(s.Why, maxIconWhy)
		switch {
		case why == "" || seen[set.Value]:
			continue
		case set.Kind == "image" && set.Value == logo && logo != "",
			set.Kind == "letters",
			set.Kind == "emoji" && strings.TrimSpace(s.Icon) == set.Value:
		default:
			continue
		}
		seen[set.Value] = true
		out = append(out, iconSuggestion{Icon: set.Value, Why: why})
		if len(out) == maxIconSuggestions {
			break
		}
	}
	return out
}

// seenFacts is what the page says the model was shown.
func seenFacts(f iconFacts) map[string]any {
	seen := map[string]any{"readme": f.Readme != "", "start_page": f.StartPage != ""}
	if len(f.Languages) > 0 {
		seen["languages"] = f.Languages
	}
	if f.Logo != "" {
		seen["logo"] = f.Logo
	}
	return seen
}

// otherWorkspaceIcons are the icons other workspaces' configs name, so the
// model does not repeat them.
func (c *ConversationController) otherWorkspaceIcons(id string) []string {
	var icons []string
	cfg := c.cfg
	cfg.Home = c.home
	for _, e := range DiscoverListing(cfg).Entries {
		if workspaceIDOf(c.cfg, e) == id || e.Icon.Source != "config" {
			continue
		}
		if e.Icon.Kind == "image" {
			continue
		}
		icons = append(icons, e.Icon.Value)
		if len(icons) == 64 {
			break
		}
	}
	return icons
}

// readIconFacts reads the bounded facts beneath the pinned workspace: the
// README's start, the start page's title and first paragraph, the languages
// by file count, and the logo; and the config's icon now, never suggested
// again.
func readIconFacts(id string, ws *os.File, uid int, name string) (iconFacts, string) {
	root := int(ws.Fd())
	facts := iconFacts{Name: name}
	icon := readWorkspaceIcon(unix.Openat2, root)
	facts.Logo = icon.LogoPath
	current := ""
	if icon.Source == "config" {
		current = icon.Value
		if icon.Kind == "image" {
			current = icon.Path
		}
	}
	for _, readme := range []string{"README.md", "README", "readme.md", "README.txt", "README.rst", "Readme.md"} {
		if text := readIconPrefix(root, readme, maxIconReadme); text != "" {
			facts.Readme = text
			break
		}
	}
	if page := readStartPageFile(id, ws, uid); page != nil && page.startPage != nil {
		body := strings.TrimSpace(page.Body)
		if i := strings.Index(body, "\n\n"); i >= 0 {
			body = body[:i]
		}
		facts.StartPage = prefixBytes(strings.TrimSpace(page.Title+"\n"+body), 800)
	}
	facts.Languages = iconLanguages(root)
	return facts, current
}

// readIconPrefix reads at most limit bytes of a regular file at the root,
// never through a symlink, and cuts at a whole character.
func readIconPrefix(root int, name string, limit int) string {
	fd, err := open(unix.Openat2, root, name, unix.O_RDONLY|unix.O_NONBLOCK, true)
	if err != nil {
		return ""
	}
	defer unix.Close(fd)
	if s, err := stat(fd); err != nil || s.Mode&unix.S_IFMT != unix.S_IFREG {
		return ""
	}
	buf := make([]byte, limit)
	n := 0
	for n < limit {
		m, err := unix.Read(fd, buf[n:])
		if m <= 0 || err != nil {
			break
		}
		n += m
	}
	b := buf[:n]
	for len(b) > 0 && !utf8.Valid(b) {
		b = b[:len(b)-1]
	}
	return strings.TrimSpace(string(b))
}

// Source languages by file extension; documentation and data count only
// when there is nothing else.
var iconLanguageNames = map[string]string{
	".go": "Go", ".ts": "TypeScript", ".tsx": "TypeScript", ".js": "JavaScript", ".jsx": "JavaScript", ".mjs": "JavaScript",
	".py": "Python", ".rs": "Rust", ".rb": "Ruby", ".java": "Java", ".kt": "Kotlin", ".swift": "Swift", ".c": "C", ".h": "C",
	".cc": "C++", ".cpp": "C++", ".hpp": "C++", ".cs": "C#", ".php": "PHP", ".sh": "Shell", ".bash": "Shell", ".zsh": "Shell",
	".nix": "Nix", ".lua": "Lua", ".ex": "Elixir", ".exs": "Elixir", ".hs": "Haskell", ".scala": "Scala", ".dart": "Dart",
	".sql": "SQL", ".r": "R", ".jl": "Julia", ".zig": "Zig", ".vue": "Vue", ".svelte": "Svelte", ".css": "CSS", ".scss": "CSS",
	".html": "HTML", ".tex": "TeX", ".md": "Markdown", ".ipynb": "Jupyter",
}

// iconLanguages counts files by language beneath the workspace, three
// directories deep and at most 4000 entries, skipping hidden and vendored
// directories; the three largest shares in whole percent.
func iconLanguages(root int) []iconLanguage {
	counts := map[string]int{}
	seen := 0
	var walk func(fd, depth int)
	walk = func(fd, depth int) {
		d, err := dir(unix.Openat2, fd, ".", true)
		if err != nil {
			return
		}
		f := os.NewFile(uintptr(d), "dir")
		defer f.Close()
		entries, _ := f.ReadDir(1000)
		for _, e := range entries {
			if seen++; seen > 4000 {
				return
			}
			n := e.Name()
			if strings.HasPrefix(n, ".") {
				continue
			}
			if e.IsDir() {
				switch n {
				case "node_modules", "vendor", "dist", "build", "target", "__pycache__", "venv":
					continue
				}
				if depth < 3 {
					if sub, err := dir(unix.Openat2, d, n, true); err == nil {
						walk(sub, depth+1)
						unix.Close(sub)
					}
				}
				continue
			}
			if e.Type().IsRegular() {
				if lang := iconLanguageNames[strings.ToLower(filepath.Ext(n))]; lang != "" {
					counts[lang]++
				}
			}
		}
	}
	walk(root, 0)
	total := 0
	for lang, n := range counts {
		if lang == "Markdown" && len(counts) > 1 {
			delete(counts, lang)
			continue
		}
		total += n
	}
	var langs []iconLanguage
	for lang, n := range counts {
		if pct := n * 100 / max(total, 1); pct > 0 {
			langs = append(langs, iconLanguage{lang, pct})
		}
	}
	sort.Slice(langs, func(i, j int) bool {
		return langs[i].Percent > langs[j].Percent || langs[i].Percent == langs[j].Percent && langs[i].Name < langs[j].Name
	})
	if len(langs) > 3 {
		langs = langs[:3]
	}
	return langs
}

// suggestIcons runs the helper as the person with the selected Pi
// installation: HOME, PATH and USER only, the facts on stdin, stderr
// swallowed, at most 4 KiB of answer, the request's budget as the deadline;
// the helper stops asking two seconds earlier, so it can still say why.
func (c *ConversationController) suggestIcons(ctx context.Context, input []byte) (string, string, []iconSuggestion, error) {
	if c.runtime == nil {
		return "", "", nil, titleModelUnavailable
	}
	bridge := filepath.Join(filepath.Dir(filepath.Dir(c.runtime.Node)), "node_modules/pi-claude-bridge/src/index.ts")
	if info, err := os.Stat(bridge); err != nil || !info.Mode().IsRegular() {
		bridge = ""
	}
	budget := 2 * time.Second
	if deadline, ok := ctx.Deadline(); ok {
		budget = max(time.Until(deadline)-2*time.Second, time.Second)
	}
	cmd := exec.CommandContext(ctx, c.runtime.Node, "--input-type=module", "-e", iconHelper, c.runtime.Entry, backgroundModelURL, bridge, strconv.FormatInt(budget.Milliseconds(), 10))
	cmd.Env = []string{"HOME=" + c.home, "PATH=/usr/bin:/bin", "USER=" + c.cfg.Username}
	// The person's home, not a workspace: no project settings of a
	// repository apply to the model call.
	cmd.Dir = c.home
	cmd.Stdin = bytes.NewReader(input)
	cmd.WaitDelay = time.Second
	var output limitedIconWriter
	cmd.Stdout = &output
	cmd.Stderr = &storageDiagnostics{operation: "workspace_icon_suggestions"}
	if err := cmd.Run(); err != nil {
		if ctx.Err() != nil {
			return "", "", nil, titleModelTimeout
		}
		if output.overflow {
			return "", "", nil, titleModelInvalid
		}
		return "", "", nil, titleModelUnavailable
	}
	var response struct {
		Model       string           `json:"model"`
		Reply       string           `json:"reply"`
		Suggestions []iconSuggestion `json:"suggestions"`
		Failure     string           `json:"failure"`
	}
	if output.overflow || json.Unmarshal(output.Bytes(), &response) != nil {
		return "", "", nil, titleModelInvalid
	}
	switch titleFailure(response.Failure) {
	case titleModelUnavailable, titleModelTimeout, titleModelInvalid:
		return "", "", nil, titleFailure(response.Failure)
	}
	if response.Failure != "" {
		return "", "", nil, titleModelUnavailable
	}
	return response.Model, response.Reply, response.Suggestions, nil
}

type limitedIconWriter struct {
	bytes.Buffer
	overflow bool
}

func (w *limitedIconWriter) Write(b []byte) (int, error) {
	if w.Len()+len(b) > 4096 {
		w.overflow = true
		return 0, errors.New("output limit")
	}
	return w.Buffer.Write(b)
}
