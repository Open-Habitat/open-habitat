package main

import (
	"fmt"
	"github.com/Open-Habitat/open-habitat/internal/bootguard"
	"github.com/Open-Habitat/open-habitat/internal/cli"
	"github.com/Open-Habitat/open-habitat/internal/storagequota"
	"os"
)

func main() {
	if len(os.Args) == 2 && os.Args[1] == "boot-storage-check" {
		reason := bootguard.Storage()
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
