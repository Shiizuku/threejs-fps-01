// Sable Station — the map: collision geometry, bomb sites, spawns, the bot
// waypoint graph, and the three.js world built from that same data.
// Coordinates are metres on the ground plane, x east, z south, origin at the
// station yard's centre. Boxes are axis-aligned; circles are cylinders.

import { PALETTE } from './config.js';

export const BOUNDS = 52;

// h is the height in metres: movement is blocked by everything, sight and
// bullets are blocked only when the collider reaches above crouch height.
export const BOXES = [
  // Perimeter ridge walls
  { x1: -53, z1: -53, x2: 53, z2: -52, h: 4, kind: 'ridge' },
  { x1: -53, z1: 52, x2: 53, z2: 53, h: 4, kind: 'ridge' },
  { x1: -53, z1: -52, x2: -52, z2: 52, h: 4, kind: 'ridge' },
  { x1: 52, z1: -52, x2: 53, z2: 52, h: 4, kind: 'ridge' },

  // Reactor Hall (site A): x -48..-22, z -34..-6
  { x1: -48.6, z1: -34, x2: -48, z2: -6, h: 4.2, kind: 'wall' },
  { x1: -48, z1: -34.6, x2: -22, z2: -34, h: 4.2, kind: 'wall' },
  { x1: -22, z1: -34, x2: -21.4, z2: -27, h: 4.2, kind: 'wall' },
  { x1: -22, z1: -25, x2: -21.4, z2: -13, h: 4.2, kind: 'wall' },
  { x1: -22, z1: -11, x2: -21.4, z2: -6, h: 4.2, kind: 'wall' },
  { x1: -48, z1: -6, x2: -31, z2: -5.4, h: 4.2, kind: 'wall' },
  { x1: -29, z1: -6, x2: -22, z2: -5.4, h: 4.2, kind: 'wall' },
  // Hall interior crates
  { x1: -45, z1: -29, x2: -43, z2: -27, h: 1.2, kind: 'crate' },
  { x1: -27, z1: -29, x2: -25, z2: -27, h: 2.3, kind: 'crate' },
  { x1: -45, z1: -13, x2: -43, z2: -11, h: 2.3, kind: 'crate' },
  { x1: -28, z1: -16, x2: -26, z2: -14, h: 1.2, kind: 'crate' },

  // Glasshouse (mid): x -6..4, z -30..18
  { x1: -6.4, z1: -30, x2: -6, z2: -20, h: 3, kind: 'glass' },
  { x1: -6.4, z1: -18, x2: -6, z2: -2, h: 3, kind: 'glass' },
  { x1: -6.4, z1: 0, x2: -6, z2: 6, h: 3, kind: 'glass' },
  { x1: -6.4, z1: 8, x2: -6, z2: 18, h: 3, kind: 'glass' },
  { x1: 4, z1: -30, x2: 4.4, z2: -8, h: 3, kind: 'glass' },
  { x1: 4, z1: -6, x2: 4.4, z2: -1, h: 3, kind: 'glass' },
  { x1: 4, z1: 1, x2: 4.4, z2: 12, h: 3, kind: 'glass' },
  { x1: 4, z1: 14, x2: 4.4, z2: 18, h: 3, kind: 'glass' },
  { x1: -6, z1: -30.4, x2: 4, z2: -30, h: 3, kind: 'glass' },
  { x1: -6, z1: 18, x2: -2, z2: 18.4, h: 3, kind: 'glass' },
  { x1: 0, z1: 18, x2: 4, z2: 18.4, h: 3, kind: 'glass' },
  // Planters inside (low cover)
  { x1: -4.4, z1: -24, x2: -2.4, z2: -12, h: 1.0, kind: 'planter' },
  { x1: 0.4, z1: -24, x2: 2.4, z2: -12, h: 1.0, kind: 'planter' },
  { x1: -4.4, z1: -4, x2: -2.4, z2: 8, h: 1.0, kind: 'planter' },
  { x1: 0.4, z1: -4, x2: 2.4, z2: 8, h: 1.0, kind: 'planter' },

  // Comms hut (site B): x 38..48, z -16..-8
  { x1: 38, z1: -16.3, x2: 48, z2: -16, h: 3, kind: 'wall' },
  { x1: 38, z1: -8, x2: 48, z2: -7.7, h: 3, kind: 'wall' },
  { x1: 47.7, z1: -16, x2: 48, z2: -8, h: 3, kind: 'wall' },
  { x1: 37.7, z1: -16, x2: 38, z2: -13, h: 3, kind: 'wall' },
  { x1: 37.7, z1: -11, x2: 38, z2: -8, h: 3, kind: 'wall' },
  { x1: 44, z1: -14, x2: 46, z2: -12, h: 1.2, kind: 'crate' },

  // North cabins
  { x1: -30, z1: -46.3, x2: -18, z2: -46, h: 3, kind: 'wall' },
  { x1: -30.3, z1: -46, x2: -30, z2: -38, h: 3, kind: 'wall' },
  { x1: -18, z1: -46, x2: -17.7, z2: -38, h: 3, kind: 'wall' },
  { x1: -30, z1: -38, x2: -25, z2: -37.7, h: 3, kind: 'wall' },
  { x1: -23, z1: -38, x2: -18, z2: -37.7, h: 3, kind: 'wall' },
  { x1: 6, z1: -46.3, x2: 18, z2: -46, h: 3, kind: 'wall' },
  { x1: 5.7, z1: -46, x2: 6, z2: -38, h: 3, kind: 'wall' },
  { x1: 18, z1: -46, x2: 18.3, z2: -38, h: 3, kind: 'wall' },
  { x1: 6, z1: -38, x2: 11, z2: -37.7, h: 3, kind: 'wall' },
  { x1: 13, z1: -38, x2: 18, z2: -37.7, h: 3, kind: 'wall' },

  // Snowcat vehicle by the landing pad
  { x1: -30, z1: 32, x2: -24, z2: 36, h: 2.2, kind: 'metal' },
  // Pipe run, north mid
  { x1: -20, z1: -39, x2: -8, z2: -38, h: 0.9, kind: 'pipe' },

  // Snowbanks (low cover)
  { x1: -18, z1: 29, x2: -10, z2: 31, h: 1.05, kind: 'snow' },
  { x1: 12, z1: 21, x2: 20, z2: 23, h: 1.05, kind: 'snow' },
  { x1: -7, z1: -41, x2: 3, z2: -39, h: 1.05, kind: 'snow' },
  { x1: 13, z1: -28, x2: 15, z2: -20, h: 1.05, kind: 'snow' },
  { x1: -17, z1: 4, x2: -15, z2: 12, h: 1.05, kind: 'snow' },
  { x1: 20, z1: 17, x2: 28, z2: 19, h: 1.05, kind: 'snow' },

  // Crate clusters on the lanes
  { x1: -15, z1: -3, x2: -13, z2: -1, h: 1.2, kind: 'crate' },
  { x1: -19, z1: -21, x2: -17, z2: -19, h: 2.3, kind: 'crate' },
  { x1: 13, z1: -1, x2: 15, z2: 1, h: 1.2, kind: 'crate' },
  { x1: -1, z1: 25, x2: 1, z2: 27, h: 2.3, kind: 'crate' },
  { x1: 29, z1: 33, x2: 31, z2: 35, h: 1.2, kind: 'crate' },
  { x1: 33, z1: 29, x2: 35, z2: 31, h: 2.3, kind: 'crate' },
  { x1: -41, z1: 19, x2: -39, z2: 21, h: 1.2, kind: 'crate' },
  { x1: 19, z1: -35, x2: 21, z2: -33, h: 1.2, kind: 'crate' },
];

export const CIRCLES = [
  { x: -35, z: -20, r: 3.4, h: 5, kind: 'reactor' },
  { x: 30, z: -6, r: 2.6, h: 3, kind: 'dish' },
  { x: 40, z: 4, r: 2.6, h: 3, kind: 'dish' },
  { x: 28, z: 10, r: 2.6, h: 3, kind: 'dish' },
  { x: 24, z: -12, r: 1.8, h: 2.6, kind: 'tank' },
  { x: 44, z: -2, r: 1.8, h: 2.6, kind: 'tank' },
  { x: 28, z: 38, r: 1.8, h: 2.6, kind: 'tank' },
  { x: 36, z: 36, r: 1.8, h: 2.6, kind: 'tank' },
];

export const SITES = {
  A: { id: 'A', name: 'Reactor Hall', x: -37, z: -19, r: 8.5 },
  B: { id: 'B', name: 'Array Yard', x: 34, z: 0, r: 9 },
};

export const SPAWNS = {
  atk: [
    { x: -38, z: 42 }, { x: -34, z: 44 }, { x: -30, z: 42 },
    { x: -26, z: 44 }, { x: -40, z: 36 },
  ],
  def: [
    { x: 40, z: -34 }, { x: 44, z: -30 }, { x: 36, z: -30 },
    { x: 42, z: -38 }, { x: 32, z: -36 },
  ],
};

// Waypoint graph for the bots. Every node stands on open ground; every edge
// is a straight walk that no wall crosses (doors line up with the gaps in
// the wall segments above).
export const NODES = [
  [-34, 40], [-40, 24], [-40, 4], [-30, -3], [-30, -10], [-43, -24],
  [-38, -16], [-40, -30], [-19, -26], [-25, -26], [-19, -12], [-25, -12],
  [-14, -2], [-1, 22], [-1, 12], [-1, 0], [-1, -16], [-12, -24],
  [8, -7], [0, -38], [-24, -35], [-34, -40], [12, -35], [24, -30],
  [38, -33], [30, -20], [27, -10], [34, 2], [26, 16], [14, 4],
  [8, 28], [32, 32], [-16, 36], [35, -12], [43, -12], [-9, -1],
  [8, 0], [8, 13], [-1, -7],
];

export const EDGES = [
  [0, 1], [0, 32], [1, 2], [1, 32], [2, 3], [2, 12], [3, 4], [3, 12],
  [4, 6], [4, 11], [6, 5], [6, 7], [5, 7], [7, 9], [9, 8], [8, 10],
  [8, 19], [10, 11], [10, 12], [12, 35], [35, 15], [13, 14], [14, 15],
  [15, 16], [15, 36], [16, 17], [16, 38], [38, 18], [17, 19], [19, 20],
  [19, 22], [20, 21], [22, 23], [23, 24], [24, 25], [25, 26], [25, 33],
  [26, 33], [27, 28], [27, 33], [28, 29], [28, 37], [29, 30],
  [29, 36], [30, 31], [30, 13], [31, 0], [33, 34], [37, 14],
];

// Defender hold spots per site, as node indices with a facing direction.
export const HOLD_SPOTS = {
  A: [
    { node: 5, yaw: 2.4 }, { node: 11, yaw: -1.2 },
    { node: 9, yaw: 0.6 }, { node: 6, yaw: 3.1 },
  ],
  B: [
    { node: 34, yaw: -1.6 }, { node: 28, yaw: 2.8 },
    { node: 26, yaw: -2.6 }, { node: 27, yaw: 0.2 },
  ],
  mid: [
    { node: 15, yaw: 1.5 }, { node: 36, yaw: -0.4 },
  ],
};

export function nearestNode(x, z) {
  let best = 0;
  let bestD = Infinity;
  for (let i = 0; i < NODES.length; i++) {
    const dx = NODES[i][0] - x;
    const dz = NODES[i][1] - z;
    const d = dx * dx + dz * dz;
    if (d < bestD) { bestD = d; best = i; }
  }
  return best;
}

export function pathBetween(from, to) {
  if (from === to) return [from];
  const prev = new Map([[from, -1]]);
  const queue = [from];
  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur === to) break;
    for (const [a, b] of EDGES) {
      const nxt = a === cur ? b : b === cur ? a : -1;
      if (nxt >= 0 && !prev.has(nxt)) {
        prev.set(nxt, cur);
        queue.push(nxt);
      }
    }
  }
  if (!prev.has(to)) return [from];
  const path = [];
  let cur = to;
  while (cur !== -1) { path.push(cur); cur = prev.get(cur); }
  return path.reverse();
}

// ---------------------------------------------------------------------------
// World building (browser only; the headless sim never calls this).

function boxMesh(THREE, mat, b) {
  const w = b.x2 - b.x1;
  const d = b.z2 - b.z1;
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, b.h, d), mat);
  mesh.position.set(b.x1 + w / 2, b.h / 2, b.z1 + d / 2);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  return mesh;
}

export function buildWorld(THREE, scene) {
  const mats = {
    wall: new THREE.MeshLambertMaterial({ color: PALETTE.wallPanel }),
    ridge: new THREE.MeshLambertMaterial({ color: PALETTE.snowShadow }),
    glass: new THREE.MeshLambertMaterial({ color: PALETTE.glass, transparent: true, opacity: 0.45 }),
    crate: new THREE.MeshLambertMaterial({ color: PALETTE.crate }),
    snow: new THREE.MeshLambertMaterial({ color: PALETTE.snow }),
    metal: new THREE.MeshLambertMaterial({ color: PALETTE.wallDark }),
    pipe: new THREE.MeshLambertMaterial({ color: PALETTE.pipe }),
    planter: new THREE.MeshLambertMaterial({ color: 0x3f6b4f }),
  };

  // Snowfield
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(140, 140),
    new THREE.MeshLambertMaterial({ color: PALETTE.snow }),
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Landing pad under the Jackal spawn
  const pad = new THREE.Mesh(
    new THREE.PlaneGeometry(22, 14),
    new THREE.MeshLambertMaterial({ color: 0x5a6672 }),
  );
  pad.rotation.x = -Math.PI / 2;
  pad.position.set(-33, 0.02, 40);
  scene.add(pad);

  for (const b of BOXES) scene.add(boxMesh(THREE, mats[b.kind] ?? mats.wall, b));

  // Roofs over the hall, glasshouse and cabins so interiors read as interiors
  const roofMat = new THREE.MeshLambertMaterial({ color: PALETTE.roof });
  const roofs = [
    { x: -35, z: -20, w: 27.2, d: 29.2, y: 4.2 },
    { x: -1, z: -6, w: 11.2, d: 49.2, y: 3 },
    { x: 43, z: -12, w: 10.6, d: 8.9, y: 3 },
    { x: -24, z: -42, w: 13.2, d: 9.2, y: 3 },
    { x: 12, z: -42, w: 13.2, d: 9.2, y: 3 },
  ];
  for (const r of roofs) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(r.w, 0.25, r.d), roofMat);
    mesh.position.set(r.x, r.y, r.z);
    scene.add(mesh);
  }

  const animated = [];

  for (const c of CIRCLES) {
    if (c.kind === 'reactor') {
      const body = new THREE.Mesh(
        new THREE.CylinderGeometry(c.r, c.r, c.h, 24),
        new THREE.MeshLambertMaterial({ color: 0x5c6f7d }),
      );
      body.position.set(c.x, c.h / 2, c.z);
      scene.add(body);
      const ringMat = new THREE.MeshBasicMaterial({ color: PALETTE.reactor });
      for (const y of [1.4, 2.8, 4.2]) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(c.r + 0.08, 0.09, 8, 32), ringMat);
        ring.rotation.x = Math.PI / 2;
        ring.position.set(c.x, y, c.z);
        scene.add(ring);
      }
      animated.push((t) => { ringMat.color.setHSL(0.45, 0.85, 0.55 + 0.12 * Math.sin(t * 2)); });
    } else if (c.kind === 'dish') {
      const pole = new THREE.Mesh(
        new THREE.CylinderGeometry(0.22, 0.3, 2.2, 8),
        new THREE.MeshLambertMaterial({ color: PALETTE.wallDark }),
      );
      pole.position.set(c.x, 1.1, c.z);
      scene.add(pole);
      const dish = new THREE.Mesh(
        new THREE.SphereGeometry(c.r, 18, 10, 0, Math.PI * 2, 0, Math.PI / 3.2),
        new THREE.MeshLambertMaterial({ color: PALETTE.dish, side: THREE.DoubleSide }),
      );
      dish.position.set(c.x, 2.6, c.z);
      dish.rotation.x = Math.PI / 2.6;
      scene.add(dish);
    } else {
      const tank = new THREE.Mesh(
        new THREE.CylinderGeometry(c.r, c.r, c.h, 16),
        new THREE.MeshLambertMaterial({ color: 0xd8b25a }),
      );
      tank.position.set(c.x, c.h / 2, c.z);
      scene.add(tank);
    }
  }

  // Lamp posts along the lanes: emissive heads, no real light cost
  const lampMat = new THREE.MeshBasicMaterial({ color: PALETTE.lampWarm });
  const poleMat = new THREE.MeshLambertMaterial({ color: PALETTE.wallDark });
  const lampSpots = [[-14, 24], [10, -18], [-20, -34], [20, 8], [0, 34], [-44, 8], [30, -28]];
  for (const [x, z] of lampSpots) {
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 3.4, 6), poleMat);
    pole.position.set(x, 1.7, z);
    scene.add(pole);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 8), lampMat);
    head.position.set(x, 3.45, z);
    scene.add(head);
  }

  // Aurora: two large translucent ribbons high over the station
  const auroraMatA = new THREE.MeshBasicMaterial({
    color: PALETTE.auroraA, transparent: true, opacity: 0.16,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const auroraMatB = new THREE.MeshBasicMaterial({
    color: PALETTE.auroraB, transparent: true, opacity: 0.1,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const ribbonA = new THREE.Mesh(new THREE.PlaneGeometry(190, 16, 48, 1), auroraMatA);
  ribbonA.position.set(0, 46, -30);
  ribbonA.rotation.x = 0.5;
  scene.add(ribbonA);
  const ribbonB = new THREE.Mesh(new THREE.PlaneGeometry(190, 10, 48, 1), auroraMatB);
  ribbonB.position.set(0, 52, 6);
  ribbonB.rotation.x = 0.5;
  scene.add(ribbonB);
  const wave = (mesh, amp, speed) => (t) => {
    const pos = mesh.geometry.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      pos.setY(i, Math.sin(pos.getX(i) * 0.08 + t * speed) * amp);
    }
    pos.needsUpdate = true;
  };
  animated.push(wave(ribbonA, 2.2, 0.7));
  animated.push(wave(ribbonB, 1.6, 0.5));

  // Falling snow
  const snowCount = 900;
  const snowPos = new Float32Array(snowCount * 3);
  for (let i = 0; i < snowCount; i++) {
    snowPos[i * 3] = (Math.random() - 0.5) * 130;
    snowPos[i * 3 + 1] = Math.random() * 30;
    snowPos[i * 3 + 2] = (Math.random() - 0.5) * 130;
  }
  const snowGeo = new THREE.BufferGeometry();
  snowGeo.setAttribute('position', new THREE.BufferAttribute(snowPos, 3));
  const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({
    color: 0xffffff, size: 0.14, transparent: true, opacity: 0.8,
  }));
  scene.add(snow);
  animated.push((t, dt) => {
    const pos = snowGeo.attributes.position;
    for (let i = 0; i < snowCount; i++) {
      let y = pos.getY(i) - dt * 1.6;
      if (y < 0) y = 30;
      pos.setY(i, y);
      pos.setX(i, pos.getX(i) + Math.sin(t * 0.8 + i) * dt * 0.4);
    }
    pos.needsUpdate = true;
  });

  // Site markers painted on the ground
  for (const site of [SITES.A, SITES.B]) {
    const ring = new THREE.Mesh(
      new THREE.RingGeometry(site.r - 0.4, site.r, 40),
      new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
    );
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(site.x, 0.04, site.z);
    scene.add(ring);
  }

  return {
    update(t, dt) {
      for (const fn of animated) fn(t, dt);
    },
  };
}
