//go:build linux

package daemon

import (
	_ "embed"
	"encoding/base64"
	"os"
	"path/filepath"
)

// One background-model policy for recaps and automatic titles
// (background-model.mjs). The recap extension imports it as a sibling file;
// the title helper, run with node -e, imports it from a data URL.
//
//go:embed background-model.mjs
var backgroundModelPolicy []byte

var backgroundModelURL = "data:text/javascript;base64," + base64.StdEncoding.EncodeToString(backgroundModelPolicy)

func installBackgroundModel(dir string) error {
	return os.WriteFile(filepath.Join(dir, "background-model.mjs"), backgroundModelPolicy, 0600)
}
