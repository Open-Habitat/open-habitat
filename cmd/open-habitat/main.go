package main

import (
	"context"
	"fmt"
	"github.com/Open-Habitat/open-habitat/internal/bootguard"
	"github.com/Open-Habitat/open-habitat/internal/cli"
	"github.com/Open-Habitat/open-habitat/internal/host"
	"github.com/Open-Habitat/open-habitat/internal/provision"
	"github.com/Open-Habitat/open-habitat/internal/storagequota"
	"os"
	"time"
)

func main() {
	if len(os.Args) == 4 && os.Args[1] == "upgrade-listener-probe" {
		if !host.ProbeUpgradeListener(os.Args[2], os.Args[3]) {
			os.Exit(1)
		}
		return
	}
	if len(os.Args) == 3 && os.Args[1] == "binding-activation-check" {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()
		reason := "verified"
		if bootguard.Upgrade() != "verified" || provision.CheckActivation(ctx, os.Args[2]) != nil {
			reason = "binding_activation_refused"
		}
		fmt.Fprintf(os.Stderr, `{"component":"broker","event":"activation_check","reason":%q}`+"\n", reason)
		if reason != "verified" {
			os.Exit(1)
		}
		return
	}

	if len(os.Args) == 2 && os.Args[1] == "boot-storage-check" {
		reason := bootguard.Upgrade()
		if reason == "verified" {
			reason = bootguard.Storage()
		}
		fmt.Fprintf(os.Stderr, `{"component":"boot","event":"storage_check","reason":%q}`+"\n", reason)
		if reason != "verified" {
			os.Exit(1)
		}
		os.Exit(0)
	}
	if len(os.Args) == 2 && os.Args[1] == "quota-probe-write" {
		os.Exit(storagequota.ProbeWrite())
	}
	os.Exit(cli.Run(os.Args[1:], os.Stdout, os.Stderr))
}
