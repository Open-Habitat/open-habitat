package main

import (
	"os"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/testgitenv"
)

// TestMain drops the caller's repository-bound Git variables, as main does,
// so seedLab's git never reaches the checkout the tests were run from.
func TestMain(m *testing.M) {
	testgitenv.Scrub()
	os.Exit(m.Run())
}
