//go:build linux

package daemon

import (
	"encoding/json"
	"net/url"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
)

// Execute the actual embedded helper with a synthetic SDK: verify the provider
// content blocks, not wording or an assumption that a model can open a path.
func TestIconHelperRepositoryRasterIsOptionalForTextOnlyModel(t *testing.T) {
	node, err := exec.LookPath("node")
	if err != nil {
		t.Fatal(err)
	}
	root := t.TempDir()
	iconTree(t, root, map[string]string{
		"package.json":   `{"type":"module"}`,
		"background.mjs": `export const backgroundModels = models => models;`,
		"core/model-runtime.js": `
export class ModelRuntime {
 static async create() { return new ModelRuntime(); }
 getAvailableSnapshot() { return [{ provider: 'synthetic', id: 'text', input: ['text'] }]; }
 async completeSimple(model, request) {
  const content = request.messages[0].content;
  if (content.some(p => p.type === 'image')) throw Error('unsupported raster');
  if (!content.some(p => p.text.includes('available for selection'))) throw Error('missing availability');
  return { stopReason: 'stop', content: [{type: 'text', text: JSON.stringify({suggestions:[{icon:'logo.png',why:'repository'}]})}] };
 }
}`,
	})
	for _, upload := range []bool{false, true} {
		image := map[string]string{"type": "image", "mimeType": "image/png", "data": "cG5n"}
		input := map[string]any{"facts": map[string]string{"logo": "logo.png"}, "repository_icon": []any{image}}
		if upload {
			input["attachments"] = []any{image}
		}
		b, _ := json.Marshal(input)
		background := (&url.URL{Scheme: "file", Path: filepath.Join(root, "background.mjs")}).String()
		cmd := exec.Command(node, "--input-type=module", "-e", iconHelper, filepath.Join(root, "entry.js"), background, "", "2000")
		cmd.Stdin = strings.NewReader(string(b))
		output, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("helper: %s %v", output, err)
		}
		var result struct {
			Failure     string
			Suggestions []iconSuggestion
		}
		if err := json.Unmarshal(output, &result); err != nil {
			t.Fatal(err)
		}
		if upload {
			if result.Failure != "model_invalid_response" {
				t.Fatalf("required upload silently omitted: %s", output)
			}
		} else if result.Failure != "" || len(result.Suggestions) != 1 || result.Suggestions[0].Icon != "logo.png" {
			t.Fatalf("optional repository image blocked text model: %s", output)
		}
	}
}

func TestIconSVGModelSourceBudget(t *testing.T) {
	for _, budget := range []int{65536, 0} {
		for _, data := range []string{iconSVG, "<svg>" + strings.Repeat(" ", 200000) + "</svg>"} {
			part := iconModelContent([]byte(data), "image/svg+xml", budget)
			if part["type"] != "text" || len(part["text"]) > 4200 {
				t.Fatal("unbounded SVG source")
			}
			supplied := strings.Contains(part["text"], data)
			if supplied != (len(data) < 4096 && budget >= len(data)+64) {
				t.Fatal("incorrect source availability")
			}
		}
	}
}
