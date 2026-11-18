// Pedestrians: people who stroll the sidewalks, pause at corners, and run away from a
// speeding car or a raised fist. A hit pedestrian goes down, then gets up and walks away.
import { PALETTE, PEDS } from './config.js';
import { nearestRoadPoint, onSidewalk } from './city.js';

export const PED_WALK = 'walk';
export const PED_FLEE = 'flee';
export const PED_DOWN = 'down';
export const PED_FOLLOW = 'follow';

function randomSidewalkPoint(random, city) {
  for (let tries = 0; tries < 20; tries += 1) {
    const x = 120 + random() * 3360;
    const y = 120 + random() * 2200;
    if (onSidewalk(x, y)) return { x, y };
    const near = nearestRoadPoint(x, y);
    if (near.vertical) return { x: near.x + (random() < 0.5 ? -72 : 72), y: near.y };
    return { x: near.x, y: near.y + (random() < 0.5 ? -72 : 72) };
  }
  return { x: 1600, y: 1350 };
}

export function createPedestrians(random, city) {
  const peds = [];
  for (let i = 0; i < PEDS.count; i += 1) {
    const spot = randomSidewalkPoint(random, city);
    const target = randomSidewalkPoint(random, city);
    peds.push({
      x: spot.x, y: spot.y,
      angle: Math.atan2(target.y - spot.y, target.x - spot.x),
      speed: PEDS.walkMin + random() * (PEDS.walkMax - PEDS.walkMin),
      shirt: PALETTE.pedShirt[Math.floor(random() * PALETTE.pedShirt.length)],
      state: PED_WALK,
      targetX: target.x, targetY: target.y,
      wait: random() * 2,
      downTimer: 0,
      walkPhase: random() * Math.PI * 2,
      radius: 11,
    });
  }
  return peds;
}

/**
 * One step for every pedestrian. `threat` is the player's position plus whether they are
 * in a car (cars scare people from further away); `punch` is a fresh punch event.
 */
export function stepPedestrians(peds, dt, random, city, threat) {
  for (const ped of peds) {
    ped.walkPhase += dt * 8;
    if (ped.state === PED_DOWN) {
      ped.downTimer -= dt;
      if (ped.downTimer <= 0) {
        ped.state = PED_WALK;
        const target = randomSidewalkPoint(random, city);
        ped.targetX = target.x;
        ped.targetY = target.y;
      }
      continue;
    }
    if (ped.state === PED_FOLLOW) {
      // Follows the player (the rescued swimmer): walk toward them, keep a small gap.
      const dx = threat.x - ped.x;
      const dy = threat.y - ped.y;
      const d = Math.hypot(dx, dy);
      if (d > 26) {
        ped.angle = Math.atan2(dy, dx);
        ped.x += (dx / d) * 200 * dt;
        ped.y += (dy / d) * 200 * dt;
      }
      continue;
    }
    // Flee a nearby threat.
    if (threat) {
      const dx = ped.x - threat.x;
      const dy = ped.y - threat.y;
      const d = Math.hypot(dx, dy);
      const scare = threat.inCar ? 130 : 70;
      if (d < scare && d > 0.01) {
        ped.state = PED_FLEE;
        ped.angle = Math.atan2(dy, dx);
        ped.x += (dx / d) * PEDS.fleeSpeed * dt;
        ped.y += (dy / d) * PEDS.fleeSpeed * dt;
        if (d > scare + 60) ped.state = PED_WALK;
        continue;
      }
    }
    if (ped.state === PED_FLEE) ped.state = PED_WALK;
    if (ped.wait > 0) {
      ped.wait -= dt;
      continue;
    }
    const dx = ped.targetX - ped.x;
    const dy = ped.targetY - ped.y;
    const d = Math.hypot(dx, dy);
    if (d < 12) {
      if (random() < 0.4) {
        ped.wait = 1 + random() * 3;
      } else {
        const target = randomSidewalkPoint(random, city);
        ped.targetX = target.x;
        ped.targetY = target.y;
      }
      continue;
    }
    ped.angle = Math.atan2(dy, dx);
    ped.x += (dx / d) * ped.speed * dt;
    ped.y += (dy / d) * ped.speed * dt;
  }
}

/** Knock a pedestrian down. Returns true when it was a fresh hit. */
export function knockPedDown(ped, kx, ky) {
  if (ped.state === PED_DOWN) return false;
  ped.state = PED_DOWN;
  ped.downTimer = 6;
  const d = Math.hypot(kx, ky) || 1;
  ped.x += (kx / d) * 14;
  ped.y += (ky / d) * 14;
  return true;
}

export function drawPedestrians(ctx, peds, cam) {
  for (const ped of peds) {
    if (ped.x < cam.x - 40 || ped.x > cam.x + cam.w + 40 || ped.y < cam.y - 40 || ped.y > cam.y + cam.h + 40) continue;
    ctx.save();
    ctx.translate(ped.x, ped.y);
    if (ped.state === PED_DOWN) {
      // Lying flat: a soft shadow and a body on its side.
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.beginPath();
      ctx.ellipse(2, 3, 16, 8, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.rotate(ped.angle);
      ctx.fillStyle = ped.shirt;
      ctx.beginPath();
      ctx.roundRect(-14, -7, 28, 14, 6);
      ctx.fill();
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath();
      ctx.arc(17, 0, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      continue;
    }
    const bob = Math.sin(ped.walkPhase) * 1.5;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(1, 2, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(ped.angle);
    // Body, head, and a walking arm swing.
    ctx.fillStyle = ped.shirt;
    ctx.beginPath();
    ctx.roundRect(-9, -8 + bob * 0.3, 18, 16, 6);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(11, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c2620';
    ctx.beginPath();
    ctx.arc(10, -2, 5, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
