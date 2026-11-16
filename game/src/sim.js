// Sable Station — the simulation driver: phases, timers, planting and
// defusing, round and match flow. Fixed-step, deterministic for a given
// seed, and shared by the browser game and the headless test harness.

import { ECONOMY, MATCH, TICK } from './config.js';
import { SITES } from './map.js';
import { awardRound, botBuy, createMatch, startRound, teamAlive } from './state.js';
import { planRound, stepBot } from './bot.js';
import { finishReload, stepProjectiles } from './weapons.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createSim(seed = 1) {
  const rng = mulberry32(seed);
  const state = createMatch();
  beginRound(state, rng);
  return { state, rng, acc: 0 };
}

export function beginRound(state, rng) {
  startRound(state);
  planRound(state, rng);
  for (const f of state.fighters) {
    if (!f.isPlayer) botBuy(state, f, rng);
  }
}

/**
 * Advance the simulation. playerControl(fighter, dt) is called for the
 * human's fighter during play phases (the browser passes real input; the
 * headless harness passes a stub or a script).
 */
export function stepSim(sim, dt, playerControl) {
  const { state, rng } = sim;
  state.events.length = 0;
  sim.acc += dt;
  while (sim.acc >= TICK) {
    sim.acc -= TICK;
    tick(sim, playerControl);
  }
  return state;
}

function tick(sim, playerControl) {
  const { state, rng } = sim;
  state.time += TICK;

  for (const f of state.fighters) {
    if (f.fireT > 0) f.fireT -= TICK;
    if (f.hurtT > 0) f.hurtT -= TICK;
    if ((f.blindT ?? 0) > 0) f.blindT -= TICK;
    if (f.reloadT > 0) {
      f.reloadT -= TICK;
      if (f.reloadT <= 0) finishReload(f);
    }
  }
  stepProjectiles(state, TICK, rng);

  const phase = state.phase;
  if (phase === 'matchover') return;

  if (phase === 'over') {
    state.phaseT -= TICK;
    if (state.phaseT <= 0) {
      state.round++;
      beginRound(state, rng);
    }
    return;
  }

  // Fighters act during buy (walk only), live and planted phases.
  for (const f of state.fighters) {
    if (!f.alive) continue;
    if (f.isPlayer) {
      if (playerControl) playerControl(f, TICK);
    } else {
      stepBot(state, f, TICK, rng);
    }
  }

  if (phase === 'buy') {
    state.phaseT -= TICK;
    if (state.phaseT <= 0) {
      state.phase = 'live';
      state.phaseT = MATCH.roundSeconds;
    }
    return;
  }

  if (phase === 'live') {
    state.phaseT -= TICK;
    // Planting: the carrier channels while standing inside a site zone.
    const carrier = state.fighters.find((f) => f.hasCharge && f.alive);
    let planting = false;
    if (carrier && !carrier.moving) {
      for (const site of [SITES.A, SITES.B]) {
        if (Math.hypot(carrier.x - site.x, carrier.z - site.z) < site.r) {
          planting = true;
          carrier.plantT += TICK;
          if (carrier.plantT >= MATCH.plantSeconds) {
            carrier.hasCharge = false;
            carrier.plantT = 0;
            carrier.money = Math.min(ECONOMY.maxMoney, carrier.money + ECONOMY.plantReward);
            state.charge = {
              state: 'planted', carrier: null, site: site.id,
              x: carrier.x, z: carrier.z, t: MATCH.chargeSeconds,
            };
            state.phase = 'planted';
            state.events.push({ type: 'planted', site: site.id, x: carrier.x, z: carrier.z });
          }
          break;
        }
      }
    }
    if (!planting && carrier) carrier.plantT = Math.max(0, carrier.plantT - TICK * 2);

    if (state.phase === 'live') {
      if (teamAlive(state, 'def').length === 0) return awardRound(state, 'atk', false);
      if (teamAlive(state, 'atk').length === 0) return awardRound(state, 'def', false);
      if (state.phaseT <= 0) return awardRound(state, 'def', false);
    }
    return;
  }

  if (phase === 'planted') {
    state.charge.t -= TICK;
    // Defusing: a living defender channels beside the charge.
    let defusing = false;
    for (const f of state.fighters) {
      if (f.team !== 'def' || !f.alive || f.moving) continue;
      if (Math.hypot(f.x - state.charge.x, f.z - state.charge.z) < 2.0) {
        defusing = true;
        f.defuseT += TICK;
        if (f.defuseT >= MATCH.defuseSeconds) {
          state.events.push({ type: 'defused', id: f.id });
          return awardRound(state, 'def', true);
        }
      } else if (f.defuseT > 0) {
        f.defuseT = Math.max(0, f.defuseT - TICK * 2);
      }
    }
    if (!defusing) {
      for (const f of state.fighters) {
        if (f.team === 'def') f.defuseT = Math.max(0, f.defuseT - TICK * 2);
      }
    }
    if (teamAlive(state, 'def').length === 0) return awardRound(state, 'atk', true);
    if (state.charge.t <= 0) {
      state.events.push({ type: 'detonate', x: state.charge.x, z: state.charge.z });
      return awardRound(state, 'atk', true);
    }
  }
}
