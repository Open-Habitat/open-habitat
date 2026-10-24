package cli

import (
	"errors"
	"fmt"
	"io"

	"github.com/Open-Habitat/open-habitat/internal/nativegitea"
)

// giteaCommand is Git's credential-helper protocol, not the canon's JSON
// surface (CONFORMANCE.md): Git runs it as the registered helper with
// get/store/erase appended and reads key=value lines from stdout. Only get
// ever prints a credential, and only to Git; store and erase are no-ops
// because tea's file is the one store. Errors are fixed codes on stderr.
func giteaCommand(args []string, stdin io.Reader, stdout, stderr io.Writer) int {
	if len(args) == 0 || args[0] != "git-credential" {
		return emitError(usage("expected gitea git-credential [--login NAME] get|store|erase"), options{}, stderr)
	}
	args = args[1:]
	explicit := ""
	if len(args) >= 2 && args[0] == "--login" {
		explicit, args = args[1], args[2:]
		if explicit == "" || len(explicit) > 255 {
			return emitError(usage("--login requires a tea login name"), options{}, stderr)
		}
	}
	if len(args) != 1 {
		return emitError(usage("expected exactly one operation: get, store or erase"), options{}, stderr)
	}
	switch args[0] {
	case "store", "erase":
		// Drain Git's request so it never sees a broken pipe; keep nothing.
		_, _ = io.Copy(io.Discard, io.LimitReader(stdin, 64<<10))
		return 0
	case "get":
	default:
		return emitError(usage(fmt.Sprintf("unknown credential operation %q; expected get, store or erase", args[0])), options{}, stderr)
	}
	req, err := nativegitea.ParseCredentialRequest(stdin)
	if err != nil {
		return emitError(usage("malformed Git credential request"), options{}, stderr)
	}
	store, err := nativegitea.StoreFromEnvironment()
	if err == nil {
		var c nativegitea.Credential
		if c, err = store.Credential(req, explicit); err == nil {
			if nativegitea.WriteCredential(stdout, c) != nil {
				return 2
			}
			return 0
		}
	}
	// No credential is an ordinary answer to Git: print nothing on stdout
	// and let Git decide. The reason is fixed text, never a path or token.
	var ge *nativegitea.Error
	code := "native_unavailable"
	if errors.As(err, &ge) {
		code = ge.Code()
	}
	switch code {
	case "no_match":
		return 0
	case "ambiguous":
		fmt.Fprintln(stderr, "open-habitat: several tea logins match this Gitea request; select one with credential.username")
		return 0
	}
	fmt.Fprintf(stderr, "open-habitat: tea configuration unavailable (%s)\n", code)
	return 2
}
