// SOLBRISA — every tuning number in one place. The city is a 7x7 block grid with
// 16-wide roads on a 72-unit pitch, a beach and ocean on the east side. Y is up;
// the ground plane is y=0. All distances are in world units, speeds in units/sec.

export const STEP = 1 / 60;
export const SAVE_KEY = 'solbrisa.save.v1';
export const DEFAULT_SEED = 7;

// City layout. Road centres sit at -252 + i*72 (i = 0..7); blocks sit between them.
export const BLOCKS = 7;
export const BLOCK = 56;
export const ROAD = 16;
export const PITCH = BLOCK + ROAD; // 72
export const HALF = 260; // city spans -260..260 on x and z
export const ROAD_CENTERS = [-252, -180, -108, -36, 36, 108, 180, 252];
export const BLOCK_CENTERS = [-216, -144, -72, 0, 72, 144, 216];
export const COAST_ROAD_X = 300; // north-south coast road
export const SAND_X = 262; // sand starts here
export const WATER_X = 330; // ocean starts here
export const BOUND = { minX: -258, maxX: 324, minZ: -258, maxZ: 258 };

export const PLAYER_SPAWN = { x: -36, z: 120 };
export const GARAGE = { x: -180, z: -204 }; // Vex's Garage (mission hub, roadside)
export const HOSPITAL = { x: 36, z: 36 };
export const POLICE_STATION = { x: -36, z: -36 };
export const MARINA = { x: 240, z: 180 };
export const DINER = { x: -180, z: 200 };
export const LOOKOUT = { x: 306, z: -180 };
export const HIDEOUT = { x: 180, z: -200 };

export const PLAYER = {
  radius: 0.6,
  walkSpeed: 5.2,
  runSpeed: 8.6,
  accel: 40,
  friction: 10,
  jumpSpeed: 8.2,
  gravity: 22,
  height: 1.8,
};

export const CAR = {
  maxSpeed: 27,
  reverseSpeed: 9,
  accel: 16,
  brake: 30,
  drag: 0.35,
  turnRate: 1.9, // rad/s at full lock, scaled down at speed
  radius: 1.9,
  enterRange: 3.4,
};

export const TRAFFIC = { count: 14, speedMin: 9, speedMax: 14, turnChance: 0.22 };
export const PEDS = { count: 26, walkMin: 1.1, walkMax: 2.0, fleeSpeed: 5.5 };
export const PARKED = { count: 16 };

export const POLICE = {
  maxCars: 5,
  maxCops: 4,
  carSpeed: 28.5,
  copSpeed: 7.4,
  bustRange: 2.6,
  bustTime: 2.4,
  decayDelay: 6, // seconds unseen before a star drops
  decaySeenRange: 46,
};

export const HEALTH = { max: 100, crashDiv: 14, punch: 6, copPunch: 7 };
export const COMBAT = {
  pistolDamage: 34,
  pistolRange: 70,
  pistolAmmoStart: 12,
  pistolAmmoMax: 48,
  fireInterval: 0.22,
  meleeDamage: 16,
  meleeRange: 2.4,
  pedHealth: 50,
  copHealth: 90,
};

export const MONEY = { start: 150, pickup: 50, bustLoss: 0.1, wastedLoss: 0.1 };

export const PALETTE = {
  skyTop: 0x2e5f8a,
  skyHorizon: 0xffb36b,
  fog: 0xf2a35e,
  sun: 0xffd9a0,
  ground: 0x8f8a80,
  road: 0x3a3d42,
  sidewalk: 0xb8b2a8,
  sand: 0xe8d5a3,
  ocean: 0x2f7ea6,
  building: [0xd8c9b0, 0xc9b8a3, 0xb7c4cc, 0xd9b8a6, 0xc2c9b8, 0xe0d3c0, 0xb0b8c9, 0xd3c9a8],
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';
