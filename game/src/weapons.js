// Sable Station — weapons: hitscan fire, melee, reloads, and the two
// grenades (frag charge, flare blind). Damage flows through armor and
// distance falloff; every outcome lands in state.events for the HUD,
// the sound engine and the replay log.

import { ARMOR, ECONOMY, WEAPONS } from './config.js';
import { losBlocked, rayDistance } from './physics.js';
import { ammoOf, currentWeapon } from './state.js';

export function eyeHeight(f) {
  return f.crouch ? 1.15 : 1.6;
}

export function targetHeight(f) {
  return f.crouch ? 1.15 : 1.72;
}

function falloffAt(w, dist) {
  const t = Math.min(1, dist / w.range);
  return 1 - (1 - w.falloff) * t;
}

export function startReload(state, f) {
  const w = currentWeapon(f);
  if (w.mag === Infinity || f.reloadT > 0) return;
  const ammo = ammoOf(f, w.id);
  if (ammo.mag >= w.mag || ammo.reserve <= 0) return;
  f.reloadT = w.reload;
  state.events.push({ type: 'reload', id: f.id });
}

export function finishReload(f) {
  const w = currentWeapon(f);
  const ammo = ammoOf(f, w.id);
  const take = Math.min(w.mag - ammo.mag, ammo.reserve);
  ammo.mag += take;
  ammo.reserve -= take;
}

/** One trigger pull. Returns true when a shot actually left the weapon. */
export function tryFire(state, f, rng) {
  if (!f.alive || f.fireT > 0 || f.reloadT > 0 || f.plantT > 0 || f.defuseT > 0) return false;
  const w = currentWeapon(f);
  const ammo = ammoOf(f, w.id);
  if (w.id !== 'pick' && ammo.mag <= 0) {
    startReload(state, f);
    return false;
  }
  f.fireT = 60 / w.rpm;
  if (w.id !== 'pick') ammo.mag--;

  const eye = eyeHeight(f);
  const spread = w.spread + (f.moving ? w.moveSpread : 0) + (f.crouch ? -w.spread * 0.3 : 0);
  const yaw = f.yaw + (rng() * 2 - 1) * Math.max(0, spread);
  const dx = Math.sin(yaw);
  const dz = Math.cos(yaw);

  state.events.push({ type: 'shot', id: f.id, weapon: w.id, x: f.x, z: f.z, yaw });

  if (w.id === 'pick') {
    for (const target of state.fighters) {
      if (target === f || !target.alive || target.team === f.team) continue;
      const tx = target.x - f.x;
      const tz = target.z - f.z;
      const dist = Math.hypot(tx, tz);
      if (dist > w.range + 0.42) continue;
      if ((tx * dx + tz * dz) / (dist || 1) < 0.4) continue;
      applyDamage(state, f, target, w.damage * w.headMult * 0.6, false, rng);
      return true;
    }
    return true;
  }

  const wallDist = rayDistance(f.x, f.z, dx, dz, eye, w.range);
  let best = null;
  let bestDist = Math.min(wallDist, w.range);
  for (const target of state.fighters) {
    if (target === f || !target.alive || target.team === f.team) continue;
    const tx = target.x - f.x;
    const tz = target.z - f.z;
    const along = tx * dx + tz * dz;
    if (along < 0.3 || along > bestDist) continue;
    const px = f.x + dx * along;
    const pz = f.z + dz * along;
    const off = Math.hypot(target.x - px, target.z - pz);
    if (off > 0.44) continue;
    const hitHeight = eye + Math.tan(f.pitch) * along;
    const top = targetHeight(target);
    if (hitHeight > top + 0.06 || hitHeight < 0.05) continue;
    best = target;
    bestDist = along;
    best.head = hitHeight >= top - 0.32;
    best.dist = along;
  }

  if (best) {
    let dmg = w.damage * falloffAt(w, best.dist);
    const armor = ARMOR[best.armor];
    if (best.head) dmg *= w.headMult * armor.headMult;
    else dmg *= armor.bodyMult;
    applyDamage(state, f, best, dmg, best.head, rng);
  } else if (wallDist <= w.range) {
    state.events.push({
      type: 'impact', x: f.x + dx * wallDist, z: f.z + dz * wallDist, weapon: w.id,
    });
  }
  if (ammo.mag === 0) startReload(state, f);
  return true;
}

export function applyDamage(state, attacker, target, dmg, head, rng) {
  if (!target.alive) return;
  target.health -= dmg;
  target.hurtT = 0.25;
  state.events.push({
    type: 'hit', attacker: attacker?.id ?? 0, target: target.id, dmg, head,
  });
  if (target.health <= 0) {
    target.alive = false;
    target.health = 0;
    target.deaths++;
    if (attacker && attacker.team !== target.team) {
      attacker.kills++;
      attacker.money = Math.min(ECONOMY.maxMoney, attacker.money + ECONOMY.killReward);
    }
    if (target.hasCharge) {
      target.hasCharge = false;
      state.charge = { state: 'dropped', carrier: null, site: null, x: target.x, z: target.z, t: 0 };
    }
    state.events.push({ type: 'kill', attacker: attacker?.id ?? 0, target: target.id, head });
  }
}

// --- Grenades ---------------------------------------------------------------

export function throwGrenade(state, f, kind) {
  if (!f.alive || f.nades[kind] <= 0) return false;
  f.nades[kind]--;
  const speed = 13;
  const vx = Math.sin(f.yaw) * speed;
  const vz = Math.cos(f.yaw) * speed;
  (state.booms ??= []).push({
    kind, team: f.team, thrower: f.id,
    x: f.x, z: f.z, y: 1.5, vx, vz, vy: 4.2,
    t: kind === 'frag' ? 1.6 : 1.05,
  });
  state.events.push({ type: 'throw', id: f.id, kind });
  return true;
}

export function stepProjectiles(state, dt, rng) {
  if (!state.booms) return;
  const keep = [];
  for (const b of state.booms) {
    b.t -= dt;
    b.vy -= 12 * dt;
    b.x += b.vx * dt;
    b.z += b.vz * dt;
    b.y += b.vy * dt;
    if (b.y < 0.15) { b.y = 0.15; b.vy *= -0.35; b.vx *= 0.7; b.vz *= 0.7; }
    if (b.t > 0) { keep.push(b); continue; }
    if (b.kind === 'frag') explodeFrag(state, b, rng);
    else explodeFlare(state, b);
    state.events.push({ type: 'boom', kind: b.kind, x: b.x, z: b.z });
  }
  state.booms = keep;
}

function explodeFrag(state, b, rng) {
  for (const f of state.fighters) {
    if (!f.alive) continue;
    const dist = Math.hypot(f.x - b.x, f.z - b.z);
    if (dist > 5.6) continue;
    let dmg = 96 * (1 - dist / 5.6) + 8;
    if (losBlocked(b.x, b.z, f.x, f.z)) dmg *= 0.35;
    dmg *= ARMOR[f.armor].bodyMult;
    const thrower = state.fighters.find((t) => t.id === b.thrower) ?? null;
    applyDamage(state, thrower && thrower.team !== f.team ? thrower : null, f, dmg, false, rng);
  }
}

function explodeFlare(state, b) {
  for (const f of state.fighters) {
    if (!f.alive) continue;
    const dx = b.x - f.x;
    const dz = b.z - f.z;
    const dist = Math.hypot(dx, dz);
    if (dist > 17) continue;
    if (losBlocked(f.x, f.z, b.x, b.z)) continue;
    const fx = Math.sin(f.yaw);
    const fz = Math.cos(f.yaw);
    const facing = (dx * fx + dz * fz) / (dist || 1);
    if (facing < 0.15) continue;
    const strength = facing * (1 - dist / 17);
    f.blindT = Math.max(f.blindT ?? 0, 0.7 + strength * 2.6);
  }
}
