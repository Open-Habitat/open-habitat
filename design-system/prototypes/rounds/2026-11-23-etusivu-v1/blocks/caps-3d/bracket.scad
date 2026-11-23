// Bracket for the display rail. Every size is a named number, in millimetres.
// The model lies the way it prints: the L-shaped outline is drawn flat and
// pulled up, so the printed layers run around the bend, not across it.

width     = 62;   // along the rail
depth     = 48;   // out from the wall
height    = 30;   // up the wall
thickness = 3;    // of both plates
hole      = 5.5;  // the two screw holes

// Not measured, chosen: the old one snapped at the bend.
bend      = 9;    // rounding inside the bend
lip       = 6;    // front edge that keeps the rail on the shelf
edge      = 1.2;  // rounding of the outer corners
$fn       = 96;

// The outline seen from the end: wall plate up, shelf out, lip at the front.
module outline() {
  offset(r = edge) offset(delta = -edge)          // round the outer corners
  offset(r = -bend) offset(delta = bend)          // fill the inside of the bend
  union() {
    square([thickness, height]);
    square([depth, thickness]);
    translate([depth - thickness, 0]) square([thickness, lip + thickness]);
  }
}

// A screw hole through the wall plate, widened for a countersunk head.
module screw(at) {
  translate([0, (height + thickness + bend) / 2, at]) rotate([0, 90, 0]) {
    translate([0, 0, -1]) cylinder(d = hole, h = thickness + 2);
    translate([0, 0, thickness - 1.6]) cylinder(d1 = hole, d2 = hole + 3.4, h = 1.7);
  }
}

difference() {
  linear_extrude(width) outline();
  screw(width * 0.22);
  screw(width * 0.78);
}

echo(str("bracket ", width, " x ", depth, " x ", height, " mm, ", thickness, " mm thick, 2 holes of ", hole, " mm"));
