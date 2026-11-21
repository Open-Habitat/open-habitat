//go:build linux

package host

import (
	"context"
	"errors"
	"io"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"golang.org/x/sys/unix"
)

// payloadFixture publishes the minimal core payload into a fresh prefix's
// store and returns the prefix, the entry and its authenticated release.
func payloadFixture(t *testing.T) (string, string, AuthenticatedRelease, ReleaseArtifact, uint32) {
	t.Helper()
	dir, owner := operationFixture(t)
	prefix := filepath.Dir(dir) + "/runtime"
	a, archive := runtimeInstallFixture(t)
	r := authenticatedFixture(t, releaseManifest(a))
	parent, err := openGenerationStage(prefix+"/staging", prefix+"/generations", owner)
	if err != nil {
		t.Fatal(err)
	}
	defer parent.Close()
	artifacts, err := r.Select([]string{"core"})
	if err != nil {
		t.Fatal(err)
	}
	payloads, timings, err := r.ensurePayloads(context.Background(), artifacts, prefix, parent, archiveOpener(archive), owner, func() int64 { return 0 })
	if err != nil {
		t.Fatal(err)
	}
	if len(timings) != 1 || timings[0].Outcome != "published" {
		t.Fatalf("timings %+v", timings)
	}
	entries, _ := os.ReadDir(prefix + "/staging")
	if len(entries) != 0 {
		t.Fatal("left a stage behind", entries)
	}
	return prefix, payloads + "/core", r, a, owner
}

// Reuse rests on rereading the tree against the manifest that now names it,
// so every change extraction could not have produced must be refused.
func TestPayloadReuseRefusesChangedTrees(t *testing.T) {
	cases := map[string]func(entry string) error{
		"content": func(entry string) error { return os.WriteFile(entry+"/LICENSE", []byte("yyyy"), 0644) },
		"mode":    func(entry string) error { return os.Chmod(entry+"/LICENSE", 0755) },
		"setuid":  func(entry string) error { return unix.Chmod(entry+"/LICENSE", 04644) },
		"extra":   func(entry string) error { return os.WriteFile(entry+"/runtime/extra.js", []byte("x"), 0644) },
		"missing": func(entry string) error { return os.Remove(entry + "/LICENSE") },
		"empty license": func(entry string) error {
			return os.WriteFile(entry+"/LICENSE", nil, 0644)
		},
		"hard link": func(entry string) error { return os.Link(entry+"/LICENSE", filepath.Dir(entry)+"/elsewhere") },
		"symlink": func(entry string) error {
			if err := os.Rename(entry+"/LICENSE", filepath.Dir(entry)+"/moved"); err != nil {
				return err
			}
			return os.Symlink(filepath.Dir(entry)+"/moved", entry+"/LICENSE")
		},
		"directory mode": func(entry string) error { return os.Chmod(entry+"/runtime", 0775) },
		"fifo":           func(entry string) error { return unix.Mkfifo(entry+"/runtime/pipe", 0644) },
	}
	for name, change := range cases {
		t.Run(name, func(t *testing.T) {
			prefix, entry, r, a, owner := payloadFixture(t)
			ctx := context.Background()
			if err := verifyPayloadTree(ctx, entry, a, r.manifest.Platform, owner, true); err != nil {
				t.Fatal("published payload does not verify", err)
			}
			if err := change(entry); err != nil {
				t.Fatal(err)
			}
			if err := verifyPayloadTree(ctx, entry, a, r.manifest.Platform, owner, true); !errors.Is(err, ErrReleaseArchive) {
				t.Fatalf("accepted %s: %v", name, err)
			}
			// installRuntime refuses it too, without selecting anything.
			if err := installRuntime(ctx, r, prefix, func(string) (io.ReadCloser, error) { t.Fatal("reread archive"); return nil, nil }, owner); err == nil {
				t.Fatal("installed a changed payload")
			}
			if _, err := os.Lstat(prefix + "/core"); !os.IsNotExist(err) {
				t.Fatal("selected a changed payload", err)
			}
		})
	}
}

// The tree is bound to the manifest that names it, not to the one it was
// extracted for: a manifest naming the same archive digest with a different
// inventory is refused.
func TestPayloadReuseBindsTheNewManifest(t *testing.T) {
	_, entry, r, a, owner := payloadFixture(t)
	changed := a
	changed.Closure = cloneRuntimeClosure(a.Closure)
	changed.Closure.Files[0].SHA256 = strings.Repeat("d", 64)
	if err := verifyPayloadTree(context.Background(), entry, changed, r.manifest.Platform, owner, true); !errors.Is(err, ErrReleaseArchive) {
		t.Fatal("accepted a tree for a different inventory", err)
	}
}

func TestPayloadCollectionKeepsReferencedEntries(t *testing.T) {
	prefix, profile, _, _, owner := payloadFixture(t)
	entry := filepath.Dir(profile)
	store := filepath.Dir(entry)
	unused := store + "/" + strings.Repeat("e", 64)
	kept := store + "/" + strings.Repeat("f", 64)
	foreign := store + "/not-a-payload"
	for _, d := range []string{unused + "/core/runtime", kept + "/core/runtime", foreign} {
		if err := os.MkdirAll(d, 0755); err != nil {
			t.Fatal(err)
		}
	}
	gen := prefix + "/generations/runtime-" + strings.Repeat("1", 64)
	if err := os.MkdirAll(gen, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(entry, gen+"/payloads"); err != nil {
		t.Fatal(err)
	}
	// An unreadable generation leaves every entry in place.
	if os.Geteuid() != 0 {
		if err := os.Chmod(gen, 0); err != nil {
			t.Fatal(err)
		}
		if err := collectPayloads(prefix, nil, owner); err == nil {
			t.Fatal("collected past an unreadable generation")
		}
		if _, err := os.Lstat(unused); err != nil {
			t.Fatal("removed an entry it could not prove unused", err)
		}
		if err := os.Chmod(gen, 0755); err != nil {
			t.Fatal(err)
		}
	}
	if err := collectPayloads(prefix, map[string]bool{filepath.Base(kept): true}, owner); err != nil {
		t.Fatal(err)
	}
	for path, want := range map[string]bool{entry: true, kept: true, foreign: true, unused: false} {
		if _, err := os.Lstat(path); (err == nil) != want {
			t.Fatalf("%s present=%v: %v", path, !want, err)
		}
	}
	// The selector alone also keeps an entry.
	if err := os.Remove(gen + "/payloads"); err != nil {
		t.Fatal(err)
	}
	if err := publishLink(prefix+"/core", entry+"/core/runtime"); err != nil {
		t.Fatal(err)
	}
	if err := collectPayloads(prefix, nil, owner); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Lstat(entry); err != nil {
		t.Fatal("removed the selected payload", err)
	}
	if _, err := os.Lstat(kept); !os.IsNotExist(err) {
		t.Fatal("kept an unreferenced payload", err)
	}
	entries, _ := os.ReadDir(prefix + "/staging")
	if len(entries) != 0 {
		t.Fatal("left a collected tree behind", entries)
	}
}

// A generation published before the content store holds its payload itself;
// checks and selectors read either layout.
func TestPayloadLegacyGenerationLayout(t *testing.T) {
	prefix, profile, r, a, owner := payloadFixture(t)
	gen := prefix + "/generations/runtime-" + strings.Repeat("2", 64)
	if err := os.MkdirAll(gen, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.Rename(filepath.Dir(profile), gen+"/payloads"); err != nil {
		t.Fatal(err)
	}
	if err := runtimePayloadMatches(context.Background(), gen, r, []string{"core"}, owner); err != nil {
		t.Fatal(err)
	}
	if got, err := generationRuntime(gen, "core"); err != nil || got != gen+"/payloads/core/runtime" {
		t.Fatal(got, err)
	}
	// A link to an entry for other archives is refused.
	other := prefix + "/generations/runtime-" + strings.Repeat("3", 64)
	if err := os.MkdirAll(other, 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(prefix+"/payloads/"+strings.Repeat("9", 64), other+"/payloads"); err != nil {
		t.Fatal(err)
	}
	if _, err := generationPayloads(other, []ReleaseArtifact{a}); !errors.Is(err, ErrReleaseArchive) {
		t.Fatal("followed a link to other archives", err)
	}
}

// The integrations Pi wrapper finds core by walking up from its own physical
// location, so profiles sharing an entry must stay siblings.
func TestPayloadEntryKeepsProfilesSiblings(t *testing.T) {
	core := ReleaseArtifact{Profile: "core", SHA256: strings.Repeat("a", 64)}
	integrations := ReleaseArtifact{Profile: "integrations", SHA256: strings.Repeat("b", 64)}
	if payloadsName([]ReleaseArtifact{core, integrations}) != payloadsName([]ReleaseArtifact{integrations, core}) {
		t.Fatal("entry name depends on order")
	}
	if payloadsName([]ReleaseArtifact{core}) == payloadsName([]ReleaseArtifact{core, integrations}) {
		t.Fatal("entry shared by different archive sets")
	}
	changed := integrations
	changed.SHA256 = strings.Repeat("c", 64)
	if payloadsName([]ReleaseArtifact{core, integrations}) == payloadsName([]ReleaseArtifact{core, changed}) {
		t.Fatal("entry shared across a changed archive")
	}
}

// A deep, sparse inventory is as valid as a bushy one: the directory bound
// follows the inventory's ancestors, not its file count.
func TestPayloadTreeDirectoryBound(t *testing.T) {
	dir, owner := operationFixture(t)
	root := filepath.Dir(dir) + "/entry"
	if err := os.MkdirAll(root+"/a/b/c", 0755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(root+"/a/b/c/d", []byte("x"), 0644); err != nil {
		t.Fatal(err)
	}
	// The focused runner's umask is 077; extraction sets modes explicitly.
	for _, p := range []string{root, root + "/a", root + "/a/b", root + "/a/b/c"} {
		if err := os.Chmod(p, 0755); err != nil {
			t.Fatal(err)
		}
	}
	if err := os.Chmod(root+"/a/b/c/d", 0644); err != nil {
		t.Fatal(err)
	}
	sum := closureSum("x")
	c := &RuntimeClosure{Files: []RuntimeFile{{Path: "a/b/c/d", SHA256: sum, Component: "license", Mode: 0644}}, Components: []RuntimeComponent{{Name: "license", Kind: "license", LicenseFiles: []string{"a/b/c/d"}}}}
	a := ReleaseArtifact{Profile: "integrations", Entries: 1, Closure: c}
	if err := verifyPayloadTree(context.Background(), root, a, "ubuntu-24.04-amd64", owner, true); err != nil {
		t.Fatal(err)
	}
	for _, p := range []string{"/x", "/x/y", "/x/y/z", "/x/y/z/w", "/x/y/z/w/v"} {
		if err := os.Mkdir(root+p, 0755); err != nil {
			t.Fatal(err)
		}
		if err := os.Chmod(root+p, 0755); err != nil {
			t.Fatal(err)
		}
	}
	if err := verifyPayloadTree(context.Background(), root, a, "ubuntu-24.04-amd64", owner, true); !errors.Is(err, ErrReleaseArchive) {
		t.Fatal("unbounded extra directories accepted", err)
	}
}
