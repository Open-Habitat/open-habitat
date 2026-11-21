// Google's screens for the setup guide and the connect help. These are
// synthetic placeholder illustrations, drawn by hand and marked as such in
// the image itself; they are not captures of Google. Real captures, made
// with a consenting synthetic test account and masked like the Entra ones,
// replace them under the same names and targets (each box in the image's
// pixels), so the guides do not change when they arrive.
export const googleCrops = {
  warning: {
    box: [0, 0, 1600, 900],
    targets: {
      heading: [340, 230, 1000, 290],
      advanced: [338, 530, 490, 580],
      back: [994, 519, 1256, 591],
    },
  },
  warningOpen: {
    box: [0, 0, 1600, 900],
    targets: {
      goto: [338, 734, 640, 786],
    },
  },
  audience: {
    box: [0, 0, 1800, 1100],
    targets: {
      menu: [0, 270, 360, 326],
      publish: [414, 274, 646, 340],
      external: [414, 474, 676, 540],
      cap: [414, 600, 1290, 735],
    },
  },
} as const;

/** These images are placeholders until real captures arrive. */
export const googlePlaceholders = true;
