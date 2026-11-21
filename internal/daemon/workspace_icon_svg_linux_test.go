//go:build linux

package daemon

import "testing"

func TestIconUploadSVGDocument(t *testing.T) {
	for _, input := range []string{iconSVG, "<?xml version=\"1.0\"?>\n<svg xmlns=\"http://www.w3.org/2000/svg\"/>", "\ufeff<svg/>"} {
		if !isSVGDocument([]byte(input)) {
			t.Fatalf("rejected SVG %q", input)
		}
	}
	for _, input := range []string{"export const X = () => <svg/>", "<html><svg/></html>", "<?xml version=\"1.0\"?><other/>", "<svgfoo/>", "<svg/>trailing", "<svg/><svg/>", "<svg>", "<svg xmlns=\"urn:other\"/>"} {
		if isSVGDocument([]byte(input)) {
			t.Fatalf("accepted non-SVG %q", input)
		}
	}
}
