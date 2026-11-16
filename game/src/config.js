// Sable Station — shared tuning: teams, economy, weapons, bot behaviour.
// Everything the simulation and the HUD agree on lives here so a match is
// the same game in the browser and in the headless test harness.

export const TICK = 1 / 60;

export const TEAMS = {
  atk: { id: 'atk', name: 'Jackals', color: 0xff7a33, css: '#ff7a33' },
  def: { id: 'def', name: 'Sentinels', color: 0x57c8ff, css: '#57c8ff' },
};

export const MATCH = {
  winScore: 7,
  maxRounds: 13,
  buySeconds: 12,
  roundSeconds: 105,
  chargeSeconds: 40,
  plantSeconds: 3.2,
  defuseSeconds: 5,
  freezeSeconds: 1.2,
};

export const ECONOMY = {
  start: 800,
  winElimination: 3200,
  winObjective: 3600,
  lossBase: 1800,
  lossStreakStep: 400,
  lossCap: 2600,
  killReward: 300,
  plantReward: 300,
  maxMoney: 16000,
};

// damage: per-hit body damage at point blank; falloff: fraction kept at maxRange.
// rpm: rounds per minute; mag: magazine size; reserve: spare rounds carried.
// spread: half-angle in radians while standing still; moveSpread adds while moving.
export const WEAPONS = {
  pick: {
    id: 'pick', name: 'Ice Pick', slot: 'melee', price: 0,
    damage: 55, rpm: 68, mag: Infinity, reserve: Infinity, reload: 0,
    range: 1.9, spread: 0, moveSpread: 0, falloff: 1, auto: false,
    zoom: 1, pellets: 1, headMult: 2.2,
  },
  pika: {
    id: 'pika', name: 'Pika P2', slot: 'sidearm', price: 0,
    damage: 34, rpm: 352, mag: 12, reserve: 96, reload: 1.35,
    range: 46, spread: 0.011, moveSpread: 0.03, falloff: 0.55, auto: false,
    zoom: 1, pellets: 1, headMult: 3.4,
  },
  squall: {
    id: 'squall', name: 'Squall-9 SMG', slot: 'primary', price: 1400,
    damage: 26, rpm: 857, mag: 32, reserve: 128, reload: 1.9,
    range: 42, spread: 0.02, moveSpread: 0.045, falloff: 0.5, auto: true,
    zoom: 1, pellets: 1, headMult: 3.2,
  },
  longwinter: {
    id: 'longwinter', name: 'Longwinter VK-9', slot: 'primary', price: 2800,
    damage: 40, rpm: 666, mag: 25, reserve: 100, reload: 2.2,
    range: 78, spread: 0.007, moveSpread: 0.035, falloff: 0.72, auto: true,
    zoom: 1.15, pellets: 1, headMult: 3.6,
  },
  aurora: {
    id: 'aurora', name: 'Aurora .338', slot: 'primary', price: 4700,
    damage: 112, rpm: 41, mag: 5, reserve: 30, reload: 3.1,
    range: 140, spread: 0.0012, moveSpread: 0.09, falloff: 0.95, auto: false,
    zoom: 4, pellets: 1, headMult: 2.4,
  },
};

export const GEAR = {
  frag: { id: 'frag', name: 'Frag Charge', price: 300, max: 1 },
  flare: { id: 'flare', name: 'Flare Blind', price: 200, max: 2 },
  vest: { id: 'vest', name: 'Parka Weave', price: 650 },
  vestHelm: { id: 'vestHelm', name: 'Parka + Visor', price: 1000 },
};

export const ARMOR = {
  none: { bodyMult: 1, headMult: 1 },
  vest: { bodyMult: 0.55, headMult: 1 },
  vestHelm: { bodyMult: 0.55, headMult: 0.5 },
};

export const BOT = {
  count: 4, // per side, plus the player on atk
  visionRange: 64,
  visionCos: Math.cos((108 * Math.PI) / 180 / 2),
  hearingRange: 30,
  reactionMin: 0.3,
  reactionMax: 0.66,
  burstPause: 0.34,
  walkSpeed: 3.4,
  runSpeed: 5.1,
  accuracy: 0.62,
};

export const PLAYER = {
  walkSpeed: 3.6,
  runSpeed: 5.3,
  crouchSpeed: 1.9,
  radius: 0.42,
  height: 1.72,
  eye: 1.6,
  health: 100,
};

// Sky and light for the polar blue hour the station sits in.
export const PALETTE = {
  sky: 0x0d1b2e,
  fog: 0x16283f,
  snow: 0xdfe9f2,
  snowShadow: 0xb9cbdd,
  wallPanel: 0x8fa3b5,
  wallDark: 0x4d6070,
  roof: 0x37434f,
  glass: 0x9fd8e8,
  reactor: 0x67e8c9,
  dish: 0xe8eef4,
  crate: 0x9a6b3f,
  pipe: 0xc75146,
  lampWarm: 0xffb45e,
  auroraA: 0x3dffb0,
  auroraB: 0x7a5cff,
};
