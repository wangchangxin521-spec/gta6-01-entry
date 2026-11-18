// The HUD: money and health top-left, wanted stars top-right, the mission objective
// top-centre, toasts above the minimap, and a live minimap bottom-right showing the roads,
// the player, the police, the mission marker and the givers. All drawn in screen space.
import { FONT, PALETTE, ROADS_H, ROADS_V, VIEW, WORLD } from './config.js';
import { missionGivers } from './missions.js';

const MAP_W = 220;
const MAP_H = 158;
const MAP_X = VIEW.width - MAP_W - 18;
const MAP_Y = VIEW.height - MAP_H - 18;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

export function drawHud(ctx, state, objective, best, timeLabel) {
  const player = state.player;
  ctx.textBaseline = 'alphabetic';

  // Money and health, top-left.
  ctx.fillStyle = PALETTE.hudPanel;
  roundRect(ctx, 16, 14, 250, 64, 10);
  ctx.fill();
  ctx.font = `bold 26px ${FONT}`;
  ctx.fillStyle = PALETTE.gold;
  ctx.textAlign = 'left';
  ctx.fillText(`$${state.money}`, 30, 44);
  ctx.font = `16px ${FONT}`;
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText('CORAL BAY', 30, 66);
  // Health bar.
  ctx.fillStyle = 'rgba(255,255,255,0.18)';
  roundRect(ctx, 150, 26, 100, 12, 6);
  ctx.fill();
  ctx.fillStyle = player.health > 40 ? '#7fe0a8' : '#ff5a4e';
  roundRect(ctx, 150, 26, Math.max(0, 100 * player.health / 100), 12, 6);
  ctx.fill();
  ctx.fillStyle = PALETTE.text;
  ctx.font = `12px ${FONT}`;
  ctx.fillText('HEALTH', 150, 56);

  // Wanted stars, top-right.
  ctx.fillStyle = PALETTE.hudPanel;
  roundRect(ctx, VIEW.width - 216, 14, 200, 52, 10);
  ctx.fill();
  ctx.font = `bold 26px ${FONT}`;
  ctx.textAlign = 'left';
  for (let i = 0; i < 5; i += 1) {
    ctx.fillStyle = i < state.wanted ? PALETTE.star : 'rgba(255,255,255,0.22)';
    ctx.fillText('★', VIEW.width - 200 + i * 38, 48);
  }
  ctx.font = `12px ${FONT}`;
  ctx.fillStyle = state.wanted > 0 ? PALETTE.danger : PALETTE.muted;
  ctx.fillText(state.wanted > 0 ? 'WANTED — LOSE THE COPS' : 'CLEAN RECORD', VIEW.width - 200, 62);

  // Mission objective, top-centre.
  if (objective) {
    const label = `${objective.name}: ${objective.label}`;
    const timer = ` ${Math.max(0, Math.ceil(objective.timer))}s`;
    ctx.font = `bold 17px ${FONT}`;
    const w = ctx.measureText(label + timer).width + 36;
    ctx.fillStyle = PALETTE.hudPanel;
    roundRect(ctx, (VIEW.width - w) / 2, 14, w, 44, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.mission;
    ctx.textAlign = 'center';
    ctx.fillText(label, VIEW.width / 2, 34);
    ctx.fillStyle = objective.timer < 20 ? PALETTE.danger : PALETTE.text;
    ctx.fillText(timer, VIEW.width / 2, 52);
    ctx.textAlign = 'left';
  } else if (state.completedMissions.length < 3) {
    ctx.font = `16px ${FONT}`;
    ctx.fillStyle = PALETTE.hudPanel;
    const text = 'Find a golden ! marker to take a job';
    const w = ctx.measureText(text).width + 36;
    roundRect(ctx, (VIEW.width - w) / 2, 14, w, 36, 10);
    ctx.fill();
    ctx.fillStyle = PALETTE.muted;
    ctx.textAlign = 'center';
    ctx.fillText(text, VIEW.width / 2, 38);
    ctx.textAlign = 'left';
  }

  // Toasts, above the minimap.
  ctx.font = `16px ${FONT}`;
  ctx.textAlign = 'center';
  let ty = MAP_Y - 16;
  for (let i = state.toasts.length - 1; i >= 0; i -= 1) {
    const toast = state.toasts[i];
    const w = ctx.measureText(toast.text).width + 28;
    ctx.fillStyle = 'rgba(12, 18, 26, 0.8)';
    roundRect(ctx, VIEW.width / 2 - w / 2, ty - 22, w, 30, 8);
    ctx.fill();
    ctx.fillStyle = PALETTE.text;
    ctx.fillText(toast.text, VIEW.width / 2, ty);
    ty -= 38;
  }
  ctx.textAlign = 'left';

  drawMinimap(ctx, state, objective);

  // Controls hint, bottom-left, and the clock.
  ctx.font = `14px ${FONT}`;
  ctx.fillStyle = 'rgba(12, 18, 26, 0.72)';
  const hint = player.inCar
    ? 'WASD drive · E get out · P pause'
    : 'WASD walk · E enter car / talk · Space punch · P pause';
  const hw = ctx.measureText(hint).width + 24;
  roundRect(ctx, 16, VIEW.height - 44, hw, 28, 8);
  ctx.fill();
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(hint, 28, VIEW.height - 25);
  ctx.fillStyle = PALETTE.hudPanel;
  roundRect(ctx, 16, VIEW.height - 82, 150, 28, 8);
  ctx.fill();
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`${timeLabel}  ·  Best $${best}`, 28, VIEW.height - 63);
}

/** The minimap: the whole city shrunk, with the player, police and objectives on it. */
function drawMinimap(ctx, state, objective) {
  const sx = MAP_W / WORLD.width;
  const sy = MAP_H / WORLD.height;
  const city = state.city;
  ctx.fillStyle = PALETTE.hudPanel;
  roundRect(ctx, MAP_X - 6, MAP_Y - 6, MAP_W + 12, MAP_H + 12, 10);
  ctx.fill();
  ctx.save();
  ctx.beginPath();
  ctx.rect(MAP_X, MAP_Y, MAP_W, MAP_H);
  ctx.clip();
  // Ground, water and sand.
  ctx.fillStyle = '#5d9448';
  ctx.fillRect(MAP_X, MAP_Y, MAP_W, MAP_H);
  ctx.fillStyle = '#2e8fa8';
  ctx.fillRect(MAP_X, MAP_Y + city.waterTop * sy, MAP_W, MAP_H - city.waterTop * sy);
  ctx.fillRect(MAP_X, MAP_Y + 1900 * sy, city.marinaX * sx, 480 * sy);
  ctx.fillStyle = '#ecd9a4';
  ctx.fillRect(MAP_X, MAP_Y + city.beachTop * sy, MAP_W, (city.waterTop - city.beachTop) * sy);
  // Roads.
  ctx.fillStyle = '#3a3f47';
  for (const cx of ROADS_V) ctx.fillRect(MAP_X + cx * sx - 2, MAP_Y, 4, MAP_H);
  for (const cy of ROADS_H) ctx.fillRect(MAP_X, MAP_Y + cy * sy, MAP_W, 4);
  // Mission givers.
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = 'bold 13px system-ui, sans-serif';
  for (const giver of missionGivers()) {
    if (state.completedMissions.includes(giver.def.id)) continue;
    ctx.fillStyle = PALETTE.mission;
    ctx.fillText('!', MAP_X + giver.x * sx, MAP_Y + giver.y * sy);
  }
  // Objective marker, pulsing.
  if (objective) {
    const pulse = 5 + Math.sin(state.elapsed * 5) * 2;
    ctx.fillStyle = PALETTE.mission;
    ctx.beginPath();
    ctx.arc(MAP_X + objective.x * sx, MAP_Y + objective.y * sy, pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(MAP_X + objective.x * sx, MAP_Y + objective.y * sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police.
  ctx.fillStyle = '#4a90ff';
  for (const car of state.police.cars) {
    ctx.beginPath();
    ctx.arc(MAP_X + car.x * sx, MAP_Y + car.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const cop of state.police.cops) {
    ctx.beginPath();
    ctx.arc(MAP_X + cop.x * sx, MAP_Y + cop.y * sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const px = MAP_X + state.player.x * sx;
  const py = MAP_Y + state.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(state.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.restore();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
}
