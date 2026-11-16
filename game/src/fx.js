// Sable Station — rendering for the fighters and effects: low-poly trooper
// figures in team colours, the first-person weapon, tracers, impacts,
// grenade spheres, explosion flashes and the planted core charge.

import { PALETTE, TEAMS, WEAPONS } from './config.js';
import { rayDistance } from './physics.js';
import { currentWeapon } from './state.js';
import { eyeHeight } from './weapons.js';

function trooper(THREE, team) {
  const accentHex = TEAMS[team].color;
  const suitHex = team === 'atk' ? 0x7a4326 : 0x274b66;
  const group = new THREE.Group();
  const suit = new THREE.MeshLambertMaterial({ color: suitHex });
  const accent = new THREE.MeshLambertMaterial({ color: accentHex });
  const dark = new THREE.MeshLambertMaterial({ color: 0x232a30 });

  const legs = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.75, 0.26), dark);
  legs.position.y = 0.375;
  group.add(legs);
  const torso = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.68, 0.3), suit);
  torso.position.y = 1.09;
  group.add(torso);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.32), accent);
  stripe.position.y = 1.22;
  group.add(stripe);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.3), suit);
  head.position.y = 1.58;
  group.add(head);
  const visor = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.09, 0.05), new THREE.MeshBasicMaterial({ color: accentHex }));
  visor.position.set(0, 1.6, 0.16);
  group.add(visor);
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.12, 0.62), dark);
  gun.position.set(0.18, 1.18, 0.3);
  group.add(gun);
  const pack = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.5, 0.14), accent);
  pack.position.set(0, 1.12, -0.23);
  pack.visible = false;
  group.add(pack);
  group.userData = { gun, pack, torso, suit };
  return group;
}

function viewWeapon(THREE, weaponId) {
  const group = new THREE.Group();
  const dark = new THREE.MeshLambertMaterial({ color: 0x4a5866 });
  const accent = new THREE.MeshLambertMaterial({ color: 0x9fb2c4 });
  const bodyLen = weaponId === 'aurora' ? 0.78 : weaponId === 'pick' ? 0.3 : 0.52;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.11, bodyLen), dark);
  group.add(body);
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.074, 0.03, bodyLen * 0.7), accent);
  stripe.position.set(0, 0.045, 0.02);
  group.add(stripe);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.22, 6), accent);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 0.02, -bodyLen / 2 - 0.1);
  group.add(barrel);
  if (weaponId === 'aurora') {
    const scope = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.16, 8), dark);
    scope.rotation.x = Math.PI / 2;
    scope.position.set(0, 0.09, -0.05);
    group.add(scope);
  }
  if (weaponId === 'pick') {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.05, 0.3), accent);
    blade.position.set(0, 0.03, -0.28);
    group.add(blade);
  }
  group.position.set(0.3, -0.28, -0.62);
  group.rotation.y = -0.05;
  group.scale.setScalar(0.5);
  return group;
}

export function createFx(THREE, scene, camera) {
  const fighters = new Map();
  const tracers = [];
  const flashes = [];
  const boomsFx = [];
  const nadeMeshes = new Map();

  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.85 });
  const puffGeo = new THREE.SphereGeometry(0.16, 8, 8);

  const chargeMesh = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.3, 0.44),
    new THREE.MeshLambertMaterial({ color: 0x30363c, emissive: 0xff4444 }),
  );
  chargeMesh.visible = false;
  scene.add(chargeMesh);

  const viewGroup = new THREE.Group();
  camera.add(viewGroup);
  let viewModel = null;
  let viewWeaponId = '';

  function syncFighter(f, t) {
    let mesh = fighters.get(f.id);
    if (!mesh) {
      mesh = trooper(THREE, f.team);
      fighters.set(f.id, mesh);
      scene.add(mesh);
    }
    mesh.visible = !f.isPlayer;
    if (f.isPlayer) return;
    mesh.position.set(f.x, f.crouch ? -0.35 : 0, f.z);
    mesh.rotation.y = Math.atan2(Math.sin(f.yaw), Math.cos(f.yaw));
    mesh.rotation.z = f.alive ? 0 : Math.PI / 2.2;
    mesh.position.y = f.alive ? (f.crouch ? -0.35 : 0) : 0.22;
    mesh.userData.pack.visible = f.hasCharge;
    const hurt = f.hurtT > 0;
    mesh.userData.suit.emissive?.setHex(hurt ? 0x661111 : 0x000000);
  }

  function spawnTracer(ev, state) {
    const shooter = state.fighters.find((f) => f.id === ev.id);
    if (!shooter || ev.weapon === 'pick') return;
    const w = WEAPONS[ev.weapon];
    const dx = Math.sin(shooter.yaw);
    const dz = Math.cos(shooter.yaw);
    const dist = rayDistance(shooter.x, shooter.z, dx, dz, eyeHeight(shooter), w.range);
    const y = eyeHeight(shooter) - 0.08;
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(shooter.x + dx * 0.6, y, shooter.z + dz * 0.6),
      new THREE.Vector3(shooter.x + dx * dist, y + Math.tan(shooter.pitch) * dist, shooter.z + dz * dist),
    ]);
    const line = new THREE.Line(geo, tracerMat);
    scene.add(line);
    tracers.push({ line, t: 0.09 });
    if (shooter.isPlayer) {
      const flash = new THREE.PointLight(0xffc873, 6, 7);
      flash.position.set(shooter.x + dx, 1.5, shooter.z + dz);
      scene.add(flash);
      flashes.push({ light: flash, t: 0.05 });
    }
  }

  return {
    update(state, dt, t) {
      for (const f of state.fighters) syncFighter(f, t);

      // First-person weapon follows the player's current slot.
      const player = state.fighters.find((f) => f.isPlayer);
      if (player) {
        const wid = currentWeapon(player).id;
        if (wid !== viewWeaponId) {
          if (viewModel) viewGroup.remove(viewModel);
          viewModel = viewWeapon(THREE, wid);
          viewGroup.add(viewModel);
          viewWeaponId = wid;
        }
        if (viewModel) {
          const bob = player.moving && player.alive ? Math.sin(t * 9) * 0.012 : 0;
          viewModel.position.y = -0.28 + bob;
          viewModel.visible = player.alive;
        }
      }

      for (const ev of state.events) {
        if (ev.type === 'shot') spawnTracer(ev, state);
        if (ev.type === 'impact') {
          const puff = new THREE.Mesh(puffGeo, new THREE.MeshBasicMaterial({ color: 0xdfe9f2, transparent: true, opacity: 0.7 }));
          puff.position.set(ev.x, 1.2, ev.z);
          scene.add(puff);
          boomsFx.push({ mesh: puff, t: 0.25, grow: 1.5, fade: true });
        }
        if (ev.type === 'boom' || ev.type === 'detonate') {
          const big = ev.type === 'detonate';
          const mesh = new THREE.Mesh(
            new THREE.SphereGeometry(big ? 1.2 : 0.5, 12, 12),
            new THREE.MeshBasicMaterial({
              color: ev.kind === 'flare' ? 0xffffff : 0xffa03c,
              transparent: true, opacity: 0.9,
            }),
          );
          mesh.position.set(ev.x, 1, ev.z);
          scene.add(mesh);
          boomsFx.push({ mesh, t: big ? 0.8 : 0.4, grow: big ? 16 : 8, fade: true });
          const light = new THREE.PointLight(ev.kind === 'flare' ? 0xffffff : 0xff9040, big ? 60 : 20, big ? 40 : 16);
          light.position.set(ev.x, 1.6, ev.z);
          scene.add(light);
          flashes.push({ light, t: big ? 0.5 : 0.25 });
        }
      }

      // Grenades in flight.
      const booms = state.booms ?? [];
      const seenIds = new Set();
      booms.forEach((b, i) => {
        seenIds.add(i);
        let mesh = nadeMeshes.get(i);
        if (!mesh) {
          mesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.09, 8, 8),
            new THREE.MeshLambertMaterial({ color: b.kind === 'frag' ? 0xb8502e : 0xf2e38a }),
          );
          nadeMeshes.set(i, mesh);
          scene.add(mesh);
        }
        mesh.position.set(b.x, b.y, b.z);
      });
      for (const [i, mesh] of nadeMeshes) {
        if (!seenIds.has(i)) {
          scene.remove(mesh);
          nadeMeshes.delete(i);
        }
      }

      // The planted charge blinks on the ground.
      if (state.charge.state === 'planted') {
        chargeMesh.visible = true;
        chargeMesh.position.set(state.charge.x, 0.16, state.charge.z);
        chargeMesh.material.emissive.setHex(Math.sin(t * 10) > 0 ? 0xff2222 : 0x441111);
      } else if (state.charge.state === 'dropped') {
        chargeMesh.visible = true;
        chargeMesh.position.set(state.charge.x, 0.16, state.charge.z);
        chargeMesh.material.emissive.setHex(0xcc8822);
      } else {
        chargeMesh.visible = false;
      }

      for (let i = tracers.length - 1; i >= 0; i--) {
        tracers[i].t -= dt;
        if (tracers[i].t <= 0) {
          scene.remove(tracers[i].line);
          tracers.splice(i, 1);
        }
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        flashes[i].t -= dt;
        if (flashes[i].t <= 0) {
          scene.remove(flashes[i].light);
          flashes.splice(i, 1);
        }
      }
      for (let i = boomsFx.length - 1; i >= 0; i--) {
        const fx = boomsFx[i];
        fx.t -= dt;
        fx.mesh.scale.multiplyScalar(1 + fx.grow * dt);
        if (fx.fade) fx.mesh.material.opacity = Math.max(0, fx.t * 2);
        if (fx.t <= 0) {
          scene.remove(fx.mesh);
          boomsFx.splice(i, 1);
        }
      }
    },
  };
}
