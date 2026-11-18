// The world: one state object and one fixed step that ties every system together — the
// player on foot or in a car, traffic, pedestrians, police, missions, combat, particles
// and the camera. It knows nothing about screens or sound: step() returns event flags and
// the caller reacts. Nothing here allocates after createWorld returns.
import { CAR, DAY_LENGTH, PLAYER, SPOTS, VIEW, WORLD } from './config.js';
import { collideCircle, generateCity } from './city.js';
import { createTraffic, nearestStealableCar, stepTraffic } from './traffic.js';
import { createPedestrians, stepPedestrians } from './pedestrians.js';
import { addWanted, createPolice, stepPolice } from './police.js';
import { currentObjective, nearGiver, spawnRunawayVan, startMission, stepMission } from './missions.js';
import { carHitsPeds, punch, spawnCrashDust } from './combat.js';

export const EVENT_PUNCH = 1;
export const EVENT_CRASH = 2;
export const EVENT_PICKUP = 4;
export const EVENT_MISSION_DONE = 8;
export const EVENT_MISSION_FAIL = 16;
export const EVENT_BUSTED = 32;
export const EVENT_HIT = 64;
export const EVENT_CAR = 128;
export const EVENT_WANTED = 256;

function makeEvents() {
  return {
    flags: 0,
    EVENT_PUNCH, EVENT_CRASH, EVENT_PICKUP, EVENT_MISSION_DONE,
    EVENT_MISSION_FAIL, EVENT_BUSTED, EVENT_HIT, EVENT_CAR, EVENT_WANTED,
  };
}

export function createWorld(random) {
  const city = generateCity(random);
  const state = {
    random,
    city,
    elapsed: 0,
    playedSeconds: 0,
    timeOfDay: 0.12,
    money: 120,
    completedMissions: [],
    wanted: 0,
    wantedTimer: 0,
    player: {
      x: SPOTS.spawn.x, y: SPOTS.spawn.y, angle: -Math.PI / 2, speed: 0,
      health: PLAYER.health, inCar: false, punchCooldown: 0, punchAnim: 0,
      hurtCooldown: 0,
    },
    playerCar: null,
    cars: [],
    peds: [],
    police: createPolice(),
    mission: null,
    targetVan: null,
    followerSet: false,
    particles: [],
    toasts: [],
    camera: { x: 0, y: 0, w: VIEW.width, h: VIEW.height },
    busted: false,
    crashCooldown: 0,
  };

  function reset(save) {
    state.elapsed = 0;
    state.playedSeconds = save?.playedSeconds ?? 0;
    state.timeOfDay = 0.12;
    state.money = save?.money ?? 120;
    state.completedMissions = save?.completedMissions ? [...save.completedMissions] : [];
    state.wanted = 0;
    state.wantedTimer = 0;
    state.player.x = save?.x ?? SPOTS.spawn.x;
    state.player.y = save?.y ?? SPOTS.spawn.y;
    state.player.angle = -Math.PI / 2;
    state.player.health = PLAYER.health;
    state.player.inCar = false;
    state.player.punchCooldown = 0;
    state.player.punchAnim = 0;
    state.player.hurtCooldown = 0;
    state.playerCar = null;
    state.cars = createTraffic(random, city);
    state.peds = createPedestrians(random, city);
    state.police = createPolice();
    state.mission = null;
    state.targetVan = null;
    state.followerSet = false;
    state.particles.length = 0;
    state.toasts.length = 0;
    state.busted = false;
    state.crashCooldown = 0;
    updateCamera(1);
  }

  function toast(text, seconds) {
    state.toasts.push({ text, t: seconds || 4 });
    if (state.toasts.length > 3) state.toasts.shift();
  }

  function updateCamera(snap) {
    const cam = state.camera;
    const tx = Math.max(0, Math.min(WORLD.width - cam.w, state.player.x - cam.w / 2));
    const ty = Math.max(0, Math.min(WORLD.height - cam.h, state.player.y - cam.h / 2));
    if (snap) {
      cam.x = tx;
      cam.y = ty;
    } else {
      cam.x += (tx - cam.x) * 0.12;
      cam.y += (ty - cam.y) * 0.12;
    }
  }

  /** Sun direction for shadows, from the time of day. */
  function sunDir() {
    const a = state.timeOfDay * Math.PI;
    return { x: Math.cos(a) * 0.8, y: 0.45 + Math.sin(a) * 0.3 };
  }

  function enterCar(events) {
    const car = nearestStealableCar(state.cars, state.player.x, state.player.y, 84);
    if (!car) return false;
    state.playerCar = car;
    car.kind = 'player';
    car.speed = 0;
    state.player.inCar = true;
    state.player.x = car.x;
    state.player.y = car.y;
    state.player.angle = car.angle;
    addWanted(state, 1);
    events.flags |= EVENT_CAR | EVENT_WANTED;
    toast('Car taken — the police noticed. (+1 star)');
    return true;
  }

  function exitCar() {
    const car = state.playerCar;
    if (!car) return;
    car.kind = 'parked';
    car.speed = 0;
    state.playerCar = null;
    state.player.inCar = false;
    const side = { x: Math.cos(car.angle + Math.PI / 2), y: Math.sin(car.angle + Math.PI / 2) };
    const spot = collideCircle(city, car.x + side.x * 34, car.y + side.y * 34, PLAYER.radius);
    state.player.x = spot.x;
    state.player.y = spot.y;
    state.player.angle = car.angle;
  }

  function driveCar(dt, drive, events) {
    const car = state.playerCar;
    if (drive.up) car.speed += CAR.accel * dt;
    else if (drive.down) car.speed -= (car.speed > 0 ? CAR.brake : CAR.reverseAccel) * dt;
    else {
      // Coast down.
      const drag = CAR.drag * 60 * dt;
      car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), drag);
    }
    car.speed = Math.max(-CAR.maxReverse, Math.min(CAR.maxSpeed, car.speed));
    const steer = (drive.left ? -1 : 0) + (drive.right ? 1 : 0);
    if (steer !== 0 && Math.abs(car.speed) > 12) {
      car.angle += steer * CAR.turnRate * dt * Math.sign(car.speed) * Math.min(1, Math.abs(car.speed) / 220);
    }
    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const fixed = collideCircle(city, nx, ny, 21);
    if (fixed.hit && Math.abs(car.speed) > 200 && state.crashCooldown <= 0) {
      state.crashCooldown = 0.35;
      car.speed *= 0.45;
      spawnCrashDust(state, car.x, car.y);
      events.flags |= EVENT_CRASH;
    } else if (fixed.hit) {
      car.speed *= 0.6;
    }
    car.x = fixed.x;
    car.y = fixed.y;
    state.player.x = car.x;
    state.player.y = car.y;
    state.player.angle = car.angle;
    // Bump into other traffic.
    for (const other of state.cars) {
      if (other === car || other.kind === 'player') continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const d = Math.hypot(dx, dy);
      if (d < 46 && d > 0.01) {
        const push = (46 - d) / 2;
        const ux = dx / d;
        const uy = dy / d;
        car.x -= ux * push;
        car.y -= uy * push;
        other.x += ux * push;
        other.y += uy * push;
        if (Math.abs(car.speed) > 120 && state.crashCooldown <= 0) {
          state.crashCooldown = 0.35;
          car.speed *= 0.6;
          other.speed *= 0.5;
          spawnCrashDust(state, (car.x + other.x) / 2, (car.y + other.y) / 2);
          events.flags |= EVENT_CRASH;
        }
      }
    }
    // Ram pedestrians and the runaway van.
    carHitsPeds(state, car, events);
    if (state.targetVan) {
      const van = state.targetVan;
      const d = Math.hypot(van.x - car.x, van.y - car.y);
      if (d < 52 && Math.abs(car.speed) > 140 && state.crashCooldown <= 0) {
        state.crashCooldown = 0.8;
        state.mission.hits += 1;
        van.speed *= 0.4;
        car.speed *= 0.55;
        spawnCrashDust(state, (car.x + van.x) / 2, (car.y + van.y) / 2);
        events.flags |= EVENT_CRASH;
        toast(`Van hit ${state.mission.hits}/${state.mission.hitsToStop}`);
      }
    }
  }

  function walkPlayer(dt, input, events) {
    const player = state.player;
    const move = input.move();
    const len = Math.hypot(move.x, move.y);
    let mx = 0;
    let my = 0;
    if (len > 0) {
      mx = move.x / len;
      my = move.y / len;
      player.angle = Math.atan2(my, mx);
    }
    const speed = PLAYER.walkSpeed;
    const nx = player.x + mx * speed * dt;
    const ny = player.y + my * speed * dt;
    const fixed = collideCircle(city, nx, ny, PLAYER.radius);
    player.x = fixed.x;
    player.y = fixed.y;
    // Traffic can run the player over.
    player.hurtCooldown -= dt;
    for (const car of state.cars) {
      if (car.kind === 'parked' || Math.abs(car.speed) < 40) continue;
      const dx = player.x - car.x;
      const dy = player.y - car.y;
      const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
      const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
      if (Math.abs(along) < 30 && side < 22 && player.hurtCooldown <= 0) {
        player.hurtCooldown = 1;
        player.health -= 14;
        const dist = Math.hypot(dx, dy) || 1;
        player.x += (dx / dist) * 30;
        player.y += (dy / dist) * 30;
        events.flags |= EVENT_HIT;
      }
    }
    if (input.punch) {
      const angle = input.aimAngle != null ? input.aimAngle : player.angle;
      punch(state, angle, events);
    }
  }

  function handleInteract(events) {
    const giver = nearGiver(state);
    if (giver) {
      const mission = startMission(state, giver);
      if (mission.defId === 'runaway') {
        const van = spawnRunawayVan(state, random);
        state.targetVan = van;
        state.cars.push(van);
      }
      toast(`${mission.name}: ${mission.briefing}`, 6);
      events.flags |= EVENT_PICKUP;
      return;
    }
    if (state.player.inCar) {
      exitCar();
      return;
    }
    enterCar(events);
  }

  function stepMissionWrapper(dt, events) {
    if (!state.mission) return;
    const missionBefore = state.mission;
    const outcome = stepMission(state, dt, events);
    if (outcome === 'done') {
      toast(`Mission complete! +$${missionBefore.reward}`, 5);
      events.flags |= EVENT_MISSION_DONE;
      state.targetVan = null;
      for (const ped of state.peds) if (ped.state === 'follow') ped.state = 'walk';
      state.followerSet = false;
      return;
    }
    if (outcome === 'failed') {
      toast('Mission failed — the moment passed.', 5);
      events.flags |= EVENT_MISSION_FAIL;
      if (state.targetVan) {
        const index = state.cars.indexOf(state.targetVan);
        if (index >= 0) state.cars.splice(index, 1);
        state.targetVan = null;
      }
      for (const ped of state.peds) if (ped.state === 'follow') ped.state = 'walk';
      state.followerSet = false;
      return;
    }
    // The lifeguard job: once the swimmer is reached, they follow the player.
    if (state.mission.defId === 'lifeguard' && state.mission.stageIndex === 1 && !state.followerSet) {
      state.followerSet = true;
      let best = null;
      let bestD = Infinity;
      for (const ped of state.peds) {
        const d = Math.hypot(ped.x - 1500, ped.y - 2470);
        if (d < bestD) { bestD = d; best = ped; }
      }
      if (best) {
        best.state = 'follow';
        best.x = 1500;
        best.y = 2440;
      }
    }
  }

  /**
   * One fixed step. `input` is { move(), drive(), punch, interact, aimAngle } — the
   * one-shot flags are consumed here, so the caller sets them fresh each frame.
   * Returns the event flags for this step.
   */
  function step(dt, input) {
    const events = makeEvents();
    state.elapsed += dt;
    state.playedSeconds += dt;
    state.timeOfDay = (state.elapsed / DAY_LENGTH) % 1;
    state.crashCooldown -= dt;
    const player = state.player;
    player.punchCooldown = Math.max(0, player.punchCooldown - dt);
    player.punchAnim = Math.max(0, player.punchAnim - dt);

    if (input.interact) handleInteract(events);
    if (player.inCar && state.playerCar) driveCar(dt, input.drive(), events);
    else walkPlayer(dt, input, events);

    stepTraffic(state.cars, dt, random, state.playerCar);
    // The runaway van flees along the roads, faster than normal traffic.
    if (state.targetVan && state.mission && state.targetVan.kind === 'target') {
      const van = state.targetVan;
      van.turnTimer -= dt;
      van.speed += (van.targetSpeed - van.speed) * Math.min(1, dt * 1.5);
      van.x += Math.cos(van.angle) * van.speed * dt;
      van.y += Math.sin(van.angle) * van.speed * dt;
      const fixed = collideCircle(city, van.x, van.y, 21);
      van.x = fixed.x;
      van.y = fixed.y;
      if (van.x < 60 || van.x > WORLD.width - 60 || van.y < 60 || van.y > WORLD.height - 60) {
        van.angle += Math.PI;
      }
    }
    stepPedestrians(state.peds, dt, random, city, {
      x: player.x, y: player.y, inCar: player.inCar,
    });
    stepPolice(state, dt, random, events);
    stepMissionWrapper(dt, events);

    // Particles.
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        state.particles.splice(i, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
    // Toasts.
    for (let i = state.toasts.length - 1; i >= 0; i -= 1) {
      state.toasts[i].t -= dt;
      if (state.toasts[i].t <= 0) state.toasts.splice(i, 1);
    }
    // Lie low and health comes back.
    if (state.wanted === 0 && player.health < PLAYER.health) {
      player.health = Math.min(PLAYER.health, player.health + 3 * dt);
    }
    // Busted.
    if (player.health <= 0 && !state.busted) {
      state.busted = true;
      player.health = 0;
      events.flags |= EVENT_BUSTED;
    }
    updateCamera(0);
    return events.flags;
  }

  /** After a bust: the player wakes at the hospital, lighter in the pocket. */
  function afterBusted() {
    state.busted = false;
    state.wanted = 0;
    state.wantedTimer = 0;
    state.police = createPolice();
    state.player.health = PLAYER.health;
    state.player.inCar = false;
    state.playerCar = null;
    state.player.x = SPOTS.hospital.x;
    state.player.y = SPOTS.hospital.y + 60;
    state.money = Math.max(0, state.money - 100);
    if (state.mission) {
      state.mission = null;
      if (state.targetVan) {
        const index = state.cars.indexOf(state.targetVan);
        if (index >= 0) state.cars.splice(index, 1);
        state.targetVan = null;
      }
      for (const ped of state.peds) if (ped.state === 'follow') ped.state = 'walk';
      state.followerSet = false;
    }
    updateCamera(1);
  }

  reset(null);
  return {
    state, reset, step, toast, sunDir, afterBusted, currentObjective: () => currentObjective(state),
  };
}
