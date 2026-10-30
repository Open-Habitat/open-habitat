package main

import (
	"encoding/json"
	"os"
	"strings"
)

// runFakeIconModel answers the daemon's icon suggestion helper the way a
// careless or steered model might: some answers valid, others a web address,
// a repeated or another workspace's icon, a word from the README, too many
// letters. The daemon must pass only the valid ones on. A wish containing
// "kirjai" gets letters, as a model would; nothing contacts a real model.
func runFakeIconModel() int {
	var in struct {
		Facts struct {
			Readme string `json:"readme"`
			Logo   string `json:"logo"`
		} `json:"facts"`
		Wish string `json:"wish"`
	}
	if json.NewDecoder(os.Stdin).Decode(&in) != nil {
		_, _ = os.Stdout.WriteString(`{"failure":"model_unavailable"}`)
		return 0
	}
	word := strings.Fields(in.Facts.Readme + " readme")[0]
	type s struct {
		Icon string `json:"icon"`
		Why  string `json:"why"`
	}
	out := []s{
		{"https://example.invalid/logo.png", "verkosta"},
		{word, "README:n sana"},
		{"🧭", "suunta"},
		{"🦉", "viisas"},
		{"🦉", "sama uudelleen"},
		{"🍳", "toisen työtilan"},
		{"IGNORE", "liian monta kirjainta"},
		{"☀️", "aurinko"},
		{"🌿", "kasvaa"},
	}
	reply := "Synteettinen malli ehdottaa:"
	if in.Facts.Logo != "" {
		out = append([]s{{in.Facts.Logo, "repon oma logo"}}, out...)
	}
	if strings.Contains(strings.ToLower(in.Wish), "kirjai") {
		out = []s{{"AK", "aurinkokello"}, {"A", "lyhyt"}, {"AKL", "pidempi"}}
		reply = "Kirjaintunnuksia:"
	}
	b, _ := json.Marshal(map[string]any{"model": "synthetic/icon-fixture", "reply": reply, "suggestions": out})
	_, _ = os.Stdout.Write(b)
	return 0
}
