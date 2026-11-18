// The Coral Bay police: a wanted level in stars, patrol cars that chase and ram, and foot
// officers who run the player down. Stars decay when the player lies low; cops arrive from
// the edge of the player's view and leave when the heat is off.
import { PALETTE, POLICE, WANTED, WORLD } from './config.js';
import { drawOneCar } from './traffic.js';
import { collideCircle, nearestRoadPoint } from './city.js';

export function createPolice() {
  return { cars: [], cops: [], sirenOn: false };
}

/** Raise the wanted level by `stars`, capped at the maximum. Returns the new level. */
export function addWanted(state, stars) {
  const before = state.wanted;
  state.wanted = Math.min(WANTED.max, state.wanted + stars);
  if (state.wanted > before) state.wantedTimer = WANTED.decaySeconds;
  return state.wanted;
}

function spawnPointNear(state, random, distance) {
  const angle = random() * Math.PI * 2;
  const x = Math.max(80, Math.min(WORLD.width - 80, state.player.x + Math.cos(angle) * distance));
  const y = Math.max(80, Math.min(WORLD.height - 80, state.player.y + Math.sin(angle) * distance));
  const road = nearestRoadPoint(x, y);
  return road.vertical ? { x: road.x, y } : { x, y: road.y };
}

function spawnPoliceCar(state, random) {
  const spot = spawnPointNear(state, random, POLICE.spawnDistance);
  return {
    x: spot.x, y: spot.y, angle: Math.atan2(state.player.y - spot.y, state.player.x - spot.x),
    speed: 0, color: PALETTE.policeCar, kind: 'police',
    ramCooldown: 0, targetSpeed: POLICE.carSpeed,
  };
}

function spawnCop(state, random) {
  const angle = random() * Math.PI * 2;
  return {
    x: Math.max(40, Math.min(WORLD.width - 40, state.player.x + Math.cos(angle) * 420)),
    y: Math.max(40, Math.min(WORLD.height - 40, state.player.y + Math.sin(angle) * 420)),
    angle: 0, speed: POLICE.footSpeed, punchCooldown: 0, walkPhase: random() * 6,
  };
}

/**
 * One step for the whole police response: wanted decay, spawning to match the star
 * count, pursuit, and ramming. Returns event flags (see world.js).
 */
export function stepPolice(state, dt, random, events) {
  const police = state.police;
  // Lie low and the heat fades, one star at a time.
  if (state.wanted > 0) {
    state.wantedTimer -= dt;
    if (state.wantedTimer <= 0) {
      state.wanted -= 1;
      state.wantedTimer = WANTED.decaySeconds;
    }
  }
  const wantCars = Math.min(state.wanted, 3);
  const wantCops = state.wanted > 0 ? Math.min(state.wanted - wantCars, 3) : 0;
  while (police.cars.length < wantCars) police.cars.push(spawnPoliceCar(state, random));
  while (police.cops.length < wantCops) police.cops.push(spawnCop(state, random));
  police.sirenOn = state.wanted > 0;

  // Police cars: steer toward the player and ram.
  for (const car of police.cars) {
    const dx = state.player.x - car.x;
    const dy = state.player.y - car.y;
    const dist = Math.hypot(dx, dy);
    const wantAngle = Math.atan2(dy, dx);
    let diff = wantAngle - car.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    const speedFactor = Math.min(1, Math.max(0.25, car.speed / 300));
    car.angle += Math.max(-POLICE.carTurn * dt * speedFactor, Math.min(POLICE.carTurn * dt * speedFactor, diff));
    const target = dist < 260 ? POLICE.carSpeed : POLICE.carSpeed * 0.85;
    car.speed += (target - car.speed) * Math.min(1, dt * 1.8);
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    const fixed = collideCircle(state.city, car.x, car.y, 20);
    car.x = fixed.x;
    car.y = fixed.y;
    car.ramCooldown -= dt;
    // Ram the player: on foot it hurts, in a car it shoves.
    if (dist < 44 && car.ramCooldown <= 0) {
      car.ramCooldown = POLICE.ramCooldown;
      if (state.player.inCar) {
        const carObj = state.playerCar;
        carObj.speed *= 0.55;
        carObj.angle += (random() - 0.5) * 0.5;
        events.flags |= events.EVENT_CRASH;
      } else {
        state.player.health -= POLICE.ramDamage;
        state.player.x += (dx / (dist || 1)) * -26;
        state.player.y += (dy / (dist || 1)) * -26;
        events.flags |= events.EVENT_CRASH;
      }
    }
    // A police car that lost the player by a mile respawns closer.
    if (dist > 1600) {
      const spot = spawnPointNear(state, random, POLICE.spawnDistance);
      car.x = spot.x;
      car.y = spot.y;
      car.speed = 0;
    }
  }
  // Foot officers: run the player down and punch.
  for (const cop of police.cops) {
    cop.walkPhase += dt * 10;
    const dx = state.player.x - cop.x;
    const dy = state.player.y - cop.y;
    const dist = Math.hypot(dx, dy);
    if (dist > 900) {
      const spot = spawnCop(state, random);
      cop.x = spot.x;
      cop.y = spot.y;
      continue;
    }
    cop.angle = Math.atan2(dy, dx);
    if (dist > 30) {
      cop.x += (dx / dist) * cop.speed * dt;
      cop.y += (dy / dist) * cop.speed * dt;
    }
    cop.punchCooldown -= dt;
    if (dist < 34 && cop.punchCooldown <= 0 && !state.player.inCar) {
      cop.punchCooldown = POLICE.punchCooldown;
      state.player.health -= POLICE.punchDamage;
      events.flags |= events.EVENT_HIT;
    }
  }
  // Heat off: the force stands down.
  if (state.wanted === 0) {
    police.cars.length = 0;
    police.cops.length = 0;
  }
  return events.flags;
}

export function drawPolice(ctx, police, cam, night) {
  for (const car of police.cars) {
    if (car.x < cam.x - 80 || car.x > cam.x + cam.w + 80 || car.y < cam.y - 80 || car.y > cam.y + cam.h + 80) continue;
    drawOneCar(ctx, car, night);
    // Light bar, flashing red and blue.
    const flash = Math.floor(performance.now() / 280) % 2 === 0;
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = flash ? '#ff3b30' : '#2b5fc7';
    ctx.fillRect(-4, -10, 8, 5);
    ctx.fillStyle = flash ? '#2b5fc7' : '#ff3b30';
    ctx.fillRect(-4, 5, 8, 5);
    ctx.restore();
  }
  for (const cop of police.cops) {
    if (cop.x < cam.x - 40 || cop.x > cam.x + cam.w + 40 || cop.y < cam.y - 40 || cop.y > cam.y + cam.h + 40) continue;
    const bob = Math.sin(cop.walkPhase) * 1.5;
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(1, 2, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(cop.angle);
    ctx.fillStyle = '#1c2f55';
    ctx.beginPath();
    ctx.roundRect(-9, -8 + bob * 0.3, 18, 16, 6);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(11, 0, 6.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1c2f55';
    ctx.beginPath();
    ctx.arc(10, -2, 6, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}
