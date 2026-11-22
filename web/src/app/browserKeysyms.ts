import keysyms from "@novnc-keysyms";

// noVNC 1.7.0's generated table maps U+01D2 (small o with caron) to
// U+01D1 (capital O). Correct the shared lookup so canvas typing and the
// keystroke field agree; remove this when the pinned upstream table is fixed.
const lookup = keysyms.lookup;
keysyms.lookup = (cp) => (cp === 0x01d2 ? 0x010001d2 : lookup(cp));
export default keysyms;
