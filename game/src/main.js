// Coral Bay — Sunset Streets. Boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast one), and the
// renderer paints what is there. The game moves between four screens: title, play, paused
// and busted. Progress (money, finished jobs, position) saves to localStorage and loads
// back on the next visit.
//
// ?seed=N fixes the city and the traffic pattern. ?shot=start|drive|chase|mission (with
// &seed=N) stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import {
  createWorld,
  EVENT_BUSTED, EVENT_CAR, EVENT_CRASH, EVENT_HIT,
  EVENT_MISSION_DONE, EVENT_MISSION_FAIL, EVENT_PICKUP, EVENT_PUNCH,
} from './world.js';
import { ACTION_CONFIRM, ACTION_INTERACT, ACTION_PAUSE, ACTION_PUNCH, createInput } from './input.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { createAudio } from './audio.js';
import { loadSave, readBest, saveBest, saveGame } from './save.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped, not replayed. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function runShot(name) {
  const scene = stageShot(name, world);
  window.__shotInfo = {
    player: { x: Math.round(world.state.player.x), y: Math.round(world.state.player.y) },
    camera: { x: Math.round(world.state.camera.x), y: Math.round(world.state.camera.y) },
    wanted: world.state.wanted,
    money: world.state.money,
    mission: world.state.mission ? { name: world.state.mission.name, stage: world.state.mission.stageIndex, timer: Math.round(world.state.mission.timer) } : null,
    inCar: world.state.player.inCar,
    health: Math.round(world.state.player.health),
  };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, world);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let saveToUse = loadSave();
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  // One-shot presses, taken once a frame and handed to both the screen logic and the step.
  let pendingPunch = false;
  let pendingInteract = false;

  // Screen readers (and anyone watching the page's text) hear the screen changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.ensure();
    audio.click();
    world.reset(saveToUse);
    saveToUse = null;
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Explore Coral Bay, take a job, watch out for the police.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    audio.busted();
    audio.siren(false);
    world.afterBusted();
    saveGame(world.state);
    if (world.state.money > best) {
      best = world.state.money;
      saveBest(best);
    }
    announce('Busted. The police took $100. Press Space to get back out there.');
  }

  function pauseGame() {
    screen = SCREEN_PAUSED;
    audio.siren(false);
    saveGame(world.state);
    announce('Paused. Progress saved.');
  }

  function resumeGame() {
    screen = SCREEN_PLAY;
    announce('Playing.');
  }

  /** The mouse aim in world coordinates, for punches. */
  function aimAngle() {
    const mouse = input.mouse();
    if (!mouse) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = 1280 / rect.width;
    const scaleY = 720 / rect.height;
    const cam = world.state.camera;
    const wx = cam.x + (mouse.x - rect.left) * scaleX;
    const wy = cam.y + (mouse.y - rect.top) * scaleY;
    return Math.atan2(wy - world.state.player.y, wx - world.state.player.x);
  }

  function handleActions(actions) {
    // Space or Enter starts (or restarts) the game from the title and busted screens.
    if ((actions & (ACTION_CONFIRM | ACTION_PUNCH)) && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) {
      startGame();
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM | ACTION_PUNCH)) resumeGame();
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_PAUSE) pauseGame();
    if (actions & ACTION_PUNCH) {
      audio.ensure();
      pendingPunch = true;
    }
    if (actions & ACTION_INTERACT) pendingInteract = true;
  }

  function handleEvents(events) {
    if (events & EVENT_PUNCH) audio.punch();
    if (events & EVENT_CRASH) audio.crash();
    if (events & EVENT_PICKUP) audio.pickup();
    if (events & EVENT_CAR) audio.coin();
    if (events & EVENT_MISSION_DONE) {
      audio.missionDone();
      saveGame(world.state);
      if (world.state.money > best) {
        best = world.state.money;
        saveBest(best);
      }
      announce(`Mission complete. $${world.state.money} in the pocket.`);
    }
    if (events & EVENT_MISSION_FAIL) {
      audio.missionFail();
      announce('Mission failed.');
    }
    if (events & EVENT_HIT) announce('Ouch. Watch the traffic.');
    if (events & EVENT_BUSTED) endGame();
  }

  function step() {
    const punchPressed = pendingPunch;
    const interactPressed = pendingInteract;
    pendingPunch = false;
    pendingInteract = false;
    const events = world.step(STEP, {
      move: () => input.move(),
      drive: () => input.drive(),
      punch: punchPressed,
      interact: interactPressed,
      aimAngle: aimAngle(),
    });
    handleEvents(events);
    // Engine hum and siren follow the world.
    const car = world.state.playerCar;
    audio.engine(car ? Math.abs(car.speed) / 560 : 0);
    audio.siren(world.state.wanted > 0);
  }

  function idleStepInput() {
    return {
      move: () => ({ x: 0, y: 0 }),
      drive: () => ({ up: false, down: false, left: false, right: false }),
      punch: false,
      interact: false,
      aimAngle: null,
    };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions(input.takeActions());
    if (screen === SCREEN_TITLE) {
      // The city lives behind the title: traffic rolls, people stroll.
      while (accumulator >= STEP) {
        world.step(STEP, idleStepInput());
        accumulator -= STEP;
      }
    } else if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, world);
  }

  // Leaving the tab pauses a running game rather than letting the cops catch the player unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) pauseGame();
  });
  // Clicking the canvas also starts the game from the title screen.
  canvas.addEventListener('pointerdown', () => {
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER) startGame();
  });

  announce('Coral Bay. Press Space or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
