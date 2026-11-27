//go:build linux

package daemon

import (
	"fmt"
	"path"
	"strconv"
	"strings"

	"github.com/open-habitat/open-habitat/internal/replyblock"
)

// offerReplyBody is the block's body for a reply to the offer a notice on
// the conversation's branch carries (reply-view-file). The notice is the
// authority that the offer belongs to this conversation; the offer's own
// manifest in the person's store says what it still holds, so a removed
// offer and a path outside it are refused. The facts line names the sources
// as the agent gave them, since that is how the agent knows the offer.
func (c *ConversationController) offerReplyBody(n agentNotice, file, cwd string) (string, bool) {
	switch {
	case n.View != nil:
		if file != "" {
			return "", false
		}
		views, err := openViews(c.home)
		if err != nil {
			return "", false
		}
		defer views.Close()
		m, err := readViewManifest(int(views.Fd()), n.View.ID)
		if err != nil {
			return "", false
		}
		facts := []string{}
		if src := shownSource(m.Path, m.Source, cwd); src != "" {
			facts = append(facts, src)
		}
		facts = append(facts, "opens "+m.Entry, countFiles(m.Files), hostSize(m.Bytes))
		return replyblock.OfferBody(replyblock.Offer{Kind: replyblock.OfferView, ID: m.ID, Title: m.Title}, sourceLine(facts))
	case n.Files != nil:
		store, err := openFileOffers(c.home)
		if err != nil {
			return "", false
		}
		defer store.Close()
		m, err := readFileOfferManifest(int(store.Fd()), n.Files.ID)
		if err != nil || len(m.Items) == 0 {
			return "", false
		}
		if len(m.Items) == 1 {
			item := m.Items[0]
			if file != "" && file != item.Path {
				return "", false
			}
			facts := []string{shownSource(itemSource(m, item), "", cwd), hostKind(item.Kind), hostSize(item.Bytes)}
			return replyblock.OfferBody(replyblock.Offer{Kind: replyblock.OfferFile, ID: m.ID, Title: m.Title}, sourceLine(facts))
		}
		if file == "" {
			sources := make([]string, 0, len(m.Paths))
			for _, p := range m.Paths {
				sources = append(sources, shownSource(p, "", cwd))
			}
			facts := []string{strings.Join(sources, ", "), countFiles(m.Files), hostSize(m.Bytes)}
			return replyblock.OfferBody(replyblock.Offer{Kind: replyblock.OfferFiles, ID: m.ID, Title: m.Title}, sourceLine(facts))
		}
		for _, item := range m.Items {
			if item.Path == file {
				facts := []string{shownSource(itemSource(m, item), "", cwd), hostKind(item.Kind), hostSize(item.Bytes)}
				return replyblock.OfferBody(replyblock.Offer{Kind: replyblock.OfferFiles, ID: m.ID, Title: m.Title, Path: item.Path}, sourceLine(facts))
			}
		}
	}
	return "", false
}

func sourceLine(facts []string) string {
	kept := facts[:0]
	for _, f := range facts {
		if f != "" {
			kept = append(kept, f)
		}
	}
	return "Source: " + strings.Join(kept, " · ")
}

// itemSource is where one frozen file came from, in the agent's own terms:
// its offered path, or the offered folder it was in with its path there.
func itemSource(m fileOfferManifest, item fileOfferItem) string {
	if len(m.Paths) == 1 {
		p := m.Paths[0]
		if p == "." {
			return item.Path
		}
		// One file offered alone keeps its name; a folder's files are
		// inside it.
		if m.Folder == "" && m.Files == 1 && path.Base(p) == item.Path {
			return p
		}
		return p + "/" + item.Path
	}
	// Several sources: the item's first part is its source's name. Two
	// sources with the same name cannot be told apart from the manifest, and
	// a guessed source would point the agent at the wrong file, so none is
	// given then.
	head, rest, inFolder := strings.Cut(item.Path, "/")
	found := ""
	for _, p := range m.Paths {
		if path.Base(p) != head {
			continue
		}
		if found != "" {
			return ""
		}
		found = p
	}
	if found == "" {
		return ""
	}
	if inFolder {
		return found + "/" + rest
	}
	return found
}

// shownSource is a source as the agent gave it; an absolute one inside the
// conversation's directory is shown relative to it.
func shownSource(given, absolute, cwd string) string {
	p := given
	if p == "" || p == "." && absolute != "" {
		p = absolute
	}
	if path.IsAbs(p) && cwd != "" && path.IsAbs(cwd) {
		if p == cwd {
			return "."
		}
		if strings.HasPrefix(p, strings.TrimSuffix(cwd, "/")+"/") {
			return strings.TrimPrefix(p, strings.TrimSuffix(cwd, "/")+"/")
		}
	}
	return p
}

func countFiles(n int) string {
	if n == 1 {
		return "1 file"
	}
	return strconv.Itoa(n) + " files"
}

// hostSize is a size in the agent's line: 1024-based, one decimal below ten.
func hostSize(b int64) string {
	if b < 1024 {
		return strconv.FormatInt(b, 10) + " bytes"
	}
	v, unit := float64(b)/1024, "KB"
	for _, u := range []string{"MB", "GB"} {
		if v < 1024 {
			break
		}
		v, unit = v/1024, u
	}
	if v < 10 {
		s := strings.TrimSuffix(fmt.Sprintf("%.1f", v), ".0")
		if s != "10" {
			return s + " " + unit
		}
	}
	return fmt.Sprintf("%.0f %s", v, unit)
}

var hostKinds = map[string]string{
	"image": "image", "svg": "SVG image", "video": "video", "audio": "audio",
	"markdown": "Markdown", "pdf": "PDF", "docx": "Word document", "xlsx": "Excel spreadsheet",
	"pptx": "PowerPoint presentation", "csv": "CSV table", "code": "code", "text": "text",
	"zip": "zip archive", "file": "file",
}

func hostKind(kind string) string {
	if k, ok := hostKinds[kind]; ok {
		return k
	}
	return "file"
}
