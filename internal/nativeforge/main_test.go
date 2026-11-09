package nativeforge

import (
	"os"
	"testing"

	"github.com/Open-Habitat/open-habitat/internal/testgitenv"
)

// TestMain drops the caller's repository-bound Git variables, so the git
// fixtures here never reach the checkout the tests were run from.
func TestMain(m *testing.M) {
	testgitenv.Scrub()
	os.Exit(m.Run())
}
