package installationpolicy

import (
	"strings"
	"testing"
)

func directives(unit, section string) map[string][]string {
	out := map[string][]string{}
	current := ""
	for _, line := range strings.Split(unit, "\n") {
		line = strings.TrimSpace(line)
		switch {
		case line == "" || strings.HasPrefix(line, "#"):
		case strings.HasPrefix(line, "["):
			current = line
		case current == section:
			key, value, _ := strings.Cut(line, "=")
			out[key] = append(out[key], value)
		}
	}
	return out
}

// Agents' /var/tmp must survive a daemon restart without becoming shared:
// a root-created 0700 directory of the unit's own user replaces PrivateTmp's
// /var/tmp, /tmp stays private, and tmpfiles ages the persistent one.
func TestDaemonTemporaryDirectories(t *testing.T) {
	service := directives(DaemonService, "[Service]")
	for key, want := range map[string]string{
		"User":               "%i",
		"PrivateTmp":         "yes",
		"StateDirectory":     "open-habitat-tmp/%i",
		"StateDirectoryMode": "0700",
		"BindPaths":          "/var/lib/open-habitat-tmp/%i:/var/tmp",
	} {
		if got := service[key]; len(got) != 1 || got[0] != want {
			t.Errorf("%s = %q, want exactly %q", key, got, want)
		}
	}
	for _, key := range []string{"TemporaryFileSystem", "BindReadOnlyPaths", "DynamicUser"} {
		if _, ok := service[key]; ok {
			t.Errorf("%s would change which /tmp or /var/tmp the agents see", key)
		}
	}
	if !strings.Contains("\n"+Tmpfiles, "\ne /var/lib/open-habitat-tmp/* - - - 30d\n") {
		t.Error("tmpfiles policy does not age the persistent /var/tmp")
	}
}
