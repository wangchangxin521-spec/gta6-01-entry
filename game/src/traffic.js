// Traffic: ordinary cars that drive the street grid in lanes, turn at intersections, slow
// for the car ahead, and park along the kerb. Parked cars are the ones the player can steal.
import { CAR, PALETTE, ROADS_H, ROADS_V, ROAD_W, TRAFFIC, WORLD } from './config.js';
import { nearestRoadPoint, onRoad } from './city.js';

const CAR_COLORS = ['#d95f66', '#4c9a8a', '#e8a04c', '#7a6fc0', '#c96a9b', '#5b8c5a', '#e8e8e8', '#3a6ea5', '#c9c2ae', '#ff8c42'];
const LANE = 30;

function makeCar(random, x, y, angle, kind) {
  return {
    x, y, angle, speed: 0,
    color: kind === 'taxi' ? PALETTE.taxi : CAR_COLORS[Math.floor(random() * CAR_COLORS.length)],
    kind, // 'traffic' | 'parked' | 'taxi'
    axis: Math.abs(Math.cos(angle)) > 0.7 ? 'h' : 'v',
    dir: Math.abs(Math.cos(angle)) > 0.7 ? Math.sign(Math.cos(angle)) || 1 : Math.sign(Math.sin(angle)) || 1,
    lane: (random() < 0.5 ? -1 : 1) * LANE,
    targetSpeed: TRAFFIC.minSpeed + random() * (TRAFFIC.maxSpeed - TRAFFIC.minSpeed),
    turnTimer: 1 + random() * 3,
    stopped: 0,
  };
}

/** Spawn the moving traffic and a row of parked, stealable cars. */
export function createTraffic(random, city) {
  const cars = [];
  for (let i = 0; i < TRAFFIC.count; i += 1) {
    const vertical = random() < 0.5;
    const road = vertical
      ? ROADS_V[Math.floor(random() * ROADS_V.length)]
      : ROADS_H[Math.floor(random() * ROADS_H.length)];
    const along = 100 + random() * (vertical ? WORLD.height - 200 : WORLD.width - 200);
    const dir = random() < 0.5 ? 1 : -1;
    const lane = (random() < 0.5 ? -1 : 1) * LANE;
    const car = makeCar(random, 0, 0, 0, random() < 0.12 ? 'taxi' : 'traffic');
    if (vertical) {
      car.x = road + lane;
      car.y = along;
      car.angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      car.axis = 'v';
    } else {
      car.x = along;
      car.y = road + lane;
      car.angle = dir > 0 ? 0 : Math.PI;
      car.axis = 'h';
    }
    car.dir = dir;
    car.speed = car.targetSpeed;
    cars.push(car);
  }
  // Parked cars along kerbs, ready to steal.
  const parkedSpots = [
    { x: 1000, y: 350 + 78, angle: 0 }, { x: 1600, y: 850 - 78, angle: Math.PI },
    { x: 2200, y: 1350 + 78, angle: 0 }, { x: 2800, y: 1850 - 78, angle: Math.PI },
    { x: 400, y: 1350 + 78, angle: 0 }, { x: 3300, y: 850 - 78, angle: Math.PI },
    { x: 1300, y: 1350, angle: Math.PI / 2 }, { x: 2500, y: 2250 + 78, angle: 0 },
  ];
  for (const spot of parkedSpots) {
    const car = makeCar(random, spot.x, spot.y, spot.angle, 'parked');
    car.speed = 0;
    cars.push(car);
  }
  return cars;
}

function nearestIntersection(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const cx of ROADS_V) {
    for (const cy of ROADS_H) {
      const d = Math.abs(x - cx) + Math.abs(y - cy);
      if (d < bestD) { bestD = d; best = { x: cx, y: cy, d }; }
    }
  }
  return best;
}

function carAhead(cars, self, lookAhead) {
  const dx = Math.cos(self.angle);
  const dy = Math.sin(self.angle);
  let nearest = Infinity;
  for (const other of cars) {
    if (other === self || other.kind === 'parked') continue;
    const ox = other.x - self.x;
    const oy = other.y - self.y;
    const along = ox * dx + oy * dy;
    if (along < 0 || along > lookAhead) continue;
    const side = Math.abs(ox * -dy + oy * dx);
    if (side < 34 && along < nearest) nearest = along;
  }
  return nearest;
}

/**
 * One step for every traffic car. Cars follow their road; at an intersection they may
 * turn onto the crossing street. They never leave the grid and never enter a building.
 */
export function stepTraffic(cars, dt, random, playerCar) {
  const all = playerCar ? [...cars, playerCar] : cars;
  for (const car of cars) {
    if (car.kind === 'parked' || car.kind === 'player' || car.kind === 'target') continue;
    car.turnTimer -= dt;
    const inter = nearestIntersection(car.x, car.y);
    const atInter = inter && inter.d < 46;
    if (atInter && car.turnTimer <= 0 && random() < TRAFFIC.turnChance) {
      // Turn onto the crossing street, keeping the lane on the right side of the road.
      const newAxis = car.axis === 'h' ? 'v' : 'h';
      const newDir = random() < 0.5 ? 1 : -1;
      car.axis = newAxis;
      car.dir = newDir;
      car.lane = (random() < 0.5 ? -1 : 1) * LANE;
      if (newAxis === 'h') {
        car.angle = newDir > 0 ? 0 : Math.PI;
        car.y = inter.y + car.lane;
        car.x = inter.x;
      } else {
        car.angle = newDir > 0 ? Math.PI / 2 : -Math.PI / 2;
        car.x = inter.x + car.lane;
        car.y = inter.y;
      }
      car.turnTimer = 2 + random() * 3;
    }
    // Slow for the car ahead.
    const ahead = carAhead(all, car, 90);
    let target = car.targetSpeed;
    if (ahead < 70) target = ahead < 40 ? 0 : car.targetSpeed * 0.4;
    car.speed += (target - car.speed) * Math.min(1, dt * 2.5);
    const step = car.speed * dt;
    car.x += Math.cos(car.angle) * step;
    car.y += Math.sin(car.angle) * step;
    // Wrap around the world edge so traffic never runs out.
    if (car.x < -60) car.x = WORLD.width + 50;
    if (car.x > WORLD.width + 60) car.x = -50;
    if (car.y < -60) car.y = WORLD.height + 50;
    if (car.y > WORLD.height + 60) car.y = -50;
    // Keep on the road: if somehow off it (a turn), snap back to the nearest road.
    if (!onRoad(car.x, car.y)) {
      const near = nearestRoadPoint(car.x, car.y);
      if (near.vertical) car.x = near.x + car.lane;
      else car.y = near.y + car.lane;
    }
  }
}

/** A parked car close enough to steal, or null. Only parked cars can be taken. */
export function nearestStealableCar(cars, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of cars) {
    if (car.kind !== 'parked') continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function drawOneCar(ctx, car, headlights) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.25)';
  ctx.fillRect(-CAR.length / 2 + 3, -CAR.width / 2 + 4, CAR.length, CAR.width);
  // Body.
  ctx.fillStyle = car.color;
  ctx.beginPath();
  ctx.roundRect(-CAR.length / 2, -CAR.width / 2, CAR.length, CAR.width, 7);
  ctx.fill();
  // Cabin and windshield.
  ctx.fillStyle = 'rgba(20,28,38,0.85)';
  ctx.beginPath();
  ctx.roundRect(-8, -CAR.width / 2 + 4, 16, CAR.width - 8, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,240,0.5)';
  ctx.fillRect(8, -CAR.width / 2 + 5, 5, CAR.width - 10);
  // Headlights.
  if (headlights) {
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(CAR.length / 2 - 2, -CAR.width / 2 + 2, 3, 5);
    ctx.fillRect(CAR.length / 2 - 2, CAR.width / 2 - 7, 3, 5);
  }
  // Taxi sign.
  if (car.kind === 'taxi') {
    ctx.fillStyle = '#111';
    ctx.fillRect(-6, -4, 12, 8);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 7px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('TAXI', 0, 0.5);
  }
  ctx.restore();
}

export function drawTraffic(ctx, cars, cam, night) {
  for (const car of cars) {
    if (car.x < cam.x - 80 || car.x > cam.x + cam.w + 80 || car.y < cam.y - 80 || car.y > cam.y + cam.h + 80) continue;
    drawOneCar(ctx, car, night);
  }
}

export { drawOneCar };
