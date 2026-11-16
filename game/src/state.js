// Sable Station — match state: fighters, rounds, economy, the core charge.
// Pure data plus small helpers; sim.js drives the phases, bot.js and
// player.js move the fighters, hud.js reads it all back out.

import { ECONOMY, MATCH, SPAWNS, WEAPONS } from './config.js';

let nextId = 1;

export function makeFighter(team, isPlayer, spawn) {
  return {
    id: nextId++,
    team,
    isPlayer,
    name: isPlayer ? 'You' : `${team === 'atk' ? 'Jackal' : 'Sentinel'}-${nextId}`,
    alive: true,
    health: 100,
    armor: 'none',
    money: ECONOMY.start,
    weapons: { primary: null, sidearm: 'pika', melee: 'pick' },
    slot: 'sidearm',
    ammo: {},
    nades: { frag: 0, flare: 0 },
    x: spawn.x,
    z: spawn.z,
    yaw: team === 'atk' ? Math.PI * 0.78 : -Math.PI * 0.72,
    pitch: 0,
    crouch: false,
    moving: false,
    kills: 0,
    deaths: 0,
    hasCharge: false,
    plantT: 0,
    defuseT: 0,
    reloadT: 0,
    fireT: 0,
    hurtT: 0,
  };
}

export function currentWeapon(f) {
  const id = f.weapons[f.slot];
  return id ? WEAPONS[id] : WEAPONS.pick;
}

export function ammoOf(f, weaponId) {
  if (!f.ammo[weaponId]) {
    const w = WEAPONS[weaponId];
    f.ammo[weaponId] = { mag: w.mag === Infinity ? Infinity : w.mag, reserve: w.reserve };
  }
  return f.ammo[weaponId];
}

export function createMatch() {
  nextId = 1;
  const fighters = [];
  fighters.push(makeFighter('atk', true, SPAWNS.atk[0]));
  for (let i = 1; i < 5; i++) fighters.push(makeFighter('atk', false, SPAWNS.atk[i]));
  for (let i = 0; i < 5; i++) fighters.push(makeFighter('def', false, SPAWNS.def[i]));
  const state = {
    phase: 'buy',
    phaseT: MATCH.buySeconds,
    round: 1,
    scores: { atk: 0, def: 0 },
    fighters,
    charge: { state: 'carried', carrier: null, site: null, x: 0, z: 0, t: 0 },
    lossStreak: { atk: 0, def: 0 },
    winner: null,
    roundWinner: null,
    events: [],
    time: 0,
  };
  assignCharge(state);
  return state;
}

function assignCharge(state) {
  const atk = state.fighters.filter((f) => f.team === 'atk');
  const carrier = atk.find((f) => f.isPlayer) ?? atk[0];
  for (const f of atk) f.hasCharge = f === carrier;
  state.charge = { state: 'carried', carrier: carrier.id, site: null, x: 0, z: 0, t: 0 };
}

export function startRound(state) {
  const spawns = { atk: 0, def: 0 };
  for (const f of state.fighters) {
    const list = f.team === 'atk' ? SPAWNS.atk : SPAWNS.def;
    const spawn = list[spawns[f.team]++ % list.length];
    f.x = spawn.x;
    f.z = spawn.z;
    f.yaw = f.team === 'atk' ? Math.PI * 0.78 : -Math.PI * 0.72;
    f.pitch = 0;
    f.alive = true;
    f.health = 100;
    f.crouch = false;
    f.moving = false;
    f.plantT = 0;
    f.defuseT = 0;
    f.reloadT = 0;
    f.fireT = 0;
    f.hurtT = 0;
    if (!f.weapons.primary) f.slot = 'sidearm';
  }
  assignCharge(state);
  state.phase = 'buy';
  state.phaseT = MATCH.buySeconds;
  state.roundWinner = null;
}

export function teamAlive(state, team) {
  return state.fighters.filter((f) => f.team === team && f.alive);
}

/** End the round: score, pay both teams, remember the loss streaks. */
export function awardRound(state, winnerTeam, byObjective) {
  state.roundWinner = winnerTeam;
  state.scores[winnerTeam]++;
  const loser = winnerTeam === 'atk' ? 'def' : 'atk';
  state.lossStreak[winnerTeam] = 0;
  state.lossStreak[loser]++;
  const lossPay = Math.min(
    ECONOMY.lossCap,
    ECONOMY.lossBase + ECONOMY.lossStreakStep * (state.lossStreak[loser] - 1),
  );
  for (const f of state.fighters) {
    if (f.team === winnerTeam) {
      f.money = Math.min(ECONOMY.maxMoney, f.money + (byObjective ? ECONOMY.winObjective : ECONOMY.winElimination));
    } else {
      f.money = Math.min(ECONOMY.maxMoney, f.money + lossPay);
    }
  }
  if (state.scores.atk >= MATCH.winScore || state.scores.def >= MATCH.winScore || state.round >= MATCH.maxRounds) {
    state.winner = state.scores.atk > state.scores.def ? 'atk' : 'def';
    state.phase = 'matchover';
  } else {
    state.phase = 'over';
  }
  state.phaseT = 4.5;
}

/** A purchase attempt; returns true when the fighter could pay and got it. */
export function buyItem(state, f, itemId) {
  if (state.phase !== 'buy' || !f.alive) return false;
  if (WEAPONS[itemId]) {
    const w = WEAPONS[itemId];
    if (w.slot === 'melee' || f.money < w.price) return false;
    if (w.slot === 'primary') f.weapons.primary = itemId;
    else f.weapons.sidearm = itemId;
    f.money -= w.price;
    f.ammo[itemId] = { mag: w.mag, reserve: w.reserve };
    f.slot = w.slot;
    return true;
  }
  if (itemId === 'frag' || itemId === 'flare') {
    const price = itemId === 'frag' ? 300 : 200;
    const max = itemId === 'frag' ? 1 : 2;
    if (f.money < price || f.nades[itemId] >= max) return false;
    f.money -= price;
    f.nades[itemId]++;
    return true;
  }
  if (itemId === 'vest' || itemId === 'vestHelm') {
    const price = itemId === 'vest' ? 650 : 1000;
    if (f.money < price || f.armor === itemId) return false;
    if (itemId === 'vest' && f.armor === 'vestHelm') return false;
    f.money -= price;
    f.armor = itemId;
    return true;
  }
  return false;
}

/** The bot buy brain: a sensible shopping list in priority order. */
export function botBuy(state, f, rng) {
  const tryBuy = (id) => buyItem(state, f, id);
  if (!f.weapons.primary) {
    if (f.money >= 4700 && rng() < 0.3) tryBuy('aurora');
    else if (f.money >= 2800) tryBuy('longwinter');
    else if (f.money >= 1400) tryBuy('squall');
  }
  if (f.armor === 'none' && f.money >= 1000) tryBuy('vestHelm');
  else if (f.armor === 'none' && f.money >= 650) tryBuy('vest');
  if (f.money >= 500) tryBuy('frag');
  if (f.money >= 400) tryBuy('flare');
}
