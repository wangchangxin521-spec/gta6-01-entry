// Coral Bay — Sunset Streets. Every tuning number, colour and mission definition in one
// place. The world is a fixed 3600x2600 logical area; the renderer scales a 1280x720 view
// of it to the window, so no rule below depends on the screen size.

export const VIEW = { width: 1280, height: 720 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** World bounds, in pixels. */
export const WORLD = { width: 3600, height: 2600 };

/** Road centre-lines and width: a 6 by 5 grid of streets. */
export const ROADS_V = [400, 1000, 1600, 2200, 2800, 3300];
export const ROADS_H = [350, 850, 1350, 1850, 2250];
export const ROAD_W = 120;
export const SIDEWALK = 26;

export const PLAYER = {
  radius: 14,
  walkSpeed: 230,
  punchRange: 48,
  punchDamage: 34,
  punchCooldown: 0.38,
  interactRange: 100,
  health: 100,
};

export const CAR = {
  length: 48,
  width: 24,
  accel: 430,
  brake: 640,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 170,
  turnRate: 2.4,
  drag: 0.55,
};

export const TRAFFIC = {
  count: 14,
  minSpeed: 110,
  maxSpeed: 190,
  turnChance: 0.28,
};

export const PEDS = { count: 26, walkMin: 34, walkMax: 62, fleeSpeed: 150 };

export const WANTED = {
  max: 5,
  decaySeconds: 22,
  stealCar: 1,
  punchPed: 1,
  ramPed: 1,
  hitCop: 2,
};

export const POLICE = {
  carSpeed: 500,
  carTurn: 3.1,
  ramDamage: 12,
  ramCooldown: 1.1,
  footSpeed: 208,
  punchDamage: 9,
  punchCooldown: 0.9,
  spawnDistance: 720,
};

/** One full day cycle, in seconds of play. */
export const DAY_LENGTH = 300;

export const SAVE_KEY = 'coral-bay.save.v1';
export const BEST_KEY = 'coral-bay.best.v1';

/** Warm, sun-soaked palette: coral stucco, sand, teal water, palm green. */
export const PALETTE = {
  backdrop: '#1d2b3a',
  grass: '#7fae62',
  grassDark: '#6d9c52',
  sand: '#ecd9a4',
  water: '#2e8fa8',
  waterDeep: '#1f6f88',
  road: '#3a3f47',
  roadEdge: '#2c3038',
  lane: '#e8d27a',
  sidewalk: '#b9b3a4',
  plaza: '#cbb89a',
  buildingRoof: ['#e07856', '#e8a04c', '#d95f66', '#f2e3c6', '#7fb5a3', '#c97b4a', '#a8c686', '#e5c07b'],
  buildingWall: '#8a6f5c',
  park: '#5d9448',
  tree: '#3f7a34',
  treeLight: '#57a047',
  player: '#ffd23f',
  playerShirt: '#2f6fb2',
  pedShirt: ['#d95f66', '#4c9a8a', '#e8a04c', '#7a6fc0', '#c96a9b', '#5b8c5a'],
  policeCar: '#e8e8e8',
  policeBlue: '#2b5fc7',
  taxi: '#f2c230',
  hud: '#10151d',
  hudPanel: 'rgba(12, 18, 26, 0.72)',
  text: '#f7f3e8',
  muted: '#c9c2ae',
  gold: '#f2c94c',
  star: '#ffd23f',
  mission: '#ffd23f',
  objective: '#7fe0a8',
  danger: '#ff5a4e',
  sun: '#ffb347',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/**
 * The three story missions. Every place is a named spot in the city the player made
 * themselves — no real city, no borrowed names.
 */
export const MISSIONS = [
  {
    id: 'courier',
    name: 'Sunset Courier',
    giver: 'Marina Kessler',
    giverAt: { x: 330, y: 2100 },
    giverBlurb: 'A parcel for the Palms Hotel. The sun sets in 90 seconds — do not be late.',
    briefing: 'Pick up the parcel at Coral Marina, then deliver it to the Palms Hotel before the timer runs out.',
    reward: 300,
    timeLimit: 95,
    stages: [
      { id: 'pickup', label: 'Pick up the parcel at Coral Marina', x: 210, y: 2150 },
      { id: 'deliver', label: 'Deliver the parcel to the Palms Hotel', x: 1900, y: 1215 },
    ],
  },
  {
    id: 'runaway',
    name: 'Runaway Wheels',
    giver: 'Dario Fontaine',
    giverAt: { x: 1300, y: 1100 },
    giverBlurb: 'A courier van took my cargo and ran. Stop that van — ram it until it quits.',
    briefing: 'Chase the runaway courier van and ram it 3 times to force it to stop.',
    reward: 450,
    timeLimit: 150,
    stages: [
      { id: 'chase', label: 'Ram the runaway van 3 times', x: 2200, y: 850 },
    ],
    hitsToStop: 3,
  },
  {
    id: 'lifeguard',
    name: 'Lifeguard Call',
    giver: 'Nia Solano',
    giverAt: { x: 1420, y: 2400 },
    giverBlurb: 'A swimmer is hurt on South Beach. Bring them to St. Aurelia Hospital, fast.',
    briefing: 'Reach the hurt swimmer on South Beach, then get them to St. Aurelia Hospital.',
    reward: 500,
    timeLimit: 150,
    stages: [
      { id: 'reach', label: 'Reach the hurt swimmer on South Beach', x: 1500, y: 2470 },
      { id: 'hospital', label: 'Bring them to St. Aurelia Hospital', x: 2500, y: 1705 },
    ],
  },
];

/** Fixed named spots, computed from the road grid so missions always land on real places. */
export const SPOTS = {
  spawn: { x: 1300, y: 1100 },
  marina: { x: 210, y: 2150 },
  hotel: { x: 1900, y: 1215 },
  hospital: { x: 2500, y: 1705 },
  beach: { x: 1500, y: 2470 },
  plaza: { x: 1300, y: 1100 },
  policeHQ: { x: 1000, y: 350 },
};
