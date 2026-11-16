// Sable Station — screenshot scenes. Each scene poses the match and the
// camera so the capture tool can grab the four dossier images:
// cover (the station under the aurora), buy (spawn with the buy menu),
// fight (a glasshouse firefight), plant (the charge down at Array Yard).

import { SITES } from './map.js';
import { tryFire } from './weapons.js';

function place(f, x, z, yaw) {
  f.x = x;
  f.z = z;
  f.yaw = yaw;
  f.moving = false;
}

export function applyShot(sim, name) {
  const { state, rng } = sim;
  const player = state.fighters.find((f) => f.isPlayer);
  const atk = state.fighters.filter((f) => f.team === 'atk');
  const def = state.fighters.filter((f) => f.team === 'def');

  if (name === 'cover') {
    state.phase = 'live';
    state.phaseT = 96;
    place(player, -28, 30, 2.48);
    player.pitch = 0.1;
    place(atk[1], -24, 26, 2.45);
    place(atk[2], -33, 25, 2.55);
    return { ticks: 2, cam: null }; // camera rides the player's eyes
  }
  if (name === 'buy') {
    place(player, -33, 40, Math.PI * 0.78);
    return { ticks: 2, cam: null };
  }
  if (name === 'fight') {
    state.phase = 'live';
    state.phaseT = 80;
    place(player, -17, -6, Math.PI / 2 - 0.15);
    place(atk[1], -12, -1, Math.PI / 2);
    place(atk[2], -19, -10, Math.PI / 2 - 0.3);
    place(def[0], 9, -4, -Math.PI / 2);
    place(def[1], 7, 3, -Math.PI / 2 + 0.4);
    place(def[2], 12, -11, -Math.PI / 2 - 0.2);
    // Scripted exchange so tracers and muzzles are in the air.
    for (const f of [atk[1], def[0], def[1]]) {
      f.fireT = 0;
      f.weapons.primary = 'longwinter';
      f.slot = 'primary';
      f.ammo.longwinter = { mag: 25, reserve: 75 };
      tryFire(state, f, rng);
      f.fireT = 0;
    }
    return { ticks: 1, cam: null };
  }
  if (name === 'plant') {
    state.phase = 'planted';
    state.phaseT = 0;
    state.charge = {
      state: 'planted', carrier: null, site: 'B',
      x: SITES.B.x - 2, z: SITES.B.z + 1, t: 31,
    };
    place(player, 18, 16, 2.39);
    place(atk[1], 29, 5, Math.PI * 0.9);
    place(atk[2], 26, -6, Math.PI * 0.4);
    place(def[0], 38, -11, -Math.PI * 0.8);
    place(def[1], 42, 3, -Math.PI * 0.6);
    return { ticks: 2, cam: null };
  }
  return { ticks: 1, cam: null };
}
