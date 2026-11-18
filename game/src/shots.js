// The screenshot scenes behind ?shot=start|drive|chase|mission. Each one plays the real
// rules forward from a fresh world for a fixed number of steps, steered by a simple
// autopilot (drive toward waypoints along the roads, walk toward a marker on foot), so the
// frame is what a short game really looks like and the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const DRIVE_SECONDS = 13;
const CHASE_SECONDS = 10;
/** Short on purpose: the frame is taken while the parcel is still on its way to the hotel. */
const MISSION_SECONDS = 2.5;

/** The empty input: no keys, no clicks. */
function idleInput() {
  return {
    move: () => ({ x: 0, y: 0 }),
    drive: () => ({ up: false, down: false, left: false, right: false }),
    punch: false,
    interact: false,
    aimAngle: null,
  };
}

function clampAngle(angle) {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

/**
 * Drive the player's car toward a waypoint, following the road it is on. Returns a
 * drive input; `stuck` carries the reverse-out state when the car wedges on a corner.
 */
function driveToward(state, tx, ty, stuck) {
  const car = state.playerCar;
  if (!car) return { up: false, down: false, left: false, right: false };
  if (stuck.timer > 0) {
    stuck.timer -= STEP;
    return { up: false, down: true, left: stuck.steer < 0, right: stuck.steer > 0 };
  }
  if (Math.abs(car.speed) < 30 && stuck.since > 1.2) {
    stuck.timer = 0.7;
    stuck.since = 0;
    stuck.steer = car.speed >= 0 ? 1 : -1;
    return { up: false, down: true, left: false, right: true };
  }
  const want = Math.atan2(ty - car.y, tx - car.x);
  const diff = clampAngle(want - car.angle);
  return {
    up: Math.abs(diff) < 1.4,
    down: false,
    left: diff < -0.08,
    right: diff > 0.08,
  };
}

/** Walk on foot toward a point. */
function walkToward(state, tx, ty) {
  const dx = tx - state.player.x;
  const dy = ty - state.player.y;
  const d = Math.hypot(dx, dy) || 1;
  return { x: dx / d, y: dy / d };
}

/** Put the player in the parked car nearest (x, y) without raising the wanted level. */
function putPlayerInCar(state, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const car of state.cars) {
    if (car.kind !== 'parked') continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  if (!best) return false;
  best.kind = 'player';
  best.speed = 0;
  state.playerCar = best;
  state.player.inCar = true;
  state.player.x = best.x;
  state.player.y = best.y;
  state.player.angle = best.angle;
  return true;
}

/** Park a few traffic cars on the player's route so the frame shows traffic. */
function seedRouteTraffic(state, points) {
  let i = 0;
  for (const car of state.cars) {
    if (i >= points.length) break;
    if (car.kind !== 'traffic') continue;
    const [x, y, angle] = points[i];
    car.x = x;
    car.y = y;
    car.angle = angle;
    car.axis = Math.abs(Math.cos(angle)) > 0.7 ? 'h' : 'v';
    car.dir = Math.abs(Math.cos(angle)) > 0.7 ? Math.sign(Math.cos(angle)) || 1 : Math.sign(Math.sin(angle)) || 1;
    car.speed = car.targetSpeed;
    i += 1;
  }
}

const LOOP_WAYPOINTS = [
  [3200, 350], [3200, 2250], [400, 2250], [400, 350],
];

/** Follow a list of waypoints in the player's car for `seconds`, then stop. */
function driveLoop(world, waypoints, seconds) {
  const state = world.state;
  const stuck = { timer: 0, since: 0, steer: 1 };
  let wp = 0;
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    const [tx, ty] = waypoints[wp];
    const d = Math.hypot(tx - state.player.x, ty - state.player.y);
    if (d < 130) wp = (wp + 1) % waypoints.length;
    const input = idleInput();
    const car = state.playerCar;
    if (car && Math.abs(car.speed) < 30) stuck.since += STEP;
    else stuck.since = 0;
    input.drive = () => driveToward(state, waypoints[wp][0], waypoints[wp][1], stuck);
    world.step(STEP, input);
  }
}

/**
 * Set `world` to the named scene (start, drive, chase or mission; any other name is start)
 * and return the screen to draw over it and the best money to show.
 */
export function stageShot(name, world) {
  const state = world.state;
  world.reset();
  if (name !== 'drive' && name !== 'chase' && name !== 'mission') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) world.step(STEP, idleInput());
    return { screen: SCREEN_TITLE, best: 120 };
  }

  if (name === 'drive') {
    // Get in the parked car by the plaza and cruise the city loop.
    state.player.x = 1000;
    state.player.y = 400;
    const enter = idleInput();
    enter.interact = true;
    world.step(STEP, enter);
    state.wanted = 0;
    state.wantedTimer = 999;
    seedRouteTraffic(state, [[1500, 350, 0], [2100, 350, 0], [2600, 350, 0]]);
    driveLoop(world, LOOP_WAYPOINTS, DRIVE_SECONDS);
    return { screen: SCREEN_PLAY, best: 120 };
  }

  if (name === 'chase') {
    // Five stars, sirens, and the same cruise — the police do the rest.
    state.player.x = 1000;
    state.player.y = 400;
    const enter = idleInput();
    enter.interact = true;
    world.step(STEP, enter);
    state.wanted = 5;
    state.wantedTimer = 999;
    state.money = 1250;
    seedRouteTraffic(state, [[1500, 350, 0], [2100, 1350, 0], [2600, 850, Math.PI]]);
    driveLoop(world, LOOP_WAYPOINTS, CHASE_SECONDS);
    return { screen: SCREEN_PLAY, best: 1250 };
  }

  // Mission: take the courier job at the marina, pick up the parcel, then drive for the hotel.
  state.player.x = 330;
  state.player.y = 2080;
  const accept = idleInput();
  accept.interact = true;
  world.step(STEP, accept);
  // Walk to the parcel on the dock.
  for (let i = 0; i < 4 / STEP; i += 1) {
    if (!state.mission || state.mission.stageIndex > 0) break;
    const input = idleInput();
    input.move = () => walkToward(state, 210, 2150);
    world.step(STEP, input);
  }
  // Take the parked car by the marina road and drive for the Palms Hotel.
  putPlayerInCar(state, 400, 1428);
  state.wanted = 0;
  state.wantedTimer = 999;
  seedRouteTraffic(state, [[1000, 1350, 0], [1600, 1350, 0], [2200, 1350, Math.PI]]);
  driveLoop(world, [[1600, 1350], [1900, 1350], [1900, 1215]], MISSION_SECONDS);
  return { screen: SCREEN_PLAY, best: 120 };
}
