// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// view is scaled to fit the window and centred, the margin filled with the backdrop colour.
// The world is drawn in camera space; the HUD and the title/pause/busted panels are drawn
// in screen space on top. A warm day-cycle tint washes over everything.
import { FONT, PALETTE, VIEW } from './config.js';
import { drawCity } from './city.js';
import { drawTraffic, drawOneCar } from './traffic.js';
import { drawPedestrians } from './pedestrians.js';
import { drawPolice } from './police.js';
import { missionGivers, nearGiver } from './missions.js';
import { drawHud } from './hud.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const PANEL = { width: 640, top: 150, line: 34, bottom: 76 };

/** Warm tint for the time of day: gold morning, bright noon, orange sunset, violet dusk. */
export function dayTint(timeOfDay) {
  if (timeOfDay < 0.25) return { color: '255, 176, 92', alpha: 0.10 + 0.08 * (timeOfDay / 0.25) };
  if (timeOfDay < 0.55) return { color: '255, 214, 130', alpha: 0.05 };
  if (timeOfDay < 0.8) return { color: '255, 150, 70', alpha: 0.06 + 0.10 * ((timeOfDay - 0.55) / 0.25) };
  return { color: '90, 70, 160', alpha: 0.10 + 0.12 * ((timeOfDay - 0.8) / 0.2) };
}

/** A clock label for the time of day: the day starts at 8 in the morning. */
export function timeLabel(timeOfDay) {
  const hours = (8 + timeOfDay * 16) % 24;
  const h = Math.floor(hours);
  const m = Math.floor((hours - h) * 60);
  const ampm = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / VIEW.width, height / VIEW.height);
    view.x = (width - VIEW.width * view.scale) / 2;
    view.y = (height - VIEW.height * view.scale) / 2;
  }

  const fonts = new Map();
  function text(value, x, y, size, color, align, weight) {
    const key = `${weight || ''}${size}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ? `${weight} ` : ''}${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align;
    context.fillText(value, x, y);
  }

  /** The player on foot: a top-down figure with a swinging punch. */
  function drawPlayer(state, sunDir) {
    const player = state.player;
    if (player.inCar) return;
    const ctx = context;
    ctx.save();
    ctx.translate(player.x, player.y);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.22)';
    ctx.beginPath();
    ctx.ellipse(1 + sunDir.x * 6, 2 + sunDir.y * 6, 13, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.rotate(player.angle);
    // Body in a blue shirt, head, and a fist that swings out while punching.
    ctx.fillStyle = PALETTE.playerShirt;
    ctx.beginPath();
    ctx.roundRect(-10, -9, 20, 18, 7);
    ctx.fill();
    ctx.fillStyle = '#e8b98a';
    ctx.beginPath();
    ctx.arc(12, 0, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#2c2620';
    ctx.beginPath();
    ctx.arc(11, -2, 5.5, Math.PI, Math.PI * 2);
    ctx.fill();
    if (player.punchAnim > 0) {
      const reach = 14 + (0.22 - player.punchAnim) * 60;
      ctx.fillStyle = '#e8b98a';
      ctx.beginPath();
      ctx.arc(reach, 0, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  /** Golden markers: givers, the current objective, and the off-screen objective arrow. */
  function drawMarkers(state, objective, interactive) {
    const ctx = context;
    const pulse = 1 + Math.sin(state.elapsed * 4) * 0.12;
    // Givers.
    for (const giver of missionGivers()) {
      if (state.completedMissions.includes(giver.def.id)) continue;
      if (state.mission) continue;
      const x = giver.x;
      const y = giver.y;
      ctx.fillStyle = 'rgba(255, 210, 63, 0.25)';
      ctx.beginPath();
      ctx.arc(x, y, 34 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = PALETTE.mission;
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', x, y + 1);
      if (interactive) {
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = 'rgba(0,0,0,0.6)';
        ctx.lineWidth = 3;
        ctx.strokeText(giver.def.name, x, y - 30);
        ctx.fillText(giver.def.name, x, y - 30);
      }
    }
    // Objective marker and the arrow at the screen edge that points to it.
    if (objective) {
      ctx.fillStyle = 'rgba(255, 210, 63, 0.3)';
      ctx.beginPath();
      ctx.arc(objective.x, objective.y, 30 * pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = PALETTE.mission;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(objective.x, objective.y, 22, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.mission;
      ctx.beginPath();
      ctx.arc(objective.x, objective.y, 6, 0, Math.PI * 2);
      ctx.fill();
      // Off-screen arrow: point from the player toward the objective, clamped to the view.
      const cam = state.camera;
      const margin = 60;
      const px = state.player.x;
      const py = state.player.y;
      if (objective.x < cam.x + margin || objective.x > cam.x + cam.w - margin
        || objective.y < cam.y + margin || objective.y > cam.y + cam.h - margin) {
        const dx = objective.x - px;
        const dy = objective.y - py;
        const d = Math.hypot(dx, dy) || 1;
        const ax = px + (dx / d) * 300;
        const ay = py + (dy / d) * 300;
        const angle = Math.atan2(dy, dx);
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(angle);
        ctx.fillStyle = PALETTE.mission;
        ctx.beginPath();
        ctx.moveTo(18, 0);
        ctx.lineTo(-10, -12);
        ctx.lineTo(-10, 12);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 4;
        const dist = Math.round(d);
        ctx.strokeText(`${dist}m`, ax, ay - 26);
        ctx.fillText(`${dist}m`, ax, ay - 26);
      }
    }
    // The "press E" prompt when a giver or a car is in reach (play screen only).
    const giver = interactive ? nearGiver(state) : null;
    if (giver && !state.player.inCar) {
      const x = state.player.x;
      const y = state.player.y - 44;
      ctx.font = 'bold 15px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const label = `Press E — ${giver.def.name} ($${giver.def.reward})`;
      const w = ctx.measureText(label).width + 24;
      ctx.fillStyle = 'rgba(12, 18, 26, 0.85)';
      ctx.beginPath();
      ctx.roundRect(x - w / 2, y - 15, w, 30, 8);
      ctx.fill();
      ctx.fillStyle = PALETTE.mission;
      ctx.fillText(label, x, y + 1);
    } else if (interactive && !state.player.inCar && !state.mission) {
      // A parked car nearby gets a quieter hint.
      let near = null;
      let bestD = 84;
      for (const car of state.cars) {
        if (car.kind !== 'parked') continue;
        const d = Math.hypot(car.x - state.player.x, car.y - state.player.y);
        if (d < bestD) { bestD = d; near = car; }
      }
      if (near) {
        ctx.font = 'bold 14px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(12, 18, 26, 0.85)';
        ctx.beginPath();
        ctx.roundRect(state.player.x - 70, state.player.y - 58, 140, 26, 8);
        ctx.fill();
        ctx.fillStyle = PALETTE.text;
        ctx.fillText('Press E to take the car', state.player.x, state.player.y - 44);
      }
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  function drawParticles(state) {
    const ctx = context;
    for (const p of state.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawWorld(state, sunDir, screen) {
    const ctx = context;
    const cam = state.camera;
    ctx.save();
    ctx.translate(-cam.x, -cam.y);
    drawCity(ctx, state.city, cam, sunDir);
    drawTraffic(ctx, state.cars, cam, state.timeOfDay > 0.8);
    if (state.targetVan) drawOneCar(ctx, state.targetVan, state.timeOfDay > 0.8);
    drawPedestrians(ctx, state.peds, cam);
    drawPolice(ctx, state.police, cam, state.timeOfDay > 0.8);
    if (state.player.inCar && state.playerCar) {
      drawOneCar(ctx, state.playerCar, state.timeOfDay > 0.8);
    }
    drawPlayer(state, sunDir);
    drawMarkers(state, state.mission ? {
      label: state.mission.stage.label,
      x: state.mission.stage.x,
      y: state.mission.stage.y,
      timer: state.mission.timer,
      name: state.mission.name,
    } : null, screen === SCREEN_PLAY);
    drawParticles(state);
    ctx.restore();
    // Warm day-cycle tint over the whole view.
    const tint = dayTint(state.timeOfDay);
    ctx.fillStyle = `rgba(${tint.color}, ${tint.alpha})`;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
    // Vignette: a soft dark edge so the centre reads.
    const gradient = ctx.createRadialGradient(
      VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.45,
      VIEW.width / 2, VIEW.height / 2, VIEW.height * 0.95,
    );
    gradient.addColorStop(0, 'rgba(0,0,0,0)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, VIEW.width, VIEW.height);
  }

  function drawPanel(title, lines, prompt, accent) {
    const ctx = context;
    const height = PANEL.top + lines.length * PANEL.line + PANEL.bottom;
    const x = (VIEW.width - PANEL.width) / 2;
    const y = (VIEW.height - height) / 2;
    ctx.fillStyle = 'rgba(12, 18, 26, 0.94)';
    ctx.beginPath();
    ctx.roundRect(x, y, PANEL.width, height, 14);
    ctx.fill();
    ctx.strokeStyle = accent || PALETTE.gold;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.textBaseline = 'alphabetic';
    text(title, VIEW.width / 2, y + 78, 46, PALETTE.text, 'center', 'bold');
    for (let index = 0; index < lines.length; index += 1) {
      text(lines[index], VIEW.width / 2, y + PANEL.top + index * PANEL.line, 20, PALETTE.muted, 'center');
    }
    text(prompt, VIEW.width / 2, y + height - 38, 22, PALETTE.gold, 'center', 'bold');
  }

  const TITLE_LINES = [
    'A sunny seaside city, yours to take: walk it, steal a car,',
    'outrun the police, and run three jobs for the people of Coral Bay.',
    'WASD move and drive · E enter a car or talk · Space punch · P pause',
    'Steal a car and the cops come. Lie low and the stars fade.',
    '',
  ];
  const PAUSED_LINES = ['The city waits for you. Your progress is saved.'];
  const OVER_LINES = ['', '', ''];

  /** Paint one frame: the world, then the HUD or a panel for the screen the game is on. */
  function draw(state, screen, best, world) {
    const ctx = context;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = PALETTE.backdrop;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    const sun = world.sunDir();
    drawWorld(state, sun, screen);
    const objective = world.currentObjective();
    if (screen === SCREEN_TITLE) {
      TITLE_LINES[4] = state.completedMissions.length > 0
        ? `Jobs done: ${state.completedMissions.length} of 3 · Best $${best}`
        : `Best $${best} · 3 jobs waiting in the city`;
      drawPanel('CORAL BAY', TITLE_LINES, 'Press Space or click to start', PALETTE.gold);
      return;
    }
    drawHud(ctx, state, objective, best, timeLabel(state.timeOfDay));
    if (screen === SCREEN_PAUSED) {
      drawPanel('Paused', PAUSED_LINES, 'Press P to resume');
    } else if (screen === SCREEN_OVER) {
      OVER_LINES[0] = `Busted. The cops took $100.`;
      OVER_LINES[1] = `Money: $${state.money} · Jobs done: ${state.completedMissions.length} of 3`;
      OVER_LINES[2] = '';
      drawPanel('BUSTED', OVER_LINES, 'Press Space to get back out there', PALETTE.danger);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
