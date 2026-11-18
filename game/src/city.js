// Coral Bay itself: a sun-soaked seaside city on a 6 by 5 street grid, generated once from
// a seed — roads, sidewalks, blocks of coral-roofed buildings, a central plaza, a park, a
// marina on the west edge and a beach along the south edge. No drawing of entities here,
// only the place: generation, collision against buildings and water, and painting the ground.
import { PALETTE, ROADS_H, ROADS_V, ROAD_W, SIDEWALK, SPOTS, WORLD } from './config.js';

const HALF_ROAD = ROAD_W / 2;

/** Is the point on a road (within the asphalt, sidewalks excluded)? */
export function onRoad(x, y) {
  for (const cx of ROADS_V) if (Math.abs(x - cx) <= HALF_ROAD) return true;
  for (const cy of ROADS_H) if (Math.abs(y - cy) <= HALF_ROAD) return true;
  return false;
}

/** Is the point on a sidewalk strip beside a road? */
export function onSidewalk(x, y) {
  for (const cx of ROADS_V) {
    const d = Math.abs(x - cx);
    if (d > HALF_ROAD && d <= HALF_ROAD + SIDEWALK) return true;
  }
  for (const cy of ROADS_H) {
    const d = Math.abs(y - cy);
    if (d > HALF_ROAD && d <= HALF_ROAD + SIDEWALK) return true;
  }
  return false;
}

/** The nearest point on any road centre-line to (x, y). */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const cx of ROADS_V) {
    const d = Math.abs(x - cx);
    if (d < bestD) { bestD = d; best = { x: cx, y, vertical: true }; }
  }
  for (const cy of ROADS_H) {
    const d = Math.abs(y - cy);
    if (d < bestD) { bestD = d; best = { x, y: cy, vertical: false }; }
  }
  return best;
}

function blockRanges(roads, limit) {
  const ranges = [];
  let start = 0;
  for (const centre of roads) {
    ranges.push([start, centre - HALF_ROAD - SIDEWALK]);
    start = centre + HALF_ROAD + SIDEWALK;
  }
  ranges.push([start, limit]);
  return ranges;
}

function pick(random, array) {
  return array[Math.floor(random() * array.length)];
}

/**
 * Generate the city from a seed. Buildings keep a margin from the streets; a few blocks
 * are parks, parking lots or the plaza instead of buildings, and the landmark blocks hold
 * the hotel, the hospital and the police station the missions name.
 */
export function generateCity(random) {
  const buildings = [];
  const trees = [];
  const lamps = [];
  const parks = [];
  const parkingLots = [];
  const umbrellas = [];
  const docks = [];

  const colRanges = blockRanges(ROADS_V, WORLD.width);
  const rowRanges = blockRanges(ROADS_H, WORLD.height);
  // The south strip is beach, not blocks.
  const beachTop = 2360;

  function blockKey(ci, ri) {
    return `${ci},${ri}`;
  }
  // Landmark blocks, by column/row index into the ranges above.
  const plazaKey = blockKey(2, 2);
  const hotelKey = blockKey(3, 2);
  const hospitalKey = blockKey(4, 3);
  const policeKey = blockKey(1, 0);
  const parkKeys = new Set([blockKey(1, 2), blockKey(4, 1), blockKey(2, 4)]);
  const lotKeys = new Set([blockKey(3, 1), blockKey(1, 3), blockKey(5, 2)]);

  for (let ri = 0; ri < rowRanges.length; ri += 1) {
    for (let ci = 0; ci < colRanges.length; ci += 1) {
      const [x0, x1] = colRanges[ci];
      const [y0, y1] = rowRanges[ri];
      if (y0 >= beachTop) continue;
      const width = x1 - x0;
      const height = Math.min(y1, beachTop) - y0;
      if (width < 60 || height < 60) continue;
      const key = blockKey(ci, ri);
      const inset = 14;

      // The marina shore (first column) stays open: docks, sand and the mission pickup.
      if (ci === 0) {
        for (let i = 0; i < 3; i += 1) {
          trees.push({ x: x0 + 30 + random() * Math.max(10, width - 60), y: y0 + 20 + random() * Math.max(10, height - 40), size: 9 + random() * 4 });
        }
        continue;
      }
      if (key === plazaKey) {
        // Coral Plaza: open paving with palms around the edge, the spawn point.
        for (let i = 0; i < 10; i += 1) {
          trees.push({ x: x0 + 20 + random() * (width - 40), y: y0 + 14, size: 9 + random() * 4 });
          trees.push({ x: x0 + 20 + random() * (width - 40), y: y0 + height - 14, size: 9 + random() * 4 });
        }
        continue;
      }
      if (parkKeys.has(key)) {
        parks.push({ x: x0, y: y0, w: width, h: height });
        const count = 8 + Math.floor(random() * 6);
        for (let i = 0; i < count; i += 1) {
          trees.push({ x: x0 + 16 + random() * (width - 32), y: y0 + 16 + random() * (height - 32), size: 10 + random() * 6 });
        }
        continue;
      }
      if (lotKeys.has(key)) {
        parkingLots.push({ x: x0, y: y0, w: width, h: height });
        continue;
      }

      // Landmark buildings get a label and a fixed footprint.
      if (key === hotelKey || key === hospitalKey || key === policeKey) {
        const label = key === hotelKey ? 'PALMS HOTEL' : key === hospitalKey ? 'ST. AURELIA HOSPITAL' : 'POLICE HQ';
        const bw = Math.min(width - inset * 2, 260);
        const bh = Math.min(height - inset * 2, 150);
        buildings.push({
          x: x0 + (width - bw) / 2, y: y0 + (height - bh) / 2, w: bw, h: bh,
          roof: key === hotelKey ? '#e8a04c' : key === hospitalKey ? '#f2e3c6' : '#2b5fc7',
          label, tall: true,
        });
        continue;
      }

      // Ordinary blocks: one to three buildings, placed to leave gaps between them.
      const count = random() < 0.45 ? 1 : random() < 0.8 ? 2 : 3;
      if (count === 1) {
        const bw = width * (0.5 + random() * 0.25);
        const bh = height * (0.5 + random() * 0.25);
        buildings.push({
          x: x0 + (width - bw) / 2, y: y0 + (height - bh) / 2, w: bw, h: bh,
          roof: pick(random, PALETTE.buildingRoof), label: null, tall: random() < 0.25,
        });
      } else {
        const vertical = width > height;
        for (let i = 0; i < count; i += 1) {
          const bw = vertical ? width - inset * 2 : (width - inset * (count + 1)) / count;
          const bh = vertical ? (height - inset * (count + 1)) / count : height - inset * 2;
          const bx = vertical ? x0 + inset : x0 + inset + i * (bw + inset);
          const by = vertical ? y0 + inset + i * (bh + inset) : y0 + inset;
          buildings.push({
            x: bx, y: by, w: bw, h: bh,
            roof: pick(random, PALETTE.buildingRoof), label: null, tall: random() < 0.2,
          });
        }
      }
      // A street tree or two per built block.
      for (let i = 0; i < 2; i += 1) {
        trees.push({ x: x0 + 18 + random() * (width - 36), y: y0 + 8, size: 8 + random() * 4 });
      }
    }
  }

  // Beach umbrellas and the marina docks.
  for (let i = 0; i < 12; i += 1) {
    umbrellas.push({
      x: 260 + random() * (WORLD.width - 520),
      y: 2400 + random() * 110,
      color: pick(random, ['#ff6b5e', '#ffd23f', '#4ecdc4', '#ff8fab']),
    });
  }
  for (let i = 0; i < 3; i += 1) {
    docks.push({ x: 60, y: 1960 + i * 130, w: 120, h: 26 });
  }
  // Lamps along every road, every 300 px.
  for (const cx of ROADS_V) {
    for (let y = 140; y < WORLD.height - 60; y += 300) lamps.push({ x: cx + HALF_ROAD + 8, y });
  }
  for (const cy of ROADS_H) {
    for (let x = 140; x < WORLD.width - 60; x += 300) lamps.push({ x, y: cy + HALF_ROAD + 8 });
  }

  const city = {
    buildings, trees, lamps, parks, parkingLots, umbrellas, docks,
    beachTop, waterTop: 2545, marinaX: 170,
    spots: SPOTS,
  };
  return city;
}

/** Water rectangles: the sea along the south edge and the marina basin on the west edge. */
export function waterRects(city) {
  return [
    { x: 0, y: city.waterTop, w: WORLD.width, h: WORLD.height - city.waterTop },
    { x: 0, y: 1900, w: city.marinaX, h: 480 },
  ];
}

/**
 * Push a circle out of buildings, water and the world edge. Returns the corrected
 * position and whether anything blocked it.
 */
export function collideCircle(city, x, y, radius) {
  let hit = false;
  let nx = Math.max(radius, Math.min(WORLD.width - radius, x));
  let ny = Math.max(radius, Math.min(WORLD.height - radius, y));
  if (nx !== x || ny !== y) hit = true;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
    const dx = nx - cx;
    const dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    hit = true;
    if (d2 === 0) {
      // Centre inside the building: push out along the smallest penetration axis.
      const left = nx - b.x;
      const right = b.x + b.w - nx;
      const top = ny - b.y;
      const bottom = b.y + b.h - ny;
      const min = Math.min(left, right, top, bottom);
      if (min === left) nx = b.x - radius;
      else if (min === right) nx = b.x + b.w + radius;
      else if (min === top) ny = b.y - radius;
      else ny = b.y + b.h + radius;
    } else {
      const d = Math.sqrt(d2);
      nx = cx + (dx / d) * radius;
      ny = cy + (dy / d) * radius;
    }
  }
  for (const w of waterRects(city)) {
    const cx = Math.max(w.x, Math.min(nx, w.x + w.w));
    const cy = Math.max(w.y, Math.min(ny, w.y + w.h));
    const dx = nx - cx;
    const dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    hit = true;
    if (d2 === 0) ny = w.y - radius;
    else {
      const d = Math.sqrt(d2);
      nx = cx + (dx / d) * radius;
      ny = cy + (dy / d) * radius;
    }
  }
  return { x: nx, y: ny, hit };
}

function inView(cam, x, y, margin) {
  return x > cam.x - margin && x < cam.x + cam.w + margin && y > cam.y - margin && y < cam.y + cam.h + margin;
}

/** Paint the ground, roads, beach, sea and buildings inside the camera view. */
export function drawCity(ctx, city, cam, sunDir) {
  const { x: vx, y: vy, w: vw, h: vh } = cam;
  // Grass base.
  ctx.fillStyle = PALETTE.grass;
  ctx.fillRect(vx, vy, vw, vh);
  // Mown stripes for a little texture.
  ctx.fillStyle = PALETTE.grassDark;
  const stripe = 160;
  const firstStripe = Math.floor(vy / stripe) * stripe;
  for (let y = firstStripe; y < vy + vh; y += stripe * 2) {
    ctx.fillRect(vx, y, vw, stripe);
  }
  // Beach sand and sea along the south edge.
  if (vy + vh > city.beachTop) {
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(vx, city.beachTop, vw, WORLD.height - city.beachTop);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(vx, city.waterTop, vw, WORLD.height - city.waterTop);
    ctx.fillStyle = PALETTE.waterDeep;
    for (let y = city.waterTop + 26; y < WORLD.height; y += 52) {
      ctx.fillRect(vx, y, vw, 10);
    }
    // Wave line where sand meets sea.
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.fillRect(vx, city.waterTop - 4, vw, 5);
  }
  // Marina basin on the west edge.
  if (vx < city.marinaX) {
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(0, 1900, city.marinaX, 480);
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(0, 1900, city.marinaX, 12);
    ctx.fillStyle = '#8a6f5c';
    for (const dock of city.docks) ctx.fillRect(dock.x, dock.y, dock.w, dock.h);
  }
  // Parks.
  for (const park of city.parks) {
    if (!inView(cam, park.x, park.y, Math.max(park.w, park.h))) continue;
    ctx.fillStyle = PALETTE.park;
    ctx.fillRect(park.x, park.y, park.w, park.h);
  }
  // Parking lots.
  for (const lot of city.parkingLots) {
    if (!inView(cam, lot.x, lot.y, Math.max(lot.w, lot.h))) continue;
    ctx.fillStyle = '#6f6a5e';
    ctx.fillRect(lot.x, lot.y, lot.w, lot.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    for (let x = lot.x + 30; x < lot.x + lot.w - 20; x += 60) {
      ctx.beginPath();
      ctx.moveTo(x, lot.y + 8);
      ctx.lineTo(x, lot.y + 34);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, lot.y + lot.h - 8);
      ctx.lineTo(x, lot.y + lot.h - 34);
      ctx.stroke();
    }
  }
  // Sidewalks and roads.
  ctx.fillStyle = PALETTE.sidewalk;
  for (const cx of ROADS_V) ctx.fillRect(cx - HALF_ROAD - SIDEWALK, vy, ROAD_W + SIDEWALK * 2, vh);
  for (const cy of ROADS_H) ctx.fillRect(vx, cy - HALF_ROAD - SIDEWALK, vw, ROAD_W + SIDEWALK * 2);
  ctx.fillStyle = PALETTE.road;
  for (const cx of ROADS_V) ctx.fillRect(cx - HALF_ROAD, vy, ROAD_W, vh);
  for (const cy of ROADS_H) ctx.fillRect(vx, cy - HALF_ROAD, vw, ROAD_W);
  // Lane dashes, only along the visible stretches.
  ctx.fillStyle = PALETTE.lane;
  for (const cx of ROADS_V) {
    if (cx < vx - 10 || cx > vx + vw + 10) continue;
    const first = Math.floor(vy / 56) * 56;
    for (let y = first; y < vy + vh; y += 56) ctx.fillRect(cx - 2, y, 4, 30);
  }
  for (const cy of ROADS_H) {
    if (cy < vy - 10 || cy > vy + vh + 10) continue;
    const first = Math.floor(vx / 56) * 56;
    for (let x = first; x < vx + vw; x += 56) ctx.fillRect(x, cy - 2, 30, 4);
  }
  // Beach umbrellas.
  for (const u of city.umbrellas) {
    if (!inView(cam, u.x, u.y, 40)) continue;
    ctx.fillStyle = u.color;
    ctx.beginPath();
    ctx.arc(u.x, u.y, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.beginPath();
    ctx.arc(u.x, u.y, 7, 0, Math.PI * 2);
    ctx.fill();
  }
  // Trees (trunk dot + canopy, shadow cast along the sun direction).
  for (const tree of city.trees) {
    if (!inView(cam, tree.x, tree.y, 40)) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.beginPath();
    ctx.arc(tree.x + sunDir.x * 10, tree.y + sunDir.y * 10, tree.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.tree;
    ctx.beginPath();
    ctx.arc(tree.x, tree.y, tree.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.treeLight;
    ctx.beginPath();
    ctx.arc(tree.x - tree.size * 0.25, tree.y - tree.size * 0.25, tree.size * 0.55, 0, Math.PI * 2);
    ctx.fill();
  }
  // Buildings: soft shadow, warm roof, wall edge, and a label for landmarks.
  for (const b of city.buildings) {
    if (!inView(cam, b.x, b.y, Math.max(b.w, b.h))) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.fillRect(b.x + sunDir.x * 14, b.y + sunDir.y * 14, b.w, b.h);
    ctx.fillStyle = PALETTE.buildingWall;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x + 5, b.y + 5, b.w - 10, b.h - 10);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(b.x + 10, b.y + 10, b.w - 20, 8);
    if (b.tall) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(b.x + b.w - 18, b.y + 12, 8, b.h - 24);
    }
    if (b.label) {
      ctx.fillStyle = 'rgba(20,24,32,0.85)';
      ctx.font = `bold 13px ${'system-ui, sans-serif'}`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const tw = ctx.measureText(b.label).width + 18;
      ctx.fillRect(b.x + b.w / 2 - tw / 2, b.y + b.h / 2 - 11, tw, 22);
      ctx.fillStyle = '#f7f3e8';
      ctx.fillText(b.label, b.x + b.w / 2, b.y + b.h / 2 + 1);
    }
  }
  // Lamp posts.
  ctx.fillStyle = '#3a3f47';
  for (const lamp of city.lamps) {
    if (!inView(cam, lamp.x, lamp.y, 10)) continue;
    ctx.fillRect(lamp.x - 2, lamp.y - 2, 4, 4);
  }
}
