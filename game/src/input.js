// Sable Station — input: keyboard state, mouse look deltas, pointer lock.

export function createInput(canvas) {
  const keys = new Set();
  const pressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let locked = false;

  window.addEventListener('keydown', (e) => {
    if (!e.repeat) pressed.add(e.code);
    keys.add(e.code);
    if (['Space', 'Tab'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });

  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouseDown = true;
  });
  window.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouseDown = false;
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  document.addEventListener('mousemove', (e) => {
    if (!locked) return;
    mouseDX += e.movementX || 0;
    mouseDY += e.movementY || 0;
  });

  return {
    keys,
    get locked() { return locked; },
    get mouseDown() { return mouseDown; },
    lock() { canvas.requestPointerLock(); },
    /** One-shot key presses since the last call (for menus and toggles). */
    takePressed() {
      const out = new Set(pressed);
      pressed.clear();
      return out;
    },
    takeMouse() {
      const out = { dx: mouseDX, dy: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return out;
    },
  };
}
