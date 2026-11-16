// Sable Station — physics: circle-vs-world movement collision, line of
// sight, and hitscan rays, all against the map's boxes and cylinders.

import { BOXES, CIRCLES, BOUNDS } from './map.js';

const SIGHT_BLOCK_H = 1.35; // colliders at least this tall hide a standing bot

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

/** Push a circle (x, z, radius) out of every collider; returns corrected [x, z]. */
export function collide(x, z, radius) {
  x = clamp(x, -BOUNDS + radius, BOUNDS - radius);
  z = clamp(z, -BOUNDS + radius, BOUNDS - radius);
  for (const b of BOXES) {
    const nx = clamp(x, b.x1, b.x2);
    const nz = clamp(z, b.z1, b.z2);
    const dx = x - nx;
    const dz = z - nz;
    const d2 = dx * dx + dz * dz;
    if (d2 > radius * radius) continue;
    if (d2 > 1e-9) {
      const d = Math.sqrt(d2);
      x = nx + (dx / d) * radius;
      z = nz + (dz / d) * radius;
    } else {
      // Centre inside the box: leave through the nearest face.
      const left = x - b.x1;
      const right = b.x2 - x;
      const top = z - b.z1;
      const bottom = b.z2 - z;
      const m = Math.min(left, right, top, bottom);
      if (m === left) x = b.x1 - radius;
      else if (m === right) x = b.x2 + radius;
      else if (m === top) z = b.z1 - radius;
      else z = b.z2 + radius;
    }
  }
  for (const c of CIRCLES) {
    const dx = x - c.x;
    const dz = z - c.z;
    const rr = c.r + radius;
    const d2 = dx * dx + dz * dz;
    if (d2 >= rr * rr) continue;
    const d = Math.sqrt(d2) || 0.001;
    x = c.x + (dx / d) * rr;
    z = c.z + (dz / d) * rr;
  }
  return [x, z];
}

function segmentHitsBox(x1, z1, x2, z2, b) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  let t0 = 0;
  let t1 = 1;
  if (Math.abs(dx) < 1e-9) {
    if (x1 < b.x1 || x1 > b.x2) return false;
  } else {
    let ta = (b.x1 - x1) / dx;
    let tb = (b.x2 - x1) / dx;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  if (Math.abs(dz) < 1e-9) {
    if (z1 < b.z1 || z1 > b.z2) return false;
  } else {
    let ta = (b.z1 - z1) / dz;
    let tb = (b.z2 - z1) / dz;
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return false;
  }
  return true;
}

function segmentHitsCircle(x1, z1, x2, z2, c) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const len2 = dx * dx + dz * dz || 1e-9;
  let t = ((c.x - x1) * dx + (c.z - z1) * dz) / len2;
  t = clamp(t, 0, 1);
  const px = x1 + dx * t - c.x;
  const pz = z1 + dz * t - c.z;
  return px * px + pz * pz < c.r * c.r;
}

/** True when a standing target at (x2, z2) is hidden from (x1, z1). */
export function losBlocked(x1, z1, x2, z2) {
  for (const b of BOXES) {
    if (b.h >= SIGHT_BLOCK_H && segmentHitsBox(x1, z1, x2, z2, b)) return true;
  }
  for (const c of CIRCLES) {
    if (c.h >= SIGHT_BLOCK_H && segmentHitsCircle(x1, z1, x2, z2, c)) return true;
  }
  return false;
}

/**
 * Distance along the ray (from (x, z) in direction (dx, dz), both ground
 * plane) to the first collider tall enough to stop a bullet flying at
 * `height`, or Infinity. Used to cap hitscan range and place impact puffs.
 */
export function rayDistance(x, z, dx, dz, height, maxDist) {
  let best = maxDist;
  const hit = (t) => { if (t > 0 && t < best) best = t; };
  for (const b of BOXES) {
    if (b.h < height) continue;
    // Slab test for the entry distance.
    let tmin = 0;
    let tmax = best;
    if (Math.abs(dx) < 1e-9) {
      if (x < b.x1 || x > b.x2) continue;
    } else {
      let ta = (b.x1 - x) / dx;
      let tb = (b.x2 - x) / dx;
      if (ta > tb) [ta, tb] = [tb, ta];
      tmin = Math.max(tmin, ta);
      tmax = Math.min(tmax, tb);
      if (tmin > tmax) continue;
    }
    if (Math.abs(dz) < 1e-9) {
      if (z < b.z1 || z > b.z2) continue;
    } else {
      let ta = (b.z1 - z) / dz;
      let tb = (b.z2 - z) / dz;
      if (ta > tb) [ta, tb] = [tb, ta];
      tmin = Math.max(tmin, ta);
      tmax = Math.min(tmax, tb);
      if (tmin > tmax) continue;
    }
    hit(tmin);
  }
  for (const c of CIRCLES) {
    if (c.h < height) continue;
    const ox = x - c.x;
    const oz = z - c.z;
    const bq = ox * dx + oz * dz;
    const cq = ox * ox + oz * oz - c.r * c.r;
    const disc = bq * bq - cq;
    if (disc < 0) continue;
    hit(-bq - Math.sqrt(disc));
  }
  return best;
}
