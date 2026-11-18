// Missions: three story jobs with a giver, a briefing, stages, a timer and a payout.
// A mission is taken by walking into its golden marker and pressing E; each stage is a
// place to reach (or a van to stop), and finishing pays out and saves the game.
import { MISSIONS, PLAYER } from './config.js';

export const MISSION_NONE = 'none';
export const MISSION_ACTIVE = 'active';
export const MISSION_DONE = 'done';
export const MISSION_FAILED = 'failed';

/** Where the three givers stand, waiting for the player. */
export function missionGivers() {
  return MISSIONS.map((def) => ({
    def,
    x: def.giverAt.x,
    y: def.giverAt.y,
  }));
}

/** The giver the player is close enough to talk to, or null. */
export function nearGiver(state) {
  if (state.mission) return null;
  for (const giver of missionGivers()) {
    if (state.completedMissions.includes(giver.def.id)) continue;
    const d = Math.hypot(state.player.x - giver.x, state.player.y - giver.y);
    if (d < PLAYER.interactRange) return giver;
  }
  return null;
}

/** Start a mission: reset its timer, arm its first stage, and return its briefing. */
export function startMission(state, giver) {
  const def = giver.def;
  const mission = {
    defId: def.id,
    name: def.name,
    giver: def.giver,
    briefing: def.briefing,
    reward: def.reward,
    timer: def.timeLimit,
    stageIndex: 0,
    stage: def.stages[0],
    hits: 0,
    hitsToStop: def.hitsToStop || 0,
    targetCar: null,
  };
  state.mission = mission;
  return mission;
}

/** The current objective: its label, position and seconds left. */
export function currentObjective(state) {
  if (!state.mission) return null;
  const mission = state.mission;
  return {
    label: mission.stage.label,
    x: mission.stage.x,
    y: mission.stage.y,
    timer: mission.timer,
    name: mission.name,
  };
}

function completeMission(state) {
  const mission = state.mission;
  state.money += mission.reward;
  state.completedMissions.push(mission.defId);
  state.mission = null;
  return mission;
}

/**
 * One step for the active mission. `events` carries the flags object the world passes
 * around; returns a short outcome string ('done' | 'failed' | null) for the caller.
 */
export function stepMission(state, dt, events) {
  const mission = state.mission;
  if (!mission) return null;
  mission.timer -= dt;
  if (mission.timer <= 0) {
    state.mission = null;
    return 'failed';
  }
  const def = MISSIONS.find((m) => m.id === mission.defId);
  const stage = mission.stage;
  const player = state.player;

  if (mission.defId === 'runaway') {
    // The van is stopped by ramming it; the world reports rams through events.
    if (mission.hits >= mission.hitsToStop && mission.targetCar) {
      mission.targetCar.speed = 0;
      mission.targetCar.kind = 'parked';
      completeMission(state);
      events.flags |= events.EVENT_MISSION_DONE;
      return 'done';
    }
    return null;
  }

  const d = Math.hypot(player.x - stage.x, player.y - stage.y);
  if (d > 56) return null;
  if (mission.stageIndex + 1 < def.stages.length) {
    mission.stageIndex += 1;
    mission.stage = def.stages[mission.stageIndex];
    events.flags |= events.EVENT_PICKUP;
    return null;
  }
  completeMission(state);
  events.flags |= events.EVENT_MISSION_DONE;
  return 'done';
}

/** The runaway van for the chase mission: spawns ahead of the player on a road. */
export function spawnRunawayVan(state, random) {
  const van = {
    x: state.player.x + 420,
    y: 850,
    angle: 0,
    speed: 260,
    color: '#8a6f5c',
    kind: 'target',
    axis: 'h',
    dir: 1,
    lane: 30,
    targetSpeed: 300,
    turnTimer: 4,
    stopped: 0,
  };
  return van;
}
