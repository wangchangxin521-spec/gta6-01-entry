// Combat: a fist on foot (Space or click, aimed at the mouse or the facing direction),
// and ramming with a car. Hits on bystanders raise the wanted level; hits on officers
// raise it more. This module knows nothing about drawing or sound — it returns what hit.
import { PLAYER, WANTED } from './config.js';
import { knockPedDown } from './pedestrians.js';
import { addWanted } from './police.js';

/**
 * Throw a punch from the player's position in `angle`. Returns the number of things hit.
 * `events` is the world's flag object, so a crime is recorded where it happened.
 */
export function punch(state, angle, events) {
  const player = state.player;
  if (player.punchCooldown > 0 || player.inCar) return 0;
  player.punchCooldown = PLAYER.punchCooldown;
  player.punchAnim = 0.22;
  const px = player.x + Math.cos(angle) * 26;
  const py = player.y + Math.sin(angle) * 26;
  let hits = 0;
  for (const ped of state.peds) {
    if (ped.state === 'down' || ped.state === 'follow') continue;
    const d = Math.hypot(ped.x - px, ped.y - py);
    if (d < PLAYER.punchRange) {
      const dx = ped.x - player.x;
      const dy = ped.y - player.y;
      if (knockPedDown(ped, dx, dy)) {
        hits += 1;
        addWanted(state, WANTED.punchPed);
        events.flags |= events.EVENT_PUNCH;
        spawnHitSparks(state, ped.x, ped.y);
      }
    }
  }
  for (const cop of state.police.cops) {
    const d = Math.hypot(cop.x - px, cop.y - py);
    if (d < PLAYER.punchRange + 6) {
      hits += 1;
      addWanted(state, WANTED.hitCop);
      events.flags |= events.EVENT_PUNCH;
      spawnHitSparks(state, cop.x, cop.y);
      // A punched officer staggers back.
      cop.x += Math.cos(angle) * 30;
      cop.y += Math.sin(angle) * 30;
    }
  }
  return hits;
}

/**
 * A car (the player's, or a police car) running into a pedestrian. Returns how many
 * pedestrians were hit this step.
 */
export function carHitsPeds(state, car, events) {
  let hits = 0;
  const halfLen = 26;
  for (const ped of state.peds) {
    if (ped.state === 'down' || ped.state === 'follow') continue;
    const dx = ped.x - car.x;
    const dy = ped.y - car.y;
    const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
    const side = Math.abs(-dx * Math.sin(car.angle) + dy * Math.cos(car.angle));
    if (Math.abs(along) < halfLen && side < 20 && Math.abs(car.speed) > 60) {
      const kx = Math.cos(car.angle) * Math.sign(car.speed);
      const ky = Math.sin(car.angle) * Math.sign(car.speed);
      if (knockPedDown(ped, kx, ky)) {
        hits += 1;
        addWanted(state, WANTED.ramPed);
        events.flags |= events.EVENT_CRASH;
        spawnHitSparks(state, ped.x, ped.y);
      }
    }
  }
  return hits;
}

function spawnHitSparks(state, x, y) {
  for (let i = 0; i < 8; i += 1) {
    state.particles.push({
      x, y,
      vx: (state.random() - 0.5) * 260,
      vy: (state.random() - 0.5) * 260,
      life: 0.35 + state.random() * 0.2,
      maxLife: 0.55,
      color: '#ffd23f',
      size: 3 + state.random() * 3,
    });
  }
}

/** A burst of dust where a car scrapes a building or another car. */
export function spawnCrashDust(state, x, y) {
  for (let i = 0; i < 10; i += 1) {
    state.particles.push({
      x, y,
      vx: (state.random() - 0.5) * 180,
      vy: (state.random() - 0.5) * 180,
      life: 0.4 + state.random() * 0.3,
      maxLife: 0.7,
      color: '#c9c2ae',
      size: 4 + state.random() * 4,
    });
  }
}
