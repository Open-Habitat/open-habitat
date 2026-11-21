//go:build linux

package daemon

import (
	_ "embed"
	"os"
	"path/filepath"
)

// microsoftPermission is the hook that asks the person before a Microsoft
// call deletes, sends or shares a calendar, through the companion's typed
// permission question. It is loaded into every browser conversation's Pi
// beside the companion; Pi sessions the person starts themselves load
// neither, as they load no other Habitat extension.
//
//go:embed microsoft-permission.mjs
var microsoftPermission []byte

func installMicrosoftPermission(dir string) (string, error) {
	path := filepath.Join(dir, "microsoft-permission.mjs")
	return path, os.WriteFile(path, microsoftPermission, 0600)
}
