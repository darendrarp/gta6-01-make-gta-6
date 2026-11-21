// Keyboard + mouse. Held keys are read every frame; one-shot presses (enter car,
// jump, fire, pause, mute, weapon toggle, interact) are queued as bit flags and
// taken once by the loop, so a press between frames is never lost or double-counted.
// Mouse movement steers the camera while the pointer is locked.

export const ACT_JUMP = 1;
export const ACT_ENTER = 2;
export const ACT_PAUSE = 4;
export const ACT_FIRE = 8;
export const ACT_MELEE = 16;
export const ACT_WEAPON = 32;
export const ACT_MUTE = 64;
export const ACT_CONFIRM = 128;
export const ACT_RACE = 256; // R: start a street race at the start arch
export const ACT_NIGHT = 512; // N: flip day/night
export const ACT_GARAGE = 1024; // G: store the car / repaint in the garage yard
export const ACT_TUNE = 2048; // T: tune the car in the garage yard

const HELD = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'Space']);

export function createInput() {
  const held = new Set();
  let actions = 0;
  let mouseDX = 0;
  let mouseDY = 0;
  let firing = false;

  window.addEventListener('keydown', (event) => {
    if (event.repeat) return;
    if (HELD.has(event.code)) held.add(event.code);
    switch (event.code) {
      case 'Space': actions |= ACT_JUMP; break;
      case 'KeyE': actions |= ACT_ENTER; break;
      case 'KeyP': case 'Escape': actions |= ACT_PAUSE; break;
      case 'KeyQ': actions |= ACT_WEAPON; break;
      case 'KeyF': actions |= ACT_MELEE; break;
      case 'KeyM': actions |= ACT_MUTE; break;
      case 'KeyR': actions |= ACT_RACE; break;
      case 'KeyN': actions |= ACT_NIGHT; break;
      case 'KeyG': actions |= ACT_GARAGE; break;
      case 'KeyT': actions |= ACT_TUNE; break;
      case 'Enter': actions |= ACT_CONFIRM; break;
      default: break;
    }
    if (['Space', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown'].includes(event.code)) {
      event.preventDefault();
    }
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => { held.clear(); firing = false; });
  document.addEventListener('mousemove', (event) => {
    if (document.pointerLockElement) {
      mouseDX += event.movementX;
      mouseDY += event.movementY;
    }
  });
  document.addEventListener('mousedown', (event) => {
    if (event.button === 0 && document.pointerLockElement) {
      firing = true;
      actions |= ACT_FIRE;
    }
  });
  document.addEventListener('mouseup', (event) => {
    if (event.button === 0) firing = false;
  });

  return {
    forward() { return (held.has('KeyW') ? 1 : 0) - (held.has('KeyS') ? 1 : 0); },
    strafe() { return (held.has('KeyD') ? 1 : 0) - (held.has('KeyA') ? 1 : 0); },
    run() { return held.has('ShiftLeft') || held.has('ShiftRight'); },
    handbrake() { return held.has('Space'); },
    isFiring() { return firing; },
    takeMouse() {
      const out = { dx: mouseDX, dy: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return out;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    // Peek without consuming: the frame loop needs to see screen-level
    // actions (pause, mute, respawn) even when the sim is not running.
    peekActions() { return actions; },
    clearAction(mask) { actions &= ~mask; },
    clearActions() { actions = 0; },
  };
}
