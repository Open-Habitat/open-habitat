package nativegitea

import "testing"

func TestMatchOriginNamesOnlyTheExactRepository(t *testing.T) {
	root, _ := ParseBase("https://git.example.test")
	sub, _ := ParseBase("https://git.example.test/gitea")
	port, _ := ParseBase("https://git.example.test:3000")
	other, _ := ParseBase("https://other.example.test")
	bases := []Base{root, sub, port, other, root}
	for origin, want := range map[string]struct {
		base Base
		name string
	}{
		"https://git.example.test/ada/notes.git":       {root, "ada/notes"},
		"https://git.example.test/ada/notes":           {root, "ada/notes"},
		"https://GIT.example.test:443/Ada/Notes.git":   {root, "Ada/Notes"},
		"https://git.example.test/gitea/ada/notes.git": {sub, "ada/notes"},
		"https://git.example.test:3000/ada/notes.git":  {port, "ada/notes"},
		"https://other.example.test/ada/notes.git":     {other, "ada/notes"},
	} {
		b, name, ok := MatchOrigin(origin, bases)
		if !ok || b != want.base || name != want.name {
			t.Errorf("%s: %v %q %v", origin, b, name, ok)
		}
	}
	for _, origin := range []string{
		"",
		"git@git.example.test:ada/notes.git",
		"ssh://git@git.example.test/ada/notes.git",
		"http://git.example.test/ada/notes.git",
		"https://ada:tok@git.example.test/ada/notes.git",
		"https://ada@git.example.test/ada/notes.git",
		"https://git.example.test/ada/notes.git/",
		"https://git.example.test/ada/notes.git?x=1",
		"https://git.example.test/ada/no%74es.git",
		"https://git.example.test/ada/../notes.git",
		"https://git.example.test/ada",
		"https://git.example.test/gitea2/ada/notes.git",
		"https://git.example.test/x/gitea/ada/notes.git",
		"https://git.example.test:3001/ada/notes.git",
		"https://unknown.example.test/ada/notes.git",
		"https://git.example.test//notes.git",
		"/home/ada/src/notes",
	} {
		if b, name, ok := MatchOrigin(origin, bases); ok {
			t.Errorf("%s matched %v %q", origin, b, name)
		}
	}
	if _, _, ok := MatchOrigin("https://git.example.test/ada/notes.git", nil); ok {
		t.Error("matched without a connected Gitea")
	}
}
