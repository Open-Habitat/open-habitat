// The masked Entra screenshots (proto-m365-setup-flow round 3, crops.py
// there): each crop's box in the original capture's pixels and the
// rectangles the guide lights. Tenant ids, client ids and the
// organisation's domain are masked in the images themselves.
export const entraCrops = {
  register: {
    box: [0, 0, 1796, 1420],
    targets: {
      name: [4, 214, 1630, 396],
      accounts: [4, 470, 890, 630],
      redirect: [4, 770, 1330, 986],
      register: [6, 1346, 208, 1410],
    },
  },
  list: {
    box: [0, 0, 1796, 1050],
    targets: {
      "new": [24, 180, 288, 240],
      tabs: [36, 470, 252, 540],
      search: [40, 562, 952, 626],
      row: [36, 916, 1080, 978],
    },
  },
  overview: {
    box: [0, 0, 2166, 800],
    targets: {
      menu: [0, 248, 510, 312],
      client: [580, 448, 1092, 524],
      object: [580, 536, 1092, 612],
      tenant: [580, 624, 1092, 700],
      essentials: [580, 296, 2150, 790],
    },
  },
  auth: {
    box: [0, 0, 2166, 750],
    targets: {
      menu: [0, 650, 510, 714],
      tab: [560, 474, 906, 536],
      settings: [1240, 474, 1362, 536],
      add: [574, 662, 832, 718],
      tabs: [560, 474, 1362, 536],
    },
  },
  perms: {
    box: [0, 0, 2166, 1130],
    targets: {
      menu: [0, 842, 510, 906],
      add: [560, 864, 818, 910],
      grant: [840, 864, 1300, 910],
      graph: [570, 1004, 830, 1048],
      configured: [548, 690, 2150, 1124],
    },
  },
} as const;
