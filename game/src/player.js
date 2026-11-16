// Sable Station — the human fighter: mouse look, WASD movement, firing,
// reloading, weapon slots and grenades, all writing into the same fighter
// record the bots use.

import { BOT, PLAYER } from './config.js';
import { collide } from './physics.js';
import { currentWeapon } from './state.js';
import { startReload, throwGrenade, tryFire } from './weapons.js';

const LOOK_SENS = 0.0023;

/**
 * pressed is the frame's one-shot key set (shared with the HUD). One-shot
 * actions delete their key after use so extra fixed steps in the same
 * frame cannot repeat them.
 */
export function makePlayerControl(input, pressed, rng) {
  return function playerControl(state, f, dt) {
    if (!f.alive) return;
    const mouse = input.takeMouse();
    f.yaw -= mouse.dx * LOOK_SENS;
    f.pitch -= mouse.dy * LOOK_SENS;
    f.pitch = Math.max(-1.35, Math.min(1.35, f.pitch));

    const keys = input.keys;

    if (pressed.has('Digit1')) { f.slot = 'primary'; pressed.delete('Digit1'); }
    if (pressed.has('Digit2')) { f.slot = 'sidearm'; pressed.delete('Digit2'); }
    if (pressed.has('Digit3')) { f.slot = 'melee'; pressed.delete('Digit3'); }
    if (pressed.has('KeyR')) { startReload(state, f); pressed.delete('KeyR'); }
    if (pressed.has('Digit4')) { throwGrenade(state, f, 'frag'); pressed.delete('Digit4'); }
    if (pressed.has('Digit5')) { throwGrenade(state, f, 'flare'); pressed.delete('Digit5'); }
    if (!f.weapons[f.slot]) f.slot = f.weapons.primary ? 'primary' : 'sidearm';

    f.crouch = keys.has('KeyC') || keys.has('ControlLeft');

    // Movement relative to facing. Forward is (sin yaw, cos yaw).
    let mx = 0;
    let mz = 0;
    const fx = Math.sin(f.yaw);
    const fz = Math.cos(f.yaw);
    const rx = Math.cos(f.yaw);
    const rz = -Math.sin(f.yaw);
    if (keys.has('KeyW') || keys.has('ArrowUp')) { mx += fx; mz += fz; }
    if (keys.has('KeyS') || keys.has('ArrowDown')) { mx -= fx; mz -= fz; }
    if (keys.has('KeyD') || keys.has('ArrowRight')) { mx += rx; mz += rz; }
    if (keys.has('KeyA') || keys.has('ArrowLeft')) { mx -= rx; mz -= rz; }
    const len = Math.hypot(mx, mz);
    f.moving = len > 0;
    if (len > 0) {
      const walk = keys.has('ShiftLeft') || keys.has('ShiftRight');
      const speed = f.crouch ? BOT.walkSpeed * 0.6 : walk ? BOT.walkSpeed : PLAYER.speed;
      const [nx, nz] = collide(
        f.x + (mx / len) * speed * dt,
        f.z + (mz / len) * speed * dt,
        PLAYER.radius,
      );
      f.x = nx;
      f.z = nz;
    }

    if (input.mouseDown || keys.has('Space')) {
      const w = currentWeapon(f);
      if (w.auto || !f.firedLatch) {
        tryFire(state, f, rng);
        f.firedLatch = true;
      }
    } else {
      f.firedLatch = false;
    }
  };
}

/** Bind one frame's pressed set into the (fighter, dt) shape sim expects. */
export function bindPlayerControl(state, input, pressed, rng) {
  const control = makePlayerControl(input, pressed, rng);
  return (f, dt) => control(state, f, dt);
}
