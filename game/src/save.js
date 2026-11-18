// Saving: money, finished missions and where the player stands, in localStorage.
// Nothing here is a secret; a save is just the player's own progress in this browser.
import { BEST_KEY, SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || typeof data.money !== 'number') return null;
    return {
      money: data.money,
      completedMissions: Array.isArray(data.completedMissions) ? data.completedMissions : [],
      x: typeof data.x === 'number' ? data.x : null,
      y: typeof data.y === 'number' ? data.y : null,
      playedSeconds: typeof data.playedSeconds === 'number' ? data.playedSeconds : 0,
    };
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      money: state.money,
      completedMissions: state.completedMissions,
      x: state.player.x,
      y: state.player.y,
      playedSeconds: state.playedSeconds,
    }));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to clear.
  }
}

export function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Best money then lasts this visit only.
  }
}
