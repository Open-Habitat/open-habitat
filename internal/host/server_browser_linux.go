//go:build linux

package host

import (
	"context"
	_ "embed"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"time"
)

// The person's server browser (experimental) runs Google Chrome on a TigerVNC
// display. TigerVNC is an Ubuntu package and is declared in the core
// runtime's Ubuntu requirements like every other. Chrome is not: no build of
// Chromium that may be redistributed exists for both architectures (Chrome
// for Testing is Google-branded and carries a CDM nobody may pass on), and a
// pinned archive would go stale within days in a browser people sign in to.
// Google's own apt repository keeps it current through the host's apt, as
// internal/AGENTS.md's package rule says, so apply and upgrade add that
// repository and install the package once.
//
// The step is best effort and runs after entries have reopened: an
// experimental feature never fails or lengthens an installation's downtime,
// and a host that cannot reach Google simply has no server browser, which the
// daemon and the browser app then say in plain words. Once Chrome is
// installed its own package owns the repository file and the key and keeps
// them identical to what is written here, so nothing here fights it later.
const (
	serverBrowserChrome  = "/opt/google/chrome/google-chrome"
	serverBrowserPackage = "google-chrome-stable"
	// The oldest Chrome the server browser was qualified with; Google's
	// repository offers only its current stable release.
	serverBrowserChromeMinimum = "157.0.8103.38-1"
	googleChromeKeyringPath    = "/usr/share/keyrings/google-chrome.gpg"
	googleChromeSourcesPath    = "/etc/apt/sources.list.d/google-chrome.sources"
	googleChromeLegacyList     = "/etc/apt/sources.list.d/google-chrome.list"
)

// googleChromeKeyring is Google's Linux package signing key exactly as
// google-chrome-stable's postinst writes it (158.0.8127.36), so the package
// later rewrites identical bytes. Its signing subkeys run to 2029; Chrome's
// own upgrades refresh the file before then.
//
//go:embed google-chrome.gpg
var googleChromeKeyring string

// googleChromeSources is the deb822 source google-chrome-stable's postinst
// writes for this architecture, byte for byte.
func googleChromeSources(arch string) string {
	return "### THIS FILE IS AUTOMATICALLY CONFIGURED ###\n" +
		"# Changes to this file will not be preserved.\n" +
		"# This file will not be recreated if removed.\n" +
		"X-Repolib-Name: Google Chrome\n" +
		"Types: deb\n" +
		"URIs: https://dl.google.com/linux/chrome-stable/deb/\n" +
		"Suites: stable\n" +
		"Components: main\n" +
		"Architectures: " + arch + "\n" +
		"Signed-By: " + googleChromeKeyringPath + "\n"
}

// ServerBrowserOutcome says what apply or upgrade did about the server
// browser's Chrome. Reason codes name the step that stopped; no apt output
// is carried.
type ServerBrowserOutcome struct {
	Outcome string `json:"outcome"`
	Reason  string `json:"reason,omitempty"`
}

var (
	errServerBrowserSource    = errors.New("google_source_unavailable")
	errServerBrowserCandidate = errors.New("apt_candidate_cannot_meet_minimum")
	errServerBrowserSolve     = errors.New("apt_solution_refused")
	errServerBrowserInstall   = errors.New("apt_install_failed")
)

// offerServerBrowser installs Chrome when it is missing and reports the
// outcome; it never returns an error to the operation.
func offerServerBrowser(ctx context.Context, progress func(string) error) *ServerBrowserOutcome {
	if _, err := os.Stat(serverBrowserChrome); err == nil {
		return &ServerBrowserOutcome{Outcome: "present"}
	}
	if progress != nil {
		_ = progress("server_browser")
	}
	installed, err := installServerBrowser(ctx, "/", 0, runtime.GOARCH, nativeCommandTimeout)
	switch {
	case err != nil:
		return &ServerBrowserOutcome{Outcome: "unavailable", Reason: err.Error()}
	case !installed:
		return &ServerBrowserOutcome{Outcome: "present"}
	}
	return &ServerBrowserOutcome{Outcome: "installed"}
}

// installServerBrowser reports whether it installed Chrome. A Chrome that is
// already there is the host apt's to update; an administrator's own Google
// source (the legacy list file) is used as it is.
//
// What it wrote is withdrawn again when anything before the installation
// fails: a source the host cannot reach would make every later apt update
// warn or fail, and one that conflicts with an administrator's entry for the
// same repository would stop apt reading its sources at all. After a failed
// installation they stay, because dpkg may already have unpacked Chrome,
// whose package then owns them.
func installServerBrowser(ctx context.Context, root string, owner uint32, arch string, run ubuntuCommand) (bool, error) {
	if arch != "amd64" && arch != "arm64" {
		return false, errServerBrowserSource
	}
	if _, err := os.Stat(filepath.Join(root, serverBrowserChrome)); err == nil {
		return false, nil
	}
	var wrote []string
	fail := func(err error) (bool, error) {
		for _, p := range wrote {
			_ = os.Remove(filepath.Join(root, p))
		}
		return false, err
	}
	source := googleChromeSourcesPath
	if _, err := os.Lstat(filepath.Join(root, googleChromeLegacyList)); err == nil {
		source = googleChromeLegacyList
	} else {
		for _, p := range []policyFile{{googleChromeKeyringPath, googleChromeKeyring}, {googleChromeSourcesPath, googleChromeSources(arch)}} {
			if _, err := os.Lstat(filepath.Join(root, p.Path)); err == nil {
				continue
			}
			if installPolicy(root, p, owner) != nil {
				return fail(errServerBrowserSource)
			}
			wrote = append(wrote, p.Path)
		}
	}
	// Refresh only Google's index: the host's own sources and their lists are
	// left exactly as the administrator's apt keeps them. apt reports a
	// failed fetch as success unless told otherwise. HTTPS to Google needs
	// ca-certificates, a core Ubuntu requirement.
	if _, err := run(ctx, 5*time.Minute, "/usr/bin/apt-get", "-q", "--error-on=any", "update",
		"-o", "Dir::Etc::SourceList="+source, "-o", "Dir::Etc::SourceParts=-",
		"-o", "APT::Get::List-Cleanup=false", "-o", "DPkg::Lock::Timeout=300"); err != nil {
		return fail(errServerBrowserSource)
	}
	output, err := run(ctx, time.Minute, "/usr/bin/apt-cache", "policy", serverBrowserPackage)
	candidate, exact := ubuntuCandidate(output, RuntimePackage{Name: serverBrowserPackage, Architecture: arch})
	if err != nil || !exact || compareDebVersions(candidate, serverBrowserChromeMinimum) < 0 {
		return fail(errServerBrowserCandidate)
	}
	args := aptInstallArgs([]string{serverBrowserPackage})
	if _, err := run(ctx, 5*time.Minute, "/usr/bin/apt-get", append([]string{"--simulate"}, args...)...); err != nil {
		return fail(errServerBrowserSolve)
	}
	if _, err := run(ctx, 30*time.Minute, "/usr/bin/apt-get", args...); err != nil {
		return false, errServerBrowserInstall
	}
	if _, err := os.Stat(filepath.Join(root, serverBrowserChrome)); err != nil {
		return false, errServerBrowserInstall
	}
	return true, nil
}
