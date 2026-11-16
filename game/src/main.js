// Sable Station — boot and main loop: three.js scene, the simulation,
// input routing (buy keys vs weapon slots), camera work, sound and HUD.

import * as THREE from 'three';
import { PALETTE } from './config.js';
import { buildWorld } from './map.js';
import { createSim, stepSim } from './sim.js';
import { buyItem } from './state.js';
import { eyeHeight } from './weapons.js';
import { createFx } from './fx.js';
import { createHud, BUY_ITEMS } from './hud.js';
import { createAudio } from './audio.js';
import { createInput } from './input.js';
import { bindPlayerControl } from './player.js';
import { applyShot } from './shots.js';

const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') ?? 7);

const canvas = document.getElementById('game');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.sky);
scene.fog = new THREE.Fog(PALETTE.fog, 45, 130);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.08, 400);
camera.rotation.order = 'YXZ';
scene.add(camera);

const hemi = new THREE.HemisphereLight(0xbdd7ee, 0x35424e, 0.95);
scene.add(hemi);
const moon = new THREE.DirectionalLight(0xdceeff, 1.1);
moon.position.set(-40, 60, -25);
scene.add(moon);
const warm = new THREE.PointLight(0xffb36b, 30, 40);
warm.position.set(-35, 4, -20);
scene.add(warm);

const world = buildWorld(THREE, scene);
const fx = createFx(THREE, scene, camera);
const hud = createHud();
const audio = createAudio();
const input = createInput(canvas);

let sim = createSim(shotName ? seed : (Math.random() * 1e9) | 0);
let started = shotName !== null;
let scoped = false;
let rightMouse = false;

window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('mousedown', (e) => { if (e.button === 2) rightMouse = true; });
window.addEventListener('mouseup', (e) => { if (e.button === 2) rightMouse = false; });
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

const startScreen = document.getElementById('startScreen');
if (shotName) {
  startScreen.style.display = 'none';
  const sceneInfo = applyShot(sim, shotName);
  const idle = () => {};
  for (let i = 0; i < sceneInfo.ticks; i++) stepSim(sim, 1 / 60, idle);
} else {
  document.getElementById('playBtn').addEventListener('click', () => {
    started = true;
    startScreen.style.display = 'none';
    audio.unlock();
    input.lock();
  });
  canvas.addEventListener('click', () => {
    if (started && !input.locked) input.lock();
  });
}

let last = performance.now();
let buyOpen = false;
let framesRendered = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000;
  last = now;
  dt = Math.min(dt, 0.1);
  const t = now / 1000;

  const { state, rng } = sim;
  const player = state.fighters.find((f) => f.isPlayer);

  if (started) {
    const pressed = input.takePressed();
    if (pressed.has('KeyM')) {
      audio.toggleMute();
      pressed.delete('KeyM');
    }
    if (state.phase === 'matchover' && pressed.has('Enter')) {
      sim = createSim((Math.random() * 1e9) | 0);
      return;
    }
    // While the buy menu is open, number keys buy instead of switching.
    if (buyOpen) {
      for (const item of BUY_ITEMS) {
        if (pressed.has(item.key)) {
          buyItem(state, player, item.id);
          pressed.delete(item.key);
        }
      }
    }
    const control = shotName ? () => {} : bindPlayerControl(state, input, pressed, rng);
    stepSim(sim, dt, control);
    audio.playEvents(state, state.events, player);
  }

  // Camera rides the player's eyes (or lies with the body when dead).
  camera.position.set(player.x, player.alive ? eyeHeight(player) : 0.45, player.z);
  camera.rotation.y = player.yaw + Math.PI;
  camera.rotation.x = player.pitch;
  camera.rotation.z = player.alive ? 0 : 0.5;

  // Aurora .338 scope on right mouse.
  const wantScope = rightMouse && player.alive && player.weapons[player.slot] === 'aurora';
  if (wantScope !== scoped) {
    scoped = wantScope;
    camera.fov = scoped ? 17 : 75;
    camera.updateProjectionMatrix();
    document.getElementById('scope').style.display = scoped ? 'block' : 'none';
  }

  world.update(t, dt);
  fx.update(state, dt, t);
  buyOpen = hud.update(state, dt);
  renderer.render(scene, camera);
  if (shotName) {
    window.__sableFrames = ++framesRendered;
    if (framesRendered === 40) window.__sableReady = true;
  }
}
requestAnimationFrame(frame);
