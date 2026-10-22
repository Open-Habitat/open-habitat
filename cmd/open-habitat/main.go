package main

import (
	"github.com/Open-Habitat/open-habitat/internal/cli"
	"github.com/Open-Habitat/open-habitat/internal/storagequota"
	"os"
)

func main() {
	if len(os.Args) == 2 && os.Args[1] == "quota-probe-write" {
		os.Exit(storagequota.ProbeWrite())
	}
	os.Exit(cli.Run(os.Args[1:], os.Stdout, os.Stderr))
}
