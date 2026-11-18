// Keyboard and mouse input. Held keys give movement and driving; one-shot presses (start,
// pause, interact, punch) are queued as bit flags and taken once by the loop, so a press
// between two frames is never lost and never counted twice. The mouse aims a punch.

export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_INTERACT = 4;
export const ACTION_PUNCH = 8;

const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const CONFIRM = new Set(['Enter']);
const PUNCH = new Set(['Space']);
const INTERACT = new Set(['KeyE']);
const PAUSE = new Set(['KeyP', 'Escape']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseSeen = false;

  window.addEventListener('keydown', (event) => {
    if (UP.has(event.code) || DOWN.has(event.code) || LEFT.has(event.code) || RIGHT.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PUNCH.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PUNCH;
    } else if (INTERACT.has(event.code)) {
      if (!event.repeat) actions |= ACTION_INTERACT;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => {
    held.delete(event.code);
  });
  // A key released while the tab is hidden never sends keyup: let go of everything on blur.
  window.addEventListener('blur', () => held.clear());
  target.addEventListener('pointerdown', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    mouseSeen = true;
    actions |= ACTION_PUNCH;
  });
  target.addEventListener('pointermove', (event) => {
    mouseX = event.clientX;
    mouseY = event.clientY;
    mouseSeen = true;
  });

  function has(set) {
    for (const code of set) if (held.has(code)) return true;
    return false;
  }

  return {
    /** On-foot movement vector, each axis -1, 0 or 1. */
    move() {
      return { x: (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0), y: (has(DOWN) ? 1 : 0) - (has(UP) ? 1 : 0) };
    },
    /** Driving keys, as booleans. */
    drive() {
      return { up: has(UP), down: has(DOWN), left: has(LEFT), right: has(RIGHT) };
    },
    /** Mouse position in CSS pixels, or null until the mouse has moved. */
    mouse() {
      return mouseSeen ? { x: mouseX, y: mouseY } : null;
    },
    /** The one-shot presses since the last call, as ACTION_* flags. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
