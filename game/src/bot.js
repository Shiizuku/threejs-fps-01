// Sable Station — the bot brain: round plans, waypoint navigation,
// perception (vision cone, line of sight, hearing gunfire), reaction
// delays, burst discipline, strafing, planting and defusing.

import { BOT, MATCH, PLAYER } from './config.js';
import { HOLD_SPOTS, NODES, SITES, nearestNode, pathBetween } from './map.js';
import { collide, losBlocked } from './physics.js';
import { currentWeapon, teamAlive } from './state.js';
import { eyeHeight, targetHeight, throwGrenade, tryFire } from './weapons.js';

export function makeBrain(rng) {
  return {
    goalNode: -1,
    path: [],
    pathI: 0,
    targetId: 0,
    lastKnown: null,
    lastKnownT: -99,
    reactT: 0,
    burstLeft: 0,
    pauseT: 0,
    strafeDir: 1,
    strafeT: 0,
    stuckT: 0,
    lastX: 0,
    lastZ: 0,
    dodgeT: 0,
    dodgeDir: 1,
    role: 'advance',
    holdYaw: 0,
    nadeT: 2 + rng() * 4,
    rallyNode: -1,
    rallyDone: false,
  };
}

function faceYaw(x, z, tx, tz) {
  return Math.atan2(tx - x, tz - z);
}

/** Decide the team's plan at round start. Called once per round by sim. */
export function planRound(state, rng) {
  const site = rng() < 0.5 ? SITES.A : SITES.B;
  const atk = state.fighters.filter((f) => f.team === 'atk' && !f.isPlayer);
  const def = state.fighters.filter((f) => f.team === 'def');
  for (const f of atk) {
    f.brain ??= makeBrain(rng);
    f.brain.role = f.hasCharge ? 'planter' : rng() < 0.3 ? 'flank' : 'advance';
    f.brain.site = site.id;
    f.brain.rallyNode = nearestNode(...(site.id === 'A' ? [-19, -12] : [14, 4]));
    f.brain.rallyDone = false;
    setGoal(state, f, nearestNode(site.x, site.z), rng);
  }
  const playerCarrier = state.fighters.find((f) => f.isPlayer && f.hasCharge);
  if (playerCarrier) {
    // Bots escort the player's push: half to each site, weighted to A.
    for (const f of atk) {
      f.brain.site = rng() < 0.6 ? 'A' : 'B';
      f.brain.rallyNode = nearestNode(...(f.brain.site === 'A' ? [-19, -12] : [14, 4]));
      f.brain.rallyDone = false;
      setGoal(state, f, nearestNode(SITES[f.brain.site].x, SITES[f.brain.site].z), rng);
    }
  }
  // Interleaved so the five defenders split across both sites and mid.
  const spots = [
    HOLD_SPOTS.A[0], HOLD_SPOTS.B[0], HOLD_SPOTS.mid[0],
    HOLD_SPOTS.A[1], HOLD_SPOTS.B[1], HOLD_SPOTS.mid[1],
    HOLD_SPOTS.A[2], HOLD_SPOTS.B[2], HOLD_SPOTS.A[3], HOLD_SPOTS.B[3],
  ];
  def.forEach((f, i) => {
    f.brain ??= makeBrain(rng);
    const spot = spots[i % spots.length];
    f.brain.role = 'hold';
    f.brain.holdYaw = spot.yaw;
    f.brain.holdSite = i % spots.length < 10
      ? ['A', 'B', 'mid', 'A', 'B', 'mid', 'A', 'B', 'A', 'B'][i % spots.length]
      : 'mid';
    setGoal(state, f, spot.node, rng);
  });
}

export function setGoal(state, f, node, rng) {
  const brain = f.brain;
  if (brain.goalNode === node && brain.path.length > 0) return;
  brain.goalNode = node;
  const from = nearestNode(f.x, f.z);
  brain.path = pathBetween(from, node);
  brain.pathI = brain.path.length > 1 ? 1 : 0;
}

function perceive(state, f, dt) {
  const brain = f.brain;
  let seen = null;
  for (const e of state.fighters) {
    if (!e.alive || e.team === f.team) continue;
    const dx = e.x - f.x;
    const dz = e.z - f.z;
    const dist = Math.hypot(dx, dz);
    if (dist > BOT.visionRange) continue;
    const fx = Math.sin(f.yaw);
    const fz = Math.cos(f.yaw);
    const dot = (dx * fx + dz * fz) / (dist || 1);
    if (dist > 2.2 && dot < BOT.visionCos) continue;
    if (losBlocked(f.x, f.z, e.x, e.z)) continue;
    if (!seen || dist < seen.dist) seen = { enemy: e, dist };
  }
  if (seen) {
    if (brain.targetId !== seen.enemy.id) {
      brain.targetId = seen.enemy.id;
      brain.reactT = BOT.reactionMin + Math.random() * (BOT.reactionMax - BOT.reactionMin);
      // A defender already set on its hold spot is pre-aimed down the lane:
      // it reacts noticeably faster than someone caught while rotating.
      if (f.team === 'def' && brain.role === 'hold' && brain.pathI >= brain.path.length) {
        brain.reactT *= 0.55;
      }
    }
    brain.lastKnown = { x: seen.enemy.x, z: seen.enemy.z };
    brain.lastKnownT = state.time;
    // Defenders share sightings with the whole team.
    if (f.team === 'def') {
      state.teamIntel ??= {};
      state.teamIntel.def = { x: seen.enemy.x, z: seen.enemy.z, t: state.time };
    }
    return seen;
  }
  // Hearing: a recent enemy shot nearby becomes a place to investigate.
  // A teammate's death is team intel too — defenders rotate on it.
  for (const ev of state.events) {
    if (ev.type === 'kill' && f.team === 'def') {
      const victim = state.fighters.find((t) => t.id === ev.target);
      if (victim && victim.team === 'def') {
        state.teamIntel ??= {};
        state.teamIntel.def = { x: victim.x, z: victim.z, t: state.time };
      }
      continue;
    }
    if (ev.type !== 'shot') continue;
    const shooter = state.fighters.find((t) => t.id === ev.id);
    if (!shooter || shooter.team === f.team) continue;
    if (Math.hypot(ev.x - f.x, ev.z - f.z) < BOT.hearingRange) {
      brain.lastKnown = { x: ev.x, z: ev.z };
      brain.lastKnownT = state.time;
    }
  }
  if (state.time - brain.lastKnownT > 6) brain.targetId = 0;
  return null;
}

function moveAlong(state, f, dt, speed) {
  const brain = f.brain;
  if (brain.pathI >= brain.path.length) { f.moving = false; return true; }
  const [tx, tz] = NODES[brain.path[brain.pathI]];
  const dx = tx - f.x;
  const dz = tz - f.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.75) {
    brain.pathI++;
    return brain.pathI >= brain.path.length;
  }
  let mx = dx / dist;
  let mz = dz / dist;
  // Stuck recovery: sample displacement over a half-second window (a single
  // tick's movement is far below any sane threshold), then sidestep.
  brain.stuckT += dt;
  if (brain.stuckT >= 0.5) {
    const movedWindow = Math.hypot(f.x - brain.lastX, f.z - brain.lastZ);
    if (movedWindow < 0.35) {
      brain.dodgeT = 0.45;
      brain.dodgeDir = Math.random() < 0.5 ? -1 : 1;
    }
    brain.lastX = f.x;
    brain.lastZ = f.z;
    brain.stuckT = 0;
  }
  if (brain.dodgeT > 0) {
    brain.dodgeT -= dt;
    const px = -mz * brain.dodgeDir;
    const pz = mx * brain.dodgeDir;
    mx = mx * 0.4 + px;
    mz = mz * 0.4 + pz;
    const len = Math.hypot(mx, mz) || 1;
    mx /= len; mz /= len;
  }
  f.yaw = faceYaw(0, 0, mx, mz);
  const [nx, nz] = collide(f.x + mx * speed * dt, f.z + mz * speed * dt, PLAYER.radius);
  f.x = nx;
  f.z = nz;
  f.moving = true;
  return false;
}

/** Walk in a straight line toward a point (the last metres to a charge). */
function moveDirect(state, f, dt, tx, tz, speed) {
  const dx = tx - f.x;
  const dz = tz - f.z;
  const dist = Math.hypot(dx, dz);
  if (dist < 0.15) { f.moving = false; return dist; }
  f.yaw = faceYaw(0, 0, dx, dz);
  const [nx, nz] = collide(
    f.x + (dx / dist) * speed * dt,
    f.z + (dz / dist) * speed * dt,
    PLAYER.radius,
  );
  f.x = nx;
  f.z = nz;
  f.moving = true;
  return dist;
}

function engage(state, f, seen, dt, rng) {
  const brain = f.brain;
  const e = seen.enemy;
  const dist = seen.dist;
  f.yaw = faceYaw(f.x, f.z, e.x, e.z);
  const aimH = e.crouch ? 0.82 : 1.12;
  f.pitch = Math.atan2(aimH - eyeHeight(f), dist);
  brain.reactT -= dt;
  // Movement in a fight: attackers close the distance while firing so the
  // push arrives as a group; everyone strafes once the fight is close.
  f.moving = false;
  if (dist > 12) {
    moveAlong(state, f, dt, BOT.runSpeed);
    setGoal(state, f, nearestNode(e.x, e.z), rng);
  } else {
    brain.strafeT -= dt;
    if (brain.strafeT <= 0) {
      brain.strafeT = 0.7 + rng() * 0.8;
      brain.strafeDir = rng() < 0.5 ? -1 : 1;
    }
    const px = Math.cos(f.yaw) * brain.strafeDir;
    const pz = -Math.sin(f.yaw) * brain.strafeDir;
    const [nx, nz] = collide(f.x + px * BOT.walkSpeed * dt, f.z + pz * BOT.walkSpeed * dt, PLAYER.radius);
    f.x = nx;
    f.z = nz;
    f.moving = true;
    f.crouch = dist > 26 && currentWeapon(f).id === 'aurora';
  }
  if (brain.reactT > 0) return;
  // Hold fire at long range: close the distance first instead of plinking
  // across the map (which also stops the goal flip-flopping that long
  // sightings used to cause).
  if (dist > 30) return;
  // Burst discipline.
  if (brain.pauseT > 0) {
    brain.pauseT -= dt;
    return;
  }
  if (brain.burstLeft <= 0) {
    const w = currentWeapon(f);
    brain.burstLeft = w.auto ? 3 + Math.floor(rng() * 3) : 1;
  }
  // Accuracy gate: bots are good, not perfect.
  const jitter = (1 - BOT.accuracy) * 0.05;
  f.yaw += (rng() * 2 - 1) * jitter;
  if (tryFire(state, f, rng)) {
    brain.burstLeft--;
    if (brain.burstLeft <= 0) brain.pauseT = BOT.burstPause * (0.7 + rng() * 0.6);
  }
  // Occasionally lob a frag at a seen enemy in grenade range.
  brain.nadeT -= dt;
  if (brain.nadeT <= 0) {
    brain.nadeT = 3 + rng() * 4;
    if (dist > 6 && dist < 15 && f.nades.frag > 0 && rng() < 0.5) {
      throwGrenade(state, f, 'frag');
    }
  }
}

export function stepBot(state, f, dt, rng) {
  if (!f.alive) return;
  f.brain ??= makeBrain(rng);
  const brain = f.brain;
  if ((f.blindT ?? 0) > 0) {
    f.moving = false;
    return;
  }
  // Planted-charge duty comes before ordinary fighting for defenders:
  // walk straight to the charge and defuse it, unless an enemy is close
  // enough to be an immediate threat. (A guard visible through a doorway
  // 13 m away must not freeze the retake — that deadlock cost rounds.)
  if (state.phase === 'planted' && f.team === 'def') {
    const distCharge = Math.hypot(f.x - state.charge.x, f.z - state.charge.z);
    if (distCharge < 2.2) {
      f.moving = false;
      f.yaw = faceYaw(f.x, f.z, state.charge.x, state.charge.z);
      return;
    }
    let closeThreat = false;
    for (const e of state.fighters) {
      if (!e.alive || e.team === f.team) continue;
      if (Math.hypot(e.x - f.x, e.z - f.z) < 8 && !losBlocked(f.x, f.z, e.x, e.z)) {
        closeThreat = true;
        break;
      }
    }
    if (!closeThreat) {
      setGoal(state, f, nearestNode(state.charge.x, state.charge.z), rng);
      const arrived = moveAlong(state, f, dt, BOT.runSpeed);
      if (arrived) {
        const dist = moveDirect(state, f, dt, state.charge.x, state.charge.z, BOT.runSpeed);
        if (dist < 1.2) f.moving = false;
      }
      return;
    }
  }
  const seen = perceive(state, f, dt);
  if (seen) {
    engage(state, f, seen, dt, rng);
    return;
  }
  f.crouch = false;
  const phase = state.phase;

  // Pick up a dropped charge when passing it (attackers only).
  if (f.team === 'atk' && state.charge.state === 'dropped') {
    if (Math.hypot(f.x - state.charge.x, f.z - state.charge.z) < 1.1) {
      f.hasCharge = true;
      state.charge = { state: 'carried', carrier: f.id, site: null, x: 0, z: 0, t: 0 };
      state.events.push({ type: 'pickup', id: f.id });
      brain.role = 'planter';
      setGoal(state, f, nearestNode(SITES[brain.site ?? 'A'].x, SITES[brain.site ?? 'A'].z), rng);
    }
  }

  if (phase === 'planted' && state.charge.site) {
    // Defenders converge on the charge and walk the final metres right up
    // to it so the defuse channel can start. Attackers who are already in
    // the site area hold their ground and face outward, covering the
    // entrances instead of clustering on the charge itself.
    if (f.team === 'atk' && Math.hypot(f.x - state.charge.x, f.z - state.charge.z) < 14) {
      f.moving = false;
      f.yaw = Math.atan2(f.x - state.charge.x, f.z - state.charge.z);
      return;
    }
    setGoal(state, f, nearestNode(state.charge.x, state.charge.z), rng);
    const arrived = moveAlong(state, f, dt, BOT.runSpeed);
    if (arrived && f.team === 'def') {
      const dist = moveDirect(state, f, dt, state.charge.x, state.charge.z, BOT.runSpeed);
      if (dist < 1.2) f.moving = false;
    } else if (arrived) {
      f.yaw = Math.atan2(f.x - state.charge.x, f.z - state.charge.z);
      f.moving = false;
    }
    return;
  }

  if (phase === 'live' || phase === 'buy') {
    if (f.team === 'atk') {
      const site = SITES[brain.site ?? 'A'];
      // Rally before the push: wait near the site entrance until at least
      // three attackers have gathered (or the round is getting old), so
      // the team hits the site together instead of one by one.
      if (phase === 'live' && !brain.rallyDone && brain.rallyNode >= 0) {
        const [rx, rz] = NODES[brain.rallyNode];
        if (Math.hypot(f.x - rx, f.z - rz) > 2.5) {
          setGoal(state, f, brain.rallyNode, rng);
          moveAlong(state, f, dt, BOT.runSpeed);
          return;
        }
        const gathered = state.fighters.filter((ally) => ally.team === 'atk' && ally.alive
          && Math.hypot(ally.x - rx, ally.z - rz) < 10).length;
        const waited = MATCH.roundSeconds - state.phaseT > 25;
        if (gathered >= 3 || waited) {
          brain.rallyDone = true;
        } else {
          f.moving = false;
          f.yaw = faceYaw(f.x, f.z, site.x, site.z);
          return;
        }
      }
      const distToSite = Math.hypot(f.x - site.x, f.z - site.z);
      if (f.hasCharge) {
        const inZone = distToSite < site.r;
        if (inZone && phase === 'live') {
          f.moving = false; // sim channels the plant while the carrier stands in the zone
          return;
        }
        setGoal(state, f, nearestNode(site.x, site.z), rng);
      } else if (brain.lastKnown && state.time - brain.lastKnownT < 5
        && (distToSite > site.r + 4
          || Math.hypot(brain.lastKnown.x - site.x, brain.lastKnown.z - site.z) < site.r + 6)) {
        // Chase fresh contact, unless we are already guarding the site the
        // carrier is planting on — then only react to contact near it.
        setGoal(state, f, nearestNode(brain.lastKnown.x, brain.lastKnown.z), rng);
      } else {
        setGoal(state, f, nearestNode(site.x, site.z), rng);
      }
      moveAlong(state, f, dt, phase === 'buy' ? BOT.walkSpeed : BOT.runSpeed);
    } else {
      // Defenders: hold the assigned spot; investigate only nearby noise so
      // one firefight cannot pull the whole defence across the map. But
      // team intel — a sighting or a teammate's death at a site — rotates
      // everyone who is not already holding that site.
      const intel = state.teamIntel?.def;
      const intelSite = intel && state.time - intel.t < 6
        ? (Math.hypot(intel.x - SITES.A.x, intel.z - SITES.A.z) < 13 ? 'A'
          : Math.hypot(intel.x - SITES.B.x, intel.z - SITES.B.z) < 13 ? 'B' : null)
        : null;
      if (intelSite && brain.holdSite !== intelSite && phase === 'live') {
        setGoal(state, f, nearestNode(SITES[intelSite].x, SITES[intelSite].z), rng);
        moveAlong(state, f, dt, BOT.runSpeed);
        return;
      }
      const nearNoise = brain.lastKnown
        && Math.hypot(brain.lastKnown.x - f.x, brain.lastKnown.z - f.z) < 26;
      if (nearNoise && state.time - brain.lastKnownT < 4) {
        setGoal(state, f, nearestNode(brain.lastKnown.x, brain.lastKnown.z), rng);
        moveAlong(state, f, dt, BOT.runSpeed);
      } else {
        const arrived = moveAlong(state, f, dt, BOT.runSpeed);
        if (arrived) {
          f.yaw = brain.holdYaw;
          f.moving = false;
        }
      }
    }
    return;
  }
  f.moving = false;
}

export function aliveCount(state, team) {
  return teamAlive(state, team).length;
}
