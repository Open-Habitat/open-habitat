//go:build linux

package main

import (
	"os"

	"github.com/open-habitat/open-habitat/internal/msmcp"
)

func main() {
	os.Exit(msmcp.Command(os.Args[1:], os.Stdin, os.Stdout, os.Stderr))
}
